import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import useApi, { api } from '../hooks/useApi'
import usePrices from '../hooks/usePrices'
import { formatCurrency, numColor } from '../components/NumberDisplay'
import LoadingSpinner from '../components/LoadingSpinner'
import ErrorBanner from '../components/ErrorBanner'
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
  const [budget, setBudget] = useState(null)
  const [positions, setPositions] = useState([])
  const [transactions, setTransactions] = useState([])
  const [watchlist, setWatchlist] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [spyChange, setSpyChange] = useState(null)
  const [screenerData, setScreenerData] = useState([])
  const [budgetLimit, setBudgetLimit] = useState(0)
  const [learnExpanded, setLearnExpanded] = useState(false)
  const [digest, setDigest] = useState(null)
  const [plan, setPlan] = useState(null)
  const [investProgress, setInvestProgress] = useState(null)

  const tickers = positions.map(p => p.ticker)
  const { prices } = usePrices(tickers)

  const fetchAll = async () => {
    setLoading(true)
    setError(null)
    try {
      // Load user's saved screener tickers
      let screenerTickers = null
      try {
        const tickerRes = await get('/api/screener/tickers')
        if (tickerRes.data?.length > 0) screenerTickers = tickerRes.data
      } catch (e) { console.warn('Screener load failed', e) }

      const [txRes, posRes, wlRes, goalsRes, spyRes, scrRes, planRes, digestRes, savingsRes] = await Promise.allSettled([
        get('/api/budget/transactions'),
        get('/api/portfolio/positions'),
        get('/api/watchlist'),
        get('/api/budget/goals'),
        get('/api/quote/%5EGSPC'),
        api.post('/api/screener', { tickers: screenerTickers || ['AAPL','MSFT','GOOGL','AMZN','TSLA','NVDA','META','BRK-B','JPM','V','WMT','JNJ','PG','KO','DIS'] }),
        get('/api/plan'),
        new Date().getDay() === 1 ? get('/api/digest') : Promise.resolve(null),
        get('/api/savings'),
      ])

      if (posRes.status === 'fulfilled') setPositions(posRes.value.data || [])
      if (wlRes.status === 'fulfilled') setWatchlist(wlRes.value.data || [])

      const allTxns = txRes.status === 'fulfilled' ? (txRes.value.data || []) : []
      setTransactions(allTxns)

      const now = new Date()
      const curMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
      const monthTxns = allTxns.filter(t => t.month === curMonth)
      const totalSpent = monthTxns.filter(t => t.amount < 0).reduce((s, t) => s + t.amount, 0)
      setBudget({ totalSpent, count: monthTxns.length })

      if (goalsRes.status === 'fulfilled') {
        const totalLimit = (goalsRes.value.data || []).reduce((s, g) => s + (g.monthly_limit || 0), 0)
        setBudgetLimit(totalLimit)
      }
      if (spyRes.status === 'fulfilled' && spyRes.value.data) setSpyChange(spyRes.value.data.changePercent || 0)
      if (scrRes.status === 'fulfilled') setScreenerData(scrRes.value.data?.stocks || scrRes.value.data?.data?.stocks || [])
      if (planRes.status === 'fulfilled') setPlan(planRes.value.data || null)
      if (digestRes.status === 'fulfilled' && digestRes.value) setDigest(digestRes.value.data || null)
      if (savingsRes.status === 'fulfilled' && savingsRes.value.data) {
        const s = savingsRes.value.data
        if (s.invest_amt > 0) {
          setInvestProgress({ investAmt: s.invest_amt, investSpent: s.invest_spent || 0 })
        }
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchAll() }, [])

  // Portfolio value
  const portfolioValue = positions.reduce((sum, p) => {
    const price = prices[p.ticker]?.price || 0
    return sum + price * p.shares
  }, 0)
  const portfolioCost = positions.reduce((sum, p) => sum + (p.avg_cost || 0) * p.shares, 0)
  const portfolioGain = portfolioCost > 0 ? ((portfolioValue - portfolioCost) / portfolioCost) * 100 : 0

  // Empty state
  const isEmptyState = positions.length === 0 && transactions.length === 0

  // Top screener alert — verdict can be 'UNDERVALUED' or 'undervalued'
  const undervalued = screenerData.filter(s => (s.verdict || '').toUpperCase() === 'UNDERVALUED')
  const topAlert = undervalued.sort((a, b) => (b.upside || b.upsidePercent || 0) - (a.upside || a.upsidePercent || 0))[0]

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

        <div className="card" style={{ marginBottom: 'var(--space-lg)', background: 'var(--color-gold-15)' }}>
          <p style={{ fontSize: 'var(--text-lg)', color: 'var(--color-text-primary)', marginBottom: 'var(--space-md)' }}>
            Welcome to Atlas. Let's build your financial picture.
          </p>
          <div style={{ display: 'flex', gap: 'var(--space-sm)', flexWrap: 'wrap' }}>
            <button className="btn btn-primary" onClick={() => navigate('/portfolio')}>Add a holding</button>
            <button className="btn btn-ghost" onClick={() => navigate('/markets')}>Search a stock</button>
            <button className="btn btn-ghost" onClick={() => navigate('/plan')}>Set a goal</button>
          </div>
        </div>

        <div className="grid-2">
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
        <div className="card" style={{ marginBottom: 'var(--space-lg)', background: 'var(--color-gold-15)' }}>
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
          {plan ? (
            <>
              <p style={{ fontSize: 'var(--text-base)', color: 'var(--color-text-primary)' }}>
                <span className="mono" style={{ fontWeight: 500 }}>{formatCurrency(plan.monthly_investment)}/mo</span> toward{' '}
                <span className="mono" style={{ fontWeight: 500 }}>{formatCurrency(plan.goal_amount)}</span> by age {plan.target_age}
              </p>
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', marginTop: 'var(--space-xs)' }}>
                {plan.target_age - plan.current_age} years remaining
              </p>
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
          {investProgress && investProgress.investAmt > 0 && (
            <div style={{ marginTop: 'var(--space-sm)', paddingTop: 'var(--space-sm)', borderTop: '1px solid var(--color-border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Invested this month
                </span>
                <span className="mono" style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-primary)' }}>
                  {formatCurrency(investProgress.investSpent)} <span style={{ color: 'var(--color-text-muted)' }}>/ {formatCurrency(investProgress.investAmt)}</span>
                </span>
              </div>
              <div style={{ height: 4, background: 'var(--color-border)', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{
                  height: '100%',
                  width: `${Math.min(100, (investProgress.investSpent / investProgress.investAmt) * 100)}%`,
                  background: investProgress.investSpent >= investProgress.investAmt ? 'var(--color-positive)' : '#5B8DEF',
                  borderRadius: 2,
                  transition: 'width 0.3s ease',
                }} />
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="grid-2" style={{ marginBottom: 'var(--space-lg)', alignItems: 'stretch' }}>
        {/* Card 4 — Screener Alert */}
        <div className="card card-clickable" onClick={() => navigate('/markets')}>
          <span className="label-caps" style={{ marginBottom: 'var(--space-sm)', display: 'block' }}>Screener Alert</span>
          {topAlert ? (
            <p style={{ fontSize: 'var(--text-base)', color: 'var(--color-text-primary)' }}>
              <span style={{ fontWeight: 500 }}>{topAlert.ticker}</span> is trading{' '}
              <span className="mono" style={{ color: 'var(--color-positive)', fontWeight: 500 }}>
                {Math.abs(topAlert.upside || topAlert.upsidePercent || 0).toFixed(0)}%
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
        <div className="card card-clickable" onClick={() => navigate('/money')}>
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

      {/* Undervalued Stocks Section */}
      {undervalued.length > 0 && (
        <div className="card" style={{ marginBottom: 'var(--space-lg)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-sm)' }}>
            <span className="label-caps">Undervalued Stocks</span>
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-positive)', fontWeight: 600 }}>{undervalued.length} found</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            {undervalued.sort((a, b) => (b.upside || 0) - (a.upside || 0)).map(s => (
              <div key={s.ticker} onClick={() => navigate('/markets')}
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.45rem 0.5rem', borderRadius: 4, background: 'rgba(46,125,94,0.05)', cursor: 'pointer' }}>
                <div>
                  <span className="mono" style={{ fontWeight: 600, fontSize: 'var(--text-base)' }}>{s.ticker}</span>
                  <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', marginLeft: 'var(--space-sm)' }}>{s.companyName}</span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span className="mono" style={{ fontSize: 'var(--text-sm)' }}>{formatCurrency(s.currentPrice)}</span>
                  <span className="mono" style={{ fontSize: 'var(--text-sm)', color: 'var(--color-positive)', marginLeft: 'var(--space-sm)', fontWeight: 600 }}>
                    +{(s.upside || 0).toFixed(0)}% upside
                  </span>
                </div>
              </div>
            ))}
          </div>
          <button onClick={() => navigate('/markets')} style={{ background: 'none', border: 'none', color: 'var(--color-gold)', fontSize: 'var(--text-sm)', cursor: 'pointer', marginTop: 'var(--space-sm)', padding: 0 }}>
            View in Screener →
          </button>
        </div>
      )}

      {/* Plan Summary */}
      {plan && (
        <div className="card card-clickable" onClick={() => navigate('/plan')} style={{ marginBottom: 'var(--space-lg)', background: 'color-mix(in srgb, var(--color-navy) 8%, var(--color-surface))' }}>
          <span className="label-caps" style={{ display: 'block', marginBottom: 'var(--space-sm)' }}>My Plan</span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-lg)', alignItems: 'baseline' }}>
            <div>
              <span className="mono" style={{ fontSize: 'var(--text-2xl)', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                {formatCurrency(plan.goal_amount)}
              </span>
              <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', marginLeft: 'var(--space-xs)' }}>goal</span>
            </div>
            <div>
              <span className="mono" style={{ fontSize: 'var(--text-lg)', color: 'var(--color-text-primary)' }}>
                {formatCurrency(plan.monthly_investment)}
              </span>
              <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', marginLeft: 'var(--space-xs)' }}>/mo</span>
            </div>
            <div>
              <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>
                Age {plan.current_age} → {plan.target_age} ({plan.target_age - plan.current_age} years)
              </span>
            </div>
          </div>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', marginTop: 'var(--space-sm)' }}>
            Investing {formatCurrency(plan.monthly_investment)}/mo at 8% avg return ≈{' '}
            <span className="mono" style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>
              {formatCurrency(plan.monthly_investment * ((Math.pow(1 + 0.08/12, (plan.target_age - plan.current_age) * 12) - 1) / (0.08/12)))}
            </span>
            {' '}projected
          </p>
        </div>
      )}

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
    </div>
  )
}
