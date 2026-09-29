import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { supportService } from '../services/supportService.js'
import { asyncHandler } from '../utils/asyncHandler.js'

const router = Router()

router.post('/', requireAuth, asyncHandler(async (req, res) => {
  const ticket = supportService.create(req.user.id, req.body)
  res.status(201).json({ ticket })
}))

router.get('/mine', requireAuth, asyncHandler(async (req, res) => {
  res.json({ tickets: supportService.listForUser(req.user.id) })
}))

export default router
