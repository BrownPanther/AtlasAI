import { db } from './support/setup.js'
import test, { beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { trainsService } from '../src/services/trainsService.js'
import { env } from '../src/config/env.js'
import { installRailRadarMock, json, trainsBetweenOk } from './support/railRadarFixtures.js'

let mock
const FUTURE_DATE = '2099-06-15'

beforeEach(() => {
  db.exec('DELETE FROM provider_cache')
  trainsService._resetForTests()
  env.providers.trainsApiKey = ''
})
afterEach(() => mock?.restore())

test('trains: with no credentials configured, falls back to sample data without any network call', async () => {
  const result = await trainsService.getTrains('Delhi', 'Jaipur', FUTURE_DATE)
  assert.equal(result.dataSource, 'sample')
  assert.equal(result.fallbackReason, 'not_configured')
})

test('trains: an unknown destination with no credentials still gets generated sample trains (or an empty, honest list)', async () => {
  const result = await trainsService.getTrains('Delhi', 'Some Unlisted Town', FUTURE_DATE)
  assert.equal(result.dataSource, 'sample')
})

test('trains: known origin/destination cities resolve to station codes for free (no station-search call)', async () => {
  env.providers.trainsApiKey = 'key'
  mock = installRailRadarMock()
  const result = await trainsService.getTrains('Delhi', 'Jaipur', FUTURE_DATE)
  assert.equal(result.dataSource, 'live')
  assert.equal(result.provider, 'railradar')
  assert.equal(mock.calls.stations, 0, 'known cities must not hit the station-search endpoint')
  assert.equal(mock.calls.between, 1)
  assert.equal(result.trains[0].bookingUrl, null, 'RailRadar is a data API, never a claimed booking')
  assert.equal(result.trains[0].price, null, 'the between-stations search never returns a fare — must never be fabricated')
})

test('trains: a destination already given as an uppercase station code is used as-is', async () => {
  env.providers.trainsApiKey = 'key'
  mock = installRailRadarMock()
  const result = await trainsService.getTrains('NDLS', 'JP', FUTURE_DATE)
  assert.equal(result.dataSource, 'live')
  assert.equal(mock.calls.stations, 0)
})

test('trains: an unlisted city resolves via RailRadar station search', async () => {
  env.providers.trainsApiKey = 'key'
  mock = installRailRadarMock()
  const result = await trainsService.getTrains('Delhi', 'Kota', FUTURE_DATE)
  assert.equal(result.dataSource, 'live')
  assert.equal(mock.calls.stations, 1)
})

test('trains: without a journeyDate, no live-status enrichment is requested and status stays null', async () => {
  env.providers.trainsApiKey = 'key'
  mock = installRailRadarMock({
    between: (url) => {
      assert.equal(url.searchParams.get('live'), null, 'live=true must not be sent without a date')
      return json(trainsBetweenOk())
    },
  })
  const result = await trainsService.getTrains('Delhi', 'Jaipur')
  assert.equal(result.dataSource, 'live')
  assert.equal(result.trains[0].status, null)
})

test('trains: a second identical request is served from cache, not the provider', async () => {
  env.providers.trainsApiKey = 'key'
  mock = installRailRadarMock()
  await trainsService.getTrains('Delhi', 'Jaipur', FUTURE_DATE)
  const second = await trainsService.getTrains('Delhi', 'Jaipur', FUTURE_DATE)
  assert.equal(second.dataSource, 'live')
  assert.equal(mock.calls.between, 1, 'second call must be served from cache')
})

test('trains: a different journey date is a cache miss (not confused with an earlier search)', async () => {
  env.providers.trainsApiKey = 'key'
  mock = installRailRadarMock()
  await trainsService.getTrains('Delhi', 'Jaipur', FUTURE_DATE)
  await trainsService.getTrains('Delhi', 'Jaipur', '2099-07-01')
  assert.equal(mock.calls.between, 2)
})

test('trains: station search with no results falls back to sample honestly', async () => {
  env.providers.trainsApiKey = 'key'
  mock = installRailRadarMock({ stations: () => json({ data: [] }) })
  const result = await trainsService.getTrains('Delhi', 'Nowhereville', FUTURE_DATE)
  assert.equal(result.dataSource, 'sample')
  assert.equal(result.fallbackReason, 'no_results')
})

test('trains: an auth failure trips the circuit breaker so subsequent calls skip the provider', async () => {
  env.providers.trainsApiKey = 'key'
  mock = installRailRadarMock({ between: () => json({ error: 'invalid key' }, 401) })
  const first = await trainsService.getTrains('Delhi', 'Jaipur', FUTURE_DATE)
  assert.equal(first.dataSource, 'sample')
  assert.equal(mock.calls.between, 1)

  const second = await trainsService.getTrains('Delhi', 'Jaipur', FUTURE_DATE)
  assert.equal(second.dataSource, 'sample')
  assert.equal(mock.calls.between, 1, 'breaker must skip the provider on the second call')
})

test('trains: a rate-limit response also trips the breaker', async () => {
  env.providers.trainsApiKey = 'key'
  mock = installRailRadarMock({ between: () => json({}, 429) })
  const first = await trainsService.getTrains('Delhi', 'Jaipur', FUTURE_DATE)
  assert.equal(first.dataSource, 'sample')
  assert.equal(first.fallbackReason, 'rate_limited')
  await trainsService.getTrains('Delhi', 'Jaipur', FUTURE_DATE)
  assert.equal(mock.calls.between, 1, 'breaker must skip the provider on the second call')
})

test('trains: provider failure after a live success serves the stale cached search', async () => {
  env.providers.trainsApiKey = 'key'
  mock = installRailRadarMock()
  const first = await trainsService.getTrains('Delhi', 'Jaipur', FUTURE_DATE)
  assert.equal(first.dataSource, 'live')

  db.exec("UPDATE provider_cache SET expires_at = datetime('now', '-1 day') WHERE category = 'trains'")
  mock.restore()
  mock = installRailRadarMock({ between: () => json({}, 500) })

  const second = await trainsService.getTrains('Delhi', 'Jaipur', FUTURE_DATE)
  assert.equal(second.dataSource, 'cached')
  assert.equal(second.stale, true)
  assert.equal(second.trains[0].trainNumber, first.trains[0].trainNumber, 'stale value is the last good answer, not fabricated')
})

test('trains: a malformed between-stations response never gets cached or presented as live', async () => {
  env.providers.trainsApiKey = 'key'
  mock = installRailRadarMock({ between: () => json({ data: { from: {}, to: {}, trains: [{ nothingUseful: true }] } }) })
  const result = await trainsService.getTrains('Delhi', 'Jaipur', FUTURE_DATE)
  assert.equal(result.dataSource, 'sample')
})

test('trains: live status is provider-backed only — never falls back to sample, only unavailable', async () => {
  const noKey = await trainsService.getTrainStatus('12958')
  assert.equal(noKey.dataSource, 'unavailable')
  assert.equal(noKey.fallbackReason, 'not_configured')

  env.providers.trainsApiKey = 'key'
  mock = installRailRadarMock()
  const live = await trainsService.getTrainStatus('12958', { date: FUTURE_DATE })
  assert.equal(live.dataSource, 'live')
  assert.equal(live.status.trainNumber, '12958')
  assert.equal(mock.calls.live, 1)

  mock.restore()
  mock = installRailRadarMock({ live: () => json({}, 500) })
  const failed = await trainsService.getTrainStatus('99999')
  assert.equal(failed.dataSource, 'unavailable', 'must never fabricate a status the provider did not return')
})

test('trains: fare lookup requires source/destination/journeyDate/classCode and is never fabricated', async () => {
  env.providers.trainsApiKey = 'key'
  mock = installRailRadarMock()
  const missing = await trainsService.getFare('12958', { source: 'NDLS' })
  assert.equal(missing.dataSource, 'unavailable')
  assert.equal(missing.fallbackReason, 'not_found')
  assert.equal(mock.calls.fare, 0)

  const ok = await trainsService.getFare('12958', { source: 'NDLS', destination: 'JP', journeyDate: FUTURE_DATE, classCode: '3A' })
  assert.equal(ok.dataSource, 'live')
  assert.equal(ok.fare.totalFare, 875)
  assert.equal(mock.calls.fare, 1)
})

test('trains: seat-availability lookup mirrors fare — required params, never fabricated', async () => {
  env.providers.trainsApiKey = 'key'
  mock = installRailRadarMock()
  const ok = await trainsService.getSeatAvailability('12958', { source: 'NDLS', destination: 'JP', journeyDate: FUTURE_DATE, classCode: '3A' })
  assert.equal(ok.dataSource, 'live')
  assert.ok(Array.isArray(ok.availability.days))
  assert.equal(ok.availability.days[0].status, 'AVAILABLE-42')
})

test('trains: an already-resolved station code is reused from its own cache even if station search later fails', async () => {
  env.providers.trainsApiKey = 'key'
  mock = installRailRadarMock()
  await trainsService.getTrains('Delhi', 'Kota', FUTURE_DATE) // warms the station cache for "Kota"
  assert.equal(mock.calls.stations, 1)

  mock.restore()
  mock = installRailRadarMock({ stations: () => json({}, 401), between: () => json(trainsBetweenOk()) })
  const result = await trainsService.getTrains('Delhi', 'Kota', '2099-07-01') // different date -> not a search cache hit
  assert.equal(result.dataSource, 'live', 'the station code itself should still resolve from its own cache')
})
