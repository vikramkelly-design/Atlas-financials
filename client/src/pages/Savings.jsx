import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import useApi from '../hooks/useApi'
import { useToast } from '../components/Toast'
import { formatCurrency } from '../components/NumberDisplay'
import LoadingSpinner from '../components/LoadingSpinner'
import ConfirmDialog from '../components/ConfirmDialog'
import PageChat from '../components/PageChat'

export default function Savings() {
  const { get, post, del } = useApi()
  const { toast } = useToast()
  const navigate = useNavigate()

  const [savingsData, setSavingsData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [depositedThisMonth, setDepositedThisMonth] = useState(false)
  const [depositing, setDepositing] = useState(false)
  const [graduating, setGraduating] = useState(false)
  const [buckets, setBuckets] = useState([])
  const [newBucketName, setNewBucketName] = useState('')
  const [newBucketTarget, setNewBucketTarget] = useState('')
  const [bucketDepositId, setBucketDepositId] = useState(null)
  const [bucketDepositAmt, setBucketDepositAmt] = useState('')
  const [debts, setDebts] = useState([])
  const [allocationLocked, setAllocationLocked] = useState(true)
  const [confirmDialog, setConfirmDialog] = useState({ open: false, title: '', message: '', onConfirm: () => {}, danger: false })

  const now = new Date()
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  const fetchAll = useCallback(async () => {
    try {
      const [savRes, depRes, buckRes, debtRes, budgetRes] = await Promise.allSettled([
        get('/api/savings'),
        get(`/api/savings/deposited?month=${monthKey}`),
        get('/api/savings/buckets'),
        get('/api/debt'),
        get(`/api/budget/overview?month=${monthKey}`),
      ])
      if (savRes.status === 'fulfilled') setSavingsData(savRes.value.data)
      if (depRes.status === 'fulfilled') setDepositedThisMonth(depRes.value.data?.deposited || false)
      if (buckRes.status === 'fulfilled') setBuckets(buckRes.value.data || [])
      if (debtRes.status === 'fulfilled') setDebts(debtRes.value.data || [])
      if (budgetRes.status === 'fulfilled') setAllocationLocked(!!budgetRes.value.data?.allocation_locked)
    } catch (err) { toast(err.message || 'Failed to load savings', 'error') }
    setLoading(false)
  }, [monthKey])

  useEffect(() => { fetchAll() }, [fetchAll])

  const logDeposit = async () => {
    if (!savingsData || depositedThisMonth) return
    setDepositing(true)
    try {
      await post('/api/savings/deposit', { amount: savingsData.savings_amt, note: `${monthKey} savings deposit` })
      toast('Savings deposited', 'success')
      fetchAll()
    } catch (err) { toast(err.response?.data?.error || err.message, 'error') }
    setDepositing(false)
  }

  const graduate = async () => {
    setGraduating(true)
    try {
      await post('/api/savings/graduate', {})
      toast('Savings allocation moved to investing', 'success')
      fetchAll()
    } catch (err) { toast(err.message, 'error') }
    setGraduating(false)
  }

  const createBucket = async () => {
    if (!newBucketName.trim()) return
    try {
      await post('/api/savings/buckets', { name: newBucketName.trim(), target_amount: parseFloat(newBucketTarget) || 0 })
      setNewBucketName('')
      setNewBucketTarget('')
      toast('Bucket created', 'success')
      fetchAll()
    } catch (err) { toast(err.response?.data?.error || err.message, 'error') }
  }

  const depositToBucket = async (id) => {
    const amt = parseFloat(bucketDepositAmt)
    if (!amt || amt <= 0) return
    try {
      await post(`/api/savings/buckets/${id}/deposit`, { amount: amt })
      setBucketDepositId(null)
      setBucketDepositAmt('')
      toast('Deposited to bucket', 'success')
      fetchAll()
    } catch (err) { toast(err.response?.data?.error || err.message, 'error') }
  }

  const deleteBucket = (id) => {
    const b = buckets.find(x => x.id === id)
    setConfirmDialog({
      open: true, danger: true,
      title: 'Delete Bucket',
      message: `Delete "${b?.name}"? Any funds return to your savings balance.`,
      onConfirm: async () => {
        setConfirmDialog(d => ({ ...d, open: false }))
        try {
          await del(`/api/savings/buckets/${id}`)
          toast('Bucket deleted', 'success')
          fetchAll()
        } catch (err) { toast(err.message, 'error') }
      }
    })
  }

  const payDebt = async (debtId, amount) => {
    try {
      await post('/api/savings/pay-debt', { debt_id: debtId, amount })
      toast('Debt payment applied', 'success')
      fetchAll()
    } catch (err) { toast(err.response?.data?.error || err.message, 'error') }
  }

  if (loading) return <LoadingSpinner height={300} />

  if (!savingsData || !savingsData.monthly_income) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: 'var(--space-2xl) var(--space-lg)' }}>
        <h2 style={{ fontSize: 'var(--text-xl)', marginBottom: '0.35rem' }}>Set up your budget first</h2>
        <p className="text-faint" style={{ fontSize: 'var(--text-sm)', marginBottom: 'var(--space-md)' }}>
          Head to the Budget page and set your monthly income and allocation to start tracking savings.
        </p>
        <button className="btn btn-primary" onClick={() => navigate('/budget')}>Go to Budget</button>
      </div>
    )
  }

  const { monthly_income, spend_pct, savings_pct, invest_pct, spend_amt, savings_amt, invest_amt, ef_balance, ef_target, ef_pct, emergency_fund_complete } = savingsData
  const totalDebt = debts.reduce((s, d) => s + d.balance, 0)
  const efMonths = savings_amt > 0 && ef_target > ef_balance ? Math.ceil((ef_target - ef_balance) / savings_amt) : 0

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
            Head to the Budget page to set your income and allocation for this month. Your savings, spending, and investment splits will appear here once set.
          </p>
          <button className="btn btn-primary" onClick={() => navigate('/budget')}>Go to Budget</button>
        </div>
      )}

      {/* Allocation Overview */}
      {allocationLocked && (
      <div className="card" style={{ marginBottom: 'var(--space-lg)' }}>
        <h3 style={{ fontSize: 'var(--text-lg)', marginBottom: '0.75rem' }}>Monthly Allocation</h3>
        <div style={{ display: 'flex', height: 10, borderRadius: 5, overflow: 'hidden', marginBottom: '0.75rem' }}>
          {spend_pct > 0 && <div style={{ width: `${spend_pct}%`, background: 'var(--color-negative)' }} />}
          {savings_pct > 0 && <div style={{ width: `${savings_pct}%`, background: 'var(--color-gold)' }} />}
          {invest_pct > 0 && <div style={{ width: `${invest_pct}%`, background: 'var(--color-positive)' }} />}
        </div>
        <div className="grid-3" style={{ textAlign: 'center' }}>
          <div>
            <p className="label-caps" style={{ marginBottom: '0.2rem' }}>Spending</p>
            <span className="mono" style={{ fontWeight: 600 }}>{formatCurrency(spend_amt)}</span>
            <span className="text-faint" style={{ fontSize: 'var(--text-xs)', marginLeft: 4 }}>{spend_pct}%</span>
          </div>
          <div>
            <p className="label-caps" style={{ marginBottom: '0.2rem' }}>Savings</p>
            <span className="mono" style={{ fontWeight: 600, color: 'var(--color-gold)' }}>{formatCurrency(savings_amt)}</span>
            <span className="text-faint" style={{ fontSize: 'var(--text-xs)', marginLeft: 4 }}>{savings_pct}%</span>
          </div>
          <div>
            <p className="label-caps" style={{ marginBottom: '0.2rem' }}>Investing</p>
            <span className="mono" style={{ fontWeight: 600, color: 'var(--color-positive)' }}>{formatCurrency(invest_amt)}</span>
            <span className="text-faint" style={{ fontSize: 'var(--text-xs)', marginLeft: 4 }}>{invest_pct}%</span>
          </div>
        </div>
      </div>
      )}

      {/* Emergency Fund */}
      <div className="card" style={{ marginBottom: 'var(--space-lg)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
          <h3 style={{ fontSize: 'var(--text-lg)' }}>Emergency Fund</h3>
          <span className="mono" style={{ fontSize: 'var(--text-lg)', fontWeight: 600, color: emergency_fund_complete ? 'var(--color-positive)' : 'var(--color-gold)' }}>
            {formatCurrency(ef_balance)} <span className="text-faint" style={{ fontSize: 'var(--text-sm)', fontWeight: 400 }}>/ {formatCurrency(ef_target)}</span>
          </span>
        </div>
        <div className="progress-bar" style={{ height: 8, marginBottom: '0.5rem' }}>
          <div className="progress-bar-fill" style={{ width: `${Math.min(100, ef_pct)}%`, background: emergency_fund_complete ? 'var(--color-positive)' : 'var(--color-gold)' }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="text-faint" style={{ fontSize: 'var(--text-sm)' }}>
            {emergency_fund_complete ? 'Emergency fund complete' : `${ef_pct.toFixed(0)}% funded — ${efMonths > 0 ? `~${efMonths} month${efMonths !== 1 ? 's' : ''} to go` : 'keep going'}`}
          </span>
          {!depositedThisMonth && savings_amt > 0 && (
            <button className="btn btn-primary" onClick={logDeposit} disabled={depositing} style={{ fontSize: 'var(--text-sm)', padding: '0.3rem 0.75rem' }}>
              {depositing ? 'Depositing...' : `Log ${formatCurrency(savings_amt)} Savings`}
            </button>
          )}
          {depositedThisMonth && <span className="text-faint" style={{ fontSize: 'var(--text-sm)' }}>Savings logged this month</span>}
        </div>
        {emergency_fund_complete && savings_pct > 0 && (
          <button className="btn btn-ghost" onClick={graduate} disabled={graduating} style={{ marginTop: '0.75rem', width: '100%', fontSize: 'var(--text-sm)' }}>
            {graduating ? 'Moving...' : 'Move savings allocation to investing'}
          </button>
        )}
      </div>

      {/* Pay Debt from Savings */}
      {debts.length > 0 && ef_balance > 0 && (
        <div className="card" style={{ marginBottom: 'var(--space-lg)' }}>
          <h3 style={{ fontSize: 'var(--text-lg)', marginBottom: '0.75rem' }}>Pay Down Debt</h3>
          <p className="text-faint" style={{ fontSize: 'var(--text-sm)', marginBottom: '0.75rem' }}>
            Use your savings balance ({formatCurrency(ef_balance)}) to make extra payments.
          </p>
          {debts.filter(d => d.balance > 0).map(d => (
            <div key={d.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0', borderBottom: '1px solid var(--color-border)' }}>
              <div>
                <span style={{ fontWeight: 500 }}>{d.name}</span>
                <span className="text-faint mono" style={{ fontSize: 'var(--text-sm)', marginLeft: '0.5rem' }}>{formatCurrency(d.balance)}</span>
              </div>
              <button
                className="btn btn-ghost"
                onClick={() => payDebt(d.id, Math.min(d.balance, ef_balance))}
                style={{ fontSize: 'var(--text-sm)', padding: '0.25rem 0.6rem' }}
              >
                Pay {formatCurrency(Math.min(d.balance, ef_balance))}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Savings Buckets */}
      <div className="card" style={{ marginBottom: 'var(--space-lg)' }}>
        <h3 style={{ fontSize: 'var(--text-lg)', marginBottom: '0.75rem' }}>Savings Buckets</h3>
        {buckets.length > 0 ? (
          <div style={{ marginBottom: '0.75rem' }}>
            {buckets.map(b => {
              const pct = b.target_amount > 0 ? Math.min(100, (b.current_amount / b.target_amount) * 100) : 0
              return (
                <div key={b.id} style={{ padding: '0.6rem 0', borderBottom: '1px solid var(--color-border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                    <span style={{ fontWeight: 500 }}>{b.name}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span className="mono" style={{ fontSize: 'var(--text-sm)' }}>
                        {formatCurrency(b.current_amount)}{b.target_amount > 0 ? ` / ${formatCurrency(b.target_amount)}` : ''}
                      </span>
                      {bucketDepositId === b.id ? (
                        <div style={{ display: 'flex', gap: '0.25rem' }}>
                          <input className="input mono" type="number" value={bucketDepositAmt} onChange={e => setBucketDepositAmt(e.target.value)}
                            placeholder="$0" style={{ width: 70, fontSize: 'var(--text-xs)', padding: '0.15rem 0.3rem' }} autoFocus />
                          <button className="btn btn-primary" onClick={() => depositToBucket(b.id)} style={{ fontSize: 'var(--text-xs)', padding: '0.15rem 0.4rem' }}>Add</button>
                          <button className="btn btn-ghost" onClick={() => setBucketDepositId(null)} style={{ fontSize: 'var(--text-xs)', padding: '0.15rem 0.3rem' }}>×</button>
                        </div>
                      ) : (
                        <>
                          <button className="btn btn-ghost" onClick={() => { setBucketDepositId(b.id); setBucketDepositAmt('') }} style={{ fontSize: 'var(--text-xs)', padding: '0.2rem 0.4rem' }}>+ Add</button>
                          <button className="btn btn-ghost" onClick={() => deleteBucket(b.id)} style={{ fontSize: 'var(--text-xs)', padding: '0.2rem 0.3rem', color: 'var(--color-text-muted)' }}>×</button>
                        </>
                      )}
                    </div>
                  </div>
                  {b.target_amount > 0 && (
                    <div className="progress-bar" style={{ height: 4 }}>
                      <div className="progress-bar-fill" style={{ width: `${pct}%`, background: pct >= 100 ? 'var(--color-positive)' : 'var(--color-gold)' }} />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        ) : (
          <p className="text-faint" style={{ fontSize: 'var(--text-sm)', marginBottom: '0.75rem' }}>
            {totalDebt > 0 ? 'Pay off all debts to unlock savings buckets.' : 'Create buckets for your savings goals.'}
          </p>
        )}

        {totalDebt <= 0 && (
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end' }}>
            <div style={{ flex: 1 }}>
              <input className="input" value={newBucketName} onChange={e => setNewBucketName(e.target.value)} placeholder="Bucket name" />
            </div>
            <div style={{ width: 100 }}>
              <input className="input mono" type="number" value={newBucketTarget} onChange={e => setNewBucketTarget(e.target.value)} placeholder="Target $" />
            </div>
            <button className="btn btn-primary" onClick={createBucket} style={{ height: 36 }}>Create</button>
          </div>
        )}
      </div>

      {/* Chat */}
      <PageChat
        context="savings"
        systemContext={`Monthly income: ${formatCurrency(monthly_income)}. Allocation: ${spend_pct}% spend, ${savings_pct}% save, ${invest_pct}% invest. Emergency fund: ${formatCurrency(ef_balance)} of ${formatCurrency(ef_target)} (${ef_pct.toFixed(0)}%). ${emergency_fund_complete ? 'EF complete.' : ''} Total debt: ${formatCurrency(totalDebt)}. Buckets: ${buckets.length}.`}
        suggestedPrompts={[
          'How much should I have in my emergency fund?',
          'Should I pay off debt or keep saving?',
          'What should I do with extra money this month?',
        ]}
      />
    </div>
  )
}
