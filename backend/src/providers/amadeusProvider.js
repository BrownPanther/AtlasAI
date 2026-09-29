import { BaseProvider, redactSecrets } from './BaseProvider.js'
import { env } from '../config/env.js'

// Amadeus for Developers self-service test environment
// (developers.amadeus.com) — a legitimate, official developer API covering
// both flights and hotels under one app/credential pair, which is why one
// provider class serves both categories here.
//
// IMPORTANT: test.api.amadeus.com is explicitly a free, rate-limited
// sandbox that returns SYNTHETIC data, not live bookable inventory or
// live pricing. Normalizers tag this as dataSource:'live' (a real API
// call, real schema) but callers/UI must not present prices/availability
// from this environment as bookable — see hotelNormalizer.js /
// flightNormalizer.js and SETUP.md.
const AUTH_URL = 'https://test.api.amadeus.com/v1/security/oauth2/token'
const API_BASE = 'https://test.api.amadeus.com'

class AmadeusProvider extends BaseProvider {
  constructor() {
    super({ name: 'amadeus', category: 'flights+hotels' })
    this._token = null
    this._tokenExpiresAt = 0
  }

  isConfigured() {
    return Boolean(env.providers.amadeusApiKey && env.providers.amadeusApiSecret)
  }

  /**
   * Ensures a valid access token, fetching/refreshing one if needed.
   * Returns the uniform { ok, error, errorType, data } shape (never throws)
   * so callers can apply the same circuit-breaker logic as any other
   * provider request — an auth failure here IS an 'auth' errorType.
   */
  async _ensureToken() {
    if (this._token && Date.now() < this._tokenExpiresAt) return { ok: true, error: null, errorType: null, data: null }
    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: env.providers.amadeusApiKey,
      client_secret: env.providers.amadeusApiSecret,
    })
    const result = await this.request(AUTH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    })
    if (!result.ok || !result.data?.access_token) {
      return { ok: false, error: result.error || 'Amadeus authentication failed', errorType: result.errorType || 'auth', data: null }
    }
    this._token = result.data.access_token
    // Refresh a little early rather than exactly on expiry.
    this._tokenExpiresAt = Date.now() + (result.data.expires_in - 30) * 1000
    return { ok: true, error: null, errorType: null, data: null }
  }

  /**
   * Runs an authed GET, returning the same uniform shape as BaseProvider.request.
   * A token failure short-circuits with its own errorType (usually 'auth')
   * without ever reaching the target URL.
   */
  async _authedRequest(url) {
    const auth = await this._ensureToken()
    if (!auth.ok) return { ok: false, status: 0, data: null, error: auth.error, errorType: auth.errorType }
    return this.request(url, { headers: { Authorization: `Bearer ${this._token}` } })
  }

  async searchFlights({ origin, destination, departureDate, returnDate, adults = 1, travelClass, nonStop, max = 10 }) {
    if (!this.isConfigured()) return { ok: false, error: 'Amadeus credentials not configured', errorType: 'not_configured', data: null }
    try {
      const params = new URLSearchParams({
        originLocationCode: origin, destinationLocationCode: destination,
        departureDate, adults: String(adults), max: String(max),
      })
      // All optional and only added when given — every one is a genuine
      // Amadeus /v2/shopping/flight-offers (GET) query parameter, not an
      // invented one.
      if (returnDate) params.set('returnDate', returnDate)
      if (travelClass) params.set('travelClass', travelClass)
      if (nonStop != null) params.set('nonStop', String(Boolean(nonStop)))
      const result = await this._authedRequest(`${API_BASE}/v2/shopping/flight-offers?${params}`)
      if (!result.ok) return { ok: false, error: result.error, errorType: result.errorType, data: null }
      return { ok: true, error: null, errorType: null, data: result.data?.data || [] }
    } catch (err) {
      return { ok: false, error: redactSecrets(err.message), errorType: 'network', data: null }
    }
  }

  /**
   * Resolves a free-text destination name to Amadeus's own city reference
   * data (IATA city code + canonical name). Used to turn an AtlasAI
   * destination string into the city code searchHotelsByCity() needs.
   * Returns at most one best match (page[limit]=1).
   */
  async searchCities(keyword) {
    if (!this.isConfigured()) return { ok: false, error: 'Amadeus credentials not configured', errorType: 'not_configured', data: null }
    if (!keyword) return { ok: false, error: 'No destination given', errorType: 'not_found', data: null }
    try {
      const params = new URLSearchParams({ subType: 'CITY', keyword, 'page[limit]': '1' })
      const result = await this._authedRequest(`${API_BASE}/v1/reference-data/locations?${params}`)
      if (!result.ok) return { ok: false, error: result.error, errorType: result.errorType, data: null }
      return { ok: true, error: null, errorType: null, data: result.data?.data || [] }
    } catch (err) {
      return { ok: false, error: redactSecrets(err.message), errorType: 'network', data: null }
    }
  }

  async searchHotelsByCity(cityCode) {
    if (!this.isConfigured()) return { ok: false, error: 'Amadeus credentials not configured', errorType: 'not_configured', data: null }
    try {
      const result = await this._authedRequest(`${API_BASE}/v1/reference-data/locations/hotels/by-city?cityCode=${encodeURIComponent(cityCode)}`)
      if (!result.ok) return { ok: false, error: result.error, errorType: result.errorType, data: null }
      return { ok: true, error: null, errorType: null, data: result.data?.data || [] }
    } catch (err) {
      return { ok: false, error: redactSecrets(err.message), errorType: 'network', data: null }
    }
  }

  async getHotelOffers(hotelIds) {
    if (!this.isConfigured()) return { ok: false, error: 'Amadeus credentials not configured', errorType: 'not_configured', data: null }
    if (!hotelIds?.length) return { ok: true, error: null, errorType: null, data: [] }
    try {
      const result = await this._authedRequest(`${API_BASE}/v3/shopping/hotel-offers?hotelIds=${hotelIds.slice(0, 20).join(',')}`)
      if (!result.ok) return { ok: false, error: result.error, errorType: result.errorType, data: null }
      return { ok: true, error: null, errorType: null, data: result.data?.data || [] }
    } catch (err) {
      return { ok: false, error: redactSecrets(err.message), errorType: 'network', data: null }
    }
  }

  /** Test hook: clears the cached OAuth token so a fresh auth call is forced. */
  _resetForTests() {
    this._token = null
    this._tokenExpiresAt = 0
  }
}

export const amadeusProvider = new AmadeusProvider()
