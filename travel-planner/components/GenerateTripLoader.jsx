import { useEffect, useRef } from 'react'
import { CheckCircle2, Loader2, AlertTriangle, Sparkles } from 'lucide-react'
import { useAgentStream } from '../hooks/useAgentStream'

// Collapse the raw trace (which has a 'running' + a terminal entry per agent,
// plus retry entries) into one row per agent showing its latest status —
// this is what actually happened, not a scripted animation.
function collapseTrace(trace) {
  const order = []
  const byKey = {}
  for (const entry of trace) {
    const key = `${entry.agent}__${entry.iteration}`
    if (!byKey[key]) {
      byKey[key] = { ...entry }
      order.push(key)
    } else {
      byKey[key] = { ...byKey[key], ...entry }
    }
  }
  return order.map((k) => byKey[k])
}

export default function GenerateTripLoader({ tripRequest, onDone, onError }) {
  const { start, trace, status, result, error } = useAgentStream()
  const startedRef = useRef(false)

  useEffect(() => {
    if (startedRef.current) return
    startedRef.current = true
    start(tripRequest)
  }, [start, tripRequest])

  useEffect(() => {
    if (status === 'done' && result) onDone(result)
    if (status === 'error' && error) onError?.(error)
  }, [status, result, error, onDone, onError])

  const rows = collapseTrace(trace)
  const completedCount = rows.filter((r) => r.status !== 'running' && r.status !== 'retrying').length
  const progressPercent = status === 'done' ? 100 : Math.min(Math.round((completedCount / Math.max(rows.length, 6)) * 100), 95)
  const hasRunning = rows.some((r) => r.status === 'running' || r.status === 'retrying')

  return (
    <div className="atlas-ai-plan-card">
      <div className="atlas-ai-plan-header">
        <div className="atlas-ai-plan-icon-badge">
          <Sparkles size={20} />
        </div>
        <div>
          <span className="atlas-eyebrow">AtlasAI Intelligence Engine</span>
          <h3 className="atlas-ai-plan-title">Building your perfect trip</h3>
          <p className="atlas-ai-plan-desc">
            {status === 'error'
              ? 'Something went wrong while planning.'
              : 'Coordinating transport, stays and activities in real time...'}
          </p>
        </div>
      </div>

      <div className="atlas-ai-loader-list">
        {rows.map((entry, i) => {
          const isRunning = entry.status === 'running' || entry.status === 'retrying'
          const isError = entry.status === 'error'
          const isWarning = entry.status === 'warning'
          const isSuccess = !isRunning && !isError && !isWarning
          return (
            <div
              key={`${entry.agent}-${entry.iteration}-${i}`}
              className={`atlas-ai-loader-row ${isRunning ? 'is-running' : isError ? 'is-error' : isWarning ? 'is-warning' : 'is-success'}`}
            >
              <div className="atlas-ai-loader-icon-col">
                {isError ? (
                  <AlertTriangle size={16} className="atlas-loader-ico-error" />
                ) : isWarning ? (
                  <AlertTriangle size={16} className="atlas-loader-ico-warning" />
                ) : isRunning ? (
                  <Loader2 size={16} className="animate-spin atlas-loader-ico-running" />
                ) : (
                  <CheckCircle2 size={16} className="atlas-loader-ico-success" />
                )}
              </div>
              <div className="atlas-ai-loader-content-col">
                <div className="atlas-ai-loader-name">
                  <span>{entry.iteration > 0 ? `[Replan ${entry.iteration}] ` : ''}{entry.agent}</span>
                  {typeof entry.ms === 'number' && (
                    <span className="atlas-ai-loader-time">{entry.ms}ms</span>
                  )}
                </div>
                <div className="atlas-ai-loader-summary">
                  {entry.summary || (isRunning ? 'Processing...' : 'Completed')}
                </div>
              </div>
            </div>
          )
        })}

        {status === 'error' && (
          <div className="atlas-ai-loader-row is-error">
            <div className="atlas-ai-loader-icon-col">
              <AlertTriangle size={16} className="atlas-loader-ico-error" />
            </div>
            <div className="atlas-ai-loader-content-col">
              <div className="atlas-ai-loader-name">Planning Error</div>
              <div className="atlas-ai-loader-summary">{error || 'Something went wrong while planning.'}</div>
            </div>
          </div>
        )}
      </div>

      <div className="atlas-ai-loader-footer">
        <div className="atlas-ai-loader-progress-labels">
          <span className="atlas-ai-loader-stage">
            {status === 'done' ? 'Itinerary finalized' : hasRunning ? 'Coordinating agents in parallel...' : 'Processing trip request...'}
          </span>
          <span className="atlas-ai-loader-pct">{progressPercent}%</span>
        </div>
        <div className="atlas-ai-loader-progress-track">
          <div
            className="atlas-ai-loader-progress-fill"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>
    </div>
  )
}
