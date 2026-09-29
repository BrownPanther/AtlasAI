import { BaseProvider, redactSecrets } from './BaseProvider.js'
import { env } from '../config/env.js'

// RailRadar (railradar.in) — the selected Indian-rail data provider (R1
// research; see SETUP.md). Official, documented, self-service REST API
// (no scraping of IRCTC/NTES). Free sandbox tier: 1,000 requests/month.
// Docs: https://railradar.in/docs
//
// Auth: a static bearer API key (no OAuth token exchange, unlike Amadeus) —
// `Authorization: Bearer <key>` on every request.
const API_BASE = 'https://api.railradar.in/v1'

class RailProvider extends BaseProvider {
  constructor() {
    super({ name: 'railradar', category: 'trains' })
  }

  isConfigured() {
    return Boolean(env.providers.trainsApiKey)
  }

  /** Runs an authed GET, returning BaseProvider.request's uniform shape. */
  async _authedRequest(url) {
    if (!this.isConfigured()) return { ok: false, status: 0, data: null, error: 'RailRadar API key not configured', errorType: 'not_configured' }
    return this.request(url, { headers: { Authorization: `Bearer ${env.providers.trainsApiKey}` } })
  }

  /**
   * Station autocomplete/lookup — used to resolve a free-text city/station
   * name to RailRadar's station code (e.g. "Delhi" -> "NDLS").
   * GET /v1/lookup/search/stations?q=&limit=
   */
  async searchStations(query, { limit = 10 } = {}) {
    if (!query) return { ok: false, error: 'No station/city given', errorType: 'not_found', data: null }
    try {
      const params = new URLSearchParams({ q: query, limit: String(limit) })
      const result = await this._authedRequest(`${API_BASE}/lookup/search/stations?${params}`)
      if (!result.ok) return { ok: false, error: result.error, errorType: result.errorType, data: null }
      return { ok: true, error: null, errorType: null, data: Array.isArray(result.data?.data) ? result.data.data : [] }
    } catch (err) {
      return { ok: false, error: redactSecrets(err.message), errorType: 'network', data: null }
    }
  }

  /**
   * Direct/connecting trains between two station codes.
   * GET /v1/trains/between/{from}/{to}?date=&type=&category=&byCity=&live=
   * `live: true` enriches each result with live departure/delay status at
   * the `from` station for the given `date` — still a single request.
   */
  async trainsBetween(fromCode, toCode, { date, type, category, byCity, live } = {}) {
    if (!fromCode || !toCode) return { ok: false, error: 'Both station codes are required', errorType: 'not_found', data: null }
    try {
      const params = new URLSearchParams()
      if (date) params.set('date', date)
      if (type) params.set('type', type)
      if (category) params.set('category', category)
      if (byCity != null) params.set('byCity', String(Boolean(byCity)))
      if (live != null) params.set('live', String(Boolean(live)))
      const qs = params.toString()
      const url = `${API_BASE}/trains/between/${encodeURIComponent(fromCode)}/${encodeURIComponent(toCode)}${qs ? `?${qs}` : ''}`
      const result = await this._authedRequest(url)
      if (!result.ok) return { ok: false, error: result.error, errorType: result.errorType, data: null }
      return { ok: true, error: null, errorType: null, data: result.data?.data || null }
    } catch (err) {
      return { ok: false, error: redactSecrets(err.message), errorType: 'network', data: null }
    }
  }

  /**
   * Real-time running status for one train. GET /v1/trains/{number}/live
   * `date` is optional — omit to auto-detect the current run.
   */
  async getTrainStatus(trainNumber, { date } = {}) {
    if (!trainNumber) return { ok: false, error: 'Train number is required', errorType: 'not_found', data: null }
    try {
      const params = new URLSearchParams()
      if (date) params.set('date', date)
      const qs = params.toString()
      const url = `${API_BASE}/trains/${encodeURIComponent(trainNumber)}/live${qs ? `?${qs}` : ''}`
      const result = await this._authedRequest(url)
      if (!result.ok) return { ok: false, error: result.error, errorType: result.errorType, data: null }
      return { ok: true, error: null, errorType: null, data: result.data?.data || null }
    } catch (err) {
      return { ok: false, error: redactSecrets(err.message), errorType: 'network', data: null }
    }
  }

  /**
   * Itemized ticket fare. GET /v1/trains/{number}/fare
   * source/destination/journeyDate/classCode are required by RailRadar;
   * quotaCode defaults to 'GN' (General) same as RailRadar's own default.
   */
  async getFare(trainNumber, { source, destination, journeyDate, classCode, quotaCode = 'GN' } = {}) {
    if (!trainNumber || !source || !destination || !journeyDate || !classCode) {
      return { ok: false, error: 'source, destination, journeyDate and classCode are required', errorType: 'not_found', data: null }
    }
    try {
      const params = new URLSearchParams({ source, destination, journeyDate, classCode, quotaCode })
      const url = `${API_BASE}/trains/${encodeURIComponent(trainNumber)}/fare?${params}`
      const result = await this._authedRequest(url)
      if (!result.ok) return { ok: false, error: result.error, errorType: result.errorType, data: null }
      return { ok: true, error: null, errorType: null, data: result.data?.data || null }
    } catch (err) {
      return { ok: false, error: redactSecrets(err.message), errorType: 'network', data: null }
    }
  }

  /**
   * 14-day rolling seat-availability forecast. GET /v1/trains/{number}/seats
   * Same required parameters as getFare().
   */
  async getSeatAvailability(trainNumber, { source, destination, journeyDate, classCode, quotaCode = 'GN' } = {}) {
    if (!trainNumber || !source || !destination || !journeyDate || !classCode) {
      return { ok: false, error: 'source, destination, journeyDate and classCode are required', errorType: 'not_found', data: null }
    }
    try {
      const params = new URLSearchParams({ source, destination, journeyDate, classCode, quotaCode })
      const url = `${API_BASE}/trains/${encodeURIComponent(trainNumber)}/seats?${params}`
      const result = await this._authedRequest(url)
      if (!result.ok) return { ok: false, error: result.error, errorType: result.errorType, data: null }
      return { ok: true, error: null, errorType: null, data: result.data?.data || null }
    } catch (err) {
      return { ok: false, error: redactSecrets(err.message), errorType: 'network', data: null }
    }
  }
}

export const railProvider = new RailProvider()
