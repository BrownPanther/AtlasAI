import { db } from './support/setup.js'
import test, { beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { mapsService } from '../src/services/mapsService.js'
import { env } from '../src/config/env.js'
import { installOpenRouteServiceMock, directionsOk, json } from './support/orsFixtures.js'

let mock
const A = { lat: 32.25, lng: 77.18 }
const B = { lat: 32.31, lng: 77.15 }

beforeEach(() => {
  db.exec('DELETE FROM provider_cache')
  mapsService._resetForTests()
  env.providers.mapsApiKey = ''
})
afterEach(() => mock?.restore())

test('maps: with no key configured, returns unavailable without any network call', async () => {
  const route = await mapsService.getRoute(A, B, 'driving')
  assert.equal(route.dataSource, 'unavailable')
  assert.equal(route.fallbackReason, 'not_configured')
  assert.equal(route.distanceKm, null)
  assert.equal(route.durationMinutes, null)
})

test('maps: invalid coordinates never reach the provider', async () => {
  env.providers.mapsApiKey = 'test-key'
  mock = installOpenRouteServiceMock()
  const route = await mapsService.getRoute({ lat: 'x', lng: null }, B, 'driving')
  assert.equal(route.dataSource, 'unavailable')
  assert.equal(route.fallbackReason, 'invalid_coordinates')
  assert.equal(mock.calls.directions, 0)
})

test('maps: a configured provider returns a live, normalized route', async () => {
  env.providers.mapsApiKey = 'test-key'
  mock = installOpenRouteServiceMock(() => json(directionsOk({ distanceMeters: 3200, durationSeconds: 780 })))
  const route = await mapsService.getRoute(A, B, 'driving')
  assert.equal(route.dataSource, 'live')
  assert.equal(route.provider, 'openrouteservice')
  assert.equal(route.distanceKm, 3.2)
  assert.equal(route.durationMinutes, 13)
  assert.equal(route.cached, false)
  assert.equal(mock.calls.directions, 1)
})

test('maps: a second identical request is served from cache, not the provider', async () => {
  env.providers.mapsApiKey = 'test-key'
  mock = installOpenRouteServiceMock()
  await mapsService.getRoute(A, B, 'driving')
  const second = await mapsService.getRoute(A, B, 'driving')
  assert.equal(second.dataSource, 'live')
  assert.equal(second.cached, true)
  assert.equal(mock.calls.directions, 1, 'second call must be served from cache')
})

test('maps: an unsupported mode is refused rather than approximated', async () => {
  env.providers.mapsApiKey = 'test-key'
  mock = installOpenRouteServiceMock()
  const route = await mapsService.getRoute(A, B, 'bus')
  assert.equal(route.dataSource, 'unavailable')
  assert.equal(route.fallbackReason, 'unsupported_mode')
  assert.equal(mock.calls.directions, 0)
})

test('maps: provider failure with no prior cache returns a clear unavailable state', async () => {
  env.providers.mapsApiKey = 'test-key'
  mock = installOpenRouteServiceMock(() => json({ error: { message: 'upstream boom' } }, 500))
  const route = await mapsService.getRoute(A, B, 'driving')
  assert.equal(route.dataSource, 'unavailable')
  assert.equal(route.fallbackReason, 'provider_unavailable')
  assert.equal(route.distanceKm, null)
})

test('maps: after a live success, a later provider failure serves the stale cached route', async () => {
  env.providers.mapsApiKey = 'test-key'
  mock = installOpenRouteServiceMock()
  const first = await mapsService.getRoute(A, B, 'driving')
  assert.equal(first.dataSource, 'live')

  // Expire the cache entry directly so the next call must hit the provider again.
  db.exec("UPDATE provider_cache SET expires_at = datetime('now', '-1 day')")
  mock.restore()
  mock = installOpenRouteServiceMock(() => json({}, 500))

  const second = await mapsService.getRoute(A, B, 'driving')
  assert.equal(second.dataSource, 'cached')
  assert.equal(second.stale, true)
  assert.equal(second.distanceKm, 3.2, 'stale value is the last good answer, not fabricated')
})

test('maps: an auth failure trips the circuit breaker so subsequent calls skip the provider', async () => {
  env.providers.mapsApiKey = 'test-key'
  mock = installOpenRouteServiceMock(() => json({ error: 'bad key' }, 401))
  await mapsService.getRoute(A, B, 'driving')
  assert.equal(mock.calls.directions, 1)

  const second = await mapsService.getRoute(A, B, 'driving')
  assert.equal(second.dataSource, 'unavailable')
  assert.equal(second.fallbackReason, 'provider_unavailable')
  assert.equal(mock.calls.directions, 1, 'breaker must skip the provider on the second call')
})

test('maps: a malformed provider response never gets cached or presented as live', async () => {
  env.providers.mapsApiKey = 'test-key'
  mock = installOpenRouteServiceMock(() => json({ features: [] }))
  const route = await mapsService.getRoute(A, B, 'driving')
  assert.equal(route.dataSource, 'unavailable')
  assert.equal(route.fallbackReason, 'malformed')
})
