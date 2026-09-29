import { db } from './support/setup.js'
import test, { before, after, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { createApp } from '../src/app.js'
import { flightsService } from '../src/services/flightsService.js'
import { amadeusProvider } from '../src/providers/amadeusProvider.js'
import { env } from '../src/config/env.js'
import { installAmadeusMock, json, flightOffersOk } from './support/amadeusFixtures.js'

let server, base, token, mock
const FUTURE_DATE = '2099-06-15'

before(async () => {
  server = createApp().listen(0)
  await new Promise((r) => server.once('listening', r))
  base = `http://127.0.0.1:${server.address().port}/api`
  const res = await fetch(`${base}/auth/register`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: 'flights-tester', email: 'flights@example.com', password: 'password123' }) })
  token = (await res.json()).token
})
after(() => server.close())
beforeEach(() => {
  db.exec('DELETE FROM provider_cache')
  flightsService._resetForTests()
  amadeusProvider._resetForTests()
  env.providers.amadeusApiKey = ''
  env.providers.amadeusApiSecret = ''
})
afterEach(() => mock?.restore())

const get = (path, auth = true) => fetch(`${base}${path}`, { headers: auth ? { authorization: `Bearer ${token}` } : {} })
const validQuery = `?destination=Goa&departureDate=${FUTURE_DATE}`

test('GET /api/flights/search requires auth', async () => {
  const res = await get(`/flights/search${validQuery}`, false)
  assert.equal(res.status, 401)
})

test('GET /api/flights/search validates required fields and date format', async () => {
  assert.equal((await get('/flights/search')).status, 400)
  assert.equal((await get('/flights/search?destination=Goa')).status, 400)
  assert.equal((await get('/flights/search?destination=Goa&departureDate=15-06-2099')).status, 400)
  assert.equal((await get(`/flights/search?destination=Goa&departureDate=${FUTURE_DATE}&travelClass=NOPE`)).status, 400)
})

test('GET /api/flights/search: no Amadeus key configured returns a graceful sample payload, not an error', async () => {
  const res = await get(`/flights/search${validQuery}`)
  assert.equal(res.status, 200)
  const body = await res.json()
  assert.equal(body.dataSource, 'sample')
  assert.equal(body.fallbackReason, 'not_configured')
  assert.ok(body.flights.length > 0)
})

test('GET /api/flights/search: with a configured provider returns live normalized flights, no key/URL leak', async () => {
  env.providers.amadeusApiKey = 'test-key'
  env.providers.amadeusApiSecret = 'test-secret'
  mock = installAmadeusMock({ flights: () => json({ data: flightOffersOk({ price: '4700.00' }) }) })
  const res = await get(`/flights/search${validQuery}`)
  assert.equal(res.status, 200)
  const body = await res.json()
  assert.equal(body.dataSource, 'live')
  assert.equal(body.flights[0].price, 4700)
  assert.equal(body.flights[0].bookingUrl, null)
  const raw = JSON.stringify(body)
  assert.ok(!raw.includes('test-key') && !raw.includes('test-secret'), 'Amadeus credentials must never reach the client')
  assert.ok(!raw.includes('test.api.amadeus.com'), 'provider URL must never reach the client')
})

test('GET /api/flights/search: a second identical request is served from cache', async () => {
  env.providers.amadeusApiKey = 'test-key'
  env.providers.amadeusApiSecret = 'test-secret'
  mock = installAmadeusMock()
  await get(`/flights/search${validQuery}`)
  const res = await get(`/flights/search${validQuery}`)
  const body = await res.json()
  assert.equal(body.dataSource, 'live')
  assert.equal(mock.calls.flights, 1)
})

test('GET /api/flights/search: upstream provider errors are sanitized, never forwarded raw', async () => {
  env.providers.amadeusApiKey = 'test-key'
  env.providers.amadeusApiSecret = 'test-secret'
  mock = installAmadeusMock({ flights: () => json({ error: { message: 'secret upstream detail' } }, 500) })
  const res = await get(`/flights/search${validQuery}`)
  const body = await res.json()
  assert.equal(body.dataSource, 'sample')
  assert.ok(!JSON.stringify(body).includes('secret upstream detail'))
})

test('GET /api/flights/search: supports an optional round-trip returnDate', async () => {
  env.providers.amadeusApiKey = 'test-key'
  env.providers.amadeusApiSecret = 'test-secret'
  mock = installAmadeusMock({ flights: () => json({ data: flightOffersOk({ returnLeg: { departureAt: '2099-06-20T10:00:00', arrivalAt: '2099-06-20T12:00:00' } }) }) })
  const res = await get(`/flights/search${validQuery}&returnDate=2099-06-20`)
  const body = await res.json()
  assert.equal(body.flights[0].tripType, 'round-trip')
  assert.equal(body.returnDate, '2099-06-20')
})
