import { db } from './support/setup.js'
import test, { before, after, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { createApp } from '../src/app.js'
import { mapsService } from '../src/services/mapsService.js'
import { env } from '../src/config/env.js'
import { installOpenRouteServiceMock, directionsOk, json } from './support/orsFixtures.js'

let server, base, token, mock

before(async () => {
  server = createApp().listen(0)
  await new Promise((r) => server.once('listening', r))
  base = `http://127.0.0.1:${server.address().port}/api`
  const res = await fetch(`${base}/auth/register`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: 'router-tester', email: 'router@example.com', password: 'password123' }) })
  token = (await res.json()).token
})
after(() => server.close())
beforeEach(() => { db.exec('DELETE FROM provider_cache'); mapsService._resetForTests(); env.providers.mapsApiKey = '' })
afterEach(() => mock?.restore())

const get = (path, auth = true) => fetch(`${base}${path}`, { headers: auth ? { authorization: `Bearer ${token}` } : {} })
const validQuery = '?fromLat=32.25&fromLng=77.18&toLat=32.31&toLng=77.15'

test('GET /api/routes requires auth', async () => {
  const res = await get(`/routes${validQuery}`, false)
  assert.equal(res.status, 401)
})

test('GET /api/routes validates coordinates and mode', async () => {
  assert.equal((await get('/routes')).status, 400)
  assert.equal((await get('/routes?fromLat=abc&fromLng=77&toLat=32&toLng=77')).status, 400)
  assert.equal((await get('/routes?fromLat=999&fromLng=77&toLat=32&toLng=77')).status, 400)
  assert.equal((await get(`/routes${validQuery}&mode=teleport`)).status, 400)
})

test('GET /api/routes: no maps key configured returns a graceful unavailable payload, not an error', async () => {
  const res = await get(`/routes${validQuery}`)
  assert.equal(res.status, 200)
  const body = await res.json()
  assert.equal(body.dataSource, 'unavailable')
  assert.equal(body.route.fallbackReason, 'not_configured')
})

test('GET /api/routes: with a configured provider returns a live normalized route, no key/URL leak', async () => {
  env.providers.mapsApiKey = 'test-key'
  mock = installOpenRouteServiceMock(() => json(directionsOk({ distanceMeters: 5000, durationSeconds: 900 })))
  const res = await get(`/routes${validQuery}&mode=walking`)
  assert.equal(res.status, 200)
  const body = await res.json()
  assert.equal(body.dataSource, 'live')
  assert.equal(body.route.distanceKm, 5)
  assert.equal(body.route.durationMinutes, 15)
  assert.equal(body.route.mode, 'walking')
  const raw = JSON.stringify(body)
  assert.ok(!raw.includes('test-key'), 'provider API key must never reach the client')
  assert.ok(!raw.includes('openrouteservice.org'), 'provider URL must never reach the client')
})

test('GET /api/routes: a second identical request is served from cache', async () => {
  env.providers.mapsApiKey = 'test-key'
  mock = installOpenRouteServiceMock()
  await get(`/routes${validQuery}`)
  const res = await get(`/routes${validQuery}`)
  const body = await res.json()
  assert.equal(body.dataSource, 'live')
  assert.equal(body.route.cached, true)
  assert.equal(mock.calls.directions, 1)
})

test('GET /api/routes: upstream provider errors are sanitized, never forwarded raw', async () => {
  env.providers.mapsApiKey = 'test-key'
  mock = installOpenRouteServiceMock(() => json({ error: { message: 'secret upstream detail' } }, 500))
  const res = await get(`/routes${validQuery}`)
  const body = await res.json()
  assert.equal(body.dataSource, 'unavailable')
  assert.ok(!JSON.stringify(body).includes('secret upstream detail'))
})
