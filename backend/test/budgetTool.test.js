import test from 'node:test'
import assert from 'node:assert'
import { computeBudget } from '../src/tools/budgetTool.js'

test('computeBudget: dynamically scales food and local travel down when budget is tight', () => {
  const breakdown = computeBudget({
    days: 15,
    travellers: 1,
    budget: 15000,
    components: {
      transport: { amount: 5000, state: 'sample' },
      stay: { amount: 14014, state: 'sample' }, // Over budget already! (5000 + 14014 = 19014)
      activities: { amount: 1000, state: 'sample' }
    }
  })
  
  // Since 19014 > 15000, remaining budget is 0.
  // The food scale down should hit the minimum floor: 250 for food, 100 for local travel.
  assert.strictEqual(breakdown.breakdown.food, 250 * 15 * 1) // 3750
  assert.strictEqual(breakdown.breakdown.localTravel, 100 * 15 * 1) // 1500
})

test('computeBudget: uses standard estimates when no budget constraint', () => {
  const breakdown = computeBudget({
    days: 15,
    travellers: 1,
    components: {
      transport: { amount: 5000, state: 'sample' },
      stay: { amount: 14014, state: 'sample' },
      activities: { amount: 1000, state: 'sample' }
    }
  })
  
  assert.strictEqual(breakdown.breakdown.food, 900 * 15 * 1) // 13500
  assert.strictEqual(breakdown.breakdown.localTravel, 300 * 15 * 1) // 4500
})

test('computeBudget: scales proportionally for a moderate budget', () => {
  const breakdown = computeBudget({
    days: 5,
    travellers: 2, // 10 person-days
    budget: 20000,
    components: {
      transport: { amount: 5000, state: 'sample' },
      stay: { amount: 5000, state: 'sample' },
      activities: { amount: 0, state: 'sample' }
    }
  })
  
  // Known total: 10000. Remaining: 10000.
  // Person days: 10.
  // Affordable per person day = 10000 / (10 * 1.1) = ~909.
  // Less than 1200, so it should scale.
  // Food per day = floor(909 * 0.75) = 681
  // Local travel = floor(909 * 0.25) = 227
  assert.strictEqual(breakdown.breakdown.food, 681 * 10)
  assert.strictEqual(breakdown.breakdown.localTravel, 227 * 10)
})
