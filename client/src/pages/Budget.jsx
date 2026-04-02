import { useState, useEffect, useRef } from 'react'
import Papa from 'papaparse'
import useApi, { api } from '../hooks/useApi'
import { formatCurrency } from '../components/NumberDisplay'
import LoadingSpinner from '../components/LoadingSpinner'
import PageChat from '../components/PageChat'
import { useToast } from '../components/Toast'
import ConfirmDialog from '../components/ConfirmDialog'

const CATEGORIES = ['Food & Dining', 'Transport', 'Shopping', 'Subscriptions', 'Health', 'Entertainment', 'Income', 'Transfer', 'Other']
const CATEGORY_COLORS = {
  'Food & Dining': '#8B6914',
  'Transport': '#3B6B3B',
  'Shopping': 'var(--color-danger)',
  'Subscriptions': '#5B4FA0',
  'Health': '#2A6B8B',
  'Entertainment': '#8B5E3A',
  'Income': '#3B8B3B',
  'Transfer': '#6B6560',
  'Other': '#9E9890'
}

function normalizeHeaders(row) {
  const keys = Object.keys(row)
  const find = (candidates) => {
    for (const c of candidates) {
      const found = keys.find(k => k.toLowerCase().trim() === c.toLowerCase())
      if (found) return row[found]
    }
    return null
  }
  const amount = parseFloat(find(['Amount', 'Debit', 'Credit', 'Transaction Amount']) || '0')
  const date = find(['Date', 'Transaction Date', 'Posted Date']) || ''
  const description = find(['Description', 'Merchant', 'Details', 'Memo']) || ''
  return { amount, date, description }
}

function getWeeksOfMonth(year, month) {
  const weeks = []
  const first = new Date(year, month, 1)
  const last = new Date(year, month + 1, 0)

  // Start from Monday of the week containing the 1st
  let start = new Date(first)
  const dayOfWeek = start.getDay()
  const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
  start.setDate(start.getDate() + diff)

  while (start <= last || weeks.length === 0) {
    const end = new Date(start)
    end.setDate(end.getDate() + 6)
    weeks.push({
      start: new Date(start),
      end: new Date(end),
      label: `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
    })
    start = new Date(end)
    start.setDate(start.getDate() + 1)
  }
  return weeks
}

function dateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function BudgetCategoryCard({ cat, spent, limit, goalValue, onGoalChange, color }) {
  const [editing, setEditing] = useState(false)
  const pct = limit > 0 ? Math.min(100, (spent / limit) * 100) : 0
  const over = limit > 0 && spent > limit
  const barColor = pct > 85 ? 'var(--color-danger)' : pct > 60 ? 'var(--color-accent)' : 'var(--color-success)'

  return (
    <div className="budget-category-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
          <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600 }}>{cat}</span>
        </div>
        <button
          onClick={() => setEditing(e => !e)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-faint)', padding: '0.15rem' }}
          aria-label={`Edit ${cat} budget`}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
        </button>
      </div>

      {editing && (
        <input
          className="input"
          type="number"
          step="1"
          placeholder="Monthly limit"
          value={goalValue}
          onChange={e => onGoalChange(e.target.value)}
          style={{ fontSize: 'var(--text-sm)', padding: '0.3rem 0.5rem', marginBottom: '0.35rem', width: '100%' }}
          autoFocus
        />
      )}

      {limit > 0 ? (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.2rem' }}>
            <span className="mono" style={{ fontSize: 'var(--text-sm)', color: over ? 'var(--color-danger)' : 'var(--color-text-muted)' }}>
              {formatCurrency(spent)} / {formatCurrency(limit)}
            </span>
            <span className="mono" style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: over ? 'var(--color-danger)' : 'var(--color-text)' }}>
              {pct.toFixed(0)}%
            </span>
          </div>
          <div className="progress-bar" style={{ height: 6 }}>
            <div className="progress-bar-fill" style={{ width: `${pct}%`, background: barColor }} />
          </div>
          {pct > 85 && (
            <p className="text-faint" style={{ fontSize: 'var(--text-xs)', marginTop: '0.35rem', fontStyle: 'italic' }}>
              {over ? `Over budget by ${formatCurrency(spent - limit)}` : 'Nearing your limit'}
            </p>
          )}
        </>
      ) : (
        <p className="text-faint" style={{ fontSize: 'var(--text-xs)', marginTop: '0.15rem' }}>
          {!editing ? 'Tap edit to set a limit' : 'Enter a monthly limit'}
        </p>
      )}
    </div>
  )
}

export default function Budget() {
  const { get, post, patch, del } = useApi()
  const { toast } = useToast()
  const fileRef = useRef()
  const [tab, setTab] = useState('calendar')
  const now = new Date()
  const [viewYear, setViewYear] = useState(now.getFullYear())
  const [viewMonth, setViewMonth] = useState(now.getMonth())
  const [transactions, setTransactions] = useState([])
  const [goals, setGoals] = useState({})
  const [expandedWeek, setExpandedWeek] = useState(null)
  const [addForm, setAddForm] = useState({ date: '', description: '', amount: '', category: 'Other' })
  const [editingId, setEditingId] = useState(null)
  const [editCategory, setEditCategory] = useState('')

  // Import tab state
  const [preview, setPreview] = useState(null)
  const [importing, setImporting] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const [showGuide, setShowGuide] = useState(false)
  const [analysis, setAnalysis] = useState(null)
  const [analysisLoading, setAnalysisLoading] = useState(false)

  // Debt tab state
  const [debts, setDebts] = useState([])
  const [debtPlan, setDebtPlan] = useState(null)
  const [debtStrategy, setDebtStrategy] = useState(() => localStorage.getItem('atlas_debt_strategy') || 'avalanche')
  const [extraPayment, setExtraPayment] = useState('')
  const [debtPlanLoading, setDebtPlanLoading] = useState(false)
  const [debtForm, setDebtForm] = useState({ name: '', balance: '', interest_rate: '', min_payment: '' })
  const [expandedDebt, setExpandedDebt] = useState(null)
  const [confirmDialog, setConfirmDialog] = useState({ open: false, title: '', message: '', onConfirm: () => {}, danger: false })

  const monthKey = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}`
  const monthLabel = new Date(viewYear, viewMonth).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  const weeks = getWeeksOfMonth(viewYear, viewMonth)

  const fetchData = async () => {
    try {
      const [txRes, goalsRes] = await Promise.all([
        get(`/api/budget/transactions?month=${monthKey}`),
        get('/api/budget/goals'),
      ])
      setTransactions(txRes.data)
      const goalsMap = {}
      goalsRes.data.forEach(g => { goalsMap[g.category] = g.monthly_limit })
      setGoals(goalsMap)
    } catch (err) { toast(err.message || 'Something went wrong', 'error') }
  }

  useEffect(() => { fetchData() }, [viewYear, viewMonth])

  // Debt functions
  const fetchDebts = async () => {
    try {
      const res = await get('/api/debt')
      setDebts(res.data)
    } catch (err) { toast(err.message || 'Something went wrong', 'error') }
  }

  const calculateDebtPlan = async () => {
    if (debts.length === 0) { setDebtPlan(null); return }
    setDebtPlanLoading(true)
    try {
      const res = await post('/api/debt/plan', {
        strategy: debtStrategy,
        extra_payment: parseFloat(extraPayment) || 0,
      })
      setDebtPlan(res.data)
    } catch (err) { toast(err.message || 'Something went wrong', 'error') }
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
    } catch (err) { toast(err.message || 'Something went wrong', 'error') }
  }

  const deleteDebt = (id) => {
    const debt = debts.find(d => d.id === id)
    setConfirmDialog({
      open: true, danger: false,
      title: 'Mark as Paid Off',
      message: `Are you sure you want to mark "${debt?.name || 'this debt'}" as paid off?`,
      onConfirm: async () => {
        setConfirmDialog(d => ({ ...d, open: false }))
        if (expandedDebt === id) setExpandedDebt(null)
        try {
          await del(`/api/debt/${id}`)
          toast('Debt marked as paid off', 'success')
          fetchDebts()
          api.post('/api/badges/check').catch(() => {})
        } catch (err) {
          toast(err.message || 'Something went wrong', 'error')
        }
      }
    })
  }

  const formatMonths = (months) => {
    if (months >= 600) return '50+ years'
    const years = Math.floor(months / 12)
    const mo = months % 12
    if (years === 0) return `${mo} months`
    if (mo === 0) return `${years} year${years > 1 ? 's' : ''}`
    return `${years}y ${mo}m`
  }

  const formatDebtDate = (iso) => {
    const d = new Date(iso)
    return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  }

  useEffect(() => { fetchDebts() }, [])
  useEffect(() => { if (debts.length > 0) calculateDebtPlan() }, [debts, debtStrategy, extraPayment])
  useEffect(() => { localStorage.setItem('atlas_debt_strategy', debtStrategy) }, [debtStrategy])

  const totalDebt = debts.reduce((s, d) => s + d.balance, 0)

  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11) }
    else setViewMonth(m => m - 1)
    setExpandedWeek(null)
  }

  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0) }
    else setViewMonth(m => m + 1)
    setExpandedWeek(null)
  }

  const txnsInWeek = (week) => {
    const s = dateStr(week.start)
    const e = dateStr(week.end)
    return transactions.filter(t => t.date >= s && t.date <= e)
  }

  const weekTotal = (week) => {
    return txnsInWeek(week).filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0)
  }

  // Spending by category for the month
  const spendingByCategory = {}
  transactions.filter(t => t.amount < 0).forEach(t => {
    const cat = t.category || 'Other'
    spendingByCategory[cat] = (spendingByCategory[cat] || 0) + Math.abs(t.amount)
  })
  const totalSpent = Object.values(spendingByCategory).reduce((s, v) => s + v, 0)
  const totalBudget = Object.values(goals).reduce((s, v) => s + (parseFloat(v) || 0), 0)

  const addTransaction = async () => {
    if (!addForm.date || !addForm.description || !addForm.amount) return
    try {
      const res = await post('/api/budget/transaction', {
        date: addForm.date,
        description: addForm.description,
        amount: -Math.abs(parseFloat(addForm.amount)),
        category: addForm.category,
      })
      setTransactions(prev => [res.data, ...prev])
      setAddForm({ date: '', description: '', amount: '', category: 'Other' })
    } catch (err) { toast(err.message || 'Something went wrong', 'error') }
  }

  const deleteTransaction = (id) => {
    const txn = transactions.find(t => t.id === id)
    setConfirmDialog({
      open: true, danger: true,
      title: 'Delete Transaction',
      message: `Delete "${txn?.description || 'this transaction'}"?`,
      onConfirm: async () => {
        setConfirmDialog(d => ({ ...d, open: false }))
        try {
          await del(`/api/budget/transaction/${id}`)
          setTransactions(prev => prev.filter(t => t.id !== id))
        } catch (err) { toast(err.message || 'Something went wrong', 'error') }
      }
    })
  }

  const updateCategory = async (id, category) => {
    try {
      await patch(`/api/budget/transaction/${id}`, { category })
      setTransactions(prev => prev.map(t => t.id === id ? { ...t, category } : t))
      setEditingId(null)
    } catch (err) { toast(err.message || 'Something went wrong', 'error') }
  }

  const saveGoals = async () => {
    const goalsArray = Object.entries(goals)
      .filter(([, limit]) => limit > 0)
      .map(([category, monthly_limit]) => ({ category, monthly_limit: parseFloat(monthly_limit) }))
    try {
      await post('/api/budget/goals', { goals: goalsArray })
      toast('Goals saved successfully', 'success')
    } catch (err) { toast(err.message || 'Something went wrong', 'error') }
  }

  // Get days in a week that fall within the current month
  const getDaysInWeek = (week) => {
    const days = []
    const d = new Date(week.start)
    while (d <= week.end) {
      if (d.getMonth() === viewMonth) {
        days.push(dateStr(new Date(d)))
      }
      d.setDate(d.getDate() + 1)
    }
    return days
  }

  // Import handlers
  const handleFile = (file) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const parsed = results.data
          .map(normalizeHeaders)
          .filter(r => r.amount !== 0 && r.description.trim() !== '')
        setPreview(parsed)
      }
    })
  }

  const doImport = async () => {
    if (!preview) return
    setImporting(true)
    try {
      const importRes = await post('/api/budget/import', { transactions: preview })
      const imported = importRes.data.transactions
      setPreview(null)
      await fetchData()
      toast('Transactions imported', 'success')
      setAnalysisLoading(true)
      try {
        const analysisRes = await post('/api/budget/analyze', { transactions: imported })
        setAnalysis(analysisRes.data.analysis)
      } catch (err) { toast(err.message || 'Something went wrong', 'error') }
      setAnalysisLoading(false)
    } catch (err) { toast(err.message || 'Something went wrong', 'error') }
    setImporting(false)
  }

  const renderBold = (text) => {
    const parts = text.split(/(\*\*[^*]+\*\*)/)
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i} style={{ color: 'var(--color-text)' }}>{part.slice(2, -2)}</strong>
      }
      return part
    })
  }

  return (
    <div>
      <div style={{ marginBottom: '1rem' }}>
        <h1 style={{ fontSize: 'var(--text-3xl)', marginBottom: '0.15rem' }}>Budget</h1>
        <p className="label-caps">{monthLabel}</p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '1.5rem', borderBottom: '2px solid var(--color-border)' }}>
        {[
          { key: 'calendar', label: 'Calendar' },
          { key: 'debt', label: 'Debt' },
          { key: 'import', label: 'Import' },
          { key: 'chat', label: 'AI Chat' },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            padding: '0.6rem 1.25rem', border: 'none',
            borderBottom: tab === t.key ? '2px solid var(--color-accent)' : '2px solid transparent',
            background: 'none', cursor: 'pointer', fontWeight: tab === t.key ? 600 : 400,
            color: tab === t.key ? 'var(--color-accent)' : 'var(--color-text-muted)',
            fontSize: 'var(--text-base)', marginBottom: '-2px', transition: 'all 0.15s ease',
          }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* AI Chat Tab */}
      {tab === 'chat' && <PageChat context="budget" />}

      {/* Debt Tab */}
      {tab === 'debt' && (
        <>
          {/* Add Debt Form */}
          <div className="card" style={{ marginBottom: '1rem' }}>
            <h3 style={{ fontSize: 'var(--text-lg)', marginBottom: '0.75rem' }}>Add a Debt</h3>
            <form onSubmit={addDebt} style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div style={{ flex: '1 1 140px' }}>
                <label style={{ display: 'block', color: 'var(--color-text-faint)', fontSize: 'var(--text-sm)', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Name</label>
                <input className="input" placeholder="e.g. Visa Card" value={debtForm.name} onChange={e => setDebtForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div style={{ flex: '0 1 110px' }}>
                <label style={{ display: 'block', color: 'var(--color-text-faint)', fontSize: 'var(--text-sm)', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Balance</label>
                <input className="input" type="number" step="0.01" placeholder="$0" value={debtForm.balance} onChange={e => setDebtForm(f => ({ ...f, balance: e.target.value }))} />
              </div>
              <div style={{ flex: '0 1 90px' }}>
                <label style={{ display: 'block', color: 'var(--color-text-faint)', fontSize: 'var(--text-sm)', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.05em' }}>APR %</label>
                <input className="input" type="number" step="0.1" placeholder="0%" value={debtForm.interest_rate} onChange={e => setDebtForm(f => ({ ...f, interest_rate: e.target.value }))} />
              </div>
              <div style={{ flex: '0 1 110px' }}>
                <label style={{ display: 'block', color: 'var(--color-text-faint)', fontSize: 'var(--text-sm)', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Min Payment</label>
                <input className="input" type="number" step="0.01" placeholder="$0" value={debtForm.min_payment} onChange={e => setDebtForm(f => ({ ...f, min_payment: e.target.value }))} />
              </div>
              <button className="btn btn-primary" type="submit" style={{ height: 36 }}>Add</button>
            </form>
          </div>

          {/* Strategy & Extra Payment */}
          {debts.length > 0 && (
            <div className="card" style={{ marginBottom: '1rem' }}>
              <div className="grid-2">
                <div>
                  <label style={{ display: 'block', color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Payoff Strategy</label>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      onClick={() => setDebtStrategy('avalanche')}
                      className={debtStrategy === 'avalanche' ? 'btn btn-primary' : 'btn btn-ghost'}
                      style={{ flex: 1 }}
                    >
                      Avalanche
                    </button>
                    <button
                      onClick={() => setDebtStrategy('snowball')}
                      className={debtStrategy === 'snowball' ? 'btn btn-primary' : 'btn btn-ghost'}
                      style={{ flex: 1 }}
                    >
                      Snowball
                    </button>
                  </div>
                  <p className="text-faint" style={{ fontSize: 'var(--text-sm)', marginTop: '0.35rem' }}>
                    {debtStrategy === 'avalanche'
                      ? 'Highest interest first — saves the most money'
                      : 'Smallest balance first — quick wins to stay motivated'}
                  </p>
                </div>
                <div>
                  <label style={{ display: 'block', color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Extra Monthly Payment</label>
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
                  <p className="text-faint" style={{ fontSize: 'var(--text-sm)', marginTop: '0.35rem' }}>
                    Extra money toward debt each month on top of minimums
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Overall Summary */}
          {debtPlanLoading && <LoadingSpinner height={100} />}

          {debtPlan && !debtPlanLoading && (
            <div className="grid-3" style={{ marginBottom: '1rem' }}>
              <div className="card" style={{ textAlign: 'center' }}>
                <h4 style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.35rem' }}>Total Interest</h4>
                <span className="mono" style={{ fontSize: 'var(--text-2xl)', color: 'var(--color-danger)' }}>
                  {formatCurrency(debtPlan.totalInterest)}
                </span>
              </div>
              <div className="card" style={{ textAlign: 'center' }}>
                <h4 style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.35rem' }}>Debt-Free By</h4>
                <span className="mono" style={{ fontSize: 'var(--text-2xl)', color: 'var(--color-primary)' }}>
                  {formatDebtDate(debtPlan.debtFreeDate)}
                </span>
                <p className="text-faint" style={{ fontSize: 'var(--text-sm)' }}>{formatMonths(debtPlan.monthsToFreedom)}</p>
              </div>
              <div className="card" style={{ textAlign: 'center' }}>
                <h4 style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.35rem' }}>
                  {debtPlan.interestSaved > 0 ? 'You Save' : 'Extra Payment'}
                </h4>
                {debtPlan.interestSaved > 0 ? (
                  <>
                    <span className="mono" style={{ fontSize: 'var(--text-2xl)', color: 'var(--color-success)' }}>
                      {formatCurrency(debtPlan.interestSaved)}
                    </span>
                    <p className="text-faint" style={{ fontSize: 'var(--text-sm)' }}>{debtPlan.monthsSaved} months sooner</p>
                  </>
                ) : (
                  <span className="text-faint" style={{ fontSize: 'var(--text-base)' }}>Add extra $ above to see savings</span>
                )}
              </div>
            </div>
          )}

          {/* Debts List - Clickable with Expandable Stats */}
          {debts.length > 0 && (
            <div className="card" style={{ marginBottom: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <h3 style={{ fontSize: 'var(--text-lg)' }}>Your Debts</h3>
                <span className="mono" style={{ fontSize: 'var(--text-xl)', color: 'var(--color-danger)', fontWeight: 600 }}>
                  Total: {formatCurrency(totalDebt)}
                </span>
              </div>
              {debts.map(d => {
                const isExpanded = expandedDebt === d.id
                const planData = debtPlan?.debts?.find(pd => pd.id === d.id)
                return (
                  <div key={d.id} style={{
                    borderBottom: '1px solid var(--color-border)',
                    transition: 'background 0.15s',
                    background: isExpanded ? 'var(--color-surface-2)' : 'transparent',
                    margin: '0 -1.5rem',
                    padding: '0 1.5rem',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.6rem 0' }}>
                      <div
                        onClick={() => setExpandedDebt(isExpanded ? null : d.id)}
                        style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1 }}
                      >
                        <span style={{
                          fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)',
                          transform: isExpanded ? 'rotate(90deg)' : 'none',
                          transition: 'transform 0.15s', display: 'inline-block',
                        }}>&#9654;</span>
                        <span style={{ fontSize: 'var(--text-base)', fontWeight: 500, color: 'var(--color-accent)', textDecoration: 'none' }}>{d.name}</span>
                        <span className="text-faint" style={{ fontSize: 'var(--text-sm)' }}>{d.interest_rate}% APR</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span className="mono" style={{ fontSize: 'var(--text-base)', color: 'var(--color-danger)' }}>{formatCurrency(d.balance)}</span>
                        <span className="text-faint" style={{ fontSize: 'var(--text-sm)' }}>{formatCurrency(d.min_payment)}/mo</span>
                        <button className="btn-paid-off" onClick={(e) => { e.stopPropagation(); deleteDebt(d.id) }}>
                          Paid Off
                        </button>
                      </div>
                    </div>

                    {/* Expanded Statistics */}
                    {isExpanded && planData && (
                      <div style={{ padding: '0 0 1rem 1.5rem' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem', marginBottom: '0.75rem' }}>
                          <div style={{ padding: '0.75rem', background: 'var(--color-surface)', borderRadius: 2, border: '1px solid var(--color-border)' }}>
                            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-faint)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>Monthly Payment</p>
                            <span className="mono" style={{ fontSize: 'var(--text-xl)', fontWeight: 600 }}>{formatCurrency(planData.monthlyPayment)}</span>
                          </div>
                          <div style={{ padding: '0.75rem', background: 'var(--color-surface)', borderRadius: 2, border: '1px solid var(--color-border)' }}>
                            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-faint)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>Payoff Timeline</p>
                            <span className="mono" style={{ fontSize: 'var(--text-xl)', fontWeight: 600 }}>{formatMonths(planData.monthsToPayoff)}</span>
                          </div>
                          <div style={{ padding: '0.75rem', background: 'var(--color-surface)', borderRadius: 2, border: '1px solid var(--color-border)' }}>
                            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-faint)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>Total Interest</p>
                            <span className="mono" style={{ fontSize: 'var(--text-xl)', fontWeight: 600, color: 'var(--color-danger)' }}>{formatCurrency(planData.totalInterest)}</span>
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '1rem', fontSize: 'var(--text-sm)' }}>
                          <span className="text-muted">Payoff order: <strong>#{planData.order}</strong> ({debtStrategy === 'avalanche' ? 'highest interest first' : 'smallest balance first'})</span>
                          <span className="text-muted">Original balance: <strong className="mono">{formatCurrency(planData.originalBalance)}</strong></span>
                        </div>
                      </div>
                    )}

                    {isExpanded && !planData && debtPlanLoading && (
                      <div style={{ padding: '0.5rem 0 1rem 1.5rem' }}>
                        <LoadingSpinner height={40} />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* AI Summary */}
          {debtPlan && !debtPlanLoading && debtPlan.aiSummary && (
            <div className="card">
              <p style={{ fontSize: 'var(--text-base)', color: 'var(--color-text-muted)', lineHeight: 1.6 }}>
                {debtPlan.aiSummary}
              </p>
            </div>
          )}

          {/* Empty state */}
          {debts.length === 0 && (
            <div className="card" style={{ textAlign: 'center', padding: '2rem' }}>
              <p className="text-muted" style={{ fontSize: 'var(--text-base)' }}>Add your debts above to see your payoff plan.</p>
              <p className="text-faint" style={{ fontSize: 'var(--text-sm)', marginTop: '0.5rem' }}>Credit cards, student loans, car loans, mortgage — anything you owe.</p>
            </div>
          )}
        </>
      )}

      {/* Import Tab */}
      {tab === 'import' && (
        <>
          <div className="card" style={{ marginBottom: '1.5rem' }}>
            <div
              onDragOver={(e) => { e.preventDefault(); setDragActive(true) }}
              onDragLeave={() => setDragActive(false)}
              onDrop={(e) => { e.preventDefault(); setDragActive(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f) }}
              onClick={() => fileRef.current?.click()}
              style={{
                border: `2px dashed ${dragActive ? 'var(--color-accent)' : 'var(--color-border-dark)'}`,
                borderRadius: 8, padding: '2rem', textAlign: 'center', cursor: 'pointer',
                background: dragActive ? 'var(--color-accent-light)' : 'transparent',
                transition: 'all 0.15s ease',
              }}
            >
              <p style={{ fontSize: 'var(--text-lg)', color: 'var(--color-text-muted)' }}>Drop your bank CSV here, or click to browse</p>
              <input ref={fileRef} type="file" accept=".csv" onChange={(e) => { const f = e.target.files[0]; if (f) handleFile(f) }} style={{ display: 'none' }} />
            </div>

            <button className="btn btn-ghost" onClick={() => setShowGuide(!showGuide)} style={{ marginTop: '0.75rem', fontSize: 'var(--text-sm)' }}>
              {showGuide ? 'Hide' : 'How to export your CSV'}
            </button>

            {showGuide && (
              <div style={{ marginTop: '0.75rem', padding: '1rem', background: 'var(--color-surface-2)', borderRadius: 8, fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>
                <div style={{ marginBottom: '0.75rem' }}>
                  <strong>Chase:</strong>
                  <ol style={{ paddingLeft: '1.25rem', marginTop: '0.25rem' }}><li>Log in to chase.com</li><li>Go to your account activity</li><li>Click "Download account activity"</li><li>Select CSV format and date range</li></ol>
                </div>
                <div style={{ marginBottom: '0.75rem' }}>
                  <strong>Bank of America:</strong>
                  <ol style={{ paddingLeft: '1.25rem', marginTop: '0.25rem' }}><li>Log in to bankofamerica.com</li><li>Go to Statements & Documents</li><li>Click "Download transactions"</li><li>Choose CSV and your date range</li></ol>
                </div>
                <div style={{ marginBottom: '0.75rem' }}>
                  <strong>Wells Fargo:</strong>
                  <ol style={{ paddingLeft: '1.25rem', marginTop: '0.25rem' }}><li>Log in to wellsfargo.com</li><li>Go to Account Activity</li><li>Click "Download" at the top</li><li>Select Comma Separated (CSV)</li></ol>
                </div>
                <div>
                  <strong>Capital One:</strong>
                  <ol style={{ paddingLeft: '1.25rem', marginTop: '0.25rem' }}><li>Log in to capitalone.com</li><li>Select your account</li><li>Click "Download Transactions"</li><li>Choose CSV format</li></ol>
                </div>
              </div>
            )}

            {preview && (
              <div style={{ marginTop: '1rem' }}>
                <h3 style={{ fontSize: 'var(--text-lg)', marginBottom: '0.5rem' }}>Preview ({preview.length} transactions)</h3>
                <div className="table-wrapper">
                  <table>
                    <thead><tr><th>Date</th><th>Description</th><th>Amount</th></tr></thead>
                    <tbody>
                      {preview.slice(0, 5).map((t, i) => (
                        <tr key={i}>
                          <td>{t.date}</td>
                          <td>{t.description}</td>
                          <td className="mono" style={{ color: t.amount < 0 ? 'var(--color-danger)' : 'var(--color-success)' }}>{formatCurrency(t.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {preview.length > 5 && <p className="text-faint" style={{ fontSize: 'var(--text-sm)', marginTop: '0.35rem' }}>...and {preview.length - 5} more</p>}
                <button className="btn btn-primary" onClick={doImport} disabled={importing} style={{ marginTop: '0.75rem' }}>
                  {importing ? 'Importing...' : `Import ${preview.length} transactions`}
                </button>
              </div>
            )}
          </div>

          {/* AI Analysis after import */}
          {(analysisLoading || analysis) && (
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: analysisLoading ? 'var(--color-accent)' : 'var(--color-success)' }} />
                  <h2 style={{ fontSize: 'var(--text-xl)' }}>AI Spending Analysis</h2>
                </div>
                {analysis && (
                  <button className="btn btn-ghost" onClick={() => setAnalysis(null)} style={{ fontSize: 'var(--text-sm)', padding: '0.25rem 0.5rem' }}>Dismiss</button>
                )}
              </div>
              {analysisLoading ? (
                <div style={{ padding: '2rem', textAlign: 'center' }}>
                  <div className="skeleton" style={{ height: 16, width: '60%', margin: '0 auto 0.75rem' }} />
                  <div className="skeleton" style={{ height: 16, width: '80%', margin: '0 auto 0.75rem' }} />
                  <div className="skeleton" style={{ height: 16, width: '45%', margin: '0 auto' }} />
                  <p className="text-faint" style={{ fontSize: 'var(--text-sm)', marginTop: '1rem' }}>Analyzing your spending patterns...</p>
                </div>
              ) : (
                <div style={{ fontSize: 'var(--text-base)', lineHeight: 1.7, color: 'var(--color-text)' }}>
                  {analysis.split('\n').map((line, i) => {
                    if (line.startsWith('## ')) return <h3 key={i} style={{ color: 'var(--color-accent)', marginTop: i > 0 ? '1.25rem' : 0, marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: 'var(--text-sm)' }}>{line.replace('## ', '')}</h3>
                    if (line.startsWith('- ')) return <div key={i} style={{ paddingLeft: '0.75rem', marginBottom: '0.25rem', borderLeft: '2px solid var(--color-border-dark)' }}>{renderBold(line.replace('- ', ''))}</div>
                    if (line.trim() === '') return <div key={i} style={{ height: '0.5rem' }} />
                    return <p key={i} style={{ marginBottom: '0.25rem' }}>{renderBold(line)}</p>
                  })}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Calendar Tab */}
      {tab === 'calendar' && (
        <>
          {/* Month Selector */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1.5rem', marginBottom: '1.5rem' }}>
            <button className="btn btn-ghost" onClick={prevMonth} style={{ fontSize: 'var(--text-xl)', padding: '0.25rem 0.75rem' }}>&lt;</button>
            <h2 style={{ fontSize: 'var(--text-xl)', minWidth: 200, textAlign: 'center' }}>{monthLabel}</h2>
            <button className="btn btn-ghost" onClick={nextMonth} style={{ fontSize: 'var(--text-xl)', padding: '0.25rem 0.75rem' }}>&gt;</button>
          </div>

          {/* Monthly Budget Goals */}
          <div className="card" style={{ marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2 style={{ fontSize: 'var(--text-xl)' }}>Monthly Budget Goals</h2>
              <button className="btn btn-ghost" onClick={saveGoals} style={{ fontSize: 'var(--text-sm)' }}>Save Goals</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.75rem' }}>
              {CATEGORIES.filter(c => c !== 'Income' && c !== 'Transfer').map(cat => (
                <BudgetCategoryCard
                  key={cat}
                  cat={cat}
                  spent={spendingByCategory[cat] || 0}
                  limit={parseFloat(goals[cat]) || 0}
                  goalValue={goals[cat] || ''}
                  onGoalChange={val => setGoals(prev => ({ ...prev, [cat]: val }))}
                  color={CATEGORY_COLORS[cat]}
                />
              ))}
            </div>
          </div>

          {/* Weekly Calendar */}
          <div className="card" style={{ marginBottom: '1.5rem' }}>
            <h2 style={{ fontSize: 'var(--text-xl)', marginBottom: '1rem' }}>Weekly Spending</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {weeks.map((week, wi) => {
                const weekTxns = txnsInWeek(week)
                const wTotal = weekTotal(week)
                const isOpen = expandedWeek === wi

                return (
                  <div key={wi} style={{
                    border: '1px solid var(--color-border)',
                    borderRadius: 4,
                    overflow: 'hidden',
                  }}>
                    {/* Week header */}
                    <div
                      onClick={() => setExpandedWeek(isOpen ? null : wi)}
                      style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '0.75rem 1rem', cursor: 'pointer',
                        background: isOpen ? 'var(--color-surface-2)' : 'transparent',
                        transition: 'background 0.1s',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', transform: isOpen ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }}>&#9654;</span>
                        <span style={{ fontSize: 'var(--text-base)', fontWeight: 500 }}>{week.label}</span>
                        <span className="text-muted" style={{ fontSize: 'var(--text-sm)' }}>
                          {weekTxns.length} {weekTxns.length === 1 ? 'entry' : 'entries'}
                        </span>
                      </div>
                      <span className="mono" style={{ fontSize: 'var(--text-base)', color: wTotal > 0 ? 'var(--color-danger)' : 'var(--color-text-muted)' }}>
                        {wTotal > 0 ? `-${formatCurrency(wTotal)}` : '$0.00'}
                      </span>
                    </div>

                    {/* Expanded week content */}
                    {isOpen && (
                      <div style={{ padding: '0.75rem 1rem', borderTop: '1px solid var(--color-border)' }}>
                        {/* Existing transactions */}
                        {weekTxns.length > 0 && (
                          <div style={{ marginBottom: '1rem' }}>
                            {weekTxns.map(t => (
                              <div key={t.id} style={{
                                display: 'flex', alignItems: 'center', gap: '0.75rem',
                                padding: '0.4rem 0', borderBottom: '1px solid var(--color-border)',
                                fontSize: 'var(--text-base)',
                              }}>
                                <span className="text-muted" style={{ fontSize: 'var(--text-sm)', minWidth: 70 }}>{t.date}</span>
                                <span style={{ flex: 1 }}>{t.description}</span>
                                {editingId === t.id ? (
                                  <select
                                    className="select"
                                    value={editCategory}
                                    onChange={e => { setEditCategory(e.target.value); updateCategory(t.id, e.target.value) }}
                                    style={{ fontSize: 'var(--text-sm)', padding: '0.15rem 0.3rem' }}
                                    autoFocus
                                    onBlur={() => setEditingId(null)}
                                  >
                                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                                  </select>
                                ) : (
                                  <span
                                    onClick={() => { setEditingId(t.id); setEditCategory(t.category) }}
                                    style={{
                                      fontSize: 'var(--text-sm)', padding: '0.1rem 0.35rem', borderRadius: 2,
                                      background: 'var(--color-surface-2)', cursor: 'pointer',
                                      color: CATEGORY_COLORS[t.category] || 'var(--color-text-muted)',
                                    }}
                                  >
                                    {t.category}
                                  </span>
                                )}
                                <span className="mono" style={{
                                  minWidth: 65, textAlign: 'right',
                                  color: t.amount < 0 ? 'var(--color-danger)' : 'var(--color-success)',
                                }}>
                                  {formatCurrency(t.amount)}
                                </span>
                                <button
                                  onClick={() => deleteTransaction(t.id)}
                                  style={{
                                    background: 'none', border: 'none', cursor: 'pointer',
                                    color: 'var(--color-text-muted)', fontSize: 'var(--text-base)', padding: '0 0.25rem',
                                  }}
                                  title="Delete"
                                >
                                  &times;
                                </button>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Add expense form */}
                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                          <div style={{ flex: '0 0 auto' }}>
                            <label style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Date</label>
                            <select
                              className="select"
                              value={addForm.date}
                              onChange={e => setAddForm(f => ({ ...f, date: e.target.value }))}
                              style={{ fontSize: 'var(--text-sm)', display: 'block', marginTop: '0.2rem' }}
                            >
                              <option value="">Day</option>
                              {getDaysInWeek(week).map(d => (
                                <option key={d} value={d}>{new Date(d + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' })}</option>
                              ))}
                            </select>
                          </div>
                          <div style={{ flex: 1, minWidth: 120 }}>
                            <label style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Description</label>
                            <input
                              className="input"
                              placeholder="What did you spend on?"
                              value={addForm.description}
                              onChange={e => setAddForm(f => ({ ...f, description: e.target.value }))}
                              style={{ fontSize: 'var(--text-sm)', display: 'block', marginTop: '0.2rem', width: '100%' }}
                            />
                          </div>
                          <div style={{ flex: '0 0 80px' }}>
                            <label style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Amount</label>
                            <input
                              className="input"
                              type="number"
                              step="0.01"
                              placeholder="$0.00"
                              value={addForm.amount}
                              onChange={e => setAddForm(f => ({ ...f, amount: e.target.value }))}
                              style={{ fontSize: 'var(--text-sm)', display: 'block', marginTop: '0.2rem', width: '100%' }}
                            />
                          </div>
                          <div style={{ flex: '0 0 auto' }}>
                            <label style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Category</label>
                            <select
                              className="select"
                              value={addForm.category}
                              onChange={e => setAddForm(f => ({ ...f, category: e.target.value }))}
                              style={{ fontSize: 'var(--text-sm)', display: 'block', marginTop: '0.2rem' }}
                            >
                              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                          </div>
                          <button className="btn btn-primary" onClick={addTransaction} style={{ fontSize: 'var(--text-sm)', padding: '0.4rem 0.75rem' }}>
                            Add
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Monthly Total */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <p className="text-muted" style={{ fontSize: 'var(--text-sm)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Total Spent</p>
                <span className="mono" style={{ fontSize: 'var(--text-2xl)', color: 'var(--color-danger)' }}>
                  {formatCurrency(totalSpent)}
                </span>
              </div>
              {totalBudget > 0 && (
                <div style={{ textAlign: 'right' }}>
                  <p className="text-muted" style={{ fontSize: 'var(--text-sm)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Budget</p>
                  <span className="mono" style={{ fontSize: 'var(--text-2xl)' }}>
                    {formatCurrency(totalBudget)}
                  </span>
                </div>
              )}
              {totalBudget > 0 && (
                <div style={{ textAlign: 'right' }}>
                  <p className="text-muted" style={{ fontSize: 'var(--text-sm)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Remaining</p>
                  <span className="mono" style={{ fontSize: 'var(--text-2xl)', color: totalBudget - totalSpent >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
                    {formatCurrency(totalBudget - totalSpent)}
                  </span>
                </div>
              )}
              {totalDebt > 0 && (
                <div style={{ textAlign: 'right' }}>
                  <p className="text-muted" style={{ fontSize: 'var(--text-sm)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Total Debt</p>
                  <span className="mono" style={{ fontSize: 'var(--text-2xl)', color: 'var(--color-danger)' }}>
                    {formatCurrency(totalDebt)}
                  </span>
                </div>
              )}
            </div>
            {totalBudget > 0 && (
              <div className="progress-bar" style={{ marginTop: '0.75rem', height: 8 }}>
                <div className="progress-bar-fill" style={{
                  width: `${Math.min(100, (totalSpent / totalBudget) * 100)}%`,
                  background: totalSpent > totalBudget ? 'var(--color-danger)' : 'var(--color-primary)',
                }} />
              </div>
            )}
          </div>
        </>
      )}
      <ConfirmDialog {...confirmDialog} onCancel={() => setConfirmDialog(d => ({ ...d, open: false }))} />
    </div>
  )
}
