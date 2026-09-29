import { Agent } from './Agent.js'
import { agentResult } from './AgentResult.js'
import { llmProvider } from '../llm/index.js'
import { resolveArrival, ARRIVAL_BUFFER_HOURS } from '../tools/itineraryTool.js'

const SEVERITY_RANK = { low: 0, moderate: 1, high: 2 }
const EXCESSIVE_LOCAL_TRAVEL_MIN_PER_DAY = 240
const LATE_ARRIVAL_MINUTES = 18 * 60

const toMinutes = (clock) => {
  const m = /^(\d{2}):(\d{2})$/.exec(clock || '')
  return m ? Number(m[1]) * 60 + Number(m[2]) : null
}

export class CriticAgent extends Agent {
  constructor() {
    super({
      name: 'Critic Agent',
      role: 'Review the complete proposed plan for problems',
      description: 'Checks budget, scheduling realism, timing consistency, missing/unavailable components, duplicates and data quality using structured agent outputs.',
      dependsOn: ['Budget Agent'],
    })
  }

  async execute(context) {
    const { intent, transport, stay, activities, budget, safety } = context.state
    const adj = context.adjustments
    const issues = []
    const requiredChanges = []

    // --- Missing / unavailable components (real-data failures) ---
    const transportRec = transport?.data?.recommended || null
    const stayRec = stay?.data?.recommended || null
    if (!transportRec) {
      issues.push({ type: 'missing_transport', severity: 'high', detail: 'No transport option could be selected.' })
      requiredChanges.push({ type: 'find_alternative_transport', targetAgents: ['Transport Agent'], reason: 'Search other transport modes' })
    }
    if (!stayRec) {
      issues.push({ type: 'missing_stay', severity: 'high', detail: 'No accommodation could be selected.' })
      requiredChanges.push({ type: 'find_alternative_stay', targetAgents: ['Stay Agent'], reason: 'Search accommodation again / other options' })
    }
    if (!activities?.data?.selected?.length) {
      issues.push({ type: 'missing_activities', severity: 'moderate', detail: 'No activities were selected.' })
    }

    // --- Date consistency ---
    for (const d of intent.dateIssues || []) issues.push({ type: d.type, severity: d.severity, detail: 'Trip dates are inconsistent; not adjusted automatically.' })

    // --- Timing: arrival vs the trip window ---
    const arrival = transport?.data?.arrival || resolveArrival(transportRec)
    if (transportRec && arrival?.known) {
      if (arrival.dayIndex >= intent.days) {
        issues.push({ type: 'arrival_after_trip_end', severity: 'high', detail: `Selected ${transportRec.mode} arrives on day ${arrival.dayIndex + 1}, after the ${intent.days}-day trip ends.` })
        requiredChanges.push({ type: 'find_alternative_transport', targetAgents: ['Transport Agent'], reason: 'Selected transport arrives after the trip window' })
      } else {
        const arrivalMin = toMinutes(arrival.time)
        if (arrival.dayIndex === 0 && arrivalMin != null && arrivalMin + ARRIVAL_BUFFER_HOURS * 60 > LATE_ARRIVAL_MINUTES) {
          issues.push({ type: 'late_arrival_day_one', severity: 'low', detail: `Arrival at ${arrival.time} leaves little or no time for day-1 activities; they are moved or shortened.` })
        }
        if (arrival.dayIndex > 0) {
          issues.push({ type: 'stay_starts_before_arrival', severity: 'low', detail: `Arrival is on day ${arrival.dayIndex + 1}; the first ${arrival.dayIndex} night(s) of the stay would be unused.` })
        }
      }
    } else if (transportRec && transportRec.dataSource !== 'sample') {
      issues.push({ type: 'arrival_time_unknown', severity: 'low', detail: 'Provider arrival time/day could not be established; day-1 timing is unverified.' })
    }

    // --- Budget ---
    if (budget?.data?.violated) {
      issues.push({ type: 'budget_exceeded', severity: 'high', detail: `Over budget by \u20b9${budget.data.total - budget.data.budget}${budget.data.isLowerBound ? ' (and the total excludes unavailable prices)' : ''}` })
      requiredChanges.push({ type: 'reduce_cost', targetAgents: ['Stay Agent', 'Activity Agent'], reason: 'Bring total under stated budget' })
    }
    if (budget?.data?.isLowerBound) {
      issues.push({ type: 'budget_incomplete', severity: 'low', detail: `Budget total is a lower bound (${budget.data.unavailable.join(', ') || 'some activity prices'} unavailable).` })
    }
    if (transportRec?.coverage === 'outbound_only') {
      issues.push({ type: 'return_transport_not_priced', severity: 'low', detail: 'Transport price covers the outbound journey only.' })
    }

    // --- Activities ---
    const selected = activities?.data?.selected || []
    const names = selected.map((a) => a.name)
    const duplicates = names.filter((n, i) => names.indexOf(n) !== i)
    if (duplicates.length > 0) {
      issues.push({ type: 'duplicate_activities', severity: 'moderate', detail: `Duplicate(s): ${[...new Set(duplicates)].join(', ')}` })
      requiredChanges.push({ type: 'deduplicate_activities', targetAgents: ['Activity Agent'], reason: 'Remove repeated activities' })
    }

    const distinctAreas = new Set(selected.map((a) => a.area)).size
    const affectedDays = []
    const routes = activities?.data?.routes
    const measuredMinutes = routes ? routes.knownTravelMinutes : 0
    const excessiveByRoutes = routes && routes.legsLive + routes.legsCached > 0 && measuredMinutes / Math.max(intent.days, 1) > EXCESSIVE_LOCAL_TRAVEL_MIN_PER_DAY
    if ((distinctAreas > Math.ceil(intent.days * 1.5) && intent.days > 0) || excessiveByRoutes) {
      issues.push({
        type: 'excessive_travel',
        severity: 'moderate',
        detail: excessiveByRoutes
          ? `Measured local travel is about ${measuredMinutes} min over ${intent.days} day(s) (routing provider data).`
          : `${distinctAreas} distinct areas across ${intent.days} day(s) risks excessive local travel`,
      })
      requiredChanges.push({ type: 'consolidate_areas', targetAgents: ['Activity Agent'], reason: 'Group activities by area per day' })
      affectedDays.push(...Array.from({ length: intent.days }, (_, i) => i + 1))
    }

    const slotsPerDay = activities?.data?.slotsPerDay || 3
    const avgHoursPerActivity = selected.length ? selected.reduce((s, a) => s + a.durationHours, 0) / selected.length : 0
    const estimatedDailyLoad = avgHoursPerActivity * slotsPerDay + 3.5 // + meals/buffer
    if (estimatedDailyLoad > 12) {
      issues.push({ type: 'overpacked_day', severity: 'moderate', detail: `Estimated ~${estimatedDailyLoad.toFixed(1)}h of activity per day` })
      requiredChanges.push({ type: 'reduce_activities_per_day', targetAgents: ['Activity Agent'], reason: 'Lower pace to fit realistic day length' })
    }

    // --- Weather exposure (provider forecast facts only) ---
    const w = activities?.data?.weather
    const forecastDaysInTrip = (context.state.weather?.forecast || []).filter((d) => !intent.startDate || (d.date >= intent.startDate && (!intent.endDate || d.date <= intent.endDate)))
    if (w && forecastDaysInTrip.length >= 2 && selected.length) {
      const wetInTrip = forecastDaysInTrip.filter((d) => w.wetDates.includes(d.date)).length
      if (wetInTrip / forecastDaysInTrip.length >= 0.5 && w.outdoorSelected / selected.length >= 0.5) {
        // Itinerary building already moves outdoor stops to the driest days; this
        // only asks for a re-rank once, and stays informational after that.
        const alreadyAdjusted = adj.preferIndoor
        issues.push({ type: 'weather_exposure', severity: alreadyAdjusted ? 'low' : 'moderate', detail: `Forecast shows a high precipitation chance on ${wetInTrip}/${forecastDaysInTrip.length} forecast trip day(s) and most selected activities are outdoors.` })
        if (!alreadyAdjusted) requiredChanges.push({ type: 'adjust_for_weather', targetAgents: ['Activity Agent'], reason: 'Prefer indoor activities on wet-forecast trip' })
      }
    }

    if (intent.accessibility.length > 0) {
      issues.push({ type: 'accessibility_unverified', severity: 'low', detail: 'Provider data does not tag venue accessibility; verify locally.' })
    }

    if ((transportRec && !transportRec.withinBudget) || (stayRec && !stayRec.withinBudget)) {
      issues.push({ type: 'component_over_budget', severity: 'moderate', detail: 'Transport or stay individually exceeds its allocated share' })
      requiredChanges.push({ type: 'find_cheaper_option', targetAgents: ['Transport Agent', 'Stay Agent'], reason: 'Bring components within allocated share' })
    }

    // --- Data quality ---
    const staleSources = Object.entries(context.state.sources || {}).filter(([, s]) => s?.stale).map(([k]) => k)
    if (staleSources.length) {
      issues.push({ type: 'stale_data', severity: 'low', detail: `Serving last-known cached data for: ${staleSources.join(', ')}.` })
    }
    const unavailableParts = Object.entries(context.state.sources || {}).filter(([k, s]) => s?.state === 'unavailable' && ['weather'].includes(k)).map(([k]) => k)
    if (unavailableParts.length) {
      issues.push({ type: 'data_unavailable', severity: 'low', detail: `No provider data for: ${unavailableParts.join(', ')}. Plan generated without it.` })
    }
    void safety

    const highestSeverity = issues.reduce((max, i) => (SEVERITY_RANK[i.severity] > SEVERITY_RANK[max] ? i.severity : max), 'low')
    const approved = !issues.some((i) => i.severity === 'high' || i.severity === 'moderate')

    const explanation = await llmProvider.explain('critic', { approved, issues })

    return agentResult({
      status: approved ? 'success' : 'warning',
      summary: explanation,
      data: {
        approved,
        issues,
        severity: issues.length ? highestSeverity : 'none',
        affectedDays: [...new Set(affectedDays)],
        requiredChanges,
      },
      reasoning: {
        decisions: [approved ? 'Plan approved as-is' : 'Plan sent back for replanning'],
        reasons: [explanation],
        constraintsConsidered: ['missing components', 'date and arrival timing', 'budget (and unavailable prices)', 'duplicate activities', 'geographic spread and measured travel', 'daily activity load', 'weather forecast', 'component budgets', 'data freshness'],
      },
      confidence: 0.75,
      issues,
    })
  }
}
