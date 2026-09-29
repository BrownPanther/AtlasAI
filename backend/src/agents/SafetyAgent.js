import { Agent } from './Agent.js'
import { agentResult } from './AgentResult.js'
import { getSafetyNotes } from '../tools/safetyTool.js'
import { ensureWeather } from './realData.js'

function tripDates(intent) {
  if (!intent.startDate) return []
  const start = new Date(intent.startDate)
  return Array.from({ length: intent.days || 0 }, (_, i) => new Date(start.getTime() + i * 86400000).toISOString().slice(0, 10))
}

export class SafetyAgent extends Agent {
  constructor() {
    super({
      name: 'Safety Agent',
      role: 'Surface destination and trip safety considerations',
      description: 'General safety notes plus factual weather, route and transport-status context. Reports provider facts; makes no safety verdicts from them.',
      tools: ['safetyTool', 'weatherTool'],
      dependsOn: ['Transport Agent', 'Activity Agent'],
    })
  }

  async execute(context) {
    const { intent, transport, activities } = context.state
    const weather = await ensureWeather(context).catch(() => null)
    const notes = await getSafetyNotes({
      destination: intent.destination,
      accessibilityNeeds: intent.accessibility,
      weather,
      routes: activities?.data?.routes ? { summary: activities.data.routes } : null,
      transport: transport?.data?.recommended || null,
      tripDates: tripDates(intent),
    })

    return agentResult({
      status: 'success',
      summary: `Risk level: ${notes.destinationRisk}. ${notes.precautions.length} precaution(s) noted.`,
      data: notes,
      reasoning: {
        decisions: ['Compiled general safety notes for destination', `Weather context: ${notes.weatherSource.state}`],
        constraintsConsidered: intent.accessibility.length ? [`accessibility needs: ${intent.accessibility.join(', ')}`] : [],
      },
      confidence: 0.6,
    })
  }
}
