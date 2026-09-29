import { db } from './support/setup.js'
import test, { beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { flightsService } from '../src/services/flightsService.js'
import { amadeusProvider } from '../src/providers/amadeusProvider.js'
import { env } from '../src/config/env.js'
import { installAmadeusMock, json, flightOffersOk } from './support/amadeusFixtures.js'

let mock
const FUTURE_DATE = '2099-06-15'
const FUTURE_RETURN = '2099-06-20'

beforeEach(() => {
  db.exec('DELETE FROM provider_cache')
  flightsService._resetForTests()
  amadeusProvider._resetForTests()
  env.providers.amadeusApiKey = ''
  env.providers.amadeusApiSecret = ''
})
afterEach(() => mock?.restore())

test('flights: with no credentials configured, falls back to sample data without any network call', async () => {
  const result = await flightsService.getFlights('Delhi', 'Manali', FUTURE_DATE)
  assert.equal(result.dataSource, 'sample')
  assert.equal(result.fallbackReason, 'not_configured')
  assert.ok(result.flights.length > 0)
  assert.ok(result.flights.every((f) => f.dataSource === 'sample'))
})

test('flights: a missing/invalid departure date falls back to sample honestly, never calling the provider', async () => {
  env.providers.amadeusApiKey = 'key'
  env.providers.amadeusApiSecret = 'secret'
  mock = installAmadeusMock()
  const missing = await flightsService.getFlights('Delhi', 'Manali', null)
  assert.equal(missing.dataSource, 'sample')
  assert.equal(missing.fallbackReason, 'invalid_date')
  const malformed = await flightsService.getFlights('Delhi', 'Manali', '15-06-2099')
  assert.equal(malformed.dataSource, 'sample')
  assert.equal(malformed.fallbackReason, 'invalid_date')
  const past = await flightsService.getFlights('Delhi', 'Manali', '2020-01-01')
  assert.equal(past.dataSource, 'sample')
  assert.equal(mock.calls.flights, 0, 'the provider must never be called for an invalid date')
})

test('flights: an unknown destination with no credentials still gets generated sample flights', async () => {
  const result = await flightsService.getFlights('Delhi', 'Some Unlisted Town', FUTURE_DATE)
  assert.equal(result.dataSource, 'sample')
  assert.ok(result.flights.length > 0)
})

test('flights: known origin/destination cities resolve to IATA codes for free (no city-search call)', async () => {
  env.providers.amadeusApiKey = 'key'
  env.providers.amadeusApiSecret = 'secret'
  mock = installAmadeusMock()
  const result = await flightsService.getFlights('Delhi', 'Goa', FUTURE_DATE)
  assert.equal(result.dataSource, 'live')
  assert.equal(result.provider, 'amadeus')
  assert.equal(mock.calls.cities, 0, 'known cities must not hit the city-search endpoint')
  assert.equal(mock.calls.flights, 1)
  assert.equal(result.flights[0].bookingUrl, null, 'test-environment data must never claim a bookable fare')
  assert.equal(result.flights[0].status, null)
})

test('flights: a destination already given as a 3-letter IATA code is used as-is', async () => {
  env.providers.amadeusApiKey = 'key'
  env.providers.amadeusApiSecret = 'secret'
  mock = installAmadeusMock()
  const result = await flightsService.getFlights('DEL', 'GOI', FUTURE_DATE)
  assert.equal(result.dataSource, 'live')
  assert.equal(mock.calls.cities, 0)
})

test('flights: an unlisted city resolves via Amadeus city search', async () => {
  env.providers.amadeusApiKey = 'key'
  env.providers.amadeusApiSecret = 'secret'
  mock = installAmadeusMock()
  const result = await flightsService.getFlights('Delhi', 'Lisbon', FUTURE_DATE)
  assert.equal(result.dataSource, 'live')
  assert.equal(mock.calls.cities, 1)
})

test('flights: a second identical request is served from cache, not the provider', async () => {
  env.providers.amadeusApiKey = 'key'
  env.providers.amadeusApiSecret = 'secret'
  mock = installAmadeusMock()
  await flightsService.getFlights('Delhi', 'Goa', FUTURE_DATE)
  const second = await flightsService.getFlights('Delhi', 'Goa', FUTURE_DATE)
  assert.equal(second.dataSource, 'live')
  assert.equal(mock.calls.flights, 1, 'second call must be served from cache')
})

test('flights: a different departure date is a cache miss (not confused with an earlier search)', async () => {
  env.providers.amadeusApiKey = 'key'
  env.providers.amadeusApiSecret = 'secret'
  mock = installAmadeusMock()
  await flightsService.getFlights('Delhi', 'Goa', FUTURE_DATE)
  await flightsService.getFlights('Delhi', 'Goa', '2099-07-01')
  assert.equal(mock.calls.flights, 2)
})

test('flights: round-trip search (returnDate given) is a genuine provider round trip, not two combined one-ways', async () => {
  env.providers.amadeusApiKey = 'key'
  env.providers.amadeusApiSecret = 'secret'
  mock = installAmadeusMock({
    flights: (url) => {
      assert.equal(url.searchParams.get('returnDate'), FUTURE_RETURN)
      return json({ data: flightOffersOk({ returnLeg: { departureAt: '2099-06-20T10:00:00', arrivalAt: '2099-06-20T12:30:00' } }) })
    },
  })
  const result = await flightsService.getFlights('Delhi', 'Goa', FUTURE_DATE, { returnDate: FUTURE_RETURN })
  assert.equal(result.dataSource, 'live')
  assert.equal(result.flights[0].tripType, 'round-trip')
  assert.equal(result.flights[0].returnDeparture, '10:00')
  assert.equal(mock.calls.flights, 1)
})

test('flights: a return date before the departure date is rejected without calling the provider', async () => {
  env.providers.amadeusApiKey = 'key'
  env.providers.amadeusApiSecret = 'secret'
  mock = installAmadeusMock()
  const result = await flightsService.getFlights('Delhi', 'Goa', FUTURE_DATE, { returnDate: '2099-01-01' })
  assert.equal(result.dataSource, 'sample')
  assert.equal(mock.calls.flights, 0)
})

test('flights: city search with no results falls back to sample honestly', async () => {
  env.providers.amadeusApiKey = 'key'
  env.providers.amadeusApiSecret = 'secret'
  mock = installAmadeusMock({ cities: () => json({ data: [] }) })
  const result = await flightsService.getFlights('Delhi', 'Nowhereville', FUTURE_DATE)
  assert.equal(result.dataSource, 'sample')
  assert.equal(result.fallbackReason, 'no_results')
})

test('flights: an auth failure trips the circuit breaker so subsequent calls skip the provider', async () => {
  env.providers.amadeusApiKey = 'key'
  env.providers.amadeusApiSecret = 'secret'
  mock = installAmadeusMock({ token: () => json({ error: 'invalid_client' }, 401) })
  const first = await flightsService.getFlights('Delhi', 'Goa', FUTURE_DATE)
  assert.equal(first.dataSource, 'sample')
  assert.equal(mock.calls.token, 1)

  const second = await flightsService.getFlights('Delhi', 'Goa', FUTURE_DATE)
  assert.equal(second.dataSource, 'sample')
  assert.equal(mock.calls.token, 1, 'breaker must skip the provider on the second call')
})

test('flights: a rate-limit response also trips the breaker', async () => {
  env.providers.amadeusApiKey = 'key'
  env.providers.amadeusApiSecret = 'secret'
  mock = installAmadeusMock({ flights: () => json({}, 429) })
  const first = await flightsService.getFlights('Delhi', 'Goa', FUTURE_DATE)
  assert.equal(first.dataSource, 'sample')
  assert.equal(first.fallbackReason, 'rate_limited')
  await flightsService.getFlights('Delhi', 'Goa', FUTURE_DATE)
  assert.equal(mock.calls.flights, 1, 'breaker must skip the provider on the second call')
})

test('flights: provider failure after a live success serves the stale cached flights', async () => {
  env.providers.amadeusApiKey = 'key'
  env.providers.amadeusApiSecret = 'secret'
  mock = installAmadeusMock()
  const first = await flightsService.getFlights('Delhi', 'Goa', FUTURE_DATE)
  assert.equal(first.dataSource, 'live')

  db.exec("UPDATE provider_cache SET expires_at = datetime('now', '-1 day')")
  mock.restore()
  mock = installAmadeusMock({ flights: () => json({}, 500) })

  const second = await flightsService.getFlights('Delhi', 'Goa', FUTURE_DATE)
  assert.equal(second.dataSource, 'cached')
  assert.equal(second.stale, true)
  assert.equal(second.flights[0].flightNumber, first.flights[0].flightNumber, 'stale value is the last good answer, not fabricated')
})

test('flights: a malformed offers response never gets cached or presented as live', async () => {
  env.providers.amadeusApiKey = 'key'
  env.providers.amadeusApiSecret = 'secret'
  mock = installAmadeusMock({ flights: () => json({ data: [{ nothingUseful: true }] }) })
  const result = await flightsService.getFlights('Delhi', 'Goa', FUTURE_DATE)
  assert.equal(result.dataSource, 'sample')
})

test('flights: an offer with no price is never fabricated one', async () => {
  env.providers.amadeusApiKey = 'key'
  env.providers.amadeusApiSecret = 'secret'
  mock = installAmadeusMock({
    flights: () => json({ data: flightOffersOk({ price: '' }) }),
  })
  const result = await flightsService.getFlights('Delhi', 'Goa', FUTURE_DATE)
  assert.equal(result.dataSource, 'live')
  assert.equal(result.flights[0].price, null)
})
