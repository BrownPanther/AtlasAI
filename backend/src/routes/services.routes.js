import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { reviewService } from '../services/reviewService.js'
import { asyncHandler } from '../utils/asyncHandler.js'

const router = Router()

router.get('/:id/reviews', asyncHandler(async (req, res) => {
  res.json(reviewService.listForService(req.params.id))
}))

router.post('/:id/reviews', requireAuth, asyncHandler(async (req, res) => {
  const review = reviewService.create(req.user.id, req.params.id, req.body)
  res.status(201).json({ review })
}))

export default router
