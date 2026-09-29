import { BaseProvider } from './BaseProvider.js'
import { env } from '../config/env.js'

// OpenTripMap (dev.opentripmap.com) — worldwide points-of-interest database
// built from OpenStreetMap/Wikidata/Wikipedia. Free tier, official
// self-service API key, explicitly permits caching/storing results (ODbL).
// Docs: https://dev.opentripmap.com/docs
//
// Endpoints used:
//   GET /places/geoname   name -> { name, country, lat, lon, population, timezone, status }
//   GET /places/radius    lat/lon/radius -> [{ xid, name, kinds, rate, dist, point, osm, wikidata }]
//   GET /places/xid/{id}  full detail (address, wikipedia_extracts, preview, info, url ...)
//
// Every method resolves to { ok, error, errorType, data } and never throws.
// `error` is diagnostic-only and must not be surfaced to end users.
const BASE_URL = 'https://api.opentripmap.com/0.1/en/places'
const NOT_CONFIGURED = { ok: false, error: 'OpenTripMap API key not configured', errorType: 'not_configured', data: null }

class OpenTripMapProvider extends BaseProvider {
  constructor() {
    super({ name: 'opentripmap', category: 'attractions' })
  }

  isConfigured() {
    return Boolean(env.providers.attractionsApiKey)
  }

  /** Resolves a free-text destination name to coordinates + basic place metadata. */
  async geocode(destinationName) {
    if (!this.isConfigured()) return NOT_CONFIGURED
    const params = new URLSearchParams({ name: destinationName, apikey: env.providers.attractionsApiKey })
    const result = await this.request(`${BASE_URL}/geoname?${params.toString()}`)
    if (!result.ok) {
      // OpenTripMap answers 404 (or status != OK) when nothing matches the name.
      if (result.status === 404) return { ok: false, error: 'Destination not found', errorType: 'not_found', data: null }
      return { ok: false, error: result.error, errorType: result.errorType, data: null }
    }
    const d = result.data
    if (!d || typeof d !== 'object') return { ok: false, error: 'Malformed geoname response', errorType: 'malformed', data: null }
    if (d.status && d.status !== 'OK') return { ok: false, error: 'Destination not found', errorType: 'not_found', data: null }
    const lat = Number(d.lat)
    const lon = Number(d.lon)
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return { ok: false, error: 'Malformed geoname response', errorType: 'malformed', data: null }
    return {
      ok: true,
      error: null,
      errorType: null,
      data: {
        name: typeof d.name === 'string' ? d.name : destinationName,
        country: typeof d.country === 'string' ? d.country : null,
        timezone: typeof d.timezone === 'string' ? d.timezone : null,
        population: Number.isFinite(Number(d.population)) ? Number(d.population) : null,
        lat,
        lon,
      },
    }
  }

  /** Lists nearby points of interest for a coordinate. Lightweight — no descriptions/images. */
  async searchNearby({ lat, lon, radiusMeters = 10000, limit = 50, kinds }) {
    if (!this.isConfigured()) return NOT_CONFIGURED
    const params = new URLSearchParams({
      radius: String(radiusMeters), lon: String(lon), lat: String(lat),
      limit: String(limit), format: 'json', apikey: env.providers.attractionsApiKey,
    })
    if (kinds) params.set('kinds', kinds)
    const result = await this.request(`${BASE_URL}/radius?${params.toString()}`)
    if (!result.ok) return { ok: false, error: result.error, errorType: result.errorType, data: null }
    if (!Array.isArray(result.data)) return { ok: false, error: 'Malformed radius response', errorType: 'malformed', data: null }
    return { ok: true, error: null, errorType: null, data: result.data }
  }

  /** Full details (description, image, address) for one place. */
  async getDetails(xid) {
    if (!this.isConfigured()) return NOT_CONFIGURED
    const url = `${BASE_URL}/xid/${encodeURIComponent(xid)}?apikey=${encodeURIComponent(env.providers.attractionsApiKey)}`
    const result = await this.request(url)
    if (!result.ok) return { ok: false, error: result.error, errorType: result.errorType, data: null }
    if (!result.data || typeof result.data !== 'object' || Array.isArray(result.data)) {
      return { ok: false, error: 'Malformed place response', errorType: 'malformed', data: null }
    }
    return { ok: true, error: null, errorType: null, data: result.data }
  }
}

export const openTripMapProvider = new OpenTripMapProvider()
