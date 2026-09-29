import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { bookingService } from '../services/bookingService.js'
import { asyncHandler } from '../utils/asyncHandler.js'

const router = Router()

router.get('/', requireAuth, asyncHandler(async (req, res) => {
  res.json({ bookings: bookingService.listForUser(req.user.id) })
}))

router.post('/', requireAuth, asyncHandler(async (req, res) => {
  const booking = bookingService.create(req.user.id, req.body)
  res.status(201).json({ booking })
}))

router.patch('/:id', requireAuth, asyncHandler(async (req, res) => {
  const booking = req.body.status === 'cancelled'
    ? bookingService.cancel(req.params.id, req.user.id)
    : bookingService.updateStatus(req.params.id, req.user.id, req.body.status)
  res.json({ booking })
}))

router.delete('/:id', requireAuth, asyncHandler(async (req, res) => {
  bookingService.remove(req.params.id, req.user.id)
  res.status(204).send()
}))

export default router
