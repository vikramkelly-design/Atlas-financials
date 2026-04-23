import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../hooks/useApi'

export default function ForgotPassword() {
  const [sent, setSent] = useState(false)
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const inputStyle = {
    width: '100%', padding: '0.6rem 0.75rem', borderRadius: 2,
    border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text-primary)',
    fontSize: 'var(--text-base)', outline: 'none',
  }

  const requestReset = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await api.post('/api/auth/forgot-password', { email })
      setSent(true)
    } catch (err) {
      setError(err.response?.data?.error || 'Something went wrong')
    }
    setLoading(false)
  }

  return (
    <div style={{
      minHeight: '100vh', background: 'var(--color-bg)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{ width: '100%', maxWidth: 380, padding: '2rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 42, color: 'var(--color-gold)', marginBottom: '0.15rem' }}>Atlas</h1>
        </div>

        {!sent ? (
          <>
            <h2 style={{ fontSize: 'var(--text-lg)', marginBottom: '0.5rem', textAlign: 'center' }}>Reset Password</h2>
            <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)', marginBottom: '1.5rem', textAlign: 'center' }}>
              Enter your email and we'll send you a reset link.
            </p>
            <form onSubmit={requestReset}>
              <div style={{ marginBottom: '1rem' }}>
                <label className="form-label">Email</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" style={inputStyle} autoFocus />
              </div>
              {error && <div style={{ background: 'var(--color-negative-light)', border: '1px solid rgba(139, 58, 42, 0.2)', borderRadius: 2, padding: '0.45rem 0.65rem', marginBottom: '0.85rem', color: 'var(--color-negative)', fontSize: 'var(--text-sm)' }}>{error}</div>}
              <button type="submit" disabled={loading} className="btn btn-primary" style={{ width: '100%' }}>
                {loading ? 'Sending...' : 'Send Reset Link'}
              </button>
            </form>
          </>
        ) : (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>&#9993;</div>
            <h2 style={{ fontSize: 'var(--text-lg)', marginBottom: '0.75rem' }}>Check Your Email</h2>
            <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)', lineHeight: 1.6, marginBottom: '1.5rem' }}>
              If an account exists for <strong style={{ color: 'var(--color-text-primary)' }}>{email}</strong>, we've sent a password reset link. Check your inbox and spam folder.
            </p>
            <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-xs)' }}>
              The link expires in 1 hour.
            </p>
          </div>
        )}

        <p style={{ textAlign: 'center', marginTop: '1.5rem' }}>
          <Link to="/" style={{ color: 'var(--color-gold)', fontSize: 'var(--text-sm)' }}>Back to Login</Link>
        </p>
      </div>
    </div>
  )
}
