import { db } from './support/setup.js'
import test, { beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { attractionsService } from '../src/services/attractionsService.js'
import { env } from '../src/config/env.js'
import { installOpenTripMapMock, json, geonameNotFound } from './support/otmFixtures.js'

let mock
const KEY = env.providers.attractionsApiKey

beforeEach(() => {
  db.exec('DELETE FROM provider_cache')
  attractionsService._resetForTests()
  env.providers.attractionsApiKey = KEY
})
afterEach(() => mock?.restore())

test('1. valid key: returns normalized live attractions, ranked, de-duplicated, nameless dropped', async () => {
  mock = installOpenTripMapMock()
  const r = await attractionsService.getAttractions('Manali', { allowGeneratedSample: false })
  assert.equal(r.dataSource, 'live')
  assert.equal(r.provider, 'opentripmap')
  assert.equal(r.fallbackReason, null)
  assert.deepEqual(r.attractions.map((a) => a.name), ['Hadimba Temple', 'Solang Valley', 'Old Manali Bridge'])
  assert.ok(r.attractions.every((a) => a.dataSource === 'live' && a.cached === false))
  assert.equal(r.destination.name, 'Manali')
  assert.equal(r.destination.country, 'IN')
  assert.equal(mock.calls.geoname, 1)
  assert.equal(mock.calls.radius, 1)
  assert.equal(mock.calls.xid, 3)
})

test('1b. the key is sent to the provider but the request uses the interest whitelist only', async () => {
  mock = installOpenTripMapMock()
  await attractionsService.getAttractions('Manali', { interests: ['Nature', 'drop table; --'] })
  const radiusUrl = new URL(mock.calls.urls.find((u) => u.includes('/radius')))
  assert.equal(radiusUrl.searchParams.get('kinds'), 'natural')
  assert.equal(radiusUrl.searchParams.get('apikey'), env.providers.attractionsApiKey)
})

test('2. missing key: sample fallback, provider never called', async () => {
  env.providers.attractionsApiKey = ''
  mock = installOpenTripMapMock()
  const r = await attractionsService.getAttractions('Manali')
  assert.equal(r.dataSource, 'sample')
  assert.equal(r.fallbackReason, 'not_configured')
  assert.ok(r.attractions.length > 0)
  assert.ok(r.attractions.every((a) => a.dataSource === 'sample'))
  assert.equal(mock.calls.geoname + mock.calls.radius + mock.calls.xid, 0)
})

test('2b. missing key + unknown destination: honest empty result when generated sample is not allowed', async () => {
  env.providers.attractionsApiKey = ''
  const strict = await attractionsService.getAttractions('Atlantis', { allowGeneratedSample: false })
  assert.equal(strict.dataSource, 'none')
  assert.deepEqual(strict.attractions, [])
  const lenient = await attractionsService.getAttractions('Atlantis') // agents keep the existing behaviour
  assert.equal(lenient.dataSource, 'sample')
  assert.ok(lenient.attractions.length > 0)
})

test('3. invalid key (401): falls back to sample, no raw error, breaker stops further calls', async () => {
  mock = installOpenTripMapMock({ geoname: () => json({ error: 'Invalid key' }, 401) })
  const r = await attractionsService.getAttractions('Manali')
  assert.equal(r.dataSource, 'sample')
  assert.equal(r.fallbackReason, 'provider_unavailable')
  assert.doesNotMatch(JSON.stringify(r), /401|Invalid key|opentripmap responded/i)
  const before = mock.calls.geoname
  await attractionsService.getAttractions('Goa')
  assert.equal(mock.calls.geoname, before, 'circuit breaker should suppress repeat calls with a rejected key')
})

test('3b. rate limited (429): reason is rate_limited', async () => {
  mock = installOpenTripMapMock({ geoname: () => json({}, 429) })
  const r = await attractionsService.getAttractions('Manali')
  assert.equal(r.fallbackReason, 'rate_limited')
  assert.equal(r.dataSource, 'sample')
})

test('4. provider timeout: sample fallback with timeout reason', async () => {
  mock = installOpenTripMapMock({ geoname: () => { throw Object.assign(new Error('aborted'), { name: 'AbortError' }) } })
  const r = await attractionsService.getAttractions('Manali')
  assert.equal(r.dataSource, 'sample')
  assert.equal(r.fallbackReason, 'timeout')
})

test('4b. deadline: slow provider does not block, and the background request still warms the cache', async () => {
  const slow = () => new Promise((resolve) => setTimeout(() => resolve(json({ name: 'Manali', country: 'IN', lat: 32.2, lon: 77.1, status: 'OK' })), 120))
  mock = installOpenTripMapMock({ geoname: slow })
  const t0 = Date.now()
  const r = await attractionsService.getAttractions('Manali', { deadlineMs: 30 })
  assert.ok(Date.now() - t0 < 100)
  assert.equal(r.dataSource, 'sample')
  assert.equal(r.fallbackReason, 'timeout')
  await new Promise((resolve) => setTimeout(resolve, 400))
  const again = await attractionsService.getAttractions('Manali')
  assert.equal(again.dataSource, 'cached')
})

test('5. provider returns no results: fallback reason no_results, nothing cached', async () => {
  mock = installOpenTripMapMock({ radius: () => json([]) })
  const r = await attractionsService.getAttractions('Atlantis', { allowGeneratedSample: false })
  assert.equal(r.dataSource, 'none')
  assert.equal(r.fallbackReason, 'no_results')
  assert.deepEqual(r.attractions, [])
})

test('5b. unknown destination name (geoname NOT_FOUND)', async () => {
  mock = installOpenTripMapMock({ geoname: () => json(geonameNotFound) })
  const r = await attractionsService.getAttractions('zzzzzz', { allowGeneratedSample: false })
  assert.equal(r.fallbackReason, 'destination_not_found')
  assert.equal(r.dataSource, 'none')
})

test('6. malformed data: bad radius body, bad geoname body, non-JSON body', async () => {
  mock = installOpenTripMapMock({ radius: () => json({ unexpected: 'object' }) })
  assert.equal((await attractionsService.getAttractions('Manali')).dataSource, 'sample')
  mock.restore(); db.exec('DELETE FROM provider_cache')
  mock = installOpenTripMapMock({ geoname: () => json({ status: 'OK', lat: 'x', lon: null }) })
  assert.equal((await attractionsService.getAttractions('Manali')).fallbackReason, 'provider_unavailable')
  mock.restore(); db.exec('DELETE FROM provider_cache')
  mock = installOpenTripMapMock({ geoname: () => new Response('<html>oops</html>', { status: 200 }) })
  const r = await attractionsService.getAttractions('Manali')
  assert.equal(r.dataSource, 'sample')
})

test('6b. malformed detail responses degrade to provider list data instead of failing', async () => {
  mock = installOpenTripMapMock({ xid: () => new Response('not json', { status: 200 }) })
  const r = await attractionsService.getAttractions('Manali')
  assert.equal(r.dataSource, 'live')
  assert.deepEqual(r.attractions.map((a) => a.name), ['Hadimba Temple', 'Solang Valley', 'Old Manali Bridge'])
  assert.ok(r.attractions.every((a) => a.description === '' && a.images.length === 0))
})

test('7. cached data available: second call makes zero provider requests and is labeled cached', async () => {
  mock = installOpenTripMapMock()
  const first = await attractionsService.getAttractions('Manali')
  const total = mock.calls.geoname + mock.calls.radius + mock.calls.xid
  const second = await attractionsService.getAttractions('  manali ')
  assert.equal(first.dataSource, 'live')
  assert.equal(second.dataSource, 'cached')
  assert.ok(second.attractions.every((a) => a.dataSource === 'cached' && a.cached === true))
  assert.equal(mock.calls.geoname + mock.calls.radius + mock.calls.xid, total)
})

test('7b. different limit reuses cached layers (no duplicate provider calls)', async () => {
  mock = installOpenTripMapMock()
  await attractionsService.getAttractions('Manali', { limit: 3 })
  const total = mock.calls.geoname + mock.calls.radius + mock.calls.xid
  const r = await attractionsService.getAttractions('Manali', { limit: 2 })
  assert.equal(r.attractions.length, 2)
  assert.equal(mock.calls.geoname + mock.calls.radius + mock.calls.xid, total)
})

test('7c. concurrent identical requests share one set of provider calls', async () => {
  mock = installOpenTripMapMock()
  await Promise.all([1, 2, 3].map(() => attractionsService.getAttractions('Manali')))
  assert.equal(mock.calls.geoname, 1)
  assert.equal(mock.calls.radius, 1)
  assert.equal(mock.calls.xid, 3)
})

test('7d. expired cache + provider down: stale data is served and labeled cached', async () => {
  mock = installOpenTripMapMock()
  await attractionsService.getAttractions('Manali')
  db.exec(`UPDATE provider_cache SET expires_at = '2000-01-01 00:00:00'`)
  mock.restore()
  mock = installOpenTripMapMock({ geoname: () => json({}, 500), radius: () => json({}, 500), xid: () => json({}, 500) })
  const r = await attractionsService.getAttractions('Manali')
  assert.equal(r.dataSource, 'cached')
  assert.equal(r.stale, true)
  assert.equal(r.attractions.length, 3)
})

test('8. cached data unavailable + provider down: sample for known destinations', async () => {
  mock = installOpenTripMapMock({ geoname: () => json({}, 503) })
  const r = await attractionsService.getAttractions('Goa', { allowGeneratedSample: false })
  assert.equal(r.dataSource, 'sample')
  assert.equal(r.fallbackReason, 'provider_unavailable')
})

test('destination search: live, cached, not found, and sample fallback', async () => {
  mock = installOpenTripMapMock()
  const live = await attractionsService.searchDestination('Manali')
  assert.equal(live.dataSource, 'live')
  assert.equal(live.results[0].country, 'IN')
  assert.deepEqual(live.results[0].coordinates, { lat: 32.2432, lng: 77.1892 })
  assert.equal((await attractionsService.searchDestination('Manali')).dataSource, 'cached')

  mock.restore(); db.exec('DELETE FROM provider_cache')
  mock = installOpenTripMapMock({ geoname: () => json(geonameNotFound) })
  const nf = await attractionsService.searchDestination('zzzzzz')
  assert.deepEqual(nf.results, [])
  assert.equal(nf.fallbackReason, 'no_results')

  env.providers.attractionsApiKey = ''
  const s = await attractionsService.searchDestination('goa')
  assert.equal(s.dataSource, 'sample')
  assert.equal(s.results[0].name, 'Goa')
  assert.equal(s.fallbackReason, 'not_configured')
})
