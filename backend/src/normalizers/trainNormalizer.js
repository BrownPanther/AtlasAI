// Canonical AtlasAI train shape — mirrors flightNormalizer.js's transport
// superset so a live/sample train slots into the same transportTool
// scoring and UI code as a flight.
//
// {
//   id, mode: 'train', provider, trainNumber, trainName, trainType,
//   from, to, departure, arrival, durationHours, distanceKm, stops,
//   runDays, status, delayMinutes, platform, price, currency,
//   dataSource: 'sample' | 'live', cached, bookingUrl,
// }
//
// RailRadar's trains-between-stations search does not return a fare — that
// is a separate, per-train /fare call (see railProvider.getFare /
// trainsService.getFare) — so `price` stays null for live results unless a
// caller has separately fetched and merged a fare. Never fabricated.

/** Maps one entry of RailRadar's GET /trains/between/{from}/{to} response. */
export function normalizeRailRadarTrain(entry, { fromStation, toStation, cached = false } = {}) {
  if (!entry?.train) return null
  const { train } = entry
  return {
    id: `railradar-${train.number}-${entry.from?.departure || ''}`,
    mode: 'train',
    provider: 'railradar',
    trainNumber: train.number || null,
    trainName: train.name || null,
    trainType: train.type || null,
    from: fromStation?.name || fromStation?.code || null,
    to: toStation?.name || toStation?.code || null,
    fromCode: fromStation?.code || null,
    toCode: toStation?.code || null,
    departure: entry.from?.departure || null,
    arrival: entry.to?.arrival || null,
    // RailRadar's `duration` is in minutes.
    durationHours: typeof entry.duration === 'number' ? Math.round((entry.duration / 60) * 10) / 10 : null,
    distanceKm: typeof entry.distance === 'number' ? entry.distance : null,
    stops: typeof entry.totalHaltsBetween === 'number' ? entry.totalHaltsBetween : null,
    runDays: train.runDays || null,
    // Only present when the search was made with live:true.
    status: entry.live?.type || null,
    delayMinutes: entry.live?.delayMinutes ?? null,
    platform: entry.live?.platform ?? null,
    // RailRadar numbers journey days from 1; a difference > 0 means the train
    // reaches the destination on a later calendar day. Null when not provided.
    arrivalDayOffset: Number.isFinite(entry.from?.day) && Number.isFinite(entry.to?.day) ? Math.max(0, entry.to.day - entry.from.day) : null,
    price: null, // not returned by this endpoint — see getFare()
    priceBasis: 'per_person',
    currency: 'INR',
    dataSource: 'live',
    cached,
    bookingUrl: null, // RailRadar is a data API, not a booking/ticketing API
  }
}

/** Wraps an existing sample-data transport option (mode 'train'/'train+cab') so its shape always matches the canonical one. */
export function normalizeSampleTrain(raw) {
  return {
    id: raw.id,
    mode: raw.mode || 'train',
    provider: 'sample',
    trainNumber: null,
    trainName: raw.provider || 'Train',
    trainType: null,
    from: raw.from,
    to: raw.to,
    departure: raw.departure,
    arrival: raw.arrival,
    durationHours: raw.durationHours,
    distanceKm: null,
    stops: null,
    runDays: null,
    status: null,
    delayMinutes: null,
    platform: null,
    price: raw.price,
    priceBasis: 'per_person',
    currency: 'INR',
    dataSource: raw.dataSource || 'sample',
    cached: false,
    bookingUrl: null,
  }
}

/** Maps a RailRadar station-search/directory entry. */
export function normalizeStation(raw) {
  if (!raw?.code) return null
  return { code: raw.code, name: raw.name || raw.code, city: raw.city || null }
}

/** Maps RailRadar's GET /trains/{number}/live response. */
export function normalizeTrainStatus(raw, { cached = false } = {}) {
  if (!raw) return null
  return {
    trainNumber: raw.trainNumber || null,
    trainName: raw.trainName || null,
    startDate: raw.startDate || null,
    status: raw.status || null,
    delayMinutes: typeof raw.delayMinutes === 'number' ? raw.delayMinutes : null,
    currentLocation: raw.currentLocation ? {
      stationCode: raw.currentLocation.stationCode || null,
      status: raw.currentLocation.status || null,
      segmentProgress: raw.currentLocation.segmentProgress ?? null,
      speedKmh: raw.currentLocation.speedKmh ?? null,
    } : null,
    previousHalt: raw.previousHalt ? { stationCode: raw.previousHalt.stationCode, stationName: raw.previousHalt.stationName } : null,
    nextHalt: raw.nextHalt ? { stationCode: raw.nextHalt.stationCode, stationName: raw.nextHalt.stationName } : null,
    lastUpdatedAt: raw.lastUpdatedAt || null,
    isLive: Boolean(raw.isLive),
    dataSource: 'live',
    provider: 'railradar',
    cached,
  }
}

/** Maps RailRadar's GET /trains/{number}/fare response. */
export function normalizeTrainFare(raw, { cached = false } = {}) {
  if (!raw || typeof raw.totalFare !== 'number') return null
  return {
    trainNumber: raw.trainNumber || null,
    classCode: raw.classCode || null,
    quotaCode: raw.quotaCode || null,
    totalFare: raw.totalFare,
    breakdown: raw.breakdown || null,
    currency: 'INR',
    dataSource: 'live',
    provider: 'railradar',
    cached,
  }
}

/** Maps RailRadar's GET /trains/{number}/seats response. */
export function normalizeSeatAvailability(raw, { cached = false } = {}) {
  if (!raw || !Array.isArray(raw.avlDayList)) return null
  return {
    trainNumber: raw.trainNumber || null,
    classCode: raw.classCode || null,
    quotaCode: raw.quotaCode || null,
    days: raw.avlDayList.map((d) => ({ date: d.availablityDate, status: d.availablityStatus })),
    dataSource: 'live',
    provider: 'railradar',
    cached,
  }
}
