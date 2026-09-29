import { weatherService } from '../services/weatherService.js'
import { makeSource, unavailableSource } from '../agents/sourceStatus.js'

// Agent-facing weather tool (R7): Agent -> weatherTool -> weatherService -> provider.
// Weather is optional context: every failure path resolves to an
// `unavailable` source with empty data — never an exception, never invented
// conditions. There is deliberately no sample weather (see weatherService).

const WEATHER_DEADLINE_MS = 3000

// A day counts as "wet" only when the provider itself reports a high
// precipitation chance. This is a factual flag, not a safety verdict.
export const WET_DAY_PRECIP_PCT = 60

export function isWetDay(day) {
  return typeof day?.precipitationChancePct === 'number' && day.precipitationChancePct >= WET_DAY_PRECIP_PCT
}

function tripDates(startDate, days) {
  if (!startDate || !days) return []
  const start = new Date(startDate)
  if (Number.isNaN(start.getTime())) return []
  return Array.from({ length: days }, (_, i) => new Date(start.getTime() + i * 86400000).toISOString().slice(0, 10))
}

/**
 * @returns {{
 *   current: object|null, forecast: object[], forecastByDate: Record<string, object>,
 *   missingForecastDates: string[],
 *   sources: { current: object, forecast: object }
 * }}
 */
export async function getWeatherContext({ destination, startDate = null, days = 0, deadlineMs = WEATHER_DEADLINE_MS } = {}) {
  const empty = (reason) => ({
    current: null,
    forecast: [],
    forecastByDate: {},
    missingForecastDates: tripDates(startDate, days),
    sources: { current: unavailableSource(reason), forecast: unavailableSource(reason) },
  })
  if (!destination) return empty('not_found')

  let currentResult
  let forecastResult
  try {
    ;[currentResult, forecastResult] = await Promise.all([
      weatherService.fetchCurrent(destination, { deadlineMs }),
      weatherService.fetchForecast(destination, { deadlineMs }),
    ])
  } catch {
    return empty('provider_unavailable')
  }

  const forecast = (forecastResult?.days || []).filter((d) => d?.date && d.dataSource !== 'unavailable')
  const forecastByDate = Object.fromEntries(forecast.map((d) => [d.date, d]))
  const dates = tripDates(startDate, days)

  return {
    current: currentResult?.current || null,
    forecast,
    forecastByDate,
    // Trip dates the provider's ~5-day window doesn't cover: reported as
    // missing, never extrapolated.
    missingForecastDates: dates.filter((d) => !forecastByDate[d]),
    sources: {
      current: makeSource({ dataSource: currentResult?.current ? currentResult.dataSource : 'unavailable', provider: currentResult?.provider, fallbackReason: currentResult?.fallbackReason, stale: currentResult?.stale }),
      forecast: makeSource({ dataSource: forecast.length ? forecastResult.dataSource : 'unavailable', provider: forecastResult?.provider, fallbackReason: forecastResult?.fallbackReason, stale: forecastResult?.stale }),
    },
  }
}
