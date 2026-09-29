import { useEffect, useState } from 'react'
import { LifeBuoy, Send } from 'lucide-react'
import { TextField } from '../components/FormField'
import { api } from '../services/api'

const STATUS_STYLE = { open: 'badge-warn', in_progress: 'badge-warn', resolved: 'badge-success' }
const STATUS_LABEL = { open: 'Open', in_progress: 'In progress', resolved: 'Resolved' }

export default function Support() {
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState(null)
  const [tickets, setTickets] = useState([])

  const load = () => api.mySupportTickets().then(({ tickets }) => setTickets(tickets)).catch(() => {})
  useEffect(() => { load() }, [])

  const submit = async (e) => {
    e.preventDefault()
    if (!subject.trim() || !message.trim()) return
    setSending(true)
    setError(null)
    try {
      await api.submitSupportTicket({ subject, message })
      setSubject(''); setMessage('')
      await load()
    } catch (err) {
      setError(err.message)
    } finally {
      setSending(false)
    }
  }

  return (
    <div>
      <section>
        <p className="atlas-eyebrow">Need a hand?</p>
        <h1 className="atlas-page-title">Contact support.</h1>
        <p className="atlas-page-copy">Trouble with a booking, your account, or the app — tell us what's going on.</p>
      </section>

      <div className="atlas-form-surface">
        <div className="atlas-form-heading">
          <span className="step-icon"><LifeBuoy size={17} /></span>
          <div><strong>New support ticket</strong><small>We'll get back to you as soon as we can.</small></div>
        </div>
        <form onSubmit={submit} className="atlas-field-grid" style={{ gridTemplateColumns: '1fr', marginTop: 14 }}>
          <TextField label="Subject" value={subject} onChange={setSubject} placeholder="e.g. Refund for a cancelled booking" />
          <TextField label="Message" value={message} onChange={setMessage} placeholder="Describe the issue" />
          {error && <p className="atlas-error-text">{error}</p>}
          <button type="submit" className="btn-primary atlas-plan-submit" disabled={sending}>{sending ? 'Sending…' : <><Send size={14} /> Submit ticket</>}</button>
        </form>
      </div>

      {tickets.length > 0 && (
        <div className="atlas-list-surface" style={{ marginTop: 20 }}>
          {tickets.map((t) => (
            <div key={t.id} className="atlas-list-row">
              <div className="atlas-list-main"><b>{t.subject}</b><small>{t.message}</small></div>
              <span className={STATUS_STYLE[t.status]}>{STATUS_LABEL[t.status]}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
