import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { requireAuth } from '../middleware/auth.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { AppError } from '../utils/AppError.js'
import { mapsService } from '../services/mapsService.js'

// Provider-backed routing endpoint. Auth is required and a dedicated limiter
// applies so it can't be used to burn the shared OpenRouteService quota. The
// API key never leaves the backend: responses carry normalized route data
// plus a user-safe `fallbackReason` code, never raw provider errors.
const router = Router()

const routeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { message: 'Too many route requests, please try again shortly.', code: 'RATE_LIMITED' } },
})

// Only modes AtlasAI's maps provider genuinely supports (see
// providers/openRouteServiceProvider.js) — never advertise more than that.
const VALID_MODES = ['driving', 'cab', 'walking', 'cycling']

function parseCoord(raw) {
  if (raw === undefined || raw === null || raw === '') return null
  const n = Number(raw)
  return Number.isFinite(n) ? n : null
}

// GET /api/routes?fromLat=..&fromLng=..&toLat=..&toLng=..[&mode=driving]
router.get('/routes', routeLimiter, requireAuth, asyncHandler(async (req, res) => {
  const fromLat = parseCoord(req.query.fromLat)
  const fromLng = parseCoord(req.query.fromLng)
  const toLat = parseCoord(req.query.toLat)
  const toLng = parseCoord(req.query.toLng)
  const mode = typeof req.query.mode === 'string' && req.query.mode ? req.query.mode : 'driving'

  if ([fromLat, fromLng, toLat, toLng].some((v) => v === null)) {
    throw AppError.badRequest('"fromLat", "fromLng", "toLat" and "toLng" must all be valid numbers')
  }
  if (Math.abs(fromLat) > 90 || Math.abs(toLat) > 90) {
    throw AppError.badRequest('Latitude must be between -90 and 90')
  }
  if (Math.abs(fromLng) > 180 || Math.abs(toLng) > 180) {
    throw AppError.badRequest('Longitude must be between -180 and 180')
  }
  if (!VALID_MODES.includes(mode)) {
    throw AppError.badRequest(`"mode" must be one of: ${VALID_MODES.join(', ')}`)
  }

  const route = await mapsService.getRoute({ lat: fromLat, lng: fromLng }, { lat: toLat, lng: toLng }, mode)
  res.json({ route, dataSource: route.dataSource, provider: route.provider })
}))

export default router
