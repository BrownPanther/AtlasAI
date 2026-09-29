import { mapsService } from '../services/mapsService.js'
import { makeSource } from '../agents/sourceStatus.js'

// Agent-facing routing tool (R7): Agent -> routeTool -> mapsService -> provider.
// Owns the deadline/degradation rules previously inlined in itineraryTool so
// ActivityAgent (planning) and SynthesisAgent (scheduling) share one path
// and never duplicate routing logic.

export const ROUTE_DEADLINE_MS = 3000

function withDeadline(promise, ms) {
  let timer
  const deadline = new Promise((resolve) => {
    timer = setTimeout(() => resolve({ timedOut: true }), ms)
  })
  return Promise.race([promise, deadline]).finally(() => clearTimeout(timer))
}

const unavailableLeg = (mode, fallbackReason) => ({
  distanceKm: null, durationMinutes: null, mode, dataSource: 'unavailable', provider: null, cached: false, fallbackReason,
})

const validCoords = (c) => c && Number.isFinite(Number(c.lat)) && Number.isFinite(Number(c.lng))

/** One leg. Never throws; unavailable results carry a fallbackReason, never a guessed distance/duration. */
export async function getRoute(from, to, mode = 'driving', { deadlineMs = ROUTE_DEADLINE_MS } = {}) {
  if (!validCoords(from) || !validCoords(to)) return unavailableLeg(mode, 'missing_coordinates')
  try {
    const result = await withDeadline(mapsService.getRoute(from, to, mode), deadlineMs)
    if (result?.timedOut) return unavailableLeg(mode, 'timeout')
    return result || unavailableLeg(mode, 'provider_unavailable')
  } catch {
    return unavailableLeg(mode, 'provider_unavailable')
  }
}

/**
 * Several legs concurrently (total cost ~one deadline, not N).
 * pairs: [{ fromId, toId, from: {lat,lng}, to: {lat,lng} }]
 */
export async function getRouteLegs(pairs, { mode = 'driving', deadlineMs = ROUTE_DEADLINE_MS } = {}) {
  const legs = await Promise.all(
    pairs.map(async (p) => ({ fromId: p.fromId, toId: p.toId, ...(await getRoute(p.from, p.to, mode, { deadlineMs })) }))
  )
  return { legs, summary: summarizeLegs(legs) }
}

export function summarizeLegs(legs) {
  const real = legs.filter((l) => l.dataSource === 'live' || l.dataSource === 'cached')
  const live = real.filter((l) => l.dataSource === 'live').length
  const cached = real.length - live
  const reasons = [...new Set(legs.filter((l) => l.dataSource === 'unavailable').map((l) => l.fallbackReason).filter(Boolean))]
  return {
    legsRequested: legs.length,
    legsLive: live,
    legsCached: cached,
    legsUnavailable: legs.length - real.length,
    // Sum of KNOWN legs only — unavailable legs are not counted as zero-minute legs.
    knownTravelMinutes: real.reduce((s, l) => s + (l.durationMinutes || 0), 0),
    knownDistanceKm: Math.round(real.reduce((s, l) => s + (l.distanceKm || 0), 0) * 10) / 10,
    complete: legs.length > 0 && real.length === legs.length,
    unavailableReasons: reasons,
    source: makeSource({
      dataSource: !legs.length ? 'unavailable' : live ? 'live' : cached ? 'cached' : 'unavailable',
      provider: real[0]?.provider || null,
      fallbackReason: real.length ? null : reasons[0] || null,
    }),
  }
}
