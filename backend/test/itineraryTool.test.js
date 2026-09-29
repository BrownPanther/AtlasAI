import { db } from './support/setup.js'
import test, { beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { buildDays } from '../src/tools/itineraryTool.js'
import { mapsService } from '../src/services/mapsService.js'
import { weatherService } from '../src/services/weatherService.js'
import { env } from '../src/config/env.js'
import { installOpenRouteServiceMock, directionsOk, json } from './support/orsFixtures.js'
import { installOwmMock, forecastOk } from './support/owmFixtures.js'

let mock
let owmMock

function activity(overrides) {
  return {
    id: 'A1', name: 'Test Place', category: 'nature', area: 'Center',
    coordinates: null, durationHours: 1, estimatedCost: 0, costKnown: false,
    durationEstimated: true, dataSource: 'sample', notes: null,
    ...overrides,
  }
}

beforeEach(() => {
  db.exec('DELETE FROM provider_cache')
  mapsService._resetForTests()
  weatherService._resetForTests()
  env.providers.mapsApiKey = ''
  env.providers.weatherApiKey = ''
})
afterEach(() => {
  mock?.restore()
  owmMock?.restore()
})

test('buildDays: activities without coordinates use the fixed buffer, no routing attempted', async () => {
  env.providers.mapsApiKey = 'test-key'
  mock = installOpenRouteServiceMock()
  const activities = [
    activity({ id: 'A1', name: 'Place A' }),
    activity({ id: 'A2', name: 'Place B' }),
  ]
  const days = await buildDays({ days: 1, activities, slotsPerDay: 2, startDate: '2026-10-10' })
  const stops = days[0].stops.filter((s) => s.category !== 'food')
  assert.equal(stops.every((s) => s.travelToNext === null), true)
  assert.equal(mock.calls.directions, 0, 'no coordinates means no provider call')
})

test('buildDays: with coordinates and a live provider, travelToNext is populated and used for spacing', async () => {
  env.providers.mapsApiKey = 'test-key'
  mock = installOpenRouteServiceMock(() => json(directionsOk({ distanceMeters: 2000, durationSeconds: 600 }))) // 2km / 10min
  const activities = [
    activity({ id: 'A1', name: 'Place A', coordinates: { lat: 32.25, lng: 77.18 } }),
    activity({ id: 'A2', name: 'Place B', coordinates: { lat: 32.31, lng: 77.15 } }),
  ]
  const days = await buildDays({ days: 1, activities, slotsPerDay: 2, startDate: '2026-10-10' })
  const stops = days[0].stops.filter((s) => s.category !== 'food').sort((a, b) => (a.startTime > b.startTime ? 1 : -1))
  const [first, second] = stops
  assert.equal(first.travelToNext.distanceKm, 2)
  assert.equal(first.travelToNext.durationMinutes, 10)
  assert.equal(second.travelToNext, null, 'last activity of the day has nothing after it')

  // Spacing between first.endTime and second.startTime should reflect the
  // real 10-minute leg, not the fixed 45-minute buffer.
  const [eh, em] = first.endTime.split(':').map(Number)
  const [sh, sm] = second.startTime.split(':').map(Number)
  const gapMinutes = (sh * 60 + sm) - (eh * 60 + em)
  assert.equal(gapMinutes, 10)
})

test('buildDays: coordinates present but no maps key configured degrades to the fixed buffer', async () => {
  const activities = [
    activity({ id: 'A1', name: 'Place A', coordinates: { lat: 32.25, lng: 77.18 } }),
    activity({ id: 'A2', name: 'Place B', coordinates: { lat: 32.31, lng: 77.15 } }),
  ]
  const days = await buildDays({ days: 1, activities, slotsPerDay: 2, startDate: '2026-10-10' })
  const stops = days[0].stops.filter((s) => s.category !== 'food')
  assert.equal(stops.every((s) => s.travelToNext === null), true)
})

test('buildDays: a provider failure degrades gracefully (never throws, never fabricates a leg)', async () => {
  env.providers.mapsApiKey = 'test-key'
  mock = installOpenRouteServiceMock(() => json({}, 500))
  const activities = [
    activity({ id: 'A1', name: 'Place A', coordinates: { lat: 32.25, lng: 77.18 } }),
    activity({ id: 'A2', name: 'Place B', coordinates: { lat: 32.31, lng: 77.15 } }),
  ]
  const days = await buildDays({ days: 1, activities, slotsPerDay: 2, startDate: '2026-10-10' })
  const stops = days[0].stops.filter((s) => s.category !== 'food')
  assert.equal(stops.every((s) => s.travelToNext === null), true)
})

test('buildDays: with a destination and a configured weather provider, each day carries its matching forecast', async () => {
  env.providers.weatherApiKey = 'test-key'
  owmMock = installOwmMock({ forecast: () => json(forecastOk({ startUnix: Math.floor(new Date('2026-10-10T06:00:00Z').getTime() / 1000) })) })
  const activities = [activity({ id: 'A1', name: 'Place A' })]
  const days = await buildDays({ days: 1, activities, slotsPerDay: 2, startDate: '2026-10-10', destination: 'Manali' })
  assert.equal(days[0].date, '2026-10-10')
  assert.ok(days[0].weather, 'a matching forecast day should be attached')
  assert.equal(days[0].weather.dataSource, 'live')
})

test('buildDays: with no destination, or no weather provider configured, weather is null but the plan still builds', async () => {
  const activities = [activity({ id: 'A1', name: 'Place A' })]
  const noDestination = await buildDays({ days: 1, activities, slotsPerDay: 2, startDate: '2026-10-10' })
  assert.equal(noDestination[0].weather, null)

  env.providers.weatherApiKey = ''
  const noKey = await buildDays({ days: 1, activities, slotsPerDay: 2, startDate: '2026-10-10', destination: 'Manali' })
  assert.equal(noKey[0].weather, null)
})
