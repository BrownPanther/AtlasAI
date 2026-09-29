const CONTINGENCY_RATE = 0.1
const FOOD_PER_PERSON_PER_DAY = 900
const LOCAL_TRAVEL_PER_PERSON_PER_DAY = 300

/**
 * Trip cost aggregation (R7).
 *
 * Provider-backed components (transport, stay, activities) come in as
 * `components.<name> = { amount: number|null, state, note? }`. An `amount`
 * of null means the price is UNAVAILABLE: it is listed in `unavailable` and
 * the total becomes an explicit lower bound — an unknown price is never
 * treated as zero. Food, local travel and contingency are AtlasAI
 * allowances (state 'estimated'), not provider prices.
 *
 * For backward compatibility the legacy numeric params still work; they are
 * treated as known amounts of unspecified state.
 */
export function computeBudget({
  transportTotal = 0, stayTotal = 0, activitiesTotal = 0, days = 1, travellers = 1, budget,
  components = {},
} = {}) {
  const legacy = { transport: transportTotal, stay: stayTotal, activities: activitiesTotal }
  const resolved = {}
  for (const key of ['transport', 'stay', 'activities']) {
    const c = components[key]
    resolved[key] = c
      ? { amount: c.amount ?? null, state: c.state || 'unavailable', note: c.note || null, ...(c.unknownItems ? { unknownItems: c.unknownItems } : {}), ...(c.coverage ? { coverage: c.coverage } : {}) }
      : { amount: legacy[key], state: 'unspecified', note: null }
  }

  let foodPerDay = FOOD_PER_PERSON_PER_DAY
  let localTravelPerDay = LOCAL_TRAVEL_PER_PERSON_PER_DAY
  const hasBudget = typeof budget === 'number' && budget > 0

  if (hasBudget) {
    const knownTotal = (resolved.transport.amount || 0) + (resolved.stay.amount || 0) + (resolved.activities.amount || 0)
    const remainingForEstimated = Math.max(0, budget - knownTotal)
    // If there's a budget, cap the food/local-travel so we don't unnecessarily blow the budget if they just wanted a cheap trip
    const personDays = days * travellers
    const affordablePerPersonDay = remainingForEstimated / (personDays * (1 + CONTINGENCY_RATE))
    
    if (affordablePerPersonDay < (FOOD_PER_PERSON_PER_DAY + LOCAL_TRAVEL_PER_PERSON_PER_DAY)) {
       // Scale down proportionally, but don't go below a bare minimum (e.g. 250 for food, 100 for travel)
       foodPerDay = Math.max(250, Math.floor(affordablePerPersonDay * 0.75))
       localTravelPerDay = Math.max(100, Math.floor(affordablePerPersonDay * 0.25))
    }
  }

  const foodEstimate = foodPerDay * days * travellers
  const localTravelEstimate = localTravelPerDay * days * travellers
  const known = (k) => resolved[k].amount ?? 0
  const subtotal = known('transport') + known('stay') + known('activities') + foodEstimate + localTravelEstimate
  const contingency = Math.round(subtotal * CONTINGENCY_RATE)
  const total = subtotal + contingency

  const unavailable = Object.entries(resolved).filter(([, c]) => c.amount == null).map(([k]) => k)
  const partialActivities = (resolved.activities.unknownItems || 0) > 0
  const incomplete = unavailable.length > 0 || partialActivities

  // Separate known (confirmed) vs estimated vs unknown:
  let confirmedTotal = 0
  let estimatedTotal = foodEstimate + localTravelEstimate + contingency
  for (const key of ['transport', 'stay', 'activities']) {
    const comp = resolved[key]
    if (comp.amount != null) {
      if (comp.state === 'live' || comp.state === 'cached') {
        confirmedTotal += comp.amount
      } else {
        estimatedTotal += comp.amount
      }
    }
  }

  const remaining = hasBudget ? budget - total : null
  const percentUsed = hasBudget ? Math.round((total / budget) * 100) : null
  // A lower bound that already exceeds the budget is a real violation; a
  // lower bound under budget is NOT proof the plan fits.
  const violated = hasBudget ? total > budget : false
  const hasEstimatedComponents = Object.values(resolved).some((c) => c.state === 'estimated' || c.state === 'sample' || c.state === 'demo')
  const isConfirmed = confirmedTotal > 0 && !hasEstimatedComponents && unavailable.length === 0

  return {
    breakdown: {
      transport: known('transport'),
      stay: known('stay'),
      activities: known('activities'),
      food: foodEstimate,
      localTravel: localTravelEstimate,
      contingency,
    },
    // Raw component amounts: unknown items remain strictly null, never zero
    rawAmounts: {
      transport: resolved.transport.amount,
      stay: resolved.stay.amount,
      activities: resolved.activities.amount,
    },
    costs: {
      known: confirmedTotal,
      estimated: estimatedTotal,
      unknown: unavailable,
    },
    isConfirmed,
    subtotal,
    total,
    budget: hasBudget ? budget : null,
    remaining,
    percentUsed,
    violated,
    // R7 additions (additive — existing consumers read the fields above).
    currency: 'INR',
    isLowerBound: incomplete,
    unavailable,
    components: resolved,
    estimatedItems: ['food', 'localTravel', 'contingency'],
    fitsBudgetConfirmed: hasBudget ? !violated && !incomplete : null,
  }
}
