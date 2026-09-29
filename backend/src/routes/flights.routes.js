import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { requireAuth } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { AppError } from '../utils/AppError.js'
import { flightsService } from '../services/flightsService.js'

// Provider-backed flight-search browse endpoint. Auth is required and a
// dedicated limiter applies so it can't be used to burn the shared Amadeus
// test-environment quota (same quota/credentials as /api/hotels/search).
// The API credentials never leave the backend: responses carry normalized
// flight data plus a user-safe `fallbackReason` code, never raw provider
// errors.
//
// IMPORTANT: Amadeus's test environment returns SYNTHETIC flight-offer data
// (see providers/amadeusProvider.js) — every flight here carries
// bookingUrl:null and status:null; this is browsable information, not a
// live bookable fare.
//
// There is no separate GET /api/flights/:id — Amadeus's flight-offers
// search already returns full itinerary/fare detail for every offer in one
// round trip (same reasoning R4 documented for skipping GET
// /api/hotels/:id), so a details fetch would just re-serve the same cached
// search result.
const router = Router()

const browseLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { message: 'Too many flight searches, please try again shortly.', code: 'RATE_LIMITED' } },
})

const BROWSE_DEADLINE_MS = 12000
const VALID_TRAVEL_CLASSES = ['ECONOMY', 'PREMIUM_ECONOMY', 'BUSINESS', 'FIRST']
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

// GET /api/flights/search?destination=Manali[&origin=Delhi][&departureDate=2026-10-10]
//   [&returnDate=2026-10-14][&adults=1][&travelClass=ECONOMY][&nonStop=true][&limit=10]
router.get(
  '/flights/search',
  browseLimiter,
  requireAuth,
  validate({
    query: {
      destination: { type: 'string', max: 100 },
      origin: { type: 'string', max: 100, required: false },
      departureDate: { type: 'string' },
      returnDate: { type: 'string', required: false },
      adults: { type: 'number', required: false },
      limit: { type: 'number', required: false },
    },
  }),
  asyncHandler(async (req, res) => {
    const destination = String(req.query.destination).trim()
    const origin = req.query.origin ? String(req.query.origin).trim() : 'Delhi'
    const departureDate = String(req.query.departureDate).trim()
    const returnDate = req.query.returnDate ? String(req.query.returnDate).trim() : undefined
    const travelClass = req.query.travelClass ? String(req.query.travelClass).trim().toUpperCase() : undefined
    const nonStop = req.query.nonStop === undefined ? undefined : req.query.nonStop === 'true'

    if (!DATE_RE.test(departureDate)) {
      throw AppError.badRequest('"departureDate" must be in YYYY-MM-DD format')
    }
    const depD = new Date(departureDate)
    if (isNaN(depD.getTime())) throw AppError.badRequest('"departureDate" must be a valid calendar date')
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    if (depD < today) throw AppError.badRequest('"departureDate" must be a future date')

    if (returnDate) {
      if (!DATE_RE.test(returnDate)) throw AppError.badRequest('"returnDate" must be in YYYY-MM-DD format')
      const retD = new Date(returnDate)
      if (isNaN(retD.getTime())) throw AppError.badRequest('"returnDate" must be a valid calendar date')
      if (retD < depD) throw AppError.badRequest('"returnDate" cannot be before departureDate')
    }
    if (travelClass && !VALID_TRAVEL_CLASSES.includes(travelClass)) {
      throw AppError.badRequest(`"travelClass" must be one of: ${VALID_TRAVEL_CLASSES.join(', ')}`)
    }

    const result = await flightsService.getFlights(origin, destination, departureDate, {
      returnDate,
      adults: req.query.adults,
      travelClass,
      nonStop,
      limit: req.query.limit,
      deadlineMs: BROWSE_DEADLINE_MS,
    })
    res.json({
      query: destination,
      origin,
      departureDate,
      returnDate: returnDate || null,
      flights: result.flights,
      count: result.flights.length,
      dataSource: result.dataSource,
      provider: result.provider,
      fallbackReason: result.fallbackReason,
      ...(result.stale ? { stale: true } : {}),
    })
  })
)

export default router
