import { useEffect, useState } from 'react'
import { MessageSquareText, Send } from 'lucide-react'
import { TextField, SelectField } from '../components/FormField'
import { api } from '../services/api'

const CATEGORIES = ['General', 'Bug', 'Feature request', 'AI planning', 'Bookings', 'Other']

export default function Feedback() {
  const [category, setCategory] = useState('General')
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState(null)
  const [history, setHistory] = useState([])

  const load = () => api.myFeedback().then(({ feedback }) => setHistory(feedback)).catch(() => {})
  useEffect(() => { load() }, [])

  const submit = async (e) => {
    e.preventDefault()
    if (!message.trim()) return
    setSending(true)
    setError(null)
    try {
      await api.submitFeedback({ category, message })
      setMessage('')
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
        <p className="atlas-eyebrow">We're listening</p>
        <h1 className="atlas-page-title">Share your feedback.</h1>
        <p className="atlas-page-copy">Bugs, ideas, or anything that felt off — it goes straight to the team.</p>
      </section>

      <div className="atlas-form-surface">
        <div className="atlas-form-heading">
          <span className="step-icon"><MessageSquareText size={17} /></span>
          <div><strong>New feedback</strong><small>A sentence or two is plenty.</small></div>
        </div>
        <form onSubmit={submit} className="atlas-field-grid" style={{ gridTemplateColumns: '1fr', marginTop: 14 }}>
          <SelectField label="Category" value={category} onChange={setCategory} options={CATEGORIES} />
          <TextField label="Message" value={message} onChange={setMessage} placeholder="What's on your mind?" />
          {error && <p className="atlas-error-text">{error}</p>}
          <button type="submit" className="btn-primary atlas-plan-submit" disabled={sending}>{sending ? 'Sending…' : <><Send size={14} /> Submit feedback</>}</button>
        </form>
      </div>

      {history.length > 0 && (
        <div className="atlas-list-surface" style={{ marginTop: 20 }}>
          {history.map((f) => (
            <div key={f.id} className="atlas-list-row">
              <div className="atlas-list-main"><b>{f.category || 'General'}</b><small>{f.message}</small></div>
              <small style={{ color: 'var(--subtle)' }}>{new Date(f.createdAt.replace(' ', 'T') + 'Z').toLocaleDateString()}</small>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
