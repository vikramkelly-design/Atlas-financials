import { useState, useEffect } from 'react'
import { api } from '../hooks/useApi'
import { useToast } from '../components/Toast'
import ConfirmDialog from '../components/ConfirmDialog'
import LoadingSpinner from '../components/LoadingSpinner'

export default function Settings() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState({ name: '', email: '' })
  const [passwords, setPasswords] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' })
  const [debtStrategy, setDebtStrategy] = useState('avalanche')
  const [saving, setSaving] = useState({})
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deletePassword, setDeletePassword] = useState('')

  useEffect(() => {
    api.get('/api/settings')
      .then(res => {
        setProfile(res.data.data.profile)
        setDebtStrategy(res.data.data.preferences.debt_strategy)
      })
      .catch(() => toast('Failed to load settings', 'error'))
      .finally(() => setLoading(false))
  }, [])

  const saveProfile = async () => {
    if (!profile.name || !profile.email) return toast('Name and email are required', 'error')
    setSaving(s => ({ ...s, profile: true }))
    try {
      await api.patch('/api/settings/profile', profile)
      toast('Profile updated', 'success')
      // Update stored user
      const stored = JSON.parse(localStorage.getItem('atlas_user') || '{}')
      localStorage.setItem('atlas_user', JSON.stringify({ ...stored, name: profile.name, email: profile.email }))
    } catch (err) {
      toast(err.response?.data?.error || 'Failed to update', 'error')
    }
    setSaving(s => ({ ...s, profile: false }))
  }

  const changePassword = async () => {
    if (!passwords.currentPassword || !passwords.newPassword) return toast('All fields required', 'error')
    if (passwords.newPassword.length < 6) return toast('New password must be at least 6 characters', 'error')
    if (passwords.newPassword !== passwords.confirmPassword) return toast('Passwords do not match', 'error')
    setSaving(s => ({ ...s, password: true }))
    try {
      await api.post('/api/settings/change-password', {
        currentPassword: passwords.currentPassword,
        newPassword: passwords.newPassword,
      })
      toast('Password updated', 'success')
      setPasswords({ currentPassword: '', newPassword: '', confirmPassword: '' })
    } catch (err) {
      toast(err.response?.data?.error || 'Failed to update password', 'error')
    }
    setSaving(s => ({ ...s, password: false }))
  }

  const saveStrategy = async (val) => {
    setDebtStrategy(val)
    try {
      await api.patch('/api/settings/preferences', { debt_strategy: val })
      toast('Strategy updated', 'success')
    } catch {
      toast('Failed to save', 'error')
    }
  }

  const deleteAccount = async () => {
    if (!deletePassword) return toast('Password required', 'error')
    try {
      await api.delete('/api/settings/account', { data: { password: deletePassword } })
      localStorage.removeItem('atlas_token')
      localStorage.removeItem('atlas_user')
      window.location.href = '/login'
    } catch (err) {
      toast(err.response?.data?.error || 'Failed to delete account', 'error')
    }
    setDeleteOpen(false)
    setDeletePassword('')
  }

  if (loading) return <LoadingSpinner />

  const sectionStyle = { marginBottom: 'var(--space-xl)' }
  const labelStyle = { display: 'block', color: 'var(--color-text-muted)', fontSize: 'var(--text-xs)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3 }
  const fieldStyle = { marginBottom: 'var(--space-md)' }

  return (
    <div style={{ maxWidth: 560 }}>
      {/* Profile */}
      <div className="card" style={sectionStyle}>
        <h3 style={{ fontSize: 'var(--text-lg)', marginBottom: 'var(--space-md)', color: 'var(--color-text-primary)' }}>Profile</h3>
        <div style={fieldStyle}>
          <label style={labelStyle}>Name</label>
          <input className="input" value={profile.name} onChange={e => setProfile(p => ({ ...p, name: e.target.value }))} />
        </div>
        <div style={fieldStyle}>
          <label style={labelStyle}>Email</label>
          <input className="input" type="email" value={profile.email} onChange={e => setProfile(p => ({ ...p, email: e.target.value }))} />
        </div>
        <button className="btn btn-primary" onClick={saveProfile} disabled={saving.profile}>
          {saving.profile ? 'Saving...' : 'Save'}
        </button>
      </div>

      {/* Change Password */}
      <div className="card" style={sectionStyle}>
        <h3 style={{ fontSize: 'var(--text-lg)', marginBottom: 'var(--space-md)', color: 'var(--color-text-primary)' }}>Change Password</h3>
        <div style={fieldStyle}>
          <label style={labelStyle}>Current Password</label>
          <input className="input" type="password" value={passwords.currentPassword}
            onChange={e => setPasswords(p => ({ ...p, currentPassword: e.target.value }))} />
        </div>
        <div style={fieldStyle}>
          <label style={labelStyle}>New Password</label>
          <input className="input" type="password" value={passwords.newPassword}
            onChange={e => setPasswords(p => ({ ...p, newPassword: e.target.value }))} />
        </div>
        <div style={fieldStyle}>
          <label style={labelStyle}>Confirm New Password</label>
          <input className="input" type="password" value={passwords.confirmPassword}
            onChange={e => setPasswords(p => ({ ...p, confirmPassword: e.target.value }))} />
        </div>
        <button className="btn btn-primary" onClick={changePassword} disabled={saving.password}>
          {saving.password ? 'Updating...' : 'Update Password'}
        </button>
      </div>

      {/* Preferences */}
      <div className="card" style={sectionStyle}>
        <h3 style={{ fontSize: 'var(--text-lg)', marginBottom: 'var(--space-md)', color: 'var(--color-text-primary)' }}>Preferences</h3>
        <div>
          <label style={labelStyle}>Debt Payoff Strategy</label>
          <div style={{ display: 'flex', gap: 'var(--space-sm)', marginTop: 'var(--space-xs)' }}>
            {['avalanche', 'snowball'].map(s => (
              <button key={s} className={`btn ${debtStrategy === s ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => saveStrategy(s)} style={{ textTransform: 'capitalize' }}>
                {s}
              </button>
            ))}
          </div>
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginTop: 'var(--space-xs)' }}>
            {debtStrategy === 'avalanche' ? 'Pay highest interest rate first — saves the most money.' : 'Pay smallest balance first — builds momentum faster.'}
          </p>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="card" style={{ borderColor: 'var(--color-negative)' }}>
        <h3 style={{ fontSize: 'var(--text-lg)', marginBottom: 'var(--space-sm)', color: 'var(--color-negative)' }}>Danger Zone</h3>
        <p style={{ fontSize: 'var(--text-base)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-md)' }}>
          Permanently delete your account and all data. This cannot be undone.
        </p>
        <button className="btn btn-danger" onClick={() => setDeleteOpen(true)}>Delete Account</button>
      </div>

      {/* Delete Confirmation */}
      {deleteOpen && (
        <div onClick={() => setDeleteOpen(false)} style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999,
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: 'var(--color-surface)', border: '1px solid var(--color-negative)', borderRadius: 2,
            padding: 'var(--space-lg)', maxWidth: 380, width: '90%',
          }}>
            <h3 style={{ fontSize: 'var(--text-lg)', marginBottom: 'var(--space-sm)', color: 'var(--color-negative)' }}>Delete Account</h3>
            <p style={{ fontSize: 'var(--text-base)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-md)' }}>
              Enter your password to confirm deletion.
            </p>
            <input className="input" type="password" placeholder="Password" value={deletePassword}
              onChange={e => setDeletePassword(e.target.value)} style={{ marginBottom: 'var(--space-md)' }} />
            <div style={{ display: 'flex', gap: 'var(--space-sm)', justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => { setDeleteOpen(false); setDeletePassword('') }}>Cancel</button>
              <button className="btn btn-danger" onClick={deleteAccount}>Delete Forever</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
