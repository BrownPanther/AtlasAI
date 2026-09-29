import { Agent } from './Agent.js'
import { agentResult } from './AgentResult.js'
import { buildPlan, resolveArrival } from '../tools/itineraryTool.js'
import { weakestState } from './sourceStatus.js'
import { llmProvider } from '../llm/index.js'

export class SynthesisAgent extends Agent {
  constructor() {
    super({
      name: 'Synthesis Agent',
      role: 'Combine all approved agent outputs into the final itinerary',
      description: 'Builds the structured day-by-day plan from transport, stay, and activities.',
      dependsOn: ['Transport Agent', 'Stay Agent', 'Activity Agent', 'Budget Agent', 'Critic Agent'],
    })
  }

  async execute(context) {
    const { intent, transport, stay, activities, budget, safety, critique, replanning, weather, routes } = context.state

    // Real-data context gathered earlier in the run is reused (no second
    // weather/route provider round trip).
    const arrival = transport?.data?.arrival || resolveArrival(transport?.data?.recommended)
    const plan = await buildPlan({
      days: intent.days,
      activities: activities?.data?.selected || [],
      slotsPerDay: activities?.data?.slotsPerDay || 3,
      startDate: intent.startDate,
      destination: intent.destination,
      routes,
      forecast: weather,
      arrival,
    })
    const days = plan.days

    const insights = [
      { agent: 'Transport Agent', title: 'Transport', detail: transport.summary },
      { agent: 'Stay Agent', title: 'Stay', detail: stay.summary },
      { agent: 'Activity Agent', title: 'Activities', detail: activities.summary },
      { agent: 'Budget Agent', title: 'Budget', detail: budget.summary },
      { agent: 'Critic Agent', title: 'Plan review', detail: critique.summary },
    ]
    if (replanning) {
      insights.push({ agent: 'Replanning Agent', title: 'Adjustments made', detail: replanning.summary })
    }

    const transportRec = transport?.data?.recommended || null
    const stayRec = stay?.data?.recommended || null
    const activitySource = activities?.data?.dataSource || 'sample'
    const componentStates = { transport: transportRec ? transportRec.dataSource : 'unavailable', stay: stayRec ? stayRec.dataSource : 'unavailable', activities: activitySource }
    const unavailableComponents = Object.entries(componentStates).filter(([, s]) => s === 'unavailable' || s === 'none').map(([k]) => k)
    const worst = weakestState(Object.values(componentStates))
    // Overall label stays 'sample' while ANY core component is sample or
    // unavailable, so the UI never presents a mixed/partial plan as live.
    const overall = worst === 'live' || worst === 'cached' ? (Object.values(componentStates).includes('cached') ? 'cached' : 'live') : 'sample'

    const dataNotes = []
    if (!transportRec) dataNotes.push('Transport could not be determined; no transport is shown or priced.')
    if (!stayRec) dataNotes.push('Accommodation could not be determined; no stay is shown or priced.')
    if (budget.data.isLowerBound) dataNotes.push('The budget total is a lower bound: some prices were unavailable and are not counted as zero.')
    if (transportRec?.coverage === 'outbound_only') dataNotes.push('The transport fare covers the outbound journey only.')
    if (context.state.sources.weather?.state === 'unavailable') dataNotes.push('Weather data was unavailable; no weather is shown.')
    if (plan.unscheduled.length) dataNotes.push(`${plan.unscheduled.length} activity(ies) could not be scheduled after the arrival time.`)

    const finalPlan = {
      destination: intent.destination,
      origin: intent.origin,
      startDate: intent.startDate,
      endDate: intent.endDate,
      travellers: intent.travellers,
      days,
      transport: transportRec,
      stay: stayRec,
      budget: budget.data,
      safety,
      insights,
      // Activities the Activity Agent considered but didn't select — used by the
      // itinerary UI's "replace this stop" action instead of inventing new options.
      activityAlternatives: activities?.data?.dropped || [],
      approved: critique.data.approved,
      remainingIssues: critique.data.approved ? [] : critique.data.issues,
      generatedAt: new Date().toISOString(),
      dataSource: overall,
      // Legacy per-component labels (unchanged shape).
      sources: {
        transport: componentStates.transport === 'unavailable' ? 'unavailable' : componentStates.transport || 'sample',
        stay: componentStates.stay === 'unavailable' ? 'unavailable' : componentStates.stay || 'sample',
        activities: activitySource,
      },
      // R7: full source status for every real-data category, as it left the
      // provider/service layer (state, provider, fallbackReason, stale).
      sourceStatus: {
        attractions: activities?.data?.source || null,
        hotels: stay?.data?.source || null,
        flights: transport?.data?.sources?.flights || null,
        trains: transport?.data?.sources?.trains || null,
        trainFare: transport?.data?.sources?.trainFare || null,
        routes: context.state.sources.routes || null,
        weather: context.state.sources.weather || null,
        budget: { state: 'estimated', note: 'Provider prices where available; food, local travel and contingency are AtlasAI allowances.' },
      },
      dataCompleteness: unavailableComponents.length || budget.data.isLowerBound ? 'partial' : 'complete',
      unavailableComponents,
      dataNotes,
      unscheduledActivities: plan.unscheduled,
      weatherAdjustments: plan.weatherAdjustments,
      routeGaps: plan.routeGaps,
      arrival: arrival || null,
      bookingDisclaimer: 'Search results are listings, not confirmed availability or bookings. AtlasAI has not booked anything.',
    }

    context.state.finalPlan = finalPlan

    const explanation = await llmProvider.explain('synthesis', { days: days.length, totalCost: budget.data.total })

    return agentResult({
      status: critique.data.approved ? 'success' : 'warning',
      summary: explanation,
      data: finalPlan,
      reasoning: {
        decisions: [`Assembled ${days.length}-day itinerary from ${(activities?.data?.selected || []).length} activities`, ...(plan.weatherAdjustments.length ? [`Moved ${plan.weatherAdjustments.length} outdoor activity(ies) to drier forecast days`] : [])],
        reasons: [explanation],
      },
      confidence: critique.data.approved ? 0.85 : 0.6,
      issues: critique.data.approved ? [] : critique.data.issues,
    })
  }
}
