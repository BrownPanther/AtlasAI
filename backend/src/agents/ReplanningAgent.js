import { Agent } from './Agent.js'
import { agentResult } from './AgentResult.js'
import { llmProvider } from '../llm/index.js'

const COMFORT_DOWNGRADE = { Premium: 'Standard', Standard: 'Budget', Budget: 'Budget' }
const PACE_DOWNGRADE = { packed: 'moderate', moderate: 'relaxed', relaxed: 'relaxed' }
const CHEAPEST_MODE = 'bus'

export class ReplanningAgent extends Agent {
  constructor() {
    super({
      name: 'Replanning Agent',
      role: 'Decide which specialist agents to rerun and how, based on Critic feedback',
      description: 'Applies targeted adjustments rather than regenerating the whole plan.',
      dependsOn: ['Critic Agent'],
    })
  }

  async execute(context) {
    const critique = context.state.critique.data
    const rerun = new Set()
    const changes = []
    const intent = context.state.intent

    for (const change of critique.requiredChanges) {
      switch (change.type) {
        case 'reduce_cost': {
          const currentComfort = context.adjustments.forceComfortTier || intent.hotelPreference
          context.adjustments.forceComfortTier = COMFORT_DOWNGRADE[currentComfort] || 'Budget'
          const currentPace = context.adjustments.forcePace || intent.pace
          context.adjustments.forcePace = PACE_DOWNGRADE[currentPace] || 'relaxed'
          context.adjustments.forceTransportMode = CHEAPEST_MODE
          context.adjustments.activityBudgetMultiplier = 0.75
          changes.push(
            `downgraded stay comfort tier to ${context.adjustments.forceComfortTier}`,
            `switched to cheaper transport mode (${CHEAPEST_MODE})`,
            'reduced activity budget allocation by 25%',
            `reduced activity count by downgrading pace to ${context.adjustments.forcePace}`
          )
          rerun.add('Stay Agent').add('Activity Agent').add('Transport Agent')
          break
        }
        case 'deduplicate_activities':
          context.adjustments.dedupeActivities = true
          changes.push('removed duplicate activities')
          rerun.add('Activity Agent')
          break
        case 'consolidate_areas':
          context.adjustments.consolidateAreas = true
          changes.push('consolidated activities into fewer areas')
          rerun.add('Activity Agent')
          break
        case 'reduce_activities_per_day': {
          const currentPace = context.adjustments.forcePace || intent.pace
          context.adjustments.forcePace = PACE_DOWNGRADE[currentPace] || 'relaxed'
          changes.push(`reduced pace to ${context.adjustments.forcePace}`)
          rerun.add('Activity Agent')
          break
        }
        case 'find_cheaper_option': {
          const current = context.adjustments.forceComfortTier || intent.hotelPreference
          context.adjustments.forceComfortTier = COMFORT_DOWNGRADE[current] || 'Budget'
          context.adjustments.forceTransportMode = CHEAPEST_MODE
          changes.push(`switched to cheaper transport mode (${CHEAPEST_MODE})`, `downgraded stay comfort tier to ${context.adjustments.forceComfortTier}`)
          rerun.add('Transport Agent').add('Stay Agent')
          break
        }
        case 'find_alternative_transport': {
          // The current selection is unusable (unavailable, or arrives after the trip): exclude
          // its mode and let the Transport Agent search the remaining real/sample modes.
          const failedMode = context.state.transport?.data?.recommended?.mode
          const excluded = context.adjustments.excludeTransportModes
          if (failedMode && !excluded.includes(failedMode)) excluded.push(failedMode)
          changes.push(failedMode ? `excluded ${failedMode} and re-searched other transport modes` : 're-searched transport (previous search returned nothing)')
          rerun.add('Transport Agent')
          break
        }
        case 'find_alternative_stay': {
          const failedId = context.state.stay?.data?.recommended?.id
          if (failedId && !context.adjustments.excludeStayIds.includes(failedId)) context.adjustments.excludeStayIds.push(failedId)
          changes.push(failedId ? 'excluded the previous hotel and searched for alternatives' : 're-searched accommodation (previous search returned nothing)')
          rerun.add('Stay Agent')
          break
        }
        case 'adjust_for_weather':
          context.adjustments.preferIndoor = true
          changes.push('preferred indoor activities because the forecast is wet for most of the trip')
          rerun.add('Activity Agent')
          break
        default:
          break
      }
    }

    if (rerun.size === 0) {
      return agentResult({
        status: 'success',
        summary: 'No actionable changes identified; proceeding with existing plan.',
        data: { rerunAgents: [] },
      })
    }

    const rerunAgents = [...rerun]
    const explanation = await llmProvider.explain('replanning', { changes })

    return agentResult({
      status: 'success',
      summary: explanation,
      data: { rerunAgents, changes },
      reasoning: {
        decisions: [`Rerunning: ${rerunAgents.join(', ')}`],
        reasons: [explanation],
        constraintsConsidered: critique.issues.map((i) => i.type),
      },
      confidence: 0.7,
    })
  }
}
