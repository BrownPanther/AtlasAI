import { openTripMapProvider } from '../providers/openTripMapProvider.js'
import {
  normalizeOpenTripMapAttraction,
  normalizeOpenTripMapListItem,
  normalizeOpenTripMapDestination,
  normalizeSampleAttraction,
  parseOpenTripMapRate,
} from '../normalizers/attractionNormalizer.js'
import { cacheStore } from '../cache/cacheStore.js'
import { googlePlacesProvider } from '../providers/googlePlacesProvider.js'
import { CACHE_TTL_SECONDS } from './cacheDurations.js'
import { getDestinationData, DESTINATIONS } from '../data/sampleTravelData.js'
import { env } from '../config/env.js'

// Service layer for attractions/places and destination lookup. This is the
// ONLY module (besides tools/attractionTool.js, which calls it) that knows
// OpenTripMap exists — everything else deals in the canonical attraction
// shape from normalizers/attractionNormalizer.js.
//
// Data-source contract (what every caller can rely on):
//   'live'   — at least one OpenTripMap request succeeded while serving this call
//   'cached' — served entirely from AtlasAI's SQLite cache of earlier provider
//              responses (including expired entries used because the provider
//              was unreachable — see `stale`)
//   'sample' — bundled demo data (data/sampleTravelData.js); never called "live"
//   'none'   — nothing available (unknown destination, no provider data, no sample)
//
// Fallback order: fresh cache -> provider -> stale cache -> sample -> empty.
// Nothing here throws; failures come back as data with a user-safe
// `fallbackReason` code. Raw provider errors are logged server-side (with
// credentials redacted) and never returned.

// ─── Destination disambiguation ──────────────────────────────────────────────
// OpenTripMap's /geoname resolves short ambiguous names to unpredictable places
// ("Manali" → a neighbourhood in Chennai, Tamil Nadu). Worse, sending a
// fully-qualified name like "Manali, Himachal Pradesh" often resolves to the
// state capital (Shimla).
//
// For well-known AtlasAI destinations, we completely bypass OpenTripMap's
// unreliable /geoname endpoint and supply the correct canonical coordinates
// directly.
const DESTINATION_OVERRIDES = {
  'manali':     { name: 'Manali', country: 'IN', lat: 32.2396, lon: 77.1887, timezone: 'Asia/Kolkata', population: 8096 },
  'bhopal':     { name: 'Bhopal', country: 'IN', lat: 23.2599, lon: 77.4126, timezone: 'Asia/Kolkata', population: 1798218 },
  'jaipur':     { name: 'Jaipur', country: 'IN', lat: 26.9124, lon: 75.7873, timezone: 'Asia/Kolkata', population: 3046163 },
  'goa':        { name: 'Goa', country: 'IN', lat: 15.2993, lon: 74.1240, timezone: 'Asia/Kolkata', population: 1458545 },
  'delhi':      { name: 'New Delhi', country: 'IN', lat: 28.6139, lon: 77.2090, timezone: 'Asia/Kolkata', population: 21753486 },
  'new delhi':  { name: 'New Delhi', country: 'IN', lat: 28.6139, lon: 77.2090, timezone: 'Asia/Kolkata', population: 21753486 },
  'mumbai':     { name: 'Mumbai', country: 'IN', lat: 19.0760, lon: 72.8777, timezone: 'Asia/Kolkata', population: 12442373 },
  'bombay':     { name: 'Mumbai', country: 'IN', lat: 19.0760, lon: 72.8777, timezone: 'Asia/Kolkata', population: 12442373 },
  'kerala':     { name: 'Thiruvananthapuram', country: 'IN', lat: 8.5241, lon: 76.9366, timezone: 'Asia/Kolkata', population: 957730 },
  'kolkata':    { name: 'Kolkata', country: 'IN', lat: 22.5726, lon: 88.3639, timezone: 'Asia/Kolkata', population: 4496694 },
  'calcutta':   { name: 'Kolkata', country: 'IN', lat: 22.5726, lon: 88.3639, timezone: 'Asia/Kolkata', population: 4496694 },
  'varanasi':   { name: 'Varanasi', country: 'IN', lat: 25.3176, lon: 82.9739, timezone: 'Asia/Kolkata', population: 1201815 },
  'udaipur':    { name: 'Udaipur', country: 'IN', lat: 24.5854, lon: 73.7125, timezone: 'Asia/Kolkata', population: 451100 },
  'shimla':     { name: 'Shimla', country: 'IN', lat: 31.1048, lon: 77.1734, timezone: 'Asia/Kolkata', population: 169578 },
  'ladakh':     { name: 'Leh', country: 'IN', lat: 34.1526, lon: 77.5771, timezone: 'Asia/Kolkata', population: 30870 },
  'leh':        { name: 'Leh', country: 'IN', lat: 34.1526, lon: 77.5771, timezone: 'Asia/Kolkata', population: 30870 },
  'rishikesh':  { name: 'Rishikesh', country: 'IN', lat: 30.0869, lon: 78.2676, timezone: 'Asia/Kolkata', population: 102138 },
  'amritsar':   { name: 'Amritsar', country: 'IN', lat: 31.6340, lon: 74.8723, timezone: 'Asia/Kolkata', population: 1132383 },
  'jodhpur':    { name: 'Jodhpur', country: 'IN', lat: 26.2389, lon: 73.0243, timezone: 'Asia/Kolkata', population: 1033918 },
  'mysore':     { name: 'Mysuru', country: 'IN', lat: 12.2958, lon: 76.6394, timezone: 'Asia/Kolkata', population: 920550 },
  'mysuru':     { name: 'Mysuru', country: 'IN', lat: 12.2958, lon: 76.6394, timezone: 'Asia/Kolkata', population: 920550 },
  'bengaluru':  { name: 'Bengaluru', country: 'IN', lat: 12.9716, lon: 77.5946, timezone: 'Asia/Kolkata', population: 8443675 },
  'bangalore':  { name: 'Bengaluru', country: 'IN', lat: 12.9716, lon: 77.5946, timezone: 'Asia/Kolkata', population: 8443675 },
  'agra':       { name: 'Agra', country: 'IN', lat: 27.1767, lon: 78.0081, timezone: 'Asia/Kolkata', population: 1585704 },
}

/**
 * Returns the hardcoded destination details if the name is known.
 */
export function getDestinationOverride(name) {
  if (!name) return null
  const raw = name.toLowerCase().trim()
  if (DESTINATION_OVERRIDES[raw]) return DESTINATION_OVERRIDES[raw]
  const firstPart = raw.split(',')[0].trim()
  return DESTINATION_OVERRIDES[firstPart] || null
}
// ─────────────────────────────────────────────────────────────────────────────

const PROVIDER = 'opentripmap'
const CATEGORY = 'attractions'
const TTL = CACHE_TTL_SECONDS.attractions

const DEFAULT_LIMIT = 9
const MAX_LIMIT = 30
const RADIUS_LIST_SIZE = 50
const SEARCH_RADIUS_METERS = 15000
const DETAIL_CONCURRENCY = 4
const DEFAULT_KINDS = 'interesting_places'

// Circuit breaker: after an auth or rate-limit rejection, stop calling the
// provider for a while (serving cache/sample instead) rather than hammering
// an API that has told us to stop.
const BREAKER_MS = { auth: 5 * 60 * 1000, rate_limited: 60 * 1000 }
let breaker = { until: 0, errorType: null }

const inflight = new Map()

// AtlasAI interest keywords -> OpenTripMap "kinds" (only these values are ever
// forwarded to the provider; free text never reaches the request).
const INTEREST_TO_KINDS = {
  nature: 'natural',
  culture: 'cultural,religion',
  history: 'historic',
  adventure: 'sport,amusements',
  food: 'foods',
  shopping: 'shops',
  nightlife: 'amusements',
  leisure: 'amusements',
}

function warn(...args) {
  if (env.nodeEnv !== 'test') console.warn('[atlasai][attractions]', ...args)
}

function normalizeQuery(destination) {
  return String(destination || '').replace(/\s+/g, ' ').trim().slice(0, 100)
}

function clampLimit(limit) {
  const n = Number(limit)
  if (!Number.isFinite(n)) return DEFAULT_LIMIT
  return Math.min(MAX_LIMIT, Math.max(1, Math.floor(n)))
}

export function interestsToKinds(interests = []) {
  const kinds = new Set()
  for (const raw of interests) {
    const mapped = INTEREST_TO_KINDS[String(raw).trim().toLowerCase()]
    if (mapped) mapped.split(',').forEach((k) => kinds.add(k))
  }
  return kinds.size ? [...kinds].sort().join(',') : DEFAULT_KINDS
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

async function mapWithConcurrency(items, limit, fn) {
  const results = Array.from({ length: items.length })
  let next = 0
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++
      results[i] = await fn(items[i], i)
    }
  })
  await Promise.all(workers)
  return results
}

/**
 * Cache-through helper used by every provider layer (geocode, radius list,
 * place detail), so each distinct upstream request is made at most once per
 * TTL and concurrent identical requests share one in-flight call.
 *
 * Resolves to { ok:true, value, fromCache, stale } or { ok:false, errorType, error }.
 * `fetcher` must resolve to { ok, data, error, errorType }.
 */
async function cachedLayer(cacheKey, fetcher, toValue) {
  const fresh = cacheStore.get(cacheKey)
  if (fresh) return { ok: true, value: fresh, fromCache: true, stale: false }

  if (inflight.has(cacheKey)) return inflight.get(cacheKey)

  const run = (async () => {
    if (Date.now() < breaker.until) {
      const stale = cacheStore.getStale(cacheKey)
      return stale ? { ok: true, value: stale, fromCache: true, stale: true } : { ok: false, errorType: breaker.errorType, error: 'provider temporarily paused' }
    }
    const result = await fetcher()
    if (result.ok) {
      const value = toValue(result.data)
      if (value === null || value === undefined) return { ok: false, errorType: 'malformed', error: 'Unusable provider response' }
      cacheStore.set(cacheKey, { provider: PROVIDER, category: CATEGORY, value, ttlSeconds: TTL })
      return { ok: true, value, fromCache: false, stale: false }
    }
    if (BREAKER_MS[result.errorType]) breaker = { until: Date.now() + BREAKER_MS[result.errorType], errorType: result.errorType }
    const stale = cacheStore.getStale(cacheKey)
    if (stale) return { ok: true, value: stale, fromCache: true, stale: true }
    return { ok: false, errorType: result.errorType, error: result.error }
  })().finally(() => inflight.delete(cacheKey))

  inflight.set(cacheKey, run)
  return run
}

function destinationKey(name) {
  return cacheStore.buildKey(CATEGORY, `${PROVIDER}-geo`, { name: name.toLowerCase() })
}

function listKey({ lat, lon, kinds }) {
  return cacheStore.buildKey(CATEGORY, `${PROVIDER}-list`, { lat, lon, kinds, radius: SEARCH_RADIUS_METERS })
}

function detailKey(xid) {
  return cacheStore.buildKey(CATEGORY, `${PROVIDER}-detail`, { xid })
}

async function resolveDestinationLayer(name) {
  const override = getDestinationOverride(name)
  if (override) {
    // Return a mocked success response in the exact shape cachedLayer produces
    return { ok: true, value: { name: override.name, country: override.country, coordinates: { lat: override.lat, lng: override.lon } }, fromCache: false, stale: false }
  }

  return cachedLayer(
    destinationKey(name),
    () => openTripMapProvider.geocode(name),
    (geo) => normalizeOpenTripMapDestination(geo)
  )
}

// Keeps only the list fields we use, so cached lists stay small.
function slimListItem(item) {
  return { xid: item.xid, name: item.name, kinds: item.kinds, rate: item.rate, dist: item.dist, point: item.point, wikidata: item.wikidata }
}

function rankPlaces(items) {
  const seen = new Set()
  return items
    .filter((p) => p && p.xid && typeof p.name === 'string' && p.name.trim())
    .filter((p) => {
      const key = p.name.trim().toLowerCase()
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .sort((a, b) => (parseOpenTripMapRate(b.rate) || 0) - (parseOpenTripMapRate(a.rate) || 0) || (a.dist || 0) - (b.dist || 0))
}

function samplePlaces(query, { allowGenerated }) {
  const data = getDestinationData(query)
  if (!data.known && !allowGenerated) return { attractions: [], dataSource: 'none', provider: null, region: null }
  return {
    attractions: data.attractions.map(normalizeSampleAttraction),
    dataSource: 'sample',
    provider: 'sample',
    region: data.region,
  }
}

export const attractionsService = {
  isLive() {
    return openTripMapProvider.isConfigured()
  },

  /**
   * Provider-backed lookup only (no sample fallback). Returns up to `limit`
   * normalized real attractions for a destination name.
   *
   * Request budget for a cold destination: 1 geoname + 1 radius list + up to
   * `limit` detail calls (max DETAIL_CONCURRENCY in flight). Every layer is
   * cached, so repeat calls — including calls with a different `limit` — cost
   * zero provider requests until the TTL expires.
   *
   * @returns {{ attractions, destination, dataSource: 'live'|'cached'|'unavailable',
   *             provider, stale?, errorType? }}
   */
  async fetchForDestination(destinationName, { limit = DEFAULT_LIMIT, kinds = DEFAULT_KINDS } = {}) {
    if (!this.isLive()) return { attractions: [], destination: null, dataSource: 'unavailable', provider: null, errorType: 'not_configured' }

    const query = normalizeQuery(destinationName)
    if (!query) return { attractions: [], destination: null, dataSource: 'unavailable', provider: PROVIDER, errorType: 'not_found' }
    const count = clampLimit(limit)
    let providerCalls = 0
    let usedStale = false
    const track = (r) => {
      if (r.ok && !r.fromCache) providerCalls++
      if (r.ok && r.stale) usedStale = true
      return r
    }
    const unavailable = (r) => {
      warn(`${r.errorType}${r.error ? ` — ${r.error}` : ''}`)
      return { attractions: [], destination: null, dataSource: 'unavailable', provider: PROVIDER, errorType: r.errorType }
    }

    const geo = track(await resolveDestinationLayer(query))
    if (!geo.ok) return unavailable(geo)
    const destination = geo.value
    const { lat, lng: lon } = destination.coordinates

    const list = track(await cachedLayer(
      listKey({ lat, lon, kinds }),
      () => openTripMapProvider.searchNearby({ lat, lon, radiusMeters: SEARCH_RADIUS_METERS, limit: RADIUS_LIST_SIZE, kinds }),
      (items) => items.map(slimListItem)
    ))
    if (!list.ok) return unavailable(list)

    const ranked = rankPlaces(list.value).slice(0, count)
    if (!ranked.length) {
      return { attractions: [], destination, dataSource: 'unavailable', provider: PROVIDER, errorType: 'no_results' }
    }

    let detailFailures = 0
    const places = await mapWithConcurrency(ranked, DETAIL_CONCURRENCY, async (place) => {
      const detail = track(await cachedLayer(
        detailKey(place.xid),
        () => openTripMapProvider.getDetails(place.xid),
        (raw) => normalizeOpenTripMapAttraction(raw, { listItem: place })
      ))
      let p = detail.ok ? detail.value : normalizeOpenTripMapListItem(place)
      if (!detail.ok) detailFailures++

      // Fallback: If OpenTripMap lacks an image, or returns a Wikimedia Commons thumbnail 
      // (which are frequently broken with 400 Bad Request due to CDN encoding bugs),
      // ask Google Places for a high-quality, modern photo instead (cached heavily).
      const hasBadImage = p.images?.length > 0 && p.images[0].includes('upload.wikimedia.org');
      
      if (!p.images || p.images.length === 0 || hasBadImage) {
        const photoKey = cacheStore.buildKey(CATEGORY, 'google-places-photo', { xid: p.id })
        const cachedPhoto = cacheStore.get(photoKey)
        if (cachedPhoto) {
          if (cachedPhoto.url) p.images = [cachedPhoto.url]
          else p.images = []
        } else if (googlePlacesProvider.isConfigured()) {
          const url = await googlePlacesProvider.getPhotoForAttraction(p.name, query)
          cacheStore.set(photoKey, { provider: 'googleplaces', category: CATEGORY, value: { url }, ttlSeconds: CACHE_TTL_SECONDS.attractions })
          if (url) p.images = [url]
          else p.images = []
        }
      }

      return p
    })
    if (detailFailures) warn(`${detailFailures}/${ranked.length} place-detail requests failed; used list data for those`)

    const dataSource = providerCalls > 0 ? 'live' : 'cached'
    const attractions = places
      .filter(Boolean)
      .map((a) => ({ ...a, dataSource, cached: dataSource === 'cached' }))
    if (!attractions.length) return { attractions: [], destination, dataSource: 'unavailable', provider: PROVIDER, errorType: 'malformed' }

    return {
      attractions,
      destination: { ...destination, dataSource, cached: dataSource === 'cached' },
      dataSource,
      provider: PROVIDER,
      ...(usedStale ? { stale: true } : {}),
    }
  },

  /**
   * Full fallback chain used by routes and attractionTool:
   * provider/cache -> sample -> empty. Never throws.
   *
   * @param {object} opts
   * @param {string[]} [opts.interests]   AtlasAI interest keywords (mapped to a provider kinds whitelist)
   * @param {number}   [opts.limit]
   * @param {number}   [opts.deadlineMs]  give up on the provider after this long (it keeps running and warms the cache)
   * @param {boolean}  [opts.allowGeneratedSample] agents want *something* for any destination (existing behaviour);
   *                   the browse endpoint sets false so unknown destinations show an honest empty state
   * @returns {{ attractions, destination, dataSource, provider, fallbackReason, stale?, region? }}
   */
  async getAttractions(destinationName, { interests = [], limit = DEFAULT_LIMIT, deadlineMs, allowGeneratedSample = true } = {}) {
    const query = normalizeQuery(destinationName)
    const sample = (fallbackReason) => ({ destination: null, ...samplePlaces(query, { allowGenerated: allowGeneratedSample }), fallbackReason })

    if (!this.isLive()) return sample('not_configured')

    let live
    try {
      live = await withDeadline(this.fetchForDestination(query, { limit, kinds: interestsToKinds(interests) }), deadlineMs)
    } catch (err) {
      warn(`unexpected failure: ${err?.message}`)
      live = { attractions: [], errorType: 'network' }
    }
    if (live.timedOut) live = { attractions: [], errorType: 'timeout' }

    if (live.attractions?.length) {
      return {
        attractions: live.attractions,
        destination: live.destination,
        dataSource: live.dataSource,
        provider: PROVIDER,
        fallbackReason: null,
        ...(live.stale ? { stale: true } : {}),
      }
    }
    return { ...sample(fallbackReasonFor(live.errorType)), destination: live.destination || null }
  },

  /**
   * Destination discovery. OpenTripMap's geoname endpoint resolves one best
   * match per name, so `results` holds at most one entry.
   * @returns {{ results: object[], dataSource, provider, fallbackReason }}
   */
  async searchDestination(queryRaw, { deadlineMs } = {}) {
    const query = normalizeQuery(queryRaw)
    const sampleResults = () => {
      const data = getDestinationData(query)
      if (!data.known) return []
      const key = query.toLowerCase()
      return DESTINATIONS[key]
        ? [{ name: key.replace(/\b\w/g, (c) => c.toUpperCase()), country: null, region: data.region, timezone: null, population: null, coordinates: null, dataSource: 'sample', provider: 'sample', cached: false }]
        : []
    }
    const fromSample = (fallbackReason) => {
      const results = sampleResults()
      return { results, dataSource: results.length ? 'sample' : 'none', provider: results.length ? 'sample' : null, fallbackReason }
    }

    if (!query) return { results: [], dataSource: 'none', provider: null, fallbackReason: 'no_results' }
    if (!this.isLive()) return fromSample('not_configured')

    let geo
    try {
      geo = await withDeadline(resolveDestinationLayer(query), deadlineMs)
    } catch (err) {
      warn(`unexpected failure: ${err?.message}`)
      geo = { ok: false, errorType: 'network' }
    }
    if (geo.timedOut) geo = { ok: false, errorType: 'timeout' }
    if (geo.ok) {
      const dataSource = geo.fromCache ? 'cached' : 'live'
      return { results: [{ ...geo.value, dataSource, cached: geo.fromCache }], dataSource, provider: PROVIDER, fallbackReason: null, ...(geo.stale ? { stale: true } : {}) }
    }
    if (geo.errorType !== 'not_found') warn(`destination lookup: ${geo.errorType}${geo.error ? ` — ${geo.error}` : ''}`)
    return fromSample(fallbackReasonFor(geo.errorType === 'not_found' ? 'no_results' : geo.errorType))
  },

  /** Test hook: clears the circuit breaker and in-flight map. */
  _resetForTests() {
    breaker = { until: 0, errorType: null }
    inflight.clear()
  },
}
