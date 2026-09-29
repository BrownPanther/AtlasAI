import { LLMProvider } from './LLMProvider.js'

const money = (n) => (n == null || Number.isNaN(Number(n)) ? 'price unavailable' : `\u20b9${Math.round(n).toLocaleString('en-IN')}`)
const stars = (r) => (r == null ? 'no provider rating' : `${r}\u2605 rating`)
const hours = (h) => (h == null ? 'duration unavailable' : `${h}h journey`)

const TEMPLATES = {
  transport: ({ option, alternatives }) =>
    `Selected because it fit your budget/mode preference: ${option.mode} at ${money(option.totalPrice)} total, ` +
    `${hours(option.durationHours)}${option.dataSource && option.dataSource !== 'live' ? ` (${option.dataSource} data)` : ''}. ${alternatives.length} alternative option(s) considered.`,

  stay: ({ option, alternatives, nights }) =>
    `Chosen for ${stars(option.rating)} and ${option.pricePerNight == null ? 'price unavailable' : `${money(option.pricePerNight)}/night`} over ${nights} night(s) ` +
    `(total ${money(option.totalPrice)}), in the ${option.area || 'listed'} area. Listing only \u2014 availability not verified. ${alternatives.length} alternative(s) considered.`,

  activities: ({ selected, dropped }) =>
    `Selected ${selected.length} activities matching your interests and pace` +
    (dropped.length ? `; left out ${dropped.length} lower-priority option(s) to avoid an overpacked schedule.` : '.'),

  budget: ({ total, budget, percentUsed, violated, unavailable = [] }) =>
    (unavailable.length ? `Partial total (lower bound): ${unavailable.join(', ')} price unavailable and not included. ` : '') +
    (budget
      ? violated
        ? `Estimated total ${money(total)} is ${percentUsed}% of your ${money(budget)} budget — over budget by ${money(total - budget)}.`
        : `Estimated total ${money(total)} is ${percentUsed}% of your ${money(budget)} budget, leaving room for extras.`
      : `Estimated total cost: ${money(total)}. No fixed budget was provided to compare against.`),

  critic: ({ approved, issues }) =>
    approved
      ? 'Plan reviewed: no blocking issues found.'
      : `Plan reviewed: ${issues.length} issue(s) found (${issues.map((i) => i.type).join(', ')}).`,

  replanning: ({ changes }) =>
    `Adjusted plan based on critic feedback: ${changes.join('; ')}.`,

  synthesis: ({ days, totalCost }) =>
    `Combined all approved agent outputs into a ${days}-day itinerary, estimated at ${money(totalCost)} total.`,
}

export class RuleBasedProvider extends LLMProvider {
  isAvailable() {
    return true
  }

  async explain(kind, payload) {
    const template = TEMPLATES[kind]
    if (!template) return 'No explanation template available for this step.'
    try {
      return template(payload)
    } catch {
      return 'Explanation unavailable for this step.'
    }
  }
}
