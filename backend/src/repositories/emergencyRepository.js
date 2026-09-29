import { db } from '../db/index.js'
import { makeId } from '../utils/id.js'

function rowToAlert(row) {
  if (!row) return null
  return {
    id: row.id,
    tripId: row.trip_id,
    userId: row.user_id,
    status: row.status,
    latitude: row.latitude,
    longitude: row.longitude,
    notes: row.notes,
    createdAt: row.created_at,
    resolvedAt: row.resolved_at,
  }
}

export const emergencyRepository = {
  create({ tripId, userId, latitude = null, longitude = null, notes = null }) {
    const id = makeId('emg')
    db.prepare(
      `INSERT INTO emergency_alerts (id, trip_id, user_id, latitude, longitude, notes) VALUES (?, ?, ?, ?, ?, ?)`
    ).run(id, tripId, userId, latitude, longitude, notes)
    return this.findById(id)
  },

  findById(id) {
    return rowToAlert(db.prepare(`SELECT * FROM emergency_alerts WHERE id = ?`).get(id))
  },

  activeForTrip(tripId) {
    return rowToAlert(
      db.prepare(`SELECT * FROM emergency_alerts WHERE trip_id = ? AND status = 'active' ORDER BY created_at DESC, rowid DESC LIMIT 1`).get(tripId)
    )
  },

  listForTrip(tripId) {
    return db.prepare(`SELECT * FROM emergency_alerts WHERE trip_id = ? ORDER BY created_at DESC`).all(tripId).map(rowToAlert)
  },

  resolve(id) {
    db.prepare(`UPDATE emergency_alerts SET status = 'resolved', resolved_at = datetime('now') WHERE id = ?`).run(id)
    return this.findById(id)
  },

  all(limit = 200) {
    return db.prepare(`SELECT * FROM emergency_alerts ORDER BY created_at DESC LIMIT ?`).all(limit).map(rowToAlert)
  },

  count() {
    return db.prepare(`SELECT COUNT(*) as c FROM emergency_alerts`).get().c
  },

  countByStatus() {
    return db.prepare(`SELECT status, COUNT(*) as c FROM emergency_alerts GROUP BY status`).all()
  },
}
