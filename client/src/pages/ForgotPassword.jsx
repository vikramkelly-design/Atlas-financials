import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../hooks/useApi'

export default function ForgotPassword() {
  const [step, setStep] = useState('email') // email | reset | done
  const [email, setEmail] = useState('')
  const [token, setToken] = useState('')
  const [password, setPassword] = useState('')
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
      setStep('reset')
    } catch (err) {
      setError(err.response?.data?.error || 'Something went wrong')
    }
    setLoading(false)
  }

  const resetPassword = async (e) => {
    e.preventDefault()
    setError('')
    if (password.length < 6) { setError('Password must be at least 6 characters'); return }
    setLoading(true)
    try {
      await api.post('/api/auth/reset-password', { token, password })
      setStep('done')
    } catch (err) {
      setError(err.response?.data?.error || 'Invalid or expired reset token')
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

        {step === 'email' && (
          <>
            <h2 style={{ fontSize: 'var(--text-lg)', marginBottom: '0.5rem', textAlign: 'center' }}>Reset Password</h2>
            <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)', marginBottom: '1.5rem', textAlign: 'center' }}>
              Enter your email and we'll send you a reset code.
            </p>
            <form onSubmit={requestReset}>
              <div style={{ marginBottom: '1rem' }}>
                <label className="form-label">Email</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" style={inputStyle} autoFocus />
              </div>
              {error && <div style={{ background: 'var(--color-negative-light)', border: '1px solid rgba(139, 58, 42, 0.2)', borderRadius: 2, padding: '0.45rem 0.65rem', marginBottom: '0.85rem', color: 'var(--color-negative)', fontSize: 'var(--text-sm)' }}>{error}</div>}
              <button type="submit" disabled={loading} className="btn btn-primary" style={{ width: '100%' }}>
                {loading ? 'Sending...' : 'Send Reset Code'}
              </button>
            </form>
          </>
        )}

        {step === 'reset' && (
          <>
            <h2 style={{ fontSize: 'var(--text-lg)', marginBottom: '0.5rem', textAlign: 'center' }}>Enter Reset Code</h2>
            <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)', marginBottom: '1.5rem', textAlign: 'center' }}>
              Check your email for the reset code.
            </p>
            <form onSubmit={resetPassword}>
              <div style={{ marginBottom: '0.85rem' }}>
                <label className="form-label">Reset Code</label>
                <input type="text" value={token} onChange={e => setToken(e.target.value)} placeholder="Paste code from email" style={inputStyle} autoFocus />
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label className="form-label">New Password</label>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Min 6 characters" style={inputStyle} />
              </div>
              {error && <div style={{ background: 'var(--color-negative-light)', border: '1px solid rgba(139, 58, 42, 0.2)', borderRadius: 2, padding: '0.45rem 0.65rem', marginBottom: '0.85rem', color: 'var(--color-negative)', fontSize: 'var(--text-sm)' }}>{error}</div>}
              <button type="submit" disabled={loading} className="btn btn-primary" style={{ width: '100%' }}>
                {loading ? 'Resetting...' : 'Reset Password'}
              </button>
            </form>
          </>
        )}

        {step === 'done' && (
          <div style={{ textAlign: 'center' }}>
            <p style={{ color: 'var(--color-positive)', fontSize: 'var(--text-lg)', marginBottom: '1rem' }}>Password reset successful!</p>
            <Link to="/" style={{ color: 'var(--color-gold)', fontSize: 'var(--text-base)' }}>Back to Login</Link>
          </div>
        )}

        {step !== 'done' && (
          <p style={{ textAlign: 'center', marginTop: '1.5rem' }}>
            <Link to="/" style={{ color: 'var(--color-gold)', fontSize: 'var(--text-sm)' }}>Back to Login</Link>
          </p>
        )}
      </div>
    </div>
  )
}
