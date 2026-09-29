import { db } from '../db/index.js'
import { makeId } from '../utils/id.js'

function rowToGroup(row) {
  if (!row) return null
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    ownerId: row.owner_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export const groupRepository = {
  create({ name, description, ownerId }) {
    const id = makeId('grp')
    db.prepare(`INSERT INTO groups (id, name, description, owner_id) VALUES (?, ?, ?, ?)`).run(id, name, description || null, ownerId)
    db.prepare(`INSERT INTO group_members (group_id, user_id, role) VALUES (?, ?, 'owner')`).run(id, ownerId)
    return this.findById(id)
  },

  findById(id) {
    return rowToGroup(db.prepare(`SELECT * FROM groups WHERE id = ?`).get(id))
  },

  listForUser(userId) {
    return db
      .prepare(
        `SELECT g.*, gm.role as my_role,
          (SELECT COUNT(*) FROM group_members WHERE group_id = g.id) as member_count
         FROM groups g
         JOIN group_members gm ON gm.group_id = g.id
         WHERE gm.user_id = ?
         ORDER BY g.updated_at DESC`
      )
      .all(userId)
      .map((row) => ({ ...rowToGroup(row), myRole: row.my_role, memberCount: row.member_count }))
  },

  update(id, fields) {
    const sets = []
    const values = []
    if (fields.name !== undefined) { sets.push('name = ?'); values.push(fields.name) }
    if (fields.description !== undefined) { sets.push('description = ?'); values.push(fields.description) }
    if (sets.length === 0) return this.findById(id)
    sets.push(`updated_at = datetime('now')`)
    values.push(id)
    db.prepare(`UPDATE groups SET ${sets.join(', ')} WHERE id = ?`).run(...values)
    return this.findById(id)
  },

  delete(id) {
    db.prepare(`DELETE FROM groups WHERE id = ?`).run(id)
  },

  // --- membership ---

  isMember(groupId, userId) {
    return Boolean(db.prepare(`SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?`).get(groupId, userId))
  },

  getMemberRole(groupId, userId) {
    const row = db.prepare(`SELECT role FROM group_members WHERE group_id = ? AND user_id = ?`).get(groupId, userId)
    return row?.role || null
  },

  listMembers(groupId) {
    return db
      .prepare(
        `SELECT u.id, u.username, gm.role, gm.joined_at as joinedAt
         FROM group_members gm JOIN users u ON u.id = gm.user_id
         WHERE gm.group_id = ?
         ORDER BY CASE gm.role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END, gm.joined_at ASC`
      )
      .all(groupId)
  },

  addMember(groupId, userId, role = 'member') {
    db.prepare(`INSERT OR IGNORE INTO group_members (group_id, user_id, role) VALUES (?, ?, ?)`).run(groupId, userId, role)
  },

  removeMember(groupId, userId) {
    db.prepare(`DELETE FROM group_members WHERE group_id = ? AND user_id = ?`).run(groupId, userId)
  },

  memberCount(groupId) {
    return db.prepare(`SELECT COUNT(*) as c FROM group_members WHERE group_id = ?`).get(groupId).c
  },

  count() {
    return db.prepare(`SELECT COUNT(*) as c FROM groups`).get().c
  },

  all(limit = 200) {
    return db
      .prepare(
        `SELECT g.*, (SELECT COUNT(*) FROM group_members WHERE group_id = g.id) as member_count
         FROM groups g ORDER BY g.created_at DESC LIMIT ?`
      )
      .all(limit)
      .map((row) => ({ ...rowToGroup(row), memberCount: row.member_count }))
  },
}
