import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Users, Sparkles, AlertTriangle } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { api } from '../services/api'

export default function JoinGroup() {
  const { token } = useParams()
  const navigate = useNavigate()
  const { isAuthenticated, loading: authLoading } = useAuth()
  const [preview, setPreview] = useState(null)
  const [error, setError] = useState(null)
  const [joining, setJoining] = useState(false)

  useEffect(() => {
    if (authLoading) return
    if (!isAuthenticated) { navigate('/login', { state: { from: `/join/group/${token}` } }); return }
    api.previewInvite(token)
      .then(({ preview }) => setPreview(preview))
      .catch((err) => setError(err.message))
  }, [token, isAuthenticated, authLoading, navigate])

  const join = async () => {
    setJoining(true)
    try {
      const { group } = await api.acceptInvite(preview.inviteId)
      navigate('/group', { state: { groupId: group.id } })
    } catch (err) {
      setError(err.message)
      setJoining(false)
    }
  }

  if (error) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <AlertTriangle className="mx-auto text-[var(--color-danger)]" />
        <h2 className="mt-4 text-lg font-bold">Can't open this invite</h2>
        <p className="mt-2 text-sm atlas-muted">{error}</p>
        <button className="btn-primary mt-5" onClick={() => navigate('/group')}>Go to Group Hub</button>
      </div>
    )
  }

  if (!preview) {
    return <div className="mx-auto max-w-md py-16 text-center"><Sparkles className="mx-auto text-accent animate-spin" /></div>
  }

  return (
    <div className="mx-auto max-w-md py-16">
      <div className="atlas-form-surface" style={{ textAlign: 'center' }}>
        <div className="step-icon" style={{ margin: '0 auto' }}><Users size={18} /></div>
        <p className="atlas-eyebrow" style={{ marginTop: 14 }}>Group invite</p>
        <h2 style={{ fontSize: 22, marginTop: 4 }}>Join "{preview.groupName}"?</h2>
        {preview.groupDescription && <p className="atlas-page-copy" style={{ marginTop: 8 }}>{preview.groupDescription}</p>}
        <p style={{ marginTop: 10, fontSize: 12, color: 'var(--muted)' }}>Invited by <b>{preview.invitedBy}</b> · {preview.memberCount} member{preview.memberCount === 1 ? '' : 's'}</p>

        {preview.alreadyMember ? (
          <>
            <p style={{ marginTop: 16, fontSize: 12, color: 'var(--muted)' }}>You're already a member of this group.</p>
            <button className="btn-primary mt-5" onClick={() => navigate('/group')}>Go to Group Hub</button>
          </>
        ) : (
          <button className="btn-primary atlas-plan-submit" style={{ marginTop: 20 }} onClick={join} disabled={joining}>
            {joining ? 'Joining…' : 'Join Group'}
          </button>
        )}
      </div>
    </div>
  )
}
