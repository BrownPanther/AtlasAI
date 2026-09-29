import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { tripService } from '../services/tripService.js'
import { safetyService } from '../services/safetyService.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { validate } from '../middleware/validate.js'

const router = Router()

// Specific path before /:id so "share" isn't captured as a trip id.
router.get('/share/:token', requireAuth, asyncHandler(async (req, res) => {
  res.json({ preview: safetyService.previewByShareToken(req.params.token) })
}))

router.post('/', requireAuth, validate({ body: { destination: 'string' } }), asyncHandler(async (req, res) => {
  const trip = tripService.createManual({ userId: req.user.id, ...req.body })
  res.status(201).json({ trip })
}))

router.get('/', requireAuth, asyncHandler(async (req, res) => {
  res.json({ trips: tripService.listForUser(req.user.id) })
}))

router.get('/:id', requireAuth, asyncHandler(async (req, res) => {
  res.json({ trip: tripService.getById(req.params.id, req.user.id) })
}))

router.patch('/:id', requireAuth, asyncHandler(async (req, res) => {
  res.json({ trip: tripService.update(req.params.id, req.user.id, req.body) })
}))

router.delete('/:id', requireAuth, asyncHandler(async (req, res) => {
  tripService.remove(req.params.id, req.user.id)
  res.status(204).send()
}))

// --- safety: location sharing ---

router.post('/:id/location', requireAuth, asyncHandler(async (req, res) => {
  res.status(201).json(safetyService.postLocation(req.params.id, req.user.id, req.body))
}))

router.get('/:id/location', requireAuth, asyncHandler(async (req, res) => {
  res.json(safetyService.getLocationState(req.params.id, req.user.id))
}))

// --- safety: emergency workflow ---

router.post('/:id/emergency', requireAuth, asyncHandler(async (req, res) => {
  res.status(201).json(safetyService.raiseAlert(req.params.id, req.user.id, req.body))
}))

router.get('/:id/emergency', requireAuth, asyncHandler(async (req, res) => {
  res.json(safetyService.getAlertState(req.params.id, req.user.id))
}))

router.post('/:id/emergency/:alertId/resolve', requireAuth, asyncHandler(async (req, res) => {
  res.json({ alert: safetyService.resolveAlert(req.params.id, req.params.alertId, req.user.id) })
}))

export default router
