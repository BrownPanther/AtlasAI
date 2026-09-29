import { CheckCircle2, AlertTriangle, RotateCcw, ShieldAlert, Sparkles } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

export default function OrchestratorPanel({ finalPlan }) {
  const navigate = useNavigate()

  if (!finalPlan) return null

  const rows = [
    finalPlan.transport && ['Transport selected', finalPlan.transport?.provider ? `${finalPlan.transport.mode} via ${finalPlan.transport.provider}` : (finalPlan.transport?.mode ? `${finalPlan.transport.mode} route` : null)],
    finalPlan.stay && ['Stay selected', finalPlan.stay?.name ? `${finalPlan.stay.name} (${finalPlan.stay.area})` : null],
    finalPlan.budget && ['Budget check', `₹${finalPlan.budget.total?.toLocaleString()} total (${finalPlan.budget.percentUsed ?? '--'}% of budget)`],
    ['Plan review', finalPlan.approved ? 'Approved — no blocking issues' : `${finalPlan.remainingIssues?.length || 0} unresolved issue(s)`],
  ].filter((r) => r && r[1])

  return (
    <div className="atlas-ai-side atlas-orch-panel-v2" style={{ padding: '16px', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div className="atlas-orch-icon-tag" style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Sparkles size={14} />
          </div>
          <h3 className="atlas-orch-title" style={{ fontSize: '15px', margin: 0, fontWeight: 700 }}>Synthesis Audit</h3>
        </div>
        <span className="atlas-live-pulse-badge" style={{ padding: '3px 8px', fontSize: 10, background: 'var(--surface-hover)', border: 'none', color: 'var(--subtle)' }}>
          100% SYNCED
        </span>
      </div>

      <p style={{ fontSize: '11px', color: 'var(--subtle)', margin: '0 0 16px', lineHeight: 1.4 }}>
        How this plan came together via computational haute curation:
      </p>

      {/* Plan reasoning steps */}
      <div className="atlas-orch-steps-list" style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
        {rows.map(([label, desc]) => (
          <div key={label} className="atlas-orch-step-item" style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
            <div className="atlas-orch-step-icon" style={{ marginTop: '2px' }}>
              {finalPlan.approved ? <CheckCircle2 size={14} color="#86efac" /> : <AlertTriangle size={14} color="#facc15" />}
            </div>
            <div className="atlas-orch-step-content" style={{ fontSize: '12px', lineHeight: 1.4 }}>
              <strong style={{ color: 'var(--text)' }}>{label}:</strong> <span style={{ color: 'var(--subtle)' }}>{desc}</span>
            </div>
          </div>
        ))}
      </div>

      {!finalPlan.approved && finalPlan.remainingIssues?.length > 0 && (
        <div className="atlas-orch-alert-box error" style={{ padding: '8px 12px', fontSize: 11, marginBottom: '12px' }}>
          {finalPlan.remainingIssues.map((i) => (
            <div key={i.type}>• {i.detail || i.type}</div>
          ))}
        </div>
      )}

      {/* Booking disclaimer */}
      {finalPlan.bookingDisclaimer && (
        <div className="atlas-orch-booking-disclaimer" style={{ padding: '10px 12px', fontSize: '11px', display: 'flex', gap: '8px', alignItems: 'flex-start', background: 'rgba(245, 158, 11, 0.1)', color: '#fcd34d', borderRadius: '8px', marginBottom: '12px' }}>
          <ShieldAlert size={14} color="#f59e0b" style={{ flexShrink: 0 }} />
          <span>{finalPlan.bookingDisclaimer}</span>
        </div>
      )}

      <button
        type="button"
        onClick={() => navigate('/plan')}
        className="btn-ai-liquid atlas-orch-replan-btn"
        style={{ width: '100%', padding: '10px', fontSize: '12px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}
      >
        <RotateCcw size={14} className="text-accent" style={{ marginRight: '8px' }} /> Re-plan with AI
      </button>
    </div>
  )
}
