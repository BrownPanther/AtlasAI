import { attractionsService } from '../services/attractionsService.js'

const OUTDOOR = new Set(['nature', 'adventure', 'beach', 'sightseeing', 'sports', 'park'])
const PACE_SLOTS_PER_DAY = { relaxed: 2, moderate: 3, packed: 4 }

// Planning must never stall on an external API: the Orchestrator gives every
// agent an 8s budget (with a retry), so provider lookups get less than that.
// If the deadline is hit the tool falls back to sample data; the provider
// request keeps running in the background and warms the cache for next time.
const PROVIDER_DEADLINE_MS = 5000
const PLANNING_CANDIDATES = 15
const SUMMARY_MAX_CHARS = 160

// OpenTripMap gives no visit durations, so scheduling needs a placeholder.
// It is flagged `durationEstimated` and never shown as provider data.
function defaultDurationHours(category) {
  return category === 'nature' || category === 'adventure' ? 3 : 1.5
}

function shortSummary(text) {
  if (!text) return null
  const clean = text.replace(/\s+/g, ' ').trim()
  if (clean.length <= SUMMARY_MAX_CHARS) return clean
  const cut = clean.slice(0, SUMMARY_MAX_CHARS)
  return `${cut.slice(0, Math.max(cut.lastIndexOf(' '), SUMMARY_MAX_CHARS * 0.6)).trimEnd()}…`
}

/**
 * Reduces a canonical attraction to the concise record ActivityAgent plans
 * with. Deliberately drops raw/provider-heavy fields (full descriptions,
 * addresses, image lists, Wikidata/OSM references) so neither the agents'
 * stored state nor any LLM prompt carries provider payloads.
 */
function toPlanningRecord(a) {
  const costKnown = a.costKnown !== false
  const durationEstimated = a.durationHours == null
  return {
    id: a.id,
    name: a.name,
    area: a.area || '',
    category: a.category,
    estimatedCost: costKnown ? (a.estimatedCost ?? 0) : 0,
    costKnown,
    durationHours: a.durationHours ?? defaultDurationHours(a.category),
    durationEstimated,
    bestTimeOfDay: a.bestTimeOfDay || 'anytime',
    notes: a.notes || null,
    summary: a.description && a.description !== a.notes ? shortSummary(a.description) : null,
    rating: a.rating ?? null,
    // OpenTripMap supplies no opening hours: reported as unavailable, never assumed.
    openingHours: a.openingHours || null,
    openingHoursState: a.openingHours ? 'provider' : 'unavailable',
    coordinates: a.coordinates || null,
    dataSource: a.dataSource,
    provider: a.provider,
  }
}

export async function getAttractions({ destination, interests = [], pace = 'moderate', preferIndoor = false }) {
  const result = await attractionsService.getAttractions(destination, {
    interests,
    limit: PLANNING_CANDIDATES,
    deadlineMs: PROVIDER_DEADLINE_MS,
    allowGeneratedSample: true,
  })

  const normalizedInterests = interests.map((i) => i.toLowerCase())

  const scored = result.attractions.map(toPlanningRecord).map((a) => {
    const interestMatch = normalizedInterests.some(
      (i) => a.category.toLowerCase().includes(i) || i.includes(a.category.toLowerCase()) || a.name.toLowerCase().includes(i)
    )
    // Higher is better here, so we sort descending below. Provider popularity (1-3) is a mild tiebreaker.
    // preferIndoor is set by replanning when the provider forecast is wet for most of the trip.
    const outdoorPenalty = preferIndoor && OUTDOOR.has(String(a.category).toLowerCase()) ? 1.5 : 0
    const score = (interestMatch ? 1 : 0) * 2 + (a.rating ? a.rating / 3 : 0) - a.estimatedCost / 2000 - outdoorPenalty
    return { ...a, interestMatch, score }
  })

  scored.sort((a, b) => b.score - a.score)
  return {
    attractions: scored,
    slotsPerDay: PACE_SLOTS_PER_DAY[pace] || PACE_SLOTS_PER_DAY.moderate,
    dataSource: result.dataSource === 'none' ? 'sample' : result.dataSource,
    provider: result.provider,
    fallbackReason: result.fallbackReason,
  }
}
