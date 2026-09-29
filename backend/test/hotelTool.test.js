import { db } from './support/setup.js'
import test, { beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { getHotels } from '../src/tools/hotelTool.js'
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

test('hotelTool: with no credentials, still returns scored sample hotels for a known destination', async () => {
  const options = await getHotels({ destination: 'Manali', nights: 3, budgetPerNight: 2000, comfortPref: 'Budget' })
  assert.ok(options.length > 0)
  assert.ok(options.every((h) => h.dataSource === 'sample'))
  // sorted ascending by score (lower is better)
  for (let i = 1; i < options.length; i++) assert.ok(options[i].score >= options[i - 1].score)
})

test('hotelTool: live hotels with an unknown price are scored neutrally, not penalized', async () => {
  env.providers.amadeusApiKey = 'key'
  env.providers.amadeusApiSecret = 'secret'
  mock = installAmadeusMock({ offers: () => json({ data: [{ hotel: { hotelId: 'X1', name: 'No Offer Inn' }, offers: [] }] }) })
  const options = await getHotels({ destination: 'Goa', nights: 2, budgetPerNight: 3000, comfortPref: 'Standard' })
  assert.equal(options[0].priceKnown, false)
  assert.equal(options[0].totalPrice, null)
  assert.equal(options[0].withinBudget, true, 'unknown price must not be treated as over budget')
})

test('hotelTool: a hotel over budget scores worse than one within budget', async () => {
  const options = await getHotels({ destination: 'Manali', nights: 1, budgetPerNight: 900, comfortPref: 'Budget' })
  const withinBudget = options.filter((h) => h.withinBudget)
  const overBudget = options.filter((h) => !h.withinBudget)
  assert.ok(withinBudget.length > 0 && overBudget.length > 0)
  assert.ok(Math.min(...withinBudget.map((h) => h.score)) < Math.min(...overBudget.map((h) => h.score)))
})

test('hotelTool: totalPrice is strictly pricePerNight * nights * rooms', async () => {
  const options = await getHotels({ destination: 'Manali', nights: 14, rooms: 2, budgetPerNight: Infinity, comfortPref: 'Standard' })
  for (const h of options) {
    if (h.priceKnown) {
      assert.strictEqual(h.totalPrice, h.pricePerNight * 14 * 2)
    }
  }
})
