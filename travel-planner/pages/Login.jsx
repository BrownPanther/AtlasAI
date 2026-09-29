import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Sparkles, ArrowRight, AlertTriangle } from 'lucide-react'
import { TextField } from '../components/FormField'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const { login, register } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const redirectTo = location.state?.from || '/'

  const [mode, setMode] = useState('login') // 'login' | 'register'
  const [form, setForm] = useState({ username: '', email: '', password: '' })
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      if (mode === 'login') await login(form.email, form.password)
      else await register(form.username, form.email, form.password)
      navigate(redirectTo, { replace: true })
    } catch (err) {
      setError(err.message || 'Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-md py-14">
      <div className="atlas-form-surface">
        <div className="atlas-form-heading">
          <span className="step-icon"><Sparkles size={17} /></span>
          <div><strong>{mode === 'login' ? 'Welcome back' : 'Create your account'}</strong><small>{mode === 'login' ? 'Sign in to plan and manage your trips.' : 'Join AtlasAI to start planning.'}</small></div>
        </div>

        {error && (
          <div className="atlas-error-text">
            <AlertTriangle size={14} /> {error}
          </div>
        )}

        <form onSubmit={submit} className="atlas-field-grid" style={{ gridTemplateColumns: '1fr', gap: 14 }}>
          {mode === 'register' && (
            <TextField label="Username" value={form.username} onChange={(v) => setForm((f) => ({ ...f, username: v }))} />
          )}
          <TextField label="Email" type="email" value={form.email} onChange={(v) => setForm((f) => ({ ...f, email: v }))} />
          <TextField label="Password" type="password" value={form.password} onChange={(v) => setForm((f) => ({ ...f, password: v }))} />

          <button type="submit" className="btn-primary atlas-plan-submit" disabled={submitting}>
            {submitting ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'} <ArrowRight size={15} />
          </button>
        </form>

        <button
          onClick={() => setMode((m) => (m === 'login' ? 'register' : 'login'))}
          style={{ marginTop: 16, border: 0, background: 'transparent', color: 'var(--subtle)', fontSize: 11, cursor: 'pointer' }}
        >
          {mode === 'login' ? "Don't have an account? Create one" : 'Already have an account? Sign in'}
        </button>
      </div>
    </div>
  )
}
