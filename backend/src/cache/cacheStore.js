import { db } from '../db/index.js'

// Generic TTL cache for normalized external-provider responses, backed by
// the provider_cache table (see schema.sql). Kept deliberately simple —
// this is a prototype-scale cache, not a distributed cache. Suggested TTLs
// per category live in services/cacheDurations.js.

// Statements are prepared lazily: server.js imports this module before
// runMigrations() has created provider_cache on a brand-new database, and
// db.prepare() throws if the table doesn't exist yet.
let statements = null
function stmts() {
  if (!statements) {
    statements = {
      get: db.prepare(`SELECT value_json, expires_at FROM provider_cache WHERE cache_key = ?`),
      set: db.prepare(
        `INSERT INTO provider_cache (cache_key, provider, category, value_json, expires_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(cache_key) DO UPDATE SET value_json = excluded.value_json, expires_at = excluded.expires_at, created_at = datetime('now')`
      ),
      deleteExpired: db.prepare(`DELETE FROM provider_cache WHERE expires_at <= datetime('now')`),
    }
  }
  return statements
}

function parseValue(json) {
  try {
    return JSON.parse(json)
  } catch {
    return null
  }
}

export const cacheStore = {
  /** Build a stable cache key from a category, provider name, and a plain params object. */
  buildKey(category, provider, params = {}) {
    const sorted = Object.keys(params)
      .filter((k) => params[k] !== undefined)
      .sort()
      .map((k) => `${k}=${params[k]}`)
      .join('&')
    return `${category}:${provider}:${sorted}`
  },

  /** Returns the cached value (already parsed), or null if missing/expired. */
  get(cacheKey) {
    const row = stmts().get.get(cacheKey)
    if (!row) return null
    if (new Date(row.expires_at.replace(' ', 'T') + 'Z').getTime() <= Date.now()) return null
    return parseValue(row.value_json)
  },

  /**
   * Like get(), but also returns entries past their TTL (until sweepExpired
   * removes them). Only for "provider is down, show the last good answer"
   * fallbacks — callers must label the result as cached.
   */
  getStale(cacheKey) {
    const row = stmts().get.get(cacheKey)
    return row ? parseValue(row.value_json) : null
  },

  /** Stores a value with a TTL in seconds. */
  set(cacheKey, { provider, category, value, ttlSeconds }) {
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString().slice(0, 19).replace('T', ' ')
    stmts().set.run(cacheKey, provider, category, JSON.stringify(value), expiresAt)
  },

  /** Best-effort housekeeping — call occasionally (e.g. on server start), not on every request. */
  sweepExpired() {
    stmts().deleteExpired.run()
  },
}
