// Shared harness for R7 agent-level integration tests. Every provider is a
// mocked global fetch — no live API is ever contacted. Import AFTER
// ./setup.js (which prepares the throwaway DB and env).
import { db } from './setup.js'
import { env } from '../../src/config/env.js'
import { AgentContext } from '../../src/agents/AgentContext.js'
import { Orchestrator } from '../../src/agents/Orchestrator.js'
import { attractionsService } from '../../src/services/attractionsService.js'
import { mapsService } from '../../src/services/mapsService.js'
import { flightsService } from '../../src/services/flightsService.js'
import { hotelsService } from '../../src/services/hotelsService.js'
import { trainsService } from '../../src/services/trainsService.js'
import { weatherService } from '../../src/services/weatherService.js'
import { amadeusProvider } from '../../src/providers/amadeusProvider.js'
import { installOpenTripMapMock } from './otmFixtures.js'
import { installOpenRouteServiceMock } from './orsFixtures.js'
import { installAmadeusMock } from './amadeusFixtures.js'
import { installRailRadarMock } from './railRadarFixtures.js'
import { installOwmMock } from './owmFixtures.js'

export const START = '2099-06-15'
export const END = '2099-06-17'

export const TRIP = {
  destination: 'Manali',
  origin: 'Delhi',
  startDate: START,
  endDate: END,
  travellers: 2,
  budget: 150000,
  interests: ['culture', 'nature'],
  transportPreference: 'flight',
}

const KEYS = {
  attractionsApiKey: 'otm-key', mapsApiKey: 'ors-key', amadeusApiKey: 'ama-key', amadeusApiSecret: 'ama-secret',
  trainsApiKey: 'rail-key', weatherApiKey: 'owm-key',
}

export function resetAll() {
  db.exec('DELETE FROM provider_cache')
  attractionsService._resetForTests()
  mapsService._resetForTests()
  flightsService._resetForTests()
  hotelsService._resetForTests()
  trainsService._resetForTests()
  weatherService._resetForTests()
  amadeusProvider._resetForTests()
  for (const k of Object.keys(KEYS)) env.providers[k] = ''
}

export function enableAll() {
  Object.assign(env.providers, KEYS)
}

/** Forecast covering consecutive UTC days from `startDate`, one 3-hour slot per day. */
export function forecastFor(startDate, pops = [0.1, 0.1, 0.1]) {
  const base = Math.floor(new Date(`${startDate}T09:00:00Z`).getTime() / 1000)
  return {
    list: pops.map((pop, i) => {
      const dt = base + i * 86400
      return {
        dt,
        dt_txt: new Date(dt * 1000).toISOString().replace('T', ' ').slice(0, 19),
        main: { temp_min: 10 + i, temp_max: 20 + i },
        weather: [{ main: pop >= 0.6 ? 'Rain' : 'Clear', description: pop >= 0.6 ? 'moderate rain' : 'clear sky', icon: '01d' }],
        pop,
      }
    }),
  }
}

/**
 * Installs every provider mock (all optional overrides). Returns
 * { calls, restore }. Handlers use the same override keys as the
 * individual fixture installers.
 */
export function installAll({ otm, ors, amadeus, rail, owm } = {}) {
  const mocks = {
    otm: installOpenTripMapMock(otm || {}),
    ors: installOpenRouteServiceMock(ors),
    amadeus: installAmadeusMock(amadeus || {}),
    rail: installRailRadarMock(rail || {}),
    owm: installOwmMock(owm || {}),
  }
  return {
    calls: Object.fromEntries(Object.entries(mocks).map(([k, m]) => [k, m.calls])),
    restore() {
      for (const m of Object.values(mocks).reverse()) m.restore()
    },
  }
}

export async function runPlan(tripRequest = TRIP, { onTrace = null, orchestrator = new Orchestrator() } = {}) {
  const context = new AgentContext({ tripRequest, runId: 'run-test', userId: 'user-test', onTrace })
  await orchestrator.run(context)
  return context
}
