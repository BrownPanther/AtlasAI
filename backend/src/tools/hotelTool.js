import { hotelsService } from '../services/hotelsService.js'
import { makeSource, isBaseCurrency } from '../agents/sourceStatus.js'

const COMFORT_BAND = {
  Budget: [0, 1600],
  Standard: [800, 3200],
  Premium: [2500, Infinity],
}

// Planning must never stall on an external API: the Orchestrator gives every
// agent an 8s budget, so the provider lookup gets less than that. If the
// deadline is hit the service falls back to sample data; the provider
// request keeps running in the background and warms the cache for next time.
const PROVIDER_DEADLINE_MS = 5000
const PLANNING_LIMIT = 10

/**
 * Hotel pricing rules (R7): a nightly rate is per ROOM per night (the
 * provider search is for one room, and AtlasAI's intent has no room count
 * unless `rooms` is given). The stay total is nightly x nights x rooms — a
 * nightly rate is never presented as the whole-stay price, and a price in a
 * currency AtlasAI can't convert is never summed into an INR total.
 */
function scoreHotels(hotels, { nights, rooms, budgetPerNight, comfortPref }) {
  const band = COMFORT_BAND[comfortPref] || COMFORT_BAND.Standard

  const scored = hotels.map((h) => {
    const comparable = h.pricePerNight != null && isBaseCurrency(h.currency)
    const priceKnown = comparable
    const ratingKnown = h.rating != null
    const totalPrice = priceKnown ? h.pricePerNight * nights * rooms : null
    const withinBudget = !priceKnown || h.pricePerNight * rooms <= budgetPerNight
    const inComfortBand = !priceKnown || (h.pricePerNight >= band[0] && h.pricePerNight <= band[1])
    const ratingScore = ratingKnown ? (5 - h.rating) / 5 : 0.5
    const priceScore = priceKnown ? Math.min(h.pricePerNight / 6000, 1) : 0.5
    const bandPenalty = inComfortBand ? 0 : 0.25
    const score = ratingScore * 0.5 + priceScore * 0.3 + bandPenalty + (withinBudget ? 0 : 0.4)
    return {
      ...h,
      totalPrice,
      rooms,
      priceBasis: 'per_room_per_night',
      priceState: priceKnown ? (h.sourceType || h.dataSource) : 'unavailable',
      sourceType: h.sourceType || (h.dataSource === 'estimated' ? 'estimated' : h.dataSource === 'sample' ? 'demo' : h.dataSource),
      priceNote: h.pricePerNight == null ? 'price_not_provided' : !comparable ? 'currency_conversion_unavailable' : null,
      ...(h.pricePerNight != null && !comparable ? { priceOriginal: { amount: h.pricePerNight, currency: h.currency, basis: 'per_room_per_night' } } : {}),
      // A listing is not availability, and availability is not a booking.
      availability: h.liveAvailability ? 'verified' : 'not_verified',
      bookingStatus: 'not_booked',
      withinBudget,
      inComfortBand,
      priceKnown,
      ratingKnown,
      score,
    }
  })

  scored.sort((a, b) => a.score - b.score)
  return scored
}

/** Scored hotels plus the service-level source status (never dropped). */
export async function searchHotels({ destination, nights = 1, rooms = 1, budgetPerNight = Infinity, comfortPref = 'Standard' }) {
  const result = await hotelsService.getHotels(destination, { limit: PLANNING_LIMIT, deadlineMs: PROVIDER_DEADLINE_MS })
  return {
    options: scoreHotels(result.hotels, { nights, rooms, budgetPerNight, comfortPref }),
    source: makeSource({ dataSource: result.dataSource, provider: result.provider, fallbackReason: result.fallbackReason, stale: result.stale }),
  }
}

// Backwards-compatible entry point (scored options only).
export async function getHotels(args) {
  return (await searchHotels(args)).options
}
