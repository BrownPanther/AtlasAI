import { Agent } from './Agent.js'
import { agentResult } from './AgentResult.js'
import { computeBudget } from '../tools/budgetTool.js'
import { llmProvider } from '../llm/index.js'

// Maps an agent's chosen option to a budget component. A missing option or
// an unavailable price yields amount:null — never 0.
function transportComponent(transport) {
  const rec = transport?.data?.recommended
  if (!rec) return { amount: null, state: 'unavailable', note: 'no_transport_selected' }
  const state = rec.totalPrice == null ? 'unavailable' : (rec.sourceType === 'estimated' || rec.dataSource === 'estimated' ? 'estimated' : rec.dataSource || 'sample')
  return {
    amount: rec.totalPrice ?? null,
    state,
    note: rec.priceNote || null,
    coverage: rec.coverage,
  }
}

function stayComponent(stay) {
  const rec = stay?.data?.recommended
  if (!rec) return { amount: null, state: 'unavailable', note: 'no_stay_selected' }
  const state = rec.totalPrice == null ? 'unavailable' : (rec.sourceType === 'estimated' || rec.dataSource === 'estimated' ? 'estimated' : rec.dataSource || 'sample')
  return { amount: rec.totalPrice ?? null, state, note: rec.priceNote || null }
}

function activitiesComponent(activities) {
  const d = activities?.data
  if (!d) return { amount: null, state: 'unavailable', note: 'no_activities' }
  return { amount: d.totalCost ?? 0, state: d.dataSource || 'sample', unknownItems: d.unknownCostCount || 0, note: d.unknownCostCount ? `${d.unknownCostCount} selected place(s) have no provider price` : null }
}

export class BudgetAgent extends Agent {
  constructor() {
    super({
      name: 'Budget Agent',
      role: 'Calculate and validate the total trip cost',
      description: 'Aggregates transport, stay, and activity costs with their source state; unavailable prices are reported, never counted as zero.',
      tools: ['budgetTool'],
      dependsOn: ['Transport Agent', 'Stay Agent', 'Activity Agent'],
    })
  }

  async execute(context) {
    const { intent, transport, stay, activities } = context.state

    const breakdown = computeBudget({
      days: intent.days,
      travellers: intent.travellers,
      budget: intent.budget,
      components: {
        transport: transportComponent(transport),
        stay: stayComponent(stay),
        activities: activitiesComponent(activities),
      },
    })

    const explanation = await llmProvider.explain('budget', breakdown)

    const issues = []
    if (breakdown.violated) issues.push({ type: 'budget_exceeded', severity: 'high', overBy: breakdown.total - breakdown.budget })
    if (breakdown.isLowerBound) {
      issues.push({
        type: 'budget_incomplete',
        severity: 'low',
        detail: `Total is a lower bound: ${[...breakdown.unavailable.map((u) => `${u} price unavailable`), ...(breakdown.components.activities.unknownItems ? [`${breakdown.components.activities.unknownItems} activity price(s) unavailable`] : [])].join('; ')}.`,
      })
    }

    return agentResult({
      status: breakdown.violated ? 'warning' : 'success',
      summary: explanation,
      data: breakdown,
      reasoning: {
        decisions: [`Computed ${breakdown.isLowerBound ? 'a lower-bound ' : ''}total of \u20b9${breakdown.total} across ${intent.days} day(s)`],
        reasons: [explanation],
        constraintsConsidered: [
          `stated budget: ${breakdown.budget ? `\u20b9${breakdown.budget}` : 'none'}`,
          'food, local travel and contingency are AtlasAI allowances (estimated), not provider prices',
          'all amounts in INR; non-INR provider prices are not converted (no conversion service)',
        ],
      },
      confidence: breakdown.isLowerBound ? 0.6 : 0.9,
      issues,
    })
  }
}
