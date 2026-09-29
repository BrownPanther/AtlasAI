import { safeErrorReason } from './sourceStatus.js'

export class Agent {
  constructor({ name, role, description, tools = [], inputSchema = null, outputSchema = null, dependsOn = [] }) {
    this.name = name
    this.role = role
    this.description = description
    this.tools = tools
    this.inputSchema = inputSchema
    this.outputSchema = outputSchema
    this.dependsOn = dependsOn
  }

  // Subclasses implement this. Must return an AgentResult-shaped object
  // (see AgentResult.js) built via the `agentResult()` helper.
  // eslint-disable-next-line no-unused-vars
  async execute(context) {
    throw new Error(`${this.name}.execute() not implemented`)
  }

  async run(context) {
    const startedAt = Date.now()
    context.trace(this.name, 'running')
    try {
      const result = await this.execute(context)
      const ms = Date.now() - startedAt
      context.trace(this.name, result.status === 'error' ? 'error' : result.status === 'warning' ? 'warning' : 'success', {
        ms,
        summary: result.summary,
        issues: result.issues?.length ? result.issues : undefined,
      })
      return { ...result, agent: this.name, ms }
    } catch (err) {
      const ms = Date.now() - startedAt
      context.trace(this.name, 'error', { ms, error: safeErrorReason(err) })
      throw Object.assign(err, { agent: this.name })
    }
  }
}
