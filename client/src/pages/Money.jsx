import { useState, useEffect, useCallback } from 'react'
import useApi, { api } from '../hooks/useApi'
import { useToast } from '../components/Toast'
import { formatCurrency } from '../components/NumberDisplay'
import LoadingSpinner from '../components/LoadingSpinner'
import ConfirmDialog from '../components/ConfirmDialog'
import AllocationBar from '../components/AllocationBar'
import CollapsibleSection from '../components/CollapsibleSection'

import MonthHeader from './budget/MonthHeader'
import SpendingOverview from './budget/SpendingOverview'
import CategoryGrid from './budget/CategoryGrid'
import TransactionList from './budget/TransactionList'
import ImportModal from './budget/ImportModal'
import BudgetSetup from './budget/BudgetSetup'

const CATEGORIES = ['Food & Dining', 'Transport', 'Shopping', 'Subscriptions', 'Health', 'Entertainment', 'Income', 'Transfer', 'Other']

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

export default function Money() {
  const { get, post, patch, del } = useApi()
  const { toast } = useToast()

  // Scroll to top on mount
  useEffect(() => { window.scrollTo(0, 0) }, [])

  // --- Shared state ---
  const now = new Date()
  const [viewYear, setViewYear] = useState(now.getFullYear())
  const [viewMonth, setViewMonth] = useState(now.getMonth())
  const [loading, setLoading] = useState(true)
  const [confirmDialog, setConfirmDialog] = useState({ open: false, title: '', message: '', onConfirm: () => {}, danger: false })

  // --- Budget state ---
  const [overview, setOverview] = useState(null)
  const [showImport, setShowImport] = useState(false)
  const [showSetup, setShowSetup] = useState(false)
  const [categoryFilter, setCategoryFilter] = useState(null)

  // --- Savings state ---
  const [savingsData, setSavingsData] = useState(null)
  const [depositedThisMonth, setDepositedThisMonth] = useState(false)
  const [depositing, setDepositing] = useState(false)
  const [graduating, setGraduating] = useState(false)
  const [buckets, setBuckets] = useState([])
  const [newBucketName, setNewBucketName] = useState('')
  const [newBucketTarget, setNewBucketTarget] = useState('')
  const [bucketDepositId, setBucketDepositId] = useState(null)
  const [bucketDepositAmt, setBucketDepositAmt] = useState('')

  // --- Debt state ---
  const [debts, setDebts] = useState([])
  const [debtPlan, setDebtPlan] = useState(null)
  const [debtPlanLoading, setDebtPlanLoading] = useState(false)
  const [debtStrategy, setDebtStrategy] = useState(() => localStorage.getItem('atlas_debt_strategy') || 'avalanche')
  const [extraPayment, setExtraPayment] = useState('')
  const [expandedDebt, setExpandedDebt] = useState(null)
  const [debtForm, setDebtForm] = useState({ name: '', balance: '', interest_rate: '', min_payment: '' })

  const monthKey = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}`

  // --- Derived values ---
  const transactions = overview?.transactions || []
  const goals = overview?.goals || {}
  const spending = overview?.spending_by_category || {}
  const income = overview?.income || 0
  const totalSpent = overview?.total_spent || 0
  const remaining = overview?.remaining || 0
  const incomeConfirmed = overview?.income_confirmed || false
  const allocation = overview?.allocation || null
  const allocationLocked = overview?.allocation_locked || false
  const totalDebt = debts.reduce((s, d) => s + d.balance, 0)

  // --- Unified data fetch ---
  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const [budgetRes, savRes, depRes, buckRes, debtRes] = await Promise.allSettled([
        get(`/api/budget/overview?month=${monthKey}`),
        get('/api/savings'),
        get(`/api/savings/deposited?month=${monthKey}`),
        get('/api/savings/buckets'),
        get('/api/debt'),
      ])
      if (budgetRes.status === 'fulfilled') {
        const data = budgetRes.value.data
        setOverview(data)
        if (data.income && data.income_confirmed && data.allocation_locked && Object.keys(data.goals || {}).length === 0 && (data.transactions || []).length === 0) {
          setShowSetup(true)
        }
      }
      if (savRes.status === 'fulfilled') setSavingsData(savRes.value.data)
      if (depRes.status === 'fulfilled') setDepositedThisMonth(depRes.value.data?.deposited || false)
      if (buckRes.status === 'fulfilled') setBuckets(buckRes.value.data || [])
      if (debtRes.status === 'fulfilled') setDebts(debtRes.value.data || [])
    } catch (err) { toast(err.message || 'Failed to load data', 'error') }
    setLoading(false)
  }, [monthKey])

  useEffect(() => { fetchAll() }, [fetchAll])

  // --- Debt plan calculation ---
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

  useEffect(() => { if (debts.length > 0) calculatePlan() }, [debts, debtStrategy, extraPayment])
  useEffect(() => { localStorage.setItem('atlas_debt_strategy', debtStrategy) }, [debtStrategy])

  // --- Budget handlers ---
  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11) }
    else setViewMonth(m => m - 1)
  }
  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0) }
    else setViewMonth(m => m + 1)
  }
  const confirmIncome = async (amount) => {
    try {
      await post('/api/budget/confirm-income', { month: monthKey, income: amount })
      toast('Income confirmed', 'success')
      fetchAll()
    } catch (err) { toast(err.message || 'Failed to confirm income', 'error') }
  }
  const saveAllocation = async ({ spend_pct, savings_pct, invest_pct }) => {
    try {
      await post('/api/budget/set-allocation', { month: monthKey, spend_pct, savings_pct, invest_pct })
      toast('Allocation locked for this month', 'success')
      await fetchAll()
      setShowSetup(true)
    } catch (err) { toast(err.message || 'Failed to save allocation', 'error') }
  }
  const updateGoal = async (category, limit) => {
    const currentGoals = overview?.goals || {}
    const updated = { ...currentGoals, [category]: limit }
    const goalsArray = Object.entries(updated)
      .filter(([, v]) => v > 0)
      .map(([cat, monthly_limit]) => ({ category: cat, monthly_limit: parseFloat(monthly_limit) }))
    try {
      await post('/api/budget/goals', { goals: goalsArray })
      toast('Limit updated', 'success')
      fetchAll()
    } catch (err) { toast(err.message || 'Failed to save limit', 'error') }
  }
  const addTransaction = async (txn) => {
    try {
      await post('/api/budget/transaction', txn)
      toast('Transaction added', 'success')
      fetchAll()
    } catch (err) { toast(err.message || 'Failed to add transaction', 'error') }
  }
  const updateCategory = async (id, category) => {
    try {
      await patch(`/api/budget/transaction/${id}`, { category })
      fetchAll()
    } catch (err) { toast(err.message || 'Failed to update category', 'error') }
  }
  const deleteTransaction = async (id) => {
    try {
      await del(`/api/budget/transaction/${id}`)
      fetchAll()
    } catch (err) { toast(err.message || 'Failed to delete transaction', 'error') }
  }
  const completeSetup = async ({ goals: goalsList }) => {
    try {
      if (goalsList.length > 0) {
        await post('/api/budget/goals', { goals: goalsList })
        toast('Limits saved', 'success')
      }
      setShowSetup(false)
      fetchAll()
    } catch (err) { toast(err.message || 'Failed to save limits', 'error') }
  }

  // --- Savings handlers ---
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

  // --- Debt handlers ---
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
      fetchAll()
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
          fetchAll()
          api.post('/api/badges/check').catch(() => {})
        } catch (err) { toast(err.message || 'Failed to remove debt', 'error') }
      }
    })
  }

  // --- Loading state ---
  if (loading && !overview) return <LoadingSpinner height={300} />

  // --- Savings derived values ---
  const savMonthlyIncome = savingsData?.monthly_income || 0
  const savSpendPct = savingsData?.spend_pct || 0
  const savSavingsPct = savingsData?.savings_pct || 0
  const savInvestPct = savingsData?.invest_pct || 0
  const savSavingsAmt = savingsData?.savings_amt || 0
  const efBalance = savingsData?.ef_balance || 0
  const efTarget = savingsData?.ef_target || 0
  const efPct = savingsData?.ef_pct || 0
  const emergencyFundComplete = savingsData?.emergency_fund_complete || false
  const efMonths = savSavingsAmt > 0 && efTarget > efBalance ? Math.ceil((efTarget - efBalance) / savSavingsAmt) : 0

  // --- Chat context ---
  const spendingByCategory = {}
  transactions.filter(t => t.amount < 0).forEach(t => {
    const cat = t.category || 'Other'
    spendingByCategory[cat] = (spendingByCategory[cat] || 0) + Math.abs(t.amount)
  })

  return (
    <div>
      <ConfirmDialog {...confirmDialog} onCancel={() => setConfirmDialog(d => ({ ...d, open: false }))} />

      {/* Month navigation + income/allocation setup */}
      <MonthHeader
        month={viewMonth}
        year={viewYear}
        income={income}
        incomeConfirmed={incomeConfirmed}
        previousIncome={overview?.previous_income || 0}
        allocationLocked={allocationLocked}
        onPrev={prevMonth}
        onNext={nextMonth}
        onConfirmIncome={confirmIncome}
        onSaveAllocation={saveAllocation}
      />

      {/* Live allocation bar + 3 key numbers */}
      <AllocationBar
        allocation={allocation}
        income={income}
        allocationLocked={allocationLocked}
        remaining={remaining}
        savingsBalance={efBalance}
        totalDebt={totalDebt}
      />

      {/* ── BUDGET SECTION ── */}
      <CollapsibleSection title="Budget" sectionKey="budget" defaultOpen={true}>
        <SpendingOverview income={income} totalSpent={totalSpent} remaining={remaining} />
        <CategoryGrid
          categories={CATEGORIES}
          spending={spending}
          goals={goals}
          onUpdateGoal={updateGoal}
          onSelectCategory={setCategoryFilter}
          selectedCategory={categoryFilter}
        />
        <TransactionList
          transactions={transactions}
          categoryFilter={categoryFilter}
          onAdd={addTransaction}
          onUpdateCategory={updateCategory}
          onDelete={deleteTransaction}
        />
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <button className="btn btn-primary" onClick={() => setShowImport(true)} style={{ padding: '0.5rem 1.5rem' }}>
            Import Bank CSV
          </button>
        </div>
      </CollapsibleSection>

      {/* ── SAVINGS SECTION ── */}
      <CollapsibleSection title="Savings" sectionKey="savings" defaultOpen={false}>
        {!savingsData || !savMonthlyIncome ? (
          <div className="card" style={{ textAlign: 'center', padding: 'var(--space-xl) var(--space-lg)' }}>
            <p className="text-faint" style={{ fontSize: 'var(--text-sm)' }}>
              Set your income and allocation above to start tracking savings.
            </p>
          </div>
        ) : (
          <>
            {/* Emergency Fund */}
            <div className="card" style={{ marginBottom: 'var(--space-lg)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <h3 style={{ fontSize: 'var(--text-lg)' }}>Emergency Fund</h3>
                <span className="mono" style={{ fontSize: 'var(--text-lg)', fontWeight: 600, color: emergencyFundComplete ? 'var(--color-positive)' : 'var(--color-gold)' }}>
                  {formatCurrency(efBalance)} <span className="text-faint" style={{ fontSize: 'var(--text-sm)', fontWeight: 400 }}>/ {formatCurrency(efTarget)}</span>
                </span>
              </div>
              <div className="progress-bar" style={{ height: 8, marginBottom: '0.5rem' }}>
                <div className="progress-bar-fill" style={{ width: `${Math.min(100, efPct)}%`, background: emergencyFundComplete ? 'var(--color-positive)' : 'var(--color-gold)' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="text-faint" style={{ fontSize: 'var(--text-sm)' }}>
                  {emergencyFundComplete ? 'Emergency fund complete' : `${efPct.toFixed(0)}% funded — ${efMonths > 0 ? `~${efMonths} month${efMonths !== 1 ? 's' : ''} to go` : 'keep going'}`}
                </span>
                {!depositedThisMonth && savSavingsAmt > 0 && (
                  <button className="btn btn-primary" onClick={logDeposit} disabled={depositing} style={{ fontSize: 'var(--text-sm)', padding: '0.3rem 0.75rem' }}>
                    {depositing ? 'Depositing...' : `Log ${formatCurrency(savSavingsAmt)} Savings`}
                  </button>
                )}
                {depositedThisMonth && <span className="text-faint" style={{ fontSize: 'var(--text-sm)' }}>Savings logged this month</span>}
              </div>
              {emergencyFundComplete && savSavingsPct > 0 && (
                <button className="btn btn-ghost" onClick={graduate} disabled={graduating} style={{ marginTop: '0.75rem', width: '100%', fontSize: 'var(--text-sm)' }}>
                  {graduating ? 'Moving...' : 'Move savings allocation to investing'}
                </button>
              )}
            </div>

            {/* Pay Debt from Savings */}
            {debts.length > 0 && efBalance > 0 && (
              <div className="card" style={{ marginBottom: 'var(--space-lg)' }}>
                <h3 style={{ fontSize: 'var(--text-lg)', marginBottom: '0.75rem' }}>Pay Down Debt</h3>
                <p className="text-faint" style={{ fontSize: 'var(--text-sm)', marginBottom: '0.75rem' }}>
                  Use your savings balance ({formatCurrency(efBalance)}) to make extra payments.
                </p>
                {debts.filter(d => d.balance > 0).map(d => (
                  <div key={d.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0', borderBottom: '1px solid var(--color-border)' }}>
                    <div>
                      <span style={{ fontWeight: 500 }}>{d.name}</span>
                      <span className="text-faint mono" style={{ fontSize: 'var(--text-sm)', marginLeft: '0.5rem' }}>{formatCurrency(d.balance)}</span>
                    </div>
                    <button className="btn btn-ghost" onClick={() => payDebt(d.id, Math.min(d.balance, efBalance))} style={{ fontSize: 'var(--text-sm)', padding: '0.25rem 0.6rem' }}>
                      Pay {formatCurrency(Math.min(d.balance, efBalance))}
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
                                <button className="btn btn-ghost" onClick={() => setBucketDepositId(null)} style={{ fontSize: 'var(--text-xs)', padding: '0.15rem 0.3rem' }}>x</button>
                              </div>
                            ) : (
                              <>
                                <button className="btn btn-ghost" onClick={() => { setBucketDepositId(b.id); setBucketDepositAmt('') }} style={{ fontSize: 'var(--text-xs)', padding: '0.2rem 0.4rem' }}>+ Add</button>
                                <button className="btn btn-ghost" onClick={() => deleteBucket(b.id)} style={{ fontSize: 'var(--text-xs)', padding: '0.2rem 0.3rem', color: 'var(--color-text-muted)' }}>x</button>
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
          </>
        )}
      </CollapsibleSection>

      {/* ── DEBT SECTION ── */}
      <CollapsibleSection title="Debt" sectionKey="debt" defaultOpen={false}>
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
      </CollapsibleSection>

      {/* Modals */}
      <ImportModal isOpen={showImport} onClose={() => setShowImport(false)} onImportComplete={fetchAll} />
      {showSetup && <BudgetSetup income={income} spendBudget={allocationLocked ? Math.round(income * allocation.spend_pct / 100) : income} onComplete={completeSetup} onSkip={() => setShowSetup(false)} />}
    </div>
  )
}
