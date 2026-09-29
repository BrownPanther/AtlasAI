import { db } from '../db/index.js'
import { makeId } from '../utils/id.js'

function rowToReview(row) {
  if (!row) return null
  return {
    id: row.id,
    serviceId: row.service_id,
    bookingId: row.booking_id,
    userId: row.user_id,
    username: row.username,
    rating: row.rating,
    title: row.title,
    body: row.body,
    verified: Boolean(row.verified),
    createdAt: row.created_at,
  }
}

export const reviewRepository = {
  create({ serviceId, bookingId, userId, rating, title, body, verified = true }) {
    const id = makeId('rev')
    db.prepare(
      `INSERT INTO reviews (id, service_id, booking_id, user_id, rating, title, body, verified)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(id, serviceId, bookingId, userId, rating, title || null, body || null, verified ? 1 : 0)
    return this.findById(id)
  },

  findById(id) {
    return rowToReview(
      db.prepare(`SELECT r.*, u.username FROM reviews r JOIN users u ON u.id = r.user_id WHERE r.id = ?`).get(id)
    )
  },

  findByBookingId(bookingId) {
    return rowToReview(
      db.prepare(`SELECT r.*, u.username FROM reviews r JOIN users u ON u.id = r.user_id WHERE r.booking_id = ?`).get(bookingId)
    )
  },

  listForService(serviceId, limit = 50) {
    return db
      .prepare(
        `SELECT r.*, u.username FROM reviews r JOIN users u ON u.id = r.user_id
         WHERE r.service_id = ? ORDER BY r.created_at DESC LIMIT ?`
      )
      .all(serviceId, limit)
      .map(rowToReview)
  },

  globalStats() {
    const row = db.prepare(`SELECT COUNT(*) as count, AVG(rating) as avg FROM reviews`).get()
    return { count: row.count || 0, average: row.count ? Math.round(row.avg * 10) / 10 : null }
  },
}
