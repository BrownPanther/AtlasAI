import { db } from '../db/index.js'
import { makeId, makeToken } from '../utils/id.js'

function rowToInvite(row) {
  if (!row) return null
  return {
    id: row.id,
    token: row.token,
    groupId: row.group_id,
    inviterId: row.inviter_id,
    inviteeId: row.invitee_id,
    status: row.status,
    singleUse: Boolean(row.single_use),
    expiresAt: row.expires_at,
    createdAt: row.created_at,
  }
}

export const groupInviteRepository = {
  create({ groupId, inviterId, inviteeId = null, singleUse = true, expiresInDays = 7 }) {
    const id = makeId('inv')
    const token = makeToken()
    const expiresAt = new Date(Date.now() + expiresInDays * 86400000).toISOString()
    db.prepare(
      `INSERT INTO group_invites (id, token, group_id, inviter_id, invitee_id, single_use, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(id, token, groupId, inviterId, inviteeId, singleUse ? 1 : 0, expiresAt)
    return this.findById(id)
  },

  findById(id) {
    return rowToInvite(db.prepare(`SELECT * FROM group_invites WHERE id = ?`).get(id))
  },

  findByToken(token) {
    return rowToInvite(db.prepare(`SELECT * FROM group_invites WHERE token = ?`).get(token))
  },

  listPendingForUser(userId) {
    return db
      .prepare(`SELECT * FROM group_invites WHERE invitee_id = ? AND status = 'pending' ORDER BY created_at DESC`)
      .all(userId)
      .map(rowToInvite)
  },

  listForGroup(groupId) {
    return db
      .prepare(`SELECT * FROM group_invites WHERE group_id = ? AND status = 'pending' ORDER BY created_at DESC`)
      .all(groupId)
      .map(rowToInvite)
  },

  markStatus(id, status) {
    db.prepare(`UPDATE group_invites SET status = ? WHERE id = ?`).run(status, id)
    return this.findById(id)
  },

  isExpired(invite) {
    return new Date(invite.expiresAt).getTime() < Date.now()
  },
}
