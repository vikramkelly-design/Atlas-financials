import { useState } from 'react'
import { formatCurrency } from '../../components/NumberDisplay'

export default function AllocationSetup({ income, onComplete }) {
  const [spend, setSpend] = useState(60)
  const [save, setSave] = useState(20)
  const [invest, setInvest] = useState(20)

  const total = spend + save + invest
  const valid = total === 100 && spend >= 0 && save >= 0 && invest >= 0

  const adjust = (setter, value, others) => {
    const v = Math.max(0, Math.min(100, value))
    setter(v)
    // Auto-balance: distribute remainder to the other two proportionally
    const remainder = 100 - v
    const otherSum = others[0].get + others[1].get
    if (otherSum === 0) {
      others[0].set(Math.round(remainder / 2))
      others[1].set(remainder - Math.round(remainder / 2))
    } else {
      const r0 = Math.round((others[0].get / otherSum) * remainder)
      others[0].set(r0)
      others[1].set(remainder - r0)
    }
  }

  const sliders = [
    { label: 'Spend', value: spend, set: setSpend, get: spend, color: 'var(--color-negative)' },
    { label: 'Save', value: save, set: setSave, get: save, color: 'var(--color-positive)' },
    { label: 'Invest', value: invest, set: setInvest, get: invest, color: 'var(--color-accent)' },
  ]

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300 }}
    >
      <div className="card" style={{ maxWidth: 420, width: '100%', maxHeight: '90vh', overflow: 'auto' }}>
        <h2 style={{ fontSize: 'var(--text-xl)', marginBottom: '0.25rem' }}>Set your allocation</h2>
        <p className="text-faint" style={{ fontSize: 'var(--text-sm)', marginBottom: '1.25rem' }}>
          How should your {formatCurrency(income)} be split this month? This is locked once set.
        </p>

        {/* Stacked bar preview */}
        <div style={{ height: 14, borderRadius: 7, overflow: 'hidden', display: 'flex', marginBottom: '1.5rem' }}>
          <div style={{ width: `${spend}%`, background: 'var(--color-negative)', transition: 'width 0.2s' }} />
          <div style={{ width: `${save}%`, background: 'var(--color-positive)', transition: 'width 0.2s' }} />
          <div style={{ width: `${invest}%`, background: 'var(--color-accent)', transition: 'width 0.2s' }} />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginBottom: '1.5rem' }}>
          {sliders.map((s, i) => {
            const others = sliders.filter((_, j) => j !== i)
            return (
              <div key={s.label}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                  <span style={{ fontSize: 'var(--text-sm)', fontWeight: 500 }}>{s.label}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span className="mono" style={{ fontSize: 'var(--text-lg)', fontWeight: 600, color: s.color }}>
                      {s.value}%
                    </span>
                    <span className="text-faint mono" style={{ fontSize: 'var(--text-xs)' }}>
                      {formatCurrency(income * s.value / 100)}
                    </span>
                  </div>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={s.value}
                  onChange={e => adjust(s.set, parseInt(e.target.value), others)}
                  style={{ width: '100%', accentColor: s.color }}
                />
              </div>
            )
          })}
        </div>

        {!valid && (
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-negative)', textAlign: 'center', marginBottom: '0.75rem' }}>
            Must total 100% (currently {total}%)
          </p>
        )}

        <button
          className="btn btn-primary"
          disabled={!valid}
          onClick={() => onComplete({ spend_pct: spend, savings_pct: save, invest_pct: invest })}
          style={{ width: '100%', opacity: valid ? 1 : 0.4 }}
        >
          Lock allocation for this month
        </button>
      </div>
    </div>
  )
}
