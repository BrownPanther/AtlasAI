/**
 * All providers implement:
 *   explain(kind, payload) -> Promise<string>   short natural-language explanation
 *   isAvailable() -> boolean
 * The orchestration logic itself never depends on a provider being available —
 * providers only ever produce *explanatory text*, never decisions.
 */
export class LLMProvider {
  async explain(_kind, _payload) {
    throw new Error('explain() not implemented')
  }
  isAvailable() {
    return false
  }
}
