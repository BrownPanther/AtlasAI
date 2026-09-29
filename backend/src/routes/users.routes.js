import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { userService } from '../services/userService.js'
import { asyncHandler } from '../utils/asyncHandler.js'

const router = Router()

router.get('/search', requireAuth, asyncHandler(async (req, res) => {
  const results = userService.search(req.query.q, req.user.id)
  res.json({ users: results })
}))

router.patch('/me', requireAuth, asyncHandler(async (req, res) => {
  const { homeLocation, comfortPref, travelModePref, interests } = req.body
  const user = userService.updateMe(req.user.id, { homeLocation, comfortPref, travelModePref, interests })
  res.json({ user })
}))

router.get('/:id', requireAuth, asyncHandler(async (req, res) => {
  const user = userService.getById(req.params.id)
  res.json({ user })
}))

export default router
