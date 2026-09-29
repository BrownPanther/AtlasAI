import { BaseProvider } from './BaseProvider.js'
import { env } from '../config/env.js'

// Duffel Flights API Provider (air/offer_requests)
// Replaces deprecated Amadeus self-service flight endpoints with Duffel.
// Real auth, real live/test flight offers with bookable pricing and airline data.
// Free test/live tokens at https://duffel.com
const DUFFEL_API_BASE = 'https://api.duffel.com/air'

class DuffelProvider extends BaseProvider {
  constructor() {
    super({ name: 'duffel', category: 'flights' })
  }

  isConfigured() {
    return Boolean(env.providers.duffelApiKey)
  }

  /**
   * Searches flight offers via Duffel Offer Requests.
   * Supports one-way and round-trip, passengers, cabin classes.
   */
  async searchFlights({ origin, destination, departureDate, returnDate = null, adults = 1, travelClass = 'economy', limit = 10 } = {}) {
    if (!this.isConfigured()) {
      return { ok: false, status: 0, data: null, error: 'Duffel API key not configured', errorType: 'not_configured' }
    }

    const slices = [
      {
        origin: String(origin).toUpperCase(),
        destination: String(destination).toUpperCase(),
        departure_date: departureDate,
      },
    ]

    if (returnDate) {
      slices.push({
        origin: String(destination).toUpperCase(),
        destination: String(origin).toUpperCase(),
        departure_date: returnDate,
      })
    }

    const passengerCount = Math.max(1, Math.min(9, Number(adults) || 1))
    const passengers = Array.from({ length: passengerCount }, () => ({ type: 'adult' }))

    const validCabins = ['economy', 'premium_economy', 'business', 'first']
    const cabin = validCabins.includes(travelClass?.toLowerCase()) ? travelClass.toLowerCase() : 'economy'

    const payload = {
      data: {
        slices,
        passengers,
        cabin_class: cabin,
      },
    }

    const res = await this.request(`${DUFFEL_API_BASE}/offer_requests?return_offers=true`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.providers.duffelApiKey}`,
        'Duffel-Version': 'v2',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    if (!res.ok) return res

    const offers = Array.isArray(res.data?.data?.offers) ? res.data.data.offers : []
    return {
      ok: true,
      status: res.status,
      data: { offers: offers.slice(0, limit) },
      error: null,
      errorType: null,
    }
  }

  /**
   * Searches places/airports suggestions via Duffel Places API.
   */
  async searchPlaces(query) {
    if (!this.isConfigured()) {
      return { ok: false, status: 0, data: null, error: 'Duffel API key not configured', errorType: 'not_configured' }
    }

    const q = encodeURIComponent(String(query).trim())
    const res = await this.request(`${DUFFEL_API_BASE}/places/suggestions?query=${q}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${env.providers.duffelApiKey}`,
        'Duffel-Version': 'v2',
      },
    })

    if (!res.ok) return res

    const places = Array.isArray(res.data?.data) ? res.data.data : []
    return {
      ok: true,
      status: res.status,
      data: places,
      error: null,
      errorType: null,
    }
  }
}

export const duffelProvider = new DuffelProvider()
