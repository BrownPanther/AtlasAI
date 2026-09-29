export class AgentContext {
  constructor({ tripRequest, runId, userId, maxReplanIterations = 2, onTrace = null }) {
    this.state = {
      tripRequest,
      intent: null,
      transport: null,
      stay: null,
      activities: null,
      budget: null,
      safety: null,
      critique: null,
      replanning: null,
      finalPlan: null,
      // R7 shared real-data context (transient, per planning run; provider
      // payloads themselves are never stored here — only normalized facts).
      weather: null, // { current, forecast: [...], sources }
      routes: null, // { legs: [...], summary, source }
      sources: {}, // per-category source status, see agents/sourceStatus.js
    }
    this._memo = new Map()
    this.runId = runId
    this.userId = userId
    this.iteration = 0
    this.maxReplanIterations = maxReplanIterations
    this.executionTrace = []
    this._cancelled = false
    this.onTrace = onTrace
    // Engineering-level replanning signals (not shown to the user directly,
    // consumed by specialist agents on rerun). Kept separate from `state` so
    // the original intent the user gave is never silently overwritten.
    this.adjustments = {
      forceComfortTier: null,
      forceTransportMode: null,
      forcePace: null,
      dedupeActivities: false,
      consolidateAreas: false,
      activityBudgetMultiplier: 1,
      // R7 replanning signals driven by real-data problems.
      excludeTransportModes: [],
      excludeStayIds: [],
      preferIndoor: false,
    }
  }

  trace(agent, status, extra = {}) {
    const entry = { agent, status, at: new Date().toISOString(), iteration: this.iteration, ...extra }
    this.executionTrace.push(entry)
    if (this.onTrace) {
      try {
        this.onTrace(entry)
      } catch {
        // A broken consumer (e.g. a client that disconnected mid-stream) must never break orchestration.
      }
    }
  }

  // Run-scoped promise memo: agents that run in parallel and need the same
  // provider data (e.g. weather for both Activity and Safety) share one call.
  once(key, factory) {
    if (!this._memo.has(key)) this._memo.set(key, Promise.resolve().then(factory))
    return this._memo.get(key)
  }

  // Forget memoised results (used before a replanning rerun so a retry
  // re-reads the service — whose own cache still prevents duplicate provider calls).
  forget(prefix) {
    for (const k of this._memo.keys()) if (k.startsWith(prefix)) this._memo.delete(k)
  }

  recordSource(category, source) {
    this.state.sources[category] = source
  }

  cancel() {
    this._cancelled = true
  }

  get cancelled() {
    return this._cancelled
  }
}
