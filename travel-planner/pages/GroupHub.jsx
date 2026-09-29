import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Send, Plus, UserPlus, Link2, Check, X, Sparkles } from 'lucide-react'
import { useExpenses } from '../context/ExpenseContext'
import { useAuth } from '../context/AuthContext'
import { api } from '../services/api'

const ROLE_BADGE = { owner: 'badge-danger', admin: 'badge-warn', member: 'badge-success' }

export default function GroupHub() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { expenseList } = useExpenses()

  const [groups, setGroups] = useState([])
  const [activeGroupId, setActiveGroupId] = useState(null)
  const [groupDetail, setGroupDetail] = useState(null)
  const [messages, setMessages] = useState([])
  const [text, setText] = useState('')
  const [invites, setInvites] = useState([])
  const [showCreate, setShowCreate] = useState(false)
  const [newGroupName, setNewGroupName] = useState('')
  const [inviteUsername, setInviteUsername] = useState('')
  const [inviteLink, setInviteLink] = useState(null)
  const [error, setError] = useState(null)
  const pollRef = useRef(null)

  const loadGroups = async () => {
    const { groups } = await api.listGroups()
    setGroups(groups)
    if (groups.length && !activeGroupId) setActiveGroupId(groups[0].id)
  }

  const loadInvites = async () => {
    try { const { invites } = await api.myInvites(); setInvites(invites) } catch { /* non-blocking */ }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps, react-hooks/set-state-in-effect -- initial data load, not a synchronous setState
  useEffect(() => { loadGroups(); loadInvites() }, [])

  useEffect(() => {
    if (!activeGroupId) return
    let cancelled = false
    const load = async () => {
      try {
        const [{ group }, { messages }] = await Promise.all([api.getGroup(activeGroupId), api.listMessages(activeGroupId)])
        if (!cancelled) { setGroupDetail(group); setMessages(messages) }
      } catch { /* group may have been deleted/left */ }
    }
    load()
    pollRef.current = setInterval(load, 4000) // simple polling — no websocket layer yet
    return () => { cancelled = true; clearInterval(pollRef.current) }
  }, [activeGroupId])

  const createGroup = async (e) => {
    e.preventDefault()
    if (!newGroupName.trim()) return
    try {
      const { group } = await api.createGroup({ name: newGroupName.trim() })
      setNewGroupName(''); setShowCreate(false)
      await loadGroups()
      setActiveGroupId(group.id)
    } catch (err) { setError(err.message) }
  }

  const sendMessage = async (e) => {
    e.preventDefault()
    if (!text.trim() || !activeGroupId) return
    const body = text.trim()
    setText('')
    try {
      await api.postMessage(activeGroupId, body)
      const { messages } = await api.listMessages(activeGroupId)
      setMessages(messages)
    } catch (err) { setError(err.message) }
  }

  const invite = async (e) => {
    e.preventDefault()
    if (!inviteUsername.trim()) return
    try {
      await api.inviteToGroup(activeGroupId, { username: inviteUsername.trim() })
      setInviteUsername('')
      const { group } = await api.getGroup(activeGroupId)
      setGroupDetail(group)
    } catch (err) { setError(err.message) }
  }

  const generateLink = async () => {
    try {
      const { invite } = await api.inviteToGroup(activeGroupId, { expiresInDays: 7, singleUse: false })
      setInviteLink(`${window.location.origin}/join/group/${invite.token}`)
    } catch (err) { setError(err.message) }
  }

  const removeMember = async (userId) => {
    try {
      await api.removeGroupMember(activeGroupId, userId)
      const { group } = await api.getGroup(activeGroupId)
      setGroupDetail(group)
    } catch (err) { setError(err.message) }
  }

  const acceptInvite = async (inviteId) => {
    await api.acceptInvite(inviteId)
    await Promise.all([loadGroups(), loadInvites()])
  }
  const declineInvite = async (inviteId) => {
    await api.declineInvite(inviteId)
    await loadInvites()
  }

  const sharedTotal = expenseList.reduce((s, e) => s + Number(e.amount), 0)
  const memberCount = groupDetail?.members?.length || 1
  const perPerson = Math.round(sharedTotal / memberCount)
  const canManage = groupDetail?.myRole === 'owner' || groupDetail?.myRole === 'admin'

  return (
    <div>
      <section>
        <p className="atlas-eyebrow">Travel together</p>
        <h1 className="atlas-page-title">Plan it together.</h1>
        <p className="atlas-page-copy">Decide, chat and share itineraries without leaving your trip workspace.</p>
      </section>

      {invites.length > 0 && invites.map((inv) => (
        <div className="atlas-invite-banner" key={inv.id}>
          <div><b>Invitation to "{inv.group?.name}"</b><small>You've been invited to join this group</small></div>
          <div className="atlas-invite-actions">
            <button className="accept" onClick={() => acceptInvite(inv.id)}><Check size={11} style={{ display: 'inline', marginRight: 3 }} />Accept</button>
            <button className="decline" onClick={() => declineInvite(inv.id)}><X size={11} style={{ display: 'inline', marginRight: 3 }} />Decline</button>
          </div>
        </div>
      ))}

      {error && <p className="atlas-error-text">{error}</p>}

      <div className="atlas-group-surface">
        <aside className="atlas-group-side">
          <span className="atlas-section-label">Your groups</span>
          <div className="atlas-group-list">
            {groups.map((g) => (
              <button key={g.id} className={`atlas-group-list-item ${g.id === activeGroupId ? 'is-active' : ''}`} onClick={() => setActiveGroupId(g.id)}>
                {g.name}<small>{g.memberCount} member{g.memberCount === 1 ? '' : 's'}</small>
              </button>
            ))}
          </div>

          {!showCreate ? (
            <button className="atlas-add-stop-btn" style={{ marginTop: 12, width: '100%', justifyContent: 'center' }} onClick={() => setShowCreate(true)}><Plus size={13} /> New group</button>
          ) : (
            <form onSubmit={createGroup} style={{ marginTop: 12, display: 'flex', gap: 6 }}>
              <input value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)} placeholder="Group name" style={{ flex: 1, minWidth: 0, border: '1px solid var(--border)', borderRadius: 10, padding: '8px 10px', fontSize: 11, background: 'var(--surface)', color: 'var(--text)' }} autoFocus />
              <button type="submit" className="btn-primary" style={{ padding: '8px 12px' }}>Add</button>
            </form>
          )}

          {groupDetail && (
            <>
              <div className="atlas-members" style={{ marginTop: 20 }}>
                {groupDetail.members.map((m) => (
                  <div className="atlas-member atlas-member-row" key={m.id}>
                    <span className="atlas-member-avatar">{m.username.slice(0, 2).toUpperCase()}</span>
                    <div className="atlas-member-info"><b>{m.username}</b><small className={ROLE_BADGE[m.role]} style={{ display: 'inline-block', marginTop: 3 }}>{m.role}</small></div>
                    {canManage && m.id !== user.id && m.role !== 'owner' && (
                      <button onClick={() => removeMember(m.id)} aria-label={`Remove ${m.username}`}><X size={13} /></button>
                    )}
                  </div>
                ))}
              </div>

              <div className="atlas-group-stat">
                <small>Shared spending</small>
                <strong>₹{sharedTotal.toLocaleString()}</strong>
                <small style={{ display: 'block', marginTop: 10 }}>Split {memberCount} ways · ₹{perPerson.toLocaleString()} / person</small>
              </div>

              {canManage && (
                <div className="atlas-manage-group">
                  <span className="atlas-section-label"><UserPlus size={11} style={{ display: 'inline', marginRight: 4 }} />Invite</span>
                  <form onSubmit={invite}>
                    <input value={inviteUsername} onChange={(e) => setInviteUsername(e.target.value)} placeholder="Username" />
                  </form>
                  <button className="link-btn" onClick={generateLink}><Link2 size={11} style={{ display: 'inline', marginRight: 4 }} />Generate invite link</button>
                  {inviteLink && (
                    <input readOnly value={inviteLink} onFocus={(e) => e.target.select()} style={{ marginTop: 8 }} />
                  )}
                </div>
              )}
            </>
          )}
        </aside>

        <section className="atlas-chat">
          {groupDetail ? (
            <>
              <header className="atlas-chat-head">
                <b>{groupDetail.name}</b>
                <small>{groupDetail.description || `${groupDetail.members.length} members`}</small>
              </header>
              <div className="atlas-chat-messages">
                {messages.map((m) => (
                  <div key={m.id} className={`atlas-message ${m.senderId === user.id ? 'mine' : ''}`}>
                    {m.senderId !== user.id && <b>{m.senderUsername}</b>}
                    {m.kind === 'itinerary_share' ? (
                      <div className="atlas-share-card">
                        <b><Sparkles size={11} style={{ display: 'inline', marginRight: 4 }} />AtlasAI Itinerary</b>
                        <div>{m.meta?.destination}</div>
                        <div className="meta">{m.meta?.days} days{m.meta?.estimatedCost ? ` · ₹${m.meta.estimatedCost.toLocaleString()} est.` : ''}</div>
                        {m.body && <p style={{ marginTop: 6 }}>{m.body}</p>}
                        <button onClick={() => navigate('/itinerary', { state: { tripId: m.meta?.tripId } })}>View itinerary</button>
                      </div>
                    ) : (
                      <p>{m.body}</p>
                    )}
                    <small>{new Date(m.createdAt.replace(' ', 'T') + 'Z').toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</small>
                  </div>
                ))}
                {messages.length === 0 && <p style={{ fontSize: 11, color: 'var(--muted)' }}>No messages yet — say hi!</p>}
              </div>
              <form className="atlas-chat-form" onSubmit={sendMessage}>
                <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Message the group..." />
                <button type="submit" aria-label="Send message"><Send size={16} /></button>
              </form>
            </>
          ) : (
            <div style={{ display: 'grid', placeItems: 'center', height: '100%', color: 'var(--muted)', fontSize: 12 }}>
              {groups.length === 0 ? 'Create a group to start planning together.' : 'Select a group'}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
