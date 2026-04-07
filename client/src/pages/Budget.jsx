import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
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
  'Shopping': 'var(--color-negative)',
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

const getCategoryIcon = (name) => ({
  'Food & Dining': '\u{1F374}',
  'Transport': '\u{1F697}',
  'Shopping': '\u{1F6CD}',
  'Subscriptions': '\u{1F4F1}',
  'Health': '\u{1F48A}',
  'Entertainment': '\u{1F3AC}',
  'Income': '\u{1F4B5}',
  'Transfer': '\u{1F504}',
  'Other': '\u{1F4E6}',
})[name] || '\u{1F4B0}'

function BudgetCategoryCard({ cat, spent, limit, goalValue, onGoalChange, color }) {
  const [editing, setEditing] = useState(false)
  const pct = limit > 0 ? Math.min(100, (spent / limit) * 100) : 0
  const over = limit > 0 && spent > limit
  const barColor = pct > 85 ? 'var(--color-negative)' : pct > 60 ? 'var(--color-gold)' : 'var(--color-positive)'

  return (
    <div className="budget-category-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: 14 }}>{getCategoryIcon(cat)}</span>
          <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600 }}>{cat}</span>
        </div>
        <button
          onClick={() => setEditing(e => !e)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', padding: '0.15rem' }}
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
            <span className="mono" style={{ fontSize: 'var(--text-sm)', color: over ? 'var(--color-negative)' : 'var(--color-text-secondary)' }}>
              {formatCurrency(spent)} / {formatCurrency(limit)}
            </span>
            <span className="mono" style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: over ? 'var(--color-negative)' : 'var(--color-text-primary)' }}>
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

// --- Allocation Sliders Component ---
function AllocationSliders({ spend, savings, invest, income, onUpdate, debts, onAiRecommend, aiLoading, aiReason }) {
  const [localSpend, setLocalSpend] = useState(spend)
  const [localSavings, setLocalSavings] = useState(savings)
  const [localInvest, setLocalInvest] = useState(invest)

  // Sync from parent when AI or external update changes props
  useEffect(() => { setLocalSpend(spend) }, [spend])
  useEffect(() => { setLocalSavings(savings) }, [savings])
  useEffect(() => { setLocalInvest(invest) }, [invest])

  const total = localSpend + localSavings + localInvest
  const isValid = total === 100

  const spendAmt = Math.round(income * (localSpend / 100) * 100) / 100
  const savingsAmt = Math.round(income * (localSavings / 100) * 100) / 100
  const investAmt = Math.round(income * (localInvest / 100) * 100) / 100
  const totalDebtPayments = debts.reduce((s, d) => s + (d.min_payment || 0), 0)
  const debtCovered = (spendAmt + savingsAmt) >= totalDebtPayments

  const apply = () => {
    if (isValid) onUpdate(localSpend, localSavings, localInvest)
  }

  const sliderTrack = (color) => ({
    WebkitAppearance: 'none', width: '100%', height: 6, borderRadius: 3,
    background: `linear-gradient(to right, ${color} 0%, ${color} var(--pct), var(--color-surface-2) var(--pct))`,
    outline: 'none', cursor: 'pointer',
  })

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
        <span className="label-caps">Allocation</span>
        <button className="btn btn-ghost" onClick={onAiRecommend} disabled={aiLoading} style={{ fontSize: 'var(--text-sm)', padding: '0.25rem 0.6rem' }}>
          {aiLoading ? 'Thinking...' : 'AI Recommended Split'}
        </button>
      </div>

      {/* Spending Slider */}
      <div style={{ marginBottom: '0.75rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.2rem' }}>
          <span style={{ fontSize: 'var(--text-sm)', fontWeight: 500 }}>Spending</span>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'baseline' }}>
            <span className="mono" style={{ fontSize: 'var(--text-base)', fontWeight: 600 }}>{formatCurrency(spendAmt)}</span>
            <span className="text-faint" style={{ fontSize: 'var(--text-sm)' }}>{localSpend}%</span>
          </div>
        </div>
        <input type="range" min="0" max="100" value={localSpend}
          onChange={e => setLocalSpend(parseInt(e.target.value))}
          style={{ ...sliderTrack('var(--color-negative)'), '--pct': `${localSpend}%` }}
        />
      </div>

      {/* Savings Slider */}
      <div style={{ marginBottom: '0.75rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.2rem' }}>
          <span style={{ fontSize: 'var(--text-sm)', fontWeight: 500 }}>Savings</span>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'baseline' }}>
            <span className="mono" style={{ fontSize: 'var(--text-base)', fontWeight: 600 }}>{formatCurrency(savingsAmt)}</span>
            <span className="text-faint" style={{ fontSize: 'var(--text-sm)' }}>{localSavings}%</span>
          </div>
        </div>
        <input type="range" min="0" max="100" value={localSavings}
          onChange={e => setLocalSavings(parseInt(e.target.value))}
          style={{ ...sliderTrack('var(--color-gold)'), '--pct': `${localSavings}%` }}
        />
      </div>

      {/* Investing Slider */}
      <div style={{ marginBottom: '0.75rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.2rem' }}>
          <span style={{ fontSize: 'var(--text-sm)', fontWeight: 500 }}>Investing</span>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'baseline' }}>
            <span className="mono" style={{ fontSize: 'var(--text-base)', fontWeight: 600 }}>{formatCurrency(investAmt)}</span>
            <span className="text-faint" style={{ fontSize: 'var(--text-sm)' }}>{localInvest}%</span>
          </div>
        </div>
        <input type="range" min="0" max="100" value={localInvest}
          onChange={e => setLocalInvest(parseInt(e.target.value))}
          style={{ ...sliderTrack('var(--color-positive)'), '--pct': `${localInvest}%` }}
        />
      </div>

      {/* Allocation bar */}
      <div style={{ display: 'flex', height: 10, borderRadius: 5, overflow: 'hidden', marginBottom: '0.5rem' }}>
        {localSpend > 0 && <div style={{ width: `${localSpend}%`, background: 'var(--color-negative)', transition: 'width 0.3s' }} />}
        {localSavings > 0 && <div style={{ width: `${localSavings}%`, background: 'var(--color-gold)', transition: 'width 0.3s' }} />}
        {localInvest > 0 && <div style={{ width: `${localInvest}%`, background: 'var(--color-positive)', transition: 'width 0.3s' }} />}
      </div>

      {/* Total indicator + Apply */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
        <span style={{
          fontSize: 'var(--text-sm)', fontWeight: 600,
          color: isValid ? 'var(--color-positive)' : 'var(--color-negative)',
        }}>
          Total: {total}%{!isValid && ` (need ${total < 100 ? `${100 - total}% more` : `${total - 100}% less`})`}
        </span>
        <button className="btn btn-primary" onClick={apply} disabled={!isValid}
          style={{ fontSize: 'var(--text-sm)', padding: '0.3rem 0.75rem', opacity: isValid ? 1 : 0.4 }}>
          Apply
        </button>
      </div>

      {aiReason && (
        <p className="text-faint" style={{ fontSize: 'var(--text-sm)', marginBottom: '0.5rem', fontStyle: 'italic' }}>{aiReason}</p>
      )}

      {/* Debt coverage validation */}
      {debts.length > 0 && totalDebtPayments > 0 && (
        <div style={{
          padding: '0.4rem 0.6rem', borderRadius: 4, marginBottom: '0.5rem',
          background: debtCovered ? 'rgba(46,125,94,0.08)' : 'rgba(139,38,53,0.08)',
          border: `1px solid ${debtCovered ? 'var(--color-positive)' : 'var(--color-negative)'}`,
        }}>
          {debtCovered ? (
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-positive)' }}>
              Debts covered. {formatCurrency(spendAmt + savingsAmt - totalDebtPayments)} left after {formatCurrency(totalDebtPayments)}/mo in payments.
            </p>
          ) : (
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-negative)' }}>
              Spending + Savings ({formatCurrency(spendAmt + savingsAmt)}) doesn't cover your {formatCurrency(totalDebtPayments)}/mo in debt payments. Adjust your split.
            </p>
          )}
        </div>
      )}

      <p className="text-faint" style={{ fontSize: 'var(--text-xs)' }}>
        Debts are paid from the Savings portion. Savings covers emergency fund, debt payoff, and short-term goals.
      </p>
    </div>
  )
}

export default function Budget() {
  const navigate = useNavigate()
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

  // Income & allocation state
  const [incomeConfirmed, setIncomeConfirmed] = useState(null) // null = loading
  const [incomeInput, setIncomeInput] = useState('')
  const [editingIncome, setEditingIncome] = useState(false)
  const [spendPct, setSpendPct] = useState(60)
  const [savingsPct, setSavingsPct] = useState(20)
  const [investPct, setInvestPct] = useState(20)
  const [monthlyIncome, setMonthlyIncome] = useState(0)
  const [aiReason, setAiReason] = useState('')
  const [aiSplitLoading, setAiSplitLoading] = useState(false)

  // Savings tab state
  const [savingsData, setSavingsData] = useState(null)
  const [savingsDepositing, setSavingsDepositing] = useState(false)
  const [graduating, setGraduating] = useState(false)
  const [buckets, setBuckets] = useState([])
  const [newBucketName, setNewBucketName] = useState('')
  const [newBucketTarget, setNewBucketTarget] = useState('')
  const [debtPayId, setDebtPayId] = useState(null)
  const [debtPayAmount, setDebtPayAmount] = useState('')
  const [debtPaying, setDebtPaying] = useState(false)
  const [bucketDepositId, setBucketDepositId] = useState(null)
  const [bucketDepositAmt, setBucketDepositAmt] = useState('')

  // Setup modal state
  const [showSetup, setShowSetup] = useState(false)
  const [setupStep, setSetupStep] = useState(0)
  const [setupIncome, setSetupIncome] = useState('')
  const [setupSpend, setSetupSpend] = useState(60)
  const [setupSavings, setSetupSavings] = useState(20)
  const [setupInvest, setSetupInvest] = useState(20)
  const [setupGoalType, setSetupGoalType] = useState('emergency')
  const [setupGoalName, setSetupGoalName] = useState('')
  const [setupGoalTarget, setSetupGoalTarget] = useState('')

  const monthKey = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}`
  const monthLabel = new Date(viewYear, viewMonth).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  const weeks = getWeeksOfMonth(viewYear, viewMonth)
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

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

  // Check income confirmation for current month
  const checkIncome = useCallback(async () => {
    try {
      const [logRes, savRes] = await Promise.all([
        get(`/api/savings/income-log?month=${currentMonthKey}`),
        get('/api/savings'),
      ])
      const data = logRes.data
      setSavingsData(savRes.data)
      setMonthlyIncome(data.income || data.last_month_income || savRes.data.monthly_income || 0)
      setSpendPct(savRes.data.spend_pct || 60)
      setSavingsPct(savRes.data.savings_pct || 20)
      setInvestPct(savRes.data.invest_pct || 20)
      if (data.confirmed) {
        setIncomeConfirmed(true)
        setIncomeInput(String(data.income))
      } else {
        setIncomeConfirmed(false)
        setIncomeInput(String(data.last_month_income || savRes.data.monthly_income || ''))
      }
      // Show setup modal if user never set income
      if ((savRes.data.monthly_income || 0) === 0 && !data.confirmed) {
        setShowSetup(true)
      }
    } catch {
      setIncomeConfirmed(true) // fail open
    }
  }, [currentMonthKey])

  useEffect(() => { fetchData() }, [viewYear, viewMonth])
  useEffect(() => { checkIncome() }, [checkIncome])

  const confirmIncome = async () => {
    const amt = parseFloat(incomeInput)
    if (!amt || amt <= 0) return
    try {
      await post('/api/savings/income-log', { month: currentMonthKey, income: amt })
      setIncomeConfirmed(true)
      setMonthlyIncome(amt)
      toast('Income confirmed', 'success')
    } catch (err) { toast(err.message || 'Something went wrong', 'error') }
  }

  const saveAllocation = async (s, sa, inv) => {
    setSpendPct(s)
    setSavingsPct(sa)
    setInvestPct(inv)
    try {
      await post('/api/savings/setup', {
        monthly_income: monthlyIncome,
        spend_pct: s, savings_pct: sa, invest_pct: inv,
        savings_goal_name: savingsData?.savings_goal_name || 'Emergency Fund',
        savings_goal_target: savingsData?.savings_goal_target || 0,
      })
    } catch {}
  }

  const requestAiSplit = async () => {
    setAiSplitLoading(true)
    try {
      const user = JSON.parse(localStorage.getItem('atlas_user') || '{}')
      const totalDebtPayments = debts.reduce((s, d) => s + (d.min_payment || 0), 0)
      const res = await post('/api/chat', {
        message: `My monthly income after tax is $${monthlyIncome}. I'm ${user.age || 20} years old. My total monthly debt payments are $${totalDebtPayments}. ${savingsData?.emergency_fund_complete ? 'I already have my emergency fund complete.' : 'I do not have an emergency fund yet.'} Recommend ideal percentages for spending, savings, and investing. The spending and savings portions must cover all debt payments. Prioritize building an emergency fund if one does not exist. Maximize investing given my age and income. Respond ONLY with valid JSON: {"spending": number, "savings": number, "investing": number, "reasoning": "one sentence"}. No other text.`,
        context: 'budget',
      })
      const text = res.data.reply || ''
      const match = text.match(/\{[\s\S]*\}/)
      if (match) {
        const parsed = JSON.parse(match[0])
        const s = parseInt(parsed.spending) || 60
        const sa = parseInt(parsed.savings) || 20
        const inv = parseInt(parsed.investing) || 20
        const total = s + sa + inv
        if (total === 100) {
          saveAllocation(s, sa, inv)
          setAiReason(parsed.reasoning || '')
        }
      }
    } catch { toast('AI recommendation failed', 'error') }
    setAiSplitLoading(false)
  }

  const fetchSavingsData = async () => {
    try {
      const res = await get('/api/savings')
      setSavingsData(res.data)
    } catch {}
  }

  const logSavingsDeposit = async () => {
    if (!savingsData) return
    setSavingsDepositing(true)
    try {
      await post('/api/savings/deposit', { amount: savingsData.savings_amt, note: `${currentMonthKey} savings deposit` })
      await fetchSavingsData()
      toast('Savings deposited', 'success')
    } catch (err) { toast(err.message || 'Something went wrong', 'error') }
    setSavingsDepositing(false)
  }

  const graduateToInvesting = async () => {
    setGraduating(true)
    try {
      const res = await post('/api/savings/graduate', {})
      setInvestPct(res.data.invest_pct)
      setSavingsPct(0)
      await fetchSavingsData()
      toast('Savings allocation moved to investing', 'success')
    } catch (err) { toast(err.message || 'Something went wrong', 'error') }
    setGraduating(false)
  }

  // Bucket functions
  const fetchBuckets = async () => {
    try {
      const res = await get('/api/savings/buckets')
      setBuckets(res.data || [])
    } catch {}
  }

  const createBucket = async () => {
    if (!newBucketName.trim()) return
    try {
      await post('/api/savings/buckets', { name: newBucketName.trim(), target_amount: parseFloat(newBucketTarget) || 0 })
      setNewBucketName('')
      setNewBucketTarget('')
      fetchBuckets()
      toast('Bucket created', 'success')
    } catch (err) { toast(err.response?.data?.error || err.message, 'error') }
  }

  const depositToBucket = async (bucketId) => {
    const amt = parseFloat(bucketDepositAmt)
    if (!amt || amt <= 0) return
    try {
      await post(`/api/savings/buckets/${bucketId}/deposit`, { amount: amt })
      setBucketDepositId(null)
      setBucketDepositAmt('')
      fetchBuckets()
      fetchSavingsData()
      toast('Deposited to bucket', 'success')
    } catch (err) { toast(err.response?.data?.error || err.message, 'error') }
  }

  const deleteBucket = (id) => {
    const b = buckets.find(x => x.id === id)
    setConfirmDialog({
      open: true, danger: true,
      title: 'Delete Bucket',
      message: `Delete "${b?.name}"? Any funds will return to your savings balance.`,
      onConfirm: async () => {
        setConfirmDialog(d => ({ ...d, open: false }))
        try {
          await del(`/api/savings/buckets/${id}`)
          fetchBuckets()
          fetchSavingsData()
          toast('Bucket deleted', 'success')
        } catch (err) { toast(err.message, 'error') }
      }
    })
  }

  const payDebtFromSavings = async (debtId) => {
    const amt = parseFloat(debtPayAmount)
    if (!amt || amt <= 0) return
    setDebtPaying(true)
    try {
      await post('/api/savings/pay-debt', { debt_id: debtId, amount: amt })
      setDebtPayId(null)
      setDebtPayAmount('')
      await Promise.all([fetchSavingsData(), fetchDebts()])
      toast('Debt payment applied', 'success')
    } catch (err) { toast(err.response?.data?.error || err.message, 'error') }
    setDebtPaying(false)
  }

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
        return <strong key={i} style={{ color: 'var(--color-text-primary)' }}>{part.slice(2, -2)}</strong>
      }
      return part
    })
  }

  // Setup modal submission
  const completeSetup = async () => {
    const income = parseFloat(setupIncome)
    if (!income || income <= 0) return
    try {
      const goalName = setupGoalType === 'emergency' ? 'Emergency Fund'
        : setupGoalType === 'specific' ? (setupGoalName || 'My Goal')
        : 'General Savings'
      const goalTarget = setupGoalType === 'emergency'
        ? Math.round(income * (setupSpend / 100) * 3 * 100) / 100
        : setupGoalType === 'specific' ? (parseFloat(setupGoalTarget) || 0)
        : 0
      await post('/api/savings/setup', {
        monthly_income: income,
        spend_pct: setupSpend, savings_pct: setupSavings, invest_pct: setupInvest,
        savings_goal_name: goalName, savings_goal_target: goalTarget,
      })
      await post('/api/savings/income-log', { month: currentMonthKey, income })
      setShowSetup(false)
      setIncomeConfirmed(true)
      setMonthlyIncome(income)
      setSpendPct(setupSpend)
      setSavingsPct(setupSavings)
      setInvestPct(setupInvest)
      await fetchSavingsData()
      toast('Budget set up', 'success')
    } catch (err) { toast(err.message || 'Something went wrong', 'error') }
  }

  const handleSetupSlider = (which, newVal) => {
    newVal = Math.max(0, Math.min(100, newVal))
    if (which === 'spend') setSetupSpend(newVal)
    else if (which === 'savings') setSetupSavings(newVal)
    else setSetupInvest(newVal)
  }
  const setupTotal = setupSpend + setupSavings + setupInvest
  const setupValid = setupTotal === 100

  // Emergency fund months to completion
  const efMonths = savingsData && savingsData.savings_amt > 0 && savingsData.ef_target > savingsData.ef_balance
    ? Math.ceil((savingsData.ef_target - savingsData.ef_balance) / savingsData.savings_amt)
    : 0

  return (
    <div>
      {/* ============ SETUP MODAL ============ */}
      {showSetup && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300 }}>
          <div className="card" style={{ maxWidth: 480, width: '100%', maxHeight: '90vh', overflow: 'auto' }} onClick={e => e.stopPropagation()}>
            {/* Progress dots */}
            <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginBottom: '1.5rem' }}>
              {[0, 1, 2].map(i => (
                <div key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: i <= setupStep ? 'var(--color-gold)' : 'var(--color-border)' }} />
              ))}
            </div>

            {/* Step 1: Income */}
            {setupStep === 0 && (
              <div>
                <h2 style={{ fontSize: 'var(--text-xl)', marginBottom: '0.25rem' }}>What do you bring in each month?</h2>
                <p className="text-faint" style={{ fontSize: 'var(--text-sm)', marginBottom: '1.5rem' }}>After taxes and deductions</p>
                <div style={{ position: 'relative', marginBottom: '1.5rem' }}>
                  <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 'var(--text-2xl)', color: 'var(--color-text-muted)' }}>$</span>
                  <input className="input mono" type="number" value={setupIncome} onChange={e => setSetupIncome(e.target.value)}
                    placeholder="0" autoFocus
                    style={{ fontSize: 'var(--text-2xl)', padding: '0.75rem 1rem 0.75rem 2rem', width: '100%', textAlign: 'center' }}
                  />
                  <span style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>/month</span>
                </div>
                <button className="btn btn-primary" style={{ width: '100%' }} disabled={!setupIncome || parseFloat(setupIncome) <= 0}
                  onClick={() => setSetupStep(1)}>
                  Continue
                </button>
              </div>
            )}

            {/* Step 2: Allocation */}
            {setupStep === 1 && (
              <div>
                <h2 style={{ fontSize: 'var(--text-xl)', marginBottom: '0.25rem' }}>How do you want to split it?</h2>
                <p className="text-faint" style={{ fontSize: 'var(--text-sm)', marginBottom: '1rem' }}>Drag the sliders — they must add to 100%</p>
                <AllocationSliders
                  spend={setupSpend} savings={setupSavings} invest={setupInvest}
                  income={parseFloat(setupIncome) || 0}
                  onUpdate={(s, sa, inv) => { setSetupSpend(s); setSetupSavings(sa); setSetupInvest(inv) }}
                  debts={debts}
                  onAiRecommend={async () => {
                    setAiSplitLoading(true)
                    try {
                      const user = JSON.parse(localStorage.getItem('atlas_user') || '{}')
                      const totalDebtPayments = debts.reduce((s, d) => s + (d.min_payment || 0), 0)
                      const res = await post('/api/chat', {
                        message: `My monthly income after tax is $${setupIncome}. I'm ${user.age || 20} years old. My total monthly debt payments are $${totalDebtPayments}. I do not have an emergency fund yet. Recommend ideal percentages for spending, savings, and investing. The spending and savings portions must cover all debt payments. Prioritize building an emergency fund if one does not exist. Maximize investing given my age and income. Respond ONLY with valid JSON: {"spending": number, "savings": number, "investing": number, "reasoning": "one sentence"}. No other text.`,
                        context: 'budget',
                      })
                      const text = res.data.reply || ''
                      const match = text.match(/\{[\s\S]*\}/)
                      if (match) {
                        const parsed = JSON.parse(match[0])
                        const s = parseInt(parsed.spending) || 60
                        const sa = parseInt(parsed.savings) || 20
                        const inv = parseInt(parsed.investing) || 20
                        if (s + sa + inv === 100) {
                          setSetupSpend(s); setSetupSavings(sa); setSetupInvest(inv)
                          setAiReason(parsed.reasoning || '')
                        }
                      }
                    } catch {}
                    setAiSplitLoading(false)
                  }}
                  aiLoading={aiSplitLoading}
                  aiReason={aiReason}
                />
                {!setupValid && (
                  <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-negative)', marginTop: '0.5rem', textAlign: 'center' }}>
                    Total is {setupTotal}% — must equal 100%
                  </p>
                )}
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                  <button className="btn btn-ghost" onClick={() => setSetupStep(0)} style={{ flex: 1 }}>Back</button>
                  <button className="btn btn-primary" onClick={() => setSetupStep(2)} disabled={!setupValid} style={{ flex: 1, opacity: setupValid ? 1 : 0.4 }}>Continue</button>
                </div>
              </div>
            )}

            {/* Step 3: Savings goal */}
            {setupStep === 2 && (
              <div>
                <h2 style={{ fontSize: 'var(--text-xl)', marginBottom: '0.25rem' }}>What are you saving for?</h2>
                <p className="text-faint" style={{ fontSize: 'var(--text-sm)', marginBottom: '1rem' }}>This sets your savings goal</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
                  <button onClick={() => setSetupGoalType('emergency')} style={{
                    padding: '0.75rem 1rem', borderRadius: 4, cursor: 'pointer', textAlign: 'left',
                    border: setupGoalType === 'emergency' ? '2px solid var(--color-gold)' : '1px solid var(--color-border)',
                    background: setupGoalType === 'emergency' ? 'var(--color-gold-15)' : 'var(--color-surface)',
                  }}>
                    <strong style={{ display: 'block' }}>Emergency Fund</strong>
                    <span className="text-faint" style={{ fontSize: 'var(--text-sm)' }}>
                      Target: {formatCurrency(Math.round((parseFloat(setupIncome) || 0) * (setupSpend / 100) * 3))} (3 months of expenses)
                    </span>
                  </button>
                  <button onClick={() => setSetupGoalType('specific')} style={{
                    padding: '0.75rem 1rem', borderRadius: 4, cursor: 'pointer', textAlign: 'left',
                    border: setupGoalType === 'specific' ? '2px solid var(--color-gold)' : '1px solid var(--color-border)',
                    background: setupGoalType === 'specific' ? 'var(--color-gold-15)' : 'var(--color-surface)',
                  }}>
                    <strong style={{ display: 'block' }}>A Specific Goal</strong>
                    <span className="text-faint" style={{ fontSize: 'var(--text-sm)' }}>Name it and set a dollar target</span>
                  </button>
                  {setupGoalType === 'specific' && (
                    <div style={{ display: 'flex', gap: '0.5rem', paddingLeft: '0.5rem' }}>
                      <input className="input" placeholder="Goal name" value={setupGoalName} onChange={e => setSetupGoalName(e.target.value)} style={{ flex: 1 }} />
                      <input className="input" type="number" placeholder="$0" value={setupGoalTarget} onChange={e => setSetupGoalTarget(e.target.value)} style={{ width: 100 }} />
                    </div>
                  )}
                  <button onClick={() => setSetupGoalType('general')} style={{
                    padding: '0.75rem 1rem', borderRadius: 4, cursor: 'pointer', textAlign: 'left',
                    border: setupGoalType === 'general' ? '2px solid var(--color-gold)' : '1px solid var(--color-border)',
                    background: setupGoalType === 'general' ? 'var(--color-gold-15)' : 'var(--color-surface)',
                  }}>
                    <strong style={{ display: 'block' }}>General Savings</strong>
                    <span className="text-faint" style={{ fontSize: 'var(--text-sm)' }}>No specific goal — just building a buffer</span>
                  </button>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button className="btn btn-ghost" onClick={() => setSetupStep(1)} style={{ flex: 1 }}>Back</button>
                  <button className="btn btn-primary" onClick={completeSetup} style={{ flex: 1 }}>Finish Setup</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============ PAGE HEADER ============ */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
        <div>
          <h1 style={{ fontSize: 'var(--text-3xl)', marginBottom: '0.15rem' }}>Budget</h1>
          <p className="label-caps">{monthLabel}</p>
        </div>

        {/* Income display / edit — top right */}
        {incomeConfirmed !== null && !showSetup && (
          <div style={{ textAlign: 'right' }}>
            {(editingIncome || incomeConfirmed === false) ? (
              <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>$</span>
                  <input className="input mono" type="number" value={incomeInput} onChange={e => setIncomeInput(e.target.value)}
                    placeholder="0" style={{ paddingLeft: '1.4rem', width: 130, fontSize: 'var(--text-sm)', padding: '0.35rem 0.5rem 0.35rem 1.4rem' }}
                    onKeyDown={e => { if (e.key === 'Enter') { confirmIncome(); setEditingIncome(false) } if (e.key === 'Escape') setEditingIncome(false) }}
                    autoFocus
                  />
                </div>
                <button className="btn btn-primary" style={{ fontSize: 'var(--text-sm)', padding: '0.35rem 0.6rem' }}
                  onClick={() => { confirmIncome(); setEditingIncome(false) }}>
                  {incomeConfirmed === false ? 'Confirm' : 'Save'}
                </button>
                {incomeConfirmed && (
                  <button className="btn btn-ghost" style={{ fontSize: 'var(--text-sm)', padding: '0.35rem 0.5rem' }}
                    onClick={() => { setIncomeInput(String(monthlyIncome)); setEditingIncome(false) }}>
                    Cancel
                  </button>
                )}
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}
                onClick={() => setEditingIncome(true)} title="Click to edit income">
                <div>
                  <span className="label-caps" style={{ display: 'block', marginBottom: '0.1rem' }}>Monthly Income</span>
                  <span className="mono" style={{ fontSize: 'var(--text-xl)', fontWeight: 600 }}>{formatCurrency(monthlyIncome)}</span>
                </div>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginTop: '0.8rem' }}>
                  <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
              </div>
            )}
            {incomeConfirmed === false && (
              <p className="text-faint" style={{ fontSize: 'var(--text-xs)', marginTop: '0.25rem' }}>
                Confirm this month's income to get started
              </p>
            )}
          </div>
        )}
      </div>

      {/* ============ ALLOCATION SLIDERS ============ */}
      {incomeConfirmed && monthlyIncome > 0 && (
        <div className="card" style={{ marginBottom: 'var(--space-lg)' }}>
          <AllocationSliders
            spend={spendPct} savings={savingsPct} invest={investPct}
            income={monthlyIncome}
            onUpdate={saveAllocation}
            debts={debts}
            onAiRecommend={requestAiSplit}
            aiLoading={aiSplitLoading}
            aiReason={aiReason}
          />
        </div>
      )}

      {/* ============ TABS ============ */}
      <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '1.5rem', borderBottom: '2px solid var(--color-border)' }}>
        {[
          { key: 'calendar', label: 'Calendar' },
          { key: 'savings', label: 'Savings' },
          { key: 'debt', label: 'Debt' },
          { key: 'import', label: 'Import' },
          { key: 'chat', label: 'AI Chat' },
        ].map(t => (
          <button key={t.key} onClick={() => { setTab(t.key); if (t.key === 'savings') { fetchSavingsData(); fetchBuckets() } }} style={{
            padding: '0.6rem 1.25rem', border: 'none',
            borderBottom: tab === t.key ? '2px solid var(--color-gold)' : '2px solid transparent',
            background: 'none', cursor: 'pointer', fontWeight: tab === t.key ? 600 : 400,
            color: tab === t.key ? 'var(--color-gold)' : 'var(--color-text-secondary)',
            fontSize: 'var(--text-base)', marginBottom: '-2px', transition: 'all 0.15s ease',
          }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ============ SAVINGS TAB ============ */}
      {tab === 'savings' && (
        <>
          {/* Section 1: Allocation summary */}
          <div className="card" style={{ marginBottom: '1rem' }}>
            <div style={{ display: 'flex', height: 10, borderRadius: 5, overflow: 'hidden', marginBottom: '0.75rem' }}>
              {spendPct > 0 && <div style={{ width: `${spendPct}%`, background: 'var(--color-negative)' }} />}
              {savingsPct > 0 && <div style={{ width: `${savingsPct}%`, background: 'var(--color-gold)' }} />}
              {investPct > 0 && <div style={{ width: `${investPct}%`, background: 'var(--color-positive)' }} />}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem', textAlign: 'center' }}>
              <div>
                <p className="label-caps">Spending</p>
                <span className="mono" style={{ fontSize: 'var(--text-xl)', display: 'block' }}>{formatCurrency(Math.round(monthlyIncome * spendPct / 100))}</span>
                <span className="text-faint" style={{ fontSize: 'var(--text-sm)' }}>{spendPct}%</span>
              </div>
              <div>
                <p className="label-caps">Savings</p>
                <span className="mono" style={{ fontSize: 'var(--text-xl)', display: 'block' }}>{formatCurrency(Math.round(monthlyIncome * savingsPct / 100))}</span>
                <span className="text-faint" style={{ fontSize: 'var(--text-sm)' }}>{savingsPct}%</span>
              </div>
              <div>
                <p className="label-caps">Investing</p>
                <span className="mono" style={{ fontSize: 'var(--text-xl)', display: 'block' }}>{formatCurrency(Math.round(monthlyIncome * investPct / 100))}</span>
                <span className="text-faint" style={{ fontSize: 'var(--text-sm)' }}>{investPct}%</span>
              </div>
            </div>
            <p className="text-faint" style={{ fontSize: 'var(--text-xs)', textAlign: 'center', marginTop: '0.5rem' }}>
              Debts are paid from the Savings portion. Savings covers emergency fund, debt payoff, and short-term goals.
            </p>
          </div>

          {/* Section 2: Total saved + Emergency fund */}
          <div className="card" style={{ marginBottom: '1rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', alignItems: 'start' }}>
              <div>
                <p className="label-caps">Total Saved</p>
                <span className="mono" style={{ fontSize: 'var(--text-3xl)', display: 'block', marginTop: '0.25rem' }}>
                  {formatCurrency(savingsData?.savings_balance || 0)}
                </span>
              </div>
              <div>
                <p className="label-caps">{savingsData?.savings_goal_name || 'Emergency Fund'}</p>
                <div className="progress-bar" style={{ height: 8, marginTop: '0.5rem' }}>
                  <div className="progress-bar-fill" style={{
                    width: `${savingsData?.ef_pct || 0}%`,
                    background: (savingsData?.ef_pct || 0) >= 100 ? 'var(--color-positive)' : 'var(--color-gold)',
                    transition: 'width 0.8s ease',
                  }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.25rem' }}>
                  <span className="text-faint" style={{ fontSize: 'var(--text-sm)' }}>{(savingsData?.ef_pct || 0).toFixed(0)}%</span>
                  <span className="text-faint mono" style={{ fontSize: 'var(--text-sm)' }}>
                    {formatCurrency(savingsData?.ef_balance || 0)} / {formatCurrency(savingsData?.ef_target || 0)}
                  </span>
                </div>
                {efMonths > 0 && (
                  <p className="text-faint" style={{ fontSize: 'var(--text-xs)', marginTop: '0.15rem' }}>
                    {efMonths} month{efMonths !== 1 ? 's' : ''} to fully fund at current rate
                  </p>
                )}
              </div>
            </div>

            <button className="btn btn-primary" onClick={logSavingsDeposit} disabled={savingsDepositing || !savingsData?.savings_amt}
              style={{ marginTop: '1rem', width: '100%' }}>
              {savingsDepositing ? 'Depositing...' : `Log This Month's Savings (${formatCurrency(savingsData?.savings_amt || 0)})`}
            </button>

            {/* Graduation banner */}
            {savingsData?.emergency_fund_complete && (
              <div style={{
                marginTop: '1rem', padding: '0.75rem', borderRadius: 4,
                background: 'rgba(46,125,94,0.08)', border: '1px solid var(--color-positive)',
              }}>
                <p style={{ fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--color-positive)', marginBottom: '0.5rem' }}>
                  Emergency fund complete!
                </p>
                <p className="text-faint" style={{ fontSize: 'var(--text-sm)', marginBottom: '0.75rem' }}>
                  Your {formatCurrency(savingsData.ef_target)} target is funded. You can move your savings allocation to investing or set a new goal.
                </p>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button className="btn btn-primary" onClick={graduateToInvesting} disabled={graduating} style={{ flex: 1 }}>
                    {graduating ? 'Moving...' : 'Move to Investing'}
                  </button>
                  <button className="btn btn-ghost" onClick={() => setTab('calendar')} style={{ flex: 1 }}>Set New Goal</button>
                </div>
              </div>
            )}
          </div>

          {/* Section 3: Debt payoff from savings */}
          <div className="card" style={{ marginBottom: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <h3 style={{ fontSize: 'var(--text-lg)' }}>Pay Off Debt From Savings</h3>
              <button className="btn btn-ghost" onClick={() => setTab('debt')} style={{ fontSize: 'var(--text-sm)', padding: '0.2rem 0.5rem' }}>
                Manage Debts
              </button>
            </div>
            {debts.filter(d => d.balance > 0).length > 0 ? debts.filter(d => d.balance > 0).map(d => {
              const origAmt = d.original_amount || d.balance
              const paidOff = origAmt > 0 ? Math.max(0, origAmt - d.balance) : 0
              const debtPct = origAmt > 0 ? Math.min(100, (paidOff / origAmt) * 100) : 0
              return (
                <div key={d.id} style={{ padding: '0.6rem 0', borderBottom: '1px solid var(--color-border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                    <span style={{ fontSize: 'var(--text-base)', fontWeight: 500 }}>{d.name}</span>
                    <span className="mono" style={{ fontSize: 'var(--text-base)' }}>{formatCurrency(d.balance)}</span>
                  </div>
                  <div className="progress-bar" style={{ height: 5, marginBottom: '0.35rem' }}>
                    <div className="progress-bar-fill" style={{ width: `${debtPct}%`, background: 'var(--color-navy)', transition: 'width 0.8s ease' }} />
                  </div>
                  {debtPayId === d.id ? (
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '0.25rem' }}>
                      <div style={{ position: 'relative', flex: 1 }}>
                        <span style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }}>$</span>
                        <input className="input mono" type="number" step="0.01" value={debtPayAmount}
                          onChange={e => setDebtPayAmount(e.target.value)} placeholder="0"
                          style={{ paddingLeft: '1.25rem', width: '100%' }}
                          onKeyDown={e => e.key === 'Enter' && payDebtFromSavings(d.id)} />
                      </div>
                      <button className="btn btn-primary" onClick={() => payDebtFromSavings(d.id)} disabled={debtPaying}
                        style={{ fontSize: 'var(--text-sm)' }}>
                        {debtPaying ? '...' : 'Pay'}
                      </button>
                      <button className="btn btn-ghost" onClick={() => setDebtPayId(null)} style={{ fontSize: 'var(--text-sm)' }}>Cancel</button>
                    </div>
                  ) : (
                    <button className="btn btn-ghost" onClick={() => { setDebtPayId(d.id); setDebtPayAmount('') }}
                      style={{ fontSize: 'var(--text-xs)', padding: '0.15rem 0.4rem', marginTop: '0.15rem' }}>
                      Pay from savings
                    </button>
                  )}
                </div>
              )
            }) : (
              <div style={{ padding: '0.75rem', borderRadius: 4, background: 'rgba(46,125,94,0.08)', border: '1px solid var(--color-positive)' }}>
                <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-positive)', fontWeight: 600 }}>
                  {debts.length > 0 ? 'All debts paid off!' : 'No debts — you\'re debt free!'}
                </p>
              </div>
            )}
          </div>

          {/* Section 4: Savings Buckets */}
          <div className="card">
            <h3 style={{ fontSize: 'var(--text-lg)', marginBottom: '0.75rem' }}>Savings Buckets</h3>
            <p className="text-faint" style={{ fontSize: 'var(--text-xs)', marginBottom: '0.75rem' }}>
              {debts.filter(d => d.balance > 0).length > 0
                ? 'Pay off all debts before creating savings buckets.'
                : 'Organize your savings into specific goals.'}
            </p>

            {/* Emergency Fund Bucket (pre-calculated) */}
            {savingsData && (
              <div style={{ padding: '0.75rem', borderRadius: 4, border: '1px solid var(--color-border)', marginBottom: '0.5rem', background: 'var(--color-surface-2)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                  <span style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>Emergency Fund</span>
                  <span className="mono text-faint" style={{ fontSize: 'var(--text-sm)' }}>
                    {formatCurrency(savingsData.ef_balance || 0)} / {formatCurrency(savingsData.ef_target || 0)}
                  </span>
                </div>
                <div className="progress-bar" style={{ height: 6 }}>
                  <div className="progress-bar-fill" style={{
                    width: `${savingsData.ef_pct || 0}%`,
                    background: (savingsData.ef_pct || 0) >= 100 ? 'var(--color-positive)' : 'var(--color-gold)',
                  }} />
                </div>
                <p className="text-faint" style={{ fontSize: 'var(--text-xs)', marginTop: '0.2rem' }}>
                  3x monthly spending ({formatCurrency(savingsData.ef_target || 0)})
                </p>
              </div>
            )}

            {/* Custom Buckets */}
            {buckets.map(b => {
              const bPct = b.target_amount > 0 ? Math.min(100, (b.current_amount / b.target_amount) * 100) : (b.current_amount > 0 ? 100 : 0)
              return (
                <div key={b.id} style={{ padding: '0.75rem', borderRadius: 4, border: '1px solid var(--color-border)', marginBottom: '0.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                    <span style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>{b.name}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span className="mono text-faint" style={{ fontSize: 'var(--text-sm)' }}>
                        {formatCurrency(b.current_amount)}{b.target_amount > 0 ? ` / ${formatCurrency(b.target_amount)}` : ''}
                      </span>
                      <button onClick={() => deleteBucket(b.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', fontSize: 'var(--text-base)' }}>×</button>
                    </div>
                  </div>
                  {b.target_amount > 0 && (
                    <div className="progress-bar" style={{ height: 6, marginBottom: '0.25rem' }}>
                      <div className="progress-bar-fill" style={{ width: `${bPct}%`, background: bPct >= 100 ? 'var(--color-positive)' : 'var(--color-gold)' }} />
                    </div>
                  )}
                  {bucketDepositId === b.id ? (
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '0.25rem' }}>
                      <div style={{ position: 'relative', flex: 1 }}>
                        <span style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }}>$</span>
                        <input className="input mono" type="number" step="0.01" value={bucketDepositAmt}
                          onChange={e => setBucketDepositAmt(e.target.value)} placeholder="0"
                          style={{ paddingLeft: '1.25rem', width: '100%' }}
                          onKeyDown={e => e.key === 'Enter' && depositToBucket(b.id)} />
                      </div>
                      <button className="btn btn-primary" onClick={() => depositToBucket(b.id)} style={{ fontSize: 'var(--text-sm)' }}>Add</button>
                      <button className="btn btn-ghost" onClick={() => setBucketDepositId(null)} style={{ fontSize: 'var(--text-sm)' }}>Cancel</button>
                    </div>
                  ) : (
                    <button className="btn btn-ghost" onClick={() => { setBucketDepositId(b.id); setBucketDepositAmt('') }}
                      style={{ fontSize: 'var(--text-xs)', padding: '0.15rem 0.4rem' }}>
                      Add funds
                    </button>
                  )}
                </div>
              )
            })}

            {/* Create new bucket */}
            {debts.filter(d => d.balance > 0).length === 0 && (
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', alignItems: 'flex-end' }}>
                <div style={{ flex: 1 }}>
                  <label className="text-faint" style={{ fontSize: 'var(--text-xs)', display: 'block', marginBottom: 2 }}>Bucket Name</label>
                  <input className="input" value={newBucketName} onChange={e => setNewBucketName(e.target.value)}
                    placeholder="e.g. New Car" style={{ width: '100%' }} />
                </div>
                <div style={{ width: 100 }}>
                  <label className="text-faint" style={{ fontSize: 'var(--text-xs)', display: 'block', marginBottom: 2 }}>Target $</label>
                  <input className="input" type="number" value={newBucketTarget} onChange={e => setNewBucketTarget(e.target.value)}
                    placeholder="0" style={{ width: '100%' }} />
                </div>
                <button className="btn btn-primary" onClick={createBucket} disabled={!newBucketName.trim()}
                  style={{ fontSize: 'var(--text-sm)', height: 36 }}>Create</button>
              </div>
            )}
          </div>
        </>
      )}

      {/* ============ AI CHAT TAB ============ */}
      {tab === 'chat' && (
        <PageChat
          context="budget"
          systemPrompt={`You are Atlas, a financial coach helping a young investor understand their spending.\nThe user's budget data for ${monthLabel}:\n${CATEGORIES.filter(c => c !== 'Income' && c !== 'Transfer').map(c => `- ${c}: spent $${(spendingByCategory[c] || 0).toFixed(2)} of $${(goals[c] || 0)} budget (${goals[c] ? Math.round(((spendingByCategory[c] || 0) / goals[c]) * 100) : 0}%)`).join('\n')}\nMonthly income: $${monthlyIncome}\nAllocation: ${spendPct}% spending, ${savingsPct}% savings, ${investPct}% investing\nBe direct, specific, and encouraging. Reference their actual numbers. Keep responses under 4 sentences.`}
          suggestedPrompts={['Help me import my bank transactions', 'Where am I overspending this month?', 'How can I free up more to invest?']}
        />
      )}

      {/* ============ DEBT TAB ============ */}
      {tab === 'debt' && (
        <>
          {/* Add Debt Form */}
          <div className="card" style={{ marginBottom: '1rem' }}>
            <h3 style={{ fontSize: 'var(--text-lg)', marginBottom: '0.75rem' }}>Add a Debt</h3>
            <form onSubmit={addDebt} style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div style={{ flex: '1 1 140px' }}>
                <label style={{ display: 'block', color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Name</label>
                <input className="input" placeholder="e.g. Visa Card" value={debtForm.name} onChange={e => setDebtForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div style={{ flex: '0 1 110px' }}>
                <label style={{ display: 'block', color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Balance</label>
                <input className="input" type="number" step="0.01" placeholder="$0" value={debtForm.balance} onChange={e => setDebtForm(f => ({ ...f, balance: e.target.value }))} />
              </div>
              <div style={{ flex: '0 1 90px' }}>
                <label style={{ display: 'block', color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.05em' }}>APR %</label>
                <input className="input" type="number" step="0.1" placeholder="0%" value={debtForm.interest_rate} onChange={e => setDebtForm(f => ({ ...f, interest_rate: e.target.value }))} />
              </div>
              <div style={{ flex: '0 1 110px' }}>
                <label style={{ display: 'block', color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Min Payment</label>
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
                  <label style={{ display: 'block', color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Payoff Strategy</label>
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
                  <label style={{ display: 'block', color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Extra Monthly Payment</label>
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }}>$</span>
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
                <h4 style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.35rem' }}>Total Interest</h4>
                <span className="mono" style={{ fontSize: 'var(--text-2xl)', color: 'var(--color-negative)' }}>
                  {formatCurrency(debtPlan.totalInterest)}
                </span>
              </div>
              <div className="card" style={{ textAlign: 'center' }}>
                <h4 style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.35rem' }}>Debt-Free By</h4>
                <span className="mono" style={{ fontSize: 'var(--text-2xl)', color: 'var(--color-navy)' }}>
                  {formatDebtDate(debtPlan.debtFreeDate)}
                </span>
                <p className="text-faint" style={{ fontSize: 'var(--text-sm)' }}>{formatMonths(debtPlan.monthsToFreedom)}</p>
              </div>
              <div className="card" style={{ textAlign: 'center' }}>
                <h4 style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.35rem' }}>
                  {debtPlan.interestSaved > 0 ? 'You Save' : 'Extra Payment'}
                </h4>
                {debtPlan.interestSaved > 0 ? (
                  <>
                    <span className="mono" style={{ fontSize: 'var(--text-2xl)', color: 'var(--color-positive)' }}>
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

          {/* Debts List */}
          {debts.length > 0 && (
            <div className="card" style={{ marginBottom: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <h3 style={{ fontSize: 'var(--text-lg)' }}>Your Debts</h3>
                <span className="mono" style={{ fontSize: 'var(--text-xl)', color: 'var(--color-negative)', fontWeight: 600 }}>
                  Total: {formatCurrency(totalDebt)}
                </span>
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
                          fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)',
                          transform: isExpanded ? 'rotate(90deg)' : 'none',
                          transition: 'transform 0.15s', display: 'inline-block',
                        }}>&#9654;</span>
                        <span style={{ fontSize: 'var(--text-base)', fontWeight: 500, color: 'var(--color-gold)', textDecoration: 'none' }}>{d.name}</span>
                        <span className="text-faint" style={{ fontSize: 'var(--text-sm)' }}>{d.interest_rate}% APR</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        {isFullyPaid ? (
                          <span className="mono" style={{ fontSize: 'var(--text-base)', color: 'var(--color-positive)', fontWeight: 600 }}>Paid off</span>
                        ) : (
                          <>
                            <span className="mono" style={{ fontSize: 'var(--text-base)', color: 'var(--color-negative)' }}>{formatCurrency(d.balance)}</span>
                            <span className="text-faint" style={{ fontSize: 'var(--text-sm)' }}>{formatCurrency(d.min_payment)}/mo</span>
                          </>
                        )}
                        <button className="btn-paid-off" onClick={(e) => { e.stopPropagation(); deleteDebt(d.id) }}>
                          Paid Off
                        </button>
                      </div>
                    </div>
                    {/* Progress bar */}
                    <div style={{ padding: '0 0 0.6rem 0' }}>
                      <div className="progress-bar" style={{ height: 6 }}>
                        <div className="progress-bar-fill" style={{
                          width: `${debtPct}%`,
                          background: isFullyPaid ? 'var(--color-positive)' : 'var(--color-navy)',
                          transition: 'width 0.8s ease',
                        }} />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.2rem' }}>
                        <span className="text-faint" style={{ fontSize: 'var(--text-xs)' }}>
                          {isFullyPaid ? 'Paid off' : `${debtPct.toFixed(0)}% paid`}
                        </span>
                        <span className="text-faint mono" style={{ fontSize: 'var(--text-xs)' }}>
                          {formatCurrency(paidOff)} of {formatCurrency(origAmt)}
                        </span>
                      </div>
                    </div>

                    {/* Expanded Statistics */}
                    {isExpanded && planData && (
                      <div style={{ padding: '0 0 1rem 1.5rem' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem', marginBottom: '0.75rem' }}>
                          <div style={{ padding: '0.75rem', background: 'var(--color-surface)', borderRadius: 2, border: '1px solid var(--color-border)' }}>
                            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>Monthly Payment</p>
                            <span className="mono" style={{ fontSize: 'var(--text-xl)', fontWeight: 600 }}>{formatCurrency(planData.monthlyPayment)}</span>
                          </div>
                          <div style={{ padding: '0.75rem', background: 'var(--color-surface)', borderRadius: 2, border: '1px solid var(--color-border)' }}>
                            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>Payoff Timeline</p>
                            <span className="mono" style={{ fontSize: 'var(--text-xl)', fontWeight: 600 }}>{formatMonths(planData.monthsToPayoff)}</span>
                          </div>
                          <div style={{ padding: '0.75rem', background: 'var(--color-surface)', borderRadius: 2, border: '1px solid var(--color-border)' }}>
                            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>Total Interest</p>
                            <span className="mono" style={{ fontSize: 'var(--text-xl)', fontWeight: 600, color: 'var(--color-negative)' }}>{formatCurrency(planData.totalInterest)}</span>
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
              <p style={{ fontSize: 'var(--text-base)', color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
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

      {/* ============ IMPORT TAB ============ */}
      {tab === 'import' && (
        <>
          <div className="card" style={{ marginBottom: '1.5rem' }}>
            <div
              onDragOver={(e) => { e.preventDefault(); setDragActive(true) }}
              onDragLeave={() => setDragActive(false)}
              onDrop={(e) => { e.preventDefault(); setDragActive(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f) }}
              onClick={() => fileRef.current?.click()}
              style={{
                border: `2px dashed ${dragActive ? 'var(--color-gold)' : 'var(--color-border-dark)'}`,
                borderRadius: 8, padding: '2rem', textAlign: 'center', cursor: 'pointer',
                background: dragActive ? 'var(--color-gold-light)' : 'transparent',
                transition: 'all 0.15s ease',
              }}
            >
              <p style={{ fontSize: 'var(--text-lg)', color: 'var(--color-text-secondary)' }}>Drop your bank CSV here, or click to browse</p>
              <input ref={fileRef} type="file" accept=".csv" onChange={(e) => { const f = e.target.files[0]; if (f) handleFile(f) }} style={{ display: 'none' }} />
            </div>

            <button className="btn btn-ghost" onClick={() => setShowGuide(!showGuide)} style={{ marginTop: '0.75rem', fontSize: 'var(--text-sm)' }}>
              {showGuide ? 'Hide' : 'How to export your CSV'}
            </button>

            {showGuide && (
              <div style={{ marginTop: '0.75rem', padding: '1rem', background: 'var(--color-surface-2)', borderRadius: 8, fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>
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
                          <td className="mono" style={{ color: t.amount < 0 ? 'var(--color-negative)' : 'var(--color-positive)' }}>{formatCurrency(t.amount)}</td>
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
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: analysisLoading ? 'var(--color-gold)' : 'var(--color-positive)' }} />
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
                <div style={{ fontSize: 'var(--text-base)', lineHeight: 1.7, color: 'var(--color-text-primary)' }}>
                  {analysis.split('\n').map((line, i) => {
                    if (line.startsWith('## ')) return <h3 key={i} style={{ color: 'var(--color-gold)', marginTop: i > 0 ? '1.25rem' : 0, marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: 'var(--text-sm)' }}>{line.replace('## ', '')}</h3>
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

      {/* ============ CALENDAR TAB ============ */}
      {tab === 'calendar' && (
        <>
          {/* Month Selector */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1.5rem', marginBottom: '1.5rem' }}>
            <button className="btn btn-ghost" onClick={prevMonth} style={{ fontSize: 'var(--text-xl)', padding: '0.25rem 0.75rem' }}>&lt;</button>
            <h2 style={{ fontSize: 'var(--text-xl)', minWidth: 200, textAlign: 'center' }}>{monthLabel}</h2>
            <button className="btn btn-ghost" onClick={nextMonth} style={{ fontSize: 'var(--text-xl)', padding: '0.25rem 0.75rem' }}>&gt;</button>
          </div>

          {/* Spending Allocation Bar */}
          {monthlyIncome > 0 && spendPct > 0 && (() => {
            const spendAllocation = Math.round(monthlyIncome * spendPct / 100)
            const spendBarPct = spendAllocation > 0 ? Math.min(100, (totalSpent / spendAllocation) * 100) : 0
            const isOver = totalSpent > spendAllocation
            return (
              <div className="card" style={{ marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <span className="label-caps">Spending Budget</span>
                  <span className="mono" style={{ fontSize: 'var(--text-sm)', color: isOver ? 'var(--color-negative)' : 'var(--color-text-primary)' }}>
                    {formatCurrency(totalSpent)} / {formatCurrency(spendAllocation)}
                  </span>
                </div>
                <div className="progress-bar" style={{ height: 12, borderRadius: 6 }}>
                  <div className="progress-bar-fill" style={{
                    width: `${spendBarPct}%`,
                    background: isOver ? 'var(--color-negative)' : spendBarPct > 85 ? 'var(--color-gold)' : 'var(--color-positive)',
                    borderRadius: 6, transition: 'width 0.5s ease',
                  }} />
                </div>
                <p className="text-faint" style={{ fontSize: 'var(--text-xs)', marginTop: '0.35rem' }}>
                  {isOver
                    ? `Over budget by ${formatCurrency(totalSpent - spendAllocation)}`
                    : `${formatCurrency(spendAllocation - totalSpent)} remaining this month`
                  }
                </p>
              </div>
            )
          })()}

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
                        <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', transform: isOpen ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }}>&#9654;</span>
                        <span style={{ fontSize: 'var(--text-base)', fontWeight: 500 }}>{week.label}</span>
                        <span className="text-muted" style={{ fontSize: 'var(--text-sm)' }}>
                          {weekTxns.length} {weekTxns.length === 1 ? 'entry' : 'entries'}
                        </span>
                      </div>
                      <span className="mono" style={{ fontSize: 'var(--text-base)', color: wTotal > 0 ? 'var(--color-negative)' : 'var(--color-text-secondary)' }}>
                        {wTotal > 0 ? `-${formatCurrency(wTotal)}` : '$0.00'}
                      </span>
                    </div>

                    {isOpen && (
                      <div style={{ padding: '0.75rem 1rem', borderTop: '1px solid var(--color-border)' }}>
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
                                      color: CATEGORY_COLORS[t.category] || 'var(--color-text-secondary)',
                                    }}
                                  >
                                    {t.category}
                                  </span>
                                )}
                                <span className="mono" style={{
                                  minWidth: 65, textAlign: 'right',
                                  color: t.amount < 0 ? 'var(--color-negative)' : 'var(--color-positive)',
                                }}>
                                  {formatCurrency(t.amount)}
                                </span>
                                <button
                                  onClick={() => deleteTransaction(t.id)}
                                  style={{
                                    background: 'none', border: 'none', cursor: 'pointer',
                                    color: 'var(--color-text-secondary)', fontSize: 'var(--text-base)', padding: '0 0.25rem',
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
                            <label style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Date</label>
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
                            <label style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Description</label>
                            <input
                              className="input"
                              placeholder="What did you spend on?"
                              value={addForm.description}
                              onChange={e => setAddForm(f => ({ ...f, description: e.target.value }))}
                              style={{ fontSize: 'var(--text-sm)', display: 'block', marginTop: '0.2rem', width: '100%' }}
                            />
                          </div>
                          <div style={{ flex: '0 0 80px' }}>
                            <label style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Amount</label>
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
                            <label style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Category</label>
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
                <span className="mono" style={{ fontSize: 'var(--text-2xl)', color: 'var(--color-negative)' }}>
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
                  <span className="mono" style={{ fontSize: 'var(--text-2xl)', color: totalBudget - totalSpent >= 0 ? 'var(--color-positive)' : 'var(--color-negative)' }}>
                    {formatCurrency(totalBudget - totalSpent)}
                  </span>
                </div>
              )}
              {totalDebt > 0 && (
                <div style={{ textAlign: 'right' }}>
                  <p className="text-muted" style={{ fontSize: 'var(--text-sm)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Total Debt</p>
                  <span className="mono" style={{ fontSize: 'var(--text-2xl)', color: 'var(--color-negative)' }}>
                    {formatCurrency(totalDebt)}
                  </span>
                </div>
              )}
            </div>
            {totalBudget > 0 && (
              <div className="progress-bar" style={{ marginTop: '0.75rem', height: 8 }}>
                <div className="progress-bar-fill" style={{
                  width: `${Math.min(100, (totalSpent / totalBudget) * 100)}%`,
                  background: totalSpent > totalBudget ? 'var(--color-negative)' : 'var(--color-navy)',
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
