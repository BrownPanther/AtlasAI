import { Agent } from './Agent.js'
import { agentResult } from './AgentResult.js'
import { getAttractions } from '../tools/attractionTool.js'
import { llmProvider } from '../llm/index.js'
import { ensureWeather, progress } from './realData.js'
import { getRouteLegs } from '../tools/routeTool.js'
import { isOutdoor } from '../tools/itineraryTool.js'
import { WET_DAY_PRECIP_PCT } from '../tools/weatherTool.js'
import { makeSource } from './sourceStatus.js'

const MAX_ROUTED_LEGS = 12

export class ActivityAgent extends Agent {
  constructor() {
    super({
      name: 'Activity Agent',
      role: 'Select and schedule activities for the trip',
      description: 'Matches activities to interests, budget, pace, and geography.',
      tools: ['attractionTool', 'routeTool', 'weatherTool'],
    })
  }

  async execute(context) {
    const intent = context.state.intent
    const adj = context.adjustments
    const activityBudget = (intent.budget ? intent.budget * 0.2 : Infinity) * (adj.activityBudgetMultiplier || 1)
    const pace = adj.forcePace || intent.pace

    progress(context, this.name, 'Searching attractions…')
    // Weather is optional context: its absence never blocks planning.
    const weather = await ensureWeather(context).catch(() => null)

    const found = await getAttractions({
      destination: intent.destination,
      interests: intent.interests,
      pace,
      preferIndoor: Boolean(adj.preferIndoor),
    })
    let { attractions } = found
    const { slotsPerDay } = found

    if (adj.consolidateAreas) {
      const areaFrequency = {}
      for (const a of attractions) areaFrequency[a.area] = (areaFrequency[a.area] || 0) + 1
      const topAreas = Object.entries(areaFrequency)
        .sort((a, b) => b[1] - a[1])
        .slice(0, Math.max(2, Math.ceil(intent.days / 2)))
        .map(([area]) => area)
      attractions = attractions.filter((a) => topAreas.includes(a.area))
    }

    if (adj.dedupeActivities) {
      const seen = new Set()
      attractions = attractions.filter((a) => {
        if (seen.has(a.name)) return false
        seen.add(a.name)
        return true
      })
    }

    const maxSelected = slotsPerDay * intent.days
    const selected = []
    const dropped = []
    let runningCost = 0

    for (const a of attractions) {
      if (selected.length >= maxSelected) {
        dropped.push(a)
        continue
      }
      if (runningCost + a.estimatedCost > activityBudget) {
        dropped.push(a)
        continue
      }
      selected.push(a)
      runningCost += a.estimatedCost
    }

    if (selected.length === 0 && attractions.length > 0) {
      // Budget was too tight even for the cheapest option — take the single cheapest anyway
      // rather than returning an empty itinerary; Critic/Budget agents will flag the overage.
      const cheapest = [...attractions].sort((a, b) => a.estimatedCost - b.estimatedCost)[0]
      selected.push(cheapest)
      runningCost = cheapest.estimatedCost
    }

    // Real routing between consecutive selected places (same area-ordered
    // sequence the itinerary uses). Only pairs where both ends carry provider
    // coordinates are requested; everything else is reported as unmeasured.
    progress(context, this.name, 'Calculating routes…')
    const ordered = Object.values(selected.reduce((m, a) => ((m[a.area] = m[a.area] || []).push(a), m), {})).flat()
    const pairs = []
    for (let i = 1; i < ordered.length && pairs.length < MAX_ROUTED_LEGS; i++) {
      if (ordered[i - 1].coordinates && ordered[i].coordinates) {
        pairs.push({ fromId: ordered[i - 1].id, toId: ordered[i].id, from: ordered[i - 1].coordinates, to: ordered[i].coordinates })
      }
    }
    const routing = pairs.length ? await getRouteLegs(pairs) : { legs: [], summary: null }
    context.state.routes = routing
    context.recordSource('routes', routing.summary?.source || makeSource({ dataSource: 'unavailable', fallbackReason: ordered.length > 1 ? 'missing_coordinates' : 'not_needed' }))

    // Provider forecast facts about the selected activities (annotation only).
    const forecast = weather?.forecast || []
    const wetDates = forecast.filter((d) => typeof d.precipitationChancePct === 'number' && d.precipitationChancePct >= WET_DAY_PRECIP_PCT).map((d) => d.date)
    const outdoorSelected = selected.filter(isOutdoor).length
    const unknownCostCount = selected.filter((a) => a.costKnown === false).length

    const explanation = await llmProvider.explain('activities', { selected, dropped })

    return agentResult({
      status: 'success',
      summary: explanation,
      data: {
        selected, dropped: dropped.slice(0, 5), slotsPerDay, totalCost: runningCost,
        // Selected places whose price the provider did not supply — NOT counted as free.
        unknownCostCount,
        dataSource: found.dataSource, provider: found.provider, fallbackReason: found.fallbackReason,
        source: makeSource({ dataSource: found.dataSource, provider: found.provider, fallbackReason: found.fallbackReason }),
        routes: routing.summary,
        weather: {
          sources: weather?.sources || null,
          wetDates,
          missingForecastDates: weather?.missingForecastDates || [],
          outdoorSelected,
          preferIndoorApplied: Boolean(adj.preferIndoor),
        },
      },
      reasoning: {
        decisions: [`Selected ${selected.length}/${attractions.length} activities within ${maxSelected} slot budget`],
        reasons: [explanation],
        constraintsConsidered: [`interests: ${intent.interests.join(', ') || 'none stated'}`, `pace: ${pace} (${slotsPerDay} slots/day)${pace !== intent.pace ? ' (adjusted after replanning)' : ''}`, `activity budget: ${activityBudget === Infinity ? 'none' : `\u20b9${Math.round(activityBudget)}`}`, `attraction data: ${found.dataSource}${found.provider && found.provider !== 'sample' ? ` (${found.provider})` : ''}`, `weather: ${weather?.sources?.forecast?.state || 'unavailable'}${wetDates.length ? `; wet forecast on ${wetDates.join(', ')}` : ''}`, `routes: ${routing.summary ? `${routing.summary.legsLive + routing.summary.legsCached}/${routing.summary.legsRequested} legs measured` : 'no routable pairs'}`, ...(adj.preferIndoor ? ['indoor activities preferred after replanning (wet forecast)'] : [])],
        tradeoffs: dropped.slice(0, 3).map((a) => `${a.name} left out (cost \u20b9${a.estimatedCost}, interest match: ${a.interestMatch})`),
        selectedOptions: selected.map((a) => a.id),
      },
      confidence: selected.length >= maxSelected * 0.6 ? 0.8 : 0.6,
    })
  }
}
