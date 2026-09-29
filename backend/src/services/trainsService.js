import { railProvider } from '../providers/railProvider.js'
import { normalizeRailRadarTrain, normalizeStation, normalizeSampleTrain, normalizeTrainStatus, normalizeTrainFare, normalizeSeatAvailability } from '../normalizers/trainNormalizer.js'
import { cacheStore } from '../cache/cacheStore.js'
import { CACHE_TTL_SECONDS } from './cacheDurations.js'
import { getDestinationData } from '../data/sampleTravelData.js'
import { env } from '../config/env.js'

// Service layer for trains. Mirrors flightsService's shape/fallback chain —
// RailRadar is the R1-selected, R6-integrated provider (see
// providers/railProvider.js), same circuit-breaker pattern, same
// live/cached/sample/unavailable data-source contract as every other
// category. This is the ONLY module (besides tools/transportTool.js, which
// calls it, and routes/trains.routes.js, which exposes it) that knows
// RailRadar exists — everything else deals in the canonical shape from
// normalizers/trainNormalizer.js.
//
// TRAIN EXISTS != TRAIN IS RUNNING != SEATS AVAILABLE != BOOKING CONFIRMED:
// search results never carry a fare (RailRadar's between-stations search
// doesn't return one — see getFare()); status/fare/seats are only ever
// reported when RailRadar itself returned them for that exact query, never
// inferred from a scheduled time; bookingUrl is always null (RailRadar is a
// data API, not a ticketing API — AtlasAI never claims to have booked a
// train).
//
// Fallback order (search): fresh cache -> provider -> stale cache -> sample.
// Fallback order (status/fare/seats): fresh cache -> provider -> stale
// cache -> unavailable (there is no honest "sample" for live telemetry or
// a specific fare/seat query, so those degrade straight to unavailable,
// same principle mapsService applies to routes).

const PROVIDER = 'railradar'
const CATEGORY = 'trains'
const TTL = CACHE_TTL_SECONDS.trains
const STATION_TTL = CACHE_TTL_SECONDS.stations
const STATUS_TTL = CACHE_TTL_SECONDS.trainStatus
const DETAILS_TTL = CACHE_TTL_SECONDS.trainDetails

const DEFAULT_LIMIT = 10
const MAX_LIMIT = 20

// AtlasAI's own known sample destinations/origins map for free (zero
// provider calls), same spirit as flightsService's KNOWN_AIRPORT_CODES —
// these are real RailRadar/NTES station codes.
const KNOWN_STATION_CODES = {
  delhi: 'NDLS', // New Delhi
  mumbai: 'CSTM', // Chhatrapati Shivaji Maharaj Terminus
  goa: 'MAO', // Madgaon Junction
  jaipur: 'JP', // Jaipur Junction
}

// A bare 2-5 letter uppercase code (e.g. a destination already given as
// "NDLS") is assumed to already be a valid station code — used as-is.
const STATION_CODE_RE = /^[A-Za-z]{2,5}$/

const BREAKER_MS = { auth: 5 * 60 * 1000, rate_limited: 60 * 1000 }
let breaker = { until: 0, errorType: null }

function warn(...args) {
  if (env.nodeEnv !== 'test') console.warn('[atlasai][trains]', ...args)
}

function normalizeQuery(value) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, 100)
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

function stationKey(query) {
  return cacheStore.buildKey('stations', `${PROVIDER}-station`, { q: query.toLowerCase() })
}

function trainsKey({ from, to, date, type, category }) {
  return cacheStore.buildKey(CATEGORY, PROVIDER, { from, to, date: date || '', type: type || '', category: category || '' })
}

function statusKey(trainNumber, date) {
  return cacheStore.buildKey('trainStatus', PROVIDER, { trainNumber, date: date || '' })
}

function detailsKey(kind, trainNumber, { source, destination, journeyDate, classCode, quotaCode }) {
  return cacheStore.buildKey('trainDetails', `${PROVIDER}-${kind}`, { trainNumber, source, destination, journeyDate, classCode, quotaCode: quotaCode || 'GN' })
}

function tripBreaker(errorType) {
  if (BREAKER_MS[errorType]) breaker = { until: Date.now() + BREAKER_MS[errorType], errorType }
}

/**
 * Resolves a free-text city/station name (or an already-valid station code,
 * used as-is) to a RailRadar station code. Shares its cache/breaker/fallback
 * shape with flightsService.resolveAirportCode but its own cache namespace.
 * @returns {Promise<{ ok: true, code, name, fromCache, stale? } | { ok: false, errorType }>}
 */
async function resolveStationCode(query) {
  const key = query.toLowerCase()
  if (KNOWN_STATION_CODES[key]) return { ok: true, code: KNOWN_STATION_CODES[key], name: query, fromCache: true }
  if (STATION_CODE_RE.test(query) && query.toUpperCase() === query) return { ok: true, code: query, name: query, fromCache: true }

  const cacheKey = stationKey(query)
  const fresh = cacheStore.get(cacheKey)
  if (fresh) return { ok: true, code: fresh.code, name: fresh.name, fromCache: true }

  if (Date.now() < breaker.until) {
    const stale = cacheStore.getStale(cacheKey)
    if (stale) return { ok: true, code: stale.code, name: stale.name, fromCache: true, stale: true }
    return { ok: false, errorType: breaker.errorType }
  }

  const result = await railProvider.searchStations(query, { limit: 5 })
  if (!result.ok) {
    tripBreaker(result.errorType)
    const stale = cacheStore.getStale(cacheKey)
    if (stale) return { ok: true, code: stale.code, name: stale.name, fromCache: true, stale: true }
    return { ok: false, errorType: result.errorType }
  }

  const station = normalizeStation(result.data?.[0])
  if (!station) return { ok: false, errorType: 'no_results' }

  cacheStore.set(cacheKey, { provider: PROVIDER, category: 'stations', value: station, ttlSeconds: STATION_TTL })
  return { ok: true, code: station.code, name: station.name, fromCache: false }
}

function sampleTrains(destinationQuery) {
  const data = getDestinationData(destinationQuery)
  return data.transportOptions
    .filter((o) => o.mode === 'train' || o.mode === 'train+cab')
    .map((o) => normalizeSampleTrain({ ...o, dataSource: data.dataSource }))
}

export const trainsService = {
  isLive() {
    return railProvider.isConfigured()
  },

  /**
   * Provider-backed lookup only (no sample fallback). Resolves both
   * endpoints to station codes, then a trains-between-stations search
   * (with live status enrichment when a journeyDate is given), cached.
   * @returns {{ trains, dataSource: 'live'|'cached'|'unavailable', provider, stale?, errorType? }}
   */
  async fetchForRoute(originName, destinationName, journeyDate, { type, category, limit = DEFAULT_LIMIT } = {}) {
    if (!this.isLive()) return { trains: [], dataSource: 'unavailable', provider: null, errorType: 'not_configured' }

    const originQuery = normalizeQuery(originName)
    const destQuery = normalizeQuery(destinationName)
    if (!originQuery || !destQuery) return { trains: [], dataSource: 'unavailable', provider: PROVIDER, errorType: 'not_found' }

    const count = clampLimit(limit)

    const origin = await resolveStationCode(originQuery)
    if (!origin.ok) {
      warn(`origin resolution: ${origin.errorType}`)
      return { trains: [], dataSource: 'unavailable', provider: PROVIDER, errorType: origin.errorType }
    }
    const destination = await resolveStationCode(destQuery)
    if (!destination.ok) {
      warn(`destination resolution: ${destination.errorType}`)
      return { trains: [], dataSource: 'unavailable', provider: PROVIDER, errorType: destination.errorType }
    }

    const routeParams = { from: origin.code, to: destination.code, date: journeyDate, type, category }
    const cacheKey = trainsKey(routeParams)
    const staleTag = origin.stale || destination.stale ? { stale: true } : {}

    const fresh = cacheStore.get(cacheKey)
    if (fresh) return { trains: fresh.slice(0, count), dataSource: 'live', provider: PROVIDER, ...staleTag }

    if (Date.now() < breaker.until) {
      const stale = cacheStore.getStale(cacheKey)
      if (stale) return { trains: stale.slice(0, count), dataSource: 'cached', provider: PROVIDER, stale: true }
      return { trains: [], dataSource: 'unavailable', provider: PROVIDER, errorType: breaker.errorType }
    }

    const result = await railProvider.trainsBetween(origin.code, destination.code, {
      date: journeyDate, type, category, live: journeyDate ? true : undefined,
    })
    if (!result.ok) {
      tripBreaker(result.errorType)
      warn(`${result.errorType}${result.error ? ` — ${result.error}` : ''}`)
      const stale = cacheStore.getStale(cacheKey)
      if (stale) return { trains: stale.slice(0, count), dataSource: 'cached', provider: PROVIDER, stale: true }
      return { trains: [], dataSource: 'unavailable', provider: PROVIDER, errorType: result.errorType }
    }

    const fromStation = { code: origin.code, name: result.data?.from?.name || origin.name }
    const toStation = { code: destination.code, name: result.data?.to?.name || destination.name }
    const trains = (result.data?.trains || []).map((t) => normalizeRailRadarTrain(t, { fromStation, toStation })).filter(Boolean)
    if (!trains.length) return { trains: [], dataSource: 'unavailable', provider: PROVIDER, errorType: 'no_results' }

    cacheStore.set(cacheKey, { provider: PROVIDER, category: CATEGORY, value: trains, ttlSeconds: TTL })
    return { trains: trains.slice(0, count), dataSource: 'live', provider: PROVIDER, ...staleTag }
  },

  /**
   * Full fallback chain used by transportTool and the /api/trains/search
   * route: provider/cache -> sample. Never throws. Unlike flights, a
   * journeyDate is optional (RailRadar's schedule search works without one
   * — live enrichment is simply skipped in that case).
   * @returns {{ trains, dataSource, provider, fallbackReason }}
   */
  async getTrains(originName, destinationName, journeyDate, { type, category, limit = DEFAULT_LIMIT, deadlineMs } = {}) {
    const destQuery = normalizeQuery(destinationName)
    const sample = (fallbackReason) => ({ trains: sampleTrains(destQuery), dataSource: 'sample', provider: 'sample', fallbackReason })

    if (!this.isLive()) return sample('not_configured')

    let live
    try {
      live = await withDeadline(
        this.fetchForRoute(originName, destQuery, journeyDate, { type, category, limit }),
        deadlineMs
      )
    } catch (err) {
      warn(`unexpected failure: ${err?.message}`)
      live = { trains: [], errorType: 'network' }
    }
    if (live.timedOut) live = { trains: [], errorType: 'timeout' }

    if (live.trains?.length) {
      return {
        trains: live.trains,
        dataSource: live.dataSource,
        provider: PROVIDER,
        fallbackReason: null,
        ...(live.stale ? { stale: true } : {}),
      }
    }
    return sample(fallbackReasonFor(live.errorType))
  },

  /**
   * Live running status for a specific already-known train. No sample
   * fallback — telemetry is either real or reported unavailable, never
   * fabricated from a scheduled time.
   * @returns {{ status, dataSource, provider, fallbackReason }}
   */
  async getTrainStatus(trainNumber, { date, deadlineMs } = {}) {
    if (!this.isLive()) return { status: null, dataSource: 'unavailable', provider: null, fallbackReason: 'not_configured' }
    const number = String(trainNumber || '').trim()
    if (!number) return { status: null, dataSource: 'unavailable', provider: PROVIDER, fallbackReason: 'not_found' }

    const cacheKey = statusKey(number, date)
    const fresh = cacheStore.get(cacheKey)
    if (fresh) return { status: fresh, dataSource: 'live', provider: PROVIDER }

    if (Date.now() < breaker.until) {
      const stale = cacheStore.getStale(cacheKey)
      if (stale) return { status: stale, dataSource: 'cached', provider: PROVIDER, stale: true }
      return { status: null, dataSource: 'unavailable', provider: PROVIDER, fallbackReason: fallbackReasonFor(breaker.errorType) }
    }

    let result
    try {
      result = await withDeadline(railProvider.getTrainStatus(number, { date }), deadlineMs)
    } catch {
      result = { ok: false, errorType: 'network' }
    }
    if (result?.timedOut) result = { ok: false, errorType: 'timeout' }
    if (!result.ok) {
      tripBreaker(result.errorType)
      warn(`status: ${result.errorType}${result.error ? ` — ${result.error}` : ''}`)
      const stale = cacheStore.getStale(cacheKey)
      if (stale) return { status: stale, dataSource: 'cached', provider: PROVIDER, stale: true }
      return { status: null, dataSource: 'unavailable', provider: PROVIDER, fallbackReason: fallbackReasonFor(result.errorType) }
    }

    const status = normalizeTrainStatus(result.data)
    if (!status) return { status: null, dataSource: 'unavailable', provider: PROVIDER, fallbackReason: 'no_results' }

    cacheStore.set(cacheKey, { provider: PROVIDER, category: 'trainStatus', value: status, ttlSeconds: STATUS_TTL })
    return { status, dataSource: 'live', provider: PROVIDER }
  },

  /**
   * Itemized fare for a specific train/class/quota. No sample fallback —
   * see getTrainStatus() for why.
   * @returns {{ fare, dataSource, provider, fallbackReason }}
   */
  async getFare(trainNumber, params = {}) {
    if (!this.isLive()) return { fare: null, dataSource: 'unavailable', provider: null, fallbackReason: 'not_configured' }
    const number = String(trainNumber || '').trim()
    if (!number || !params.source || !params.destination || !params.journeyDate || !params.classCode) {
      return { fare: null, dataSource: 'unavailable', provider: PROVIDER, fallbackReason: 'not_found' }
    }

    const cacheKey = detailsKey('fare', number, params)
    const fresh = cacheStore.get(cacheKey)
    if (fresh) return { fare: fresh, dataSource: 'live', provider: PROVIDER }

    if (Date.now() < breaker.until) {
      const stale = cacheStore.getStale(cacheKey)
      if (stale) return { fare: stale, dataSource: 'cached', provider: PROVIDER, stale: true }
      return { fare: null, dataSource: 'unavailable', provider: PROVIDER, fallbackReason: fallbackReasonFor(breaker.errorType) }
    }

    const result = await railProvider.getFare(number, params)
    if (!result.ok) {
      tripBreaker(result.errorType)
      warn(`fare: ${result.errorType}${result.error ? ` — ${result.error}` : ''}`)
      const stale = cacheStore.getStale(cacheKey)
      if (stale) return { fare: stale, dataSource: 'cached', provider: PROVIDER, stale: true }
      return { fare: null, dataSource: 'unavailable', provider: PROVIDER, fallbackReason: fallbackReasonFor(result.errorType) }
    }

    const fare = normalizeTrainFare(result.data)
    if (!fare) return { fare: null, dataSource: 'unavailable', provider: PROVIDER, fallbackReason: 'no_results' }

    cacheStore.set(cacheKey, { provider: PROVIDER, category: 'trainDetails', value: fare, ttlSeconds: DETAILS_TTL })
    return { fare, dataSource: 'live', provider: PROVIDER }
  },

  /**
   * 14-day seat-availability forecast for a specific train/class/quota. No
   * sample fallback — see getTrainStatus() for why.
   * @returns {{ availability, dataSource, provider, fallbackReason }}
   */
  async getSeatAvailability(trainNumber, params = {}) {
    if (!this.isLive()) return { availability: null, dataSource: 'unavailable', provider: null, fallbackReason: 'not_configured' }
    const number = String(trainNumber || '').trim()
    if (!number || !params.source || !params.destination || !params.journeyDate || !params.classCode) {
      return { availability: null, dataSource: 'unavailable', provider: PROVIDER, fallbackReason: 'not_found' }
    }

    const cacheKey = detailsKey('seats', number, params)
    const fresh = cacheStore.get(cacheKey)
    if (fresh) return { availability: fresh, dataSource: 'live', provider: PROVIDER }

    if (Date.now() < breaker.until) {
      const stale = cacheStore.getStale(cacheKey)
      if (stale) return { availability: stale, dataSource: 'cached', provider: PROVIDER, stale: true }
      return { availability: null, dataSource: 'unavailable', provider: PROVIDER, fallbackReason: fallbackReasonFor(breaker.errorType) }
    }

    const result = await railProvider.getSeatAvailability(number, params)
    if (!result.ok) {
      tripBreaker(result.errorType)
      warn(`seats: ${result.errorType}${result.error ? ` — ${result.error}` : ''}`)
      const stale = cacheStore.getStale(cacheKey)
      if (stale) return { availability: stale, dataSource: 'cached', provider: PROVIDER, stale: true }
      return { availability: null, dataSource: 'unavailable', provider: PROVIDER, fallbackReason: fallbackReasonFor(result.errorType) }
    }

    const availability = normalizeSeatAvailability(result.data)
    if (!availability) return { availability: null, dataSource: 'unavailable', provider: PROVIDER, fallbackReason: 'no_results' }

    cacheStore.set(cacheKey, { provider: PROVIDER, category: 'trainDetails', value: availability, ttlSeconds: DETAILS_TTL })
    return { availability, dataSource: 'live', provider: PROVIDER }
  },

  /** Test hook: clears the circuit breaker. */
  _resetForTests() {
    breaker = { until: 0, errorType: null }
  },
}
