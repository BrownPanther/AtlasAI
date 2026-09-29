// How long each category's normalized provider response stays cached before
// a fresh request is made. Chosen by how often the underlying data actually
// changes — attractions/hotels are near-static, routes are static for a
// given coordinate pair, weather changes hourly-ish.
export const CACHE_TTL_SECONDS = {
  attractions: 60 * 60 * 24 * 7, // 7 days — points of interest rarely change
  hotels: 60 * 60 * 6, // 6 hours — Amadeus test data, but treat like semi-live pricing
  cities: 60 * 60 * 24 * 30, // 30 days — a destination name's IATA city code doesn't change
  airports: 60 * 60 * 24 * 30, // 30 days — same reasoning as `cities`, kept separate so flight and hotel location caches never collide
  flights: 60 * 30, // 30 minutes — pricing-sensitive category
  trains: 60 * 30, // 30 minutes — schedule/live-enriched search results, same reasoning as flights
  stations: 60 * 60 * 24 * 30, // 30 days — a station's code doesn't change (same reasoning as cities/airports)
  trainStatus: 60 * 2, // 2 minutes — genuinely live telemetry, must not go stale for long
  trainDetails: 60 * 5, // 5 minutes — fare/seat-availability snapshots (RailRadar's own seat forecast is itself a snapshot)
  routes: 60 * 60 * 24 * 30, // 30 days — distance/duration between two fixed points is static
  weather: 60 * 60, // 1 hour
}
