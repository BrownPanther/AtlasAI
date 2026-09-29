import { AppError } from '../utils/AppError.js'

export function notFoundHandler(req, res) {
  res.status(404).json({ error: { message: 'Route not found', code: 'NOT_FOUND' } })
}

export function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: { message: err.message, code: err.code, details: err.details },
    })
  }

  console.error('[unhandled error]', err)
  res.status(500).json({ error: { message: 'Internal server error', code: 'INTERNAL_ERROR' } })
}
