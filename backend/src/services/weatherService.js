import { openWeatherMapProvider } from '../providers/openWeatherMapProvider.js'
import { normalizeOpenWeatherMapDay, normalizeOpenWeatherMapCurrent } from '../normalizers/weatherNormalizer.js'
import { cacheStore } from '../cache/cacheStore.js'
import { CACHE_TTL_SECONDS } from './cacheDurations.js'
import { env } from '../config/env.js'

// Weather is explicitly optional (Phase 8 rule) — every call site must be
// able to treat { dataSource: 'unavailable' } as "no weather info" and
// keep planning, never as an error to surface to the user. There is no
// "sample" weather: fabricating a forecast/current reading would be worse
// than having none (see normalizers/weatherNormalizer.js).
//
// Fallback order (both calls): fresh cache -> provider -> stale cache ->
// unavailable. Same circuit-breaker pattern as every other provider-backed
// service — after an auth/rate-limit rejection, stop calling
// OpenWeatherMap for a while rather than hammering it.

const PROVIDER = 'openweathermap'
const CATEGORY = 'weather'
const TTL = CACHE_TTL_SECONDS.weather

const BREAKER_MS = { auth: 5 * 60 * 1000, rate_limited: 60 * 1000 }
let breaker = { until: 0, errorType: null }

function warn(...args) {
  if (env.nodeEnv !== 'test') console.warn('[atlasai][weather]', ...args)
}

function normalizeQuery(value) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, 100)
}

function fallbackReasonFor(errorType) {
  switch (errorType) {
    case 'not_configured': return 'not_configured'
    case 'timeout': return 'timeout'
    case 'rate_limited': return 'rate_limited'
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

function tripBreaker(errorType) {
  if (BREAKER_MS[errorType]) breaker = { until: Date.now() + BREAKER_MS[errorType], errorType }
}

function forecastKey(query) {
  return cacheStore.buildKey(CATEGORY, PROVIDER, { q: query.toLowerCase(), type: 'forecast' })
}

function currentKey(query) {
  return cacheStore.buildKey(CATEGORY, PROVIDER, { q: query.toLowerCase(), type: 'current' })
}

export const weatherService = {
  isLive() {
    return openWeatherMapProvider.isConfigured()
  },

  /** @returns {{ days, dataSource: 'live'|'cached'|'unavailable', provider, stale?, fallbackReason? }} */
  async fetchForecast(destinationName, { deadlineMs } = {}) {
    const query = normalizeQuery(destinationName)
    if (!this.isLive() || !query) {
      return { days: [], dataSource: 'unavailable', provider: null, fallbackReason: !query ? 'not_found' : 'not_configured' }
    }

    const cacheKey = forecastKey(query)
    const fresh = cacheStore.get(cacheKey)
    if (fresh) return { days: fresh, dataSource: 'live', provider: PROVIDER }

    if (Date.now() < breaker.until) {
      const stale = cacheStore.getStale(cacheKey)
      if (stale) return { days: stale, dataSource: 'cached', provider: PROVIDER, stale: true }
      return { days: [], dataSource: 'unavailable', provider: PROVIDER, fallbackReason: fallbackReasonFor(breaker.errorType) }
    }

    let result
    try {
      result = await withDeadline(openWeatherMapProvider.getForecast(query), deadlineMs)
    } catch {
      result = { ok: false, errorType: 'network' }
    }
    if (result?.timedOut) result = { ok: false, errorType: 'timeout' }

    if (!result.ok) {
      tripBreaker(result.errorType)
      warn(`forecast: ${result.errorType}${result.error ? ` — ${result.error}` : ''}`)
      const stale = cacheStore.getStale(cacheKey)
      if (stale) return { days: stale, dataSource: 'cached', provider: PROVIDER, stale: true }
      return { days: [], dataSource: 'unavailable', provider: PROVIDER, fallbackReason: fallbackReasonFor(result.errorType) }
    }

    const days = result.data.map((d) => normalizeOpenWeatherMapDay(d, { date: d.date })).filter(Boolean)
    if (!days.length) return { days: [], dataSource: 'unavailable', provider: PROVIDER, fallbackReason: 'no_results' }

    cacheStore.set(cacheKey, { provider: PROVIDER, category: CATEGORY, value: days, ttlSeconds: TTL })
    return { days, dataSource: 'live', provider: PROVIDER }
  },

  /** @returns {{ current, dataSource: 'live'|'cached'|'unavailable', provider, stale?, fallbackReason? }} */
  async fetchCurrent(destinationName, { deadlineMs } = {}) {
    const query = normalizeQuery(destinationName)
    if (!this.isLive() || !query) {
      return { current: null, dataSource: 'unavailable', provider: null, fallbackReason: !query ? 'not_found' : 'not_configured' }
    }

    const cacheKey = currentKey(query)
    const fresh = cacheStore.get(cacheKey)
    if (fresh) return { current: fresh, dataSource: 'live', provider: PROVIDER }

    if (Date.now() < breaker.until) {
      const stale = cacheStore.getStale(cacheKey)
      if (stale) return { current: stale, dataSource: 'cached', provider: PROVIDER, stale: true }
      return { current: null, dataSource: 'unavailable', provider: PROVIDER, fallbackReason: fallbackReasonFor(breaker.errorType) }
    }

    let result
    try {
      result = await withDeadline(openWeatherMapProvider.getCurrentWeather(query), deadlineMs)
    } catch {
      result = { ok: false, errorType: 'network' }
    }
    if (result?.timedOut) result = { ok: false, errorType: 'timeout' }

    if (!result.ok) {
      tripBreaker(result.errorType)
      warn(`current: ${result.errorType}${result.error ? ` — ${result.error}` : ''}`)
      const stale = cacheStore.getStale(cacheKey)
      if (stale) return { current: stale, dataSource: 'cached', provider: PROVIDER, stale: true }
      return { current: null, dataSource: 'unavailable', provider: PROVIDER, fallbackReason: fallbackReasonFor(result.errorType) }
    }

    const current = normalizeOpenWeatherMapCurrent(result.data)
    if (!current) return { current: null, dataSource: 'unavailable', provider: PROVIDER, fallbackReason: 'no_results' }

    cacheStore.set(cacheKey, { provider: PROVIDER, category: CATEGORY, value: current, ttlSeconds: TTL })
    return { current, dataSource: 'live', provider: PROVIDER }
  },

  /** Test hook: clears the circuit breaker. */
  _resetForTests() {
    breaker = { until: 0, errorType: null }
  },
}
