import { useState } from 'react'
import { formatCurrency } from '../../components/NumberDisplay'

const CATEGORIES = ['Food & Dining', 'Transport', 'Shopping', 'Subscriptions', 'Health', 'Entertainment', 'Other']

export default function BudgetSetup({ income, spendBudget, onComplete, onSkip }) {
  const [limits, setLimits] = useState({})

  const cap = spendBudget || income || 0
  const totalLimits = Object.values(limits).reduce((s, v) => s + (parseFloat(v) || 0), 0)
  const overBudget = totalLimits > cap
  const remaining = cap - totalLimits
  const pct = cap > 0 ? Math.min(100, (totalLimits / cap) * 100) : 0

  const handleFinish = () => {
    if (overBudget) return
    onComplete({
      goals: Object.entries(limits)
        .filter(([, v]) => parseFloat(v) > 0)
        .map(([category, monthly_limit]) => ({ category, monthly_limit: parseFloat(monthly_limit) })),
    })
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300 }}
      onClick={onSkip}
    >
      <div className="card" style={{ maxWidth: 440, width: '100%', maxHeight: '90vh', overflow: 'auto' }} onClick={e => e.stopPropagation()}>
        <h2 style={{ fontSize: 'var(--text-xl)', marginBottom: '0.25rem' }}>Set spending limits</h2>
        <p className="text-faint" style={{ fontSize: 'var(--text-sm)', marginBottom: '1rem' }}>
          You have {formatCurrency(cap)} allocated for spending this month. Set limits per category — they can't exceed your spend budget.
        </p>

        {/* Budget usage bar */}
        <div style={{ marginBottom: '1.25rem' }}>
          <div style={{ height: 8, borderRadius: 4, overflow: 'hidden', background: 'var(--color-surface-2)' }}>
            <div style={{
              height: '100%', width: `${pct}%`, borderRadius: 4,
              background: overBudget ? 'var(--color-negative)' : pct > 85 ? 'var(--color-gold)' : 'var(--color-positive)',
              transition: 'width 0.2s, background 0.2s',
            }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.35rem' }}>
            <span className="mono" style={{ fontSize: 'var(--text-xs)', color: overBudget ? 'var(--color-negative)' : 'var(--color-text-muted)' }}>
              {formatCurrency(totalLimits)} used
            </span>
            <span className="mono" style={{ fontSize: 'var(--text-xs)', color: overBudget ? 'var(--color-negative)' : 'var(--color-positive)' }}>
              {overBudget ? `${formatCurrency(Math.abs(remaining))} over` : `${formatCurrency(remaining)} left`}
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.25rem' }}>
          {CATEGORIES.map(cat => {
            const val = parseFloat(limits[cat]) || 0
            return (
              <div key={cat} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                <span style={{ fontSize: 'var(--text-sm)', flex: 1 }}>{cat}</span>
                <div style={{ position: 'relative', width: 110 }}>
                  <span style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>$</span>
                  <input
                    className="input mono"
                    type="number"
                    step="10"
                    min="0"
                    placeholder="—"
                    value={limits[cat] || ''}
                    onChange={e => setLimits(l => ({ ...l, [cat]: e.target.value }))}
                    style={{
                      paddingLeft: '1.25rem', fontSize: 'var(--text-sm)', textAlign: 'right',
                      borderColor: val > 0 && overBudget ? 'var(--color-negative)' : undefined,
                    }}
                  />
                </div>
              </div>
            )
          })}
        </div>

        {overBudget && (
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-negative)', textAlign: 'center', marginBottom: '0.75rem' }}>
            Your limits exceed your {formatCurrency(cap)} spending budget by {formatCurrency(Math.abs(remaining))}. Reduce some categories to continue.
          </p>
        )}

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn btn-ghost" onClick={onSkip} style={{ flex: 1 }}>Skip for now</button>
          <button className="btn btn-primary" onClick={handleFinish} disabled={overBudget} style={{ flex: 1, opacity: overBudget ? 0.4 : 1 }}>
            {totalLimits > 0 ? 'Save limits' : 'Skip'}
          </button>
        </div>
      </div>
    </div>
  )
}
