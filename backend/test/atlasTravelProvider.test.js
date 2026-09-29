import './support/env.js'
import test, { beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { db } from './support/setup.js'
import { env } from '../src/config/env.js'
import { atlasTravelProvider } from '../src/providers/atlasTravelProvider.js'
import { flightsService } from '../src/services/flightsService.js'
import { hotelsService } from '../src/services/hotelsService.js'
import { searchTransport } from '../src/tools/transportTool.js'
import { searchHotels } from '../src/tools/hotelTool.js'
import { computeBudget } from '../src/tools/budgetTool.js'
import { toFlightListItem, toListItem } from '../../travel-planner/services/reservationMappers.js'

beforeEach(() => {
  db.exec('DELETE FROM provider_cache')
  flightsService._resetForTests()
  hotelsService._resetForTests()
  env.flightProvider = 'atlas'
  env.hotelProvider = 'atlas'
  env.providers.amadeusApiKey = ''
  env.providers.amadeusApiSecret = ''
  env.providers.duffelApiKey = ''
})

test('1. estimated flight result: legitimate reference flight data with truthful metadata and no fake flight numbers', async () => {
  const result = await atlasTravelProvider.searchFlights({
    origin: 'DEL',
    destination: 'BOM',
    departureDate: '2026-10-15',
  })

  assert.equal(result.ok, true)
  assert.equal(result.dataSource, 'estimated')
  assert.equal(result.sourceType, 'estimated')
  assert.ok(result.flights.length > 0)

  const flight = result.flights[0]
  // Real airport codes
  assert.equal(flight.origin, 'DEL')
  assert.equal(flight.destination, 'BOM')
  // Real airline name
  assert.ok(typeof flight.airline === 'string' && flight.airline.length > 0)
  // Realistic benchmark duration
  assert.ok(flight.durationMinutes >= 110 && flight.durationMinutes <= 150)
  assert.match(flight.durationText, /Approx\.\s*2h/i)
  // Realistic price range for Delhi - Mumbai
  assert.ok(flight.priceRange.min >= 3500 && flight.priceRange.max <= 8000)
  assert.ok(flight.priceRange.formatted.includes('₹'))
  // Truthful metadata: no fabricated flight numbers or live availability
  assert.equal(flight.flightNumber, null)
  assert.equal(flight.liveAvailability, false)
  assert.equal(flight.sourceType, 'estimated')
  assert.equal(flight.statusLabel, 'Planning estimate')
  assert.equal(flight.statusDetail, 'Live availability unavailable')
})

test('2. estimated hotel result: real micro-locations, authentic reference hotels, and tier price ranges', async () => {
  const result = await atlasTravelProvider.searchHotels({
    destination: 'Manali',
  })

  assert.equal(result.ok, true)
  assert.equal(result.dataSource, 'estimated')
  assert.equal(result.sourceType, 'estimated')
  assert.ok(result.hotels.length >= 3)

  for (const hotel of result.hotels) {
    // Real destination and micro-locations
    assert.equal(hotel.destination, 'Manali')
    assert.ok(typeof hotel.area === 'string' && hotel.area.length > 0)
    // Authentic reference hotel names
    assert.ok(typeof hotel.name === 'string' && hotel.name.length > 0)
    // Realistic price ranges per night across tiers
    assert.ok(hotel.priceRange.min > 0)
    assert.ok(hotel.priceRange.max >= hotel.priceRange.min)
    assert.ok(hotel.priceRange.formatted.includes('₹'))
    // Explicit estimate metadata
    assert.equal(hotel.liveAvailability, false)
    assert.equal(hotel.sourceType, 'estimated')
    assert.ok(hotel.statusLabel === 'Reference property' || hotel.statusLabel === 'Estimated stay cost')
    assert.equal(hotel.statusDetail, 'Reference estimate')
  }
})

test('3. sourceType propagation: flows through Services and Tools', async () => {
  // FlightsService -> transportTool
  const flightResult = await flightsService.getFlights('Delhi', 'Mumbai', '2026-10-15')
  assert.equal(flightResult.dataSource, 'estimated')
  assert.equal(flightResult.sourceType, 'estimated')
  assert.equal(flightResult.provider, 'AtlasTravelProvider')
  assert.ok(flightResult.flights[0].sourceType === 'estimated')

  const transportOut = await searchTransport({
    destination: 'Mumbai',
    departureDate: '2026-10-15',
    budget: 50000,
    travellers: 1,
  })
  const flightOption = transportOut.options.find((o) => o.mode === 'flight')
  assert.ok(flightOption, 'a flight option should be returned')
  assert.equal(flightOption.sourceType, 'estimated')
  assert.ok(flightOption.dataSource === 'estimated' || flightOption.dataSource === 'cached')
  assert.ok(transportOut.sources.flights.state === 'estimated' || transportOut.sources.flights.state === 'cached')

  // HotelsService -> hotelTool
  const hotelResult = await hotelsService.getHotels('Manali')
  assert.equal(hotelResult.dataSource, 'estimated')
  assert.equal(hotelResult.sourceType, 'estimated')
  assert.equal(hotelResult.provider, 'AtlasTravelProvider')
  assert.ok(hotelResult.hotels[0].sourceType === 'estimated')

  const hotelToolOut = await searchHotels({ destination: 'Manali' })
  assert.ok(hotelToolOut.options.length > 0)
  assert.equal(hotelToolOut.options[0].sourceType, 'estimated')
  assert.ok(hotelToolOut.source.state === 'estimated' || hotelToolOut.source.state === 'cached')
})

test('4. unknown cost not becoming zero: unavailable prices remain null and lower bound is flagged', () => {
  const budget = computeBudget({
    components: {
      transport: { amount: null, state: 'unavailable' },
      stay: { amount: 5000, state: 'estimated' },
      activities: { amount: 1500, state: 'live' },
    },
    days: 3,
    travellers: 2,
  })

  // Unknown transport price remains null in raw amounts and components — NEVER 0
  assert.equal(budget.rawAmounts.transport, null)
  assert.equal(budget.components.transport.amount, null)
  assert.ok(budget.unavailable.includes('transport'))
  assert.ok(budget.costs.unknown.includes('transport'))
  assert.equal(budget.isLowerBound, true)
  assert.equal(budget.isConfirmed, false)
  // Total is flagged as incomplete lower bound, not an exact or confirmed figure
  assert.ok(budget.total > 0)
})

test('5. budget handling with estimated costs: separates known vs estimated and is never marked confirmed', () => {
  const budget = computeBudget({
    components: {
      transport: { amount: 8000, state: 'estimated' },
      stay: { amount: 12000, state: 'estimated' },
      activities: { amount: 3000, state: 'live' },
    },
    days: 4,
    travellers: 2,
    budget: 50000,
  })

  // Confirmed costs are strictly from live/cached components
  assert.equal(budget.costs.known, 3000)
  // Planning data layer and allowance costs are accumulated under estimated
  assert.ok(budget.costs.estimated >= 20000)
  // Estimated costs MUST NOT be treated as confirmed costs
  assert.equal(budget.isConfirmed, false)
  assert.equal(budget.costs.unknown.length, 0)
})

test('6. frontend status labels: truthful display without fake Available badges', () => {
  const mockEstimatedFlight = {
    id: 'fl-1',
    airline: 'IndiGo',
    from: 'DEL',
    to: 'BOM',
    durationText: 'Approx. 2h 10m',
    price: 5250,
    priceRange: { min: 4500, max: 6000, formatted: '₹4,500–₹6,000' },
    sourceType: 'estimated',
    dataSource: 'estimated',
    statusLabel: 'Planning estimate',
    statusDetail: 'Live availability unavailable',
  }

  const flightRow = toFlightListItem(mockEstimatedFlight)
  assert.equal(flightRow.status, '≈ Planning estimate')
  assert.notEqual(flightRow.status, 'Available', 'must NOT display a fake Available badge')
  assert.equal(flightRow.statusDetail, 'Live availability unavailable')
  assert.equal(flightRow.time, 'Approx. 2h 10m')
  assert.equal(flightRow.priceFormatted, '₹4,500–₹6,000')
  assert.equal(flightRow.actionText, 'Search live availability')
  assert.equal(flightRow.isEstimate, true)

  const mockEstimatedHotel = {
    id: 'ht-1',
    name: 'The Himalayan',
    area: 'Hadimba Road, Manali',
    tier: 'premium',
    priceRange: { min: 6500, max: 10500, formatted: '₹6,500–₹10,500' },
    sourceType: 'estimated',
    dataSource: 'estimated',
    statusLabel: 'Reference property',
    statusDetail: 'Reference estimate',
  }

  const hotelRow = toListItem(mockEstimatedHotel)
  assert.equal(hotelRow.status, '≈ Reference estimate')
  assert.notEqual(hotelRow.status, 'Available', 'must NOT display a fake Available badge')
  assert.equal(hotelRow.statusDetail, 'Reference estimate')
  assert.equal(hotelRow.priceFormatted, '₹6,500–₹10,500 / night')
  assert.equal(hotelRow.actionText, 'Check live availability')
  assert.equal(hotelRow.isEstimate, true)
})
