// Shared source-status vocabulary for the agent layer (R7).
//
// Provider -> Service -> Tool -> Agent -> Synthesis -> final itinerary all
// carry the same five states, so a fallback/sample value can never be
// mistaken for provider data further down the pipeline:
//   live        a provider call succeeded during this planning run
//   cached      AtlasAI's cache of an earlier provider response (maybe stale)
//   estimated   an AtlasAI heuristic (e.g. food/local-travel allowance), not provider data
//   sample      bundled demo data
//   unavailable nothing usable exists (never turned into a plausible-looking value)

export const SOURCE_STATE = Object.freeze({
  LIVE: 'live',
  CACHED: 'cached',
  ESTIMATED: 'estimated',
  SAMPLE: 'sample',
  UNAVAILABLE: 'unavailable',
})

const KNOWN = new Set(Object.values(SOURCE_STATE))

// Services historically use 'none' (attractions) for "nothing"; anything
// unrecognised is treated as unavailable rather than guessed.
export function normalizeState(dataSource) {
  return KNOWN.has(dataSource) ? dataSource : SOURCE_STATE.UNAVAILABLE
}

export function isRealState(state) {
  return state === SOURCE_STATE.LIVE || state === SOURCE_STATE.CACHED
}

export function makeSource({ dataSource, provider = null, fallbackReason = null, stale = false, note = null } = {}) {
  const state = normalizeState(dataSource)
  return {
    state,
    provider: provider || null,
    fallbackReason: fallbackReason || null,
    ...(stale ? { stale: true } : {}),
    ...(note ? { note } : {}),
  }
}

export const unavailableSource = (fallbackReason = null, note = null) =>
  makeSource({ dataSource: SOURCE_STATE.UNAVAILABLE, fallbackReason, note })

// Weakest-link summary of several sources (for one combined label).
const RANK = { live: 0, cached: 1, estimated: 2, sample: 3, unavailable: 4 }
export function weakestState(states) {
  const list = states.filter(Boolean).map(normalizeState)
  if (!list.length) return SOURCE_STATE.UNAVAILABLE
  return list.reduce((worst, s) => (RANK[s] > RANK[worst] ? s : worst), list[0])
}

// Provider currency handling: AtlasAI's budget is INR and no conversion
// service exists, so a non-INR amount is never silently summed into an INR total.
export const BASE_CURRENCY = 'INR'
export function isBaseCurrency(currency) {
  return !currency || String(currency).toUpperCase() === BASE_CURRENCY
}

// Errors from tools/agents must never carry stack traces or provider URLs
// into agent output, trace events or SSE.
export function safeErrorReason(err) {
  const msg = String(err?.message || 'unexpected_error')
  return msg.replace(/https?:\/\/\S+/g, '[url]').replace(/(key|token|secret|authorization|appid)[=:]\s*\S+/gi, '$1=[redacted]').slice(0, 160)
}
