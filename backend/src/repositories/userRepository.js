import { db } from '../db/index.js'
import { makeId } from '../utils/id.js'

const PUBLIC_FIELDS = `id, username, email, role, home_location as homeLocation,
  comfort_pref as comfortPref, travel_mode_pref as travelModePref, interests,
  created_at as createdAt, updated_at as updatedAt`

function rowToPublicUser(row) {
  if (!row) return null
  return row
}

export const userRepository = {
  create({ username, email, passwordHash, passwordSalt }) {
    const id = makeId('usr')
    db.prepare(
      `INSERT INTO users (id, username, email, password_hash, password_salt)
       VALUES (?, ?, ?, ?, ?)`
    ).run(id, username, email, passwordHash, passwordSalt)
    return this.findById(id)
  },

  findById(id) {
    const row = db.prepare(`SELECT ${PUBLIC_FIELDS} FROM users WHERE id = ?`).get(id)
    return rowToPublicUser(row)
  },

  findByEmail(email) {
    return db.prepare(`SELECT * FROM users WHERE email = ?`).get(email)
  },

  findByUsername(username) {
    return db.prepare(`SELECT * FROM users WHERE username = ?`).get(username)
  },

  searchByUsername(query, excludeUserId, limit = 10) {
    const rows = db
      .prepare(
        `SELECT ${PUBLIC_FIELDS} FROM users
         WHERE username LIKE ? AND id != ?
         ORDER BY username ASC LIMIT ?`
      )
      .all(`%${query}%`, excludeUserId, limit)
    return rows
  },

  updateProfile(id, fields) {
    const allowed = ['home_location', 'comfort_pref', 'travel_mode_pref', 'interests']
    const map = {
      homeLocation: 'home_location',
      comfortPref: 'comfort_pref',
      travelModePref: 'travel_mode_pref',
      interests: 'interests',
    }
    const sets = []
    const values = []
    for (const [key, col] of Object.entries(map)) {
      if (fields[key] !== undefined && allowed.includes(col)) {
        sets.push(`${col} = ?`)
        values.push(fields[key])
      }
    }
    if (sets.length === 0) return this.findById(id)
    sets.push(`updated_at = datetime('now')`)
    values.push(id)
    db.prepare(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`).run(...values)
    return this.findById(id)
  },

  count() {
    return db.prepare(`SELECT COUNT(*) as c FROM users`).get().c
  },

  all(limit = 100) {
    return db.prepare(`SELECT ${PUBLIC_FIELDS} FROM users ORDER BY created_at DESC LIMIT ?`).all(limit)
  },
}
