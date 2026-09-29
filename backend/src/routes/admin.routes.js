import { Router } from 'express'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { adminService } from '../services/adminService.js'
import { asyncHandler } from '../utils/asyncHandler.js'

const router = Router()

router.use(requireAuth, requireRole('admin'))

router.get('/stats', asyncHandler(async (req, res) => {
  res.json({ stats: adminService.stats() })
}))

router.get('/users', asyncHandler(async (req, res) => {
  res.json({ users: adminService.users() })
}))

router.get('/groups', asyncHandler(async (req, res) => {
  res.json({ groups: adminService.groups() })
}))

router.get('/trips', asyncHandler(async (req, res) => {
  res.json({ trips: adminService.trips() })
}))

router.get('/bookings', asyncHandler(async (req, res) => {
  res.json({ bookings: adminService.bookings() })
}))

router.get('/feedback', asyncHandler(async (req, res) => {
  res.json({ feedback: adminService.feedback() })
}))

router.get('/support', asyncHandler(async (req, res) => {
  res.json({ tickets: adminService.support() })
}))

router.patch('/support/:id', asyncHandler(async (req, res) => {
  res.json({ ticket: adminService.updateSupportTicket(req.params.id, req.body.status) })
}))

router.get('/emergencies', asyncHandler(async (req, res) => {
  res.json({ emergencies: adminService.emergencies() })
}))

router.get('/agent-runs', asyncHandler(async (req, res) => {
  res.json({ runs: adminService.agentRuns() })
}))

export default router
