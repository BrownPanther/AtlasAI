import { useEffect, useState } from 'react'
import { MapPin, ShieldAlert, Copy, Check, Phone, AlertTriangle, X } from 'lucide-react'
import { api } from '../../services/api'

const DURATIONS = [
  { label: '1 hour', hours: 1 },
  { label: '4 hours', hours: 4 },
  { label: '12 hours', hours: 12 },
  { label: '24 hours', hours: 24 },
]

function getBrowserLocation() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null)
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
      () => resolve(null),
      { timeout: 5000 }
    )
  })
}

export default function SafetyPanel({ tripId }) {
  const [locationState, setLocationState] = useState(null)
  const [alertState, setAlertState] = useState(null)
  const [duration, setDuration] = useState(4)
  const [copied, setCopied] = useState(false)
  const [confirmingAlert, setConfirmingAlert] = useState(false)
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const load = async () => {
    try {
      const [loc, alert] = await Promise.all([api.getLocationState(tripId), api.getEmergencyState(tripId)])
      setLocationState(loc)
      setAlertState(alert)
    } catch (err) {
      setError(err.message)
    }
  }
  useEffect(() => { load() }, [tripId]) // eslint-disable-line react-hooks/exhaustive-deps

  const toggleSharing = async (enable) => {
    setBusy(true)
    setError(null)
    try {
      const coords = (await getBrowserLocation()) || { latitude: 0, longitude: 0 }
      await api.postLocation(tripId, { ...coords, enableSharing: enable, durationHours: duration })
      await load()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const copyLink = () => {
    const full = `${window.location.origin}${locationState.shareLink}`
    navigator.clipboard.writeText(full).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) })
  }

  const sendAlert = async () => {
    setBusy(true)
    setError(null)
    try {
      const coords = await getBrowserLocation()
      await api.raiseEmergency(tripId, { ...(coords || {}), notes: notes.trim() || undefined })
      setConfirmingAlert(false)
      setNotes('')
      await load()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const resolve = async () => {
    setBusy(true)
    try {
      await api.resolveEmergency(tripId, alertState.active.id)
      await load()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  if (!locationState || !alertState) return null

  return (
    <div style={{ marginTop: 20, display: 'grid', gap: 16 }}>
      {error && <p className="atlas-error-text">{error}</p>}

      {alertState.active && (
        <div className="atlas-surface" style={{ padding: 20, borderColor: 'rgba(239,68,68,.4)', background: 'rgba(239,68,68,.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--color-danger)' }}>
            <ShieldAlert size={18} /><b style={{ fontSize: 13 }}>Emergency alert active</b>
          </div>
          <p style={{ marginTop: 6, fontSize: 12, color: 'var(--muted)' }}>{alertState.active.notes || 'No additional details provided.'}</p>
          <p style={{ marginTop: 4, fontSize: 10, color: 'var(--subtle)' }}>Raised {new Date(alertState.active.createdAt.replace(' ', 'T') + 'Z').toLocaleString()}</p>
          <button onClick={resolve} disabled={busy} className="btn-primary" style={{ marginTop: 12 }}>Mark resolved</button>
        </div>
      )}

      <div className="atlas-surface" style={{ padding: 20 }}>
        <p className="atlas-eyebrow"><MapPin size={13} style={{ display: 'inline', marginRight: 5 }} />Trip location sharing</p>
        <p style={{ marginTop: 6, fontSize: 12, color: 'var(--muted)' }}>Share your live location with anyone who has the link, for a limited time. Opt-in only — off by default.</p>

        {locationState.sharingActive ? (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 14 }}>
              <span className="badge-success">Sharing active</span>
              <small style={{ color: 'var(--subtle)', fontSize: 10 }}>until {new Date(locationState.shareExpiresAt.replace(' ', 'T')).toLocaleString()}</small>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <button className="atlas-ghost-button" onClick={copyLink}>{copied ? <Check size={13} /> : <Copy size={13} />} {copied ? 'Copied' : 'Copy share link'}</button>
              <button className="atlas-ghost-button" onClick={() => toggleSharing(false)} disabled={busy}><X size={13} /> Stop sharing</button>
            </div>
          </>
        ) : (
          <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap', alignItems: 'center' }}>
            <select value={duration} onChange={(e) => setDuration(Number(e.target.value))} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: '8px 10px', fontSize: 11, background: 'var(--surface)', color: 'var(--text)' }}>
              {DURATIONS.map((d) => <option key={d.hours} value={d.hours}>{d.label}</option>)}
            </select>
            <button className="btn-primary" onClick={() => toggleSharing(true)} disabled={busy}>{busy ? 'Starting…' : 'Start sharing'}</button>
          </div>
        )}
      </div>

      <div className="atlas-surface" style={{ padding: 20 }}>
        <p className="atlas-eyebrow" style={{ color: 'var(--color-danger)' }}><ShieldAlert size={13} style={{ display: 'inline', marginRight: 5 }} />Emergency</p>
        <p style={{ marginTop: 6, fontSize: 12, color: 'var(--muted)' }}>This alerts everyone with access to this trip and AtlasAI support. It does not contact police or ambulance directly.</p>

        {!alertState.active && (
          <button onClick={() => setConfirmingAlert(true)} style={{ marginTop: 14, background: 'var(--color-danger)', color: '#fff', border: 0, borderRadius: 12, padding: '11px 18px', fontSize: 12, fontWeight: 800 }}>
            Send Emergency Alert
          </button>
        )}

        <div style={{ marginTop: 16, display: 'grid', gap: 6 }}>
          {alertState.emergencyContacts.map((c) => (
            <a key={c.number} href={`tel:${c.number}`} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: 'var(--text)' }}>
              <Phone size={12} /> {c.label}: <b>{c.number}</b>
            </a>
          ))}
        </div>
      </div>

      {confirmingAlert && (
        <div className="atlas-modal-backdrop" onClick={() => setConfirmingAlert(false)}>
          <div className="atlas-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', color: 'var(--color-danger)' }}><AlertTriangle size={18} /><h4>Send emergency alert?</h4></div>
            <p style={{ marginTop: 10, fontSize: 12, color: 'var(--muted)' }}>This will alert your trip's members and AtlasAI support, and share your current location if permission is granted. It will not automatically contact police or ambulance.</p>
            <div className="atlas-field" style={{ marginTop: 14 }}><label>Details (optional)</label><input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="What's happening?" /></div>
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button onClick={() => setConfirmingAlert(false)} className="atlas-ghost-button" style={{ flex: 1 }}>Cancel</button>
              <button onClick={sendAlert} disabled={busy} style={{ flex: 1, background: 'var(--color-danger)', color: '#fff', border: 0, borderRadius: 12, fontSize: 12, fontWeight: 800 }}>{busy ? 'Sending…' : 'Send Emergency Alert'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
