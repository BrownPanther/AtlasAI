import { BaseProvider } from './BaseProvider.js'
import { env } from '../config/env.js'
import { getDestinationOverride } from '../services/attractionsService.js'

// OpenWeatherMap (openweathermap.org) — free-tier 5 day / 3 hour forecast
// plus the free "current weather" endpoint.
// Docs: https://openweathermap.org/forecast5, https://openweathermap.org/current
const FORECAST_URL = 'https://api.openweathermap.org/data/2.5/forecast'
const CURRENT_URL = 'https://api.openweathermap.org/data/2.5/weather'
const GEOCODE_URL = 'https://api.openweathermap.org/geo/1.0/direct'

class OpenWeatherMapProvider extends BaseProvider {
  constructor() {
    super({ name: 'openweathermap', category: 'weather' })
  }

  isConfigured() {
    return Boolean(env.providers.weatherApiKey)
  }

  /**
   * Resolves destination coordinates to avoid ambiguous name collisions.
   * For example, "Manali" in OpenWeatherMap's legacy search defaults to a
   * neighborhood in Chennai, Tamil Nadu (30°C tropical heat), rather than
   * Manali in Himachal Pradesh (10°C Himalayan hill station).
   */
  async resolveLocationParams(destinationName) {
    const override = getDestinationOverride(destinationName)
    if (override?.lat != null && override?.lon != null) {
      return `lat=${override.lat}&lon=${override.lon}`
    }

    // Try OpenWeatherMap's modern geocoding API to resolve true coordinates
    try {
      const geoUrl = `${GEOCODE_URL}?q=${encodeURIComponent(destinationName)}&limit=1&appid=${env.providers.weatherApiKey}`
      const geoRes = await this.request(geoUrl)
      if (geoRes.ok && Array.isArray(geoRes.data) && geoRes.data[0]?.lat != null && geoRes.data[0]?.lon != null) {
        return `lat=${geoRes.data[0].lat}&lon=${geoRes.data[0].lon}`
      }
    } catch {
      // Fallback to name search
    }

    return `q=${encodeURIComponent(destinationName)}`
  }

  /**
   * Returns a per-day forecast (up to 5 days — the free tier's limit),
   * pre-aggregated from the raw 3-hour steps into the shape
   * weatherNormalizer.js expects: { date, tempMin, tempMax, condition, description, icon, pop }.
   */
  async getForecast(destinationName) {
    if (!this.isConfigured()) return { ok: false, error: 'Weather API key not configured', errorType: 'not_configured', data: null }
    const locParam = await this.resolveLocationParams(destinationName)
    const url = `${FORECAST_URL}?${locParam}&units=metric&appid=${env.providers.weatherApiKey}`
    const result = await this.request(url)
    if (!result.ok || !Array.isArray(result.data?.list)) {
      return { ok: false, error: result.error || 'No forecast data returned', errorType: result.errorType || 'malformed', data: null }
    }

    const byDate = new Map()
    for (const step of result.data.list) {
      const date = step.dt_txt?.slice(0, 10)
      if (!date) continue
      const entry = byDate.get(date) || { tempMin: Infinity, tempMax: -Infinity, pop: 0, condition: null, description: '', icon: null }
      entry.tempMin = Math.min(entry.tempMin, step.main?.temp_min ?? step.main?.temp ?? entry.tempMin)
      entry.tempMax = Math.max(entry.tempMax, step.main?.temp_max ?? step.main?.temp ?? entry.tempMax)
      entry.pop = Math.max(entry.pop, step.pop ?? 0)
      // Prefer the midday reading for the representative condition/icon.
      if (step.dt_txt?.includes('12:00:00') || !entry.condition) {
        entry.condition = step.weather?.[0]?.main || entry.condition
        entry.description = step.weather?.[0]?.description || entry.description
        entry.icon = step.weather?.[0]?.icon || entry.icon
      }
      byDate.set(date, entry)
    }

    const days = Array.from(byDate.entries()).map(([date, entry]) => ({ date, ...entry }))
    return { ok: true, error: null, data: days }
  }

  /**
   * Current conditions for a destination name. Docs: /data/2.5/weather.
   * Returns the raw OpenWeatherMap payload — weatherNormalizer.js maps it
   * to AtlasAI's canonical shape.
   */
  async getCurrentWeather(destinationName) {
    if (!this.isConfigured()) return { ok: false, error: 'Weather API key not configured', errorType: 'not_configured', data: null }
    const locParam = await this.resolveLocationParams(destinationName)
    const url = `${CURRENT_URL}?${locParam}&units=metric&appid=${env.providers.weatherApiKey}`
    const result = await this.request(url)
    if (!result.ok || result.data == null) {
      return { ok: false, error: result.error || 'No current-weather data returned', errorType: result.errorType || 'malformed', data: null }
    }
    return { ok: true, error: null, data: result.data }
  }
}

export const openWeatherMapProvider = new OpenWeatherMapProvider()
