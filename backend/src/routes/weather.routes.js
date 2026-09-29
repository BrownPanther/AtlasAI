import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { requireAuth } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { weatherService } from '../services/weatherService.js'

// Provider-backed weather endpoints (OpenWeatherMap — the provider R1
// selected/documented; see SETUP.md). Auth required, dedicated limiter.
// Weather is explicitly optional context, never a hard dependency: an
// unavailable provider returns dataSource:'unavailable' with a 200, never
// a 502/503 — there is nothing for a client to retry differently, and
// nothing here is ever fabricated (see weatherService.js).
const router = Router()

const browseLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { message: 'Too many weather requests, please try again shortly.', code: 'RATE_LIMITED' } },
})

const BROWSE_DEADLINE_MS = 8000

// GET /api/weather/current?destination=Manali
router.get(
  '/weather/current',
  browseLimiter,
  requireAuth,
  validate({ query: { destination: { type: 'string', max: 100 } } }),
  asyncHandler(async (req, res) => {
    const destination = String(req.query.destination).trim()
    const result = await weatherService.fetchCurrent(destination, { deadlineMs: BROWSE_DEADLINE_MS })
    res.json({
      query: destination,
      current: result.current,
      dataSource: result.dataSource,
      provider: result.provider,
      fallbackReason: result.fallbackReason,
      ...(result.stale ? { stale: true } : {}),
    })
  })
)

// GET /api/weather/forecast?destination=Manali
router.get(
  '/weather/forecast',
  browseLimiter,
  requireAuth,
  validate({ query: { destination: { type: 'string', max: 100 } } }),
  asyncHandler(async (req, res) => {
    const destination = String(req.query.destination).trim()
    const result = await weatherService.fetchForecast(destination, { deadlineMs: BROWSE_DEADLINE_MS })
    res.json({
      query: destination,
      forecast: result.days,
      count: result.days.length,
      dataSource: result.dataSource,
      provider: result.provider,
      fallbackReason: result.fallbackReason,
      ...(result.stale ? { stale: true } : {}),
    })
  })
)

export default router
