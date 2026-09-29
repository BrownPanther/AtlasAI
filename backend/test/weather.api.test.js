import { db } from './support/setup.js'
import test, { before, after, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { createApp } from '../src/app.js'
import { weatherService } from '../src/services/weatherService.js'
import { env } from '../src/config/env.js'
import { installOwmMock, json } from './support/owmFixtures.js'

let server, base, token, mock

before(async () => {
  server = createApp().listen(0)
  await new Promise((r) => server.once('listening', r))
  base = `http://127.0.0.1:${server.address().port}/api`
  const res = await fetch(`${base}/auth/register`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: 'weather-tester', email: 'weather@example.com', password: 'password123' }) })
  token = (await res.json()).token
})
after(() => server.close())
beforeEach(() => {
  db.exec('DELETE FROM provider_cache')
  weatherService._resetForTests()
  env.providers.weatherApiKey = ''
})
afterEach(() => mock?.restore())

const get = (path, auth = true) => fetch(`${base}${path}`, { headers: auth ? { authorization: `Bearer ${token}` } : {} })

test('GET /api/weather/current requires auth and a destination', async () => {
  assert.equal((await get('/weather/current?destination=Manali', false)).status, 401)
  assert.equal((await get('/weather/current')).status, 400)
})

test('GET /api/weather/current: no key configured returns unavailable with a 200 — never fabricated', async () => {
  const res = await get('/weather/current?destination=Manali')
  assert.equal(res.status, 200)
  const body = await res.json()
  assert.equal(body.dataSource, 'unavailable')
  assert.equal(body.current, null)
  assert.equal(body.fallbackReason, 'not_configured')
})

test('GET /api/weather/current: configured provider returns live normalized weather, no key leak', async () => {
  env.providers.weatherApiKey = 'test-weather-key'
  mock = installOwmMock()
  const res = await get('/weather/current?destination=Manali')
  const body = await res.json()
  assert.equal(body.dataSource, 'live')
  assert.equal(body.current.tempC, 18)
  const raw = JSON.stringify(body)
  assert.ok(!raw.includes('test-weather-key') && !raw.includes('api.openweathermap.org'))
})

test('GET /api/weather/forecast: returns normalized forecast days when configured', async () => {
  env.providers.weatherApiKey = 'test-weather-key'
  mock = installOwmMock()
  const res = await get('/weather/forecast?destination=Manali')
  const body = await res.json()
  assert.equal(body.dataSource, 'live')
  assert.ok(body.count >= 1)
})

test('GET /api/weather/*: upstream errors are sanitized and degrade to unavailable', async () => {
  env.providers.weatherApiKey = 'test-weather-key'
  mock = installOwmMock({ current: () => json({ message: 'secret upstream detail' }, 500) })
  const body = await (await get('/weather/current?destination=Manali')).json()
  assert.equal(body.dataSource, 'unavailable')
  assert.ok(!JSON.stringify(body).includes('secret upstream detail'))
})

test('GET /api/weather/current: a second identical request is served from cache', async () => {
  env.providers.weatherApiKey = 'test-weather-key'
  mock = installOwmMock()
  await get('/weather/current?destination=Manali')
  const body = await (await get('/weather/current?destination=Manali')).json()
  assert.equal(body.dataSource, 'live')
  assert.equal(mock.calls.current, 1)
})
