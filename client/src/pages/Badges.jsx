import { useState, useEffect } from 'react'
import { api } from '../hooks/useApi'
import LoadingSpinner from '../components/LoadingSpinner'
import EmptyState from '../components/EmptyState'

const ICON_PATHS = {
  upload: 'M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12',
  'trending-up': 'M23 6l-9.5 9.5-5-5L1 18',
  shield: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
  'check-circle': 'M22 11.08V12a10 10 0 11-5.93-9.14M22 4L12 14.01l-3-3',
  target: 'M12 22a10 10 0 100-20 10 10 0 000 20zM12 18a6 6 0 100-12 6 6 0 000 12zM12 14a2 2 0 100-4 2 2 0 000 4z',
  activity: 'M22 12h-4l-3 9L9 3l-3 9H2',
  dollar: 'M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6',
  award: 'M12 15a7 7 0 100-14 7 7 0 000 14zM8.21 13.89L7 23l5-3 5 3-1.21-9.12',
  layers: 'M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5',
  flag: 'M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1zM4 22v-7',
}

export default function Badges() {
  const [badges, setBadges] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/api/badges')
      .then(res => setBadges(res.data.data))
      .catch(e => console.warn('Badges load failed', e))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <LoadingSpinner />

  const earned = badges.filter(b => b.earned)
  const locked = badges.filter(b => !b.earned)

  return (
    <div>
      <div style={{ marginBottom: 'var(--space-lg)' }}>
        <h1 style={{ fontSize: 'var(--text-3xl)', marginBottom: '0.15rem' }}>Track Record</h1>
        <p className="label-caps">{earned.length} of {badges.length} milestones achieved</p>
      </div>

      {earned.length === 0 && locked.length === 0 && (
        <EmptyState title="No Milestones" message="Start using Atlas to begin building your track record." />
      )}

      {earned.length > 0 && (
        <>
          <p className="label-caps" style={{ marginBottom: 'var(--space-sm)' }}>Achieved</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)', marginBottom: 'var(--space-xl)' }}>
            {earned.map(b => (
              <div key={b.key} className="card" style={{
                background: 'var(--color-gold-15)',
                display: 'flex', alignItems: 'center', gap: 'var(--space-md)', padding: '1rem 1.25rem',
              }}>
                <div style={{
                  width: 44, height: 44, borderRadius: '50%',
                  background: 'var(--color-gold-15)', border: '1.5px solid var(--color-gold)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-gold)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d={ICON_PATHS[b.icon] || ICON_PATHS.award} />
                  </svg>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--color-text-primary)' }}>{b.name}</div>
                  <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>{b.description}</div>
                </div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-positive)', textAlign: 'right', whiteSpace: 'nowrap' }}>
                  {new Date(b.earned_at).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {locked.length > 0 && (
        <>
          <p className="label-caps" style={{ marginBottom: 'var(--space-sm)' }}>In Progress</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
            {locked.map(b => (
              <div key={b.key} className="card" style={{
                display: 'flex', alignItems: 'center', gap: 'var(--space-md)', padding: '1rem 1.25rem',
                opacity: 0.55,
              }}>
                <div style={{
                  width: 44, height: 44, borderRadius: '50%',
                  background: 'var(--color-surface-2)', border: '1.5px solid var(--color-border)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d={ICON_PATHS[b.icon] || ICON_PATHS.award} />
                  </svg>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--color-text-muted)' }}>{b.name}</div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>{b.description}</div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
