import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { requireAuth } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { hotelsService } from '../services/hotelsService.js'

// Provider-backed hotel/accommodation browse endpoint. Auth is required and
// a dedicated limiter applies so it can't be used to burn the shared Amadeus
// test-environment quota. The API credentials never leave the backend:
// responses carry normalized hotel data plus a user-safe `fallbackReason`
// code, never raw provider errors.
//
// IMPORTANT: Amadeus's test environment returns SYNTHETIC hotel/offer data
// (see providers/amadeusProvider.js) — every hotel here carries
// liveAvailability:false and bookingUrl:null; this is browsable information,
// not a live bookable inventory.
const router = Router()

const browseLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { message: 'Too many hotel searches, please try again shortly.', code: 'RATE_LIMITED' } },
})

const BROWSE_DEADLINE_MS = 12000

// GET /api/hotels/search?destination=Manali[&limit=10]
router.get('/hotels/search', browseLimiter, requireAuth, validate({ query: { destination: { type: 'string', max: 100 }, limit: { type: 'number', required: false } } }), asyncHandler(async (req, res) => {
  const destination = String(req.query.destination).trim()
  const result = await hotelsService.getHotels(destination, {
    limit: req.query.limit,
    deadlineMs: BROWSE_DEADLINE_MS,
  })
  res.json({
    query: destination,
    hotels: result.hotels,
    count: result.hotels.length,
    dataSource: result.dataSource,
    provider: result.provider,
    fallbackReason: result.fallbackReason,
    ...(result.stale ? { stale: true } : {}),
  })
}))

export default router
