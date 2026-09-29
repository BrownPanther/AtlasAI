import { agents, agentsByName } from './registry.js'
import { agentResult } from './AgentResult.js'
import { safeErrorReason } from './sourceStatus.js'

const DEFAULT_TIMEOUT_MS = 8000
const DEFAULT_RETRIES = 1

async function withTimeout(promise, ms, label) {
  let timer
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
  })
  try {
    return await Promise.race([promise, timeout])
  } finally {
    clearTimeout(timer)
  }
}

async function runWithRetry(agent, context, { timeoutMs, retries }) {
  let lastErr
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (context.cancelled) throw new Error('Run was cancelled')
    try {
      return await withTimeout(agent.run(context), timeoutMs, agent.name)
    } catch (err) {
      lastErr = err
      if (attempt < retries) context.trace(agent.name, 'retrying', { attempt: attempt + 1, error: safeErrorReason(err) })
    }
  }
  throw lastErr
}

const AGENT_STATE_KEY = {
  'Transport Agent': 'transport',
  'Stay Agent': 'stay',
  'Activity Agent': 'activities',
}

// One specialist failing (a tool bug, a provider surprise that escaped its
// service) must not sink the whole plan (R7). The failure becomes an
// error-status result with empty data — downstream agents treat that as
// "unavailable" and the Critic reports it — and only a sanitized reason
// (no stack, no URL, no secret) is kept.
async function settle(agent, context, opts) {
  try {
    return await runWithRetry(agent, context, opts)
  } catch (err) {
    if (context.cancelled) throw err
    const reason = safeErrorReason(err)
    context.trace(agent.name, 'error', { summary: `${agent.name} failed; continuing without it`, error: reason })
    context.trace('Orchestrator', 'warning', { summary: `${agent.name} unavailable — continuing with remaining data` })
    return agentResult({
      status: 'error',
      summary: `${agent.name} could not complete.`,
      data: { recommended: null, alternatives: [], dataSource: 'unavailable', source: { state: 'unavailable', provider: null, fallbackReason: 'agent_failed' } },
      issues: [{ type: 'agent_failed', severity: 'moderate', detail: reason }],
    })
  }
}

export class Orchestrator {
  constructor({ maxReplanIterations = 2, timeoutMs = DEFAULT_TIMEOUT_MS, retries = DEFAULT_RETRIES } = {}) {
    this.maxReplanIterations = maxReplanIterations
    this.opts = { timeoutMs, retries }
  }

  async run(context) {
    context.maxReplanIterations = this.maxReplanIterations
    context.trace('Orchestrator', 'running', { summary: 'Understanding trip request' })

    const intentResult = await runWithRetry(agents.intent, context, this.opts)
    context.state.intent = intentResult.data

    if (intentResult.status === 'error') {
      context.trace('Orchestrator', 'error', { summary: 'Could not understand trip request', issues: intentResult.issues })
      const err = new Error('Intent extraction failed: ' + (intentResult.issues?.[0]?.type || 'unknown'))
      err.context = context
      throw err
    }
    context.trace('Orchestrator', 'success', { summary: 'Trip requirements understood' })

    if (context.cancelled) throw new Error('Run was cancelled')

    // Transport, stay and activities are independent of each other and run in
    // parallel (each reaches its data through tool -> service -> provider;
    // weather is fetched once per run and shared via the run context).
    const [transportResult, stayResult, activityResult] = await Promise.all([
      settle(agents.transport, context, this.opts),
      settle(agents.stay, context, this.opts),
      settle(agents.activity, context, this.opts),
    ])
    context.state.transport = transportResult
    context.state.stay = stayResult
    context.state.activities = activityResult

    // Safety consumes the selected transport, measured routes and weather, so
    // it runs after them. It is optional context: a failure never blocks the plan.
    context.state.safety = await settle(agents.safety, context, this.opts)

    context.state.budget = await runWithRetry(agents.budget, context, this.opts)
    context.state.critique = await runWithRetry(agents.critic, context, this.opts)

    while (!context.state.critique.data.approved && context.iteration < this.maxReplanIterations) {
      if (context.cancelled) throw new Error('Run was cancelled')
      context.iteration++

      const replanResult = await runWithRetry(agents.replanning, context, this.opts)
      context.state.replanning = replanResult

      const rerunNames = replanResult.data.rerunAgents || []
      if (rerunNames.length === 0) break // nothing actionable — stop rather than loop forever

      const rerunResults = await Promise.all(
        rerunNames.map(async (name) => ({ name, result: await settle(agentsByName[name], context, this.opts) }))
      )
      for (const { name, result } of rerunResults) {
        const key = AGENT_STATE_KEY[name]
        if (key) context.state[key] = result
      }

      // Safety reads transport/routes: refresh it when those were re-planned.
      if (rerunNames.some((n) => n === 'Transport Agent' || n === 'Activity Agent')) {
        context.state.safety = await settle(agents.safety, context, this.opts)
      }

      context.state.budget = await runWithRetry(agents.budget, context, this.opts)
      context.state.critique = await runWithRetry(agents.critic, context, this.opts)
    }

    const synthesisResult = await runWithRetry(agents.synthesis, context, this.opts)
    context.state.finalPlan = synthesisResult.data

    context.trace('Orchestrator', context.state.critique.data.approved ? 'success' : 'warning', {
      summary: context.state.critique.data.approved
        ? 'Final itinerary generated and approved'
        : `Final itinerary generated with ${context.state.critique.data.issues.length} unresolved issue(s) after ${context.iteration} replanning attempt(s)`,
    })

    return context
  }
}
