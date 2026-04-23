import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import useApi, { api } from '../hooks/useApi'
import { useToast } from '../components/Toast'
import { formatCurrency } from '../components/NumberDisplay'
import LoadingSpinner from '../components/LoadingSpinner'
import ConfirmDialog from '../components/ConfirmDialog'
import PageChat from '../components/PageChat'

function formatMonths(months) {
  if (months >= 600) return '50+ years'
  const years = Math.floor(months / 12)
  const mo = months % 12
  if (years === 0) return `${mo} months`
  if (mo === 0) return `${years} year${years > 1 ? 's' : ''}`
  return `${years}y ${mo}m`
}

function formatDebtDate(iso) {
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

export default function Debt() {
  const { get, post, del } = useApi()
  const { toast } = useToast()
  const navigate = useNavigate()

  const [debts, setDebts] = useState([])
  const [loading, setLoading] = useState(true)
  const [debtPlan, setDebtPlan] = useState(null)
  const [debtPlanLoading, setDebtPlanLoading] = useState(false)
  const [debtStrategy, setDebtStrategy] = useState(() => localStorage.getItem('atlas_debt_strategy') || 'avalanche')
  const [extraPayment, setExtraPayment] = useState('')
  const [expandedDebt, setExpandedDebt] = useState(null)
  const [debtForm, setDebtForm] = useState({ name: '', balance: '', interest_rate: '', min_payment: '' })
  const [allocationLocked, setAllocationLocked] = useState(true)
  const [confirmDialog, setConfirmDialog] = useState({ open: false, title: '', message: '', onConfirm: () => {}, danger: false })

  const now = new Date()
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  const totalDebt = debts.reduce((s, d) => s + d.balance, 0)

  const fetchDebts = async () => {
    try {
      const res = await get('/api/debt')
      setDebts(res.data)
    } catch (err) { toast(err.message || 'Failed to load debts', 'error') }
    setLoading(false)
  }

  const calculatePlan = async (debtList) => {
    const list = debtList || debts
    if (list.length === 0) { setDebtPlan(null); return }
    setDebtPlanLoading(true)
    try {
      const res = await post('/api/debt/plan', { strategy: debtStrategy, extra_payment: parseFloat(extraPayment) || 0 })
      setDebtPlan(res.data)
    } catch (err) { toast(err.message || 'Plan calculation failed', 'error') }
    setDebtPlanLoading(false)
  }

  const addDebt = async (e) => {
    e.preventDefault()
    if (!debtForm.name || !debtForm.balance || debtForm.interest_rate === '' || !debtForm.min_payment) return
    try {
      await post('/api/debt', {
        name: debtForm.name,
        balance: parseFloat(debtForm.balance),
        interest_rate: parseFloat(debtForm.interest_rate),
        min_payment: parseFloat(debtForm.min_payment),
      })
      setDebtForm({ name: '', balance: '', interest_rate: '', min_payment: '' })
      fetchDebts()
    } catch (err) { toast(err.message || 'Failed to add debt', 'error') }
  }

  const deleteDebt = (id) => {
    const debt = debts.find(d => d.id === id)
    setConfirmDialog({
      open: true, danger: false,
      title: 'Mark as Paid Off',
      message: `Mark "${debt?.name || 'this debt'}" as paid off?`,
      onConfirm: async () => {
        setConfirmDialog(d => ({ ...d, open: false }))
        try {
          await del(`/api/debt/${id}`)
          toast('Debt paid off', 'success')
          fetchDebts()
          api.post('/api/badges/check').catch(() => {})
        } catch (err) { toast(err.message || 'Failed to remove debt', 'error') }
      }
    })
  }

  useEffect(() => {
    fetchDebts()
    // Check if allocation is locked for this month
    get(`/api/budget/overview?month=${monthKey}`)
      .then(res => setAllocationLocked(!!res.data?.allocation_locked))
      .catch(() => {})
  }, [])
  useEffect(() => { if (debts.length > 0) calculatePlan() }, [debts, debtStrategy, extraPayment])
  useEffect(() => { localStorage.setItem('atlas_debt_strategy', debtStrategy) }, [debtStrategy])

  if (loading) return <LoadingSpinner height={300} />

  return (
    <div>
      <ConfirmDialog {...confirmDialog} onCancel={() => setConfirmDialog(d => ({ ...d, open: false }))} />

      {/* Allocation not set prompt */}
      {!allocationLocked && (
        <div className="card" style={{
          marginBottom: 'var(--space-lg)',
          padding: '1.25rem',
          background: 'var(--color-gold-10)',
          border: '1px solid var(--color-gold-30)',
          textAlign: 'center',
        }}>
          <p style={{ fontSize: 'var(--text-base)', fontWeight: 500, color: 'var(--color-text-primary)', marginBottom: '0.25rem' }}>
            Complete your monthly setup
          </p>
          <p className="text-faint" style={{ fontSize: 'var(--text-sm)', marginBottom: '0.75rem' }}>
            Set your income and spending allocation on the Budget page to see how debt payments fit into your monthly plan.
          </p>
          <button className="btn btn-primary" onClick={() => navigate('/budget')}>Go to Budget</button>
        </div>
      )}

      {/* Add Debt Form */}
      <div className="card" style={{ marginBottom: 'var(--space-lg)' }}>
        <h3 style={{ fontSize: 'var(--text-lg)', marginBottom: '0.75rem' }}>Add a Debt</h3>
        <form onSubmit={addDebt} style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ flex: '1 1 140px' }}>
            <label className="label-caps" style={{ display: 'block', marginBottom: 3 }}>Name</label>
            <input className="input" placeholder="e.g. Visa Card" value={debtForm.name} onChange={e => setDebtForm(f => ({ ...f, name: e.target.value }))} />
          </div>
          <div style={{ flex: '0 1 110px' }}>
            <label className="label-caps" style={{ display: 'block', marginBottom: 3 }}>Balance</label>
            <input className="input" type="number" step="0.01" placeholder="$0" value={debtForm.balance} onChange={e => setDebtForm(f => ({ ...f, balance: e.target.value }))} />
          </div>
          <div style={{ flex: '0 1 90px' }}>
            <label className="label-caps" style={{ display: 'block', marginBottom: 3 }}>APR %</label>
            <input className="input" type="number" step="0.1" placeholder="0%" value={debtForm.interest_rate} onChange={e => setDebtForm(f => ({ ...f, interest_rate: e.target.value }))} />
          </div>
          <div style={{ flex: '0 1 110px' }}>
            <label className="label-caps" style={{ display: 'block', marginBottom: 3 }}>Min Payment</label>
            <input className="input" type="number" step="0.01" placeholder="$0" value={debtForm.min_payment} onChange={e => setDebtForm(f => ({ ...f, min_payment: e.target.value }))} />
          </div>
          <button className="btn btn-primary" type="submit" style={{ height: 36 }}>Add</button>
        </form>
      </div>

      {/* Strategy & Extra Payment */}
      {debts.length > 0 && (
        <div className="card" style={{ marginBottom: 'var(--space-lg)' }}>
          <div className="grid-2">
            <div>
              <label className="label-caps" style={{ display: 'block', marginBottom: '0.5rem' }}>Payoff Strategy</label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button onClick={() => setDebtStrategy('avalanche')} className={debtStrategy === 'avalanche' ? 'btn btn-primary' : 'btn btn-ghost'} style={{ flex: 1 }}>Avalanche</button>
                <button onClick={() => setDebtStrategy('snowball')} className={debtStrategy === 'snowball' ? 'btn btn-primary' : 'btn btn-ghost'} style={{ flex: 1 }}>Snowball</button>
              </div>
              <p className="text-faint" style={{ fontSize: 'var(--text-sm)', marginTop: '0.35rem' }}>
                {debtStrategy === 'avalanche' ? 'Highest interest first — saves the most money' : 'Smallest balance first — quick wins to stay motivated'}
              </p>
            </div>
            <div>
              <label className="label-caps" style={{ display: 'block', marginBottom: '0.5rem' }}>Extra Monthly Payment</label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }}>$</span>
                <input className="input" type="number" step="10" placeholder="0" value={extraPayment} onChange={e => setExtraPayment(e.target.value)} style={{ paddingLeft: '1.5rem' }} />
              </div>
              <p className="text-faint" style={{ fontSize: 'var(--text-sm)', marginTop: '0.35rem' }}>Extra money on top of minimums each month</p>
            </div>
          </div>
        </div>
      )}

      {/* Plan Summary */}
      {debtPlanLoading && <LoadingSpinner height={100} />}

      {debtPlan && !debtPlanLoading && (
        <div className="grid-3" style={{ marginBottom: 'var(--space-lg)' }}>
          <div className="card" style={{ textAlign: 'center' }}>
            <p className="label-caps" style={{ marginBottom: '0.35rem' }}>Total Interest</p>
            <span className="mono" style={{ fontSize: 'var(--text-2xl)', color: 'var(--color-negative)' }}>{formatCurrency(debtPlan.totalInterest)}</span>
          </div>
          <div className="card" style={{ textAlign: 'center' }}>
            <p className="label-caps" style={{ marginBottom: '0.35rem' }}>Debt-Free By</p>
            <span className="mono" style={{ fontSize: 'var(--text-2xl)', color: 'var(--color-navy)' }}>{formatDebtDate(debtPlan.debtFreeDate)}</span>
            <p className="text-faint" style={{ fontSize: 'var(--text-sm)' }}>{formatMonths(debtPlan.monthsToFreedom)}</p>
          </div>
          <div className="card" style={{ textAlign: 'center' }}>
            <p className="label-caps" style={{ marginBottom: '0.35rem' }}>{debtPlan.interestSaved > 0 ? 'You Save' : 'Extra Payment'}</p>
            {debtPlan.interestSaved > 0 ? (
              <>
                <span className="mono" style={{ fontSize: 'var(--text-2xl)', color: 'var(--color-positive)' }}>{formatCurrency(debtPlan.interestSaved)}</span>
                <p className="text-faint" style={{ fontSize: 'var(--text-sm)' }}>{debtPlan.monthsSaved} months sooner</p>
              </>
            ) : (
              <span className="text-faint" style={{ fontSize: 'var(--text-base)' }}>Add extra $ to see savings</span>
            )}
          </div>
        </div>
      )}

      {/* Debts List */}
      {debts.length > 0 && (
        <div className="card" style={{ marginBottom: 'var(--space-lg)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <h3 style={{ fontSize: 'var(--text-lg)' }}>Your Debts</h3>
            <span className="mono" style={{ fontSize: 'var(--text-xl)', color: 'var(--color-negative)', fontWeight: 600 }}>Total: {formatCurrency(totalDebt)}</span>
          </div>
          {debts.map(d => {
            const isExpanded = expandedDebt === d.id
            const planData = debtPlan?.debts?.find(pd => pd.id === d.id)
            const origAmt = d.original_amount || d.balance
            const paidOff = origAmt > 0 ? Math.max(0, origAmt - d.balance) : 0
            const debtPct = origAmt > 0 ? Math.min(100, (paidOff / origAmt) * 100) : 0
            const isFullyPaid = d.balance <= 0
            return (
              <div key={d.id} style={{
                borderBottom: '1px solid var(--color-border)',
                background: isExpanded ? 'var(--color-surface-2)' : 'transparent',
                margin: '0 -1.5rem', padding: '0 1.5rem',
                transition: 'background 0.15s',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.6rem 0' }}>
                  <div onClick={() => setExpandedDebt(isExpanded ? null : d.id)} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1 }}>
                    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', transform: isExpanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s', display: 'inline-block' }}>&#9654;</span>
                    <span style={{ fontSize: 'var(--text-base)', fontWeight: 500, color: 'var(--color-gold)' }}>{d.name}</span>
                    <span className="text-faint" style={{ fontSize: 'var(--text-sm)' }}>{d.interest_rate}% APR</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {isFullyPaid ? (
                      <span className="mono" style={{ color: 'var(--color-positive)', fontWeight: 600 }}>Paid off</span>
                    ) : (
                      <>
                        <span className="mono" style={{ color: 'var(--color-negative)' }}>{formatCurrency(d.balance)}</span>
                        <span className="text-faint" style={{ fontSize: 'var(--text-sm)' }}>{formatCurrency(d.min_payment)}/mo</span>
                      </>
                    )}
                    <button className="btn btn-ghost" onClick={() => deleteDebt(d.id)} style={{ fontSize: 'var(--text-xs)', padding: '0.2rem 0.5rem' }}>Paid Off</button>
                  </div>
                </div>
                <div style={{ padding: '0 0 0.6rem 0' }}>
                  <div className="progress-bar" style={{ height: 6 }}>
                    <div className="progress-bar-fill" style={{ width: `${debtPct}%`, background: isFullyPaid ? 'var(--color-positive)' : 'var(--color-navy)' }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.2rem' }}>
                    <span className="text-faint" style={{ fontSize: 'var(--text-xs)' }}>{isFullyPaid ? 'Paid off' : `${debtPct.toFixed(0)}% paid`}</span>
                    <span className="text-faint mono" style={{ fontSize: 'var(--text-xs)' }}>{formatCurrency(paidOff)} of {formatCurrency(origAmt)}</span>
                  </div>
                </div>

                {isExpanded && planData && (
                  <div style={{ padding: '0 0 1rem 1.5rem' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem', marginBottom: '0.75rem' }}>
                      {[
                        { label: 'Monthly Payment', value: formatCurrency(planData.monthlyPayment) },
                        { label: 'Payoff Timeline', value: formatMonths(planData.monthsToPayoff) },
                        { label: 'Total Interest', value: formatCurrency(planData.totalInterest), color: 'var(--color-negative)' },
                      ].map(({ label, value, color }) => (
                        <div key={label} style={{ padding: '0.75rem', background: 'var(--color-surface)', borderRadius: 2, border: '1px solid var(--color-border)' }}>
                          <p className="label-caps" style={{ marginBottom: '0.25rem' }}>{label}</p>
                          <span className="mono" style={{ fontSize: 'var(--text-xl)', fontWeight: 600, color }}>{value}</span>
                        </div>
                      ))}
                    </div>
                    <div style={{ display: 'flex', gap: '1rem', fontSize: 'var(--text-sm)' }}>
                      <span className="text-muted">Payoff order: <strong>#{planData.order}</strong></span>
                      <span className="text-muted">Original: <strong className="mono">{formatCurrency(planData.originalBalance)}</strong></span>
                    </div>
                  </div>
                )}

                {isExpanded && !planData && debtPlanLoading && (
                  <div style={{ padding: '0.5rem 0 1rem 1.5rem' }}><LoadingSpinner height={40} /></div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* AI Summary */}
      {debtPlan && !debtPlanLoading && debtPlan.aiSummary && (
        <div className="card" style={{ marginBottom: 'var(--space-lg)' }}>
          <p style={{ fontSize: 'var(--text-base)', color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>{debtPlan.aiSummary}</p>
        </div>
      )}

      {/* Empty state */}
      {debts.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: '2rem', marginBottom: 'var(--space-lg)' }}>
          <p className="text-muted" style={{ fontSize: 'var(--text-base)' }}>Add your debts above to see your payoff plan.</p>
          <p className="text-faint" style={{ fontSize: 'var(--text-sm)', marginTop: '0.5rem' }}>Credit cards, student loans, car loans — anything you owe.</p>
        </div>
      )}

      {/* Chat */}
      <PageChat
        context="debt"
        systemContext={`User has ${debts.length} debts totaling ${formatCurrency(totalDebt)}. Strategy: ${debtStrategy}. Extra payment: $${extraPayment || 0}/mo.${debtPlan ? ` Debt-free in ${formatMonths(debtPlan.monthsToFreedom)}. Total interest: ${formatCurrency(debtPlan.totalInterest)}.` : ''}`}
        suggestedPrompts={[
          'Should I use avalanche or snowball?',
          'How much faster can I pay off if I add $200/mo?',
          'Which debt should I focus on first?',
        ]}
      />
    </div>
  )
}
