import { useState } from 'react'
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
    border: '1px solid #E8DDD0', background: '#FFF8F0', color: '#6B1A1A',
    fontSize: '0.85rem', outline: 'none',
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
      minHeight: '100vh', background: '#FFFCF5',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{ width: '100%', maxWidth: 380, padding: '2rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <h1 style={{ fontFamily: "'Allura', cursive", fontSize: 42, color: '#C9A84C', marginBottom: '0.15rem' }}>Atlas</h1>
        </div>

        {step === 'email' && (
          <>
            <h2 style={{ fontSize: '1.1rem', marginBottom: '0.5rem', textAlign: 'center' }}>Reset Password</h2>
            <p style={{ color: '#B89090', fontSize: '0.8rem', marginBottom: '1.5rem', textAlign: 'center' }}>
              Enter your email and we'll send you a reset code.
            </p>
            <form onSubmit={requestReset}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', color: '#B89090', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>Email</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" style={inputStyle} autoFocus />
              </div>
              {error && <div style={{ background: '#F5E8E8', border: '1px solid rgba(139, 58, 42, 0.2)', borderRadius: 2, padding: '0.45rem 0.65rem', marginBottom: '0.85rem', color: '#8B3A2A', fontSize: '0.78rem' }}>{error}</div>}
              <button type="submit" disabled={loading} className="btn btn-primary" style={{ width: '100%' }}>
                {loading ? 'Sending...' : 'Send Reset Code'}
              </button>
            </form>
          </>
        )}

        {step === 'reset' && (
          <>
            <h2 style={{ fontSize: '1.1rem', marginBottom: '0.5rem', textAlign: 'center' }}>Enter Reset Code</h2>
            <p style={{ color: '#B89090', fontSize: '0.8rem', marginBottom: '1.5rem', textAlign: 'center' }}>
              Check your email for the reset code.
            </p>
            <form onSubmit={resetPassword}>
              <div style={{ marginBottom: '0.85rem' }}>
                <label style={{ display: 'block', color: '#B89090', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>Reset Code</label>
                <input type="text" value={token} onChange={e => setToken(e.target.value)} placeholder="Paste code from email" style={inputStyle} autoFocus />
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', color: '#B89090', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>New Password</label>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Min 6 characters" style={inputStyle} />
              </div>
              {error && <div style={{ background: '#F5E8E8', border: '1px solid rgba(139, 58, 42, 0.2)', borderRadius: 2, padding: '0.45rem 0.65rem', marginBottom: '0.85rem', color: '#8B3A2A', fontSize: '0.78rem' }}>{error}</div>}
              <button type="submit" disabled={loading} className="btn btn-primary" style={{ width: '100%' }}>
                {loading ? 'Resetting...' : 'Reset Password'}
              </button>
            </form>
          </>
        )}

        {step === 'done' && (
          <div style={{ textAlign: 'center' }}>
            <p style={{ color: '#2A5C3A', fontSize: '1rem', marginBottom: '1rem' }}>Password reset successful!</p>
            <a href="/" style={{ color: '#C9A84C', fontSize: '0.85rem' }}>Back to Login</a>
          </div>
        )}

        {step !== 'done' && (
          <p style={{ textAlign: 'center', marginTop: '1.5rem' }}>
            <a href="/" style={{ color: '#C9A84C', fontSize: '0.8rem' }}>Back to Login</a>
          </p>
        )}
      </div>
    </div>
  )
}
