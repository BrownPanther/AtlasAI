import './support/setup.js'
import test, { before, after, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createApp } from '../src/app.js'
import { env } from '../src/config/env.js'
import { resetAll, enableAll, installAll, forecastFor, TRIP, START } from './support/realDataHarness.js'
import { json as owmJson } from './support/owmFixtures.js'

let server, base, token, mocks
before(async () => {
  server = createApp().listen(0)
  await new Promise((r) => server.once('listening', r))
  base = `http://127.0.0.1:${server.address().port}/api`
  const res = await fetch(`${base}/auth/register`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: 'planner', email: 'p@example.com', password: 'password123' }) })
  token = (await res.json()).token
})
after(() => server.close())
beforeEach(() => { resetAll(); enableAll() })
afterEach(() => { mocks?.restore(); mocks = null })

const post = (p, body) => fetch(`${base}${p}`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body: JSON.stringify(body) })
const provide = (o = {}) => { mocks = installAll({ owm: { forecast: () => owmJson(forecastFor(START)) }, ...o }) }

test('POST /ai/plan: full mocked multi-agent flow returns normalized data with per-source status and no credentials', async () => {
  provide()
  const res = await post('/ai/plan', TRIP)
  assert.equal(res.status, 201)
  const text = await res.text()
  const { state } = JSON.parse(text)
  const fp = state.finalPlan
  assert.equal(fp.dataSource, 'live')
  assert.equal(fp.sourceStatus.hotels.state, 'live')
  assert.equal(fp.transport.bookingStatus, 'not_booked')
  assert.ok(state.executionTrace === undefined || Array.isArray(state.executionTrace))
  for (const secret of ['otm-key', 'ors-key', 'ama-key', 'ama-secret', 'rail-key', 'owm-key']) assert.ok(!text.includes(secret), `${secret} leaked`)
  assert.ok(!/https?:\/\/(api|test\.api)\./.test(JSON.stringify(state.finalPlan.sourceStatus)), 'no provider URLs in source status')
})

test('POST /ai/plan/stream: SSE carries progress events for each real-data step and a done event, no credentials', async () => {
  provide()
  const res = await post('/ai/plan/stream', TRIP)
  assert.equal(res.status, 200)
  const body = await res.text()
  const events = body.split('\n\n').map((f) => f.split('\n').find((l) => l.startsWith('data: '))).filter(Boolean).map((l) => JSON.parse(l.slice(6)))
  const summaries = events.filter((e) => e.type === 'trace').map((e) => e.entry.summary).filter(Boolean)
  for (const s of ['Searching attractions…', 'Finding accommodations…', 'Searching flights and trains…', 'Checking weather…', 'Calculating routes…']) assert.ok(summaries.includes(s), s)
  const done = events.find((e) => e.type === 'done')
  assert.ok(done?.state?.finalPlan)
  for (const secret of ['otm-key', 'ors-key', 'ama-key', 'ama-secret', 'rail-key', 'owm-key']) assert.ok(!body.includes(secret))
})

test('POST /ai/plan with every provider failing still completes with an honest, labelled plan', async () => {
  provide({
    otm: { geoname: () => new Response('{}', { status: 500 }) },
    ors: () => new Response('{}', { status: 500 }),
    amadeus: { flights: () => new Response('{}', { status: 500 }), byCity: () => new Response('{}', { status: 500 }) },
    rail: { between: () => new Response('{}', { status: 500 }), stations: () => new Response('{}', { status: 500 }) },
    owm: { current: () => new Response('{}', { status: 500 }), forecast: () => new Response('{}', { status: 500 }) },
  })
  const res = await post('/ai/plan', TRIP)
  assert.equal(res.status, 201)
  const fp = (await res.json()).state.finalPlan
  assert.equal(fp.dataSource, 'sample')
  assert.equal(fp.sourceStatus.weather.state, 'unavailable')
  assert.equal(fp.sourceStatus.routes.state, 'unavailable')
  assert.equal(fp.days.length, 3)
})

test('stream error events never carry stack traces or URLs', async () => {
  const res = await post('/ai/plan/stream', { ...TRIP, destination: '' })
  const text = await res.text()
  assert.ok(!/\bat .*\.js:\d+/.test(text))
})

// ---------------------------------------------------- static architecture checks
const here = path.dirname(fileURLToPath(import.meta.url))
const src = path.join(here, '../src')
const read = (dir) => fs.readdirSync(path.join(src, dir)).filter((f) => f.endsWith('.js')).map((f) => ({ f: `${dir}/${f}`, text: fs.readFileSync(path.join(src, dir, f), 'utf8') }))

test('architecture: agents and tools reach data only through services — never providers, fetch or credentials', () => {
  for (const { f, text } of [...read('agents'), ...read('tools')]) {
    assert.ok(!/from '\.\.\/providers\//.test(text), `${f} imports a provider`)
    assert.ok(!/\bfetch\(/.test(text), `${f} calls fetch directly`)
    assert.ok(!/env\.providers|apiKey|API_KEY/.test(text), `${f} touches provider credentials`)
  }
})

test('architecture: only tools import services; agents import tools/llm, not services', () => {
  for (const { f, text } of read('agents')) assert.ok(!/from '\.\.\/services\//.test(text), `${f} imports a service directly`)
})

test('architecture: every agent declares its tools and the registry has no unknown agent', async () => {
  const { agents } = await import('../src/agents/registry.js')
  assert.deepEqual(agents.activity.tools.sort(), ['attractionTool', 'routeTool', 'weatherTool'])
  assert.deepEqual(agents.stay.tools, ['hotelTool'])
  assert.deepEqual(agents.transport.tools, ['transportTool'])
  assert.deepEqual(agents.budget.tools, ['budgetTool'])
  assert.deepEqual(agents.safety.tools.sort(), ['safetyTool', 'weatherTool'])
  assert.ok(env.nodeEnv === 'test')
})
