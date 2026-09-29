// Response shapes modelled on OpenWeatherMap's documented free-tier
// endpoints (https://openweathermap.org/current,
// https://openweathermap.org/forecast5). Hand-written fixtures: values are
// illustrative, not real provider data.

export function currentOk({ tempC = 18, feelsLikeC = 17, condition = 'Clouds', description = 'scattered clouds', humidity = 55, windSpeedMs = 3.1, visibility = 10000, dt = 1760086200 } = {}) {
  return {
    weather: [{ main: condition, description, icon: '03d' }],
    main: { temp: tempC, feels_like: feelsLikeC, humidity },
    wind: { speed: windSpeedMs },
    visibility,
    dt,
  }
}

export function forecastOk({ startUnix = 1760054400 } = {}) {
  // Two 3-hour slots on the same UTC date, so weatherNormalizer.js's
  // day-bucketing logic has more than one entry to fold together.
  const list = [
    { dt: startUnix, dt_txt: new Date(startUnix * 1000).toISOString().replace('T', ' ').slice(0, 19), main: { temp_min: 12, temp_max: 16 }, weather: [{ main: 'Clear', description: 'clear sky', icon: '01d' }], pop: 0.1 },
    { dt: startUnix + 10800, dt_txt: new Date((startUnix + 10800) * 1000).toISOString().replace('T', ' ').slice(0, 19), main: { temp_min: 18, temp_max: 22 }, weather: [{ main: 'Clouds', description: 'few clouds', icon: '02d' }], pop: 0.3 },
  ]
  return { list }
}

export function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}

/**
 * Installs a global fetch mock that answers OpenWeatherMap
 * (api.openweathermap.org) URLs from fixtures. Returns { calls, restore }.
 * `handlers` may override { current, forecast } to test failure paths.
 */
export function installOwmMock(handlers = {}) {
  const realFetch = globalThis.fetch
  const calls = { current: 0, forecast: 0, urls: [] }
  globalThis.fetch = async (input, init) => {
    const url = new URL(typeof input === 'string' ? input : input.url)
    if (url.hostname !== 'api.openweathermap.org') return realFetch(input, init)
    calls.urls.push(url.toString())

    if (url.pathname === '/data/2.5/weather') {
      calls.current++
      return (handlers.current || (() => json(currentOk())))(url)
    }
    if (url.pathname === '/data/2.5/forecast') {
      calls.forecast++
      return (handlers.forecast || (() => json(forecastOk())))(url)
    }
    return realFetch(input, init)
  }
  return { calls, restore: () => { globalThis.fetch = realFetch } }
}
