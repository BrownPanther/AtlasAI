import { IntentAgent } from './IntentAgent.js'
import { TransportAgent } from './TransportAgent.js'
import { StayAgent } from './StayAgent.js'
import { ActivityAgent } from './ActivityAgent.js'
import { SafetyAgent } from './SafetyAgent.js'
import { BudgetAgent } from './BudgetAgent.js'
import { CriticAgent } from './CriticAgent.js'
import { ReplanningAgent } from './ReplanningAgent.js'
import { SynthesisAgent } from './SynthesisAgent.js'

export const agents = {
  intent: new IntentAgent(),
  transport: new TransportAgent(),
  stay: new StayAgent(),
  activity: new ActivityAgent(),
  safety: new SafetyAgent(),
  budget: new BudgetAgent(),
  critic: new CriticAgent(),
  replanning: new ReplanningAgent(),
  synthesis: new SynthesisAgent(),
}

// Lookup by the human-readable `name` used in trace/requiredChanges, e.g. "Stay Agent".
export const agentsByName = Object.fromEntries(Object.values(agents).map((a) => [a.name, a]))
