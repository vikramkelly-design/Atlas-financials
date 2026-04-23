import { useState, useEffect, useRef } from 'react'
import { api } from '../hooks/useApi'
import { useToast } from '../components/Toast'
import LoadingSpinner from '../components/LoadingSpinner'
import CollapsibleSection from '../components/CollapsibleSection'

function getInitials(name) {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0][0].toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export default function Settings() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState({ name: '', email: '', created_at: null })
  const [passwords, setPasswords] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' })
  const [saving, setSaving] = useState({})
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deletePassword, setDeletePassword] = useState('')
  const deleteInputRef = useRef(null)

  useEffect(() => { window.scrollTo(0, 0) }, [])

  useEffect(() => {
    api.get('/api/settings')
      .then(res => setProfile(res.data.data.profile))
      .catch(() => toast('Failed to load settings', 'error'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (deleteOpen) {
      deleteInputRef.current?.focus()
      const handleEsc = (e) => { if (e.key === 'Escape') { setDeleteOpen(false); setDeletePassword('') } }
      document.addEventListener('keydown', handleEsc)
      return () => document.removeEventListener('keydown', handleEsc)
    }
  }, [deleteOpen])

  const saveProfile = async () => {
    if (!profile.name || !profile.email) return toast('Name and email are required', 'error')
    setSaving(s => ({ ...s, profile: true }))
    try {
      await api.patch('/api/settings/profile', profile)
      toast('Profile updated', 'success')
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

  const passwordMismatch = passwords.confirmPassword && passwords.newPassword !== passwords.confirmPassword
  const passwordTooShort = passwords.newPassword && passwords.newPassword.length > 0 && passwords.newPassword.length < 6

  const memberSince = profile.created_at
    ? new Date(profile.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : null

  return (
    <div style={{ maxWidth: '65ch' }}>

      {/* ── ACCOUNT HEADER ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 'var(--space-lg)',
        marginBottom: 'var(--space-2xl)',
        paddingBottom: 'var(--space-xl)',
        borderBottom: '1px solid var(--color-border)',
      }}>
        <div style={{
          width: 56, height: 56, borderRadius: '50%',
          background: 'var(--color-gold)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'var(--font-serif)', fontSize: 'var(--text-xl)',
          color: 'var(--color-navy)', fontWeight: 600,
          flexShrink: 0,
        }}>
          {getInitials(profile.name)}
        </div>
        <div>
          <h1 style={{
            fontFamily: 'var(--font-serif)',
            fontSize: 'var(--text-xl)',
            fontWeight: 400,
            color: 'var(--color-text-primary)',
            letterSpacing: '-0.01em',
            lineHeight: 1.2,
          }}>{profile.name || 'Your Account'}</h1>
          <p style={{
            fontSize: 'var(--text-sm)',
            color: 'var(--color-text-muted)',
            marginTop: 2,
          }}>{profile.email}</p>
          {memberSince && (
            <p style={{
              fontSize: 'var(--text-xs)',
              color: 'var(--color-text-muted)',
              marginTop: 4,
              opacity: 0.7,
            }}>Member since {memberSince}</p>
          )}
        </div>
      </div>

      {/* ── PROFILE SECTION ── */}
      <CollapsibleSection title="Profile" sectionKey="settings-profile" defaultOpen={true}>
        <div className="card">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
            <div>
              <label className="label-caps" style={{ marginBottom: 4, display: 'block' }}>Name</label>
              <input className="input" value={profile.name}
                onChange={e => setProfile(p => ({ ...p, name: e.target.value }))} />
            </div>
            <div>
              <label className="label-caps" style={{ marginBottom: 4, display: 'block' }}>Email</label>
              <input className="input" type="email" value={profile.email}
                onChange={e => setProfile(p => ({ ...p, email: e.target.value }))} />
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 'var(--space-lg)' }}>
            <button className="btn btn-primary" onClick={saveProfile} disabled={saving.profile}>
              {saving.profile ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </CollapsibleSection>

      {/* ── SECURITY SECTION ── */}
      <CollapsibleSection title="Security" sectionKey="settings-security" defaultOpen={false}>
        <div className="card">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
            <div>
              <label className="label-caps" style={{ marginBottom: 4, display: 'block' }}>Current Password</label>
              <input className="input" type="password" value={passwords.currentPassword}
                onChange={e => setPasswords(p => ({ ...p, currentPassword: e.target.value }))} />
            </div>
            <div>
              <label className="label-caps" style={{ marginBottom: 4, display: 'block' }}>New Password</label>
              <input className="input" type="password" value={passwords.newPassword}
                onChange={e => setPasswords(p => ({ ...p, newPassword: e.target.value }))}
                style={passwordTooShort ? { borderColor: 'var(--color-negative)' } : {}} />
              {passwordTooShort && (
                <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-negative)', marginTop: 4 }}>
                  Must be at least 6 characters
                </p>
              )}
            </div>
            <div>
              <label className="label-caps" style={{ marginBottom: 4, display: 'block' }}>Confirm New Password</label>
              <input className="input" type="password" value={passwords.confirmPassword}
                onChange={e => setPasswords(p => ({ ...p, confirmPassword: e.target.value }))}
                style={passwordMismatch ? { borderColor: 'var(--color-negative)' } : {}} />
              {passwordMismatch && (
                <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-negative)', marginTop: 4 }}>
                  Passwords do not match
                </p>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 'var(--space-lg)' }}>
            <button className="btn btn-primary" onClick={changePassword} disabled={saving.password}>
              {saving.password ? 'Updating...' : 'Update Password'}
            </button>
          </div>
        </div>
      </CollapsibleSection>

      {/* ── DANGER ZONE ── */}
      <div style={{ marginTop: 'var(--space-3xl)' }}>
        <p className="label-caps" style={{
          marginBottom: 'var(--space-md)',
          color: 'var(--color-negative)',
        }}>Danger Zone</p>

        <div style={{
          background: 'var(--color-negative-light)',
          border: '1px solid var(--color-negative)',
          borderRadius: 'var(--radius-sm)',
          padding: 'var(--space-lg)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-lg)' }}>
            <div>
              <h3 style={{
                fontSize: 'var(--text-base)',
                fontWeight: 500,
                color: 'var(--color-negative)',
                marginBottom: 'var(--space-xs)',
              }}>Delete Account</h3>
              <p style={{
                fontSize: 'var(--text-sm)',
                color: 'var(--color-text-secondary)',
                lineHeight: 1.5,
              }}>
                Permanently delete your account and all data. This cannot be undone.
              </p>
            </div>
            <button className="btn btn-danger" onClick={() => setDeleteOpen(true)}
              style={{ flexShrink: 0 }}>
              Delete
            </button>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {deleteOpen && (
        <div
          onClick={() => { setDeleteOpen(false); setDeletePassword('') }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-dialog-title"
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 1000,
          }}
        >
          <div onClick={e => e.stopPropagation()} style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-negative)',
            borderRadius: 'var(--radius-sm)',
            padding: 'var(--space-lg)',
            maxWidth: 380, width: '90%',
          }}>
            <h3 id="delete-dialog-title" style={{
              fontSize: 'var(--text-lg)',
              fontWeight: 500,
              marginBottom: 'var(--space-xs)',
              color: 'var(--color-negative)',
            }}>Delete your account?</h3>
            <p style={{
              fontSize: 'var(--text-sm)',
              color: 'var(--color-text-secondary)',
              marginBottom: 'var(--space-md)',
              lineHeight: 1.5,
            }}>
              This will permanently erase all your data — budget, savings, debts, portfolio, and settings. Enter your password to confirm.
            </p>
            <input
              ref={deleteInputRef}
              className="input"
              type="password"
              placeholder="Your password"
              value={deletePassword}
              onChange={e => setDeletePassword(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && deletePassword) deleteAccount() }}
              style={{ marginBottom: 'var(--space-md)' }}
            />
            <div style={{ display: 'flex', gap: 'var(--space-sm)', justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => { setDeleteOpen(false); setDeletePassword('') }}>
                Cancel
              </button>
              <button className="btn btn-danger" onClick={deleteAccount} disabled={!deletePassword}>
                Delete Forever
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
