import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Mail, MapPin, Settings, LogOut, MessageSquareText, LifeBuoy, Check, ShieldCheck } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { TextField, SelectField } from '../components/FormField'
import { api } from '../services/api'

export default function Profile() {
  const { user, logout, refreshUser } = useAuth()
  const navigate = useNavigate()
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({
    homeLocation: user?.homeLocation || '',
    comfortPref: user?.comfortPref || 'Standard',
    travelModePref: user?.travelModePref || 'Train',
    interests: user?.interests || '',
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  if (!user) return null

  const save = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const { user: updated } = await api.updateProfile(form)
      refreshUser(updated)
      setEditing(false)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <section>
        <p className="atlas-eyebrow">Account</p>
        <h1 className="atlas-page-title">Your travel identity.</h1>
        <p className="atlas-page-copy">The preferences AtlasAI uses to shape recommendations.</p>
      </section>

      <div className="atlas-profile-surface">
        <div className="atlas-profile-top">
          <div className="atlas-profile-big">{user.username[0].toUpperCase()}</div>
          <div>
            <h2 className="text-xl font-bold tracking-tight">{user.username}</h2>
            <p className="mt-1 flex items-center gap-1.5 text-xs atlas-muted"><Mail size={12} /> {user.email}</p>
            <p className="mt-1 text-xs atlas-muted">@{user.username} · {user.role === 'admin' ? 'Admin' : 'Traveler'}</p>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-between">
          <div className="flex items-center gap-2 text-[var(--accent)]"><Settings size={15} /><span className="text-xs font-bold">Travel preferences</span></div>
          {!editing && <button onClick={() => setEditing(true)} className="text-xs font-bold text-[var(--accent)]">Edit</button>}
        </div>

        {!editing ? (
          <div className="atlas-preferences">
            <div className="atlas-preference"><small>Comfort</small><strong>{user.comfortPref || 'Standard'}</strong></div>
            <div className="atlas-preference"><small>Preferred mode</small><strong>{user.travelModePref || 'Not set'}</strong></div>
            <div className="atlas-preference"><small>Interests</small><strong>{user.interests || 'Not set'}</strong></div>
          </div>
        ) : (
          <form onSubmit={save} className="atlas-field-grid three" style={{ marginTop: 14 }}>
            <SelectField label="Comfort" value={form.comfortPref} onChange={(v) => setForm((f) => ({ ...f, comfortPref: v }))} options={['Budget', 'Standard', 'Premium']} />
            <SelectField label="Travel mode" value={form.travelModePref} onChange={(v) => setForm((f) => ({ ...f, travelModePref: v }))} options={['Flight', 'Train', 'Bus']} />
            <TextField label="Interests" value={form.interests} onChange={(v) => setForm((f) => ({ ...f, interests: v }))} placeholder="Nature, Food, Adventure" />
            <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 8 }}>
              <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
              <button type="button" onClick={() => setEditing(false)} className="atlas-ghost-button">Cancel</button>
            </div>
          </form>
        )}

        {saved && <p style={{ marginTop: 10, fontSize: 11, color: 'var(--color-success)', display: 'flex', alignItems: 'center', gap: 5 }}><Check size={12} /> Preferences saved</p>}

        <div className="mt-7 border-t border-[var(--border)] pt-6">
          <div className="flex items-center gap-2 text-xs font-semibold"><MapPin size={15} className="text-[var(--accent)]" /> Saved home location</div>
          {!editing ? (
            <p className="mt-2 text-xs atlas-muted">{user.homeLocation || 'Not set'}</p>
          ) : (
            <div style={{ marginTop: 8, maxWidth: 240 }}>
              <TextField label="" value={form.homeLocation} onChange={(v) => setForm((f) => ({ ...f, homeLocation: v }))} placeholder="e.g. New Delhi" />
            </div>
          )}
        </div>

        <div className="mt-7 border-t border-[var(--border)] pt-6" style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button onClick={() => navigate('/feedback')} className="atlas-ghost-button"><MessageSquareText size={14} /> Send feedback</button>
          <button onClick={() => navigate('/support')} className="atlas-ghost-button"><LifeBuoy size={14} /> Contact support</button>
          {user.role === 'admin' && <button onClick={() => navigate('/admin')} className="atlas-ghost-button"><ShieldCheck size={14} /> Admin dashboard</button>}
        </div>

        <button onClick={async () => { await logout(); navigate('/') }} className="mt-5 inline-flex items-center gap-2 border-0 bg-transparent text-xs font-semibold text-red-500"><LogOut size={14} /> Log out</button>
      </div>
    </div>
  )
}
