import { useEffect, useState } from 'react'
import { Send } from 'lucide-react'
import { api } from '../../services/api'

export default function ShareToGroupModal({ tripId, destination, onClose, onShared }) {
  const [groups, setGroups] = useState(null)
  const [groupId, setGroupId] = useState(null)
  const [message, setMessage] = useState(`Here's the itinerary AtlasAI generated for us.`)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    api.listGroups().then(({ groups }) => { setGroups(groups); if (groups.length) setGroupId(groups[0].id) }).catch((err) => setError(err.message))
  }, [])

  const share = async (e) => {
    e.preventDefault()
    if (!groupId) return
    setSending(true)
    setError(null)
    try {
      await api.shareItinerary(groupId, { tripId, message })
      onShared()
    } catch (err) {
      setError(err.message)
      setSending(false)
    }
  }

  return (
    <div className="atlas-modal-backdrop" onClick={onClose}>
      <div className="atlas-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <h4>Share to group</h4>
        <p style={{ marginTop: 6, fontSize: 11, color: 'var(--muted)' }}>Send this {destination} itinerary to one of your groups.</p>

        {groups === null ? (
          <p style={{ marginTop: 16, fontSize: 11, color: 'var(--muted)' }}>Loading your groups…</p>
        ) : groups.length === 0 ? (
          <div style={{ marginTop: 16, fontSize: 11, color: 'var(--muted)' }}>
            You're not in any groups yet. Create one from Group Hub, then come back here to share.
          </div>
        ) : (
          <form onSubmit={share} className="atlas-field-grid" style={{ gridTemplateColumns: '1fr', marginTop: 16 }}>
            <div className="atlas-field">
              <label>Select group</label>
              <select value={groupId || ''} onChange={(e) => setGroupId(e.target.value)}>
                {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </div>
            <div className="atlas-field">
              <label>Message</label>
              <input value={message} onChange={(e) => setMessage(e.target.value)} />
            </div>
            {error && <p className="atlas-error-text">{error}</p>}
            <button type="submit" className="btn-primary atlas-plan-submit" disabled={sending}>
              {sending ? 'Sharing…' : <><Send size={14} /> Share</>}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
