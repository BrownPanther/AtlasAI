import { db } from './support/setup.js'
import test, { beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { getSafetyNotes } from '../src/tools/safetyTool.js'
import { weatherService } from '../src/services/weatherService.js'
import { env } from '../src/config/env.js'
import { installOwmMock, currentOk, json } from './support/owmFixtures.js'

let mock

beforeEach(() => {
  db.exec('DELETE FROM provider_cache')
  weatherService._resetForTests()
  env.providers.weatherApiKey = ''
})
afterEach(() => mock?.restore())

test('safetyTool: with no weather provider configured, falls back to the static sample weather note', async () => {
  const notes = await getSafetyNotes({ destination: 'Manali', accessibilityNeeds: [] })
  assert.equal(notes.weather, null)
  assert.ok(notes.weatherNote, 'the static sample note must still be present')
})

test('safetyTool: with a configured weather provider, the note reflects a real current reading', async () => {
  env.providers.weatherApiKey = 'key'
  mock = installOwmMock({ current: () => json(currentOk({ tempC: 5, condition: 'Snow', description: 'light snow' })) })
  const notes = await getSafetyNotes({ destination: 'Manali', accessibilityNeeds: [] })
  assert.ok(notes.weather, 'a live weather reading should be attached')
  assert.equal(notes.weather.tempC, 5)
  assert.match(notes.weatherNote, /5.?°?C/)
  assert.match(notes.weatherNote, /light snow/)
})

test('safetyTool: a provider failure never fabricates a reading — falls back to the static note instead', async () => {
  env.providers.weatherApiKey = 'key'
  mock = installOwmMock({ current: () => json({}, 500) })
  const notes = await getSafetyNotes({ destination: 'Manali', accessibilityNeeds: [] })
  assert.equal(notes.weather, null)
  assert.ok(notes.weatherNote)
})
