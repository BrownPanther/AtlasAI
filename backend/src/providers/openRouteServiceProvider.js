import { BaseProvider } from './BaseProvider.js'
import { env } from '../config/env.js'

// OpenRouteService (openrouteservice.org) — OpenStreetMap-based routing.
// Free "Standard" plan, self-service API key. Docs: https://openrouteservice.org/dev/#/api-docs
const BASE_URL = 'https://api.openrouteservice.org/v2/directions'

// Only modes OpenRouteService actually has a routing profile for. A cab is a
// car ride so it legitimately reuses driving-car; bus/public transport has no
// ORS profile (no schedules/routes), so it is NOT mapped here — requesting it
// returns an 'unsupported_mode' error rather than silently approximating a
// bus trip with car timing.
const MODE_TO_PROFILE = {
  driving: 'driving-car', cab: 'driving-car', walking: 'foot-walking', cycling: 'cycling-regular',
}

class OpenRouteServiceProvider extends BaseProvider {
  constructor() {
    super({ name: 'openrouteservice', category: 'maps' })
  }

  isConfigured() {
    return Boolean(env.providers.mapsApiKey)
  }

  /**
   * Distance/duration between two { lat, lng } points.
   * mode is one of AtlasAI's own transport modes — mapped to an ORS profile.
   */
  async getRoute(from, to, mode = 'driving') {
    if (!this.isConfigured()) return { ok: false, error: 'Maps API key not configured', errorType: 'not_configured', data: null }
    const profile = MODE_TO_PROFILE[mode]
    if (!profile) return { ok: false, error: `Unsupported transport mode: ${mode}`, errorType: 'unsupported_mode', data: null }
    const url = `${BASE_URL}/${profile}?api_key=${env.providers.mapsApiKey}&start=${from.lng},${from.lat}&end=${to.lng},${to.lat}`
    const result = await this.request(url)
    if (!result.ok) return { ok: false, error: result.error, errorType: result.errorType, data: null }
    return { ok: true, error: null, errorType: null, data: result.data }
  }
}

export const openRouteServiceProvider = new OpenRouteServiceProvider()
