import { useState } from 'react'
import { api } from '../hooks/useApi'

export default function Login({ onAuth }) {
  const [mode, setMode] = useState('login')
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const endpoint = mode === 'login' ? '/api/auth/login' : '/api/auth/register'
      const payload = mode === 'login'
        ? { email: form.email, password: form.password }
        : { name: form.name, email: form.email, password: form.password }
      const res = await api.post(endpoint, payload)
      const { token, user } = res.data.data
      localStorage.setItem('atlas_token', token)
      localStorage.setItem('atlas_user', JSON.stringify(user))
      onAuth(user)
    } catch (err) {
      setError(err.response?.data?.error || err.message)
    }
    setLoading(false)
  }

  const inputStyle = {
    width: '100%', padding: '0.6rem 0.75rem', borderRadius: 2,
    border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text-primary)',
    fontSize: 'var(--text-base)', outline: 'none', transition: 'border-color 0.1s',
  }

  return (
    <div style={{
      minHeight: '100vh', background: 'var(--color-bg)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{ width: '100%', maxWidth: 380, padding: '2rem' }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <h1 style={{
            fontFamily: 'var(--font-serif)', fontSize: 56,
            color: 'var(--color-gold)', fontWeight: 400, marginBottom: '0.15rem',
          }}>
            Atlas
          </h1>
          <p style={{
            color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)',
            textTransform: 'uppercase', letterSpacing: '0.15em',
          }}>
            Finance Terminal
          </p>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', marginBottom: '1.5rem', border: '1px solid var(--color-border)' }}>
          {['login', 'signup'].map(m => (
            <button key={m} onClick={() => { setMode(m); setError('') }} style={{
              flex: 1, padding: '0.55rem', border: 'none', cursor: 'pointer',
              background: mode === m ? 'var(--color-navy)' : 'var(--color-surface)',
              color: mode === m ? 'var(--color-gold)' : 'var(--color-text-muted)',
              fontSize: 'var(--text-sm)', fontWeight: 600, textTransform: 'uppercase',
              letterSpacing: '0.06em', transition: 'all 0.1s',
            }}>
              {m === 'login' ? 'Log In' : 'Sign Up'}
            </button>
          ))}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          {mode === 'signup' && (
            <div style={{ marginBottom: 'var(--text-base)' }}>
              <label className="form-label">Name</label>
              <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Your name" autoFocus={mode === 'signup'} style={inputStyle} />
            </div>
          )}
          <div style={{ marginBottom: 'var(--text-base)' }}>
            <label className="form-label">Email</label>
            <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              placeholder="you@example.com" autoFocus={mode === 'login'} style={inputStyle} />
          </div>
          <div style={{ marginBottom: '1.1rem' }}>
            <label className="form-label">Password</label>
            <input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              placeholder={mode === 'signup' ? 'Min 6 characters' : 'Your password'} style={inputStyle} />
          </div>

          {error && (
            <div style={{
              background: 'var(--color-negative-light)', border: '1px solid rgba(139, 58, 42, 0.2)', borderRadius: 2,
              padding: '0.45rem 0.65rem', marginBottom: 'var(--text-base)', color: 'var(--color-negative)', fontSize: 'var(--text-sm)',
            }}>
              {error}
            </div>
          )}

          <button type="submit" disabled={loading} className="btn btn-primary" style={{
            width: '100%',
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.5 : 1,
          }}>
            {loading ? 'Please wait...' : mode === 'login' ? 'Log In' : 'Create Account'}
          </button>
          {mode === 'login' && (
            <p style={{ textAlign: 'center', marginTop: '1rem' }}>
              <a href="/forgot-password" style={{ color: 'var(--color-gold)', fontSize: 'var(--text-sm)' }}>Forgot password?</a>
            </p>
          )}
        </form>
      </div>
    </div>
  )
}
