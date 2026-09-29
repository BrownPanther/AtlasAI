import { amadeusProvider } from '../providers/amadeusProvider.js'
import { duffelProvider } from '../providers/duffelProvider.js'
import { atlasTravelProvider } from '../providers/atlasTravelProvider.js'
import { normalizeAmadeusFlight, normalizeDuffelFlight, normalizeSampleTransport, normalizeEstimatedFlight } from '../normalizers/flightNormalizer.js'
import { normalizeAmadeusCity } from '../normalizers/hotelNormalizer.js'
import { cacheStore } from '../cache/cacheStore.js'
import { CACHE_TTL_SECONDS } from './cacheDurations.js'
import { getDestinationData } from '../data/sampleTravelData.js'
import { env } from '../config/env.js'

// Service layer for flights. Mirrors hotelsService's shape/fallback chain —
// same provider (Amadeus, already selected in R1 and wired for hotels in
// R4), same circuit-breaker pattern, same live/cached/sample/unavailable
// data-source contract. This is the ONLY module (besides
// tools/transportTool.js, which calls it, and routes/flights.routes.js,
// which exposes it) that knows Amadeus exists for flights — everything
// else deals in the canonical transport-option shape from
// normalizers/flightNormalizer.js.
//
// IMPORTANT — this is Amadeus's *test* environment (see amadeusProvider.js):
// a real API call, real schema, but SYNTHETIC flight-offer data, not live
// bookable fares/availability/status. Every flight normalized from it
// carries bookingUrl:null and status:null for exactly this reason.
//
// Fallback order: fresh cache -> provider -> stale cache -> sample.
// Nothing here throws; failures come back as data with a fallbackReason
// code. Raw provider errors are logged server-side and never returned.

const PROVIDER = 'amadeus'
const CATEGORY = 'flights'
const TTL = CACHE_TTL_SECONDS.flights
const AIRPORT_TTL = CACHE_TTL_SECONDS.airports

const DEFAULT_LIMIT = 10
const MAX_LIMIT = 10 // matches Amadeus's own practical ceiling for the free test tier
const MAX_ADULTS = 9

// Amadeus identifies airports/cities by IATA code, not free text. AtlasAI's
// own known sample destinations map for free (same three cities
// hotelsService already resolves this way); 'delhi' is added here because
// it's the fixed sample-data origin city for every transport option (see
// data/sampleTravelData.js), and 'mumbai' because two sample destinations
// (Goa, Jaipur... actually Goa/train) reference it as a transport origin.
// Anything else is resolved via Amadeus's own city search (cached — see
// resolveAirportCode), exactly like hotelsService.resolveCityCode.
const KNOWN_AIRPORT_CODES = {
  delhi: 'DEL',
  manali: 'KUU', // Kullu-Manali (Bhuntar) — the closest IATA code to Manali
  goa: 'GOI',
  jaipur: 'JAI',
  mumbai: 'BOM',
}

// A bare 3-letter code (e.g. a destination already given as "GOI") is
// assumed to already be a valid IATA location code — used as-is, with zero
// provider calls, same free-resolution spirit as the known-city map above.
const IATA_CODE_RE = /^[A-Za-z]{3}$/

// Circuit breaker: identical pattern to attractionsService/mapsService/
// hotelsService — after an auth or rate-limit rejection, stop calling the
// provider for a while (serving cache/sample instead).
const BREAKER_MS = { auth: 5 * 60 * 1000, rate_limited: 60 * 1000 }
let breaker = { until: 0, errorType: null }

function warn(...args) {
  if (env.nodeEnv !== 'test') console.warn('[atlasai][flights]', ...args)
}

function normalizeQuery(value) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, 100)
}

function clampLimit(limit) {
  const n = Number(limit)
  if (!Number.isFinite(n)) return DEFAULT_LIMIT
  return Math.min(MAX_LIMIT, Math.max(1, Math.floor(n)))
}

function clampAdults(adults) {
  const n = Number(adults)
  if (!Number.isFinite(n) || n < 1) return 1
  return Math.min(MAX_ADULTS, Math.floor(n))
}

// Amadeus's test environment rejects a past departureDate outright; this
// check just avoids burning a provider call (and a confusing error) on a
// request that can never succeed, honestly reported as 'invalid_date'.
function isValidFutureDate(dateStr) {
  if (typeof dateStr !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false
  const d = new Date(`${dateStr}T00:00:00Z`)
  if (Number.isNaN(d.getTime())) return false
  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)
  return d.getTime() >= today.getTime()
}

function fallbackReasonFor(errorType) {
  switch (errorType) {
    case 'not_configured': return 'not_configured'
    case 'timeout': return 'timeout'
    case 'rate_limited': return 'rate_limited'
    case 'not_found': return 'destination_not_found'
    case 'invalid_date': return 'invalid_date'
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

function airportKey(query) {
  return cacheStore.buildKey('airports', `${PROVIDER}-city`, { q: query.toLowerCase() })
}

function flightsKey({ origin, destination, departureDate, returnDate, adults, travelClass, nonStop }) {
  return cacheStore.buildKey(CATEGORY, PROVIDER, {
    origin, destination, departureDate,
    returnDate: returnDate || '', adults,
    travelClass: travelClass || '', nonStop: nonStop == null ? '' : String(Boolean(nonStop)),
  })
}

function tripBreaker(errorType) {
  if (BREAKER_MS[errorType]) breaker = { until: Date.now() + BREAKER_MS[errorType], errorType }
}

/**
 * Resolves a free-text city/destination name (or an already-valid 3-letter
 * IATA code, used as-is) to an Amadeus IATA location code for flight
 * search. Shares its cache/breaker/fallback shape with hotelsService's
 * resolveCityCode but is kept as its own function/cache namespace
 * ('airports') so the two categories' location caches never collide.
 * @returns {Promise<{ ok: true, code, fromCache, stale? } | { ok: false, errorType }>}
 */
async function resolveAirportCode(query) {
  const key = query.toLowerCase()
  if (KNOWN_AIRPORT_CODES[key]) return { ok: true, code: KNOWN_AIRPORT_CODES[key], fromCache: true }
  if (IATA_CODE_RE.test(query)) return { ok: true, code: query.toUpperCase(), fromCache: true }

  const cacheKey = airportKey(query)
  const fresh = cacheStore.get(cacheKey)
  if (fresh) return { ok: true, code: fresh.iataCode, fromCache: true }

  if (Date.now() < breaker.until) {
    const stale = cacheStore.getStale(cacheKey)
    if (stale) return { ok: true, code: stale.iataCode, fromCache: true, stale: true }
    return { ok: false, errorType: breaker.errorType }
  }

  if (duffelProvider.isConfigured()) {
    const result = await duffelProvider.searchPlaces(query)
    if (result.ok && result.data?.length) {
      const match = result.data.find((p) => p.iata_code || p.city?.iata_code)
      const code = match?.iata_code || match?.city?.iata_code
      if (code) {
        cacheStore.set(cacheKey, { provider: 'duffel', category: 'airports', value: { iataCode: code, name: match.name }, ttlSeconds: AIRPORT_TTL })
        return { ok: true, code, fromCache: false }
      }
    }
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

    cacheStore.set(cacheKey, { provider: 'amadeus', category: 'airports', value: city, ttlSeconds: AIRPORT_TTL })
    return { ok: true, code: city.iataCode, fromCache: false }
  }

  const apt = atlasTravelProvider.resolveAirport(query)
  if (apt) {
    cacheStore.set(cacheKey, { provider: 'atlas', category: 'airports', value: { iataCode: apt.code, name: apt.name }, ttlSeconds: AIRPORT_TTL })
    return { ok: true, code: apt.code, fromCache: false }
  }

  return { ok: false, errorType: 'not_configured' }
}

function sampleFlights(destinationQuery) {
  const data = getDestinationData(destinationQuery)
  return data.transportOptions
    .filter((o) => o.mode === 'flight')
    .map((o) => normalizeSampleTransport({ ...o, dataSource: data.dataSource }))
}

export const flightsService = {
  isLive() {
    return duffelProvider.isConfigured() || amadeusProvider.isConfigured()
  },

  /**
   * Provider-backed lookup only (no sample fallback). Resolves both
   * endpoints to IATA codes, then a flight-offers search, cached.
   * Prioritizes Duffel (live bookable flights), falling back to Amadeus.
   * @returns {{ flights, dataSource: 'live'|'cached'|'unavailable', provider, stale?, errorType? }}
   */
  async fetchForRoute(originName, destinationName, departureDate, { returnDate, adults = 1, travelClass, nonStop, limit = DEFAULT_LIMIT } = {}) {
    if (!this.isLive()) return { flights: [], dataSource: 'unavailable', provider: null, errorType: 'not_configured' }

    const originQuery = normalizeQuery(originName)
    const destQuery = normalizeQuery(destinationName)
    if (!originQuery || !destQuery) return { flights: [], dataSource: 'unavailable', provider: PROVIDER, errorType: 'not_found' }
    if (!isValidFutureDate(departureDate)) return { flights: [], dataSource: 'unavailable', provider: PROVIDER, errorType: 'invalid_date' }
    if (returnDate && (!isValidFutureDate(returnDate) || returnDate < departureDate)) {
      return { flights: [], dataSource: 'unavailable', provider: PROVIDER, errorType: 'invalid_date' }
    }

    const count = clampLimit(limit)
    const adultCount = clampAdults(adults)

    const origin = await resolveAirportCode(originQuery)
    if (!origin.ok) {
      warn(`origin resolution: ${origin.errorType}`)
      return { flights: [], dataSource: 'unavailable', provider: PROVIDER, errorType: origin.errorType }
    }
    const destination = await resolveAirportCode(destQuery)
    if (!destination.ok) {
      warn(`destination resolution: ${destination.errorType}`)
      return { flights: [], dataSource: 'unavailable', provider: PROVIDER, errorType: destination.errorType }
    }

    const currentProvider = duffelProvider.isConfigured() ? 'duffel' : 'amadeus'
    const routeParams = { origin: origin.code, destination: destination.code, departureDate, returnDate, adults: adultCount, travelClass, nonStop }
    const cacheKey = flightsKey(routeParams)
    const staleTag = origin.stale || destination.stale ? { stale: true } : {}

    const fresh = cacheStore.get(cacheKey)
    if (fresh) return { flights: fresh.slice(0, count), dataSource: 'live', provider: currentProvider, ...staleTag }

    if (Date.now() < breaker.until) {
      const stale = cacheStore.getStale(cacheKey)
      if (stale) return { flights: stale.slice(0, count), dataSource: 'cached', provider: currentProvider, stale: true }
      return { flights: [], dataSource: 'unavailable', provider: currentProvider, errorType: breaker.errorType }
    }

    if (currentProvider === 'duffel') {
      const result = await duffelProvider.searchFlights({ ...routeParams, limit: count })
      if (!result.ok) {
        tripBreaker(result.errorType)
        warn(`duffel: ${result.errorType}${result.error ? ` — ${result.error}` : ''}`)
        const stale = cacheStore.getStale(cacheKey)
        if (stale) return { flights: stale.slice(0, count), dataSource: 'cached', provider: 'duffel', stale: true }
        return { flights: [], dataSource: 'unavailable', provider: 'duffel', errorType: result.errorType }
      }

      const offers = result.data?.offers || []
      const flights = offers.map((f) => normalizeDuffelFlight(f)).filter(Boolean)
      if (!flights.length) return { flights: [], dataSource: 'unavailable', provider: 'duffel', errorType: 'no_results' }

      cacheStore.set(cacheKey, { provider: 'duffel', category: CATEGORY, value: flights, ttlSeconds: TTL })
      return { flights: flights.slice(0, count), dataSource: 'live', provider: 'duffel', ...staleTag }
    } else {
      const result = await amadeusProvider.searchFlights({ ...routeParams, max: count })
      if (!result.ok) {
        tripBreaker(result.errorType)
        warn(`amadeus: ${result.errorType}${result.error ? ` — ${result.error}` : ''}`)
        const stale = cacheStore.getStale(cacheKey)
        if (stale) return { flights: stale.slice(0, count), dataSource: 'cached', provider: 'amadeus', stale: true }
        return { flights: [], dataSource: 'unavailable', provider: 'amadeus', errorType: result.errorType }
      }

      const flights = result.data.map((f) => normalizeAmadeusFlight(f)).filter(Boolean)
      if (!flights.length) return { flights: [], dataSource: 'unavailable', provider: 'amadeus', errorType: 'no_results' }

      cacheStore.set(cacheKey, { provider: 'amadeus', category: CATEGORY, value: flights, ttlSeconds: TTL })
      return { flights: flights.slice(0, count), dataSource: 'live', provider: 'amadeus', ...staleTag }
    }
  },

  /**
   * Full fallback chain used by transportTool and the /api/flights/search
   * route: live provider/cache -> AtlasTravelProvider (planning estimate) -> sample. Never throws.
   * @returns {{ flights, dataSource, sourceType, provider, fallbackReason }}
   */
  async getFlights(originName, destinationName, departureDate, { returnDate, adults = 1, travelClass, nonStop, limit = DEFAULT_LIMIT, deadlineMs } = {}) {
    const destQuery = normalizeQuery(destinationName)
    const sample = (fallbackReason) => ({ flights: sampleFlights(destQuery), dataSource: 'sample', sourceType: 'demo', provider: 'sample', fallbackReason })

    if (!isValidFutureDate(departureDate)) return sample('invalid_date')

    if (this.isLive()) {
      let live
      try {
        live = await withDeadline(
          this.fetchForRoute(originName, destQuery, departureDate, { returnDate, adults, travelClass, nonStop, limit }),
          deadlineMs
        )
      } catch (err) {
        warn(`unexpected failure: ${err?.message}`)
        live = { flights: [], errorType: 'network' }
      }
      if (live.timedOut) live = { flights: [], errorType: 'timeout' }

      if (live.flights?.length) {
        return {
          flights: live.flights,
          dataSource: live.dataSource,
          sourceType: live.dataSource === 'live' ? 'live' : 'cached',
          provider: live.provider || PROVIDER,
          fallbackReason: null,
          ...(live.stale ? { stale: true } : {}),
        }
      }
      return sample(fallbackReasonFor(live.errorType))
    }

    // If explicitly configured to use legacy static sample data:
    if (env.flightProvider === 'sample') {
      return sample('not_configured')
    }

    // Default: use AtlasTravelProvider reference planning data layer
    try {
      const origResolved = await resolveAirportCode(originName)
      const destResolved = await resolveAirportCode(destQuery)
      const origCode = origResolved.ok ? origResolved.code : originName
      const destCode = destResolved.ok ? destResolved.code : destQuery

      const cacheKey = flightsKey({
        origin: origCode,
        destination: destCode,
        departureDate,
        returnDate,
        adults,
        travelClass,
        nonStop,
      }) + ':estimated'

      const cached = cacheStore.get(cacheKey)
      if (cached) {
        return {
          flights: cached.slice(0, clampLimit(limit)),
          dataSource: 'cached',
          sourceType: 'estimated',
          provider: 'AtlasTravelProvider',
          fallbackReason: null,
        }
      }

      const res = await atlasTravelProvider.searchFlights({
        origin: origCode,
        destination: destCode,
        departureDate,
        returnDate,
        adults,
        travelClass,
        limit: clampLimit(limit),
      })

      if (res.ok && res.flights?.length) {
        const flights = res.flights.map((f) => normalizeEstimatedFlight(f))
        cacheStore.set(cacheKey, { provider: 'atlas', category: CATEGORY, value: flights, ttlSeconds: TTL })
        return {
          flights,
          dataSource: 'estimated',
          sourceType: 'estimated',
          provider: 'AtlasTravelProvider',
          fallbackReason: null,
        }
      }
    } catch (err) {
      warn(`AtlasTravelProvider failure: ${err?.message}`)
    }

    return sample('not_configured')
  },

  /** Test hook: clears the circuit breaker. */
  _resetForTests() {
    breaker = { until: 0, errorType: null }
  },
}
