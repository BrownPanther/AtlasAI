import { db } from './support/setup.js'
import test, { beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { attractionsService, getDestinationOverride } from '../src/services/attractionsService.js'
import { env } from '../src/config/env.js'
import { installOpenTripMapMock } from './support/otmFixtures.js'

let mock
const KEY = env.providers.attractionsApiKey

beforeEach(() => {
  db.exec('DELETE FROM provider_cache')
  attractionsService._resetForTests()
  env.providers.attractionsApiKey = KEY
})
afterEach(() => mock?.restore())

test('getDestinationOverride returns exact coordinates for Manali', () => {
  const override = getDestinationOverride('Manali')
  assert.ok(override)
  assert.equal(override.lat, 32.2396)
  assert.equal(override.lon, 77.1887)
})

test('known destinations completely bypass geocode API', async () => {
  mock = installOpenTripMapMock()
  await attractionsService.getAttractions('Manali', { allowGeneratedSample: false })
  assert.equal(mock.calls.geoname, 0, 'geoname should have been bypassed')
  assert.equal(mock.calls.radius, 1, 'radius search should still happen')
})
