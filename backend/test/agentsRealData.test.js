import './support/setup.js'
import test, { beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { resetAll, enableAll, installAll, runPlan, forecastFor, TRIP, START } from './support/realDataHarness.js'
import { json as amaJson, flightOffersOk, hotelOffersOk } from './support/amadeusFixtures.js'
import { json as owmJson } from './support/owmFixtures.js'
import { json as orsJson } from './support/orsFixtures.js'
import { json as railJson } from './support/railRadarFixtures.js'
import { agents } from '../src/agents/registry.js'
import { flightsService } from '../src/services/flightsService.js'

let mocks
beforeEach(() => { resetAll(); enableAll() })
afterEach(() => { mocks?.restore(); mocks = null })

const okForecast = () => owmJson(forecastFor(START, [0.1, 0.2, 0.1]))
const install = (o = {}) => { mocks = installAll({ ...o, owm: { forecast: okForecast, ...o.owm } }); return mocks }

// ---------------------------------------------------------------- Scenario A
test('Scenario A: normal trip — every agent consumes real normalized data end to end', async () => {
  const m = install()
  const ctx = await runPlan()
  const fp = ctx.state.finalPlan

  // Intent -> specialists
  assert.equal(ctx.state.intent.rooms, 1)
  assert.equal(ctx.state.intent.roomsAssumed, true)
  assert.equal(ctx.state.intent.returnDate, '2099-06-17')

  // Transport (flight tool -> flights service -> Amadeus)
  assert.equal(fp.transport.mode, 'flight')
  assert.equal(fp.transport.dataSource, 'live')
  assert.equal(fp.transport.priceBasis, 'party_total')
  assert.equal(fp.transport.totalPrice, 5200, 'Amadeus party total is not multiplied by travellers again')
  assert.equal(fp.transport.coverage, 'outbound_only')
  assert.equal(fp.transport.availability, 'not_verified')
  assert.equal(fp.transport.bookingStatus, 'not_booked')
  assert.ok(m.calls.amadeus.urls.some((u) => u.includes('returnDate=2099-06-17')), 'round trip requested from the provider')
  assert.equal(m.calls.amadeus.flights, 1)

  // Stay (hotel tool -> hotels service -> Amadeus)
  assert.equal(fp.stay.dataSource, 'live')
  assert.equal(fp.stay.priceBasis, 'per_room_per_night')
  assert.equal(fp.stay.totalPrice, 4200 * 2 * 1, 'nightly rate x 2 nights x 1 room')
  assert.equal(fp.stay.availability, 'not_verified')
  assert.equal(fp.stay.liveAvailability, false)
  assert.equal(fp.stay.bookingStatus, 'not_booked')

  // Attractions + routes + weather
  assert.equal(ctx.state.activities.data.dataSource, 'live')
  assert.ok(ctx.state.routes.legs.some((l) => l.dataSource === 'live'), 'ActivityAgent gathered real route legs via routeTool')
  assert.equal(m.calls.owm.forecast, 1, 'forecast fetched once and shared by Activity, Safety and Synthesis')
  assert.equal(m.calls.owm.current, 1)
  assert.equal(fp.days[0].weather.dataSource, 'live')
  assert.equal(fp.days[0].weatherStatus, 'live')

  // Budget: no double counting, unknown activity prices are not zero-priced
  assert.equal(fp.budget.breakdown.transport, 5200)
  assert.equal(fp.budget.breakdown.stay, 8400)
  assert.equal(fp.budget.components.transport.state, 'live')
  assert.equal(fp.budget.components.stay.state, 'live')
  assert.ok(fp.budget.components.activities.unknownItems > 0)
  assert.equal(fp.budget.isLowerBound, true)
  assert.equal(fp.budget.fitsBudgetConfirmed, false, 'a lower bound under budget is not proof the plan fits')

  // Safety: facts only
  assert.equal(ctx.state.safety.data.weatherSource.state, 'live')
  const safetyText = JSON.stringify(ctx.state.safety.data)
  assert.ok(!/unsafe|dangerous/i.test(safetyText))

  // Source status reaches the final itinerary
  assert.equal(fp.sourceStatus.attractions.state, 'live')
  assert.equal(fp.sourceStatus.hotels.state, 'live')
  assert.equal(fp.sourceStatus.flights.state, 'live')
  assert.equal(fp.sourceStatus.trains.state, 'live')
  assert.equal(fp.sourceStatus.weather.state, 'live')
  assert.equal(fp.sourceStatus.routes.state, 'live')
  assert.equal(fp.dataSource, 'live')
  assert.equal(fp.sources.transport, 'live')
  assert.match(fp.bookingDisclaimer, /not confirmed availability or bookings/)

  // Frontend contract fields are all still present
  for (const key of ['days', 'transport', 'stay', 'budget', 'safety', 'insights', 'activityAlternatives', 'approved', 'remainingIssues', 'generatedAt', 'dataSource', 'sources']) {
    assert.ok(key in fp, `finalPlan.${key} must remain`)
  }
  assert.ok(fp.budget.breakdown && typeof fp.budget.total === 'number')
})

test('progress events are emitted for each real-data step and never leak credentials', async () => {
  install()
  const entries = []
  await runPlan(TRIP, { onTrace: (e) => entries.push(e) })
  const summaries = entries.map((e) => e.summary).filter(Boolean)
  for (const expected of ['Searching attractions…', 'Finding accommodations…', 'Searching flights and trains…', 'Checking weather…', 'Calculating routes…']) {
    assert.ok(summaries.includes(expected), `missing progress: ${expected}`)
  }
  const blob = JSON.stringify(entries)
  for (const secret of ['otm-key', 'ors-key', 'ama-key', 'ama-secret', 'rail-key', 'owm-key']) assert.ok(!blob.includes(secret))
})

// ---------------------------------------------------------------- Scenario B
test('Scenario B: flight provider unavailable — transport continues with other modes, no live flight invented', async () => {
  install({ amadeus: { flights: () => amaJson({}, 500) } })
  const ctx = await runPlan()
  const fp = ctx.state.finalPlan
  const all = [ctx.state.transport.data.recommended, ...ctx.state.transport.data.alternatives]
  assert.ok(all.every((o) => !(o.mode === 'flight' && o.dataSource === 'live')))
  assert.equal(ctx.state.transport.data.sources.flights.state, 'sample')
  assert.equal(ctx.state.transport.data.sources.flights.fallbackReason, 'provider_unavailable')
  assert.equal(fp.sourceStatus.flights.state, 'sample')
  // The overall label follows what was actually chosen: here a real RailRadar train.
  assert.equal(fp.transport.mode, 'train')
  assert.equal(fp.sources.transport, fp.transport.dataSource)
  assert.ok(fp.days.length > 0)
})

// ---------------------------------------------------------------- Scenario C
test('Scenario C: hotel provider unavailable — stay falls back to labelled sample, plan continues', async () => {
  install({ amadeus: { byCity: () => amaJson({}, 500) } })
  const ctx = await runPlan()
  const fp = ctx.state.finalPlan
  assert.equal(fp.stay.dataSource, 'sample')
  assert.equal(fp.sourceStatus.hotels.state, 'sample')
  assert.equal(fp.sourceStatus.hotels.fallbackReason, 'provider_unavailable')
  assert.equal(fp.stay.liveAvailability, false)
  assert.equal(fp.transport.dataSource, 'live', 'other providers are unaffected')
  assert.equal(fp.dataSource, 'sample')
})

test('Scenario C2: a stay agent that crashes never sinks the plan — stay is reported unavailable, not invented', async () => {
  install()
  const original = agents.stay.execute
  agents.stay.execute = async () => { throw new Error('boom https://secret.example/hotels?key=abc123') }
  try {
    const ctx = await runPlan()
    const fp = ctx.state.finalPlan
    assert.equal(fp.stay, null)
    assert.ok(fp.unavailableComponents.includes('stay'))
    assert.equal(fp.dataCompleteness, 'partial')
    assert.ok(fp.dataNotes.some((n) => /Accommodation could not be determined/.test(n)))
    assert.equal(fp.budget.components.stay.amount, null)
    assert.ok(fp.budget.unavailable.includes('stay'))
    assert.equal(fp.budget.breakdown.stay, 0, 'reported as 0 in the legacy breakdown only — flagged unavailable, and total is a lower bound')
    assert.equal(fp.budget.isLowerBound, true)
    assert.equal(fp.dataSource, 'sample')
    assert.equal(fp.approved, false)
    assert.ok(fp.remainingIssues.some((i) => i.type === 'missing_stay'))
    const trace = JSON.stringify(ctx.executionTrace)
    assert.ok(!trace.includes('secret.example') && !trace.includes('abc123'), 'sanitized failure reason')
    // Replanning tried to search for an alternative
    assert.ok(ctx.state.replanning.data.rerunAgents.includes('Stay Agent'))
  } finally {
    agents.stay.execute = original
  }
})

// ---------------------------------------------------------------- Scenario D
test('Scenario D: RailRadar unavailable — trains fall back to sample, flights stay live', async () => {
  install({ rail: { between: () => railJson({}, 500), stations: () => railJson({}, 500) } })
  const ctx = await runPlan()
  const fp = ctx.state.finalPlan
  assert.equal(fp.sourceStatus.trains.state, 'sample')
  assert.equal(fp.sourceStatus.flights.state, 'live')
  const trains = [ctx.state.transport.data.recommended, ...ctx.state.transport.data.alternatives].filter((o) => o.mode === 'train')
  assert.ok(trains.every((t) => t.dataSource === 'sample' && t.status === null && t.bookingUrl === null))
  assert.equal(fp.transport.dataSource, 'live')
})

// ---------------------------------------------------------------- Scenario E
test('Scenario E: weather unavailable — plan still generated, weather marked unavailable, none invented', async () => {
  install({ owm: { current: () => owmJson({}, 500), forecast: () => owmJson({}, 500) } })
  const ctx = await runPlan()
  const fp = ctx.state.finalPlan
  assert.equal(fp.sourceStatus.weather.state, 'unavailable')
  assert.ok(fp.days.every((d) => d.weather === null && d.weatherStatus === 'unavailable'))
  assert.equal(ctx.state.safety.data.weather, null)
  assert.equal(ctx.state.safety.data.weatherSource.state, 'unavailable')
  assert.ok(fp.dataNotes.some((n) => /Weather data was unavailable/.test(n)))
  assert.ok(ctx.state.critique.data.issues.some((i) => i.type === 'data_unavailable' && i.severity === 'low'))
  assert.equal(fp.transport.dataSource, 'live')
})

// ---------------------------------------------------------------- Scenario F
test('Scenario F: multiple providers partially unavailable — graceful degradation, nothing fabricated as live', async () => {
  install({
    amadeus: { flights: () => amaJson({}, 500), byCity: () => amaJson({}, 500) },
    owm: { current: () => owmJson({}, 500), forecast: () => owmJson({}, 500) },
    ors: () => orsJson({}, 500),
  })
  const ctx = await runPlan()
  const fp = ctx.state.finalPlan
  assert.equal(fp.sourceStatus.flights.state, 'sample')
  assert.equal(fp.sourceStatus.hotels.state, 'sample')
  assert.equal(fp.sourceStatus.weather.state, 'unavailable')
  assert.equal(fp.sourceStatus.routes.state, 'unavailable')
  assert.equal(fp.sourceStatus.attractions.state, 'live')
  assert.ok(fp.days.every((d) => d.stops.filter((s) => s.category !== 'food').every((s) => s.travelToNext === null)), 'no fabricated route legs')
  assert.equal(fp.dataSource, 'sample')
  assert.ok(fp.days.length === 3)
})

// ---------------------------------------------------------------- Scenario G
test('Scenario G: hotel price unavailable — budget flags it and never treats it as zero-cost', async () => {
  install({ amadeus: { offers: () => amaJson({ data: [{ ...hotelOffersOk()[0], offers: [] }] }) } })
  const ctx = await runPlan()
  const fp = ctx.state.finalPlan
  assert.equal(fp.stay.dataSource, 'live')
  assert.equal(fp.stay.pricePerNight, null)
  assert.equal(fp.stay.totalPrice, null)
  assert.equal(fp.stay.priceState, 'unavailable')
  assert.equal(fp.budget.components.stay.amount, null)
  assert.equal(fp.budget.components.stay.state, 'unavailable')
  assert.deepEqual(fp.budget.unavailable, ['stay'])
  assert.equal(fp.budget.isLowerBound, true)
  assert.equal(fp.budget.fitsBudgetConfirmed, false)
  assert.equal(fp.dataCompleteness, 'partial')
  assert.ok(ctx.state.budget.issues.some((i) => i.type === 'budget_incomplete'))
  assert.ok(ctx.state.stay.issues.some((i) => i.type === 'stay_price_unavailable'))
  assert.match(ctx.state.budget.summary, /lower bound/i)
})

// ---------------------------------------------------------------- Scenario H
test('Scenario H: transport changes during replanning when the first choice is over its budget share', async () => {
  install()
  const ctx = await runPlan({ ...TRIP, budget: 12000 })
  assert.ok(ctx.iteration >= 1, 'critic sent the plan back for replanning')
  assert.equal(ctx.state.transport.data.recommended.mode, 'bus', 'replanning switched to a cheaper mode')
  assert.ok(ctx.state.replanning.data.changes.some((c) => /transport mode/.test(c)))
  assert.equal(ctx.state.finalPlan.transport.mode, 'bus')
})

test('Scenario H2: a flight that arrives after the trip ends is excluded and another mode is searched', async () => {
  install({
    amadeus: { flights: () => amaJson({ data: flightOffersOk({ departureAt: '2099-06-15T22:00:00', arrivalAt: '2099-06-17T06:00:00' }) }) },
    rail: { between: () => railJson({}, 500), stations: () => railJson({}, 500) },
  })
  const ctx = await runPlan({ ...TRIP, endDate: undefined, days: 1 })
  assert.ok(ctx.iteration >= 1)
  assert.ok(ctx.adjustments.excludeTransportModes.includes('flight'))
  assert.notEqual(ctx.state.finalPlan.transport.mode, 'flight')
  assert.ok(ctx.state.replanning.data.changes.some((c) => /excluded flight/.test(c)))
  assert.ok(!ctx.state.critique.data.issues.some((i) => i.type === 'arrival_after_trip_end'), 'issue resolved after the alternative was chosen')
})

test('a wet forecast day with a single forecast day annotates outdoor stops but never labels them unsafe', async () => {
  install({ owm: { forecast: () => owmJson(forecastFor(START, [0.9])) } })
  const ctx = await runPlan({ ...TRIP, days: 1, endDate: undefined })
  const stops = ctx.state.finalPlan.days[0].stops.filter((s) => s.weatherAdvisory)
  for (const s of stops) {
    assert.equal(s.weatherAdvisory.precipitationChancePct, 90)
    assert.equal(s.weatherAdvisory.dataSource, 'live')
  }
})

test('sequential planning does not duplicate provider calls within one run', async () => {
  const m = install()
  await runPlan()
  assert.equal(m.calls.amadeus.flights, 1)
  assert.equal(m.calls.owm.forecast, 1)
  assert.equal(m.calls.owm.current, 1)
  assert.equal(m.calls.rail.between, 1)
})

test('a tool-level provider exception inside the flight service degrades to sample, not a crash', async () => {
  install()
  const original = flightsService.getFlights
  flightsService.getFlights = async () => { throw new Error('unexpected') }
  try {
    const ctx = await runPlan()
    assert.equal(ctx.state.transport.status === 'error', false)
    assert.equal(ctx.state.transport.data.sources.flights.state, 'sample')
    assert.equal(ctx.state.transport.data.sources.flights.fallbackReason, 'provider_unavailable')
  } finally {
    flightsService.getFlights = original
  }
})

test('zero provider keys: plan is fully sample-labelled and complete (R1-R6 behaviour preserved)', async () => {
  resetAll()
  const ctx = await runPlan({ ...TRIP, transportPreference: undefined })
  const fp = ctx.state.finalPlan
  assert.equal(fp.dataSource, 'sample')
  assert.equal(fp.sourceStatus.weather.state, 'unavailable')
  assert.equal(fp.days.length, 3)
  assert.ok(fp.transport && fp.stay)
})

test('inconsistent trip dates are reported by the Intent Agent and Critic, not silently repaired', async () => {
  install()
  const ctx = await runPlan({ ...TRIP, endDate: '2099-06-10' })
  assert.ok(ctx.state.intent.dateIssues.some((i) => i.type === 'end_before_start'))
  assert.equal(ctx.state.intent.endDate, null)
  assert.ok(ctx.state.critique.data.issues.some((i) => i.type === 'end_before_start'))
})
