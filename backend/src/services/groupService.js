import { groupRepository } from '../repositories/groupRepository.js'
import { groupInviteRepository } from '../repositories/groupInviteRepository.js'
import { messageRepository } from '../repositories/messageRepository.js'
import { notificationRepository } from '../repositories/notificationRepository.js'
import { userRepository } from '../repositories/userRepository.js'
import { tripRepository } from '../repositories/tripRepository.js'
import { AppError } from '../utils/AppError.js'

const CAN_MANAGE = ['owner', 'admin']

function requireMembership(groupId, userId) {
  const role = groupRepository.getMemberRole(groupId, userId)
  if (!role) throw AppError.forbidden('Not a member of this group')
  return role
}

function canRemove(actingRole, targetRole) {
  if (actingRole === 'owner') return targetRole !== 'owner'
  if (actingRole === 'admin') return targetRole === 'member'
  return false
}

export const groupService = {
  create(userId, { name, description }) {
    if (!name?.trim()) throw AppError.badRequest('Group name is required', { field: 'name' })
    return groupRepository.create({ name: name.trim(), description: description?.trim() || null, ownerId: userId })
  },

  listForUser(userId) {
    return groupRepository.listForUser(userId)
  },

  getDetail(groupId, userId) {
    const group = groupRepository.findById(groupId)
    if (!group) throw AppError.notFound('Group not found')
    const role = requireMembership(groupId, userId)
    const members = groupRepository.listMembers(groupId)
    const pendingInvites = CAN_MANAGE.includes(role) ? groupInviteRepository.listForGroup(groupId) : []
    return { ...group, myRole: role, members, pendingInvites: pendingInvites.map((i) => ({ id: i.id, inviteeId: i.inviteeId, status: i.status, expiresAt: i.expiresAt })) }
  },

  update(groupId, userId, fields) {
    const role = requireMembership(groupId, userId)
    if (role !== 'owner') throw AppError.forbidden('Only the group owner can rename or edit the group')
    return groupRepository.update(groupId, fields)
  },

  remove(groupId, userId) {
    const role = requireMembership(groupId, userId)
    if (role !== 'owner') throw AppError.forbidden('Only the group owner can delete the group')
    groupRepository.delete(groupId)
  },

  // --- invites ---

  inviteByUsername(groupId, actingUserId, username) {
    const group = groupRepository.findById(groupId)
    if (!group) throw AppError.notFound('Group not found')
    const role = requireMembership(groupId, actingUserId)
    if (!CAN_MANAGE.includes(role)) throw AppError.forbidden('Only the owner or an admin can invite members')

    const target = userRepository.findByUsername(username)
    if (!target) throw AppError.notFound('No user with that username')
    if (groupRepository.isMember(groupId, target.id)) throw AppError.conflict('That user is already a member')

    const invite = groupInviteRepository.create({ groupId, inviterId: actingUserId, inviteeId: target.id, singleUse: true })

    notificationRepository.create({
      userId: target.id,
      type: 'GROUP_INVITE',
      title: `You were invited to "${group.name}"`,
      body: `Accept to join the group.`,
      link: `/join/group/${invite.token}`,
      meta: { groupId, inviteId: invite.id },
    })

    return invite
  },

  createInviteLink(groupId, actingUserId, { expiresInDays = 7, singleUse = false } = {}) {
    const role = requireMembership(groupId, actingUserId)
    if (!CAN_MANAGE.includes(role)) throw AppError.forbidden('Only the owner or an admin can create invite links')
    return groupInviteRepository.create({ groupId, inviterId: actingUserId, inviteeId: null, singleUse, expiresInDays })
  },

  listMyInvites(userId) {
    return groupInviteRepository.listPendingForUser(userId).map((invite) => {
      const group = groupRepository.findById(invite.groupId)
      return { ...invite, group: group ? { id: group.id, name: group.name } : null }
    })
  },

  previewInviteByToken(token, userId) {
    const invite = groupInviteRepository.findByToken(token)
    if (!invite) throw AppError.notFound('Invite not found or no longer valid')
    if (invite.status !== 'pending') throw AppError.conflict('This invite has already been used or is no longer valid')
    if (groupInviteRepository.isExpired(invite)) throw AppError.conflict('This invite has expired')
    if (invite.inviteeId && invite.inviteeId !== userId) throw AppError.forbidden('This invite was addressed to a different account')

    const group = groupRepository.findById(invite.groupId)
    if (!group) throw AppError.notFound('Group no longer exists')
    const inviter = userRepository.findById(invite.inviterId)

    return {
      inviteId: invite.id,
      groupName: group.name,
      groupDescription: group.description,
      memberCount: groupRepository.memberCount(group.id),
      invitedBy: inviter?.username || 'a member',
      alreadyMember: groupRepository.isMember(group.id, userId),
    }
  },

  acceptInvite(inviteId, userId) {
    const invite = groupInviteRepository.findById(inviteId)
    if (!invite) throw AppError.notFound('Invite not found')
    if (invite.status !== 'pending') throw AppError.conflict('This invite has already been used or is no longer valid')
    if (groupInviteRepository.isExpired(invite)) throw AppError.conflict('This invite has expired')
    if (invite.inviteeId && invite.inviteeId !== userId) throw AppError.forbidden('This invite was addressed to a different account')

    const group = groupRepository.findById(invite.groupId)
    if (!group) throw AppError.notFound('Group no longer exists')

    if (!groupRepository.isMember(group.id, userId)) {
      groupRepository.addMember(group.id, userId, 'member')
      const joiner = userRepository.findById(userId)
      notificationRepository.create({
        userId: invite.inviterId,
        type: 'GROUP_JOIN',
        title: `${joiner.username} joined "${group.name}"`,
        link: `/group/${group.id}`,
        meta: { groupId: group.id, userId },
      })
    }

    if (invite.singleUse) groupInviteRepository.markStatus(invite.id, 'accepted')

    return group
  },

  declineInvite(inviteId, userId) {
    const invite = groupInviteRepository.findById(inviteId)
    if (!invite) throw AppError.notFound('Invite not found')
    if (invite.inviteeId !== userId) throw AppError.forbidden('This invite was not addressed to you')
    groupInviteRepository.markStatus(invite.id, 'declined')
  },

  // --- membership management ---

  removeMember(groupId, actingUserId, targetUserId) {
    const group = groupRepository.findById(groupId)
    if (!group) throw AppError.notFound('Group not found')
    const actingRole = requireMembership(groupId, actingUserId)
    const targetRole = groupRepository.getMemberRole(groupId, targetUserId)
    if (!targetRole) throw AppError.notFound('That user is not a member of this group')

    const isSelfLeave = actingUserId === targetUserId
    if (isSelfLeave) {
      if (targetRole === 'owner') throw AppError.badRequest('The owner cannot leave the group — delete it instead')
    } else if (!canRemove(actingRole, targetRole)) {
      throw AppError.forbidden('You do not have permission to remove this member')
    }

    groupRepository.removeMember(groupId, targetUserId)
    if (!isSelfLeave) {
      notificationRepository.create({
        userId: targetUserId,
        type: 'GROUP_LEAVE',
        title: `You were removed from "${group.name}"`,
      })
    }
  },

  // --- chat ---

  listMessages(groupId, userId) {
    requireMembership(groupId, userId)
    return messageRepository.listForGroup(groupId)
  },

  postMessage(groupId, userId, body) {
    requireMembership(groupId, userId)
    if (!body?.trim()) throw AppError.badRequest('Message cannot be empty', { field: 'body' })
    const message = messageRepository.create({ groupId, senderId: userId, body: body.trim() })
    this._notifyOtherMembers(groupId, userId, {
      type: 'GROUP_MESSAGE',
      title: `New message in "${groupRepository.findById(groupId).name}"`,
      body: body.trim().slice(0, 120),
      link: `/group/${groupId}`,
      meta: { groupId, messageId: message.id },
    })
    return message
  },

  shareItinerary(groupId, userId, { tripId, message }) {
    requireMembership(groupId, userId)
    const trip = tripRepository.findById(tripId)
    if (!trip) throw AppError.notFound('Trip not found')
    if (!tripRepository.isMember(tripId, userId)) throw AppError.forbidden('You do not have access to this trip')

    const plan = trip.finalPlan
    const snapshot = {
      tripId: trip.id,
      destination: trip.destination,
      startDate: trip.startDate,
      endDate: trip.endDate,
      days: plan?.days?.length || 0,
      estimatedCost: plan?.budget?.total || null,
    }

    const msg = messageRepository.create({
      groupId,
      senderId: userId,
      body: message?.trim() || `Here's the itinerary AtlasAI generated for us.`,
      kind: 'itinerary_share',
      meta: snapshot,
    })

    // Sharing grants the rest of the group real read access to the trip —
    // otherwise "View itinerary" in the chat card would 403 for everyone but the owner.
    const members = groupRepository.listMembers(groupId)
    for (const m of members) {
      if (m.id !== userId) tripRepository.addMember(tripId, m.id, 'member')
    }

    this._notifyOtherMembers(groupId, userId, {
      type: 'ITINERARY_SHARED',
      title: `A trip to ${trip.destination} was shared`,
      link: `/group/${groupId}`,
      meta: { groupId, tripId },
    })

    return msg
  },

  _notifyOtherMembers(groupId, exceptUserId, { type, title, body, link, meta }) {
    const members = groupRepository.listMembers(groupId)
    for (const m of members) {
      if (m.id === exceptUserId) continue
      notificationRepository.create({ userId: m.id, type, title, body, link, meta })
    }
  },
}
