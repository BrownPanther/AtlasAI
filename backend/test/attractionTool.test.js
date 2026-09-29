import { db } from './support/setup.js'
import test, { beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { AgentContext } from '../src/agents/AgentContext.js'
import { getAttractions } from '../src/tools/attractionTool.js'
import { ActivityAgent } from '../src/agents/ActivityAgent.js'
import { attractionsService } from '../src/services/attractionsService.js'
import { buildDays } from '../src/tools/itineraryTool.js'
import { env } from '../src/config/env.js'
import { installOpenTripMapMock, json } from './support/otmFixtures.js'

let mock
const KEY = env.providers.attractionsApiKey
beforeEach(() => { db.exec('DELETE FROM provider_cache'); attractionsService._resetForTests(); env.providers.attractionsApiKey = KEY })
afterEach(() => mock?.restore())

test('tool: with a configured provider it returns concise planning records', async () => {
  mock = installOpenTripMapMock()
  const r = await getAttractions({ destination: 'Manali', interests: ['culture'], pace: 'relaxed' })
  assert.equal(r.dataSource, 'live')
  assert.equal(r.slotsPerDay, 2)
  assert.equal(r.attractions[0].name, 'Hadimba Temple') // culture match + highest popularity
  const a = r.attractions[0]
  assert.equal(a.interestMatch, true)
  assert.equal(a.costKnown, false)
  assert.equal(a.estimatedCost, 0)
  assert.equal(a.durationEstimated, true)
  assert.ok(a.summary.length <= 161)
  for (const heavy of ['description', 'address', 'images', 'wikidataId', 'kinds', 'providerUrl', 'website']) {
    assert.ok(!(heavy in a), `planning record must not carry "${heavy}"`)
  }
  assert.ok(JSON.stringify(r).length < 6000, 'agent payload stays small')
})

test('tool: zero keys keeps the existing sample behaviour', async () => {
  env.providers.attractionsApiKey = ''
  const r = await getAttractions({ destination: 'Manali', interests: ['nature'] })
  assert.equal(r.dataSource, 'sample')
  assert.equal(r.fallbackReason, 'not_configured')
  assert.ok(r.attractions.some((a) => a.name === 'Rohtang Pass'))
  assert.ok(r.attractions.every((a) => a.costKnown === true && typeof a.durationHours === 'number'))
  const unknown = await getAttractions({ destination: 'Somewhere New', interests: [] })
  assert.equal(unknown.dataSource, 'sample')
  assert.ok(unknown.attractions.length > 0)
})

test('tool: provider failure falls back to sample without throwing', async () => {
  mock = installOpenTripMapMock({ geoname: () => json({}, 500) })
  const r = await getAttractions({ destination: 'Goa', interests: [] })
  assert.equal(r.dataSource, 'sample')
})

function fakeContext(intent) {
  const ctx = new AgentContext({ tripRequest: {}, runId: 'test', userId: 'test' })
  ctx.state.intent = intent
  return ctx
}

test('ActivityAgent consumes normalized live data end to end', async () => {
  mock = installOpenTripMapMock()
  const agent = new ActivityAgent()
  const res = await agent.execute(fakeContext({ destination: 'Manali', interests: ['culture', 'nature'], pace: 'moderate', days: 2, budget: 30000 }))
  assert.equal(res.status, 'success')
  assert.equal(res.data.dataSource, 'live')
  assert.equal(res.data.provider, 'opentripmap')
  assert.equal(res.data.selected.length, 3)
  assert.equal(res.data.totalCost, 0, 'unknown prices are not invented')
  assert.ok(res.reasoning.constraintsConsidered.some((c) => c.includes('attraction data: live (opentripmap)')))

  const days = await buildDays({ days: 2, activities: res.data.selected, slotsPerDay: res.data.slotsPerDay, startDate: '2026-10-10' })
  const stop = days.flatMap((d) => d.stops).find((s) => s.id === 'N1')
  assert.equal(stop.costKnown, false)
  assert.equal(stop.durationEstimated, true)
  assert.equal(stop.dataSource, 'live')
})

test('ActivityAgent still works with zero keys', async () => {
  env.providers.attractionsApiKey = ''
  const res = await new ActivityAgent().execute(fakeContext({ destination: 'Jaipur', interests: ['history'], pace: 'moderate', days: 3, budget: 50000 }))
  assert.equal(res.data.dataSource, 'sample')
  assert.ok(res.data.selected.length > 0)
})
