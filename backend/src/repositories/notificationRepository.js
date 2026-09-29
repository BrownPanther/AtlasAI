import { db } from '../db/index.js'
import { makeId } from '../utils/id.js'

function rowToNotification(row) {
  if (!row) return null
  return {
    id: row.id,
    userId: row.user_id,
    type: row.type,
    title: row.title,
    body: row.body,
    link: row.link,
    read: Boolean(row.read),
    meta: row.meta_json ? JSON.parse(row.meta_json) : null,
    createdAt: row.created_at,
  }
}

export const notificationRepository = {
  create({ userId, type, title, body = null, link = null, meta = null }) {
    const id = makeId('ntf')
    db.prepare(
      `INSERT INTO notifications (id, user_id, type, title, body, link, meta_json) VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(id, userId, type, title, body, link, meta ? JSON.stringify(meta) : null)
    return this.findById(id)
  },

  findById(id) {
    return rowToNotification(db.prepare(`SELECT * FROM notifications WHERE id = ?`).get(id))
  },

  listForUser(userId, limit = 50) {
    return db.prepare(`SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT ?`).all(userId, limit).map(rowToNotification)
  },

  unreadCount(userId) {
    return db.prepare(`SELECT COUNT(*) as c FROM notifications WHERE user_id = ? AND read = 0`).get(userId).c
  },

  markRead(id, userId) {
    db.prepare(`UPDATE notifications SET read = 1 WHERE id = ? AND user_id = ?`).run(id, userId)
    return this.findById(id)
  },

  markAllRead(userId) {
    db.prepare(`UPDATE notifications SET read = 1 WHERE user_id = ? AND read = 0`).run(userId)
  },
}
