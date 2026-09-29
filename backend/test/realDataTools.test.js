import './support/setup.js'
import test, { beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { resetAll, enableAll, installAll, forecastFor, START } from './support/realDataHarness.js'
import { json as amaJson, flightOffersOk } from './support/amadeusFixtures.js'
import { json as owmJson } from './support/owmFixtures.js'
import { json as orsJson } from './support/orsFixtures.js'
import { json as railJson, fareOk } from './support/railRadarFixtures.js'
import { env } from '../src/config/env.js'
import { AgentContext } from '../src/agents/AgentContext.js'
import { CriticAgent } from '../src/agents/CriticAgent.js'
import { ReplanningAgent } from '../src/agents/ReplanningAgent.js'
import { SOURCE_STATE, normalizeState, weakestState, makeSource, safeErrorReason, isBaseCurrency } from '../src/agents/sourceStatus.js'
import { computeBudget } from '../src/tools/budgetTool.js'
import { searchTransport } from '../src/tools/transportTool.js'
import { searchHotels } from '../src/tools/hotelTool.js'
import { getWeatherContext, isWetDay } from '../src/tools/weatherTool.js'
import { getRoute, getRouteLegs, summarizeLegs } from '../src/tools/routeTool.js'
import { getSafetyNotes } from '../src/tools/safetyTool.js'
import { buildPlan, assignActivitiesToDays, resolveArrival } from '../src/tools/itineraryTool.js'
import { normalizeAmadeusFlight } from '../src/normalizers/flightNormalizer.js'
import { RuleBasedProvider } from '../src/llm/RuleBasedProvider.js'
import { LocalOllamaProvider, slimForPrompt } from '../src/llm/LocalOllamaProvider.js'

let mocks
beforeEach(() => { resetAll(); enableAll() })
afterEach(() => { mocks?.restore(); mocks = null })

const act = (id, category, area, extra = {}) => ({
  id, name: id, category, area, durationHours: 1.5, estimatedCost: 0, costKnown: false, durationEstimated: true, dataSource: 'live', coordinates: null, ...extra,
})

// ------------------------------------------------------------- source status
test('sourceStatus: vocabulary, unknown states are unavailable, weakest link wins', () => {
  assert.equal(normalizeState('none'), 'unavailable')
  assert.equal(normalizeState(undefined), 'unavailable')
  assert.equal(normalizeState('cached'), 'cached')
  assert.equal(weakestState(['live', 'cached']), 'cached')
  assert.equal(weakestState(['live', 'sample', 'cached']), 'sample')
  assert.equal(weakestState(['live', 'unavailable']), 'unavailable')
  assert.equal(makeSource({ dataSource: 'live', provider: 'x', stale: true }).stale, true)
  assert.deepEqual(Object.values(SOURCE_STATE).sort(), ['cached', 'estimated', 'live', 'sample', 'unavailable'])
  assert.equal(isBaseCurrency('inr'), true)
  assert.equal(isBaseCurrency('EUR'), false)
})

test('safeErrorReason strips URLs and credentials and is length-bounded', () => {
  const out = safeErrorReason(new Error(`failed https://api.x.com/v1?apikey=SECRET token=abc ${'x'.repeat(500)}`))
  assert.ok(!out.includes('api.x.com') && !out.includes('abc'))
  assert.ok(out.length <= 160)
})

test('AgentContext.once memoises per run and records source status', async () => {
  const ctx = new AgentContext({ tripRequest: {}, runId: 'r', userId: 'u' })
  let n = 0
  const [a, b] = await Promise.all([ctx.once('k', async () => ++n), ctx.once('k', async () => ++n)])
  assert.equal(a, 1); assert.equal(b, 1); assert.equal(n, 1)
  ctx.recordSource('weather', { state: 'live' })
  assert.equal(ctx.state.sources.weather.state, 'live')
})

// ------------------------------------------------------------------- budget
test('budget: unavailable prices are reported, never counted as zero-cost knowns', () => {
  const b = computeBudget({
    days: 2, travellers: 2, budget: 100000,
    components: { transport: { amount: null, state: 'unavailable' }, stay: { amount: 8000, state: 'live' }, activities: { amount: 0, state: 'live', unknownItems: 2 } },
  })
  assert.deepEqual(b.unavailable, ['transport'])
  assert.equal(b.isLowerBound, true)
  assert.equal(b.components.transport.amount, null)
  assert.equal(b.fitsBudgetConfirmed, false)
  assert.equal(b.subtotal, 8000 + 900 * 2 * 2 + 300 * 2 * 2)
})

test('budget: complete, known components give a confirmed fit; legacy numeric params still work', () => {
  const full = computeBudget({ days: 1, travellers: 1, budget: 50000, components: { transport: { amount: 1000, state: 'live' }, stay: { amount: 2000, state: 'live' }, activities: { amount: 100, state: 'live', unknownItems: 0 } } })
  assert.equal(full.isLowerBound, false)
  assert.equal(full.fitsBudgetConfirmed, true)
  const legacy = computeBudget({ transportTotal: 1000, stayTotal: 2000, activitiesTotal: 100, days: 1, travellers: 1, budget: 50000 })
  assert.equal(legacy.breakdown.transport, 1000)
  assert.equal(legacy.isLowerBound, false)
})

test('budget: a lower bound already over budget is still a real violation', () => {
  const b = computeBudget({ days: 5, travellers: 4, budget: 1000, components: { transport: { amount: null, state: 'unavailable' }, stay: { amount: 500, state: 'live' }, activities: { amount: 0, state: 'live' } } })
  assert.equal(b.violated, true)
  assert.equal(b.isLowerBound, true)
})

// ---------------------------------------------------------- transport tool
test('transportTool: pricing basis — Amadeus party total used as-is, sample/train per-person prices multiplied', async () => {
  const res = await searchTransport({ destination: 'Goa', travellers: 3, budget: 500000, departureDate: '2099-06-15' })
  const sample = res.options.find((o) => o.mode === 'bus')
  assert.equal(sample.priceBasis, 'per_person')
  assert.equal(sample.totalPrice, sample.price * 3)

  mocks = installAll({ amadeus: { flights: () => amaJson({ data: flightOffersOk({ price: '9000.00' }) }) } })
  enableAll()
  const live = await searchTransport({ destination: 'Goa', travellers: 3, budget: 500000, departureDate: '2099-06-15' })
  const flight = live.options.find((o) => o.mode === 'flight')
  assert.equal(flight.dataSource, 'live')
  assert.equal(flight.priceBasis, 'party_total')
  assert.equal(flight.totalPrice, 9000)
})

test('transportTool: a non-INR provider price is never summed into an INR total', async () => {
  mocks = installAll({ amadeus: { flights: () => amaJson({ data: flightOffersOk({ price: '120.00', currency: 'EUR' }) }) } })
  const res = await searchTransport({ destination: 'Goa', travellers: 1, budget: 100000, departureDate: '2099-06-15' })
  const flight = res.options.find((o) => o.mode === 'flight')
  assert.equal(flight.totalPrice, null)
  assert.equal(flight.priceState, 'unavailable')
  assert.equal(flight.priceNote, 'currency_conversion_unavailable')
  assert.deepEqual(flight.priceOriginal, { amount: 120, currency: 'EUR', basis: 'party_total' })
})

test('transportTool: a train fare is fetched for the top live train, flagged with its assumed class, per person', async () => {
  mocks = installAll({ rail: { fare: () => railJson(fareOk({ totalFare: 875 })) } })
  const res = await searchTransport({ destination: 'Jaipur', travellers: 2, budget: 100000, preferredMode: 'train', departureDate: '2099-06-15' })
  const train = res.options.find((o) => o.mode === 'train' && o.dataSource === 'live')
  assert.equal(train.price, 875)
  assert.equal(train.totalPrice, 1750)
  assert.equal(train.fareBasis.assumedClass, true)
  assert.equal(train.fareBasis.classCode, '3A')
  assert.equal(res.sources.trainFare.state, 'live')
  assert.equal(mocks.calls.rail.fare, 1)
  assert.equal(train.availability, 'not_verified')
  assert.equal(train.bookingUrl, null)
})

test('transportTool: fare provider failure leaves the train price unavailable (neutral score, not zero)', async () => {
  mocks = installAll({ rail: { fare: () => railJson({}, 500) } })
  const res = await searchTransport({ destination: 'Jaipur', travellers: 2, budget: 100000, preferredMode: 'train', departureDate: '2099-06-15' })
  const train = res.options.find((o) => o.mode === 'train' && o.dataSource === 'live')
  assert.equal(train.price, null)
  assert.equal(train.totalPrice, null)
  assert.equal(train.priceState, 'unavailable')
  assert.equal(res.sources.trainFare.state, 'unavailable')
})

test('transportTool: replanning exclusions remove a mode but never leave the traveller with nothing', async () => {
  const res = await searchTransport({ destination: 'Goa', travellers: 1, budget: 100000, departureDate: '2099-06-15', excludeModes: ['flight'] })
  assert.ok(!res.options.some((o) => o.mode === 'flight'))
  assert.deepEqual(res.excludedModes, ['flight'])
  const all = await searchTransport({ destination: 'Goa', travellers: 1, budget: 100000, departureDate: '2099-06-15', excludeModes: ['flight', 'train', 'bus'] })
  assert.ok(all.options.length > 0)
  assert.deepEqual(all.excludedModes, [])
})

// ---------------------------------------------------------------- hotel tool
test('hotelTool: nightly price x nights x rooms; listing is never availability or a booking', async () => {
  const { options, source } = await searchHotels({ destination: 'Goa', nights: 3, rooms: 2 })
  const h = options[0]
  assert.equal(h.priceBasis, 'per_room_per_night')
  assert.equal(h.totalPrice, h.pricePerNight * 3 * 2)
  assert.equal(h.availability, 'not_verified')
  assert.equal(h.bookingStatus, 'not_booked')
  assert.equal(source.state, 'sample')
})

// -------------------------------------------------- weather / route tools
test('weatherTool: unavailable provider yields empty facts, missing dates listed, never throws', async () => {
  mocks = installAll({ owm: { current: () => owmJson({}, 500), forecast: () => owmJson({}, 500) } })
  const ctx = await getWeatherContext({ destination: 'Manali', startDate: START, days: 3 })
  assert.equal(ctx.current, null)
  assert.deepEqual(ctx.forecast, [])
  assert.equal(ctx.sources.forecast.state, 'unavailable')
  assert.equal(ctx.missingForecastDates.length, 3)
})

test('weatherTool: dates beyond the provider window are reported missing, not extrapolated', async () => {
  mocks = installAll({ owm: { forecast: () => owmJson(forecastFor(START, [0.1, 0.8])) } })
  const ctx = await getWeatherContext({ destination: 'Manali', startDate: START, days: 4 })
  assert.equal(ctx.sources.forecast.state, 'live')
  assert.equal(ctx.missingForecastDates.length, 2)
  assert.equal(isWetDay(ctx.forecast[1]), true)
  assert.equal(isWetDay(ctx.forecast[0]), false)
  assert.equal(isWetDay({ precipitationChancePct: null }), false)
})

test('routeTool: missing coordinates never reach the provider; provider failure is unavailable with a reason', async () => {
  mocks = installAll({ ors: () => orsJson({}, 500) })
  const none = await getRoute(null, { lat: 1, lng: 2 })
  assert.equal(none.dataSource, 'unavailable')
  assert.equal(none.fallbackReason, 'missing_coordinates')
  assert.equal(mocks.calls.ors.directions, 0)
  const failed = await getRoute({ lat: 32.25, lng: 77.18 }, { lat: 32.31, lng: 77.15 })
  assert.equal(failed.dataSource, 'unavailable')
  assert.equal(failed.durationMinutes, null)
})

test('routeTool: leg summary counts only measured legs (unavailable is not zero minutes)', async () => {
  mocks = installAll()
  const pairs = [
    { fromId: 'a', toId: 'b', from: { lat: 32.25, lng: 77.18 }, to: { lat: 32.31, lng: 77.15 } },
    { fromId: 'b', toId: 'c', from: { lat: 32.31, lng: 77.15 }, to: null },
  ]
  const { legs, summary } = await getRouteLegs(pairs)
  assert.equal(legs.length, 2)
  assert.equal(summary.legsLive, 1)
  assert.equal(summary.legsUnavailable, 1)
  assert.equal(summary.complete, false)
  assert.equal(summary.knownTravelMinutes, 13)
  assert.equal(summarizeLegs([]).source.state, 'unavailable')
})

// -------------------------------------------------------------- safety tool
test('safetyTool: reports provider forecast/route/train-status facts without safety verdicts', async () => {
  const weather = {
    current: { tempC: 9, description: 'light rain', condition: 'Rain' },
    forecast: [{ date: START, precipitationChancePct: 85, provider: 'openweathermap' }, { date: '2099-06-16', precipitationChancePct: 10, provider: 'openweathermap' }],
    sources: { current: { state: 'cached' }, forecast: { state: 'live' } },
  }
  const notes = await getSafetyNotes({
    destination: 'Manali', weather, tripDates: [START, '2099-06-16'],
    routes: { summary: { legsLive: 2, legsCached: 0, legsRequested: 3, knownTravelMinutes: 40 } },
    transport: { mode: 'train', trainNumber: '12958', status: 'RUNNING', delayMinutes: 12 },
  })
  assert.equal(notes.forecastNotes.length, 1)
  assert.match(notes.forecastNotes[0], /85%/)
  assert.match(notes.routeNotes[0], /2 of 3 legs measured/)
  assert.match(notes.transportNotes[0], /12 min delay/)
  assert.match(notes.weatherNote, /recently cached/)
  assert.ok(!/unsafe|dangerous|avoid|cancel/i.test(JSON.stringify([notes.forecastNotes, notes.routeNotes, notes.transportNotes])))
})

test('safetyTool: without weather it uses the static note and reports unavailable', async () => {
  const notes = await getSafetyNotes({ destination: 'Manali', weather: { current: null, forecast: [], sources: { current: { state: 'unavailable', fallbackReason: 'timeout' }, forecast: { state: 'unavailable' } } } })
  assert.equal(notes.weather, null)
  assert.equal(notes.weatherSource.state, 'unavailable')
  assert.match(notes.weatherNote, /landslide/i)
})

// ---------------------------------------------------- date/time consistency
test('flightNormalizer: airport-local times are not shifted by server timezone; duration uses provider elapsed time', () => {
  const raw = {
    id: 'x', price: { total: '100', currency: 'INR' },
    itineraries: [{ duration: 'PT7H40M', segments: [{ departure: { iataCode: 'DEL', at: '2099-06-15T23:30:00' }, arrival: { iataCode: 'LHR', at: '2099-06-16T04:10:00' }, carrierCode: 'AI', number: '111' }] }],
  }
  const f = normalizeAmadeusFlight(raw)
  assert.equal(f.departure, '23:30')
  assert.equal(f.arrival, '04:10')
  assert.equal(f.departureDate, '2099-06-15')
  assert.equal(f.arrivalDate, '2099-06-16')
  assert.equal(f.durationHours, 7.7, 'not the naive 4h40m difference of two local clocks')
  assert.deepEqual(resolveArrival(f), { known: true, dayIndex: 1, time: '04:10' })
})

test('resolveArrival: sample schedules and undated flights never shift the itinerary', () => {
  assert.equal(resolveArrival({ dataSource: 'sample', arrival: '08:00', departure: '18:00', durationHours: 14, mode: 'bus' }).known, false)
  assert.equal(resolveArrival({ dataSource: 'live', mode: 'flight', arrival: '10:00' }).known, false)
  assert.equal(resolveArrival({ dataSource: 'live', mode: 'train', arrival: '06:00', arrivalDayOffset: 1 }).dayIndex, 1)
  assert.equal(resolveArrival(null).known, false)
})

test('buildPlan: nothing is scheduled at the destination before arrival; overflow is carried or reported', async () => {
  const activities = ['A', 'B', 'C', 'D'].map((id) => act(id, 'culture', 'X'))
  const plan = await buildPlan({ days: 2, activities, slotsPerDay: 2, startDate: START, arrival: { known: true, dayIndex: 0, time: '16:00' } })
  const day1 = plan.days[0].stops
  assert.ok(day1.every((s) => s.startTime >= '17:30' || s.label === 'Dinner'), 'no stop before arrival + buffer except the fixed dinner slot')
  assert.ok(!day1.some((s) => s.label === 'Breakfast' || s.label === 'Lunch'))
  const scheduled = plan.days.flatMap((d) => d.stops).filter((s) => s.category !== 'food').length
  assert.equal(scheduled + plan.unscheduled.length, 4, 'every activity is scheduled or explicitly reported')
})

test('buildPlan: arriving on day 2 makes day 1 a travel day with no activities', async () => {
  const activities = ['A', 'B'].map((id) => act(id, 'culture', 'X'))
  const plan = await buildPlan({ days: 3, activities, slotsPerDay: 2, startDate: START, arrival: { known: true, dayIndex: 1, time: '09:00' } })
  assert.equal(plan.days[0].travelDay, true)
  assert.equal(plan.days[0].stops.filter((s) => s.category !== 'food').length, 0)
  assert.equal(plan.days[1].stops.filter((s) => s.category !== 'food').length, 2)
})

test('buildPlan: unknown arrival keeps the previous schedule unchanged', async () => {
  const plan = await buildPlan({ days: 1, activities: [act('A', 'culture', 'X')], slotsPerDay: 2, startDate: START, arrival: { known: false } })
  assert.ok(plan.days[0].stops.some((s) => s.label === 'Breakfast'))
  assert.equal(plan.unscheduled.length, 0)
})

// ------------------------------------------------------------ weather moves
test('assignActivitiesToDays: outdoor activities move off a provider-forecast wet day to a clearly drier one', () => {
  const activities = [act('A', 'nature', 'X'), act('B', 'culture', 'X'), act('C', 'culture', 'Y'), act('D', 'culture', 'Y'), act('E', 'nature', 'Z')]
  const forecastByDate = {
    [START]: { precipitationChancePct: 90 }, '2099-06-16': { precipitationChancePct: 10 }, '2099-06-17': { precipitationChancePct: 10 },
  }
  const { buckets, weatherAdjustments } = assignActivitiesToDays({ days: 3, activities, slotsPerDay: 2, startDate: START, forecastByDate })
  assert.equal(weatherAdjustments.length, 1)
  assert.equal(weatherAdjustments[0].fromDay, 1)
  assert.match(weatherAdjustments[0].reason, /90%/)
  assert.ok(!buckets[0].some((a) => a.category === 'nature'))
  assert.equal(buckets.flat().length, 5, 'nothing dropped')
})

test('assignActivitiesToDays: without forecast data the original grouping is untouched', () => {
  const activities = [act('A', 'nature', 'X'), act('B', 'culture', 'Y')]
  const { buckets, weatherAdjustments } = assignActivitiesToDays({ days: 2, activities, slotsPerDay: 1, startDate: START, forecastByDate: {} })
  assert.equal(weatherAdjustments.length, 0)
  assert.deepEqual(buckets.map((b) => b.map((a) => a.id)), [['A'], ['B']])
})

// ------------------------------------------------ critic / replanning units
function critiqueContext(overrides = {}) {
  const ctx = new AgentContext({ tripRequest: {}, runId: 'r', userId: 'u' })
  Object.assign(ctx.state, {
    intent: { days: 2, accessibility: [], dateIssues: [], startDate: START, endDate: '2099-06-16', ...overrides.intent },
    transport: { data: { recommended: { mode: 'flight', dataSource: 'live', withinBudget: true, coverage: 'round_trip', ...overrides.transportRec }, arrival: overrides.arrival || { known: false } } },
    stay: { data: { recommended: { id: 'h1', withinBudget: true } } },
    activities: { data: { selected: overrides.selected || [act('A', 'culture', 'X')], slotsPerDay: 3, routes: overrides.routes || null, weather: overrides.weather || null } },
    budget: { data: { violated: false, isLowerBound: false, unavailable: [] } },
    weather: overrides.weatherState || null,
  })
  return ctx
}

test('critic: missing transport/stay are high-severity and request an alternative search', async () => {
  const ctx = critiqueContext()
  ctx.state.transport = { data: { recommended: null } }
  ctx.state.stay = { data: { recommended: null } }
  const res = await new CriticAgent().execute(ctx)
  const types = res.data.issues.map((i) => i.type)
  assert.ok(types.includes('missing_transport') && types.includes('missing_stay'))
  assert.equal(res.data.approved, false)
  assert.ok(res.data.requiredChanges.some((c) => c.type === 'find_alternative_transport'))
  assert.ok(res.data.requiredChanges.some((c) => c.type === 'find_alternative_stay'))
})

test('critic: arrival after the trip window is high; late day-one arrival is informational', async () => {
  const late = await new CriticAgent().execute(critiqueContext({ arrival: { known: true, dayIndex: 2, time: '06:00' } }))
  assert.ok(late.data.issues.some((i) => i.type === 'arrival_after_trip_end' && i.severity === 'high'))
  const evening = await new CriticAgent().execute(critiqueContext({ arrival: { known: true, dayIndex: 0, time: '19:00' } }))
  assert.ok(evening.data.issues.some((i) => i.type === 'late_arrival_day_one' && i.severity === 'low'))
  assert.equal(evening.data.approved, true)
})

test('critic: measured routing data (not just area counts) can flag excessive travel', async () => {
  const routes = { legsLive: 4, legsCached: 0, legsRequested: 4, knownTravelMinutes: 700 }
  const res = await new CriticAgent().execute(critiqueContext({ routes }))
  assert.ok(res.data.issues.some((i) => i.type === 'excessive_travel' && /routing provider/.test(i.detail)))
})

test('critic: stale cached data and lower-bound budgets are surfaced as low-severity issues', async () => {
  const ctx = critiqueContext()
  ctx.state.sources.hotels = { state: 'cached', stale: true }
  ctx.state.budget = { data: { violated: false, isLowerBound: true, unavailable: ['stay'] } }
  const res = await new CriticAgent().execute(ctx)
  const types = res.data.issues.map((i) => i.type)
  assert.ok(types.includes('stale_data') && types.includes('budget_incomplete'))
  assert.equal(res.data.approved, true)
})

test('critic: weather exposure asks for indoor re-ranking once, then stays informational', async () => {
  const selected = [act('A', 'nature', 'X'), act('B', 'adventure', 'X')]
  const forecast = [{ date: START, precipitationChancePct: 80 }, { date: '2099-06-16', precipitationChancePct: 75 }]
  const weather = { wetDates: [START, '2099-06-16'], outdoorSelected: 2 }
  const first = critiqueContext({ selected, weather, weatherState: { forecast } })
  const r1 = await new CriticAgent().execute(first)
  assert.ok(r1.data.requiredChanges.some((c) => c.type === 'adjust_for_weather'))
  const second = critiqueContext({ selected, weather, weatherState: { forecast } })
  second.adjustments.preferIndoor = true
  const r2 = await new CriticAgent().execute(second)
  assert.ok(!r2.data.requiredChanges.some((c) => c.type === 'adjust_for_weather'))
  assert.equal(r2.data.issues.find((i) => i.type === 'weather_exposure').severity, 'low')
})

test('replanning: alternative transport/stay and weather changes map onto existing agent reruns', async () => {
  const ctx = critiqueContext()
  ctx.state.critique = { data: { issues: [], requiredChanges: [
    { type: 'find_alternative_transport' }, { type: 'find_alternative_stay' }, { type: 'adjust_for_weather' },
  ] } }
  const res = await new ReplanningAgent().execute(ctx)
  assert.deepEqual(res.data.rerunAgents.sort(), ['Activity Agent', 'Stay Agent', 'Transport Agent'])
  assert.deepEqual(ctx.adjustments.excludeTransportModes, ['flight'])
  assert.deepEqual(ctx.adjustments.excludeStayIds, ['h1'])
  assert.equal(ctx.adjustments.preferIndoor, true)
})

// --------------------------------------------------------------------- LLM
test('LLM: rule-based explanations never print NaN/null for unavailable prices or ratings', async () => {
  const p = new RuleBasedProvider()
  const stay = await p.explain('stay', { option: { rating: null, pricePerNight: null, totalPrice: null, area: '' }, alternatives: [], nights: 2 })
  const transport = await p.explain('transport', { option: { mode: 'flight', totalPrice: null, durationHours: null, dataSource: 'live' }, alternatives: [] })
  for (const text of [stay, transport]) assert.ok(!/NaN|null|undefined/.test(text), text)
  assert.match(stay, /availability not verified/)
})

test('LLM: Ollama prompt carries the no-fabrication guard and only slimmed planning fields', async () => {
  const provider = new LocalOllamaProvider()
  provider.baseUrl = 'http://ollama.test'
  provider.model = 'm'
  const realFetch = globalThis.fetch
  let body
  globalThis.fetch = async (url, init) => { body = JSON.parse(init.body); return new Response(JSON.stringify({ response: 'ok' }), { status: 200 }) }
  try {
    await provider.explain('stay', { option: { id: 'h', name: 'H', pricePerNight: null, address: '1 Secret Rd', bookingUrl: 'https://x', images: ['i'], coordinates: { lat: 1, lng: 2 } }, alternatives: [], nights: 1 })
  } finally { globalThis.fetch = realFetch }
  assert.match(body.prompt, /Do not fabricate or estimate prices/)
  assert.ok(!body.prompt.includes('Secret Rd') && !body.prompt.includes('bookingUrl') && !body.prompt.includes('images'))
  assert.deepEqual(Object.keys(slimForPrompt({ id: 1, address: 'x', name: 'n' })), ['id', 'name'])
})

test('env keys are never present on tool outputs', async () => {
  mocks = installAll()
  const t = await searchTransport({ destination: 'Goa', travellers: 1, budget: 100000, departureDate: '2099-06-15' })
  const h = await searchHotels({ destination: 'Goa' })
  const blob = JSON.stringify([t, h])
  for (const k of Object.values(env.providers)) if (k) assert.ok(!blob.includes(k))
})
