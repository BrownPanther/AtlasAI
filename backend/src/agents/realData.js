import { getWeatherContext } from '../tools/weatherTool.js'

// Run-scoped access to shared real-data context (R7). Agents call these
// instead of hitting a tool twice: the first caller triggers the tool, every
// later caller (including agents running in parallel) awaits the same promise.

export function ensureWeather(context) {
  const { intent } = context.state
  return context.once('weather', async () => {
    context.trace('Weather context', 'running', { summary: 'Checking weather…' })
    const ctx = await getWeatherContext({ destination: intent.destination, startDate: intent.startDate, days: intent.days })
    // Persisted run state keeps normalized facts only (small, no provider payloads).
    context.state.weather = {
      current: ctx.current,
      forecast: ctx.forecast.slice(0, 6),
      forecastByDate: ctx.forecastByDate,
      missingForecastDates: ctx.missingForecastDates,
      sources: ctx.sources,
    }
    context.recordSource('weather', ctx.sources.forecast.state !== 'unavailable' ? ctx.sources.forecast : ctx.sources.current)
    context.trace('Weather context', ctx.sources.forecast.state === 'unavailable' && ctx.sources.current.state === 'unavailable' ? 'warning' : 'success', {
      summary: ctx.sources.forecast.state === 'unavailable' && ctx.sources.current.state === 'unavailable' ? 'Weather unavailable — planning without it' : 'Weather checked',
    })
    return context.state.weather
  })
}

export function progress(context, agent, summary) {
  context.trace(agent, 'running', { summary })
}
