import { getDestinationData } from '../data/sampleTravelData.js'
import { flightsService } from '../services/flightsService.js'
import { trainsService } from '../services/trainsService.js'
import { normalizeSampleTransport } from '../normalizers/flightNormalizer.js'
import { makeSource, isBaseCurrency, unavailableSource } from '../agents/sourceStatus.js'

// Every sample transport option already originates from 'Delhi' (see
// data/sampleTravelData.js) — real flight/train search reuses that same
// fixed origin so a live leg is comparable to the sample bus/cab legs it
// sits alongside.
const ORIGIN_CITY = 'Delhi'

// Planning must never stall on an external API: the Orchestrator gives
// every agent an 8s budget. Flights and trains are looked up concurrently
// so the combined cost stays ~one deadline, not two.
const PROVIDER_DEADLINE_MS = 5000
const FARE_DEADLINE_MS = 2000
const FLIGHT_LIMIT = 5
const TRAIN_LIMIT = 5

// RailRadar search returns no fare; the per-train fare call needs a class.
// AtlasAI's trip intent has no train-class field, so a disclosed default is
// used (3A general quota) and reported in `fareBasis` — never hidden.
const DEFAULT_TRAIN_CLASS = '3A'
const DEFAULT_TRAIN_QUOTA = 'GN'

const isIsoDate = (d) => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)

/**
 * Pricing rules (R7 budget consistency). Returns the TOTAL cost for the
 * whole party in INR, or null when it cannot be stated honestly:
 *   - no price from the provider           -> null (never 0)
 *   - non-INR price and no conversion service -> null (original kept in priceOriginal)
 *   - Amadeus flight offers (party_total)   -> used as-is (already covers everyone searched)
 *   - per-person prices (sample, train fares) -> multiplied by travellers
 */
function priceOption(opt, travellers) {
  const basis = opt.priceBasis || (opt.mode === 'flight' && opt.dataSource !== 'sample' ? 'party_total' : 'per_person')
  const base = { priceBasis: basis }
  if (opt.price == null) return { ...base, totalPrice: null, priceState: 'unavailable', priceNote: 'price_not_provided' }
  if (!isBaseCurrency(opt.currency)) {
    return {
      ...base,
      totalPrice: null,
      priceState: 'unavailable',
      priceNote: 'currency_conversion_unavailable',
      priceOriginal: { amount: opt.price, currency: opt.currency, basis },
    }
  }
  const totalPrice = basis === 'party_total' ? opt.price : opt.price * travellers
  const priceState = opt.sourceType || (opt.dataSource === 'estimated' ? 'estimated' : opt.dataSource || 'sample')
  const sourceType = opt.sourceType || (opt.dataSource === 'estimated' ? 'estimated' : opt.dataSource === 'sample' ? 'demo' : opt.dataSource || 'sample')
  return { ...base, totalPrice, priceState, sourceType, priceNote: null }
}

// Coverage of the journey the price describes, so a one-way fare is never
// presented as the whole round trip.
function coverageOf(opt) {
  if (opt.dataSource === 'sample') return 'unspecified'
  if (opt.mode === 'flight') return opt.tripType === 'round-trip' ? 'round_trip' : 'outbound_only'
  if (opt.mode === 'train') return 'outbound_only'
  return 'unspecified'
}

function scoreOption(opt, { travellers, budget, preferredMode }) {
  const priced = priceOption(opt, travellers)
  const priceKnown = priced.totalPrice != null
  const withinBudget = !priceKnown || priced.totalPrice <= budget
  const modeMatch = preferredMode && opt.mode === preferredMode
  const durationKnown = opt.durationHours != null
  // Unknown price/duration is neutral: never fabricated, never penalised.
  const priceScore = priceKnown ? Math.min(priced.totalPrice / 8000, 1) : 0.5
  const durationScore = durationKnown ? Math.min(opt.durationHours / 20, 1) : 0.5
  // Strongly prioritize the user's selected mode over budget optimizations
  const preferenceBonus = modeMatch ? -10 : 0
  const score = priceScore * 0.5 + durationScore * 0.3 + preferenceBonus + (withinBudget ? 0 : 0.5)
  return {
    ...opt,
    ...priced,
    coverage: coverageOf(opt),
    // Search results are schedule listings: not a seat/ticket check.
    availability: 'not_verified',
    bookingStatus: 'not_booked',
    withinBudget,
    modeMatch,
    priceKnown,
    score,
  }
}

async function enrichTopTrainFare(scored, { travellers, journeyDate, budget, preferredMode }) {
  if (!isIsoDate(journeyDate) || !trainsService.isLive()) return { scored, fareSource: null }
  const candidate = scored.find((o) => o.mode === 'train' && o.dataSource !== 'sample' && o.trainNumber && o.fromCode && o.toCode && o.price == null)
  if (!candidate) return { scored, fareSource: null }

  let result
  try {
    result = await trainsService.getFare(candidate.trainNumber, {
      source: candidate.fromCode,
      destination: candidate.toCode,
      journeyDate,
      classCode: DEFAULT_TRAIN_CLASS,
      quotaCode: DEFAULT_TRAIN_QUOTA,
      deadlineMs: FARE_DEADLINE_MS,
    })
  } catch {
    result = { fare: null, dataSource: 'unavailable', fallbackReason: 'provider_unavailable' }
  }
  const fareSource = makeSource({ dataSource: result.fare ? result.dataSource : 'unavailable', provider: result.provider, fallbackReason: result.fallbackReason, stale: result.stale })
  if (!result.fare) return { scored, fareSource }

  const enriched = scored.map((o) => (o.id === candidate.id
    ? scoreOption({
      ...o,
      price: result.fare.totalFare,
      dataSource: o.dataSource,
      fareBasis: { classCode: result.fare.classCode || DEFAULT_TRAIN_CLASS, quotaCode: result.fare.quotaCode || DEFAULT_TRAIN_QUOTA, assumedClass: true, fareState: result.dataSource },
    }, { travellers, budget, preferredMode })
    : o))
  enriched.sort((a, b) => a.score - b.score)
  return { scored: enriched, fareSource }
}

/**
 * Full transport search with per-source status. Real flight data (Amadeus,
 * via flightsService) and real train data (RailRadar, via trainsService)
 * each replace their sample option(s) whenever live/cached data exists;
 * bus/cab/train+cab stay sample (no provider covers them).
 *
 * @returns {{ options, sources: { flights, trains, trainFare, other }, availableModes: string[], excludedModes: string[] }}
 */
export async function searchTransport({
  destination, travellers = 1, budget = Infinity, preferredMode, departureDate, returnDate,
  excludeModes = [], deadlineMs = PROVIDER_DEADLINE_MS,
} = {}) {
  const { transportOptions, dataSource } = getDestinationData(destination)
  const sampleOptions = transportOptions.map((opt) => normalizeSampleTransport({ ...opt, dataSource }))

  const otherOptions = sampleOptions.filter((o) => o.mode !== 'flight' && o.mode !== 'train')
  let flightOptions = sampleOptions.filter((o) => o.mode === 'flight')
  let trainOptions = sampleOptions.filter((o) => o.mode === 'train')

  // A round-trip fare is requested only when the trip has a consistent end date.
  const wantsReturn = isIsoDate(returnDate) && isIsoDate(departureDate) && returnDate >= departureDate && returnDate !== departureDate

  const safe = async (fn, empty) => {
    try { return await fn() } catch { return empty }
  }
  const [flightResult, trainResult] = await Promise.all([
    safe(() => flightsService.getFlights(ORIGIN_CITY, destination, departureDate, {
      adults: travellers, limit: FLIGHT_LIMIT, deadlineMs, ...(wantsReturn ? { returnDate } : {}),
    }), { flights: [], dataSource: 'unavailable', provider: null, fallbackReason: 'provider_unavailable' }),
    safe(() => trainsService.getTrains(ORIGIN_CITY, destination, departureDate, { limit: TRAIN_LIMIT, deadlineMs }),
      { trains: [], dataSource: 'unavailable', provider: null, fallbackReason: 'provider_unavailable' }),
  ])

  const flightsReal = flightResult.flights?.length && flightResult.dataSource !== 'sample' && flightResult.dataSource !== 'unavailable'
  const trainsReal = trainResult.trains?.length && trainResult.dataSource !== 'sample' && trainResult.dataSource !== 'unavailable'
  if (flightsReal) flightOptions = flightResult.flights.map((f) => ({ ...f, from: f.from || ORIGIN_CITY, to: f.to || destination }))
  if (trainsReal) trainOptions = trainResult.trains.map((t) => ({ ...t, from: t.from || ORIGIN_CITY, to: t.to || destination }))

  let pool = [...otherOptions, ...flightOptions, ...trainOptions]
  const excluded = [...new Set(excludeModes)].filter((m) => pool.some((o) => o.mode === m))
  const remaining = pool.filter((o) => !excluded.includes(o.mode))
  // A replanning exclusion can never leave the traveller with nothing.
  const effectiveExcluded = remaining.length ? excluded : []
  if (remaining.length) pool = remaining

  let scored = pool.map((opt) => scoreOption(opt, { travellers, budget, preferredMode }))
  scored.sort((a, b) => a.score - b.score)

  const fare = await enrichTopTrainFare(scored, { travellers, journeyDate: departureDate, budget, preferredMode })
  scored = fare.scored

  const sources = {
    flights: makeSource({ dataSource: flightsReal ? flightResult.dataSource : flightResult.dataSource === 'unavailable' ? 'sample' : flightResult.dataSource, provider: flightResult.provider, fallbackReason: flightResult.fallbackReason, stale: flightResult.stale }),
    trains: makeSource({ dataSource: trainsReal ? trainResult.dataSource : trainResult.dataSource === 'unavailable' ? 'sample' : trainResult.dataSource, provider: trainResult.provider, fallbackReason: trainResult.fallbackReason, stale: trainResult.stale }),
    trainFare: fare.fareSource || unavailableSource('not_requested'),
    other: makeSource({ dataSource: 'sample', provider: 'sample', note: 'bus/cab/rail+cab options are bundled sample data' }),
  }
  return {
    options: scored,
    sources,
    availableModes: [...new Set(scored.map((o) => o.mode))],
    excludedModes: effectiveExcluded,
  }
}

// Backwards-compatible entry point (scored options only).
export async function getTransportOptions(args = {}) {
  return (await searchTransport(args)).options
}
