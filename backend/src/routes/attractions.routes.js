import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { requireAuth } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { attractionsService } from '../services/attractionsService.js'

// Provider-backed browse endpoints. Auth is required and a dedicated limiter
// applies so the endpoints can't be used to burn the shared OpenTripMap quota.
// The API key never leaves the backend: responses carry normalized data plus
// a user-safe `fallbackReason` code, never raw provider errors.
const router = Router()

const browseLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { message: 'Too many place searches, please try again shortly.', code: 'RATE_LIMITED' } },
})

const BROWSE_DEADLINE_MS = 12000
const ATTRIBUTION = 'Places data \u00a9 OpenStreetMap contributors, via OpenTripMap'

function parseInterests(raw) {
  if (typeof raw !== 'string') return []
  return raw.split(',').map((s) => s.trim()).filter(Boolean).slice(0, 10)
}

// GET /api/attractions?destination=Manali[&limit=9][&interests=nature,food]
router.get('/attractions', browseLimiter, requireAuth, validate({ query: { destination: { type: 'string', max: 100 }, limit: { type: 'number', required: false } } }), asyncHandler(async (req, res) => {
  const destination = String(req.query.destination).trim()
  const result = await attractionsService.getAttractions(destination, {
    interests: parseInterests(req.query.interests),
    limit: req.query.limit,
    deadlineMs: BROWSE_DEADLINE_MS,
    allowGeneratedSample: false,
  })
  const fromProvider = result.dataSource === 'live' || result.dataSource === 'cached'
  res.json({
    query: destination,
    destination: result.destination || null,
    attractions: result.attractions,
    count: result.attractions.length,
    dataSource: result.dataSource,
    provider: result.provider,
    fallbackReason: result.fallbackReason,
    ...(result.stale ? { stale: true } : {}),
    ...(result.region ? { region: result.region } : {}),
    ...(fromProvider ? { attribution: ATTRIBUTION } : {}),
  })
}))

// GET /api/destinations/search?q=Manali
router.get('/destinations/search', browseLimiter, requireAuth, validate({ query: { q: { type: 'string', max: 100 } } }), asyncHandler(async (req, res) => {
  const q = String(req.query.q).trim()
  const result = await attractionsService.searchDestination(q, { deadlineMs: BROWSE_DEADLINE_MS })
  const fromProvider = result.dataSource === 'live' || result.dataSource === 'cached'
  res.json({
    query: q,
    results: result.results,
    dataSource: result.dataSource,
    provider: result.provider,
    fallbackReason: result.fallbackReason,
    ...(result.stale ? { stale: true } : {}),
    ...(fromProvider ? { attribution: ATTRIBUTION } : {}),
  })
}))

export default router
