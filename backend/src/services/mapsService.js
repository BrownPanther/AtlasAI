import { openRouteServiceProvider } from '../providers/openRouteServiceProvider.js'
import { normalizeOpenRouteServiceRoute, unavailableRoute } from '../normalizers/routeNormalizer.js'
import { cacheStore } from '../cache/cacheStore.js'
import { CACHE_TTL_SECONDS } from './cacheDurations.js'
import { env } from '../config/env.js'

// Service layer for maps/routing (distance + duration between two points).
// This is the ONLY module (besides tools/itineraryTool.js and
// routes/routes.routes.js, which call it) that knows OpenRouteService
// exists — everything else deals in the canonical route shape from
// normalizers/routeNormalizer.js.
//
// Fallback order: fresh cache -> provider -> stale cache -> unavailable.
// Never fabricates distance/duration and never approximates road travel
// time from straight-line distance.

const PROVIDER = 'openrouteservice'
const CATEGORY = 'routes'
const TTL = CACHE_TTL_SECONDS.routes

// Circuit breaker: same pattern as attractionsService — after an auth or
// rate-limit rejection, stop calling the provider for a while (serving
// cache/unavailable instead) rather than hammering an API that has told us
// to stop.
const BREAKER_MS = { auth: 5 * 60 * 1000, rate_limited: 60 * 1000 }
let breaker = { until: 0, errorType: null }

function warn(...args) {
  if (env.nodeEnv !== 'test') console.warn('[atlasai][maps]', ...args)
}

function fallbackReasonFor(errorType) {
  switch (errorType) {
    case 'not_configured': return 'not_configured'
    case 'unsupported_mode': return 'unsupported_mode'
    case 'timeout': return 'timeout'
    case 'rate_limited': return 'rate_limited'
    default: return 'provider_unavailable' // auth, network, http, malformed — details stay in server logs
  }
}

// Round to ~11m precision so near-identical requests (floating point noise,
// minor coordinate drift) share one cache entry / provider call, without
// merging genuinely different locations.
function roundCoord(n) {
  return Math.round(Number(n) * 10000) / 10000
}

function isValidPoint(p) {
  return Boolean(p) && Number.isFinite(Number(p.lat)) && Number.isFinite(Number(p.lng))
}

function routeCacheKey(from, to, mode) {
  return cacheStore.buildKey(CATEGORY, PROVIDER, {
    fromLat: roundCoord(from.lat), fromLng: roundCoord(from.lng),
    toLat: roundCoord(to.lat), toLng: roundCoord(to.lng),
    mode,
  })
}

export const mapsService = {
  isLive() {
    return openRouteServiceProvider.isConfigured()
  },

  /**
   * Distance/duration between two { lat, lng } points, for one of
   * AtlasAI's transport modes. Never fabricates a value: invalid
   * coordinates, an unconfigured provider, an unsupported mode, or a
   * failed request all resolve to unavailableRoute() (with a
   * `fallbackReason` code) rather than throwing or guessing.
   *
   * @returns {{ distanceKm, durationMinutes, mode, dataSource: 'live'|'cached'|'unavailable',
   *             provider, cached, stale?, fallbackReason? }}
   */
  async getRoute(from, to, mode = 'driving') {
    if (!isValidPoint(from) || !isValidPoint(to)) return unavailableRoute(mode, 'invalid_coordinates')
    if (!this.isLive()) return unavailableRoute(mode, 'not_configured')

    const cacheKey = routeCacheKey(from, to, mode)
    const fresh = cacheStore.get(cacheKey)
    if (fresh) return { ...fresh, cached: true }

    if (Date.now() < breaker.until) {
      const stale = cacheStore.getStale(cacheKey)
      if (stale) return { ...stale, dataSource: 'cached', cached: true, stale: true }
      return unavailableRoute(mode, fallbackReasonFor(breaker.errorType))
    }

    const result = await openRouteServiceProvider.getRoute(from, to, mode)
    if (!result.ok) {
      if (BREAKER_MS[result.errorType]) breaker = { until: Date.now() + BREAKER_MS[result.errorType], errorType: result.errorType }
      warn(`${result.errorType}${result.error ? ` — ${result.error}` : ''}`)
      const stale = cacheStore.getStale(cacheKey)
      if (stale) return { ...stale, dataSource: 'cached', cached: true, stale: true }
      return unavailableRoute(mode, fallbackReasonFor(result.errorType))
    }

    const route = normalizeOpenRouteServiceRoute(result.data, { mode })
    if (!route) return unavailableRoute(mode, 'malformed')

    cacheStore.set(cacheKey, { provider: PROVIDER, category: CATEGORY, value: route, ttlSeconds: TTL })
    return { ...route, cached: false }
  },

  /** Test hook: clears the circuit breaker. */
  _resetForTests() {
    breaker = { until: 0, errorType: null }
  },
}
