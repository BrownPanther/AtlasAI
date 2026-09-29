import { getRouteLegs, getRoute, ROUTE_DEADLINE_MS } from './routeTool.js'
import { getWeatherContext, isWetDay, WET_DAY_PRECIP_PCT } from './weatherTool.js'

// Fixed spacing used between stops when real routing isn't available for
// that pair (sample-data activities and hotels have no coordinates — see
// SETUP.md R3). Kept as the fallback, never presented as a measured
// distance/duration.
const FALLBACK_TRAVEL_BUFFER_HOURS = 0.75

// Time between arriving at the destination and the first scheduled stop
// (getting to the stay, dropping bags). A planning allowance, not provider data.
export const ARRIVAL_BUFFER_HOURS = 1.5
const LAST_ACTIVITY_END_MINUTES = 21 * 60

const MEAL_SLOTS = [
  { time: '08:00', label: 'Breakfast', category: 'food', durationHours: 1 },
  { time: '13:00', label: 'Lunch', category: 'food', durationHours: 1 },
  { time: '20:00', label: 'Dinner', category: 'food', durationHours: 1.5 },
]

// Categories that happen outdoors. Used only to compare an activity against
// the provider's precipitation chance for its day — a factual annotation.
export const OUTDOOR_CATEGORIES = new Set(['nature', 'adventure', 'beach', 'sightseeing', 'sports', 'park'])
export const isOutdoor = (activity) => OUTDOOR_CATEGORIES.has(String(activity?.category || '').toLowerCase())

const CLOCK_RE = /^([01]\d|2[0-3]):([0-5]\d)$/
const toMinutes = (clock) => {
  const m = CLOCK_RE.exec(clock || '')
  return m ? Number(m[1]) * 60 + Number(m[2]) : null
}

function addHours(time, hours) {
  const [h, m] = time.split(':').map(Number)
  const total = h * 60 + m + Math.round(hours * 60)
  const wrapped = ((total % (24 * 60)) + 24 * 60) % (24 * 60)
  const hh = String(Math.floor(wrapped / 60)).padStart(2, '0')
  const mm = String(wrapped % 60).padStart(2, '0')
  return `${hh}:${mm}`
}

function tripDate(startDate, i) {
  const start = startDate ? new Date(startDate) : null
  if (!start || Number.isNaN(start.getTime())) return null
  return new Date(start.getTime() + i * 86400000).toISOString().slice(0, 10)
}

/**
 * When does the traveller actually reach the destination, relative to the
 * trip's first day? Uses only provider/sample facts:
 *   - a clock arrival time (HH:MM, local to the destination for provider data)
 *   - the number of days the journey spans: an explicit provider offset
 *     (arrivalDayOffset), else the calendar-date difference the provider
 *     reported (departureDate/arrivalDate — safe across time zones).
 * Sample schedules never shift the itinerary. Anything that can't be established returns { known: false } — an arrival
 * is never guessed.
 */
export function resolveArrival(transport) {
  if (!transport) return { known: false, reason: 'no_transport' }
  // Bundled sample schedules are not tied to a calendar date, so no arrival
  // day can be derived from them; they are never used to shift the itinerary.
  if (transport.dataSource === 'sample') return { known: false, reason: 'sample_schedule' }
  const time = CLOCK_RE.test(transport.arrival || '') ? transport.arrival : null
  if (!time) return { known: false, reason: 'arrival_time_unavailable' }

  let dayOffset = null
  if (Number.isFinite(transport.arrivalDayOffset)) dayOffset = transport.arrivalDayOffset
  else if (transport.departureDate && transport.arrivalDate) {
    const diff = Math.round((new Date(transport.arrivalDate) - new Date(transport.departureDate)) / 86400000)
    if (Number.isFinite(diff)) dayOffset = diff
  }
  // Anything else (e.g. a flight with no provider dates, where the two ends
  // may be in different time zones) stays unknown rather than guessed.
  if (dayOffset == null) return { known: false, reason: 'arrival_day_unknown', time }
  return { known: true, dayIndex: Math.max(0, dayOffset), time }
}

/**
 * Groups activities by area, slices them into `days` buckets of up to
 * `slotsPerDay`, then — only when a real forecast covers at least two trip
 * days — moves outdoor activities off days the provider forecasts as wet
 * (>= WET_DAY_PRECIP_PCT) onto clearly drier days. Pure: no provider calls.
 * @returns {{ buckets: object[][], weatherAdjustments: object[] }}
 */
export function assignActivitiesToDays({ days, activities, slotsPerDay, startDate = null, forecastByDate = null }) {
  const byArea = {}
  for (const a of activities) {
    byArea[a.area] = byArea[a.area] || []
    byArea[a.area].push(a)
  }
  const orderedActivities = Object.values(byArea).flat()

  const buckets = Array.from({ length: days }, () => [])
  let cursor = 0
  for (const activity of orderedActivities) {
    const dayIndex = Math.min(cursor, days - 1)
    if (buckets[dayIndex].length < slotsPerDay) {
      buckets[dayIndex].push(activity)
    } else {
      cursor = Math.min(cursor + 1, days - 1)
      if (buckets[cursor].length < slotsPerDay) buckets[cursor].push(activity)
    }
    if (buckets[cursor].length >= slotsPerDay) cursor++
  }

  const weatherAdjustments = []
  const precip = Array.from({ length: days }, (_, i) => {
    const d = forecastByDate?.[tripDate(startDate, i)]
    return typeof d?.precipitationChancePct === 'number' ? d.precipitationChancePct : null
  })
  if (precip.filter((p) => p != null).length >= 2) {
    for (let pass = 0; pass < days * slotsPerDay; pass++) {
      let moved = false
      const wetDays = precip.map((p, i) => ({ p, i })).filter((x) => x.p != null && x.p >= WET_DAY_PRECIP_PCT).sort((a, b) => b.p - a.p)
      for (const wet of wetDays) {
        const outdoorIdx = buckets[wet.i].findIndex(isOutdoor)
        if (outdoorIdx === -1) continue
        const driest = precip.map((p, i) => ({ p, i })).filter((x) => x.p != null && x.i !== wet.i && x.p <= wet.p - 20).sort((a, b) => a.p - b.p)
        for (const dry of driest) {
          const outdoor = buckets[wet.i][outdoorIdx]
          if (buckets[dry.i].length < slotsPerDay) {
            buckets[wet.i].splice(outdoorIdx, 1)
            buckets[dry.i].push(outdoor)
          } else {
            const indoorIdx = buckets[dry.i].findIndex((a) => !isOutdoor(a))
            if (indoorIdx === -1) continue
            const [indoor] = buckets[dry.i].splice(indoorIdx, 1, outdoor)
            buckets[wet.i].splice(outdoorIdx, 1, indoor)
          }
          weatherAdjustments.push({
            activityId: outdoor.id,
            name: outdoor.name,
            fromDay: wet.i + 1,
            toDay: dry.i + 1,
            reason: `Forecast precipitation chance ${wet.p}% on day ${wet.i + 1} vs ${dry.p}% on day ${dry.i + 1}`,
          })
          moved = true
          break
        }
        if (moved) break
      }
      if (!moved) break
    }
  }
  return { buckets, weatherAdjustments }
}

const legKey = (a, b) => `${a}>${b}`

/**
 * Builds the day-by-day schedule.
 *  - routes:   optional { legs } already computed by ActivityAgent; missing
 *              pairs fall back to routeTool (whose service caches).
 *  - forecast: optional weather context already fetched for this run
 *              (avoids a second provider lookup); otherwise fetched here.
 *  - arrival:  optional resolveArrival() result; nothing is scheduled at the
 *              destination before the traveller arrives. Activities that no
 *              longer fit are reported in `unscheduled`, never silently dropped.
 * Returns the day array (frontend contract unchanged). Extra planning info is
 * exposed via `buildDays.meta`-free helper `buildPlan()` below.
 */
export async function buildPlan({ days, activities, slotsPerDay, startDate, destination, routes = null, forecast = null, arrival = null } = {}) {
  const weatherCtx = forecast
    || (destination && startDate ? await getWeatherContext({ destination, startDate, days, deadlineMs: ROUTE_DEADLINE_MS }) : null)
  const forecastByDate = weatherCtx?.forecastByDate || {}

  const { buckets, weatherAdjustments } = assignActivitiesToDays({ days, activities, slotsPerDay, startDate, forecastByDate })

  // Real legs already gathered by ActivityAgent, keyed by from>to activity id.
  const known = new Map((routes?.legs || []).map((l) => [legKey(l.fromId, l.toId), l]))

  // Nothing at the destination before arrival: carry activities forward.
  const arrivalKnown = arrival?.known
  const arrivalDay = arrivalKnown ? arrival.dayIndex : 0
  const arrivalMinutes = arrivalKnown ? toMinutes(arrival.time) + Math.round(ARRIVAL_BUFFER_HOURS * 60) : 0
  const unscheduled = []
  let carried = []
  const scheduledBuckets = buckets.map((bucket, i) => {
    const pool = [...bucket, ...carried]
    carried = []
    if (!arrivalKnown || (i > arrivalDay) || (i === arrivalDay && arrivalMinutes <= 9 * 60 + 30)) {
      // A day never exceeds its slot budget; overflow moves to the next day.
      carried = pool.slice(slotsPerDay)
      return { list: pool.slice(0, slotsPerDay), earliest: null }
    }
    if (i < arrivalDay) {
      carried = pool
      return { list: [], earliest: null, beforeArrival: true }
    }
    // Arrival day with a late arrival: only what still fits before the evening cut-off.
    const list = []
    let t = arrivalMinutes
    for (const a of pool) {
      const end = t + Math.round(a.durationHours * 60)
      if (list.length < slotsPerDay && end <= LAST_ACTIVITY_END_MINUTES) {
        list.push(a)
        t = end + Math.round(FALLBACK_TRAVEL_BUFFER_HOURS * 60)
      } else carried.push(a)
    }
    return { list, earliest: arrivalMinutes }
  })
  // Whatever is still carried after the last day could not be placed anywhere.
  for (const a of carried) unscheduled.push({ id: a.id, name: a.name, reason: 'no_time_after_arrival' })

  const routeMisses = []
  const built = await Promise.all(scheduledBuckets.map(async ({ list: dayActivities, earliest, beforeArrival }, i) => {
    const date = tripDate(startDate, i)
    const stops = []

    const legs = await Promise.all(
      dayActivities.slice(1).map(async (activity, idx) => {
        const prev = dayActivities[idx]
        const hit = known.get(legKey(prev.id, activity.id))
        if (hit) return hit.dataSource === 'live' || hit.dataSource === 'cached' ? hit : null
        if (!prev.coordinates || !activity.coordinates) return null
        const route = await getRoute(prev.coordinates, activity.coordinates, 'driving')
        if (route.dataSource === 'unavailable') routeMisses.push(route.fallbackReason)
        return route.dataSource === 'unavailable' ? null : route
      })
    )

    const lateArrivalDay = earliest != null
    if (!lateArrivalDay) {
      stops.push({ ...MEAL_SLOTS[0], startTime: MEAL_SLOTS[0].time, endTime: addHours(MEAL_SLOTS[0].time, MEAL_SLOTS[0].durationHours) })
    }
    let time = lateArrivalDay
      ? `${String(Math.floor(earliest / 60)).padStart(2, '0')}:${String(earliest % 60).padStart(2, '0')}`
      : addHours(MEAL_SLOTS[0].time, MEAL_SLOTS[0].durationHours + 0.5)

    const dayForecast = date ? forecastByDate[date] || null : null
    const wet = isWetDay(dayForecast)

    dayActivities.forEach((activity, idx) => {
      const endTime = addHours(time, activity.durationHours)
      const travelToNext = legs[idx] || null
      const outdoorWet = wet && isOutdoor(activity)
      stops.push({
        id: activity.id,
        label: activity.name,
        category: activity.category,
        area: activity.area,
        coordinates: activity.coordinates || null,
        startTime: time,
        endTime,
        durationHours: activity.durationHours,
        estimatedCost: activity.estimatedCost,
        costKnown: activity.costKnown !== false,
        durationEstimated: Boolean(activity.durationEstimated),
        dataSource: activity.dataSource,
        notes: activity.notes || null,
        travelToNext,
        // Provider fact only: this outdoor activity falls on a day the
        // forecast gives a high precipitation chance. Not a safety verdict.
        ...(outdoorWet ? { weatherAdvisory: { precipitationChancePct: dayForecast.precipitationChancePct, provider: dayForecast.provider, dataSource: dayForecast.dataSource } } : {}),
        completed: false,
      })
      const bufferHours = travelToNext ? travelToNext.durationMinutes / 60 : FALLBACK_TRAVEL_BUFFER_HOURS
      time = addHours(endTime, bufferHours)
      if (time === '13:00' || (time > '12:30' && time < '13:30')) time = '13:30'
    })

    if (!(lateArrivalDay && earliest > 13 * 60)) {
      stops.push({ ...MEAL_SLOTS[1], startTime: MEAL_SLOTS[1].time, endTime: addHours(MEAL_SLOTS[1].time, MEAL_SLOTS[1].durationHours) })
    }
    stops.push({ ...MEAL_SLOTS[2], startTime: MEAL_SLOTS[2].time, endTime: addHours(MEAL_SLOTS[2].time, MEAL_SLOTS[2].durationHours) })
    stops.sort((a, b) => (a.startTime > b.startTime ? 1 : -1))

    const estimatedCost = dayActivities.reduce((sum, a) => sum + a.estimatedCost, 0)
    const theme = dayActivities[0]?.category
      ? dayActivities[0].category.replace(/\b\w/g, (c) => c.toUpperCase())
      : beforeArrival ? 'Travel Day' : 'Free / Leisure Day'

    let weatherStatus = 'unavailable'
    if (dayForecast) weatherStatus = dayForecast.dataSource
    else if (date && weatherCtx?.forecast?.length) weatherStatus = 'outside_forecast_range'

    return {
      dayNumber: i + 1,
      date,
      theme,
      estimatedCost,
      stops,
      // Only ever a real forecast entry (or null) — never fabricated.
      weather: dayForecast,
      weatherStatus,
      ...(beforeArrival ? { travelDay: true } : {}),
      completionPercent: 0,
    }
  }))

  return {
    days: built,
    unscheduled,
    weatherAdjustments,
    weatherSources: weatherCtx?.sources || null,
    routeGaps: [...new Set(routeMisses)],
  }
}

// Backwards-compatible entry point (returns just the day array).
export async function buildDays(args = {}) {
  return (await buildPlan(args)).days
}

export { getRouteLegs }
