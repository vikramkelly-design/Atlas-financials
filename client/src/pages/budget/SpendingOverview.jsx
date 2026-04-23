import { formatCurrency } from '../../components/NumberDisplay'

export default function SpendingOverview({ income, totalSpent, remaining }) {
  const spent = Math.abs(totalSpent)
  const spentPct = income > 0 ? Math.min(100, (spent / income) * 100) : 0
  const overspent = remaining < 0
  const noIncome = income <= 0

  if (noIncome) {
    return (
      <div className="card" style={{ marginBottom: 'var(--space-lg)', textAlign: 'center', padding: '1.5rem' }}>
        <p className="text-faint" style={{ fontSize: 'var(--text-base)' }}>
          Set your monthly income above to see your spending breakdown.
        </p>
      </div>
    )
  }

  return (
    <div className="card" style={{ marginBottom: 'var(--space-lg)' }}>
      {/* Bar */}
      <div style={{ height: 12, borderRadius: 6, overflow: 'hidden', background: 'var(--color-surface-2)', marginBottom: '1rem' }}>
        <div style={{
          height: '100%',
          width: `${Math.min(100, spentPct)}%`,
          borderRadius: 6,
          background: overspent ? 'var(--color-negative)' : spentPct > 85 ? 'var(--color-gold)' : 'var(--color-positive)',
          transition: 'width 0.4s ease',
        }} />
      </div>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', textAlign: 'center' }}>
        <div>
          <p className="label-caps" style={{ marginBottom: '0.2rem' }}>Income</p>
          <span className="mono" style={{ fontSize: 'var(--text-xl)', fontWeight: 600 }}>
            {formatCurrency(income)}
          </span>
        </div>
        <div>
          <p className="label-caps" style={{ marginBottom: '0.2rem' }}>Spent</p>
          <span className="mono" style={{ fontSize: 'var(--text-xl)', fontWeight: 600, color: spent > 0 ? 'var(--color-negative)' : 'var(--color-text-primary)' }}>
            {spent > 0 ? formatCurrency(spent) : '$0'}
          </span>
        </div>
        <div>
          <p className="label-caps" style={{ marginBottom: '0.2rem' }}>{overspent ? 'Overspent' : 'Remaining'}</p>
          <span className="mono" style={{ fontSize: 'var(--text-xl)', fontWeight: 600, color: overspent ? 'var(--color-negative)' : 'var(--color-positive)' }}>
            {formatCurrency(Math.abs(remaining))}
          </span>
        </div>
      </div>

      {overspent && (
        <p style={{ textAlign: 'center', marginTop: '0.75rem', fontSize: 'var(--text-sm)', color: 'var(--color-negative)' }}>
          You've spent {formatCurrency(Math.abs(remaining))} more than your income this month.
        </p>
      )}
    </div>
  )
}
