import { db } from './support/setup.js'
import test, { before, after, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { createApp } from '../src/app.js'
import { trainsService } from '../src/services/trainsService.js'
import { env } from '../src/config/env.js'
import { installRailRadarMock, json } from './support/railRadarFixtures.js'

let server, base, token, mock
const FUTURE_DATE = '2099-06-15'

before(async () => {
  server = createApp().listen(0)
  await new Promise((r) => server.once('listening', r))
  base = `http://127.0.0.1:${server.address().port}/api`
  const res = await fetch(`${base}/auth/register`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: 'trains-tester', email: 'trains@example.com', password: 'password123' }) })
  token = (await res.json()).token
})
after(() => server.close())
beforeEach(() => {
  db.exec('DELETE FROM provider_cache')
  trainsService._resetForTests()
  env.providers.trainsApiKey = ''
})
afterEach(() => mock?.restore())

const get = (path, auth = true) => fetch(`${base}${path}`, { headers: auth ? { authorization: `Bearer ${token}` } : {} })
const validQuery = `?destination=Jaipur&origin=Delhi&date=${FUTURE_DATE}`

test('GET /api/trains/search requires auth', async () => {
  const res = await get(`/trains/search${validQuery}`, false)
  assert.equal(res.status, 401)
})

test('GET /api/trains/search validates required fields and date format', async () => {
  assert.equal((await get('/trains/search')).status, 400)
  assert.equal((await get('/trains/search?destination=Jaipur&date=15-06-2099')).status, 400)
})

test('GET /api/trains/search: no RailRadar key configured returns a graceful sample payload, not an error', async () => {
  const res = await get(`/trains/search${validQuery}`)
  assert.equal(res.status, 200)
  const body = await res.json()
  assert.equal(body.dataSource, 'sample')
  assert.equal(body.fallbackReason, 'not_configured')
})

test('GET /api/trains/search: with a configured provider returns live normalized trains, no key/URL leak', async () => {
  env.providers.trainsApiKey = 'test-key'
  mock = installRailRadarMock()
  const res = await get(`/trains/search${validQuery}`)
  assert.equal(res.status, 200)
  const body = await res.json()
  assert.equal(body.dataSource, 'live')
  assert.equal(body.trains[0].bookingUrl, null)
  assert.equal(body.trains[0].price, null, 'search results never carry a fabricated fare')
  const raw = JSON.stringify(body)
  assert.ok(!raw.includes('test-key'), 'RailRadar credential must never reach the client')
  assert.ok(!raw.includes('api.railradar.in'), 'provider URL must never reach the client')
})

test('GET /api/trains/search: upstream provider errors are sanitized, never forwarded raw', async () => {
  env.providers.trainsApiKey = 'test-key'
  mock = installRailRadarMock({ between: () => json({ error: { message: 'secret upstream detail' } }, 500) })
  const res = await get(`/trains/search${validQuery}`)
  const body = await res.json()
  assert.equal(body.dataSource, 'sample')
  assert.ok(!JSON.stringify(body).includes('secret upstream detail'))
})

test('GET /api/trains/:number/status returns unavailable (never fabricated) without credentials', async () => {
  const res = await get('/trains/12958/status')
  assert.equal(res.status, 200)
  const body = await res.json()
  assert.equal(body.dataSource, 'unavailable')
  assert.equal(body.status, null)
})

test('GET /api/trains/:number/status returns live status when configured', async () => {
  env.providers.trainsApiKey = 'test-key'
  mock = installRailRadarMock()
  const res = await get(`/trains/12958/status?date=${FUTURE_DATE}`)
  const body = await res.json()
  assert.equal(body.dataSource, 'live')
  assert.equal(body.status.trainNumber, '12958')
})

test('GET /api/trains/:number/fare requires source/destination/journeyDate/classCode', async () => {
  env.providers.trainsApiKey = 'test-key'
  mock = installRailRadarMock()
  assert.equal((await get('/trains/12958/fare')).status, 400)
  const res = await get(`/trains/12958/fare?source=NDLS&destination=JP&journeyDate=${FUTURE_DATE}&classCode=3A`)
  const body = await res.json()
  assert.equal(body.dataSource, 'live')
  assert.equal(body.fare.totalFare, 875)
})

test('GET /api/trains/:number/seats requires source/destination/journeyDate/classCode', async () => {
  env.providers.trainsApiKey = 'test-key'
  mock = installRailRadarMock()
  const res = await get(`/trains/12958/seats?source=NDLS&destination=JP&journeyDate=${FUTURE_DATE}&classCode=3A`)
  const body = await res.json()
  assert.equal(body.dataSource, 'live')
  assert.ok(Array.isArray(body.availability.days))
})
