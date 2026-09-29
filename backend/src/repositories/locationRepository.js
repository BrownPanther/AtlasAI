import { db } from '../db/index.js'
import { makeId } from '../utils/id.js'

function rowToLocation(row) {
  if (!row) return null
  return {
    id: row.id,
    tripId: row.trip_id,
    userId: row.user_id,
    latitude: row.latitude,
    longitude: row.longitude,
    shareToken: row.share_token,
    shareExpiresAt: row.share_expires_at,
    createdAt: row.created_at,
  }
}

export const locationRepository = {
  create({ tripId, userId, latitude, longitude, shareToken = null, shareExpiresAt = null }) {
    const id = makeId('loc')
    db.prepare(
      `INSERT INTO location_updates (id, trip_id, user_id, latitude, longitude, share_token, share_expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(id, tripId, userId, latitude, longitude, shareToken, shareExpiresAt)
    return this.findById(id)
  },

  findById(id) {
    return rowToLocation(db.prepare(`SELECT * FROM location_updates WHERE id = ?`).get(id))
  },

  latestForTrip(tripId) {
    return rowToLocation(
      db.prepare(`SELECT * FROM location_updates WHERE trip_id = ? ORDER BY created_at DESC, rowid DESC LIMIT 1`).get(tripId)
    )
  },

  historyForTrip(tripId, limit = 50) {
    return db
      .prepare(`SELECT * FROM location_updates WHERE trip_id = ? ORDER BY created_at DESC, rowid DESC LIMIT ?`)
      .all(tripId, limit)
      .map(rowToLocation)
  },

  // Most recent row that was ever stamped with this exact token. The caller
  // still has to confirm it's the *current* active token for the trip (see
  // safetyService) — tokens aren't individually revoked, they're superseded.
  findLatestByToken(token) {
    return rowToLocation(
      db.prepare(`SELECT * FROM location_updates WHERE share_token = ? ORDER BY created_at DESC, rowid DESC LIMIT 1`).get(token)
    )
  },
}
