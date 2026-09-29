import { db } from '../db/index.js'
import { makeId } from '../utils/id.js'

function rowToTicket(row) {
  if (!row) return null
  return {
    id: row.id,
    userId: row.user_id,
    subject: row.subject,
    message: row.message,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export const supportRepository = {
  create({ userId, subject, message }) {
    const id = makeId('tkt')
    db.prepare(`INSERT INTO support_tickets (id, user_id, subject, message) VALUES (?, ?, ?, ?)`).run(id, userId, subject, message)
    return this.findById(id)
  },

  findById(id) {
    return rowToTicket(db.prepare(`SELECT * FROM support_tickets WHERE id = ?`).get(id))
  },

  listForUser(userId) {
    return db.prepare(`SELECT * FROM support_tickets WHERE user_id = ? ORDER BY created_at DESC`).all(userId).map(rowToTicket)
  },

  updateStatus(id, status) {
    db.prepare(`UPDATE support_tickets SET status = ?, updated_at = datetime('now') WHERE id = ?`).run(status, id)
    return this.findById(id)
  },

  all(limit = 200) {
    return db.prepare(`SELECT * FROM support_tickets ORDER BY created_at DESC LIMIT ?`).all(limit).map(rowToTicket)
  },

  count() {
    return db.prepare(`SELECT COUNT(*) as c FROM support_tickets`).get().c
  },
}
