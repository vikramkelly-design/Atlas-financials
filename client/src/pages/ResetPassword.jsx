import { useState } from 'react'
import { Link, useSearchParams, useNavigate } from 'react-router-dom'
import { api } from '../hooks/useApi'

export default function ResetPassword() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const token = searchParams.get('token')

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  const inputStyle = {
    width: '100%', padding: '0.6rem 0.75rem', borderRadius: 2,
    border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text-primary)',
    fontSize: 'var(--text-base)', outline: 'none',
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match')
      return
    }

    setLoading(true)
    try {
      await api.post('/api/auth/reset-password', { token, password })
      setDone(true)
    } catch (err) {
      setError(err.response?.data?.error || 'Invalid or expired reset link')
    }
    setLoading(false)
  }

  if (!token) {
    return (
      <div style={{
        minHeight: '100vh', background: 'var(--color-bg)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{ width: '100%', maxWidth: 380, padding: '2rem', textAlign: 'center' }}>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 42, color: 'var(--color-gold)', marginBottom: '1.5rem' }}>Atlas</h1>
          <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-base)', marginBottom: '1.5rem' }}>
            Invalid reset link. Please request a new one.
          </p>
          <Link to="/forgot-password" style={{ color: 'var(--color-gold)', fontSize: 'var(--text-sm)' }}>Request Password Reset</Link>
        </div>
      </div>
    )
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

        {!done ? (
          <>
            <h2 style={{ fontSize: 'var(--text-lg)', marginBottom: '0.5rem', textAlign: 'center' }}>Set New Password</h2>
            <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)', marginBottom: '1.5rem', textAlign: 'center' }}>
              Enter your new password below.
            </p>
            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: '0.85rem' }}>
                <label className="form-label">New Password</label>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Min 6 characters" style={inputStyle} autoFocus />
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label className="form-label">Confirm Password</label>
                <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="Re-enter password" style={inputStyle} />
              </div>
              {error && <div style={{ background: 'var(--color-negative-light)', border: '1px solid rgba(139, 58, 42, 0.2)', borderRadius: 2, padding: '0.45rem 0.65rem', marginBottom: '0.85rem', color: 'var(--color-negative)', fontSize: 'var(--text-sm)' }}>{error}</div>}
              <button type="submit" disabled={loading} className="btn btn-primary" style={{ width: '100%' }}>
                {loading ? 'Resetting...' : 'Reset Password'}
              </button>
            </form>
          </>
        ) : (
          <div style={{ textAlign: 'center' }}>
            <p style={{ color: 'var(--color-positive)', fontSize: 'var(--text-lg)', marginBottom: '1rem' }}>Password reset successful!</p>
            <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)', marginBottom: '1.5rem' }}>
              You can now log in with your new password.
            </p>
            <button onClick={() => navigate('/')} className="btn btn-primary" style={{ width: '100%' }}>
              Go to Login
            </button>
          </div>
        )}

        {!done && (
          <p style={{ textAlign: 'center', marginTop: '1.5rem' }}>
            <Link to="/" style={{ color: 'var(--color-gold)', fontSize: 'var(--text-sm)' }}>Back to Login</Link>
          </p>
        )}
      </div>
    </div>
  )
}
