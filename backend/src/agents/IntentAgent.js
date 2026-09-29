import { Agent } from './Agent.js'
import { agentResult } from './AgentResult.js'

const PACE_KEYWORDS = { relaxed: 'relaxed', slow: 'relaxed', chill: 'relaxed', packed: 'packed', busy: 'packed', full: 'packed' }

function daysBetween(start, end) {
  if (!start || !end) return null
  const ms = new Date(end) - new Date(start)
  return ms > 0 ? Math.round(ms / 86400000) + 1 : null
}

export class IntentAgent extends Agent {
  constructor() {
    super({
      name: 'Intent Agent',
      role: 'Convert the raw trip request into structured requirements',
      description: 'Extracts destination, dates, travellers, budget, style, and constraints.',
    })
  }

  async execute(context) {
    const req = context.state.tripRequest

    const computedDays = req.days || daysBetween(req.startDate, req.endDate) || 3
    const interests = Array.isArray(req.interests)
      ? req.interests
      : typeof req.interests === 'string'
      ? req.interests.split(',').map((s) => s.trim()).filter(Boolean)
      : []

    const paceKeywordHit = Object.keys(PACE_KEYWORDS).find((k) => (req.notes || '').toLowerCase().includes(k))
    const pace = req.pace || (paceKeywordHit ? PACE_KEYWORDS[paceKeywordHit] : 'moderate')

    const constraints = []
    if (req.budget) constraints.push(`budget \u2264 \u20b9${req.budget}`)
    if (req.accessibility?.length) constraints.push(`accessibility: ${req.accessibility.join(', ')}`)
    if (req.dietary?.length) constraints.push(`dietary: ${req.dietary.join(', ')}`)

    // Date consistency (R7): downstream agents rely on these. Nothing is
    // silently "fixed" — an inconsistent request is reported, not repaired.
    const dateIssues = []
    const isIso = (d) => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(new Date(d).getTime())
    if (req.startDate && !isIso(req.startDate)) dateIssues.push({ type: 'invalid_start_date', severity: 'moderate' })
    if (req.endDate && !isIso(req.endDate)) dateIssues.push({ type: 'invalid_end_date', severity: 'moderate' })
    if (isIso(req.startDate) && isIso(req.endDate) && req.endDate < req.startDate) dateIssues.push({ type: 'end_before_start', severity: 'high' })
    const startDate = req.startDate && isIso(req.startDate) ? req.startDate : null
    const endDate = req.endDate && isIso(req.endDate) && !dateIssues.some((i) => i.type === 'end_before_start') ? req.endDate : null
    const roomsGiven = Number.isFinite(Number(req.rooms)) && Number(req.rooms) > 0
    const rooms = roomsGiven ? Math.floor(Number(req.rooms)) : Math.max(1, Math.ceil((req.travellers || 1) / 2))

    const intent = {
      destination: req.destination,
      origin: req.origin || 'Not specified',
      startDate,
      endDate,
      // Explicit real-data fields for downstream agents.
      checkIn: startDate,
      checkOut: endDate,
      returnDate: endDate,
      rooms,
      roomsAssumed: !roomsGiven,
      dateIssues,
      days: computedDays,
      travellers: req.travellers || 1,
      budget: req.budget || null,
      travelStyle: req.travelStyle || 'balanced',
      transportPreference: req.transportPreference || null,
      hotelPreference: req.hotelPreference || 'Standard',
      interests,
      pace,
      accessibility: req.accessibility || [],
      dietary: req.dietary || [],
    }

    if (!intent.destination) {
      return agentResult({
        status: 'error',
        summary: 'No destination provided.',
        data: intent,
        issues: [{ type: 'missing_destination', severity: 'blocking' }],
      })
    }

    context.state.intent = intent

    return agentResult({
      status: dateIssues.length ? 'warning' : 'success',
      issues: dateIssues,
      summary: `Understood ${intent.days}-day trip to ${intent.destination} for ${intent.travellers} traveller(s).`,
      data: intent,
      reasoning: {
        decisions: [`Resolved trip length to ${intent.days} day(s)`, `Resolved pace to "${intent.pace}"`],
        constraintsConsidered: [...(constraints.length ? constraints : ['no explicit budget or accessibility constraints given']), ...(roomsGiven ? [] : [`rooms not specified — assumed ${rooms} (2 guests per room)`])],
      },
      confidence: intent.destination && intent.days ? 0.9 : 0.5,
    })
  }
}
