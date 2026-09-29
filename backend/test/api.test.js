import { db, TEST_KEY } from './support/setup.js'
import test, { before, after, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { createApp } from '../src/app.js'
import { attractionsService } from '../src/services/attractionsService.js'
import { env } from '../src/config/env.js'
import { installOpenTripMapMock, geonameOk, radiusList, details, json } from './support/otmFixtures.js'
import { mapsService } from '../src/services/mapsService.js'

let server, base, token, mock
const KEY = env.providers.attractionsApiKey

before(async () => {
  server = createApp().listen(0)
  await new Promise((r) => server.once('listening', r))
  base = `http://127.0.0.1:${server.address().port}/api`
  const res = await fetch(`${base}/auth/register`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: 'tester', email: 't@example.com', password: 'password123' }) })
  token = (await res.json()).token
})
after(() => server.close())
beforeEach(() => { db.exec('DELETE FROM provider_cache'); attractionsService._resetForTests(); mapsService._resetForTests(); env.providers.attractionsApiKey = KEY; env.providers.mapsApiKey = '' })
afterEach(() => mock?.restore())

const get = (path, auth = true) => fetch(`${base}${path}`, { headers: auth ? { authorization: `Bearer ${token}` } : {} })

test('endpoints require auth; health stays public', async () => {
  assert.equal((await get('/attractions?destination=Manali', false)).status, 401)
  assert.equal((await get('/destinations/search?q=Manali', false)).status, 401)
  assert.equal((await get('/health', false)).status, 200)
})

test('input validation', async () => {
  assert.equal((await get('/attractions')).status, 400)
  assert.equal((await get(`/attractions?destination=${'x'.repeat(101)}`)).status, 400)
  assert.equal((await get('/attractions?destination=Manali&limit=abc')).status, 400)
  assert.equal((await get('/destinations/search')).status, 400)
})

test('GET /attractions: live, then cached; attribution present; key never in body', async () => {
  mock = installOpenTripMapMock()
  const a = await (await get('/attractions?destination=Manali')).json()
  assert.equal(a.dataSource, 'live')
  assert.equal(a.count, 3)
  assert.match(a.attribution, /OpenTripMap/)
  const b = await (await get('/attractions?destination=Manali')).json()
  assert.equal(b.dataSource, 'cached')
  assert.equal(JSON.stringify([a, b]).includes(TEST_KEY), false)
})

test('GET /attractions: missing key -> sample; unknown destination -> empty, not fake places', async () => {
  env.providers.attractionsApiKey = ''
  const s = await (await get('/attractions?destination=Manali')).json()
  assert.equal(s.dataSource, 'sample')
  assert.equal(s.fallbackReason, 'not_configured')
  assert.ok(!('attribution' in s))
  const u = await (await get('/attractions?destination=Atlantis')).json()
  assert.equal(u.dataSource, 'none')
  assert.equal(u.count, 0)
})

test('GET /attractions: provider failures never surface raw errors or crash', async () => {
  for (const status of [401, 429, 500]) {
    db.exec('DELETE FROM provider_cache'); attractionsService._resetForTests()
    mock = installOpenTripMapMock({ geoname: () => json({ message: `secret upstream detail ${status}` }, status) })
    const res = await get('/attractions?destination=Goa')
    assert.equal(res.status, 200)
    const text = await res.text()
    assert.doesNotMatch(text, /secret upstream|responded|apikey|TEST_KEY/i)
    assert.equal(JSON.parse(text).dataSource, 'sample')
    mock.restore()
  }
})

test('GET /destinations/search', async () => {
  mock = installOpenTripMapMock()
  const r = await (await get('/destinations/search?q=Manali')).json()
  assert.equal(r.dataSource, 'live')
  assert.equal(r.results[0].name, 'Manali')
  assert.equal(JSON.stringify(r).includes(TEST_KEY), false)
})

const planBody = { destination: 'Manali', origin: 'New Delhi', startDate: '2026-10-10', endDate: '2026-10-12', travellers: 2, budget: 35000, interests: ['Nature', 'Culture'], transportPreference: 'bus', hotelPreference: 'Standard' }
const plan = async () => {
  const res = await fetch(`${base}/ai/plan`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body: JSON.stringify(planBody) })
  assert.equal(res.status, 201)
  return (await res.json()).state.finalPlan
}

test('POST /ai/plan with zero provider keys still produces a fully sample-labeled plan', async () => {
  env.providers.attractionsApiKey = ''
  const fp = await plan()
  assert.equal(fp.dataSource, 'sample')
  assert.deepEqual(fp.sources, { transport: 'sample', stay: 'sample', activities: 'sample' })
  assert.ok(fp.days.some((d) => d.stops.some((s) => s.id)))
})

test('POST /ai/plan with OpenTripMap configured: places are live, overall label stays sample (transport/stay are still sample)', async () => {
  mock = installOpenTripMapMock()
  const fp = await plan()
  assert.equal(fp.sources.activities, 'live')
  assert.equal(fp.dataSource, 'sample')
  const placeStops = fp.days.flatMap((d) => d.stops).filter((s) => s.id && s.dataSource === 'live')
  assert.ok(placeStops.length >= 1)
  assert.ok(placeStops.every((s) => s.costKnown === false && s.durationEstimated === true))
  assert.equal(fp.budget.breakdown?.activities ?? 0, 0)
})

test('POST /ai/plan with attractions AND maps configured: live route legs reach itinerary stops', async () => {
  env.providers.mapsApiKey = 'test-key'
  const realFetch = globalThis.fetch
  globalThis.fetch = async (input, init) => {
    const url = new URL(typeof input === 'string' ? input : input.url)
    if (url.hostname === 'api.opentripmap.com') {
      if (url.pathname.endsWith('/geoname')) return json(geonameOk)
      if (url.pathname.endsWith('/radius')) return json(radiusList)
      if (url.pathname.includes('/xid/')) {
        const xid = decodeURIComponent(url.pathname.split('/xid/')[1])
        return details[xid] ? json(details[xid]) : json({ error: 'not found' }, 404)
      }
    }
    if (url.hostname === 'api.openrouteservice.org') {
      return json({ features: [{ properties: { summary: { distance: 2500, duration: 480 } } }] })
    }
    return realFetch(input, init)
  }
  mock = { restore: () => { globalThis.fetch = realFetch; env.providers.mapsApiKey = '' } }

  const fp = await plan()
  const liveStops = fp.days.flatMap((d) => d.stops).filter((s) => s.dataSource === 'live')
  assert.ok(liveStops.length >= 1)
  // At least one live stop should carry a real travel leg to the next stop
  // (some won't — e.g. the last stop of a day — so this checks presence, not universality).
  const withLeg = liveStops.find((s) => s.travelToNext)
  assert.ok(withLeg, 'expected at least one stop with a live travel leg')
  assert.equal(withLeg.travelToNext.dataSource, 'live')
  assert.equal(withLeg.travelToNext.distanceKm, 2.5)
  assert.equal(withLeg.travelToNext.durationMinutes, 8)
})
