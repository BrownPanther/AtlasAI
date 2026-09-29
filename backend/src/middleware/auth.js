import { verifyToken } from '../utils/jwt.js'
import { AppError } from '../utils/AppError.js'
import { userRepository } from '../repositories/userRepository.js'

function extractToken(req) {
  const header = req.headers.authorization
  if (header && header.startsWith('Bearer ')) return header.slice(7)
  if (req.cookies?.atlasai_token) return req.cookies.atlasai_token
  return null
}

export function requireAuth(req, res, next) {
  try {
    const token = extractToken(req)
    if (!token) throw AppError.unauthorized()
    const payload = verifyToken(token)
    const user = userRepository.findById(payload.sub)
    if (!user) throw AppError.unauthorized('User no longer exists')
    req.user = user
    next()
  } catch {
    next(AppError.unauthorized('Invalid or expired session'))
  }
}

// Attaches req.user if a valid token is present, but doesn't fail if absent.
export function optionalAuth(req, res, next) {
  const token = extractToken(req)
  if (!token) return next()
  try {
    const payload = verifyToken(token)
    const user = userRepository.findById(payload.sub)
    if (user) req.user = user
  } catch {
    // ignore invalid token in optional mode
  }
  next()
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return next(AppError.unauthorized())
    if (!roles.includes(req.user.role)) return next(AppError.forbidden('Insufficient permissions'))
    next()
  }
}
