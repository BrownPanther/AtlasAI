import { db } from './support/setup.js'
import test, { beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { weatherService } from '../src/services/weatherService.js'
import { env } from '../src/config/env.js'
import { installOwmMock, json } from './support/owmFixtures.js'

let mock

beforeEach(() => {
  db.exec('DELETE FROM provider_cache')
  weatherService._resetForTests()
  env.providers.weatherApiKey = ''
})
afterEach(() => mock?.restore())

test('weather: with no credentials configured, current and forecast both report unavailable — never fabricated', async () => {
  const current = await weatherService.fetchCurrent('Manali')
  assert.equal(current.dataSource, 'unavailable')
  assert.equal(current.fallbackReason, 'not_configured')
  assert.equal(current.current, null)

  const forecast = await weatherService.fetchForecast('Manali')
  assert.equal(forecast.dataSource, 'unavailable')
  assert.deepEqual(forecast.days, [])
})

test('weather: current conditions are fetched live and normalized to the canonical shape', async () => {
  env.providers.weatherApiKey = 'key'
  mock = installOwmMock()
  const result = await weatherService.fetchCurrent('Manali')
  assert.equal(result.dataSource, 'live')
  assert.equal(result.provider, 'openweathermap')
  assert.equal(result.current.tempC, 18)
  assert.equal(result.current.condition, 'Clouds')
  assert.ok(result.current.windSpeedKmh > 0, 'wind speed must be converted from m/s to km/h')
  assert.equal(mock.calls.current, 1)
})

test('weather: forecast days are folded from 3-hour slots into one entry per date', async () => {
  env.providers.weatherApiKey = 'key'
  mock = installOwmMock()
  const result = await weatherService.fetchForecast('Manali')
  assert.equal(result.dataSource, 'live')
  assert.equal(result.days.length, 1, 'both fixture slots fall on the same UTC date')
  assert.ok(result.days[0].tempMinC <= result.days[0].tempMaxC)
})

test('weather: a second identical request is served from cache, not the provider', async () => {
  env.providers.weatherApiKey = 'key'
  mock = installOwmMock()
  await weatherService.fetchCurrent('Manali')
  const second = await weatherService.fetchCurrent('Manali')
  assert.equal(second.dataSource, 'live')
  assert.equal(mock.calls.current, 1, 'second call must be served from cache')
})

test('weather: current and forecast caches are independent (fetching one does not warm the other)', async () => {
  env.providers.weatherApiKey = 'key'
  mock = installOwmMock()
  await weatherService.fetchCurrent('Manali')
  await weatherService.fetchForecast('Manali')
  assert.equal(mock.calls.current, 1)
  assert.equal(mock.calls.forecast, 1)
})

test('weather: an auth failure trips the circuit breaker so subsequent calls skip the provider', async () => {
  env.providers.weatherApiKey = 'key'
  mock = installOwmMock({ current: () => json({ message: 'Invalid API key' }, 401) })
  const first = await weatherService.fetchCurrent('Manali')
  assert.equal(first.dataSource, 'unavailable')
  assert.equal(mock.calls.current, 1)

  const second = await weatherService.fetchCurrent('Manali')
  assert.equal(second.dataSource, 'unavailable')
  assert.equal(mock.calls.current, 1, 'breaker must skip the provider on the second call')
})

test('weather: a rate-limit response also trips the breaker', async () => {
  env.providers.weatherApiKey = 'key'
  mock = installOwmMock({ forecast: () => json({}, 429) })
  const first = await weatherService.fetchForecast('Manali')
  assert.equal(first.dataSource, 'unavailable')
  assert.equal(first.fallbackReason, 'rate_limited')
  await weatherService.fetchForecast('Manali')
  assert.equal(mock.calls.forecast, 1, 'breaker must skip the provider on the second call')
})

test('weather: provider failure after a live success serves the stale cached reading, clearly marked', async () => {
  env.providers.weatherApiKey = 'key'
  mock = installOwmMock()
  const first = await weatherService.fetchCurrent('Manali')
  assert.equal(first.dataSource, 'live')

  db.exec("UPDATE provider_cache SET expires_at = datetime('now', '-1 day') WHERE category = 'weather'")
  mock.restore()
  mock = installOwmMock({ current: () => json({}, 500) })

  const second = await weatherService.fetchCurrent('Manali')
  assert.equal(second.dataSource, 'cached')
  assert.equal(second.stale, true)
  assert.equal(second.current.tempC, first.current.tempC, 'stale value is the last good reading, never fabricated')
})

test('weather: a malformed response never gets cached or presented as live', async () => {
  env.providers.weatherApiKey = 'key'
  mock = installOwmMock({ current: () => json({ notWeather: true }) })
  const result = await weatherService.fetchCurrent('Manali')
  assert.equal(result.dataSource, 'unavailable')
})
