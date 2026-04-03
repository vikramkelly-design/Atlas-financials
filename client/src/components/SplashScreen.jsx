import { useEffect, useState } from 'react'

export default function SplashScreen({ onComplete }) {
  const [phase, setPhase] = useState('pulse') // pulse → zoom → done

  useEffect(() => {
    const t1 = setTimeout(() => setPhase('zoom'), 1500)
    const t2 = setTimeout(() => onComplete(), 2500)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [onComplete])

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 99999,
      background: 'var(--color-navy)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      animation: phase === 'zoom' ? 'splashZoom 1s ease-in forwards' : undefined,
    }}>
      <span style={{
        fontFamily: 'var(--font-serif)',
        fontSize: 'var(--text-5xl)',
        color: 'var(--color-gold)',
        animation: phase === 'pulse' ? 'splashPulse 1.5s ease-in-out' : undefined,
      }}>
        Atlas
      </span>
      <span style={{
        color: 'var(--color-gold-60)',
        fontSize: 'var(--text-sm)',
        textTransform: 'uppercase',
        letterSpacing: '0.12em',
        marginTop: 'var(--space-xs)',
      }}>
        Finance Terminal
      </span>
    </div>
  )
}
