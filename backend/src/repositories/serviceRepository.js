import { db } from '../db/index.js'

function rowToService(row) {
  if (!row) return null
  return {
    id: row.id,
    type: row.type,
    provider: row.provider,
    route: row.route,
    price: row.price,
    meta: row.meta_json ? JSON.parse(row.meta_json) : null,
    dataSource: row.data_source,
  }
}

export const serviceRepository = {
  // Services aren't managed through their own CRUD UI — they're upserted the
  // moment something (a booking, a review) references one, using whatever
  // details the caller already has (the sample data the frontend is showing).
  upsert({ id, type, provider, route, price, meta = null, dataSource = 'sample' }) {
    db.prepare(
      `INSERT INTO services (id, type, provider, route, price, meta_json, data_source)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET provider = excluded.provider, route = excluded.route, price = excluded.price, meta_json = excluded.meta_json`
    ).run(id, type, provider, route || null, price, meta ? JSON.stringify(meta) : null, dataSource)
    return this.findById(id)
  },

  findById(id) {
    return rowToService(db.prepare(`SELECT * FROM services WHERE id = ?`).get(id))
  },

  ratingSummary(id) {
    const row = db
      .prepare(
        `SELECT COUNT(*) as count, AVG(rating) as avg, SUM(CASE WHEN verified = 1 THEN 1 ELSE 0 END) as verifiedCount
         FROM reviews WHERE service_id = ?`
      )
      .get(id)
    return {
      count: row.count || 0,
      average: row.count ? Math.round(row.avg * 10) / 10 : null,
      verifiedCount: row.verifiedCount || 0,
    }
  },
}
