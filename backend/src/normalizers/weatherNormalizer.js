// Canonical AtlasAI weather shape — a new, optional signal for itinerary
// planning (see SETUP.md "Real Travel Data Integration" R6). Weather must
// never become a hard dependency for trip planning (Phase 8 rule) — callers
// should treat a null/unavailable result as "no weather info", not an error.
//
// {
//   date, tempMinC, tempMaxC, condition, description, icon,
//   precipitationChancePct, dataSource: 'live' | 'unavailable', provider, cached,
// }

/** Maps one day of an OpenWeatherMap /data/2.5/forecast entry group to the canonical shape. */
export function normalizeOpenWeatherMapDay(raw, { date, cached = false } = {}) {
  if (!raw) return null
  return {
    date,
    tempMinC: typeof raw.tempMin === 'number' ? Math.round(raw.tempMin) : null,
    tempMaxC: typeof raw.tempMax === 'number' ? Math.round(raw.tempMax) : null,
    condition: raw.condition || null,
    description: raw.description || '',
    icon: raw.icon || null,
    precipitationChancePct: typeof raw.pop === 'number' ? Math.round(raw.pop * 100) : null,
    dataSource: 'live',
    provider: 'openweathermap',
    cached,
  }
}

export function unavailableWeather(date) {
  return { date, tempMinC: null, tempMaxC: null, condition: null, description: '', icon: null, precipitationChancePct: null, dataSource: 'unavailable', provider: null, cached: false }
}

// Canonical AtlasAI *current*-weather shape — a separate call/endpoint from
// the forecast above (OpenWeatherMap's /data/2.5/weather), same never-a-
// hard-dependency rule applies.
//
// {
//   tempC, feelsLikeC, condition, description, icon, humidityPct,
//   windSpeedKmh, visibilityKm, observedAt, dataSource: 'live', provider, cached,
// }

/** Maps an OpenWeatherMap /data/2.5/weather response to the canonical current-weather shape. */
export function normalizeOpenWeatherMapCurrent(raw, { cached = false } = {}) {
  if (!raw?.main) return null
  return {
    tempC: typeof raw.main.temp === 'number' ? Math.round(raw.main.temp) : null,
    feelsLikeC: typeof raw.main.feels_like === 'number' ? Math.round(raw.main.feels_like) : null,
    condition: raw.weather?.[0]?.main || null,
    description: raw.weather?.[0]?.description || '',
    icon: raw.weather?.[0]?.icon || null,
    humidityPct: typeof raw.main.humidity === 'number' ? raw.main.humidity : null,
    // OpenWeatherMap returns wind speed in m/s (metric units) — convert to km/h.
    windSpeedKmh: typeof raw.wind?.speed === 'number' ? Math.round(raw.wind.speed * 3.6) : null,
    visibilityKm: typeof raw.visibility === 'number' ? Math.round((raw.visibility / 1000) * 10) / 10 : null,
    observedAt: typeof raw.dt === 'number' ? new Date(raw.dt * 1000).toISOString() : null,
    dataSource: 'live',
    provider: 'openweathermap',
    cached,
  }
}
