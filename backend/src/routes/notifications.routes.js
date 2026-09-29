import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { notificationService } from '../services/notificationService.js'
import { asyncHandler } from '../utils/asyncHandler.js'

const router = Router()

router.get('/', requireAuth, asyncHandler(async (req, res) => {
  res.json(notificationService.list(req.user.id))
}))

router.patch('/:id/read', requireAuth, asyncHandler(async (req, res) => {
  const notification = notificationService.markRead(req.params.id, req.user.id)
  res.json({ notification })
}))

router.post('/read-all', requireAuth, asyncHandler(async (req, res) => {
  notificationService.markAllRead(req.user.id)
  res.json({ ok: true })
}))

export default router
