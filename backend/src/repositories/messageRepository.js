import { db } from '../db/index.js'
import { makeId } from '../utils/id.js'

function rowToMessage(row) {
  if (!row) return null
  return {
    id: row.id,
    groupId: row.group_id,
    senderId: row.sender_id,
    senderUsername: row.username,
    body: row.body,
    kind: row.kind,
    meta: row.meta_json ? JSON.parse(row.meta_json) : null,
    createdAt: row.created_at,
  }
}

export const messageRepository = {
  create({ groupId, senderId, body, kind = 'text', meta = null }) {
    const id = makeId('msg')
    db.prepare(
      `INSERT INTO messages (id, group_id, sender_id, body, kind, meta_json) VALUES (?, ?, ?, ?, ?, ?)`
    ).run(id, groupId, senderId, body, kind, meta ? JSON.stringify(meta) : null)
    return this.findById(id)
  },

  findById(id) {
    return rowToMessage(
      db
        .prepare(`SELECT m.*, u.username FROM messages m JOIN users u ON u.id = m.sender_id WHERE m.id = ?`)
        .get(id)
    )
  },

  listForGroup(groupId, limit = 100) {
    return db
      .prepare(
        `SELECT m.*, u.username FROM messages m JOIN users u ON u.id = m.sender_id
         WHERE m.group_id = ? ORDER BY m.created_at ASC LIMIT ?`
      )
      .all(groupId, limit)
      .map(rowToMessage)
  },
}
