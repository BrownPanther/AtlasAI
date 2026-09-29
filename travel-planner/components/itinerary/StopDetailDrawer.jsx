import { X, Clock3, MapPin, Wallet, CheckCircle2, Trash2, ArrowRightLeft, CalendarDays } from 'lucide-react'
import { useState } from 'react'

export default function StopDetailDrawer({ stop, dayIndex, dayCount, travelTimeToNextMinutes, alternatives, onClose, onToggleComplete, onRemove, onMove, onReplace }) {
  const [showAlternatives, setShowAlternatives] = useState(false)
  const isActivity = Boolean(stop.id)

  return (
    <>
      <button className="atlas-drawer-backdrop" aria-label="Close" onClick={onClose} />
      <div className="atlas-drawer" role="dialog" aria-modal="true">
        <div className="atlas-drawer-head">
          <div>
            <p className="atlas-eyebrow" style={{ margin: 0 }}>{stop.category}</p>
            <h3 style={{ marginTop: 4, fontSize: 19 }}>{stop.label}</h3>
          </div>
          <button className="atlas-drawer-close" onClick={onClose} aria-label="Close panel"><X size={15} /></button>
        </div>

        <div className="atlas-drawer-section">
          <span className="atlas-drawer-label">Details</span>
          <div className="atlas-drawer-row"><span><Clock3 size={12} style={{ display: 'inline', marginRight: 6 }} />Time</span><b>{stop.startTime} – {stop.endTime}</b></div>
          {stop.area && <div className="atlas-drawer-row"><span><MapPin size={12} style={{ display: 'inline', marginRight: 6 }} />Area</span><b>{stop.area}</b></div>}
          <div className="atlas-drawer-row"><span><Wallet size={12} style={{ display: 'inline', marginRight: 6 }} />Estimated cost</span><b>{stop.costKnown === false ? 'Not listed by provider' : stop.estimatedCost ? `₹${stop.estimatedCost.toLocaleString()}` : 'Free'}</b></div>
          {stop.travelToNext ? (
            <div className="atlas-drawer-row">
              <span>Travel to next stop</span>
              <b>{stop.travelToNext.distanceKm} km · ~{stop.travelToNext.durationMinutes} min ({stop.travelToNext.mode})</b>
            </div>
          ) : typeof travelTimeToNextMinutes === 'number' && (
            <div className="atlas-drawer-row"><span>Travel time to next stop</span><b>~{travelTimeToNextMinutes} min (estimated)</b></div>
          )}
          {stop.notes && <div className="atlas-drawer-row"><span>Notes</span><b style={{ textAlign: 'right', maxWidth: 220 }}>{stop.notes}</b></div>}
        </div>

        <div className="atlas-drawer-section">
          <span className="atlas-drawer-label">Completion</span>
          <button className={`atlas-complete-toggle ${stop.completed ? 'is-checked' : ''}`} style={{ marginTop: 8, width: '100%' }} onClick={onToggleComplete}>
            <CheckCircle2 size={15} /> {stop.completed ? 'Marked as complete' : 'Mark as complete'}
          </button>
        </div>

        {isActivity && dayCount > 1 && (
          <div className="atlas-drawer-section">
            <span className="atlas-drawer-label"><CalendarDays size={11} style={{ display: 'inline', marginRight: 4 }} />Move to another day</span>
            <select
              className="atlas-move-select"
              value={dayIndex}
              onChange={(e) => onMove(Number(e.target.value))}
            >
              {Array.from({ length: dayCount }).map((_, i) => (
                <option key={i} value={i}>Day {i + 1}</option>
              ))}
            </select>
          </div>
        )}

        {isActivity && alternatives?.length > 0 && (
          <div className="atlas-drawer-section">
            <span className="atlas-drawer-label"><ArrowRightLeft size={11} style={{ display: 'inline', marginRight: 4 }} />Replace with an alternative</span>
            {!showAlternatives ? (
              <button className="atlas-add-stop-btn" style={{ marginTop: 8 }} onClick={() => setShowAlternatives(true)}>Show {alternatives.length} alternative(s)</button>
            ) : (
              <div className="atlas-alt-list">
                {alternatives.map((alt) => (
                  <button key={alt.id} className="atlas-alt-option" onClick={() => onReplace(alt)}>
                    <b>{alt.name}</b>
                    <span>{alt.area} · ₹{alt.estimatedCost} · {alt.durationHours}h</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="atlas-drawer-actions">
          <button className="danger" onClick={onRemove}><Trash2 size={13} /> Remove stop</button>
        </div>
      </div>
    </>
  )
}
