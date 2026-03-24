import { useState, useEffect } from 'react'
import useApi, { api } from '../hooks/useApi'
import { formatCurrency } from '../components/NumberDisplay'
import LoadingSpinner from '../components/LoadingSpinner'
import ErrorBanner from '../components/ErrorBanner'

export default function DebtPlanner() {
  const { get } = useApi()
  const [debts, setDebts] = useState([])
  const [plan, setPlan] = useState(null)
  const [strategy, setStrategy] = useState('avalanche')
  const [extraPayment, setExtraPayment] = useState('')
  const [loading, setLoading] = useState(true)
  const [planLoading, setPlanLoading] = useState(false)
  const [error, setError] = useState(null)
  const [form, setForm] = useState({ name: '', balance: '', interest_rate: '', min_payment: '' })

  const fetchDebts = async () => {
    setLoading(true)
    try {
      const res = await get('/api/debt')
      setDebts(res.data)
    } catch (err) {
      setError(err.message)
    }
    setLoading(false)
  }

  const calculatePlan = async () => {
    if (debts.length === 0) { setPlan(null); return }
    setPlanLoading(true)
    try {
      const res = await api.post('/api/debt/plan', {
        strategy,
        extra_payment: parseFloat(extraPayment) || 0,
      })
      setPlan(res.data.data)
    } catch (err) {
      console.error(err)
    }
    setPlanLoading(false)
  }

  useEffect(() => { fetchDebts() }, [])
  useEffect(() => { if (debts.length > 0) calculatePlan() }, [debts, strategy, extraPayment])

  const addDebt = async (e) => {
    e.preventDefault()
    if (!form.name || !form.balance || form.interest_rate === '' || !form.min_payment) return
    try {
      await api.post('/api/debt', {
        name: form.name,
        balance: parseFloat(form.balance),
        interest_rate: parseFloat(form.interest_rate),
        min_payment: parseFloat(form.min_payment),
      })
      setForm({ name: '', balance: '', interest_rate: '', min_payment: '' })
      fetchDebts()
    } catch (err) {
      console.error(err)
    }
  }

  const deleteDebt = async (id) => {
    try {
      await api.delete(`/api/debt/${id}`)
      fetchDebts()
    } catch (err) {
      console.error(err)
    }
  }

  const formatMonths = (months) => {
    if (months >= 600) return '50+ years'
    const years = Math.floor(months / 12)
    const mo = months % 12
    if (years === 0) return `${mo} months`
    if (mo === 0) return `${years} year${years > 1 ? 's' : ''}`
    return `${years}y ${mo}m`
  }

  const formatDate = (iso) => {
    const d = new Date(iso)
    return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  }

  if (loading) return <LoadingSpinner height={200} />
  if (error) return <ErrorBanner message={error} onRetry={fetchDebts} />

  const totalDebt = debts.reduce((s, d) => s + d.balance, 0)

  return (
    <div>
      <h1 style={{ fontSize: '1.75rem', marginBottom: '1.5rem' }}>Debt Planner</h1>

      {/* Add Debt Form */}
      <div className="card" style={{ marginBottom: '1rem' }}>
        <h3 style={{ fontSize: '0.95rem', marginBottom: '0.75rem' }}>Add a Debt</h3>
        <form onSubmit={addDebt} style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ flex: '1 1 140px' }}>
            <label style={{ display: 'block', color: 'var(--color-text-faint)', fontSize: '0.7rem', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Name</label>
            <input className="input" placeholder="e.g. Visa Card" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          </div>
          <div style={{ flex: '0 1 110px' }}>
            <label style={{ display: 'block', color: 'var(--color-text-faint)', fontSize: '0.7rem', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Balance</label>
            <input className="input" type="number" step="0.01" placeholder="$0" value={form.balance} onChange={e => setForm(f => ({ ...f, balance: e.target.value }))} />
          </div>
          <div style={{ flex: '0 1 90px' }}>
            <label style={{ display: 'block', color: 'var(--color-text-faint)', fontSize: '0.7rem', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.05em' }}>APR %</label>
            <input className="input" type="number" step="0.1" placeholder="0%" value={form.interest_rate} onChange={e => setForm(f => ({ ...f, interest_rate: e.target.value }))} />
          </div>
          <div style={{ flex: '0 1 110px' }}>
            <label style={{ display: 'block', color: 'var(--color-text-faint)', fontSize: '0.7rem', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Min Payment</label>
            <input className="input" type="number" step="0.01" placeholder="$0" value={form.min_payment} onChange={e => setForm(f => ({ ...f, min_payment: e.target.value }))} />
          </div>
          <button className="btn btn-primary" type="submit" style={{ height: 36 }}>Add</button>
        </form>
      </div>

      {/* Current Debts */}
      {debts.length > 0 && (
        <div className="card" style={{ marginBottom: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <h3 style={{ fontSize: '0.95rem' }}>Your Debts</h3>
            <span className="mono" style={{ fontSize: '1.1rem', color: 'var(--color-danger)', fontWeight: 600 }}>
              Total: {formatCurrency(totalDebt)}
            </span>
          </div>
          {debts.map(d => (
            <div key={d.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0', borderBottom: '1px solid var(--color-border)' }}>
              <div>
                <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>{d.name}</span>
                <span className="text-faint" style={{ fontSize: '0.75rem', marginLeft: '0.5rem' }}>{d.interest_rate}% APR</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span className="mono" style={{ fontSize: '0.85rem', color: 'var(--color-danger)' }}>{formatCurrency(d.balance)}</span>
                <span className="text-faint" style={{ fontSize: '0.75rem' }}>{formatCurrency(d.min_payment)}/mo</span>
                <button onClick={() => deleteDebt(d.id)} style={{
                  background: 'none', border: '1px solid var(--color-success)', color: 'var(--color-success)',
                  cursor: 'pointer', fontSize: '0.7rem', padding: '0.25rem 0.5rem', borderRadius: 2,
                  fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em',
                  transition: 'all 0.1s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--color-success)'; e.currentTarget.style.color = '#fff' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--color-success)' }}
                >
                  Paid Off
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Strategy & Extra Payment */}
      {debts.length > 0 && (
        <div className="card" style={{ marginBottom: '1rem' }}>
          <div className="grid-2">
            <div>
              <label style={{ display: 'block', color: 'var(--color-text-muted)', fontSize: '0.75rem', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Payoff Strategy</label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  onClick={() => setStrategy('avalanche')}
                  className={strategy === 'avalanche' ? 'btn btn-primary' : 'btn btn-ghost'}
                  style={{ flex: 1 }}
                >
                  Avalanche
                </button>
                <button
                  onClick={() => setStrategy('snowball')}
                  className={strategy === 'snowball' ? 'btn btn-primary' : 'btn btn-ghost'}
                  style={{ flex: 1 }}
                >
                  Snowball
                </button>
              </div>
              <p className="text-faint" style={{ fontSize: '0.72rem', marginTop: '0.35rem' }}>
                {strategy === 'avalanche'
                  ? 'Highest interest first — saves the most money'
                  : 'Smallest balance first — quick wins to stay motivated'}
              </p>
            </div>
            <div>
              <label style={{ display: 'block', color: 'var(--color-text-muted)', fontSize: '0.75rem', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Extra Monthly Payment</label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-faint)' }}>$</span>
                <input
                  className="input"
                  type="number"
                  step="10"
                  placeholder="0"
                  value={extraPayment}
                  onChange={e => setExtraPayment(e.target.value)}
                  style={{ paddingLeft: '1.5rem' }}
                />
              </div>
              <p className="text-faint" style={{ fontSize: '0.72rem', marginTop: '0.35rem' }}>
                Extra money toward debt each month on top of minimums
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Payoff Plan Results */}
      {planLoading && <LoadingSpinner height={100} />}

      {plan && !planLoading && (
        <>
          {/* Summary Cards */}
          <div className="grid-3" style={{ marginBottom: '1rem' }}>
            <div className="card" style={{ textAlign: 'center' }}>
              <h4 style={{ color: 'var(--color-text-muted)', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.35rem' }}>Total Interest</h4>
              <span className="mono" style={{ fontSize: '1.4rem', color: 'var(--color-danger)' }}>
                {formatCurrency(plan.totalInterest)}
              </span>
            </div>
            <div className="card" style={{ textAlign: 'center' }}>
              <h4 style={{ color: 'var(--color-text-muted)', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.35rem' }}>Debt-Free By</h4>
              <span className="mono" style={{ fontSize: '1.4rem', color: '#1B2A4A' }}>
                {formatDate(plan.debtFreeDate)}
              </span>
              <p className="text-faint" style={{ fontSize: '0.72rem' }}>{formatMonths(plan.monthsToFreedom)}</p>
            </div>
            <div className="card" style={{ textAlign: 'center' }}>
              <h4 style={{ color: 'var(--color-text-muted)', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.35rem' }}>
                {plan.interestSaved > 0 ? 'You Save' : 'Extra Payment'}
              </h4>
              {plan.interestSaved > 0 ? (
                <>
                  <span className="mono" style={{ fontSize: '1.4rem', color: 'var(--color-success)' }}>
                    {formatCurrency(plan.interestSaved)}
                  </span>
                  <p className="text-faint" style={{ fontSize: '0.72rem' }}>{plan.monthsSaved} months sooner</p>
                </>
              ) : (
                <span className="text-faint" style={{ fontSize: '0.9rem' }}>Add extra $ above to see savings</span>
              )}
            </div>
          </div>

          {/* Debt-by-Debt Breakdown */}
          <div className="card" style={{ marginBottom: '1rem' }}>
            <h3 style={{ fontSize: '0.95rem', marginBottom: '0.75rem' }}>Payoff Order ({strategy === 'avalanche' ? 'Highest Interest First' : 'Smallest Balance First'})</h3>
            {plan.debts.map(d => (
              <div key={d.name} style={{ padding: '0.65rem 0', borderBottom: '1px solid var(--color-border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{
                      width: 24, height: 24, borderRadius: '50%', background: '#1B2A4A', color: '#C9A84C',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 700, flexShrink: 0
                    }}>
                      {d.order}
                    </span>
                    <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>{d.name}</span>
                  </div>
                  <span className="mono" style={{ fontSize: '0.85rem' }}>{formatCurrency(d.originalBalance)} @ {d.interestRate}%</span>
                </div>
                <div style={{ display: 'flex', gap: '1.5rem', paddingLeft: 34, fontSize: '0.8rem' }}>
                  <span className="text-muted">{formatCurrency(d.monthlyPayment)}/mo</span>
                  <span className="text-muted">Paid off in {formatMonths(d.monthsToPayoff)}</span>
                  <span style={{ color: 'var(--color-danger)' }}>Interest: {formatCurrency(d.totalInterest)}</span>
                </div>
              </div>
            ))}
          </div>

          {/* AI Summary */}
          {plan.aiSummary && (
            <div className="card">
              <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', lineHeight: 1.6 }}>
                {plan.aiSummary}
              </p>
            </div>
          )}
        </>
      )}

      {/* Empty state */}
      {debts.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: '2rem' }}>
          <p className="text-muted" style={{ fontSize: '0.9rem' }}>Add your debts above to see your payoff plan.</p>
          <p className="text-faint" style={{ fontSize: '0.8rem', marginTop: '0.5rem' }}>Credit cards, student loans, car loans, mortgage — anything you owe.</p>
        </div>
      )}
    </div>
  )
}
