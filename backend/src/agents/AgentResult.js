/**
 * Standard, safe-to-expose result shape for every agent.
 * `reasoning` is structured (decisions/reasons/tradeoffs/etc), never raw
 * chain-of-thought — this is what the "AI Insights" tab in the UI reads from.
 */
export function agentResult({
  status = 'success', // 'success' | 'warning' | 'error'
  summary = '',
  data = {},
  reasoning = {},
  confidence = null,
  issues = [],
}) {
  return {
    status,
    summary,
    data,
    reasoning: {
      decisions: reasoning.decisions || [],
      reasons: reasoning.reasons || [],
      constraintsConsidered: reasoning.constraintsConsidered || [],
      tradeoffs: reasoning.tradeoffs || [],
      selectedOptions: reasoning.selectedOptions || [],
    },
    confidence,
    issues,
  }
}
