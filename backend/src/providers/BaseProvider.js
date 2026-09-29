// Common contract every external travel-data provider follows.
// Concrete providers (OpenTripMap, OpenRouteService, Amadeus, ...) extend
// this and implement their own request-building. Nothing outside
// providers/ and services/ should know these HTTP details.
const DEFAULT_TIMEOUT_MS = 8000

export function redactSecrets(text) {
  return String(text)
    .replace(/(api[_-]?key|access_token|client_secret|appid)=[^&\s"']+/gi, '$1=***')
    .replace(/Bearer\s+[^&\s"']+/gi, 'Bearer ***')
}

export class BaseProvider {
  constructor({ name, category }) {
    this.name = name // short id, e.g. 'opentripmap'
    this.category = category // 'attractions' | 'maps' | 'hotels' | 'flights' | 'trains' | 'weather'
  }

  /** Override in subclasses. Must be cheap/synchronous — just checks env config. */
  isConfigured() {
    return false
  }

  /**
   * Shared fetch helper: JSON-only, timeout-guarded, never throws raw
   * network/parsing errors up to callers — always resolves to a
   * { ok, status, data, error, errorType } shape so services can handle
   * failures uniformly without try/catch sprawl.
   *
   * errorType is one of: 'auth' | 'rate_limited' | 'http' | 'timeout' | 'network'
   * (null on success). `error` is for server-side diagnostics only and has
   * credentials redacted — it must never be sent to end users.
   */
  async request(url, { timeoutMs = DEFAULT_TIMEOUT_MS, ...fetchOpts } = {}) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const res = await fetch(url, { ...fetchOpts, signal: controller.signal })
      const text = await res.text()
      let data = null
      try { data = text ? JSON.parse(text) : null } catch { /* non-JSON response */ }
      if (!res.ok) {
        const errorType = res.status === 401 || res.status === 403 ? 'auth' : res.status === 429 ? 'rate_limited' : 'http'
        return { ok: false, status: res.status, data, error: `${this.name} responded ${res.status}`, errorType }
      }
      return { ok: true, status: res.status, data, error: null, errorType: null }
    } catch (err) {
      const timedOut = err?.name === 'AbortError'
      return {
        ok: false,
        status: 0,
        data: null,
        error: timedOut ? `${this.name} timed out` : redactSecrets(`${this.name} request failed: ${err?.message || 'unknown error'}`),
        errorType: timedOut ? 'timeout' : 'network',
      }
    } finally {
      clearTimeout(timer)
    }
  }
}
