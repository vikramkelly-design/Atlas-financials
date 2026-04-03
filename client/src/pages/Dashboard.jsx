import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import useApi, { api } from '../hooks/useApi'
import usePrices from '../hooks/usePrices'
import { formatCurrency, numColor } from '../components/NumberDisplay'
import { gradeColor } from '../utils/grades'
import LoadingSpinner from '../components/LoadingSpinner'
import ErrorBanner from '../components/ErrorBanner'
import ConfirmDialog from '../components/ConfirmDialog'
import dailyConcepts from '../data/dailyConcepts'

function getGreeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

function formatDate(d) {
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
}

function getDailyConcept() {
  const now = new Date()
  const start = new Date(now.getFullYear(), 0, 0)
  const dayOfYear = Math.floor((now - start) / (1000 * 60 * 60 * 24))
  return dailyConcepts[dayOfYear % dailyConcepts.length]
}

export default function Dashboard() {
  const navigate = useNavigate()
  const { get } = useApi()
  const user = JSON.parse(localStorage.getItem('atlas_user') || '{}')
  const [netWorth, setNetWorth] = useState(null)
  const [budget, setBudget] = useState(null)
  const [positions, setPositions] = useState([])
  const [transactions, setTransactions] = useState([])
  const [watchlist, setWatchlist] = useState([])
  const [currentGoal, setCurrentGoal] = useState(null)
  const [healthScore, setHealthScore] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [spyChange, setSpyChange] = useState(null)
  const [screenerData, setScreenerData] = useState([])
  const [budgetLimit, setBudgetLimit] = useState(0)
  const [learnExpanded, setLearnExpanded] = useState(false)
  const [digest, setDigest] = useState(null)

  // Net worth form
  const [assetForm, setAssetForm] = useState({ name: '', value: '', type: 'Cash' })
  const [liabilityForm, setLiabilityForm] = useState({ name: '', value: '' })
  const [confirmDialog, setConfirmDialog] = useState({ open: false, title: '', message: '', onConfirm: null, danger: false })

  const tickers = positions.map(p => p.ticker)
  const { prices } = usePrices(tickers)

  const fetchAll = async () => {
    setLoading(true)
    setError(null)
    try {
      const [nw, txRes, posRes, wlRes, goalRes, hsRes, goalsRes, spyRes, scrRes, digestRes] = await Promise.allSettled([
        get('/api/networth'),
        get('/api/budget/transactions'),
        get('/api/portfolio/positions'),
        get('/api/watchlist'),
        get('/api/atlas/current'),
        get('/api/insights/health-score'),
        get('/api/budget/goals'),
        get('/api/quote/%5EGSPC'),
        api.post('/api/screener', {}),
        new Date().getDay() === 1 ? get('/api/digest') : Promise.resolve(null),
      ])

      if (nw.status === 'fulfilled') setNetWorth(nw.value.data)
      if (posRes.status === 'fulfilled') setPositions(posRes.value.data || [])
      if (wlRes.status === 'fulfilled') setWatchlist(wlRes.value.data || [])

      const allTxns = txRes.status === 'fulfilled' ? (txRes.value.data || []) : []
      setTransactions(allTxns)

      // Current month budget
      const now = new Date()
      const curMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
      const monthTxns = allTxns.filter(t => t.month === curMonth)
      const totalSpent = monthTxns.filter(t => t.amount < 0).reduce((s, t) => s + t.amount, 0)
      setBudget({ totalSpent, count: monthTxns.length })

      if (goalRes.status === 'fulfilled') setCurrentGoal(goalRes.value.data || null)
      if (hsRes.status === 'fulfilled' && hsRes.value.data) setHealthScore(hsRes.value.data)
      if (goalsRes.status === 'fulfilled') {
        const totalLimit = (goalsRes.value.data || []).reduce((s, g) => s + (g.monthly_limit || 0), 0)
        setBudgetLimit(totalLimit)
      }
      if (spyRes.status === 'fulfilled' && spyRes.value.data) setSpyChange(spyRes.value.data.changePercent || 0)
      if (scrRes.status === 'fulfilled') setScreenerData(scrRes.value.data?.stocks || [])
      if (digestRes.status === 'fulfilled' && digestRes.value) setDigest(digestRes.value.data || null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchAll() }, [])

  const addAsset = async (e) => {
    e.preventDefault()
    if (!assetForm.name || !assetForm.value) return
    try {
      await api.post('/api/networth/asset', { name: assetForm.name, value: parseFloat(assetForm.value), type: assetForm.type })
      setAssetForm({ name: '', value: '', type: 'Cash' })
      const nw = await get('/api/networth')
      setNetWorth(nw.data)
    } catch (err) { console.error(err) }
  }

  const addLiability = async (e) => {
    e.preventDefault()
    if (!liabilityForm.name || !liabilityForm.value) return
    try {
      await api.post('/api/networth/liability', { name: liabilityForm.name, value: parseFloat(liabilityForm.value) })
      setLiabilityForm({ name: '', value: '' })
      const nw = await get('/api/networth')
      setNetWorth(nw.data)
    } catch (err) { console.error(err) }
  }

  const deleteAsset = async (id) => {
    try {
      await api.delete(`/api/networth/asset/${id}`)
      const nw = await get('/api/networth')
      setNetWorth(nw.data)
    } catch (err) { console.error(err) }
  }

  const deleteLiability = async (id) => {
    try {
      await api.delete(`/api/networth/liability/${id}`)
      const nw = await get('/api/networth')
      setNetWorth(nw.data)
    } catch (err) { console.error(err) }
  }

  const confirmDeleteAsset = (id, name) => {
    setConfirmDialog({
      open: true, danger: true,
      title: 'Delete Asset',
      message: `Are you sure you want to remove "${name}" from your assets?`,
      onConfirm: () => { deleteAsset(id); setConfirmDialog(d => ({ ...d, open: false })) }
    })
  }

  const confirmDeleteLiability = (id, name) => {
    setConfirmDialog({
      open: true, danger: true,
      title: 'Delete Liability',
      message: `Are you sure you want to remove "${name}" from your liabilities?`,
      onConfirm: () => { deleteLiability(id); setConfirmDialog(d => ({ ...d, open: false })) }
    })
  }

  // Portfolio value
  const portfolioValue = positions.reduce((sum, p) => {
    const price = prices[p.ticker]?.price || 0
    return sum + price * p.shares
  }, 0)
  const portfolioCost = positions.reduce((sum, p) => sum + (p.avg_cost || 0) * p.shares, 0)
  const portfolioGain = portfolioCost > 0 ? ((portfolioValue - portfolioCost) / portfolioCost) * 100 : 0

  // Empty state
  const isEmptyState = positions.length === 0 && transactions.length === 0

  // Top screener alert
  const undervalued = screenerData.filter(s => s.verdict === 'UNDERVALUED')
  const topAlert = undervalued.sort((a, b) => (b.upside || 0) - (a.upside || 0))[0]

  // Budget remaining
  const budgetRemaining = budgetLimit > 0 ? budgetLimit - Math.abs(budget?.totalSpent || 0) : null

  // Daily concept
  const concept = getDailyConcept()

  const firstName = user.name ? user.name.split(' ')[0] : ''

  if (loading) return <LoadingSpinner height={200} />
  if (error) return <ErrorBanner message={error} onRetry={fetchAll} />

  // EMPTY STATE
  if (isEmptyState) {
    return (
      <div>
        <div style={{ marginBottom: 'var(--space-lg)' }}>
          <h1 style={{ fontSize: 'var(--text-3xl)', marginBottom: '0.15rem' }}>
            {getGreeting()}{firstName ? `, ${firstName}` : ''}.
          </h1>
          <p style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>{formatDate(new Date())}</p>
        </div>

        <div className="card" style={{ marginBottom: 'var(--space-lg)', borderLeft: '3px solid var(--color-gold)' }}>
          <p style={{ fontSize: 'var(--text-lg)', color: 'var(--color-text-primary)', marginBottom: 'var(--space-md)' }}>
            Welcome to Atlas. Let's build your financial picture.
          </p>
          <div style={{ display: 'flex', gap: 'var(--space-sm)', flexWrap: 'wrap' }}>
            <button className="btn btn-primary" onClick={() => navigate('/portfolio')}>Add a holding</button>
            <button className="btn btn-ghost" onClick={() => navigate('/markets')}>Search a stock</button>
            <button className="btn btn-ghost" onClick={() => navigate('/plan')}>Set a goal</button>
          </div>
        </div>

        <div className="grid-3">
          <div className="card">
            <span className="label-caps">Net Worth</span>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-base)', marginTop: 'var(--space-sm)' }}>
              Add your first asset to calculate net worth.
            </p>
            <button className="btn btn-ghost" style={{ marginTop: 'var(--space-md)' }} onClick={() => navigate('/portfolio')}>+ Add holding</button>
          </div>
          <div className="card">
            <span className="label-caps">Portfolio</span>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-base)', marginTop: 'var(--space-sm)' }}>
              No holdings yet.
            </p>
            <button className="btn btn-ghost" style={{ marginTop: 'var(--space-md)' }} onClick={() => navigate('/portfolio')}>+ Add holding</button>
          </div>
          <div className="card">
            <span className="label-caps">Watchlist</span>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-base)', marginTop: 'var(--space-sm)' }}>
              No stocks tracked.
            </p>
            <button className="btn btn-ghost" style={{ marginTop: 'var(--space-md)' }} onClick={() => navigate('/markets')}>+ Add stocks</button>
          </div>
        </div>

        <ConfirmDialog {...confirmDialog} onCancel={() => setConfirmDialog(d => ({ ...d, open: false }))} />
      </div>
    )
  }

  // POPULATED STATE — 6 cards in 2-col grid
  return (
    <div>
      {/* Card 1 — Greeting + Market Pulse (full width) */}
      <div style={{ marginBottom: 'var(--space-lg)' }}>
        <h1 style={{ fontSize: 'var(--text-3xl)', marginBottom: '0.15rem' }}>
          {getGreeting()}{firstName ? `, ${firstName}` : ''}
          {spyChange !== null && (
            <span style={{ fontSize: 'var(--text-base)', fontWeight: 400, marginLeft: 'var(--space-sm)' }}>
              <span style={{ color: 'var(--color-text-muted)' }}> · S&P 500 </span>
              <span style={{ color: spyChange >= 0 ? 'var(--color-positive)' : 'var(--color-negative)', fontFamily: 'var(--font-mono)' }}>
                {spyChange >= 0 ? '▲' : '▼'} {Math.abs(spyChange).toFixed(1)}% today
              </span>
            </span>
          )}
        </h1>
        <p style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>{formatDate(new Date())}</p>
      </div>

      {/* This Week digest card — Mondays only */}
      {digest && (
        <div className="card" style={{ marginBottom: 'var(--space-lg)', borderLeft: '3px solid var(--color-gold)' }}>
          <span className="label-caps" style={{ display: 'block', marginBottom: 'var(--space-sm)' }}>This Week</span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-lg)' }}>
            {digest.portfolioHoldingsCount > 0 && (
              <div>
                <span className="mono" style={{ fontSize: 'var(--text-xl)', color: 'var(--color-text-primary)' }}>{digest.portfolioHoldingsCount}</span>
                <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', marginLeft: 'var(--space-xs)' }}>holdings</span>
              </div>
            )}
            {digest.budgetStatus !== 'no_budget' && (
              <div>
                <span className="mono" style={{ fontSize: 'var(--text-xl)', color: digest.budgetStatus === 'on_track' ? 'var(--color-positive)' : 'var(--color-negative)' }}>
                  {digest.budgetPct}%
                </span>
                <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', marginLeft: 'var(--space-xs)' }}>of budget used</span>
              </div>
            )}
            {digest.plan && (
              <div>
                <span className="mono" style={{ fontSize: 'var(--text-xl)', color: 'var(--color-text-primary)' }}>{formatCurrency(digest.plan.monthlyInvestment)}</span>
                <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', marginLeft: 'var(--space-xs)' }}>/mo target</span>
              </div>
            )}
          </div>
          {digest.weeklyConcept && (
            <div style={{ marginTop: 'var(--space-md)', paddingTop: 'var(--space-sm)', borderTop: '1px solid var(--color-border)' }}>
              <span style={{ fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--color-text-primary)' }}>
                Concept of the week: {digest.weeklyConcept.term}
              </span>
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', marginTop: 2 }}>
                {digest.weeklyConcept.short}
              </p>
            </div>
          )}
        </div>
      )}

      <div className="grid-2" style={{ marginBottom: 'var(--space-lg)', alignItems: 'stretch' }}>
        {/* Card 2 — My Plan Progress */}
        <div className="card card-clickable" onClick={() => navigate('/plan')}>
          <span className="label-caps" style={{ marginBottom: 'var(--space-sm)', display: 'block' }}>My Plan</span>
          {currentGoal ? (
            <>
              <p style={{ fontSize: 'var(--text-base)', color: 'var(--color-text-primary)' }}>
                You're <span className="mono" style={{ fontWeight: 500 }}>
                  {Math.min(100, Math.round((currentGoal.current_amount / currentGoal.target_amount) * 100))}%
                </span> toward <span className="mono" style={{ fontWeight: 500 }}>{formatCurrency(currentGoal.target_amount)}</span>
              </p>
              <div className="progress-bar" style={{ marginTop: 'var(--space-sm)', height: 6 }}>
                <div className="progress-bar-fill" style={{
                  width: `${Math.min(100, (currentGoal.current_amount / currentGoal.target_amount) * 100)}%`,
                  background: 'var(--color-navy)',
                }} />
              </div>
            </>
          ) : (
            <p style={{ fontSize: 'var(--text-base)', color: 'var(--color-text-secondary)' }}>
              Set your financial goal →
            </p>
          )}
        </div>

        {/* Card 3 — Portfolio Value */}
        <div className="card card-clickable" onClick={() => navigate('/portfolio')}>
          <span className="label-caps" style={{ marginBottom: 'var(--space-sm)', display: 'block' }}>Portfolio</span>
          {positions.length > 0 ? (
            <>
              <span className="mono" style={{ fontSize: 'var(--text-2xl)', color: 'var(--color-text-primary)' }}>
                {formatCurrency(portfolioValue)}
              </span>
              {portfolioCost > 0 && (
                <p className="mono" style={{ fontSize: 'var(--text-base)', color: numColor(portfolioGain), marginTop: 'var(--space-xs)' }}>
                  {portfolioGain >= 0 ? '+' : ''}{portfolioGain.toFixed(2)}% all time
                </p>
              )}
            </>
          ) : (
            <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-base)' }}>No holdings yet.</p>
          )}
        </div>
      </div>

      <div className="grid-2" style={{ marginBottom: 'var(--space-lg)', alignItems: 'stretch' }}>
        {/* Card 4 — Top Screener Alert */}
        <div className="card card-clickable" onClick={() => navigate('/markets')}>
          <span className="label-caps" style={{ marginBottom: 'var(--space-sm)', display: 'block' }}>Screener Alert</span>
          {topAlert ? (
            <p style={{ fontSize: 'var(--text-base)', color: 'var(--color-text-primary)' }}>
              <span style={{ fontWeight: 500 }}>{topAlert.ticker}</span> is trading{' '}
              <span className="mono" style={{ color: 'var(--color-positive)', fontWeight: 500 }}>
                {Math.abs(topAlert.upside || 0).toFixed(0)}%
              </span>{' '}
              below intrinsic value
              <span style={{ color: 'var(--color-gold)', marginLeft: 'var(--space-xs)' }}>View →</span>
            </p>
          ) : (
            <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-base)' }}>
              No undervalued stocks in the screener right now.
            </p>
          )}
        </div>

        {/* Card 5 — Budget Remaining */}
        <div className="card card-clickable" onClick={() => navigate('/budget')}>
          <span className="label-caps" style={{ marginBottom: 'var(--space-sm)', display: 'block' }}>Budget</span>
          {budgetRemaining !== null ? (
            <p style={{ fontSize: 'var(--text-base)', color: 'var(--color-text-primary)' }}>
              <span className="mono" style={{ fontSize: 'var(--text-2xl)', color: budgetRemaining >= 0 ? 'var(--color-positive)' : 'var(--color-negative)' }}>
                {formatCurrency(Math.abs(budgetRemaining))}
              </span>
              <br />
              <span style={{ color: 'var(--color-text-secondary)' }}>
                {budgetRemaining >= 0 ? 'available to invest this month' : 'over budget this month'}
              </span>
            </p>
          ) : budget && budget.count > 0 ? (
            <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-base)' }}>
              <span className="mono" style={{ color: 'var(--color-negative)' }}>{formatCurrency(Math.abs(budget.totalSpent))}</span> spent this month
            </p>
          ) : (
            <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-base)' }}>
              Set budget limits to track spending →
            </p>
          )}
        </div>
      </div>

      {/* Card 6 — Daily Learning Card */}
      <div className="card" style={{ marginBottom: 'var(--space-lg)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-sm)' }}>
          <span className="label-caps">Daily Concept</span>
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
            {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </span>
        </div>
        <h3 style={{ fontSize: 'var(--text-lg)', marginBottom: 'var(--space-xs)' }}>{concept.title}</h3>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-base)', lineHeight: 1.5 }}>{concept.short}</p>
        {learnExpanded && (
          <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-base)', lineHeight: 1.6, marginTop: 'var(--space-sm)', borderTop: '1px solid var(--color-border)', paddingTop: 'var(--space-sm)' }}>
            {concept.full}
          </p>
        )}
        <button
          onClick={() => setLearnExpanded(!learnExpanded)}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--color-gold)', fontSize: 'var(--text-sm)',
            marginTop: 'var(--space-sm)', padding: 0,
          }}
        >
          {learnExpanded ? 'Show less' : 'Learn more'}
        </button>
      </div>

      {/* Health Score (only if real data) */}
      {healthScore && (positions.length > 0 || transactions.length > 0 || !!currentGoal) && (
        <div className="card" style={{
          marginBottom: 'var(--space-lg)',
          borderLeft: `3px solid ${healthScore.score >= 70 ? 'var(--color-positive)' : healthScore.score >= 50 ? 'var(--color-gold)' : 'var(--color-negative)'}`,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-sm)' }}>
            <span className="label-caps">Financial Health</span>
            <span style={{ fontSize: 'var(--text-xl)', fontWeight: 700, color: gradeColor(healthScore.grade), padding: '0.15rem 0.5rem', border: `1px solid ${gradeColor(healthScore.grade)}`, borderRadius: 2 }}>
              {healthScore.grade}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.35rem', marginBottom: 'var(--space-sm)' }}>
            <span className="mono" style={{ fontSize: 'var(--text-4xl)', fontWeight: 700, color: 'var(--color-navy)' }}>{healthScore.score}</span>
            <span style={{ fontSize: 'var(--text-lg)', color: 'var(--color-text-muted)' }}>/ 100</span>
          </div>
          <div className="progress-bar" style={{ marginBottom: 'var(--space-sm)', height: 8 }}>
            <div className="progress-bar-fill" style={{
              width: `${healthScore.score}%`,
              background: healthScore.score >= 70 ? 'var(--color-positive)' : healthScore.score >= 50 ? 'var(--color-gold)' : 'var(--color-negative)',
            }} />
          </div>
          {healthScore.categories?.map(cat => (
            <div key={cat.name} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.25rem 0' }}>
              <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-primary)' }}>{cat.name}</span>
              <span style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: gradeColor(cat.grade) }}>{cat.grade}</span>
            </div>
          ))}
          <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: 'var(--space-sm)' }}>
            Calculated from your savings rate, portfolio health, budget adherence, debt load, and goal progress.
          </p>
        </div>
      )}

      {/* Net Worth Tracker */}
      <div className="card" id="nw-tracker">
        <h2 style={{ fontSize: 'var(--text-xl)', marginBottom: 'var(--space-md)' }}>Net Worth Tracker</h2>
        <div className="grid-2">
          <div>
            <h4 style={{ fontSize: 'var(--text-base)', marginBottom: 'var(--space-sm)', color: 'var(--color-text-secondary)' }}>Assets</h4>
            <form onSubmit={addAsset} style={{ display: 'flex', gap: 'var(--space-sm)', marginBottom: 'var(--space-sm)', flexWrap: 'wrap' }}>
              <input className="input" placeholder="Name" value={assetForm.name} onChange={e => setAssetForm(p => ({ ...p, name: e.target.value }))} style={{ flex: 1, minWidth: 100 }} />
              <input className="input" type="number" step="0.01" placeholder="Value" value={assetForm.value} onChange={e => setAssetForm(p => ({ ...p, value: e.target.value }))} style={{ width: 100 }} />
              <select className="select" value={assetForm.type} onChange={e => setAssetForm(p => ({ ...p, type: e.target.value }))}>
                <option>Cash</option>
                <option>Investment</option>
                <option>Property</option>
                <option>Other</option>
              </select>
              <button className="btn btn-primary" type="submit">Add</button>
            </form>
            {netWorth?.assets?.map(a => (
              <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.4rem 0', borderBottom: '1px solid var(--color-border)' }}>
                <div>
                  <span style={{ fontSize: 'var(--text-base)' }}>{a.name}</span>
                  <span className="badge badge-neutral" style={{ marginLeft: 'var(--space-sm)' }}>{a.type}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
                  <span className="mono text-success" style={{ fontSize: 'var(--text-base)' }}>{formatCurrency(a.value)}</span>
                  <button onClick={() => confirmDeleteAsset(a.id, a.name)} aria-label={`Remove ${a.name}`} style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer', fontSize: 'var(--text-lg)' }}>x</button>
                </div>
              </div>
            ))}
            {(!netWorth?.assets || netWorth.assets.length === 0) && (
              <p style={{ fontSize: 'var(--text-base)', color: 'var(--color-text-muted)' }}>No assets added yet.</p>
            )}
          </div>
          <div>
            <h4 style={{ fontSize: 'var(--text-base)', marginBottom: 'var(--space-sm)', color: 'var(--color-text-secondary)' }}>Liabilities</h4>
            <form onSubmit={addLiability} style={{ display: 'flex', gap: 'var(--space-sm)', marginBottom: 'var(--space-sm)' }}>
              <input className="input" placeholder="Name" value={liabilityForm.name} onChange={e => setLiabilityForm(p => ({ ...p, name: e.target.value }))} style={{ flex: 1 }} />
              <input className="input" type="number" step="0.01" placeholder="Value" value={liabilityForm.value} onChange={e => setLiabilityForm(p => ({ ...p, value: e.target.value }))} style={{ width: 100 }} />
              <button className="btn btn-primary" type="submit">Add</button>
            </form>
            {netWorth?.liabilities?.map(l => (
              <div key={l.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.4rem 0', borderBottom: '1px solid var(--color-border)' }}>
                <span style={{ fontSize: 'var(--text-base)' }}>{l.name}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
                  <span className="mono text-danger" style={{ fontSize: 'var(--text-base)' }}>{formatCurrency(l.value)}</span>
                  <button onClick={() => confirmDeleteLiability(l.id, l.name)} aria-label={`Remove ${l.name}`} style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer', fontSize: 'var(--text-lg)' }}>x</button>
                </div>
              </div>
            ))}
            {(!netWorth?.liabilities || netWorth.liabilities.length === 0) && (
              <p style={{ fontSize: 'var(--text-base)', color: 'var(--color-text-muted)' }}>No liabilities added yet.</p>
            )}
          </div>
        </div>
      </div>
      <ConfirmDialog {...confirmDialog} onCancel={() => setConfirmDialog(d => ({ ...d, open: false }))} />
    </div>
  )
}
