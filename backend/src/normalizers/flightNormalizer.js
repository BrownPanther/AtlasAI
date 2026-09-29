// Canonical AtlasAI transport-option shape — superset of the existing
// sample shape ({ id, mode, provider, from, to, price, durationHours,
// departure, arrival, dataSource }).
//
// {
//   id, mode, provider, from, to, price, durationHours, departure, arrival, dataSource, cached,
//   currency, airline, flightNumber, stops, status, bookingUrl,
//   tripType: 'one-way' | 'round-trip',
//   // Present only when tripType is 'round-trip' — the outbound fields
//   // above stay as documented; these describe the return leg only:
//   returnDeparture, returnArrival, returnDurationHours, returnStops,
// }

// Amadeus returns airport-LOCAL timestamps without a UTC offset
// ("2026-10-10T07:00:00"). The clock time and calendar date are therefore
// read straight from the string: round-tripping through Date/toISOString
// would shift them by the server's timezone. (R7 date/time consistency.)
function isoToClock(iso) {
  const m = /T(\d{2}:\d{2})/.exec(iso || '')
  return m ? m[1] : null
}

function isoToDate(iso) {
  const m = /^(\d{4}-\d{2}-\d{2})T/.exec(iso || '')
  return m ? m[1] : null
}

// "PT2H35M" -> 2.6. Amadeus's own itinerary duration is real elapsed time,
// so it stays correct across time zones (unlike subtracting two local times).
function isoDurationToHours(duration) {
  const m = /^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?$/.exec(duration || '')
  if (!m || (!m[1] && !m[2] && !m[3])) return null
  return Math.round(((Number(m[1] || 0) * 24) + Number(m[2] || 0) + Number(m[3] || 0) / 60) * 10) / 10
}

function hoursBetween(startIso, endIso) {
  const start = new Date(startIso).getTime()
  const end = new Date(endIso).getTime()
  if (Number.isNaN(start) || Number.isNaN(end)) return null
  return Math.round(((end - start) / 3600000) * 10) / 10
}

/** Maps one Amadeus flight-offer to the canonical shape. */
export function normalizeAmadeusFlight(raw, { cached = false } = {}) {
  if (!raw) return null
  const outbound = raw.itineraries?.[0]
  const segments = outbound?.segments || []
  const first = segments[0]
  const last = segments[segments.length - 1]
  if (!first || !last) return null

  // Amadeus returns a second itinerary only when the search itself was a
  // round trip (a returnDate was passed) — never fabricated by combining
  // unrelated one-way responses. raw.price.total already covers the whole
  // itinerary (both legs) in that case, per Amadeus's own semantics, so it
  // is not split or doubled here.
  const inbound = raw.itineraries?.[1]
  const inboundSegments = inbound?.segments || []
  const inFirst = inboundSegments[0]
  const inLast = inboundSegments[inboundSegments.length - 1]

  return {
    id: raw.id,
    mode: 'flight',
    provider: first.carrierCode || 'Airline',
    from: first.departure?.iataCode || '',
    to: last.arrival?.iataCode || '',
    // Amadeus test environment returns synthetic fares — flag dataSource as
    // 'live' (real API call, real schema) while callers should still treat
    // the price as sandbox pricing, not a bookable fare. See SETUP.md.
    price: raw.price?.total ? Number(raw.price.total) : null,
    durationHours: isoDurationToHours(outbound?.duration) ?? hoursBetween(first.departure?.at, last.arrival?.at),
    departure: isoToClock(first.departure?.at),
    arrival: isoToClock(last.arrival?.at),
    // Local calendar dates at each airport — lets planners see an overnight
    // / next-day arrival without assuming both ends share a timezone.
    departureDate: isoToDate(first.departure?.at),
    arrivalDate: isoToDate(last.arrival?.at),
    dataSource: 'live',
    sourceType: 'live',
    cached,
    currency: raw.price?.currency || 'INR',
    airline: first.carrierCode || null,
    flightNumber: first.number ? `${first.carrierCode}${first.number}` : null,
    stops: Math.max(0, segments.length - 1),
    status: null, // Amadeus flight-offers search doesn't return live operational status
    bookingUrl: null,
    // price.total in a flight-offers response is for ALL travellers in the
    // search (the tool passes adults = party size) — never multiply again.
    priceBasis: 'party_total',
    tripType: inFirst && inLast ? 'round-trip' : 'one-way',
    ...(inFirst && inLast ? {
      returnDeparture: isoToClock(inFirst.departure?.at),
      returnArrival: isoToClock(inLast.arrival?.at),
      returnDurationHours: isoDurationToHours(inbound?.duration) ?? hoursBetween(inFirst.departure?.at, inLast.arrival?.at),
      returnStops: Math.max(0, inboundSegments.length - 1),
    } : {}),
  }
}

/** Maps one Duffel flight-offer to the canonical AtlasAI shape. */
export function normalizeDuffelFlight(raw, { cached = false } = {}) {
  if (!raw) return null
  const outbound = raw.slices?.[0]
  const segments = outbound?.segments || []
  const first = segments[0]
  const last = segments[segments.length - 1]
  if (!first || !last) return null

  const inbound = raw.slices?.[1]
  const inboundSegments = inbound?.segments || []
  const inFirst = inboundSegments[0]
  const inLast = inboundSegments[inboundSegments.length - 1]

  const airlineName = first.marketing_carrier?.name || raw.owner?.name || first.operating_carrier?.name || 'Airline'
  const carrierCode = first.marketing_carrier?.iata_code || raw.owner?.iata_code || ''
  const flightNum = first.marketing_carrier_flight_number || first.operating_carrier_flight_number || ''

  return {
    id: raw.id,
    mode: 'flight',
    provider: airlineName,
    from: first.origin?.iata_code || '',
    to: last.destination?.iata_code || '',
    price: raw.total_amount ? Number(raw.total_amount) : null,
    durationHours: isoDurationToHours(outbound?.duration) ?? hoursBetween(first.departing_at, last.arriving_at),
    departure: isoToClock(first.departing_at),
    arrival: isoToClock(last.arriving_at),
    departureDate: isoToDate(first.departing_at),
    arrivalDate: isoToDate(last.arriving_at),
    dataSource: 'live',
    sourceType: 'live',
    cached,
    currency: raw.total_currency || 'INR',
    airline: airlineName,
    flightNumber: flightNum ? `${carrierCode}${flightNum}` : null,
    stops: Math.max(0, segments.length - 1),
    status: raw.live_mode ? 'live_offer' : 'test_offer',
    bookingUrl: null,
    priceBasis: 'party_total',
    tripType: inFirst && inLast ? 'round-trip' : 'one-way',
    ...(inFirst && inLast ? {
      returnDeparture: isoToClock(inFirst.departing_at),
      returnArrival: isoToClock(inLast.arriving_at),
      returnDurationHours: isoDurationToHours(inbound?.duration) ?? hoursBetween(inFirst.departing_at, inLast.arriving_at),
      returnStops: Math.max(0, inboundSegments.length - 1),
    } : {}),
  }
}

/** Maps an estimated reference flight to the canonical shape. */
export function normalizeEstimatedFlight(raw, { cached = false } = {}) {
  if (!raw) return null
  return {
    id: raw.id,
    mode: 'flight',
    provider: raw.provider || raw.airline || 'Airline',
    from: raw.from || '',
    to: raw.to || '',
    fromCity: raw.fromCity || '',
    fromName: raw.fromName || '',
    toCity: raw.toCity || '',
    toName: raw.toName || '',
    price: raw.price != null ? Number(raw.price) : null,
    priceRange: raw.priceRange || null,
    durationHours: raw.durationHours != null ? Number(raw.durationHours) : null,
    durationText: raw.durationText || null,
    departure: raw.departure || null,
    arrival: raw.arrival || null,
    departureDate: raw.departureDate || null,
    arrivalDate: raw.arrivalDate || null,
    dataSource: raw.dataSource || 'estimated',
    sourceType: 'estimated',
    costState: 'estimated',
    cached,
    currency: raw.currency || 'INR',
    airline: raw.airline || raw.provider || null,
    airlineCode: raw.airlineCode || null,
    flightNumber: null, // do NOT fabricate real flight numbers
    stops: raw.stops || 0,
    status: raw.status || 'Live availability unavailable',
    availability: 'not_verified',
    bookingStatus: 'not_booked',
    bookingUrl: null,
    priceBasis: raw.priceBasis || 'party_total',
    tripType: raw.tripType || 'one-way',
    label: 'Planning estimate',
    actionLabel: 'Search live availability',
    ...(raw.returnDeparture ? {
      returnDeparture: raw.returnDeparture,
      returnArrival: raw.returnArrival,
      returnDurationHours: raw.returnDurationHours,
      returnStops: raw.returnStops || 0,
    } : {}),
  }
}

/** Wraps an existing sample-data transport option so its shape always matches the canonical one. */
export function normalizeSampleTransport(raw) {
  return {
    ...raw,
    dataSource: raw.dataSource || 'sample',
    sourceType: raw.sourceType || (raw.dataSource === 'sample' ? 'demo' : raw.dataSource || 'sample'),
    costState: raw.costState || (raw.dataSource === 'sample' ? 'estimated' : raw.dataSource),
    cached: false,
    currency: 'INR',
    airline: null,
    flightNumber: null,
    stops: 0,
    status: null,
    bookingUrl: null,
    tripType: 'one-way',
    // Flight-offer prices cover every passenger searched; the bundled
    // sample prices are per person. See transportTool's pricing rules.
    priceBasis: 'per_person',
  }
}
