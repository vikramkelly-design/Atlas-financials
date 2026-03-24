import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import useApi, { api } from '../hooks/useApi'
import usePrices from '../hooks/usePrices'
import { formatCurrency, numColor } from '../components/NumberDisplay'
import LoadingSpinner from '../components/LoadingSpinner'
import ErrorBanner from '../components/ErrorBanner'

export default function Dashboard() {
  const navigate = useNavigate()
  const { get } = useApi()
  const [netWorth, setNetWorth] = useState(null)
  const [budget, setBudget] = useState(null)
  const [positions, setPositions] = useState([])
  const [watchlist, setWatchlist] = useState([])
  const [currentGoal, setCurrentGoal] = useState(null)
  const [insights, setInsights] = useState([])
  const [healthScore, setHealthScore] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Net worth form
  const [assetForm, setAssetForm] = useState({ name: '', value: '', type: 'Cash' })
  const [liabilityForm, setLiabilityForm] = useState({ name: '', value: '' })

  const tickers = positions.map(p => p.ticker)
  const { prices } = usePrices(tickers)

  const fetchAll = async () => {
    setLoading(true)
    setError(null)
    try {
      const [nw, txRes, posRes, wlRes] = await Promise.all([
        get('/api/networth'),
        get('/api/budget/transactions'),
        get('/api/portfolio/positions'),
        get('/api/watchlist'),
      ])
      setNetWorth(nw.data)
      setPositions(posRes.data)
      setWatchlist(wlRes.data)

      // Fetch current goal separately so it doesn't break the dashboard if atlas table is empty
      try {
        const goalRes = await get('/api/atlas/current')
        setCurrentGoal(goalRes.data || null)
      } catch {
        setCurrentGoal(null)
      }

      // Fetch health score and insights
      try {
        const [hsRes, insRes] = await Promise.all([
          get('/api/insights/health-score'),
          get('/api/insights/dashboard'),
        ])
        if (hsRes.data) setHealthScore(hsRes.data)
        if (insRes.data) setInsights(insRes.data)
      } catch {}

      // Get current month transactions
      const now = new Date()
      const curMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
      const monthTxns = txRes.data.filter(t => t.month === curMonth)
      const totalSpent = monthTxns.filter(t => t.amount < 0).reduce((s, t) => s + t.amount, 0)
      setBudget({ totalSpent, count: monthTxns.length })
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

  // Portfolio value
  const portfolioValue = positions.reduce((sum, p) => {
    const price = prices[p.ticker]?.price || 0
    return sum + price * p.shares
  }, 0)
  const portfolioCost = positions.reduce((sum, p) => sum + (p.avg_cost || 0) * p.shares, 0)
  const portfolioGain = portfolioCost > 0 ? ((portfolioValue - portfolioCost) / portfolioCost) * 100 : 0

  // Watchlist stats
  const wlUp = watchlist.filter(w => (prices[w.ticker]?.changePercent || 0) > 0).length
  const wlDown = watchlist.length - wlUp

  if (loading) return <LoadingSpinner height={200} />
  if (error) return <ErrorBanner message={error} onRetry={fetchAll} />

  const gradeColor = (grade) => {
    if (grade === 'A' || grade === 'B+') return '#2A5C3A'
    if (grade === 'B' || grade === 'C+') return '#8B6A2A'
    return '#8B3A2A'
  }

  return (
    <div>
      <h1 style={{ fontSize: '1.75rem', marginBottom: '1.5rem' }}>Dashboard</h1>

      {/* Financial Health Score */}
      {healthScore && (
        <div className="card" style={{ marginBottom: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
            <h3 style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', fontFamily: 'var(--font-body)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Financial Health Score</h3>
            <span style={{ fontSize: '1.1rem', fontWeight: 700, color: gradeColor(healthScore.grade), padding: '0.15rem 0.5rem', border: `1px solid ${gradeColor(healthScore.grade)}`, borderRadius: 2 }}>
              {healthScore.grade}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.35rem', marginBottom: '0.5rem' }}>
            <span className="mono" style={{ fontSize: '2.5rem', fontWeight: 700, color: '#1B2A4A' }}>{healthScore.score}</span>
            <span className="text-faint" style={{ fontSize: '1rem' }}>/ 100</span>
          </div>
          <div className="progress-bar" style={{ marginBottom: '1rem', height: 8 }}>
            <div className="progress-bar-fill" style={{
              width: `${healthScore.score}%`,
              background: healthScore.score >= 70 ? '#2A5C3A' : healthScore.score >= 50 ? '#C9A84C' : '#8B3A2A',
            }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            {healthScore.categories?.map(cat => (
              <div key={cat.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.35rem 0', borderBottom: '1px solid var(--color-border)' }}>
                <div>
                  <span style={{ fontSize: '0.8rem', color: '#6B1A1A' }}>{cat.name}</span>
                  {cat.summary && <span className="text-faint" style={{ fontSize: '0.72rem', marginLeft: '0.5rem' }}>{cat.summary}</span>}
                </div>
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: gradeColor(cat.grade), minWidth: 28, textAlign: 'right' }}>{cat.grade}</span>
              </div>
            ))}
          </div>
          {healthScore.aiSummary && (
            <p className="text-muted" style={{ fontSize: '0.8rem', marginTop: '0.75rem', lineHeight: 1.5 }}>{healthScore.aiSummary}</p>
          )}
        </div>
      )}

      {/* Net Worth Card */}
      <div className="card" style={{ marginBottom: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h3 style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', marginBottom: '0.25rem', fontFamily: 'var(--font-body)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Net Worth</h3>
            <span className="mono" style={{ fontSize: '2rem', color: numColor(netWorth?.netWorth || 0) }}>
              {formatCurrency(netWorth?.netWorth || 0)}
            </span>
            <p className="text-muted" style={{ fontSize: '0.8rem', marginTop: '0.25rem' }}>
              Last updated {new Date().toLocaleDateString()}
            </p>
          </div>
        </div>
        {netWorth && (netWorth.totalAssets > 0 || netWorth.totalLiabilities > 0) && (
          <div style={{ marginTop: '1rem' }}>
            <div style={{ display: 'flex', gap: '0.5rem', fontSize: '0.8rem', marginBottom: '0.35rem' }}>
              <span className="text-success mono">{formatCurrency(netWorth.totalAssets)} assets</span>
              <span className="text-muted">|</span>
              <span className="text-danger mono">{formatCurrency(netWorth.totalLiabilities)} liabilities</span>
            </div>
            <div style={{ display: 'flex', height: 8, borderRadius: 4, overflow: 'hidden', background: 'var(--color-surface-2)' }}>
              <div style={{
                width: `${(netWorth.totalAssets / (netWorth.totalAssets + netWorth.totalLiabilities)) * 100}%`,
                background: 'var(--color-success)',
                borderRadius: '4px 0 0 4px'
              }} />
              <div style={{
                width: `${(netWorth.totalLiabilities / (netWorth.totalAssets + netWorth.totalLiabilities)) * 100}%`,
                background: 'var(--color-danger)',
                borderRadius: '0 4px 4px 0'
              }} />
            </div>
          </div>
        )}
      </div>

      {/* Three summary cards */}
      <div className="grid-3" style={{ marginBottom: '1.5rem' }}>
        <div className="card" onClick={() => navigate('/budget')} style={{ cursor: 'pointer' }}>
          <h3 style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem', fontFamily: 'var(--font-body)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>This Month's Spending</h3>
          <span className="mono" style={{ fontSize: '1.5rem', color: 'var(--color-danger)' }}>
            {formatCurrency(Math.abs(budget?.totalSpent || 0))}
          </span>
          <div className="progress-bar" style={{ marginTop: '0.75rem' }}>
            <div className="progress-bar-fill" style={{
              width: `${Math.min(100, ((Math.abs(budget?.totalSpent || 0)) / 5000) * 100)}%`,
              background: Math.abs(budget?.totalSpent || 0) > 5000 ? '#8B3A2A' : '#1B2A4A'
            }} />
          </div>
          <p className="text-faint" style={{ fontSize: '0.75rem', marginTop: '0.35rem' }}>{budget?.count || 0} transactions</p>
        </div>

        <div className="card" onClick={() => navigate('/portfolio')} style={{ cursor: 'pointer' }}>
          <h3 style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem', fontFamily: 'var(--font-body)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>Portfolio</h3>
          <span className="mono" style={{ fontSize: '1.5rem' }}>
            {formatCurrency(portfolioValue)}
          </span>
          {portfolioCost > 0 && (
            <p className="mono" style={{ fontSize: '0.85rem', color: numColor(portfolioGain), marginTop: '0.25rem' }}>
              {portfolioGain >= 0 ? '+' : ''}{portfolioGain.toFixed(2)}%
            </p>
          )}
        </div>

        <div className="card" onClick={() => navigate('/markets')} style={{ cursor: 'pointer' }}>
          <h3 style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem', fontFamily: 'var(--font-body)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>Watchlist</h3>
          <span className="mono" style={{ fontSize: '1.5rem' }}>{watchlist.length}</span>
          <p style={{ fontSize: '0.8rem', marginTop: '0.25rem' }}>
            <span className="text-success">{wlUp} up</span>
            <span className="text-muted"> / </span>
            <span className="text-danger">{wlDown} down</span>
          </p>
        </div>
      </div>

      {/* Current Goal */}
      {currentGoal && (() => {
        const pct = currentGoal.target_amount > 0 ? Math.min(100, (currentGoal.current_amount / currentGoal.target_amount) * 100) : 0
        const deadline = new Date(currentGoal.deadline + 'T00:00:00')
        const now = new Date(); now.setHours(0,0,0,0)
        const daysLeft = Math.max(0, Math.ceil((deadline - now) / (1000 * 60 * 60 * 24)))
        return (
          <div className="card" onClick={() => navigate('/atlas')} style={{ cursor: 'pointer', marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <h3 style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem', fontFamily: 'var(--font-body)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Current Goal</h3>
              <span className="text-faint" style={{ fontSize: '0.7rem' }}>View Atlas →</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
              <span style={{ fontSize: '1rem', fontWeight: 500 }}>{currentGoal.name}</span>
              <span style={{
                fontSize: '0.7rem', padding: '0.15rem 0.5rem', borderRadius: 4,
                background: daysLeft <= 7 ? '#F5E8E8' : daysLeft <= 30 ? '#FFF3E0' : '#E8EDF5',
                color: daysLeft <= 7 ? '#8B3A2A' : daysLeft <= 30 ? '#8B6A2A' : '#1B2A4A',
              }}>
                {daysLeft === 0 ? 'Due today' : `${daysLeft}d left`}
              </span>
            </div>
            {currentGoal.ultimate_name && (
              <p className="text-faint" style={{ fontSize: '0.72rem', marginBottom: '0.5rem' }}>Toward: {currentGoal.ultimate_name}</p>
            )}
            <div className="progress-bar" style={{ marginBottom: '0.25rem' }}>
              <div className="progress-bar-fill" style={{ width: `${pct}%`, background: '#1B2A4A' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
              <span className="mono text-muted">{formatCurrency(currentGoal.current_amount)} / {formatCurrency(currentGoal.target_amount)}</span>
              <span className="text-faint">{pct.toFixed(0)}%</span>
            </div>
          </div>
        )
      })()}

      {/* Net Worth Tracker */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem' }}>Net Worth Tracker</h2>
        <div className="grid-2">
          <div>
            <h4 style={{ fontSize: '0.9rem', marginBottom: '0.75rem', color: 'var(--color-text-muted)' }}>Assets</h4>
            <form onSubmit={addAsset} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
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
                  <span style={{ fontSize: '0.85rem' }}>{a.name}</span>
                  <span className="badge badge-neutral" style={{ marginLeft: '0.5rem' }}>{a.type}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span className="mono text-success" style={{ fontSize: '0.85rem' }}>{formatCurrency(a.value)}</span>
                  <button onClick={() => deleteAsset(a.id)} style={{ background: 'none', border: 'none', color: 'var(--color-text-faint)', cursor: 'pointer', fontSize: '1rem' }}>x</button>
                </div>
              </div>
            ))}
            {(!netWorth?.assets || netWorth.assets.length === 0) && (
              <p className="text-faint" style={{ fontSize: '0.85rem' }}>No assets added yet.</p>
            )}
          </div>
          <div>
            <h4 style={{ fontSize: '0.9rem', marginBottom: '0.75rem', color: 'var(--color-text-muted)' }}>Liabilities</h4>
            <form onSubmit={addLiability} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <input className="input" placeholder="Name" value={liabilityForm.name} onChange={e => setLiabilityForm(p => ({ ...p, name: e.target.value }))} style={{ flex: 1 }} />
              <input className="input" type="number" step="0.01" placeholder="Value" value={liabilityForm.value} onChange={e => setLiabilityForm(p => ({ ...p, value: e.target.value }))} style={{ width: 100 }} />
              <button className="btn btn-primary" type="submit">Add</button>
            </form>
            {netWorth?.liabilities?.map(l => (
              <div key={l.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.4rem 0', borderBottom: '1px solid var(--color-border)' }}>
                <span style={{ fontSize: '0.85rem' }}>{l.name}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span className="mono text-danger" style={{ fontSize: '0.85rem' }}>{formatCurrency(l.value)}</span>
                  <button onClick={() => deleteLiability(l.id)} style={{ background: 'none', border: 'none', color: 'var(--color-text-faint)', cursor: 'pointer', fontSize: '1rem' }}>x</button>
                </div>
              </div>
            ))}
            {(!netWorth?.liabilities || netWorth.liabilities.length === 0) && (
              <p className="text-faint" style={{ fontSize: '0.85rem' }}>No liabilities added yet.</p>
            )}
          </div>
        </div>
      </div>

      {/* Recent Insights */}
      <div className="card">
        <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem' }}>Recent Insights</h2>
        {insights.length === 0 ? (
          <p className="text-muted" style={{ fontSize: '0.9rem' }}>
            Import a CSV or add portfolio positions to generate your first insight.
          </p>
        ) : (
          insights.slice(0, 3).map((insight, i) => (
            <div key={i} style={{ display: 'flex', gap: '0.75rem', padding: '0.5rem 0', borderBottom: i < 2 ? '1px solid var(--color-border)' : 'none' }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--color-accent)', marginTop: '0.45rem', flexShrink: 0 }} />
              <div>
                <p style={{ fontSize: '0.85rem' }}>{insight.content}</p>
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
                  <span className="badge badge-gold">{insight.type}</span>
                  <span className="text-faint" style={{ fontSize: '0.7rem' }}>{new Date(insight.created_at).toLocaleDateString()}</span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
