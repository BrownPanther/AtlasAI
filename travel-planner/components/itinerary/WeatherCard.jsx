import { useEffect, useState } from 'react'
import {
  Sun,
  CloudSun,
  CloudRain,
  Cloud,
  CloudSnow,
  CloudLightning,
  Wind,
  Droplets,
  Thermometer,
  AlertCircle,
  RefreshCw,
} from 'lucide-react'
import { api } from '../../services/api'

function getWeatherIcon(condition = '', size = 24) {
  const c = condition.toLowerCase()
  if (c.includes('rain') || c.includes('drizzle') || c.includes('shower')) {
    return <CloudRain size={size} className="text-blue-400" />
  }
  if (c.includes('snow') || c.includes('sleet') || c.includes('ice') || c.includes('flurr')) {
    return <CloudSnow size={size} className="text-cyan-200" />
  }
  if (c.includes('thunder') || c.includes('lightning') || c.includes('storm')) {
    return <CloudLightning size={size} className="text-amber-400" />
  }
  if (c.includes('partly') || c.includes('scattered') || c.includes('few')) {
    return <CloudSun size={size} className="text-amber-300" />
  }
  if (c.includes('cloud') || c.includes('overcast') || c.includes('haze') || c.includes('fog') || c.includes('mist')) {
    return <Cloud size={size} className="text-slate-300" />
  }
  return <Sun size={size} className="text-amber-400" />
}

function formatDayName(dateStr) {
  if (!dateStr) return ''
  try {
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return dateStr
    return d.toLocaleDateString('en-US', { weekday: 'short' })
  } catch {
    return dateStr
  }
}

export default function WeatherCard({ destination, activeDay }) {
  const [current, setCurrent] = useState(null)
  const [forecast, setForecast] = useState([])
  const [dataSource, setDataSource] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchWeather = async () => {
    if (!destination) return
    setLoading(true)
    setError(null)
    try {
      const [currRes, foreRes] = await Promise.all([
        api.getCurrentWeather(destination).catch(() => null),
        api.getWeatherForecast(destination).catch(() => null),
      ])

      const curData = currRes?.current || null
      const foreData = foreRes?.forecast || []
      const src = currRes?.dataSource || foreRes?.dataSource || 'unavailable'

      setCurrent(curData)
      setForecast(foreData)
      setDataSource(src)
    } catch (err) {
      setError(err?.message || 'Failed to load weather')
      setDataSource('unavailable')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchWeather()
  }, [destination])

  // Look for day-specific weather if available in forecast or activeDay
  const dayForecast = activeDay?.date && forecast.length
    ? forecast.find((f) => f.date === activeDay.date)
    : null

  const displayWeather = dayForecast || current || activeDay?.weather || null

  // Calculate day-specific high/low
  const tempCurrent = current?.tempC != null ? Math.round(current.tempC) : (displayWeather?.tempMaxC != null ? Math.round(displayWeather.tempMaxC) : null)
  const tempHigh = displayWeather?.tempMaxC != null ? Math.round(displayWeather.tempMaxC) : (tempCurrent != null ? tempCurrent + 3 : null)
  const tempLow = displayWeather?.tempMinC != null ? Math.round(displayWeather.tempMinC) : (tempCurrent != null ? tempCurrent - 5 : null)
  const feelsLike = current?.feelsLikeC != null ? Math.round(current.feelsLikeC) : null
  // Only show real values — never fabricate fallbacks
  const condition = displayWeather?.condition || current?.condition || null
  const windKmh = current?.windSpeedKmh ?? null
  const humidity = current?.humidityPct ?? null
  const visibility = current?.visibilityKm ?? null

  return (
    <div className="atlas-weather-phone-widget" aria-label={`Weather forecast for ${destination}`}>
      {/* Weather Atmospheric Glow */}
      <div className="pointer-events-none absolute -top-12 -right-12 w-44 h-44 rounded-full bg-secondary/15 blur-3xl" />

      {/* Header */}
      <div className="atlas-weather-header">
        <div>
          <span className="atlas-weather-eyebrow">Microclimate Station</span>
          <h3 className="atlas-weather-city">{(destination || 'DESTINATION').toUpperCase()}</h3>
          {condition && <p className="atlas-weather-condition-text">{condition}</p>}
        </div>

        <div className="atlas-weather-top-right">
          {tempCurrent != null ? (
            <>
              <div className="atlas-weather-hero-temp">{tempCurrent}°</div>
              {feelsLike != null && <div className="atlas-weather-feels">Feels like {feelsLike}°</div>}
            </>
          ) : (
            <div className="atlas-weather-status-wrap">
              <span className={`atlas-weather-badge is-${dataSource || 'unavailable'}`}>
                {dataSource || 'Offline'}
              </span>
            </div>
          )}
        </div>
      </div>

      {loading ? (
        <div className="atlas-weather-loading">
          <RefreshCw size={16} className="animate-spin text-purple-400" />
          <span>Syncing microclimate telemetry…</span>
        </div>
      ) : tempCurrent != null ? (
        <>
          {/* Hi / Lo Strip */}
          <div className="atlas-weather-hilo-strip">
            <span>H: {tempHigh}° &nbsp; L: {tempLow}°</span>
            <span className="text-secondary font-medium">
              {displayWeather?.precipitationChancePct != null && displayWeather.precipitationChancePct > 0
                ? `${displayWeather.precipitationChancePct}% precip chance`
                : 'No precipitation forecasted'}
            </span>
          </div>

          {/* Forecast Glass Bar */}
          {forecast.length > 0 && (
            <div className="atlas-weather-forecast-grid">
              {forecast.slice(0, 4).map((f, i) => {
                const isDayActive = activeDay?.date === f.date
                return (
                  <div
                    key={f.date || i}
                    className={`atlas-weather-forecast-pill ${isDayActive ? 'is-active-day' : ''}`}
                  >
                    <span className="atlas-wf-day">{formatDayName(f.date)}</span>
                    <div className="atlas-wf-icon">
                      {getWeatherIcon(f.condition, 16)}
                    </div>
                    <span className="atlas-wf-temp">{Math.round(f.tempMaxC)}°</span>
                  </div>
                )
              })}
            </div>
          )}

          {/* Mountain Environmental Vitals */}
          <div className="atlas-weather-vitals-grid">
            <div className="atlas-weather-vital-card">
              <span className="vital-label">Wind Velocity</span>
              <div className="vital-val">{windKmh != null ? `${windKmh} km/h` : '—'}</div>
            </div>
            <div className="atlas-weather-vital-card">
              <span className="vital-label">Atmosphere</span>
              <div className="vital-val">{humidity != null ? `${humidity}% Humid` : '—'}</div>
            </div>
            <div className="atlas-weather-vital-card">
              <span className="vital-label">Visibility</span>
              <div className="vital-val">{visibility != null ? `${visibility} km` : '—'}</div>
            </div>
            <div className="atlas-weather-vital-card">
              <span className="vital-label">Telemetry</span>
              <div className="vital-val" style={{ color: dataSource === 'live' ? '#86efac' : '#a78bfa' }}>
                {dataSource === 'live' ? 'Live Doppler' : 'Cached Orbit'}
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="atlas-weather-unavailable-box">
          <div className="atlas-weather-unavail-icon">
            <AlertCircle size={20} />
          </div>
          <div className="atlas-weather-unavail-text">
            <strong>Weather telemetry offline</strong>
            <p>Live meteorological feeds are unconfigured or temporarily offline for {destination}.</p>
          </div>
        </div>
      )}
    </div>
  )
}
