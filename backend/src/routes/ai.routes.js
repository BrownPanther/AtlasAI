import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { tripService } from '../services/tripService.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { safeErrorReason } from '../agents/sourceStatus.js'
import { AppError } from '../utils/AppError.js'

const router = Router()

router.post('/plan', requireAuth, asyncHandler(async (req, res) => {
  if (!req.body || typeof req.body !== 'object') throw AppError.badRequest('Request body is required')
  const { saveAsTrip, ...tripRequest } = req.body
  const result = await tripService.planTrip({ userId: req.user.id, tripRequest, saveAsTrip: Boolean(saveAsTrip) })
  res.status(201).json(result)
}))

// Re-run planning with a modified request (e.g. user tweaked budget/dates after seeing the result).
// This is a full re-plan, distinct from the Orchestrator's internal Critic->Replanning loop,
// which already happens automatically inside a single /plan call.
router.post('/replan', requireAuth, asyncHandler(async (req, res) => {
  if (!req.body || typeof req.body !== 'object') throw AppError.badRequest('Request body is required')
  const { saveAsTrip, ...tripRequest } = req.body
  const result = await tripService.planTrip({ userId: req.user.id, tripRequest, saveAsTrip: Boolean(saveAsTrip) })
  res.status(201).json(result)
}))

// Streaming variant: same planning run, but pushes each agent's status live over
// Server-Sent Events instead of waiting for the whole pipeline to finish.
// Uses fetch + ReadableStream on the client rather than native EventSource,
// since EventSource can't send an Authorization header or a POST body.
router.post('/plan/stream', requireAuth, asyncHandler(async (req, res) => {
  if (!req.body || typeof req.body !== 'object') throw AppError.badRequest('Request body is required')
  const { saveAsTrip, ...tripRequest } = req.body

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  })
  res.flushHeaders?.()

  const send = (type, payload) => {
    res.write(`data: ${JSON.stringify({ type, ...payload })}\n\n`)
  }

  const heartbeat = setInterval(() => res.write(':hb\n\n'), 15000)
  req.on('close', () => clearInterval(heartbeat))

  try {
    const result = await tripService.planTrip({
      userId: req.user.id,
      tripRequest,
      saveAsTrip: Boolean(saveAsTrip),
      onTrace: (entry) => send('trace', { entry }),
      onContextReady: (context) => req.on('close', () => context.cancel()),
    })
    send('done', { runId: result.runId, tripId: result.trip?.id ?? null, state: result.state })
  } catch (err) {
    send('error', { message: safeErrorReason(err) })
  } finally {
    clearInterval(heartbeat)
    res.end()
  }
}))

router.get('/runs/:id', requireAuth, asyncHandler(async (req, res) => {
  const run = tripService.getRun(req.params.id, req.user.id)
  if (run?.error) {
    run.error = safeErrorReason({ message: run.error })
  }
  res.json({ run })
}))

export default router
