import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { feedbackService } from '../services/feedbackService.js'
import { asyncHandler } from '../utils/asyncHandler.js'

const router = Router()

router.post('/', requireAuth, asyncHandler(async (req, res) => {
  const feedback = feedbackService.create(req.user.id, req.body)
  res.status(201).json({ feedback })
}))

router.get('/mine', requireAuth, asyncHandler(async (req, res) => {
  res.json({ feedback: feedbackService.listForUser(req.user.id) })
}))

export default router
