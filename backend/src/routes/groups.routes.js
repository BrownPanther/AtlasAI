import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'
import { groupService } from '../services/groupService.js'
import { asyncHandler } from '../utils/asyncHandler.js'

const router = Router()

// --- specific routes first so they aren't swallowed by /:id ---

router.get('/invites', requireAuth, asyncHandler(async (req, res) => {
  res.json({ invites: groupService.listMyInvites(req.user.id) })
}))

router.get('/invites/token/:token', requireAuth, asyncHandler(async (req, res) => {
  res.json({ preview: groupService.previewInviteByToken(req.params.token, req.user.id) })
}))

router.post('/invites/:id/accept', requireAuth, asyncHandler(async (req, res) => {
  const group = groupService.acceptInvite(req.params.id, req.user.id)
  res.json({ group })
}))

router.post('/invites/:id/decline', requireAuth, asyncHandler(async (req, res) => {
  groupService.declineInvite(req.params.id, req.user.id)
  res.json({ ok: true })
}))

// --- group CRUD ---

router.post('/', requireAuth, validate({ body: { name: 'string' } }), asyncHandler(async (req, res) => {
  const group = groupService.create(req.user.id, req.body)
  res.status(201).json({ group })
}))

router.get('/', requireAuth, asyncHandler(async (req, res) => {
  res.json({ groups: groupService.listForUser(req.user.id) })
}))

router.get('/:id', requireAuth, asyncHandler(async (req, res) => {
  res.json({ group: groupService.getDetail(req.params.id, req.user.id) })
}))

router.patch('/:id', requireAuth, asyncHandler(async (req, res) => {
  res.json({ group: groupService.update(req.params.id, req.user.id, req.body) })
}))

router.delete('/:id', requireAuth, asyncHandler(async (req, res) => {
  groupService.remove(req.params.id, req.user.id)
  res.status(204).send()
}))

// --- membership ---

router.post('/:id/invites', requireAuth, asyncHandler(async (req, res) => {
  if (req.body.username) {
    const invite = groupService.inviteByUsername(req.params.id, req.user.id, req.body.username)
    return res.status(201).json({ invite })
  }
  const invite = groupService.createInviteLink(req.params.id, req.user.id, req.body)
  res.status(201).json({ invite })
}))

router.delete('/:id/members/:userId', requireAuth, asyncHandler(async (req, res) => {
  groupService.removeMember(req.params.id, req.user.id, req.params.userId)
  res.status(204).send()
}))

// --- chat ---

router.get('/:id/messages', requireAuth, asyncHandler(async (req, res) => {
  res.json({ messages: groupService.listMessages(req.params.id, req.user.id) })
}))

router.post('/:id/messages', requireAuth, validate({ body: { body: 'string' } }), asyncHandler(async (req, res) => {
  const message = groupService.postMessage(req.params.id, req.user.id, req.body.body)
  res.status(201).json({ message })
}))

// --- itinerary sharing ---

router.post('/:id/itinerary-share', requireAuth, validate({ body: { tripId: 'string' } }), asyncHandler(async (req, res) => {
  const message = groupService.shareItinerary(req.params.id, req.user.id, req.body)
  res.status(201).json({ message })
}))

export default router
