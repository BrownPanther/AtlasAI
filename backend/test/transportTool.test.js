import { db } from './support/setup.js'
import test, { beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { getTransportOptions } from '../src/tools/transportTool.js'
import { flightsService } from '../src/services/flightsService.js'
import { amadeusProvider } from '../src/providers/amadeusProvider.js'
import { trainsService } from '../src/services/trainsService.js'
import { env } from '../src/config/env.js'
import { installAmadeusMock, json, flightOffersOk } from './support/amadeusFixtures.js'
import { installRailRadarMock, json as railJson } from './support/railRadarFixtures.js'

let mock
let railMock
const FUTURE_DATE = '2099-06-15'

beforeEach(() => {
  db.exec('DELETE FROM provider_cache')
  flightsService._resetForTests()
  amadeusProvider._resetForTests()
  trainsService._resetForTests()
  env.providers.amadeusApiKey = ''
  env.providers.amadeusApiSecret = ''
  env.providers.trainsApiKey = ''
})
afterEach(() => {
  mock?.restore()
  railMock?.restore()
})

test('transportTool: with no credentials, still returns scored sample options (bus/train/flight) for a known destination', async () => {
  const options = await getTransportOptions({ destination: 'Manali', travellers: 2, budget: 10000, departureDate: FUTURE_DATE })
  assert.ok(options.length > 0)
  assert.ok(options.every((o) => o.dataSource === 'sample'))
  assert.ok(options.some((o) => o.mode === 'flight'))
  for (let i = 1; i < options.length; i++) assert.ok(options[i].score >= options[i - 1].score)
})

test('transportTool: a missing departure date still returns sample options rather than failing', async () => {
  const options = await getTransportOptions({ destination: 'Manali', travellers: 1 })
  assert.ok(options.length > 0)
})

test('transportTool: real flight offers replace the sample flight option when the provider is configured', async () => {
  env.providers.amadeusApiKey = 'key'
  env.providers.amadeusApiSecret = 'secret'
  mock = installAmadeusMock({ flights: () => json({ data: flightOffersOk({ price: '4300.00' }) }) })
  const options = await getTransportOptions({ destination: 'Goa', travellers: 1, budget: 20000, departureDate: FUTURE_DATE })
  const flights = options.filter((o) => o.mode === 'flight')
  assert.equal(flights.length, 1)
  assert.equal(flights[0].dataSource, 'live')
  assert.equal(flights[0].price, 4300)
  const nonFlights = options.filter((o) => o.mode !== 'flight')
  assert.ok(nonFlights.every((o) => o.dataSource === 'sample'), 'other modes stay sample data unless their own provider is configured')
})

test('transportTool: a provider failure keeps the sample flight option instead of dropping the mode', async () => {
  env.providers.amadeusApiKey = 'key'
  env.providers.amadeusApiSecret = 'secret'
  mock = installAmadeusMock({ flights: () => json({}, 500) })
  const options = await getTransportOptions({ destination: 'Goa', travellers: 1, budget: 20000, departureDate: FUTURE_DATE })
  const flights = options.filter((o) => o.mode === 'flight')
  assert.equal(flights.length, 1)
  assert.equal(flights[0].dataSource, 'sample')
})

test('transportTool: real train offers replace the sample train option when RailRadar is configured', async () => {
  env.providers.trainsApiKey = 'key'
  railMock = installRailRadarMock()
  const options = await getTransportOptions({ destination: 'Jaipur', travellers: 1, budget: 20000, departureDate: FUTURE_DATE })
  const trains = options.filter((o) => o.mode === 'train')
  assert.equal(trains.length, 1)
  assert.equal(trains[0].dataSource, 'live')
  assert.equal(trains[0].provider, 'railradar')
  assert.equal(trains[0].bookingUrl, null)
  const nonTrains = options.filter((o) => o.mode !== 'train')
  assert.ok(nonTrains.every((o) => o.dataSource === 'sample'), 'other modes stay sample data unless their own provider is configured')
})

test('transportTool: a RailRadar failure keeps the sample train option instead of dropping the mode', async () => {
  env.providers.trainsApiKey = 'key'
  railMock = installRailRadarMock({ between: () => railJson({}, 500) })
  const options = await getTransportOptions({ destination: 'Jaipur', travellers: 1, budget: 20000, departureDate: FUTURE_DATE })
  const trains = options.filter((o) => o.mode === 'train')
  assert.equal(trains.length, 1)
  assert.equal(trains[0].dataSource, 'sample')
})

test('transportTool: flights and trains can each be live independently, at the same time', async () => {
  env.providers.amadeusApiKey = 'key'
  env.providers.amadeusApiSecret = 'secret'
  env.providers.trainsApiKey = 'key'
  mock = installAmadeusMock()
  railMock = installRailRadarMock()
  const options = await getTransportOptions({ destination: 'Goa', travellers: 1, budget: 20000, departureDate: FUTURE_DATE })
  assert.equal(options.find((o) => o.mode === 'flight').dataSource, 'live')
  assert.equal(options.find((o) => o.mode === 'train').dataSource, 'live')
})

test('transportTool: an option over budget scores worse than one within budget', async () => {
  const options = await getTransportOptions({ destination: 'Manali', travellers: 1, budget: 2000, departureDate: FUTURE_DATE })
  const withinBudget = options.filter((o) => o.withinBudget)
  const overBudget = options.filter((o) => !o.withinBudget)
  assert.ok(withinBudget.length > 0 && overBudget.length > 0)
  assert.ok(Math.min(...withinBudget.map((o) => o.score)) < Math.min(...overBudget.map((o) => o.score)))
})
