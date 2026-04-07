import { useState, useEffect, useMemo, useRef } from 'react'
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

  // Search + stock detail popup
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [showSearchDropdown, setShowSearchDropdown] = useState(false)
  const [selectedStock, setSelectedStock] = useState(null) // { symbol, name, exchange, quote, iv }
  const [stockDetailLoading, setStockDetailLoading] = useState(false)
  const [orderForm, setOrderForm] = useState({ side: 'buy', shares: '', avgCost: '', source: 'import', targetPrice: '' })
  const [orderError, setOrderError] = useState('')
  const [orderLoading, setOrderLoading] = useState(false)
  const [freeCash, setDryPowder] = useState(0)
  const searchRef = useRef(null)
  const searchTimeout = useRef(null)

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

  const fetchFreeCash = async () => {
    try {
      const res = await api.get('/api/savings')
      setDryPowder(res.data.data?.free_cash || 0)
    } catch {}
  }
  useEffect(() => { fetchPortfolios(); fetchFreeCash() }, [])
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

  // Search stocks by name or ticker
  const searchStocks = async (query) => {
    if (!query || query.length < 1) { setSearchResults([]); return }
    setSearchLoading(true)
    try {
      const res = await api.get(`/api/markets/search?q=${encodeURIComponent(query)}`)
      setSearchResults(res.data.data || [])
      setShowSearchDropdown(true)
    } catch { setSearchResults([]) }
    setSearchLoading(false)
  }

  const handleSearchInput = (val) => {
    setSearchQuery(val)
    if (searchTimeout.current) clearTimeout(searchTimeout.current)
    searchTimeout.current = setTimeout(() => searchStocks(val), 300)
  }

  // Open stock detail popup
  const openStockDetail = async (stock) => {
    setShowSearchDropdown(false)
    setSearchQuery('')
    setStockDetailLoading(true)
    setSelectedStock({ symbol: stock.symbol, name: stock.name, exchange: stock.exchange })
    setOrderForm({ side: 'buy', shares: '', avgCost: '', source: 'import', targetPrice: '' })
    setOrderError('')
    try {
      const [priceRes, ivRes] = await Promise.all([
        api.get(`/api/markets/prices?tickers=${stock.symbol}`),
        api.get(`/api/intrinsic/${stock.symbol}`).catch(() => ({ data: {} })),
      ])
      const quote = priceRes.data.data?.[stock.symbol] || {}
      const iv = ivRes.data || {}
      setSelectedStock(prev => ({ ...prev, quote, iv }))
    } catch {}
    setStockDetailLoading(false)
  }

  // Close search dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) setShowSearchDropdown(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Submit order from stock detail popup
  const submitOrder = async () => {
    setOrderError('')
    const shares = parseFloat(orderForm.shares)
    if (!shares || shares <= 0) return setOrderError('Enter valid number of shares')
    if (!selectedStock?.symbol) return

    setOrderLoading(true)
    try {
      if (orderForm.side === 'buy') {
        const price = orderForm.avgCost ? parseFloat(orderForm.avgCost) : (selectedStock.quote?.price || 0)
        const totalCost = price * shares
        if (orderForm.source === 'savings' && totalCost > freeCash) {
          setOrderLoading(false)
          return setOrderError(`Not enough free cash. You have ${formatCurrency(freeCash)} but this order costs ${formatCurrency(totalCost)}`)
        }
        await api.post(`/api/portfolio/${activeId}/positions`, {
          ticker: selectedStock.symbol,
          shares,
          avgCost: orderForm.avgCost ? parseFloat(orderForm.avgCost) : undefined,
          source: orderForm.source || 'import',
        })
        toast(`Bought ${shares} shares of ${selectedStock.symbol}`, 'success')
      } else if (orderForm.side === 'sell') {
        const pos = positions.find(p => p.ticker === selectedStock.symbol)
        if (!pos) return setOrderError(`You don't hold ${selectedStock.symbol}`)
        if (shares > pos.shares) return setOrderError(`You only hold ${pos.shares} shares`)
        await api.post(`/api/portfolio/${activeId}/orders`, {
          ticker: selectedStock.symbol, side: 'sell', shares,
          orderType: 'market',
        })
        toast(`Sold ${shares} shares of ${selectedStock.symbol}`, 'success')
      } else if (orderForm.side === 'stop_loss') {
        const tp = parseFloat(orderForm.targetPrice)
        if (!tp || tp <= 0) return setOrderError('Enter a stop loss price')
        await api.post(`/api/portfolio/${activeId}/orders`, {
          ticker: selectedStock.symbol, side: 'sell', shares,
          orderType: 'stop_loss', targetPrice: tp,
        })
        toast(`Stop loss set for ${selectedStock.symbol} at ${formatCurrency(tp)}`, 'success')
      }
      setSelectedStock(null)
      fetchPositions()
      if (orderForm.source === 'savings') fetchFreeCash()
    } catch (err) {
      setOrderError(err.response?.data?.error || err.message || 'Something went wrong')
    }
    setOrderLoading(false)
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
        <div>
          <h1 style={{ fontSize: 'var(--text-3xl)', marginBottom: '0.15rem' }}>Portfolio</h1>
          <p className="label-caps">{positions.length} holding{positions.length !== 1 ? 's' : ''}</p>
        </div>
      </div>
      <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '1.5rem', borderBottom: '2px solid var(--color-border)' }}>
        {[
          { key: 'portfolio', label: 'Portfolio' },
          { key: 'chat', label: 'AI Chat' },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            padding: '0.6rem 1.25rem', border: 'none', borderBottom: tab === t.key ? '2px solid var(--color-gold)' : '2px solid transparent',
            background: 'none', cursor: 'pointer', fontWeight: tab === t.key ? 600 : 400,
            color: tab === t.key ? 'var(--color-gold)' : 'var(--color-text-secondary)',
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
              <label style={{ fontSize: 'var(--text-sm)', textTransform: 'uppercase', color: 'var(--color-text-secondary)' }}>Portfolio Name</label>
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
            background: p.id === activeId ? 'var(--color-navy)' : 'var(--color-surface)',
            color: p.id === activeId ? 'var(--color-gold)' : 'var(--color-text-primary)',
            border: '1px solid ' + (p.id === activeId ? 'var(--color-navy)' : 'var(--color-border)'),
            display: 'flex', alignItems: 'center', gap: '0.5rem'
          }}>
            {p.name}
            {p.id === activeId && portfolios.length > 1 && (
              <button onClick={(e) => { e.stopPropagation(); deletePortfolio(p.id) }} style={{ background: 'none', border: 'none', color: p.id === activeId ? 'var(--color-gold)' : 'var(--color-text-muted)', cursor: 'pointer', fontSize: 'var(--text-base)', lineHeight: 1 }}>x</button>
            )}
          </div>
        ))}
        <button onClick={() => setShowCreateModal(true)} style={{ padding: '0.4rem 0.6rem', background: 'none', border: '1px dashed var(--color-border-dark)', borderRadius: 4, cursor: 'pointer', color: 'var(--color-text-secondary)', fontSize: 'var(--text-base)' }}>+ New</button>
      </div>

      {activePortfolio && (
        <>
          {/* Search Bar */}
          <div ref={searchRef} style={{ position: 'relative', marginBottom: '1rem' }}>
            <div className="card" style={{ padding: '0.75rem 1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <input
                  className="input"
                  value={searchQuery}
                  onChange={e => handleSearchInput(e.target.value)}
                  onFocus={() => { if (searchResults.length > 0) setShowSearchDropdown(true) }}
                  placeholder="Search by company name or ticker..."
                  style={{ border: 'none', background: 'transparent', flex: 1, padding: '0.25rem 0', fontSize: 'var(--text-base)' }}
                />
                {searchLoading && <span className="text-faint" style={{ fontSize: 'var(--text-sm)' }}>...</span>}
              </div>
            </div>
            {showSearchDropdown && searchResults.length > 0 && (
              <div style={{
                position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
                background: 'var(--color-surface)', border: '1px solid var(--color-border)',
                borderRadius: '0 0 6px 6px', maxHeight: 280, overflowY: 'auto',
                boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
              }}>
                {searchResults.map(r => (
                  <div key={r.symbol} onClick={() => openStockDetail(r)} style={{
                    padding: '0.6rem 1rem', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    borderBottom: '1px solid var(--color-border)', transition: 'background 0.1s',
                  }} onMouseEnter={e => e.currentTarget.style.background = 'var(--color-surface-2)'}
                     onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <div>
                      <span className="mono" style={{ fontWeight: 600, marginRight: '0.5rem' }}>{r.symbol}</span>
                      <span className="text-muted" style={{ fontSize: 'var(--text-sm)' }}>{r.name}</span>
                    </div>
                    <span className="text-faint" style={{ fontSize: 'var(--text-xs)' }}>{r.exchange}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Stock Detail Popup */}
          {selectedStock && (
            <div onClick={() => setSelectedStock(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}>
              <div onClick={e => e.stopPropagation()} className="card" style={{ maxWidth: 520, width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
                {stockDetailLoading ? (
                  <div style={{ padding: '2rem', textAlign: 'center' }}><LoadingSpinner height={60} /></div>
                ) : (
                  <>
                    {/* Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                      <div>
                        <h2 style={{ fontSize: 'var(--text-2xl)', marginBottom: '0.15rem' }}>{selectedStock.symbol}</h2>
                        <p className="text-muted" style={{ fontSize: 'var(--text-sm)' }}>{selectedStock.name} · {selectedStock.exchange}</p>
                      </div>
                      <button onClick={() => setSelectedStock(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', fontSize: 'var(--text-xl)' }}>×</button>
                    </div>

                    {/* Price + Verdict */}
                    <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                      <div>
                        <p className="label-caps">Price</p>
                        <span className="mono" style={{ fontSize: 'var(--text-2xl)', fontWeight: 700 }}>
                          {selectedStock.quote?.price ? formatCurrency(selectedStock.quote.price) : '--'}
                        </span>
                      </div>
                      {selectedStock.iv?.summary?.verdict && (
                        <div>
                          <p className="label-caps">Verdict</p>
                          <span className={`badge ${selectedStock.iv.summary.verdict === 'UNDERVALUED' ? 'badge-success' : selectedStock.iv.summary.verdict === 'FAIRLY VALUED' ? 'badge-gold' : 'badge-danger'}`} style={{ fontSize: 'var(--text-sm)' }}>
                            {selectedStock.iv.summary.verdict}
                          </span>
                        </div>
                      )}
                      {selectedStock.iv?.summary?.mosPrice && (
                        <div>
                          <p className="label-caps">Buy Below</p>
                          <span className="mono" style={{ fontSize: 'var(--text-xl)', color: 'var(--color-gold)', fontWeight: 600 }}>
                            {formatCurrency(selectedStock.iv.summary.mosPrice)}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Key Stats */}
                    {selectedStock.iv?.rawInputs && (() => {
                      const ri = selectedStock.iv.rawInputs
                      const fmtBig = (v) => !v ? '--' : v >= 1e12 ? `$${(v / 1e12).toFixed(1)}T` : v >= 1e9 ? `$${(v / 1e9).toFixed(1)}B` : `$${(v / 1e6).toFixed(0)}M`
                      return (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', marginBottom: '1rem' }}>
                          {[
                            { label: 'P/E Ratio', val: ri.peRatio ? ri.peRatio.toFixed(1) : '--' },
                            { label: 'EPS', val: ri.eps ? `$${ri.eps.toFixed(2)}` : '--' },
                            { label: 'Book Value', val: ri.bookValuePerShare ? `$${ri.bookValuePerShare.toFixed(2)}` : '--' },
                            { label: 'Free Cash Flow', val: fmtBig(ri.freeCashFlow) },
                            { label: 'Net Income', val: fmtBig(ri.netIncome) },
                            { label: 'Growth Rate', val: ri.growthRateRaw ? `${(ri.growthRateRaw * 100).toFixed(1)}%` : '--' },
                          ].map(s => (
                            <div key={s.label} style={{ padding: '0.5rem', background: 'var(--color-surface-2)', borderRadius: 4, textAlign: 'center' }}>
                              <p className="text-faint" style={{ fontSize: 'var(--text-xs)', textTransform: 'uppercase', marginBottom: '0.15rem' }}>{s.label}</p>
                              <span className="mono" style={{ fontSize: 'var(--text-sm)', fontWeight: 600 }}>{s.val}</span>
                            </div>
                          ))}
                        </div>
                      )
                    })()}

                    {selectedStock.iv?.summary?.upsidePct != null && (
                      <div style={{ padding: '0.6rem', borderRadius: 4, marginBottom: '1rem',
                        background: selectedStock.iv.summary.upsidePct > 0 ? 'rgba(46,125,94,0.08)' : 'rgba(180,60,60,0.08)',
                        border: `1px solid ${selectedStock.iv.summary.upsidePct > 0 ? 'var(--color-positive)' : 'var(--color-negative)'}`,
                      }}>
                        <span style={{ fontSize: 'var(--text-sm)', color: selectedStock.iv.summary.upsidePct > 0 ? 'var(--color-positive)' : 'var(--color-negative)' }}>
                          {selectedStock.iv.summary.upsidePct > 0 ? `${selectedStock.iv.summary.upsidePct.toFixed(1)}% upside to intrinsic value` : `${Math.abs(selectedStock.iv.summary.upsidePct).toFixed(1)}% above intrinsic value`}
                        </span>
                      </div>
                    )}

                    {/* Order Form */}
                    <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '1rem' }}>
                      <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '0.75rem' }}>
                        {['buy', 'sell', 'stop_loss'].map(side => (
                          <button key={side} onClick={() => setOrderForm(f => ({ ...f, side }))}
                            className={`btn ${orderForm.side === side ? 'btn-primary' : 'btn-ghost'}`}
                            style={{ flex: 1, fontSize: 'var(--text-sm)' }}>
                            {side === 'stop_loss' ? 'Stop Loss' : side.charAt(0).toUpperCase() + side.slice(1)}
                          </button>
                        ))}
                      </div>

                      {orderForm.side === 'buy' && (
                        <div style={{ marginBottom: '0.75rem' }}>
                          <label className="text-faint" style={{ fontSize: 'var(--text-sm)', display: 'block', marginBottom: '0.25rem', textTransform: 'uppercase' }}>Source</label>
                          <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                            {[
                              { key: 'import', label: 'Already Own' },
                              { key: 'savings', label: `Free Cash (${formatCurrency(freeCash)})` },
                              { key: 'stipend', label: 'Stipend/RSU' },
                              { key: 'gift', label: 'Gift' },
                            ].map(s => (
                              <button key={s.key} onClick={() => setOrderForm(f => ({ ...f, source: s.key }))}
                                className={`btn ${orderForm.source === s.key ? 'btn-primary' : 'btn-ghost'}`}
                                style={{ fontSize: 'var(--text-xs)', padding: '0.25rem 0.5rem' }}>
                                {s.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                        <div>
                          <label className="text-faint" style={{ fontSize: 'var(--text-sm)', display: 'block', marginBottom: 2, textTransform: 'uppercase' }}>Shares</label>
                          <input className="input" type="number" step="any" min="0" value={orderForm.shares}
                            onChange={e => setOrderForm(f => ({ ...f, shares: e.target.value }))} placeholder="10" style={{ width: 100 }} />
                        </div>
                        {orderForm.side === 'buy' && (
                          <div>
                            <label className="text-faint" style={{ fontSize: 'var(--text-sm)', display: 'block', marginBottom: 2, textTransform: 'uppercase' }}>Avg Cost <span className="text-faint">(opt)</span></label>
                            <input className="input" type="number" step="any" min="0" value={orderForm.avgCost}
                              onChange={e => setOrderForm(f => ({ ...f, avgCost: e.target.value }))} placeholder="Auto" style={{ width: 100 }} />
                          </div>
                        )}
                        {orderForm.side === 'stop_loss' && (
                          <div>
                            <label className="text-faint" style={{ fontSize: 'var(--text-sm)', display: 'block', marginBottom: 2, textTransform: 'uppercase' }}>Trigger Price</label>
                            <input className="input" type="number" step="any" min="0" value={orderForm.targetPrice}
                              onChange={e => setOrderForm(f => ({ ...f, targetPrice: e.target.value }))} placeholder="$0" style={{ width: 100 }} />
                          </div>
                        )}
                        <button className="btn btn-primary" onClick={submitOrder} disabled={orderLoading} style={{ fontSize: 'var(--text-sm)' }}>
                          {orderLoading ? 'Processing...' : orderForm.side === 'buy' ? 'Buy' : orderForm.side === 'sell' ? 'Sell' : 'Set Stop Loss'}
                        </button>
                      </div>
                      {orderError && <p style={{ color: 'var(--color-negative)', fontSize: 'var(--text-sm)', marginTop: '0.5rem' }}>{orderError}</p>}

                      {orderForm.side === 'buy' && selectedStock.quote?.price && orderForm.shares && (
                        <p className="text-faint" style={{ fontSize: 'var(--text-sm)', marginTop: '0.5rem' }}>
                          Estimated total: {formatCurrency(selectedStock.quote.price * parseFloat(orderForm.shares || 0))}
                        </p>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Summary Cards */}
          {enriched.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem', marginBottom: '1.5rem' }}>
              <div className="card" style={{ padding: '1rem' }}>
                <p className="text-muted" style={{ fontSize: 'var(--text-sm)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Cost Basis</p>
                <span className="mono" style={{ fontSize: 'var(--text-xl)' }}>{formatCurrency(summary.totalInvested)}</span>
              </div>
              <div className="card" style={{ padding: '1rem' }}>
                <p className="text-muted" style={{ fontSize: 'var(--text-sm)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Market Value</p>
                <span className="mono" style={{ fontSize: 'var(--text-xl)', color: 'var(--color-gold)' }}>{formatCurrency(summary.totalValue)}</span>
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
                          <td>
                            <strong>{p.ticker}</strong>
                            {p.name && <><br /><span className="text-muted" style={{ fontSize: 'var(--text-sm)' }}>{p.name}</span></>}
                            {p.source && p.source !== 'savings' && p.source !== 'import' && (
                              <><br /><span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-gold-dim, var(--color-gold))' }}>
                                {p.source === 'stipend' ? 'Work stipend' : 'Gift'}
                              </span></>
                            )}
                            {p.source === 'savings' && <><br /><span className="text-faint" style={{ fontSize: 'var(--text-xs)' }}>From savings</span></>}
                            {p.source === 'import' && <><br /><span className="text-faint" style={{ fontSize: 'var(--text-xs)' }}>Imported</span></>}
                          </td>
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
                          <td className="mono" style={{ color: 'var(--color-gold)', fontWeight: 600 }}>{p.mosPrice ? formatCurrency(p.mosPrice) : '--'}</td>
                          <td>
                            {p.verdict && p.verdict !== 'N/A' ? (
                              <span className={`badge ${p.verdict === 'UNDERVALUED' ? 'badge-success' : p.verdict === 'FAIRLY VALUED' ? 'badge-gold' : 'badge-danger'}`}>{p.verdict}</span>
                            ) : '--'}
                          </td>
                          <td className="mono">{weight != null ? weight.toFixed(1) + '%' : '--'}</td>
                          <td>
                            <button onClick={() => removePosition(p.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', fontSize: 'var(--text-lg)' }} title="Remove">x</button>
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
                      <div style={{ height: '100%', width: `${weight}%`, background: weight > 30 ? 'var(--color-gold)' : 'var(--color-navy)', borderRadius: 3 }} />
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
                    <p style={{ fontSize: 'var(--text-base)', lineHeight: 1.7, color: 'var(--color-text-primary)' }}>{analysis}</p>
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

