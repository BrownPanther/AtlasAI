import { db } from '../db/index.js'
import { makeId } from '../utils/id.js'

function rowToFeedback(row) {
  if (!row) return null
  return { id: row.id, userId: row.user_id, category: row.category, message: row.message, createdAt: row.created_at }
}

export const feedbackRepository = {
  create({ userId, category, message }) {
    const id = makeId('fbk')
    db.prepare(`INSERT INTO feedback (id, user_id, category, message) VALUES (?, ?, ?, ?)`).run(id, userId, category || null, message)
    return this.findById(id)
  },

  findById(id) {
    return rowToFeedback(db.prepare(`SELECT * FROM feedback WHERE id = ?`).get(id))
  },

  listForUser(userId) {
    return db.prepare(`SELECT * FROM feedback WHERE user_id = ? ORDER BY created_at DESC`).all(userId).map(rowToFeedback)
  },

  all(limit = 200) {
    return db.prepare(`SELECT * FROM feedback ORDER BY created_at DESC LIMIT ?`).all(limit).map(rowToFeedback)
  },
}
