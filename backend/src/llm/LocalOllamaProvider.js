import { LLMProvider } from './LLMProvider.js'
import { RuleBasedProvider } from './RuleBasedProvider.js'
import { env } from '../config/env.js'

// R7: the LLM only words explanations of decisions already made from
// provider data; it is never a source of travel facts.
const GUARD = 'Use only the supplied provider data. Do not fabricate or estimate prices, schedules, availability, weather, ratings or route times; where a value is null or unavailable, say it is unavailable. '

// Only planning-relevant fields reach the prompt: no credentials, no user
// identifiers, no raw provider payloads.
const KEEP = ['id', 'name', 'mode', 'provider', 'area', 'category', 'price', 'pricePerNight', 'totalPrice', 'rating', 'durationHours', 'dataSource', 'currency', 'priceState', 'availability', 'bookingStatus']
export function slimForPrompt(obj) {
  if (!obj || typeof obj !== 'object') return obj
  return Object.fromEntries(KEEP.filter((k) => k in obj).map((k) => [k, obj[k]]))
}

const PROMPTS = {
  transport: (p) => `In one short sentence, explain why this transport option was chosen for a trip: ${JSON.stringify(slimForPrompt(p.option))}. Alternatives: ${p.alternatives.length}.`,
  stay: (p) => `In one short sentence, explain why this hotel was chosen: ${JSON.stringify(slimForPrompt(p.option))}. Alternatives: ${p.alternatives.length}.`,
  activities: (p) => `In one short sentence, explain why these ${p.selected.length} activities were chosen and ${p.dropped.length} left out.`,
  budget: (p) => `In one short sentence, summarize this budget outcome: ${JSON.stringify({ total: p.total, budget: p.budget, percentUsed: p.percentUsed })}.`,
  critic: (p) => `In one short sentence, summarize this plan review: approved=${p.approved}, issues=${p.issues.length}.`,
  replanning: (p) => `In one short sentence, summarize these plan adjustments: ${p.changes.join('; ')}.`,
  synthesis: (p) => `In one short sentence, summarize a ${p.days}-day itinerary totaling ${p.totalCost}.`,
}

// This provider is entirely optional. If OLLAMA_BASE_URL isn't set, or the
// request fails for any reason, it transparently falls back to the
// rule-based templates so the app never depends on a local model existing.
export class LocalOllamaProvider extends LLMProvider {
  constructor() {
    super()
    this.fallback = new RuleBasedProvider()
    this.baseUrl = env.ollamaBaseUrl
    this.model = env.ollamaModel
  }

  isAvailable() {
    return Boolean(this.baseUrl && this.model)
  }

  async explain(kind, payload) {
    if (!this.isAvailable()) return this.fallback.explain(kind, payload)
    const built = PROMPTS[kind]?.(payload)
    const prompt = built ? GUARD + built : built
    if (!prompt) return this.fallback.explain(kind, payload)

    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 4000)
      const res = await fetch(`${this.baseUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: this.model, prompt, stream: false }),
        signal: controller.signal,
      })
      clearTimeout(timeout)
      if (!res.ok) return this.fallback.explain(kind, payload)
      const data = await res.json()
      return (data.response || '').trim() || this.fallback.explain(kind, payload)
    } catch {
      return this.fallback.explain(kind, payload)
    }
  }
}
