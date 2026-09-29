import { db } from '../db/index.js'
import { makeId } from '../utils/id.js'

function rowToRun(row) {
  if (!row) return null
  return {
    id: row.id,
    tripId: row.trip_id,
    userId: row.user_id,
    status: row.status,
    request: row.request_json ? JSON.parse(row.request_json) : null,
    trace: row.trace_json ? JSON.parse(row.trace_json) : [],
    result: row.result_json ? JSON.parse(row.result_json) : null,
    error: row.error,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
  }
}

export const agentRunRepository = {
  create({ userId, tripId = null, request }) {
    const id = makeId('run')
    db.prepare(
      `INSERT INTO agent_runs (id, trip_id, user_id, status, request_json) VALUES (?, ?, ?, 'running', ?)`
    ).run(id, tripId, userId, JSON.stringify(request))
    return this.findById(id)
  },

  complete(id, { status, trace, result, error = null, tripId = undefined }) {
    if (tripId !== undefined) {
      db.prepare(
        `UPDATE agent_runs SET status = ?, trace_json = ?, result_json = ?, error = ?, trip_id = ?, finished_at = datetime('now') WHERE id = ?`
      ).run(status, JSON.stringify(trace), result ? JSON.stringify(result) : null, error, tripId, id)
    } else {
      db.prepare(
        `UPDATE agent_runs SET status = ?, trace_json = ?, result_json = ?, error = ?, finished_at = datetime('now') WHERE id = ?`
      ).run(status, JSON.stringify(trace), result ? JSON.stringify(result) : null, error, id)
    }
    return this.findById(id)
  },

  findById(id) {
    return rowToRun(db.prepare(`SELECT * FROM agent_runs WHERE id = ?`).get(id))
  },

  findByIdForUser(id, userId) {
    const run = this.findById(id)
    if (!run || run.userId !== userId) return null
    return run
  },

  all(limit = 100) {
    return db.prepare(`SELECT * FROM agent_runs ORDER BY started_at DESC LIMIT ?`).all(limit).map(rowToRun)
  },

  countByStatus() {
    return db.prepare(`SELECT status, COUNT(*) as c FROM agent_runs GROUP BY status`).all()
  },
}
