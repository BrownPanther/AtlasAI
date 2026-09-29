import { Agent } from './Agent.js'
import { agentResult } from './AgentResult.js'
import { searchHotels } from '../tools/hotelTool.js'
import { llmProvider } from '../llm/index.js'
import { progress } from './realData.js'
import { unavailableSource } from './sourceStatus.js'

export class StayAgent extends Agent {
  constructor() {
    super({
      name: 'Stay Agent',
      role: 'Recommend accommodation for the trip',
      description: 'Evaluates hotels against budget, comfort preference and rating. A listing is never treated as availability or a booking.',
      tools: ['hotelTool'],
    })
  }

  async execute(context) {
    const intent = context.state.intent
    const nights = Math.max(intent.days - 1, 1)
    const rooms = intent.rooms || 1
    const stayBudgetTotal = intent.budget ? intent.budget * 0.35 : Infinity
    const budgetPerNight = stayBudgetTotal / nights
    const comfortPref = context.adjustments.forceComfortTier || intent.hotelPreference
    const excluded = new Set(context.adjustments.excludeStayIds || [])

    progress(context, this.name, 'Finding accommodations…')
    const search = await searchHotels({ destination: intent.destination, nights, rooms, budgetPerNight, comfortPref })
    context.recordSource('hotels', search.source)
    let options = search.options.filter((h) => !excluded.has(h.id))
    if (!options.length) options = search.options // never leave the trip without a stay because of an exclusion

    if (options.length === 0) {
      return agentResult({
        status: 'error',
        summary: 'No accommodation options available.',
        data: { recommended: null, alternatives: [], nights, rooms, dataSource: 'unavailable', source: search.source.state === 'unavailable' ? search.source : unavailableSource('no_options') },
        issues: [{ type: 'no_stay_options', severity: 'blocking' }],
      })
    }

    const [best, ...alternatives] = options
    const explanation = await llmProvider.explain('stay', { option: best, alternatives, nights, rooms })

    const issues = []
    if (!best.withinBudget) issues.push({ type: 'stay_over_budget', severity: 'moderate' })
    if (!best.priceKnown) issues.push({ type: 'stay_price_unavailable', severity: 'low', detail: best.priceNote })

    return agentResult({
      status: best.withinBudget ? 'success' : 'warning',
      summary: explanation,
      data: {
        recommended: best,
        alternatives: alternatives.slice(0, 3),
        nights,
        rooms,
        checkIn: intent.checkIn,
        checkOut: intent.checkOut,
        dataSource: best.dataSource,
        source: search.source,
      },
      reasoning: {
        decisions: [`Chose ${best.name}${best.area ? ` in ${best.area}` : ''} for ${nights} night(s) x ${rooms} room(s) (listing, ${best.dataSource} data — availability ${best.availability})`],
        reasons: [explanation],
        constraintsConsidered: [
          `comfort preference: ${comfortPref}${comfortPref !== intent.hotelPreference ? ' (adjusted after replanning)' : ''}`,
          `nightly budget ceiling: ${budgetPerNight === Infinity ? 'none' : `\u20b9${Math.round(budgetPerNight)}`}`,
          `hotel data: ${search.source.state}${search.source.provider ? ` (${search.source.provider})` : ''}`,
        ],
        tradeoffs: alternatives.slice(0, 2).map((a) => `${a.name} (${a.rating ?? 'no rating'}${a.rating != null ? '\u2605' : ''}, ${a.pricePerNight == null ? 'price unavailable' : `\u20b9${a.pricePerNight}/night`}) not chosen (score ${a.score.toFixed(2)} vs ${best.score.toFixed(2)})`),
        selectedOptions: [best.id],
      },
      confidence: best.withinBudget ? (best.priceKnown ? 0.85 : 0.6) : 0.55,
      issues,
    })
  }
}
