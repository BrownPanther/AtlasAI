import { db } from './support/setup.js'
import test, { beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { hotelsService } from '../src/services/hotelsService.js'
import { amadeusProvider } from '../src/providers/amadeusProvider.js'
import { env } from '../src/config/env.js'
import { installAmadeusMock, json } from './support/amadeusFixtures.js'

let mock

beforeEach(() => {
  db.exec('DELETE FROM provider_cache')
  hotelsService._resetForTests()
  amadeusProvider._resetForTests()
  env.providers.amadeusApiKey = ''
  env.providers.amadeusApiSecret = ''
})
afterEach(() => mock?.restore())

test('hotels: with no credentials configured, falls back to sample data without any network call', async () => {
  const result = await hotelsService.getHotels('Manali')
  assert.equal(result.dataSource, 'sample')
  assert.equal(result.fallbackReason, 'not_configured')
  assert.ok(result.hotels.length > 0)
  assert.ok(result.hotels.every((h) => h.dataSource === 'sample'))
})

test('hotels: an unknown destination with no credentials still gets generated sample hotels', async () => {
  const result = await hotelsService.getHotels('Some Unlisted Town')
  assert.equal(result.dataSource, 'sample')
  assert.ok(result.hotels.length > 0)
})

test('hotels: a known destination resolves its city code for free (no city-search call)', async () => {
  env.providers.amadeusApiKey = 'key'
  env.providers.amadeusApiSecret = 'secret'
  mock = installAmadeusMock()
  const result = await hotelsService.getHotels('Goa')
  assert.equal(result.dataSource, 'live')
  assert.equal(result.provider, 'amadeus')
  assert.equal(mock.calls.cities, 0, 'known destinations must not hit the city-search endpoint')
  assert.equal(mock.calls.byCity, 1)
  assert.equal(mock.calls.offers, 1)
  assert.ok(result.hotels[0].liveAvailability === false, 'test-environment data must never claim live availability')
})

test('hotels: an unlisted destination resolves via Amadeus city search', async () => {
  env.providers.amadeusApiKey = 'key'
  env.providers.amadeusApiSecret = 'secret'
  mock = installAmadeusMock()
  const result = await hotelsService.getHotels('Lisbon')
  assert.equal(result.dataSource, 'live')
  assert.equal(mock.calls.cities, 1)
})

test('hotels: a second identical request is served from cache, not the provider', async () => {
  env.providers.amadeusApiKey = 'key'
  env.providers.amadeusApiSecret = 'secret'
  mock = installAmadeusMock()
  await hotelsService.getHotels('Goa')
  const second = await hotelsService.getHotels('Goa')
  assert.equal(second.dataSource, 'live')
  assert.equal(mock.calls.byCity, 1, 'second call must be served from cache')
  assert.equal(mock.calls.offers, 1, 'second call must be served from cache')
})

test('hotels: city search with no results falls back to sample honestly', async () => {
  env.providers.amadeusApiKey = 'key'
  env.providers.amadeusApiSecret = 'secret'
  mock = installAmadeusMock({ cities: () => json({ data: [] }) })
  const result = await hotelsService.getHotels('Nowhereville')
  assert.equal(result.dataSource, 'sample')
  assert.equal(result.fallbackReason, 'no_results')
})

test('hotels: an auth failure trips the circuit breaker so subsequent calls skip the provider', async () => {
  env.providers.amadeusApiKey = 'key'
  env.providers.amadeusApiSecret = 'secret'
  mock = installAmadeusMock({ token: () => json({ error: 'invalid_client' }, 401) })
  const first = await hotelsService.getHotels('Goa')
  assert.equal(first.dataSource, 'sample')
  assert.equal(mock.calls.token, 1)

  const second = await hotelsService.getHotels('Goa')
  assert.equal(second.dataSource, 'sample')
  assert.equal(mock.calls.token, 1, 'breaker must skip the provider on the second call')
})

test('hotels: provider failure after a live success serves the stale cached hotels', async () => {
  env.providers.amadeusApiKey = 'key'
  env.providers.amadeusApiSecret = 'secret'
  mock = installAmadeusMock()
  const first = await hotelsService.getHotels('Goa')
  assert.equal(first.dataSource, 'live')

  db.exec("UPDATE provider_cache SET expires_at = datetime('now', '-1 day')")
  mock.restore()
  mock = installAmadeusMock({ byCity: () => json({}, 500) })

  const second = await hotelsService.getHotels('Goa')
  assert.equal(second.dataSource, 'cached')
  assert.equal(second.stale, true)
  assert.equal(second.hotels[0].name, first.hotels[0].name, 'stale value is the last good answer, not fabricated')
})

test('hotels: a malformed offers response never gets cached or presented as live', async () => {
  env.providers.amadeusApiKey = 'key'
  env.providers.amadeusApiSecret = 'secret'
  mock = installAmadeusMock({ offers: () => json({ data: [{ nothingUseful: true }] }) })
  const result = await hotelsService.getHotels('Goa')
  assert.equal(result.dataSource, 'sample')
})

test('hotels: a hotel with no offer/price is never fabricated a price', async () => {
  env.providers.amadeusApiKey = 'key'
  env.providers.amadeusApiSecret = 'secret'
  mock = installAmadeusMock({ offers: () => json({ data: [{ hotel: { hotelId: 'X1', name: 'No Offer Inn' }, offers: [] }] }) })
  const result = await hotelsService.getHotels('Goa')
  assert.equal(result.dataSource, 'live')
  assert.equal(result.hotels[0].pricePerNight, null)
})
