import { getDestinationMeta } from './destinationTool.js'
import { weatherService } from '../services/weatherService.js'
import { WET_DAY_PRECIP_PCT } from './weatherTool.js'

// Generic India-wide emergency numbers. Not destination-specific, not live —
// clearly labelled as general information in the agent output.
export const GENERAL_EMERGENCY_CONTACTS = [
  { label: 'National Emergency Number (India)', number: '112' },
  { label: 'Tourist Helpline', number: '1363' },
  { label: 'Women Helpline', number: '1091' },
]

/**
 * Safety notes (R7). Static, clearly-labelled general guidance plus
 * FACTUAL real-data context. Nothing here is a verdict: rain in a forecast
 * is reported as a forecast fact, never as "unsafe", and no route or
 * transport claim is made beyond what the provider returned.
 *
 * Optional `weather` (a weatherTool context already fetched for this run),
 * `routes` (routeTool summary) and `transport` (the selected transport
 * option) avoid extra provider calls; without `weather` the tool fetches
 * current conditions itself (previous R6 behaviour).
 */
export async function getSafetyNotes({ destination, accessibilityNeeds = [], weather = null, routes = null, transport = null, tripDates = [] } = {}) {
  const meta = getDestinationMeta(destination)

  let liveWeather = null
  let weatherState = 'unavailable'
  let weatherFallback = null
  let forecastDays = []
  if (weather) {
    liveWeather = weather.current || null
    weatherState = weather.sources?.current?.state || 'unavailable'
    weatherFallback = weather.sources?.current?.fallbackReason || null
    forecastDays = weather.forecast || []
  } else {
    const weatherResult = await weatherService.fetchCurrent(destination)
    liveWeather = weatherResult.dataSource !== 'unavailable' ? weatherResult.current : null
    weatherState = weatherResult.dataSource
    weatherFallback = weatherResult.fallbackReason || null
  }
  const weatherNote = liveWeather
    ? `Currently ${liveWeather.tempC}\u00b0C, ${liveWeather.description || liveWeather.condition?.toLowerCase() || 'conditions unavailable'} in ${destination}${weatherState === 'cached' ? ' (recently cached reading)' : ''}.`
    : meta.weatherNote

  const precautions = [
    'Share your live location with a trusted contact or group before setting out each day.',
    'Keep a physical/photo copy of ID and emergency contacts separate from your phone.',
    'Check local weather before high-altitude or outdoor activities.',
  ]

  if (accessibilityNeeds.length > 0) {
    precautions.push('Confirm accessibility of specific venues directly, as sample data does not track accessibility features.')
  }

  // Provider facts only.
  const relevantForecast = tripDates.length ? forecastDays.filter((d) => tripDates.includes(d.date)) : forecastDays
  const forecastNotes = relevantForecast
    .filter((d) => typeof d.precipitationChancePct === 'number' && d.precipitationChancePct >= WET_DAY_PRECIP_PCT)
    .map((d) => `Forecast precipitation chance ${d.precipitationChancePct}% on ${d.date} (${d.provider || 'provider'} forecast).`)
  const routeNotes = []
  if (routes?.summary?.legsLive + routes?.summary?.legsCached > 0) {
    routeNotes.push(`Routed local legs total about ${routes.summary.knownTravelMinutes} min of driving (${routes.summary.legsLive + routes.summary.legsCached} of ${routes.summary.legsRequested} legs measured; others not measured).`)
  }
  const transportNotes = []
  if (transport?.mode === 'train' && transport.status) {
    transportNotes.push(`Train ${transport.trainNumber || ''} reported status "${transport.status}"${transport.delayMinutes != null ? ` (${transport.delayMinutes} min delay)` : ''} at search time; status can change.`)
  }

  return {
    destinationRisk: meta.generalRiskLevel,
    weatherNote,
    weather: liveWeather ? { ...liveWeather, dataSource: weatherState } : null,
    weatherSource: { state: liveWeather ? weatherState : 'unavailable', fallbackReason: liveWeather ? null : weatherFallback },
    forecastNotes,
    routeNotes,
    transportNotes,
    emergencyContacts: GENERAL_EMERGENCY_CONTACTS,
    precautions,
    dataSource: meta.dataSource,
    disclaimer: 'These are general, non-live safety notes. AtlasAI does not monitor real-time conditions or dispatch emergency services.',
  }
}
