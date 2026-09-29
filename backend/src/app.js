import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import cookieParser from 'cookie-parser'
import rateLimit from 'express-rate-limit'
import { env } from './config/env.js'
import routes from './routes/index.js'
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js'

export function createApp() {
  const app = express()

  app.use(helmet({
    // Cross-origin resource policy default blocks the frontend (different
    // origin in dev) from loading things like generated exports; relax it
    // for this API-only server rather than disabling helmet altogether.
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  }))
  const allowedOrigins = (env.corsOrigin || '').split(',').map((o) => o.trim()).filter(Boolean)
  app.use(cors({
    origin: (origin, callback) => {
      // Allow non-browser requests (mobile, curl, health checks) or matching origins
      if (!origin || allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
        return callback(null, true)
      }
      return callback(new Error(`Origin ${origin} not allowed by CORS`))
    },
    credentials: true,
  }))
  app.use(express.json({ limit: '2mb' }))
  app.use(cookieParser())

  const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 500,
    standardHeaders: true,
    legacyHeaders: false,
  })
  app.use('/api', apiLimiter)

  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: { message: 'Too many attempts, please try again later.', code: 'RATE_LIMITED' } },
  })
  app.use('/api/auth/login', authLimiter)
  app.use('/api/auth/register', authLimiter)

  app.use('/api', routes)

  app.use(notFoundHandler)
  app.use(errorHandler)

  return app
}
