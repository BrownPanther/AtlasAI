import { AlertTriangle, Info } from 'lucide-react'

const SEGMENTS = [
  { key: 'transport', label: 'Transport', color: '#7c3aed' },
  { key: 'stay', label: 'Stay', color: '#d24bd1' },
  { key: 'activities', label: 'Activities', color: '#ff765f' },
  { key: 'food', label: 'Food', color: '#f59e0b' },
  { key: 'localTravel', label: 'Local travel', color: '#22c55e' },
  { key: 'contingency', label: 'Contingency', color: '#64748b' },
]

const SOURCE_LABEL = { live: 'Live', cached: 'Cached', estimated: 'Estimated', sample: 'Sample', unavailable: 'Unavailable' }
const SOURCE_COLOR = { live: '#22c55e', cached: '#3b82f6', estimated: '#f59e0b', sample: '#94a3b8', unavailable: '#ef4444' }

function SourceDot({ state }) {
  if (!state) return null
  return <span title={SOURCE_LABEL[state] || state} style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: SOURCE_COLOR[state] || '#94a3b8', marginLeft: 6, verticalAlign: 'middle' }} />
}

export default function BudgetPanel({ finalPlan }) {
  const budget = finalPlan.budget || {}
  const breakdown = budget.breakdown || {}
  const components = budget.components || {}
  const total = budget.total || 1
  const sourceStatus = finalPlan.sourceStatus || {}
  const unavailable = budget.unavailable || []
  const isLowerBound = budget.isLowerBound

  return (
    <div className="atlas-surface" style={{ padding: 24, marginTop: 20 }}>
      <p className="atlas-eyebrow">Budget breakdown</p>
      <h3 style={{ marginTop: 6, fontSize: 20 }}>
        {isLowerBound ? 'Minimum estimated cost' : finalPlan.dataSource === 'sample' ? 'Estimated from sample pricing' : 'Estimated trip cost'}
        {isLowerBound && <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--muted)', marginLeft: 8 }}>(lower bound — some prices unavailable)</span>}
      </h3>

      <div className="atlas-budget-bar">
        {SEGMENTS.map((seg) => {
          const value = breakdown[seg.key] || 0
          const pct = (value / total) * 100
          return pct > 0 ? <div key={seg.key} className="atlas-budget-seg" style={{ width: `${pct}%`, background: seg.color }} title={`${seg.label}: ₹${value.toLocaleString()}`} /> : null
        })}
      </div>

      <div className="atlas-budget-legend">
        {SEGMENTS.map((seg) => {
          const isUnavailable = unavailable.includes(seg.key)
          const comp = components[seg.key]
          const sourceState = seg.key === 'transport' ? sourceStatus.flights?.state : seg.key === 'stay' ? sourceStatus.hotels?.state : seg.key === 'activities' ? sourceStatus.attractions?.state : null
          return (
            <div className="atlas-budget-legend-row" key={seg.key}>
              <span>
                <span className="dot" style={{ background: isUnavailable ? '#ef4444' : seg.color }} />
                {seg.label}
                {sourceState && <SourceDot state={sourceState} />}
              </span>
              <b style={isUnavailable ? { color: 'var(--muted)', fontStyle: 'italic' } : undefined}>
                {isUnavailable ? 'Unavailable' : `₹${(breakdown[seg.key] || 0).toLocaleString()}`}
                {comp?.note && !isUnavailable && <span style={{ fontSize: 8, fontWeight: 400, color: 'var(--muted)', marginLeft: 4 }}>({comp.note})</span>}
              </b>
            </div>
          )
        })}
      </div>

      <div className="atlas-budget-total">
        <div>
          <span style={{ fontSize: 10, color: 'var(--muted)' }}>{isLowerBound ? 'At least' : 'Total estimated'}</span><br />
          <strong>₹{total.toLocaleString()}{isLowerBound ? '+' : ''}</strong>
        </div>
        {budget.budget != null && (
          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: 10, color: 'var(--muted)' }}>{budget.violated ? 'Over by' : 'Remaining'}</span><br />
            <strong style={{ color: budget.violated ? 'var(--color-danger)' : 'var(--color-success)' }}>
              ₹{Math.abs(budget.remaining ?? 0).toLocaleString()}
            </strong>
          </div>
        )}
      </div>

      {budget.violated && (
        <div className="atlas-budget-warn">
          <AlertTriangle size={14} /> This plan is {budget.percentUsed}% of your stated budget. Consider a lower comfort tier or fewer activities.
        </div>
      )}

      {isLowerBound && !budget.violated && (
        <div className="atlas-budget-warn" style={{ borderColor: 'rgba(245,158,11,.35)', color: 'var(--text)' }}>
          <Info size={14} style={{ color: '#f59e0b', flexShrink: 0 }} />
          <span style={{ fontSize: 11 }}>
            Some prices were unavailable ({unavailable.join(', ')}). The total shown is a lower bound — actual cost will be higher.
            {budget.fitsBudgetConfirmed === false && ' Budget fit cannot be confirmed until all prices are known.'}
          </span>
        </div>
      )}

      {budget.costs?.estimated > 0 && !budget.violated && (
        <div className="atlas-budget-warn" style={{ borderColor: 'rgba(245,158,11,.35)', color: 'var(--text)', marginTop: 8 }}>
          <Info size={14} style={{ color: '#f59e0b', flexShrink: 0 }} />
          <span style={{ fontSize: 11 }}>
            Includes ₹{budget.costs.estimated.toLocaleString()} in planning estimates (transport/stay). Estimates are not confirmed booking prices.
          </span>
        </div>
      )}
    </div>
  )
}
