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
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <LoadingSpinner />

  const earned = badges.filter(b => b.earned)
  const locked = badges.filter(b => !b.earned)

  return (
    <div>
      <p style={{ fontSize: 'var(--text-base)', color: 'var(--color-text-muted)', marginBottom: 'var(--space-lg)' }}>
        {earned.length} of {badges.length} badges earned
      </p>

      {earned.length === 0 && locked.length === 0 && (
        <EmptyState title="No Badges" message="Start using Atlas to earn your first badge." />
      )}

      {earned.length > 0 && (
        <>
          <h3 style={{ fontSize: 'var(--text-sm)', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-faint)', marginBottom: 'var(--space-sm)' }}>
            Earned
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 'var(--space-md)', marginBottom: 'var(--space-xl)' }}>
            {earned.map(b => (
              <div key={b.key} className="card badge-card badge-earned">
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', marginBottom: 'var(--space-xs)' }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: '50%',
                    background: 'var(--color-accent-15)', border: '1.5px solid var(--color-accent)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d={ICON_PATHS[b.icon] || ICON_PATHS.award} />
                    </svg>
                  </div>
                  <div>
                    <div style={{ fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--color-text)' }}>{b.name}</div>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-faint)' }}>{b.description}</div>
                  </div>
                </div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-success)', marginTop: 'var(--space-xs)' }}>
                  Earned {new Date(b.earned_at).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {locked.length > 0 && (
        <>
          <h3 style={{ fontSize: 'var(--text-sm)', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-faint)', marginBottom: 'var(--space-sm)' }}>
            Locked
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 'var(--space-md)' }}>
            {locked.map(b => (
              <div key={b.key} className="card badge-card badge-locked">
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: '50%',
                    background: 'var(--color-surface-2)', border: '1.5px solid var(--color-border)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-faint)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d={ICON_PATHS[b.icon] || ICON_PATHS.award} />
                    </svg>
                  </div>
                  <div>
                    <div style={{ fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--color-text-faint)' }}>{b.name}</div>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-faint)' }}>{b.description}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
