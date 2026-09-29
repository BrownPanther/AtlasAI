import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { MapPin, Clock3, ShieldAlert, Sparkles, AlertTriangle } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { api } from '../services/api'

export default function ShareTrip() {
  const { token } = useParams()
  const navigate = useNavigate()
  const { isAuthenticated, loading: authLoading } = useAuth()
  const [preview, setPreview] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (authLoading) return
    if (!isAuthenticated) { navigate('/login', { state: { from: `/share/trip/${token}` } }); return }
    api.previewShareToken(token)
      .then(({ preview }) => setPreview(preview))
      .catch((err) => setError(err.message))
  }, [token, isAuthenticated, authLoading, navigate])

  if (error) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <AlertTriangle className="mx-auto text-[var(--color-danger)]" />
        <h2 className="mt-4 text-lg font-bold">Can't open this link</h2>
        <p className="mt-2 text-sm atlas-muted">{error}</p>
      </div>
    )
  }

  if (!preview) {
    return <div className="mx-auto max-w-md py-16 text-center"><Sparkles className="mx-auto text-accent animate-spin" /></div>
  }

  return (
    <div className="mx-auto max-w-md py-14">
      {preview.emergencyActive && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', color: '#fff', background: 'var(--color-danger)', borderRadius: 14, padding: '12px 16px', marginBottom: 16, fontSize: 12, fontWeight: 700 }}>
          <ShieldAlert size={16} /> This trip has an active emergency alert
        </div>
      )}
      <div className="atlas-form-surface">
        <p className="atlas-eyebrow"><MapPin size={13} style={{ display: 'inline', marginRight: 5 }} />Live trip location</p>
        <h2 style={{ fontSize: 22, marginTop: 4 }}>{preview.destination}</h2>
        <p style={{ marginTop: 4, fontSize: 12, color: 'var(--muted)' }}>{preview.tripTitle}</p>

        <div style={{ marginTop: 20, display: 'grid', gap: 10, fontSize: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Last known location</span><b>{preview.lastLocation.latitude.toFixed(4)}, {preview.lastLocation.longitude.toFixed(4)}</b></div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span><Clock3 size={11} style={{ display: 'inline', marginRight: 4 }} />Last updated</span><b>{new Date(preview.lastUpdatedAt.replace(' ', 'T') + 'Z').toLocaleString()}</b></div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Trip progress</span><b>{preview.progress}%</b></div>
        </div>

        <p style={{ marginTop: 20, fontSize: 10, color: 'var(--subtle)' }}>This link was shared by a trip member and can be revoked or expire at any time.</p>
      </div>
    </div>
  )
}
