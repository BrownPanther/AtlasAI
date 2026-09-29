import { db } from '../db/index.js'
import { makeId } from '../utils/id.js'

function rowToBooking(row) {
  if (!row) return null
  return {
    id: row.id,
    userId: row.user_id,
    tripId: row.trip_id,
    serviceId: row.service_id,
    type: row.type,
    name: row.name,
    dateLabel: row.date_label,
    price: row.price,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export const bookingRepository = {
  create({ userId, tripId = null, serviceId = null, type, name, dateLabel, price, status = 'pending' }) {
    const id = makeId('bkg')
    db.prepare(
      `INSERT INTO bookings (id, user_id, trip_id, service_id, type, name, date_label, price, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(id, userId, tripId, serviceId, type, name, dateLabel || null, price, status)
    return this.findById(id)
  },

  findById(id) {
    return rowToBooking(db.prepare(`SELECT * FROM bookings WHERE id = ?`).get(id))
  },

  listForUser(userId) {
    return db.prepare(`SELECT * FROM bookings WHERE user_id = ? ORDER BY created_at DESC`).all(userId).map(rowToBooking)
  },

  updateStatus(id, status) {
    db.prepare(`UPDATE bookings SET status = ?, updated_at = datetime('now') WHERE id = ?`).run(status, id)
    return this.findById(id)
  },

  delete(id) {
    db.prepare(`DELETE FROM bookings WHERE id = ?`).run(id)
  },

  countByStatus() {
    return db.prepare(`SELECT status, COUNT(*) as c FROM bookings GROUP BY status`).all()
  },

  count() {
    return db.prepare(`SELECT COUNT(*) as c FROM bookings`).get().c
  },

  all(limit = 200) {
    return db
      .prepare(
        `SELECT b.*, u.username FROM bookings b JOIN users u ON u.id = b.user_id
         ORDER BY b.created_at DESC LIMIT ?`
      )
      .all(limit)
      .map((row) => ({ ...rowToBooking(row), username: row.username }))
  },
}
