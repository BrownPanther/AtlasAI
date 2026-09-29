import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Users, Layers, Map, Ticket, MessageSquareText, LifeBuoy, ShieldAlert, Cpu, Compass } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { api } from '../services/api'

const TABS = [
  { key: 'overview', label: 'Overview', icon: Compass },
  { key: 'users', label: 'Users', icon: Users },
  { key: 'groups', label: 'Groups', icon: Layers },
  { key: 'trips', label: 'Trips', icon: Map },
  { key: 'bookings', label: 'Bookings', icon: Ticket },
  { key: 'feedback', label: 'Feedback', icon: MessageSquareText },
  { key: 'support', label: 'Support', icon: LifeBuoy },
  { key: 'emergencies', label: 'Emergencies', icon: ShieldAlert },
  { key: 'agentRuns', label: 'Agent Runs', icon: Cpu },
]

const TICKET_STATUSES = ['open', 'in_progress', 'resolved']
const fmt = (n) => (n == null ? '—' : n.toLocaleString())
const when = (s) => (s ? new Date(s.replace(' ', 'T') + 'Z').toLocaleString() : '—')

function StatsTab({ stats }) {
  if (!stats) return null
  const cards = [
    { label: 'Total users', value: fmt(stats.totalUsers) },
    { label: 'Active trips', value: fmt(stats.activeTrips), sub: `${fmt(stats.totalTrips)} total` },
    { label: 'Groups', value: fmt(stats.totalGroups) },
    { label: 'Bookings', value: fmt(stats.totalBookings) },
    { label: 'Avg. service rating', value: stats.averageServiceRating ?? '—', sub: `${fmt(stats.totalReviews)} reviews` },
    { label: 'Support tickets', value: fmt(stats.supportTicketCount) },
    { label: 'Emergency alerts', value: fmt(stats.emergencyAlertCount), sub: `${fmt(stats.activeEmergencyCount)} active now` },
  ]
  return (
    <>
      <div className="atlas-overview-grid">
        {cards.map((c) => (
          <div className="atlas-overview-card" key={c.label}>
            <span>{c.label}</span>
            <strong>{c.value}</strong>
            {c.sub && <small>{c.sub}</small>}
          </div>
        ))}
      </div>
      <div className="atlas-list-surface" style={{ marginTop: 20 }}>
        <div className="atlas-list-row" style={{ borderBottom: '1px solid var(--border)' }}><b style={{ fontSize: 11 }}>Popular destinations</b></div>
        {stats.popularDestinations.map((d) => (
          <div className="atlas-list-row" key={d.destination}><div className="atlas-list-main"><b>{d.destination}</b></div><span className="badge-success">{d.count} trip{d.count === 1 ? '' : 's'}</span></div>
        ))}
        {stats.popularDestinations.length === 0 && <div className="atlas-list-row"><small style={{ color: 'var(--muted)' }}>No trips yet</small></div>}
      </div>
    </>
  )
}

export default function Admin() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [active, setActive] = useState('overview')
  const [stats, setStats] = useState(null)
  const [rows, setRows] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (user && user.role !== 'admin') navigate('/')
  }, [user, navigate])

  useEffect(() => {
    let cancelled = false
    setRows(null)
    setError(null)
    const loaders = {
      overview: () => api.adminStats().then((d) => setStats(d.stats)),
      users: () => api.adminUsers().then((d) => setRows(d.users)),
      groups: () => api.adminGroups().then((d) => setRows(d.groups)),
      trips: () => api.adminTrips().then((d) => setRows(d.trips)),
      bookings: () => api.adminBookings().then((d) => setRows(d.bookings)),
      feedback: () => api.adminFeedback().then((d) => setRows(d.feedback)),
      support: () => api.adminSupport().then((d) => setRows(d.tickets)),
      emergencies: () => api.adminEmergencies().then((d) => setRows(d.emergencies)),
      agentRuns: () => api.adminAgentRuns().then((d) => setRows(d.runs)),
    }
    loaders[active]().catch((err) => { if (!cancelled) setError(err.message) })
    return () => { cancelled = true }
  }, [active])

  const resolveTicket = async (id, status) => {
    try {
      await api.adminUpdateSupportTicket(id, status)
      const { tickets } = await api.adminSupport()
      setRows(tickets)
    } catch (err) { setError(err.message) }
  }

  if (!user || user.role !== 'admin') return null

  return (
    <div>
      <section>
        <p className="atlas-eyebrow">Admin</p>
        <h1 className="atlas-page-title">Platform overview.</h1>
        <p className="atlas-page-copy">Real data straight from the database — nothing here is a mock.</p>
      </section>

      <div className="atlas-tabbar" style={{ flexWrap: 'wrap', width: 'auto' }}>
        {TABS.map((t) => (
          <button key={t.key} className={`atlas-tab ${active === t.key ? 'is-active' : ''}`} onClick={() => setActive(t.key)}>
            <t.icon size={12} style={{ display: 'inline', marginRight: 5 }} />{t.label}
          </button>
        ))}
      </div>

      {error && <p className="atlas-error-text">{error}</p>}

      {active !== 'overview' && rows === null && !error && (
        <div className="atlas-list-surface" style={{ marginTop: 20 }}>
          <div className="atlas-list-row"><small className="atlas-muted">Loading…</small></div>
        </div>
      )}

      {active === 'overview' && <div style={{ marginTop: 20 }}>{!stats && !error ? <p className="atlas-muted" style={{ fontSize: 12 }}>Loading…</p> : <StatsTab stats={stats} />}</div>}

      {active === 'users' && rows && (
        <div className="atlas-list-surface" style={{ marginTop: 20 }}>
          {rows.map((u) => (
            <div className="atlas-list-row" key={u.id}>
              <div className="atlas-list-main"><b>{u.username}</b><small>{u.email}</small></div>
              <span className={u.role === 'admin' ? 'badge-danger' : 'badge-success'}>{u.role}</span>
              <small style={{ color: 'var(--subtle)' }}>{when(u.createdAt)}</small>
            </div>
          ))}
          {rows.length === 0 && <div className="atlas-list-row"><small>No users yet</small></div>}
        </div>
      )}

      {active === 'groups' && rows && (
        <div className="atlas-list-surface" style={{ marginTop: 20 }}>
          {rows.map((g) => (
            <div className="atlas-list-row" key={g.id}>
              <div className="atlas-list-main"><b>{g.name}</b><small>{g.description || 'No description'}</small></div>
              <span className="badge-success">{g.memberCount} member{g.memberCount === 1 ? '' : 's'}</span>
            </div>
          ))}
          {rows.length === 0 && <div className="atlas-list-row"><small>No groups yet</small></div>}
        </div>
      )}

      {active === 'trips' && rows && (
        <div className="atlas-list-surface" style={{ marginTop: 20 }}>
          {rows.map((t) => (
            <div className="atlas-list-row" key={t.id}>
              <div className="atlas-list-main"><b>{t.destination}</b><small>{t.title}</small></div>
              <span className="badge-success">{t.status}</span>
              <small style={{ color: 'var(--subtle)' }}>{when(t.createdAt)}</small>
            </div>
          ))}
          {rows.length === 0 && <div className="atlas-list-row"><small>No trips yet</small></div>}
        </div>
      )}

      {active === 'bookings' && rows && (
        <div className="atlas-list-surface" style={{ marginTop: 20 }}>
          {rows.map((b) => (
            <div className="atlas-list-row" key={b.id}>
              <div className="atlas-list-main"><b>{b.name}</b><small>{b.username} · {b.type}</small></div>
              <span className="badge-success">{b.status}</span>
              <span className="atlas-price">₹{b.price.toLocaleString()}</span>
            </div>
          ))}
          {rows.length === 0 && <div className="atlas-list-row"><small>No bookings yet</small></div>}
        </div>
      )}

      {active === 'feedback' && rows && (
        <div className="atlas-list-surface" style={{ marginTop: 20 }}>
          {rows.map((f) => (
            <div className="atlas-list-row" key={f.id}>
              <div className="atlas-list-main"><b>{f.category || 'General'}</b><small>{f.message}</small></div>
              <small style={{ color: 'var(--subtle)' }}>{when(f.createdAt)}</small>
            </div>
          ))}
          {rows.length === 0 && <div className="atlas-list-row"><small>No feedback yet</small></div>}
        </div>
      )}

      {active === 'support' && rows && (
        <div className="atlas-list-surface" style={{ marginTop: 20 }}>
          {rows.map((t) => (
            <div className="atlas-list-row" key={t.id}>
              <div className="atlas-list-main"><b>{t.subject}</b><small>{t.message}</small></div>
              <select value={t.status} onChange={(e) => resolveTicket(t.id, e.target.value)} style={{ border: '1px solid var(--border)', borderRadius: 9, padding: '6px 8px', fontSize: 10, background: 'var(--surface)', color: 'var(--text)' }}>
                {TICKET_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          ))}
          {rows.length === 0 && <div className="atlas-list-row"><small>No support tickets yet</small></div>}
        </div>
      )}

      {active === 'emergencies' && rows && (
        <div className="atlas-list-surface" style={{ marginTop: 20 }}>
          {rows.map((e) => (
            <div className="atlas-list-row" key={e.id}>
              <div className="atlas-list-main"><b>{e.notes || 'No details provided'}</b><small>Trip {e.tripId}</small></div>
              <span className={e.status === 'active' ? 'badge-danger' : 'badge-success'}>{e.status}</span>
              <small style={{ color: 'var(--subtle)' }}>{when(e.createdAt)}</small>
            </div>
          ))}
          {rows.length === 0 && <div className="atlas-list-row"><small>No emergency alerts</small></div>}
        </div>
      )}

      {active === 'agentRuns' && rows && (
        <div className="atlas-list-surface" style={{ marginTop: 20 }}>
          {rows.map((r) => (
            <div className="atlas-list-row" key={r.id}>
              <div className="atlas-list-main"><b>{r.request?.destination || 'Unknown destination'}</b><small>{r.trace?.length || 0} trace events</small></div>
              <span className={r.status === 'completed' ? 'badge-success' : r.status === 'failed' ? 'badge-danger' : 'badge-warn'}>{r.status}</span>
              <small style={{ color: 'var(--subtle)' }}>{when(r.startedAt)}</small>
            </div>
          ))}
          {rows.length === 0 && <div className="atlas-list-row"><small>No agent runs yet</small></div>}
        </div>
      )}
    </div>
  )
}
