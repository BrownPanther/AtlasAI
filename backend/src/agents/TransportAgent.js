import { Agent } from './Agent.js'
import { agentResult } from './AgentResult.js'
import { searchTransport } from '../tools/transportTool.js'
import { llmProvider } from '../llm/index.js'
import { progress } from './realData.js'
import { resolveArrival } from '../tools/itineraryTool.js'
import { unavailableSource } from './sourceStatus.js'

export class TransportAgent extends Agent {
  constructor() {
    super({
      name: 'Transport Agent',
      role: 'Recommend transport options for the trip',
      description: 'Evaluates flights (Amadeus), trains (RailRadar) and other modes against budget, preference, duration and arrival timing.',
      tools: ['transportTool'],
    })
  }

  async execute(context) {
    const intent = context.state.intent
    const transportBudget = intent.budget ? intent.budget * 0.35 : Infinity
    const preferredMode = context.adjustments.forceTransportMode || intent.transportPreference
    const excludeModes = context.adjustments.excludeTransportModes || []

    progress(context, this.name, 'Searching flights and trains…')
    const search = await searchTransport({
      destination: intent.destination,
      travellers: intent.travellers,
      budget: transportBudget,
      preferredMode,
      departureDate: intent.startDate,
      returnDate: intent.returnDate,
      excludeModes,
    })
    const options = search.options
    context.recordSource('flights', search.sources.flights)
    context.recordSource('trains', search.sources.trains)

    if (options.length === 0) {
      return agentResult({
        status: 'error',
        summary: 'No transport options available.',
        data: { recommended: null, alternatives: [], dataSource: 'unavailable', source: unavailableSource('no_options'), sources: search.sources },
        issues: [{ type: 'no_transport_options', severity: 'blocking' }],
      })
    }

    const [best, ...alternatives] = options
    const arrival = resolveArrival(best)
    const explanation = await llmProvider.explain('transport', { option: best, alternatives })

    const issues = []
    if (!best.withinBudget) issues.push({ type: 'transport_over_budget', severity: 'moderate' })
    if (best.priceState === 'unavailable') issues.push({ type: 'transport_price_unavailable', severity: 'low', detail: best.priceNote })
    if (best.coverage === 'outbound_only') issues.push({ type: 'return_transport_not_priced', severity: 'low', detail: 'The selected fare covers the outbound journey only; the return leg is not included.' })

    return agentResult({
      status: best.withinBudget && !issues.some((i) => i.severity === 'moderate') ? 'success' : 'warning',
      summary: explanation,
      data: {
        recommended: best,
        alternatives: alternatives.slice(0, 3),
        dataSource: best.dataSource,
        source: { state: best.dataSource, provider: best.provider, fallbackReason: (best.mode === 'flight' ? search.sources.flights : best.mode === 'train' ? search.sources.trains : search.sources.other).fallbackReason || null },
        sources: search.sources,
        availableModes: search.availableModes,
        excludedModes: search.excludedModes,
        arrival,
      },
      reasoning: {
        decisions: [`Chose ${best.mode} via ${best.provider} (${best.dataSource} data)`],
        reasons: [explanation],
        constraintsConsidered: [
          `traveller preference: ${preferredMode || 'none stated'}`,
          `transport budget ceiling: ${transportBudget === Infinity ? 'none' : `\u20b9${Math.round(transportBudget)}`}`,
          `flight data: ${search.sources.flights.state}; train data: ${search.sources.trains.state}`,
          ...(search.excludedModes.length ? [`excluded after replanning: ${search.excludedModes.join(', ')}`] : []),
        ],
        tradeoffs: alternatives.slice(0, 2).map((a) => `${a.mode} (${a.provider}) at ${a.totalPrice == null ? 'price unavailable' : `\u20b9${a.totalPrice}`} was not chosen (score ${a.score.toFixed(2)} vs ${best.score.toFixed(2)})`),
        selectedOptions: [best.id],
      },
      confidence: best.withinBudget ? (best.priceKnown ? 0.85 : 0.6) : 0.55,
      issues,
    })
  }
}
