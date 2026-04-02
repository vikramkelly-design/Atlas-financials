import { useState, useEffect, useMemo } from 'react'
import { api } from '../hooks/useApi'
import { formatCurrency, numColor } from '../components/NumberDisplay'
import LoadingSpinner from '../components/LoadingSpinner'
import ErrorBanner from '../components/ErrorBanner'
import PageChat from '../components/PageChat'
import ConfirmDialog from '../components/ConfirmDialog'
import { useToast } from '../components/Toast'
import EmptyState from '../components/EmptyState'

export default function Portfolio() {
  const { toast } = useToast()
  const [portfolios, setPortfolios] = useState([])
  const [activeId, setActiveId] = useState(null)
  const [positions, setPositions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [prices, setPrices] = useState({})
  const [ivData, setIvData] = useState({})
  const [analysis, setAnalysis] = useState(null)
  const [analysisLoading, setAnalysisLoading] = useState(false)

  // Add stock form
  const [addForm, setAddForm] = useState({ ticker: '', shares: '', avgCost: '' })
  const [addError, setAddError] = useState('')
  const [addLoading, setAddLoading] = useState(false)

  // Create portfolio modal
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [createName, setCreateName] = useState('')
  const [tab, setTab] = useState('portfolio')
  const [confirmDialog, setConfirmDialog] = useState({ open: false, title: '', message: '', onConfirm: null, danger: false })

  const activePortfolio = portfolios.find(p => p.id === activeId) || null

  const fetchPortfolios = async () => {
    try {
      const res = await api.get('/api/portfolio')
      setPortfolios(res.data.data)
      if (res.data.data.length > 0 && !activeId) {
        setActiveId(res.data.data[0].id)
      }
    } catch (err) { setError(err.message) }
    setLoading(false)
  }

  const fetchPositions = async () => {
    if (!activeId) { setPositions([]); return }
    try {
      const res = await api.get(`/api/portfolio/${activeId}/positions`)
      setPositions(res.data.data)
    } catch {}
  }

  const fetchPrices = async (tickers) => {
    if (tickers.length === 0) return
    try {
      const res = await api.get(`/api/markets/prices?tickers=${tickers.join(',')}`)
      setPrices(res.data.data)
    } catch {}
  }

  const fetchIVData = async (tickers) => {
    for (const ticker of tickers) {
      if (!ivData[ticker]) {
        try {
          const res = await api.get(`/api/intrinsic/${ticker}`)
          setIvData(prev => ({ ...prev, [ticker]: res.data }))
        } catch {}
      }
    }
  }

  useEffect(() => { fetchPortfolios() }, [])
  useEffect(() => { fetchPositions(); setAnalysis(null) }, [activeId])

  const tickers = useMemo(() => [...new Set(positions.map(p => p.ticker))], [positions])
  useEffect(() => {
    if (tickers.length > 0) {
      fetchPrices(tickers)
      fetchIVData(tickers)
    }
    const interval = setInterval(() => { if (tickers.length > 0) fetchPrices(tickers) }, 60000)
    return () => clearInterval(interval)
  }, [tickers.join(',')])

  // Enriched positions
  const enriched = useMemo(() => {
    return positions.map(pos => {
      const quote = prices[pos.ticker] || {}
      const iv = ivData[pos.ticker] || {}
      const currentPrice = quote.price || null
      const costBasis = pos.shares * pos.avg_cost
      const currentValue = currentPrice != null ? pos.shares * currentPrice : null
      const gain = currentValue != null ? currentValue - costBasis : null
      const gainPct = gain != null && costBasis > 0 ? (gain / costBasis) * 100 : null
      const mosPrice = iv.summary?.mosPrice || null
      const verdict = iv.summary?.verdict || null
      return { ...pos, currentPrice, name: quote.name, costBasis, currentValue, gain, gainPct, mosPrice, verdict }
    })
  }, [positions, prices, ivData])

  const summary = useMemo(() => {
    const totalInvested = enriched.reduce((s, p) => s + p.costBasis, 0)
    const totalValue = enriched.reduce((s, p) => s + (p.currentValue ?? p.costBasis), 0)
    const totalGain = totalValue - totalInvested
    const totalGainPct = totalInvested > 0 ? (totalGain / totalInvested) * 100 : 0
    return { totalInvested, totalValue, totalGain, totalGainPct }
  }, [enriched])

  const createPortfolio = async () => {
    if (!createName.trim()) return
    try {
      await api.post('/api/portfolio', { name: createName.trim(), initialDeposit: 0 })
      setCreateName('')
      setShowCreateModal(false)
      fetchPortfolios()
    } catch {}
  }

  const deletePortfolio = async (id) => {
    const portfolio = portfolios.find(p => p.id === id)
    setConfirmDialog({
      open: true, danger: true,
      title: 'Delete Portfolio',
      message: `Are you sure you want to delete "${portfolio?.name || 'this portfolio'}"? All holdings will be removed.`,
      onConfirm: async () => {
        setConfirmDialog(d => ({ ...d, open: false }))
        try {
          await api.delete(`/api/portfolio/${id}`)
          const remaining = portfolios.filter(p => p.id !== id)
          setPortfolios(remaining)
          if (activeId === id && remaining.length > 0) setActiveId(remaining[0].id)
          else if (remaining.length === 0) setActiveId(null)
        } catch {}
      }
    })
  }

  const addStock = async (e) => {
    e.preventDefault()
    setAddError('')
    const ticker = addForm.ticker.trim().toUpperCase()
    const shares = parseFloat(addForm.shares)
    if (!ticker) return setAddError('Enter a ticker symbol')
    if (!shares || shares <= 0) return setAddError('Enter valid number of shares')

    setAddLoading(true)
    try {
      await api.post(`/api/portfolio/${activeId}/positions`, {
        ticker,
        shares,
        avgCost: addForm.avgCost ? parseFloat(addForm.avgCost) : undefined,
      })
      setAddForm({ ticker: '', shares: '', avgCost: '' })
      fetchPositions()
      toast('Position added', 'success')
    } catch (err) {
      toast(err.response?.data?.error || err.message || 'Something went wrong', 'error')
    }
    setAddLoading(false)
  }

  const removePosition = (posId) => {
    const pos = enriched.find(p => p.id === posId)
    setConfirmDialog({
      open: true, danger: true,
      title: 'Remove Position',
      message: `Remove ${pos?.ticker || 'this position'} from your portfolio?`,
      onConfirm: async () => {
        setConfirmDialog(d => ({ ...d, open: false }))
        try {
          await api.delete(`/api/portfolio/${activeId}/positions/${posId}`)
          fetchPositions()
        } catch {}
      }
    })
  }

  const fetchAnalysis = async () => {
    setAnalysisLoading(true)
    try {
      const res = await api.get(`/api/portfolio/${activeId}/analysis`)
      setAnalysis(res.data.data.analysis)
    } catch {}
    setAnalysisLoading(false)
  }

  if (loading) return <LoadingSpinner height={200} />
  if (error) return <ErrorBanner message={error} onRetry={fetchPortfolios} />

  return (
    <div>
      {/* Tabs */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h1 style={{ fontSize: 'var(--text-3xl)' }}>Portfolio</h1>
      </div>
      <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '1.5rem', borderBottom: '2px solid var(--color-border)' }}>
        {[
          { key: 'portfolio', label: 'Portfolio' },
          { key: 'chat', label: 'AI Chat' },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            padding: '0.6rem 1.25rem', border: 'none', borderBottom: tab === t.key ? '2px solid var(--color-accent)' : '2px solid transparent',
            background: 'none', cursor: 'pointer', fontWeight: tab === t.key ? 600 : 400,
            color: tab === t.key ? 'var(--color-accent)' : 'var(--color-text-muted)',
            fontSize: 'var(--text-base)', marginBottom: '-2px', transition: 'all 0.15s ease',
          }}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'chat' && <PageChat context="portfolio" />}

      {tab === 'portfolio' && <>
      {/* Create Portfolio Modal */}
      {showCreateModal && (
        <div onClick={() => setShowCreateModal(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}>
          <div onClick={e => e.stopPropagation()} className="card" style={{ maxWidth: 400, width: '100%' }}>
            <h3 style={{ fontSize: 'var(--text-xl)', marginBottom: '1rem' }}>New Portfolio</h3>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ fontSize: 'var(--text-sm)', textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>Portfolio Name</label>
              <input className="input" value={createName} onChange={e => setCreateName(e.target.value)} placeholder="e.g. My Investments"
                autoFocus onKeyDown={e => e.key === 'Enter' && createPortfolio()} />
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button className="btn btn-ghost" onClick={() => setShowCreateModal(false)} style={{ flex: 1 }}>Cancel</button>
              <button className="btn btn-primary" onClick={createPortfolio} disabled={!createName.trim()} style={{ flex: 1 }}>Create</button>
            </div>
          </div>
        </div>
      )}

      {/* Refresh */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
        <button className="btn btn-ghost" onClick={() => { fetchPortfolios(); fetchPositions(); if (tickers.length > 0) fetchPrices(tickers) }} style={{ fontSize: 'var(--text-sm)' }}>Refresh</button>
      </div>

      {/* Portfolio tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
        {portfolios.map(p => (
          <div key={p.id} onClick={() => setActiveId(p.id)} style={{
            padding: '0.4rem 0.75rem', borderRadius: 4, cursor: 'pointer', fontSize: 'var(--text-base)',
            background: p.id === activeId ? 'var(--color-primary)' : 'var(--color-surface)',
            color: p.id === activeId ? 'var(--color-accent)' : 'var(--color-text)',
            border: '1px solid ' + (p.id === activeId ? 'var(--color-primary)' : 'var(--color-border)'),
            display: 'flex', alignItems: 'center', gap: '0.5rem'
          }}>
            {p.name}
            {p.id === activeId && portfolios.length > 1 && (
              <button onClick={(e) => { e.stopPropagation(); deletePortfolio(p.id) }} style={{ background: 'none', border: 'none', color: p.id === activeId ? 'var(--color-accent)' : 'var(--color-text-faint)', cursor: 'pointer', fontSize: 'var(--text-base)', lineHeight: 1 }}>x</button>
            )}
          </div>
        ))}
        <button onClick={() => setShowCreateModal(true)} style={{ padding: '0.4rem 0.6rem', background: 'none', border: '1px dashed var(--color-border-dark)', borderRadius: 4, cursor: 'pointer', color: 'var(--color-text-muted)', fontSize: 'var(--text-base)' }}>+ New</button>
      </div>

      {activePortfolio && (
        <>
          {/* Add Stock Form */}
          <div className="card" style={{ marginBottom: '1rem', padding: '1rem' }}>
            <h3 style={{ fontSize: 'var(--text-base)', marginBottom: '0.75rem' }}>Add Stock</h3>
            <form onSubmit={addStock} style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div>
                <label style={{ fontSize: 'var(--text-sm)', textTransform: 'uppercase', color: 'var(--color-text-muted)', display: 'block', marginBottom: 2 }}>Ticker</label>
                <input className="input mono" value={addForm.ticker} onChange={e => setAddForm(p => ({ ...p, ticker: e.target.value.toUpperCase() }))} placeholder="AAPL" style={{ width: 100 }} />
              </div>
              <div>
                <label style={{ fontSize: 'var(--text-sm)', textTransform: 'uppercase', color: 'var(--color-text-muted)', display: 'block', marginBottom: 2 }}>Shares</label>
                <input className="input" type="number" step="any" min="0" value={addForm.shares} onChange={e => setAddForm(p => ({ ...p, shares: e.target.value }))} placeholder="10" style={{ width: 90 }} />
              </div>
              <div>
                <label style={{ fontSize: 'var(--text-sm)', textTransform: 'uppercase', color: 'var(--color-text-muted)', display: 'block', marginBottom: 2 }}>Avg Cost <span className="text-faint">(optional)</span></label>
                <input className="input" type="number" step="any" min="0" value={addForm.avgCost} onChange={e => setAddForm(p => ({ ...p, avgCost: e.target.value }))} placeholder="Auto" style={{ width: 100 }} />
              </div>
              <button type="submit" className="btn btn-primary" disabled={addLoading} style={{ fontSize: 'var(--text-sm)' }}>
                {addLoading ? 'Adding...' : 'Add'}
              </button>
              {addError && <span style={{ color: 'var(--color-danger)', fontSize: 'var(--text-sm)' }}>{addError}</span>}
            </form>
          </div>

          {/* Summary Cards */}
          {enriched.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem', marginBottom: '1.5rem' }}>
              <div className="card" style={{ padding: '1rem' }}>
                <p className="text-muted" style={{ fontSize: 'var(--text-sm)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Cost Basis</p>
                <span className="mono" style={{ fontSize: 'var(--text-xl)' }}>{formatCurrency(summary.totalInvested)}</span>
              </div>
              <div className="card" style={{ padding: '1rem' }}>
                <p className="text-muted" style={{ fontSize: 'var(--text-sm)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Market Value</p>
                <span className="mono" style={{ fontSize: 'var(--text-xl)', color: 'var(--color-accent)' }}>{formatCurrency(summary.totalValue)}</span>
              </div>
              <div className="card" style={{ padding: '1rem' }}>
                <p className="text-muted" style={{ fontSize: 'var(--text-sm)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Gain/Loss</p>
                <span className="mono" style={{ fontSize: 'var(--text-xl)', color: numColor(summary.totalGain) }}>{summary.totalGain >= 0 ? '+' : ''}{formatCurrency(summary.totalGain)}</span>
                <p className="mono" style={{ fontSize: 'var(--text-sm)', color: numColor(summary.totalGainPct) }}>{summary.totalGainPct >= 0 ? '+' : ''}{summary.totalGainPct.toFixed(2)}%</p>
              </div>
            </div>
          )}

          {/* Positions Table */}
          {enriched.length > 0 ? (
            <div className="card" style={{ marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: 'var(--text-xl)', marginBottom: '0.75rem' }}>Holdings</h2>
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>Ticker</th><th>Shares</th><th>Avg Cost</th><th>Price</th><th>Value</th><th>Gain/Loss</th><th>Buy Below</th><th>Verdict</th><th>Weight</th><th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {enriched.map(p => {
                      const weight = summary.totalValue > 0 && p.currentValue != null ? (p.currentValue / summary.totalValue) * 100 : null
                      return (
                        <tr key={p.id}>
                          <td><strong>{p.ticker}</strong>{p.name && <><br /><span className="text-muted" style={{ fontSize: 'var(--text-sm)' }}>{p.name}</span></>}</td>
                          <td className="mono">{p.shares}</td>
                          <td className="mono">{formatCurrency(p.avg_cost)}</td>
                          <td className="mono" style={{ fontWeight: 600 }}>{p.currentPrice ? formatCurrency(p.currentPrice) : '--'}</td>
                          <td className="mono">{p.currentValue != null ? formatCurrency(p.currentValue) : '--'}</td>
                          <td>
                            {p.gain != null ? (
                              <div>
                                <span className="mono" style={{ color: numColor(p.gain), fontWeight: 600 }}>{p.gain >= 0 ? '+' : ''}{formatCurrency(p.gain)}</span>
                                <br /><span className="mono" style={{ color: numColor(p.gainPct), fontSize: 'var(--text-sm)' }}>{p.gainPct >= 0 ? '+' : ''}{p.gainPct?.toFixed(2)}%</span>
                              </div>
                            ) : '--'}
                          </td>
                          <td className="mono" style={{ color: 'var(--color-accent)', fontWeight: 600 }}>{p.mosPrice ? formatCurrency(p.mosPrice) : '--'}</td>
                          <td>
                            {p.verdict && p.verdict !== 'N/A' ? (
                              <span className={`badge ${p.verdict === 'UNDERVALUED' ? 'badge-success' : p.verdict === 'FAIRLY VALUED' ? 'badge-gold' : 'badge-danger'}`}>{p.verdict}</span>
                            ) : '--'}
                          </td>
                          <td className="mono">{weight != null ? weight.toFixed(1) + '%' : '--'}</td>
                          <td>
                            <button onClick={() => removePosition(p.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-faint)', fontSize: 'var(--text-lg)' }} title="Remove">x</button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div style={{ marginBottom: '1.5rem' }}>
              <EmptyState
                icon="M3 10h18M3 14h18M3 18h18M3 6h18"
                title="No Holdings"
                description="Add stocks above to build your portfolio."
              />
            </div>
          )}

          {/* Allocation Breakdown + AI Analysis */}
          {enriched.length > 0 && (
            <div className="card" style={{ marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: 'var(--text-xl)', marginBottom: '0.75rem' }}>Allocation</h2>
              {[...enriched].sort((a, b) => (b.currentValue || 0) - (a.currentValue || 0)).map(p => {
                const weight = summary.totalValue > 0 ? ((p.currentValue || 0) / summary.totalValue) * 100 : 0
                return (
                  <div key={p.id} style={{ marginBottom: '0.4rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-sm)', marginBottom: '0.15rem' }}>
                      <span>{p.ticker}</span>
                      <span className="mono">{weight.toFixed(1)}%</span>
                    </div>
                    <div style={{ height: 6, background: 'var(--color-surface-2)', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${weight}%`, background: weight > 30 ? 'var(--color-accent)' : 'var(--color-primary)', borderRadius: 3 }} />
                    </div>
                  </div>
                )
              })}

              {/* AI Analysis — inline at bottom */}
              <div style={{ marginTop: '1.25rem', borderTop: '1px solid var(--color-border)', paddingTop: '1rem' }}>
                {analysisLoading ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div className="skeleton" style={{ height: 14, width: '100%' }} />
                  </div>
                ) : analysis ? (
                  <div>
                    <p style={{ fontSize: 'var(--text-base)', lineHeight: 1.7, color: 'var(--color-text)' }}>{analysis}</p>
                    <button onClick={() => { setAnalysis(null); fetchAnalysis() }} className="btn btn-ghost" style={{ fontSize: 'var(--text-sm)', marginTop: '0.5rem', padding: '0.2rem 0.5rem' }}>Refresh analysis</button>
                  </div>
                ) : (
                  <button className="btn btn-ghost" onClick={fetchAnalysis} style={{ fontSize: 'var(--text-sm)' }}>
                    Generate AI Analysis
                  </button>
                )}
              </div>
            </div>
          )}

        </>
      )}

      {portfolios.length === 0 && (
        <EmptyState
          icon="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
          title="No Portfolios"
          description="Create a portfolio to start tracking your holdings and performance."
          actionLabel="Create Portfolio"
          onAction={() => setShowCreateModal(true)}
        />
      )}

      <p className="text-faint" style={{ fontSize: 'var(--text-sm)', textAlign: 'center', marginTop: '2rem' }}>
        IV uses Owner Earnings + DCF with 30% Margin of Safety. Not financial advice.
      </p>
      </>}
      <ConfirmDialog {...confirmDialog} onCancel={() => setConfirmDialog(d => ({ ...d, open: false }))} />
    </div>
  )
}

