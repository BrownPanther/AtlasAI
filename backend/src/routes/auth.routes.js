import { Router } from 'express'
import { authService } from '../services/authService.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { validate } from '../middleware/validate.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()

const COOKIE_NAME = 'atlasai_token'
const COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

function setAuthCookie(res, token) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: COOKIE_MAX_AGE_MS,
  })
}

router.post(
  '/register',
  validate({
    body: {
      username: { type: 'string', min: 3, max: 32 },
      email: 'email',
      password: { type: 'string', min: 8, max: 128 },
    },
  }),
  asyncHandler(async (req, res) => {
    const { username, email, password } = req.body
    const { user, token } = authService.register({ username, email, password })
    setAuthCookie(res, token)
    res.status(201).json({ user, token })
  })
)

router.post(
  '/login',
  validate({ body: { email: 'email', password: 'string' } }),
  asyncHandler(async (req, res) => {
    const { email, password } = req.body
    const { user, token } = authService.login({ email, password })
    setAuthCookie(res, token)
    res.json({ user, token })
  })
)

router.get('/me', requireAuth, asyncHandler(async (req, res) => {
  res.json({ user: req.user })
}))

router.post('/logout', asyncHandler(async (req, res) => {
  res.clearCookie(COOKIE_NAME)
  res.json({ ok: true })
}))

export default router
