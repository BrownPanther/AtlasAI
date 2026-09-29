import { db } from '../db/index.js'
import { makeId } from '../utils/id.js'

function rowToTrip(row) {
  if (!row) return null
  return {
    id: row.id,
    ownerId: row.owner_id,
    title: row.title,
    destination: row.destination,
    origin: row.origin,
    startDate: row.start_date,
    endDate: row.end_date,
    budget: row.budget,
    status: row.status,
    request: row.request_json ? JSON.parse(row.request_json) : null,
    finalPlan: row.final_plan_json ? JSON.parse(row.final_plan_json) : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export const tripRepository = {
  create({ ownerId, title, destination, origin, startDate, endDate, budget, request, finalPlan }) {
    const id = makeId('trip')
    db.prepare(
      `INSERT INTO trips (id, owner_id, title, destination, origin, start_date, end_date, budget, request_json, final_plan_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(id, ownerId, title, destination, origin || null, startDate || null, endDate || null, budget || 0, JSON.stringify(request || null), JSON.stringify(finalPlan || null))
    db.prepare(`INSERT OR IGNORE INTO trip_members (trip_id, user_id, role) VALUES (?, ?, 'owner')`).run(id, ownerId)
    return this.findById(id)
  },

  findById(id) {
    return rowToTrip(db.prepare(`SELECT * FROM trips WHERE id = ?`).get(id))
  },

  listForUser(userId) {
    return db
      .prepare(
        `SELECT t.* FROM trips t
         JOIN trip_members tm ON tm.trip_id = t.id
         WHERE tm.user_id = ?
         ORDER BY t.created_at DESC`
      )
      .all(userId)
      .map(rowToTrip)
  },

  isMember(tripId, userId) {
    return Boolean(db.prepare(`SELECT 1 FROM trip_members WHERE trip_id = ? AND user_id = ?`).get(tripId, userId))
  },

  addMember(tripId, userId, role = 'member') {
    db.prepare(`INSERT OR IGNORE INTO trip_members (trip_id, user_id, role) VALUES (?, ?, ?)`).run(tripId, userId, role)
  },

  update(id, fields) {
    const map = {
      title: 'title',
      destination: 'destination',
      origin: 'origin',
      startDate: 'start_date',
      endDate: 'end_date',
      budget: 'budget',
      status: 'status',
    }
    const sets = []
    const values = []
    for (const [key, col] of Object.entries(map)) {
      if (fields[key] !== undefined) {
        sets.push(`${col} = ?`)
        values.push(fields[key])
      }
    }
    if (fields.finalPlan !== undefined) {
      sets.push(`final_plan_json = ?`)
      values.push(JSON.stringify(fields.finalPlan))
    }
    if (sets.length === 0) return this.findById(id)
    sets.push(`updated_at = datetime('now')`)
    values.push(id)
    db.prepare(`UPDATE trips SET ${sets.join(', ')} WHERE id = ?`).run(...values)
    return this.findById(id)
  },

  delete(id) {
    db.prepare(`DELETE FROM trips WHERE id = ?`).run(id)
  },

  count() {
    return db.prepare(`SELECT COUNT(*) as c FROM trips`).get().c
  },

  countByStatus() {
    return db.prepare(`SELECT status, COUNT(*) as c FROM trips GROUP BY status`).all()
  },

  all(limit = 200) {
    return db.prepare(`SELECT * FROM trips ORDER BY created_at DESC LIMIT ?`).all(limit).map(rowToTrip)
  },

  popularDestinations(limit = 5) {
    return db
      .prepare(`SELECT destination, COUNT(*) as count FROM trips GROUP BY destination ORDER BY count DESC LIMIT ?`)
      .all(limit)
  },
}
