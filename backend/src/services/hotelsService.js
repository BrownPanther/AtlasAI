import { amadeusProvider } from '../providers/amadeusProvider.js'
import { atlasTravelProvider } from '../providers/atlasTravelProvider.js'
import { normalizeAmadeusHotel, normalizeAmadeusCity, normalizeSampleHotel, normalizeEstimatedHotel } from '../normalizers/hotelNormalizer.js'
import { cacheStore } from '../cache/cacheStore.js'
import { CACHE_TTL_SECONDS } from './cacheDurations.js'
import { getDestinationData } from '../data/sampleTravelData.js'
import { env } from '../config/env.js'

// Service layer for hotels/accommodation. This is the ONLY module (besides
// tools/hotelTool.js, which calls it) that knows Amadeus exists —
// everything else deals in the canonical hotel shape from
// normalizers/hotelNormalizer.js.
//
// Data-source contract (mirrors attractionsService/mapsService):
//   'live'   — an Amadeus request succeeded while serving this call
//   'cached' — served from AtlasAI's cache of an earlier Amadeus response
//              (including expired entries used because Amadeus was
//              unreachable — see `stale`)
//   'sample' — bundled demo data (data/sampleTravelData.js); never called "live"
//
// Fallback order: fresh cache -> provider -> stale cache -> sample.
// Nothing here throws; failures come back as data with a fallbackReason
// code. Raw provider errors are logged server-side and never returned.
//
// IMPORTANT — this is Amadeus's *test* environment (see amadeusProvider.js):
// a real API call, real schema, but SYNTHETIC hotel/offer data, not live
// bookable inventory. hotelNormalizer.js hard-codes liveAvailability:false
// for exactly this reason — never let a caller present it as bookable.

const PROVIDER = 'amadeus'
const CATEGORY = 'hotels'
const TTL = CACHE_TTL_SECONDS.hotels
const CITY_TTL = CACHE_TTL_SECONDS.cities

const DEFAULT_LIMIT = 10
const MAX_LIMIT = 20

// Amadeus identifies cities by IATA city code, not free text. AtlasAI's own
// known sample destinations are mapped directly (zero provider calls, and
// these are real IATA city codes); anything else is resolved via Amadeus's
// own /reference-data/locations city search (cached — see resolveCityCode).
const KNOWN_CITY_CODES = {
  manali: 'KUU', // Kullu-Manali (Bhuntar) — the closest IATA city code to Manali
  goa: 'GOI',
  jaipur: 'JAI',
}

// Circuit breaker: same pattern as attractionsService/mapsService — after an
// auth or rate-limit rejection, stop calling the provider for a while
// (serving cache/sample instead) rather than hammering an API that has told
// us to stop.
const BREAKER_MS = { auth: 5 * 60 * 1000, rate_limited: 60 * 1000 }
let breaker = { until: 0, errorType: null }

function warn(...args) {
  if (env.nodeEnv !== 'test') console.warn('[atlasai][hotels]', ...args)
}

function normalizeQuery(destination) {
  return String(destination || '').replace(/\s+/g, ' ').trim().slice(0, 100)
}

function clampLimit(limit) {
  const n = Number(limit)
  if (!Number.isFinite(n)) return DEFAULT_LIMIT
  return Math.min(MAX_LIMIT, Math.max(1, Math.floor(n)))
}

function fallbackReasonFor(errorType) {
  switch (errorType) {
    case 'not_configured': return 'not_configured'
    case 'timeout': return 'timeout'
    case 'rate_limited': return 'rate_limited'
    case 'not_found': return 'destination_not_found'
    case 'no_results': return 'no_results'
    default: return 'provider_unavailable' // auth, network, http, malformed — details stay in server logs
  }
}

function withDeadline(promise, ms) {
  if (!ms) return promise
  let timer
  const deadline = new Promise((resolve) => {
    timer = setTimeout(() => resolve({ timedOut: true }), ms)
  })
  return Promise.race([promise, deadline]).finally(() => clearTimeout(timer))
}

function cityKey(query) {
  return cacheStore.buildKey(CATEGORY, `${PROVIDER}-city`, { q: query.toLowerCase() })
}

function hotelsKey(cityCode, limit) {
  return cacheStore.buildKey(CATEGORY, PROVIDER, { cityCode, limit })
}

function tripBreaker(errorType) {
  if (BREAKER_MS[errorType]) breaker = { until: Date.now() + BREAKER_MS[errorType], errorType }
}

/**
 * Resolves a free-text destination name to an Amadeus IATA city code.
 * Known AtlasAI sample destinations are mapped for free; anything else asks
 * Amadeus's own city search, cached for 30 days (a city code never changes).
 * @returns {{ ok: true, code, fromCache, stale? } | { ok: false, errorType }}
 */
async function resolveCityCode(query) {
  const key = query.toLowerCase()
  if (KNOWN_CITY_CODES[key]) return { ok: true, code: KNOWN_CITY_CODES[key], fromCache: true }

  const cacheKey = cityKey(query)
  const fresh = cacheStore.get(cacheKey)
  if (fresh) return { ok: true, code: fresh.iataCode, fromCache: true }

  if (Date.now() < breaker.until) {
    const stale = cacheStore.getStale(cacheKey)
    if (stale) return { ok: true, code: stale.iataCode, fromCache: true, stale: true }
    return { ok: false, errorType: breaker.errorType }
  }

  if (amadeusProvider.isConfigured()) {
    const result = await amadeusProvider.searchCities(query)
    if (!result.ok) {
      tripBreaker(result.errorType)
      const stale = cacheStore.getStale(cacheKey)
      if (stale) return { ok: true, code: stale.iataCode, fromCache: true, stale: true }
      return { ok: false, errorType: result.errorType }
    }

    const city = normalizeAmadeusCity(result.data?.[0])
    if (!city) return { ok: false, errorType: 'no_results' }

    cacheStore.set(cacheKey, { provider: PROVIDER, category: CATEGORY, value: city, ttlSeconds: CITY_TTL })
    return { ok: true, code: city.iataCode, fromCache: false }
  }

  const cityRef = atlasTravelProvider.resolveCity(query)
  if (cityRef) {
    cacheStore.set(cacheKey, { provider: 'atlas', category: CATEGORY, value: cityRef, ttlSeconds: CITY_TTL })
    return { ok: true, code: cityRef.iataCode, fromCache: false }
  }

  return { ok: false, errorType: 'not_configured' }
}

function sampleHotels(query) {
  const data = getDestinationData(query)
  return data.hotels.map(normalizeSampleHotel)
}

export const hotelsService = {
  isLive() {
    return amadeusProvider.isConfigured()
  },

  /**
   * Provider-backed lookup only (no sample fallback). Resolves the
   * destination to a city code, then hotel-search + offers, both cached.
   * Request budget for a cold destination: up to 1 city-search + 1 by-city
   * list + 1 offers call — all cached afterwards.
   * @returns {{ hotels, dataSource: 'live'|'cached'|'unavailable', provider, stale?, errorType? }}
   */
  async fetchForDestination(destinationName, { limit = DEFAULT_LIMIT } = {}) {
    if (!this.isLive()) return { hotels: [], dataSource: 'unavailable', provider: null, errorType: 'not_configured' }

    const query = normalizeQuery(destinationName)
    if (!query) return { hotels: [], dataSource: 'unavailable', provider: PROVIDER, errorType: 'not_found' }
    const count = clampLimit(limit)

    const city = await resolveCityCode(query)
    if (!city.ok) {
      warn(`city resolution: ${city.errorType}`)
      return { hotels: [], dataSource: 'unavailable', provider: PROVIDER, errorType: city.errorType }
    }

    const cacheKey = hotelsKey(city.code, count)
    const fresh = cacheStore.get(cacheKey)
    if (fresh) return { hotels: fresh, dataSource: 'live', provider: PROVIDER, ...(city.stale ? { stale: true } : {}) }

    if (Date.now() < breaker.until) {
      const stale = cacheStore.getStale(cacheKey)
      if (stale) return { hotels: stale, dataSource: 'cached', provider: PROVIDER, stale: true }
      return { hotels: [], dataSource: 'unavailable', provider: PROVIDER, errorType: breaker.errorType }
    }

    const byCity = await amadeusProvider.searchHotelsByCity(city.code)
    if (!byCity.ok) {
      tripBreaker(byCity.errorType)
      warn(`${byCity.errorType}${byCity.error ? ` — ${byCity.error}` : ''}`)
      const stale = cacheStore.getStale(cacheKey)
      if (stale) return { hotels: stale, dataSource: 'cached', provider: PROVIDER, stale: true }
      return { hotels: [], dataSource: 'unavailable', provider: PROVIDER, errorType: byCity.errorType }
    }

    const hotelIds = byCity.data.slice(0, count).map((h) => h.hotelId).filter(Boolean)
    if (!hotelIds.length) return { hotels: [], dataSource: 'unavailable', provider: PROVIDER, errorType: 'no_results' }

    const offers = await amadeusProvider.getHotelOffers(hotelIds)
    if (!offers.ok) {
      tripBreaker(offers.errorType)
      warn(`${offers.errorType}${offers.error ? ` — ${offers.error}` : ''}`)
      const stale = cacheStore.getStale(cacheKey)
      if (stale) return { hotels: stale, dataSource: 'cached', provider: PROVIDER, stale: true }
      return { hotels: [], dataSource: 'unavailable', provider: PROVIDER, errorType: offers.errorType }
    }

    const hotels = offers.data.map((o) => normalizeAmadeusHotel(o)).filter(Boolean)
    if (!hotels.length) return { hotels: [], dataSource: 'unavailable', provider: PROVIDER, errorType: 'malformed' }

    cacheStore.set(cacheKey, { provider: PROVIDER, category: CATEGORY, value: hotels, ttlSeconds: TTL })
    return { hotels, dataSource: 'live', provider: PROVIDER, ...(city.stale ? { stale: true } : {}) }
  },

  /**
   * Full fallback chain used by hotelTool and the /api/hotels/search route:
   * provider/cache -> sample. Never throws.
   * @returns {{ hotels, dataSource, provider, fallbackReason }}
   */
  async getHotels(destinationName, { limit = DEFAULT_LIMIT, deadlineMs } = {}) {
    const query = normalizeQuery(destinationName)
    const sample = (fallbackReason) => ({ hotels: sampleHotels(query), dataSource: 'sample', sourceType: 'demo', provider: 'sample', fallbackReason })

    if (this.isLive()) {
      let live
      try {
        live = await withDeadline(this.fetchForDestination(query, { limit }), deadlineMs)
      } catch (err) {
        warn(`unexpected failure: ${err?.message}`)
        live = { hotels: [], errorType: 'network' }
      }
      if (live.timedOut) live = { hotels: [], errorType: 'timeout' }

      if (live.hotels?.length) {
        return {
          hotels: live.hotels,
          dataSource: live.dataSource,
          sourceType: live.dataSource === 'live' ? 'live' : 'cached',
          provider: PROVIDER,
          fallbackReason: null,
          ...(live.stale ? { stale: true } : {}),
        }
      }
      return sample(fallbackReasonFor(live.errorType))
    }

    if (env.hotelProvider === 'sample') {
      return sample('not_configured')
    }

    // Default: use AtlasTravelProvider reference planning data layer
    try {
      const cityResolved = await resolveCityCode(query)
      const city = cityResolved.ok ? cityResolved.code : query
      const count = clampLimit(limit)
      const cacheKey = hotelsKey(city, count) + ':estimated'
      const cached = cacheStore.get(cacheKey)
      if (cached) {
        return {
          hotels: cached,
          dataSource: 'cached',
          sourceType: 'estimated',
          provider: 'AtlasTravelProvider',
          fallbackReason: null,
        }
      }

      const res = await atlasTravelProvider.searchHotels(query, { limit: count })
      if (res.ok && res.hotels?.length) {
        const hotels = res.hotels.map((h) => normalizeEstimatedHotel(h))
        cacheStore.set(cacheKey, { provider: 'atlas', category: CATEGORY, value: hotels, ttlSeconds: TTL })
        return {
          hotels,
          dataSource: 'estimated',
          sourceType: 'estimated',
          provider: 'AtlasTravelProvider',
          fallbackReason: null,
        }
      }
    } catch (err) {
      warn(`AtlasTravelProvider hotel failure: ${err?.message}`)
    }

    return sample('not_configured')
  },

  /** Test hook: clears the circuit breaker. */
  _resetForTests() {
    breaker = { until: 0, errorType: null }
  },
}
