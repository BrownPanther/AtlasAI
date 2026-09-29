import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { requireAuth } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { AppError } from '../utils/AppError.js'
import { trainsService } from '../services/trainsService.js'

// Provider-backed train endpoints. Auth required, dedicated limiter (same
// shape as /api/flights and /api/hotels) so this can't burn RailRadar's
// free-tier 1,000 requests/month quota. Credentials never leave the
// backend; responses carry normalized data plus a user-safe
// `fallbackReason` code, never raw provider errors.
//
// IMPORTANT: RailRadar is a data API, not a ticketing API — every train
// here carries bookingUrl:null, and /search never returns a fare (see
// GET /:number/fare below). "Found" is never conflated with "running",
// "seats available" or "booked" (see trainsService.js).
const router = Router()

const browseLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { message: 'Too many train searches, please try again shortly.', code: 'RATE_LIMITED' } },
})

const BROWSE_DEADLINE_MS = 12000
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const CLASS_RE = /^[A-Z0-9]{1,4}$/

// GET /api/trains/search?destination=Jaipur[&origin=Delhi][&date=2026-10-10][&limit=10]
router.get(
  '/trains/search',
  browseLimiter,
  requireAuth,
  validate({
    query: {
      destination: { type: 'string', max: 100 },
      origin: { type: 'string', max: 100, required: false },
      date: { type: 'string', required: false },
      limit: { type: 'number', required: false },
    },
  }),
  asyncHandler(async (req, res) => {
    const destination = String(req.query.destination).trim()
    const origin = req.query.origin ? String(req.query.origin).trim() : 'Delhi'
    const date = req.query.date ? String(req.query.date).trim() : undefined

    if (date && !DATE_RE.test(date)) {
      throw AppError.badRequest('"date" must be in YYYY-MM-DD format')
    }

    const result = await trainsService.getTrains(origin, destination, date, {
      limit: req.query.limit,
      deadlineMs: BROWSE_DEADLINE_MS,
    })
    res.json({
      query: destination,
      origin,
      date: date || null,
      trains: result.trains,
      count: result.trains.length,
      dataSource: result.dataSource,
      provider: result.provider,
      fallbackReason: result.fallbackReason,
      ...(result.stale ? { stale: true } : {}),
    })
  })
)

// GET /api/trains/:number/status[?date=2026-10-10]
// Live running status only — never fabricated from a scheduled time.
router.get(
  '/trains/:number/status',
  browseLimiter,
  requireAuth,
  validate({ query: { date: { type: 'string', required: false } } }),
  asyncHandler(async (req, res) => {
    const number = String(req.params.number).trim()
    const date = req.query.date ? String(req.query.date).trim() : undefined
    if (date && !DATE_RE.test(date)) {
      throw AppError.badRequest('"date" must be in YYYY-MM-DD format')
    }

    const result = await trainsService.getTrainStatus(number, { date, deadlineMs: BROWSE_DEADLINE_MS })
    res.json({
      trainNumber: number,
      status: result.status,
      dataSource: result.dataSource,
      provider: result.provider,
      fallbackReason: result.fallbackReason,
      ...(result.stale ? { stale: true } : {}),
    })
  })
)

// GET /api/trains/:number/fare?source=NDLS&destination=JP&journeyDate=2026-10-10&classCode=3A[&quotaCode=GN]
router.get(
  '/trains/:number/fare',
  browseLimiter,
  requireAuth,
  validate({
    query: {
      source: { type: 'string', max: 10 },
      destination: { type: 'string', max: 10 },
      journeyDate: { type: 'string' },
      classCode: { type: 'string', max: 4 },
      quotaCode: { type: 'string', max: 4, required: false },
    },
  }),
  asyncHandler(async (req, res) => {
    const number = String(req.params.number).trim()
    const { source, destination, journeyDate } = req.query
    const classCode = String(req.query.classCode).trim().toUpperCase()
    const quotaCode = req.query.quotaCode ? String(req.query.quotaCode).trim().toUpperCase() : undefined

    if (!DATE_RE.test(String(journeyDate).trim())) throw AppError.badRequest('"journeyDate" must be in YYYY-MM-DD format')
    if (!CLASS_RE.test(classCode)) throw AppError.badRequest('"classCode" is not a valid RailRadar class code')

    const result = await trainsService.getFare(number, {
      source: String(source).trim().toUpperCase(),
      destination: String(destination).trim().toUpperCase(),
      journeyDate: String(journeyDate).trim(),
      classCode,
      quotaCode,
      deadlineMs: BROWSE_DEADLINE_MS,
    })
    res.json({
      trainNumber: number,
      fare: result.fare,
      dataSource: result.dataSource,
      provider: result.provider,
      fallbackReason: result.fallbackReason,
      ...(result.stale ? { stale: true } : {}),
    })
  })
)

// GET /api/trains/:number/seats?source=NDLS&destination=JP&journeyDate=2026-10-10&classCode=3A[&quotaCode=GN]
router.get(
  '/trains/:number/seats',
  browseLimiter,
  requireAuth,
  validate({
    query: {
      source: { type: 'string', max: 10 },
      destination: { type: 'string', max: 10 },
      journeyDate: { type: 'string' },
      classCode: { type: 'string', max: 4 },
      quotaCode: { type: 'string', max: 4, required: false },
    },
  }),
  asyncHandler(async (req, res) => {
    const number = String(req.params.number).trim()
    const { source, destination, journeyDate } = req.query
    const classCode = String(req.query.classCode).trim().toUpperCase()
    const quotaCode = req.query.quotaCode ? String(req.query.quotaCode).trim().toUpperCase() : undefined

    if (!DATE_RE.test(String(journeyDate).trim())) throw AppError.badRequest('"journeyDate" must be in YYYY-MM-DD format')
    if (!CLASS_RE.test(classCode)) throw AppError.badRequest('"classCode" is not a valid RailRadar class code')

    const result = await trainsService.getSeatAvailability(number, {
      source: String(source).trim().toUpperCase(),
      destination: String(destination).trim().toUpperCase(),
      journeyDate: String(journeyDate).trim(),
      classCode,
      quotaCode,
      deadlineMs: BROWSE_DEADLINE_MS,
    })
    res.json({
      trainNumber: number,
      availability: result.availability,
      dataSource: result.dataSource,
      provider: result.provider,
      fallbackReason: result.fallbackReason,
      ...(result.stale ? { stale: true } : {}),
    })
  })
)

export default router
