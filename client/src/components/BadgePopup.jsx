import { useEffect } from 'react'

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

export default function BadgePopup({ badge, onClose }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 5000)
    return () => clearTimeout(timer)
  }, [onClose])

  if (!badge) return null

  const iconPath = ICON_PATHS[badge.icon] || ICON_PATHS.award

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 10001,
      background: 'rgba(0,0,0,0.4)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: 'var(--color-surface)',
        border: '2px solid var(--color-gold)',
        borderRadius: 4,
        padding: 'var(--space-xl)',
        textAlign: 'center',
        maxWidth: 320,
        width: '90%',
        animation: 'badgeReveal 0.5s ease-out',
      }}>
        <div style={{
          width: 64, height: 64, margin: '0 auto var(--space-md)',
          background: 'var(--color-gold-15)',
          borderRadius: '50%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          border: '2px solid var(--color-gold)',
        }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--color-gold)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d={iconPath} />
          </svg>
        </div>
        <p style={{
          fontSize: 'var(--text-xs)', textTransform: 'uppercase', letterSpacing: '0.08em',
          color: 'var(--color-gold)', marginBottom: 'var(--space-xs)', fontWeight: 600,
        }}>
          Badge Earned!
        </p>
        <h3 style={{ fontSize: 'var(--text-xl)', color: 'var(--color-text-primary)', marginBottom: 'var(--space-xs)' }}>
          {badge.name}
        </h3>
        <p style={{ fontSize: 'var(--text-base)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-lg)' }}>
          {badge.description}
        </p>
        <button className="btn btn-primary" onClick={onClose}>Got it!</button>
      </div>
    </div>
  )
}
