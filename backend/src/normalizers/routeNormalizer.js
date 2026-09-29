// Canonical AtlasAI route shape — a new concept (there was no sample-data
// equivalent), used to annotate distance/travel-time between itinerary
// stops once wired in (see SETUP.md "Real Travel Data Integration" R3).
//
// {
//   distanceKm, durationMinutes, mode, dataSource: 'live' | 'unavailable', provider, cached,
// }

const METERS_PER_KM = 1000

/** Maps an OpenRouteService /v2/directions response to the canonical shape. */
export function normalizeOpenRouteServiceRoute(raw, { mode = 'driving', cached = false } = {}) {
  const summary = raw?.features?.[0]?.properties?.summary
  if (!summary) return null
  return {
    distanceKm: Math.round((summary.distance / METERS_PER_KM) * 10) / 10,
    durationMinutes: Math.round(summary.duration / 60),
    mode,
    dataSource: 'live',
    provider: 'openrouteservice',
    cached,
  }
}

/** Used whenever no maps provider is configured or the request fails — never fabricate a distance/duration. */
export function unavailableRoute(mode = 'driving', fallbackReason = null) {
  return { distanceKm: null, durationMinutes: null, mode, dataSource: 'unavailable', provider: null, cached: false, fallbackReason }
}
