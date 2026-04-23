import { formatCurrency } from './NumberDisplay'

export default function AllocationBar({ allocation, income, allocationLocked, remaining, savingsBalance, totalDebt }) {
  if (!allocationLocked || !income) {
    return (
      <div className="card" style={{
        marginBottom: 'var(--space-lg)',
        padding: '1.25rem',
        background: 'var(--color-gold-10)',
        border: '1px solid var(--color-gold-30)',
        textAlign: 'center',
      }}>
        <p style={{ fontSize: 'var(--text-base)', fontWeight: 500, color: 'var(--color-text-primary)', marginBottom: '0.25rem' }}>
          Set up your monthly allocation
        </p>
        <p className="text-faint" style={{ fontSize: 'var(--text-sm)', marginBottom: '0.75rem' }}>
          Split your income between spending, saving, and investing to see your full financial picture.
        </p>
        <button className="btn btn-primary" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
          Complete setup
        </button>
      </div>
    )
  }

  return (
    <div className="card" style={{ marginBottom: 'var(--space-lg)' }}>
      <p className="label-caps" style={{ marginBottom: '0.5rem' }}>Monthly Allocation</p>
      <div style={{ height: 10, borderRadius: 5, overflow: 'hidden', display: 'flex', marginBottom: '0.75rem' }}>
        <div style={{ width: `${allocation.spend_pct}%`, background: 'var(--color-negative)' }} />
        <div style={{ width: `${allocation.savings_pct}%`, background: 'var(--color-positive)' }} />
        <div style={{ width: `${allocation.invest_pct}%`, background: '#5B8DEF' }} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem', textAlign: 'center', marginBottom: '1rem' }}>
        {[
          { label: 'Spend', pct: allocation.spend_pct, color: 'var(--color-negative)' },
          { label: 'Save', pct: allocation.savings_pct, color: 'var(--color-positive)' },
          { label: 'Invest', pct: allocation.invest_pct, color: '#5B8DEF' },
        ].map(s => (
          <div key={s.label}>
            <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>{s.label}</span>
            <p className="mono" style={{ fontSize: 'var(--text-base)', fontWeight: 600, color: s.color, margin: 0 }}>
              {s.pct}% <span className="text-faint" style={{ fontSize: 'var(--text-xs)', fontWeight: 400 }}>${Math.round(income * s.pct / 100)}</span>
            </p>
          </div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem', borderTop: '1px solid var(--color-border)', paddingTop: '0.75rem' }}>
        <div style={{ textAlign: 'center' }}>
          <p className="label-caps" style={{ marginBottom: '0.2rem' }}>Left to Spend</p>
          <span className="mono" style={{ fontSize: 'var(--text-xl)', fontWeight: 600, color: remaining >= 0 ? 'var(--color-positive)' : 'var(--color-negative)' }}>
            {formatCurrency(Math.abs(remaining))}
          </span>
        </div>
        <div style={{ textAlign: 'center' }}>
          <p className="label-caps" style={{ marginBottom: '0.2rem' }}>Savings</p>
          <span className="mono" style={{ fontSize: 'var(--text-xl)', fontWeight: 600, color: 'var(--color-positive)' }}>
            {formatCurrency(savingsBalance)}
          </span>
        </div>
        <div style={{ textAlign: 'center' }}>
          <p className="label-caps" style={{ marginBottom: '0.2rem' }}>Total Debt</p>
          <span className="mono" style={{ fontSize: 'var(--text-xl)', fontWeight: 600, color: totalDebt > 0 ? 'var(--color-negative)' : 'var(--color-text-muted)' }}>
            {totalDebt > 0 ? formatCurrency(totalDebt) : '$0'}
          </span>
        </div>
      </div>
    </div>
  )
}
