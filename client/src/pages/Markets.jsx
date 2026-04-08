import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import useApi, { api } from '../hooks/useApi'
import { formatCurrency } from '../components/NumberDisplay'
import LoadingSpinner from '../components/LoadingSpinner'
import ErrorBanner from '../components/ErrorBanner'
import LearnTooltip from '../components/LearnTooltip'

const LEARN_TERMS = {
  buyBelowPrice: 'Buy Below',
  upside: 'Upside %',
  peRatio: 'P/E Ratio',
  forwardPE: 'Forward P/E',
  pegRatio: 'PEG Ratio',
  eps: 'EPS',
  freeCashFlow: 'Free Cash Flow',
  verdict: 'Intrinsic Value',
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function fmtNum(v, d = 1) { return v != null ? v.toFixed(d) : 'N/A' }
function fmtPct(v) { return v != null ? (v * 100).toFixed(1) + '%' : 'N/A' }
function fmtLarge(n) {
  if (n == null) return 'N/A'
  if (Math.abs(n) >= 1e12) return (n / 1e12).toFixed(1) + 'T'
  if (Math.abs(n) >= 1e9) return (n / 1e9).toFixed(1) + 'B'
  if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(1) + 'M'
  if (Math.abs(n) >= 1e3) return (n / 1e3).toFixed(1) + 'K'
  return n.toFixed(0)
}

function verdictBadge(v) {
  if (!v || v === 'N/A') return <span className="badge badge-neutral">N/A</span>
  if (v === 'UNDERVALUED') return <span className="verdict-badge verdict-undervalued">{v}</span>
  if (v === 'FAIRLY VALUED') return <span className="verdict-badge verdict-fairly">{v}</span>
  return <span className="verdict-badge verdict-overvalued">{v}</span>
}

function ratingBadge(r) {
  if (!r) return <span className="text-muted">N/A</span>
  const l = r.toLowerCase()
  const cls = l.includes('buy') ? 'badge-success' : l.includes('sell') ? 'badge-danger' : 'badge-neutral'
  const label = r.replace('strong', 'Strong ').replace(/\b\w/g, c => c.toUpperCase()).trim()
  return <span className={`badge ${cls}`}>{label}</span>
}

// ─── SCREENER COLUMNS ───────────────────────────────────────────────────────

const COLUMNS = [
  { key: 'ticker', label: 'Ticker', tip: 'The stock\'s ticker symbol used to identify the company on the exchange (e.g. AAPL = Apple).' },
  { key: 'currentPrice', label: 'Price', tip: 'The latest market price per share, fetched in real-time from Yahoo Finance.' },
  { key: 'verdict', label: 'Verdict', tip: 'UNDERVALUED: price is below the Buy Below price. FAIRLY VALUED: within 10% of Buy Below. OVERVALUED: more than 10% above. Based on Owner Earnings + DCF intrinsic value models.' },
  { key: 'buyBelowPrice', label: 'Buy Below', tip: 'The intrinsic value with a 30% Margin of Safety applied. If the stock trades below this price, it may be undervalued. This is calculated by averaging the Owner Earnings and DCF models, then multiplying by 0.70 for a safety buffer.' },
  { key: 'upside', label: 'Upside %', tip: 'How far the current price is from the Buy Below price. Positive means the stock is still below the buy target (potential value). Negative means it\'s trading above the buy target.' },
  { key: 'peRatio', label: 'P/E', tip: 'Price-to-Earnings Ratio = share price divided by earnings per share (trailing 12 months). A P/E of 20 means you pay $20 for every $1 of profit. Lower can mean cheaper, but compare within the same industry. The historical market average is about 15x.' },
  { key: 'forwardPE', label: 'Fwd P/E', tip: 'Forward P/E uses next year\'s estimated earnings instead of last year\'s. If this is lower than the trailing P/E, analysts expect earnings to grow. Useful for comparing current price to near-term earning power.' },
  { key: 'pegRatio', label: 'PEG', tip: 'PEG = P/E divided by annual earnings growth rate. A PEG of 1.0 means you\'re paying fair value for the growth. Below 1.0 may be undervalued. Above 2.0 is often considered expensive. It normalizes P/E for growth.' },
  { key: 'eps', label: 'EPS', tip: 'Earnings Per Share = net income divided by shares outstanding. This is the dollar profit per share. It\'s the denominator of the P/E ratio. Watch for dilution (rising share count reduces EPS).' },
  { key: 'marketCap', label: 'Mkt Cap', tip: 'Market Capitalization = share price times shares outstanding. It\'s the total cost to buy the whole company. Micro <$300M, Small <$2B, Mid <$10B, Large <$200B, Mega >$200B.' },
  { key: 'revenue', label: 'Revenue', tip: 'Total sales over the trailing twelve months — the "top line." Revenue growth drives long-term returns, but it doesn\'t tell you profitability. Pair it with profit margin to see how much converts to actual profit.' },
  { key: 'freeCashFlow', label: 'FCF', tip: 'Free Cash Flow = operating cash flow minus capital expenditures. This is the cash a business generates after keeping itself running. Unlike earnings, FCF is hard to fake. It\'s the foundation of the DCF valuation model.' },
  { key: 'profitMargin', label: 'Margin', tip: 'Profit Margin = net income divided by revenue. A 20% margin means $0.20 of every $1 in sales becomes profit. Higher margins mean stronger pricing power. Software companies often have 20-30%+, while supermarkets might be 2-3%.' },
  { key: 'debtToEquity', label: 'D/E', tip: 'Debt-to-Equity = total debt divided by shareholder equity. Shows how much the company uses debt vs. its own capital. A D/E of 1.0 means equal debt and equity. Higher means more financial risk, especially in downturns.' },
  { key: 'returnOnEquity', label: 'ROE', tip: 'Return on Equity = net income divided by shareholder equity. Measures how efficiently management generates profit from invested capital. Warren Buffett looks for consistent ROE above 15%. Be cautious: high ROE fueled by debt can be misleading.' },
  { key: 'dividendYield', label: 'Div Yield', tip: 'Annual dividends per share divided by current price. A 3% yield means $3/year per $100 invested. Very high yields (8%+) often signal the market expects a dividend cut.' },
  { key: 'analystRating', label: 'Rating', tip: 'Wall Street analyst consensus: Strong Buy, Buy, Hold, Sell, or Strong Sell. Based on aggregated analyst recommendations. Treat this as one data point — analysts are often late to changes.' },
]

// ─── Tooltip Component ──────────────────────────────────────────────────────

function InfoTip({ text }) {
  const [show, setShow] = useState(false)
  return (
    <span style={{ position: 'relative', display: 'inline-block' }}>
      <button
        onClick={(e) => { e.stopPropagation(); setShow(s => !s) }}
        style={{
          background: 'none', border: '1px solid var(--color-border-dark)', borderRadius: '50%',
          width: 14, height: 14, fontSize: 'var(--text-xs)', lineHeight: '12px', textAlign: 'center',
          cursor: 'pointer', color: 'var(--color-text-secondary)', marginLeft: 3, padding: 0,
          fontWeight: 700, verticalAlign: 'middle',
        }}
        title="Click for explanation"
      >?</button>
      {show && (
        <>
          <div onClick={() => setShow(false)} style={{ position: 'fixed', inset: 0, zIndex: 99 }} />
          <div style={{
            position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)',
            marginTop: 6, width: 260, padding: '0.65rem 0.75rem',
            background: 'var(--color-surface)', border: '1px solid var(--color-border)',
            borderRadius: 6, fontSize: 'var(--text-sm)', lineHeight: 1.5,
            color: 'var(--color-text-primary)', zIndex: 100,
            whiteSpace: 'normal',
          }}>
            {text}
          </div>
        </>
      )}
    </span>
  )
}

const SP100_TICKERS = [
  'AAPL','MSFT','NVDA','AMZN','META','GOOGL','TSLA','BRK-B','JPM','LLY',
  'AVGO','V','UNH','XOM','MA','COST','HD','PG','JNJ','ABBV',
  'BAC','MRK','CRM','CVX','WMT','KO','NFLX','PEP','TMO','ACN',
  'MCD','CSCO','ABT','LIN','DHR','TXN','NEE','PM','ORCL','IBM',
  'AMGN','QCOM','GE','RTX','HON','SPGI','UPS','CAT','GS','BLK',
  'MS','AMAT','BKNG','ISRG','AXP','SYK','VRTX','ADI','GILD','MMC',
  'TJX','PLD','MDLZ','ADP','CB','SCHW','C','CVS','REGN','ZTS',
  'ETN','MO','BSX','DE','SO','DUK','BMY','SBUX','EOG','ELV',
  'PGR','AON','ITW','NOC','FI','APH','CME','MCO','WM','CL',
  'HUM','USB','TGT','NSC','FDX','EMR','PSA','D','OXY',
]

// ─── MAIN COMPONENT ─────────────────────────────────────────────────────────

export default function Markets() {
  const [tab, setTab] = useState('screener')

  return (
    <div>
      <div style={{ marginBottom: '1rem' }}>
        <h1 style={{ fontSize: 'var(--text-3xl)', marginBottom: '0.15rem' }}>Markets</h1>
        <p className="label-caps">Stock Screener & Analysis</p>
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '1.5rem', borderBottom: '2px solid var(--color-border)' }}>
        {[
          { key: 'screener', label: 'Screener' },
          { key: 'analyzer', label: 'Analyzer' },
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

      {tab === 'screener' && <ScreenerTab />}
      {tab === 'analyzer' && <AnalyzerTab />}
    </div>
  )
}

// TAB 2: SCREENER
// ═══════════════════════════════════════════════════════════════════════════════

function ScreenerTab() {
  const navigate = useNavigate()
  const [tickers, setTickers] = useState(SP100_TICKERS)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const searchRef = useRef(null)
  const searchTimeout = useRef(null)
  const [stocks, setStocks] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [lastRefreshed, setLastRefreshed] = useState(null)
  const [trackedTickers, setTrackedTickers] = useState(new Set())

  const [sortKey, setSortKey] = useState('buyBelowPrice')
  const [sortDir, setSortDir] = useState('desc')

  const [filterVerdict, setFilterVerdict] = useState('')
  const [filterMaxPE, setFilterMaxPE] = useState('')
  const [filterMinROE, setFilterMinROE] = useState('')
  const [filterMinCap, setFilterMinCap] = useState('')
  const [filterMaxCap, setFilterMaxCap] = useState('')

  const saveTickers = useCallback(async (tickerList) => {
    try { await api.post('/api/screener/tickers', { tickers: tickerList }) } catch {}
  }, [])

  // Load cached screener data from DB (no live API calls)
  const loadCachedData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await api.get('/api/screener')
      const allStocks = res.data.stocks || []
      setStocks(allStocks)
      setLastRefreshed(res.data.lastRefreshed || null)
    } catch (err) {
      setError(err.response?.data?.error || err.message)
    }
    setLoading(false)
  }, [])

  // Load tracked (starred) stocks
  const loadTracked = useCallback(async () => {
    try {
      const res = await api.get('/api/screener/tracked')
      setTrackedTickers(new Set(res.data.data || []))
    } catch {}
  }, [])

  const toggleTracked = useCallback(async (ticker) => {
    try {
      const res = await api.post('/api/screener/tracked', { ticker })
      setTrackedTickers(prev => {
        const next = new Set(prev)
        if (res.data.tracked) next.add(ticker)
        else next.delete(ticker)
        return next
      })
    } catch {}
  }, [])

  // On mount: load user's saved tickers + cached screener data + tracked stocks
  useEffect(() => {
    (async () => {
      try {
        const res = await api.get('/api/screener/tickers')
        const saved = res.data.data
        if (saved && saved.length > 0) setTickers(saved)
      } catch {}
      loadCachedData()
      loadTracked()
    })()
  }, [])

  const handleSearch = (query) => {
    setSearchQuery(query)
    if (searchTimeout.current) clearTimeout(searchTimeout.current)
    if (!query.trim()) { setSearchResults([]); setShowDropdown(false); return }
    searchTimeout.current = setTimeout(async () => {
      setSearchLoading(true)
      try {
        const res = await api.get(`/api/markets/search?q=${encodeURIComponent(query.trim())}`)
        setSearchResults(res.data.data || res.data || [])
        setShowDropdown(true)
      } catch { setSearchResults([]) }
      setSearchLoading(false)
    }, 300)
  }

  const addFromSearch = async (ticker) => {
    const t = ticker.toUpperCase()
    if (tickers.includes(t)) { setSearchQuery(''); setShowDropdown(false); return }
    const updated = [...tickers, t]
    setTickers(updated)
    setSearchQuery('')
    setSearchResults([])
    setShowDropdown(false)
    saveTickers(updated)
    // Fetch this single ticker on-demand (saves to cache for future nightly refreshes)
    try {
      const res = await api.post('/api/screener/fetch-single', { ticker: t })
      if (res.data.data) {
        setStocks(prev => [...prev, res.data.data])
      }
    } catch { /* will appear on next nightly refresh */ }
  }

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => { if (searchRef.current && !searchRef.current.contains(e.target)) setShowDropdown(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const removeTicker = (t) => {
    const updated = tickers.filter(x => x !== t)
    setTickers(updated)
    setStocks(prev => prev.filter(s => s.ticker !== t))
    saveTickers(updated)
  }

  const handleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('desc') }
  }

  // Filter to only the user's selected tickers
  const userStocks = useMemo(() => {
    const tickerSet = new Set(tickers)
    return stocks.filter(s => tickerSet.has(s.ticker))
  }, [stocks, tickers])

  const filteredSorted = useMemo(() => {
    let arr = [...userStocks]
    if (filterVerdict) arr = arr.filter(s => s.verdict === filterVerdict)
    if (filterMaxPE !== '') arr = arr.filter(s => s.peRatio == null || s.peRatio <= parseFloat(filterMaxPE))
    if (filterMinROE !== '') arr = arr.filter(s => s.returnOnEquity != null && s.returnOnEquity * 100 >= parseFloat(filterMinROE))
    const minCap = filterMinCap !== '' ? parseFloat(filterMinCap) * 1e9 : null
    const maxCap = filterMaxCap !== '' ? parseFloat(filterMaxCap) * 1e9 : null
    if (minCap != null) arr = arr.filter(s => s.marketCap != null && s.marketCap >= minCap)
    if (maxCap != null) arr = arr.filter(s => s.marketCap != null && s.marketCap <= maxCap)

    arr.sort((a, b) => {
      // Tracked stocks always sort to the top
      const aTracked = trackedTickers.has(a.ticker) ? 0 : 1
      const bTracked = trackedTickers.has(b.ticker) ? 0 : 1
      if (aTracked !== bTracked) return aTracked - bTracked

      const aVal = a[sortKey], bVal = b[sortKey]
      if (aVal == null && bVal == null) return 0
      if (aVal == null) return 1
      if (bVal == null) return -1
      if (typeof aVal === 'string') return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
      return sortDir === 'asc' ? aVal - bVal : bVal - aVal
    })
    return arr
  }, [userStocks, sortKey, sortDir, filterVerdict, filterMaxPE, filterMinROE, filterMinCap, filterMaxCap, trackedTickers])

  const undervalued = userStocks.filter(s => s.verdict === 'UNDERVALUED').length
  const fair = userStocks.filter(s => s.verdict === 'FAIRLY VALUED').length
  const over = userStocks.filter(s => s.verdict === 'OVERVALUED').length

  // Persist screener timestamp for sidebar live dot
  useEffect(() => {
    if (userStocks.length > 0) {
      localStorage.setItem('atlas_undervalued_count', String(undervalued))
      localStorage.setItem('atlas_screener_ts', String(Date.now()))
    }
  }, [undervalued, userStocks.length])

  return (
    <div>
      {/* Summary badges — clickable to filter */}
      {stocks.length > 0 && !loading && (
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <button
            onClick={() => setFilterVerdict(filterVerdict === 'UNDERVALUED' ? '' : 'UNDERVALUED')}
            className={`badge badge-success-strong${filterVerdict === 'UNDERVALUED' ? ' badge-active' : ''}`}
            style={{ cursor: 'pointer', background: filterVerdict === 'UNDERVALUED' ? undefined : undefined }}
          >{undervalued} Undervalued</button>
          <button
            onClick={() => setFilterVerdict(filterVerdict === 'FAIRLY VALUED' ? '' : 'FAIRLY VALUED')}
            className={`badge badge-gold-strong${filterVerdict === 'FAIRLY VALUED' ? ' badge-active' : ''}`}
            style={{ cursor: 'pointer' }}
          >{fair} Fairly Valued</button>
          <button
            onClick={() => setFilterVerdict(filterVerdict === 'OVERVALUED' ? '' : 'OVERVALUED')}
            className={`badge badge-danger-strong${filterVerdict === 'OVERVALUED' ? ' badge-active' : ''}`}
            style={{ cursor: 'pointer' }}
          >{over} Overvalued</button>
          {lastRefreshed && <span className="text-faint" style={{ fontSize: 'var(--text-sm)' }}>Last updated {new Date(lastRefreshed + 'Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} at {new Date(lastRefreshed + 'Z').toLocaleTimeString()}</span>}
        </div>
      )}
      <p className="text-faint" style={{ fontSize: 'var(--text-xs)', marginBottom: '1rem' }}>
        Buy Below is the price at which a stock is undervalued by our DCF model with a 30% margin of safety.
      </p>

      {/* Ticker management */}
      <div className="card" style={{ marginBottom: '1rem', padding: '1rem' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginBottom: '0.75rem' }}>
          {tickers.map(t => (
            <span key={t} style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.3rem', padding: '0.2rem 0.5rem',
              background: 'var(--color-surface-2)', borderRadius: 3, fontSize: 'var(--text-sm)', fontFamily: 'var(--font-mono)'
            }}>
              {t}
              <button onClick={() => removeTicker(t)} style={{
                background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)',
                fontSize: 'var(--text-sm)', lineHeight: 1, padding: 0
              }}>x</button>
            </span>
          ))}
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Search by company name */}
          <div ref={searchRef} style={{ position: 'relative', flex: '1 1 220px', maxWidth: 340 }}>
            <input
              className="input"
              style={{ width: '100%' }}
              value={searchQuery}
              onChange={e => handleSearch(e.target.value)}
              onFocus={() => { if (searchResults.length > 0) setShowDropdown(true) }}
              placeholder="Search by company or ticker..."
            />
            {showDropdown && (searchResults.length > 0 || searchLoading) && (
              <div style={{
                position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
                background: 'var(--color-surface)', border: '1px solid var(--color-border)',
                borderRadius: '0 0 4px 4px', maxHeight: 240, overflowY: 'auto',
                boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
              }}>
                {searchLoading && (
                  <div style={{ padding: '0.5rem 0.75rem', fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>Searching...</div>
                )}
                {searchResults.map((r, i) => {
                  const ticker = (r.symbol || r.ticker || '').toUpperCase()
                  const name = r.shortname || r.longname || r.name || ticker
                  const alreadyAdded = tickers.includes(ticker)
                  return (
                    <div key={i} style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '0.45rem 0.75rem', borderBottom: '1px solid var(--color-border)',
                      gap: '0.5rem',
                    }}>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <span className="mono" style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>{ticker}</span>
                        <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', marginLeft: '0.4rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
                      </div>
                      {alreadyAdded ? (
                        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>Added</span>
                      ) : (
                        <button
                          onClick={() => addFromSearch(ticker)}
                          className="btn btn-primary"
                          style={{ fontSize: 'var(--text-xs)', padding: '0.2rem 0.5rem', whiteSpace: 'nowrap' }}
                        >View</button>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
          <button className="btn btn-ghost" onClick={loadCachedData} disabled={loading} style={{ fontSize: 'var(--text-sm)' }}>
            {loading ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: 'spin 1s linear infinite' }}>
                <path d="M21 12a9 9 0 11-6.219-8.56" />
              </svg>
            ) : 'Reload'}
          </button>
          <button className="btn btn-ghost" onClick={() => { setTickers(SP100_TICKERS); saveTickers(SP100_TICKERS) }} style={{ fontSize: 'var(--text-sm)' }}>
            Reset Defaults
          </button>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'flex-end', fontSize: 'var(--text-sm)' }}>
        <div>
          <label className="text-muted" style={{ display: 'block', fontSize: 'var(--text-sm)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>Verdict</label>
          <select className="select" value={filterVerdict} onChange={e => setFilterVerdict(e.target.value)} style={{ fontSize: 'var(--text-sm)', padding: '0.35rem 0.5rem' }}>
            <option value="">All</option>
            <option value="UNDERVALUED">Undervalued</option>
            <option value="FAIRLY VALUED">Fairly Valued</option>
            <option value="OVERVALUED">Overvalued</option>
          </select>
        </div>
        <div>
          <label className="text-muted" style={{ display: 'block', fontSize: 'var(--text-sm)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>Max P/E</label>
          <input className="input" type="number" value={filterMaxPE} onChange={e => setFilterMaxPE(e.target.value)} placeholder="e.g. 30" style={{ width: 80, fontSize: 'var(--text-sm)', padding: '0.35rem 0.5rem' }} />
        </div>
        <div>
          <label className="text-muted" style={{ display: 'block', fontSize: 'var(--text-sm)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>Min ROE %</label>
          <input className="input" type="number" value={filterMinROE} onChange={e => setFilterMinROE(e.target.value)} placeholder="e.g. 15" style={{ width: 80, fontSize: 'var(--text-sm)', padding: '0.35rem 0.5rem' }} />
        </div>
        <div>
          <label className="text-muted" style={{ display: 'block', fontSize: 'var(--text-sm)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>Min Cap ($B)</label>
          <input className="input" type="number" value={filterMinCap} onChange={e => setFilterMinCap(e.target.value)} placeholder="e.g. 10" style={{ width: 80, fontSize: 'var(--text-sm)', padding: '0.35rem 0.5rem' }} />
        </div>
        <div>
          <label className="text-muted" style={{ display: 'block', fontSize: 'var(--text-sm)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>Max Cap ($B)</label>
          <input className="input" type="number" value={filterMaxCap} onChange={e => setFilterMaxCap(e.target.value)} placeholder="e.g. 3000" style={{ width: 80, fontSize: 'var(--text-sm)', padding: '0.35rem 0.5rem' }} />
        </div>
        <button className="btn btn-ghost" style={{ fontSize: 'var(--text-sm)', padding: '0.35rem 0.6rem' }}
          onClick={() => { setFilterVerdict(''); setFilterMaxPE(''); setFilterMinROE(''); setFilterMinCap(''); setFilterMaxCap('') }}>
          Clear Filters
        </button>
      </div>

      {error && <ErrorBanner message={error} onRetry={loadCachedData} />}

      {/* Table */}
      <div className="table-wrapper">
        <table style={{ fontSize: 'var(--text-sm)' }}>
          <thead>
            <tr>
              <th style={{ width: 28, padding: '0.4rem' }}></th>
              {COLUMNS.map(col => (
                <th key={col.key} style={{ whiteSpace: 'nowrap', userSelect: 'none' }}>
                  <span onClick={() => handleSort(col.key)} style={{ cursor: 'pointer' }}>
                    {col.label} {sortKey === col.key ? (sortDir === 'asc' ? '↑' : '↓') : <span style={{ opacity: 0.3 }}>↕</span>}
                  </span>
                  {LEARN_TERMS[col.key] ? <LearnTooltip term={LEARN_TERMS[col.key]} /> : col.tip ? <InfoTip text={col.tip} /> : null}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && stocks.length === 0 ? (
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={i}>
                  <td><div className="skeleton" style={{ height: 14, width: 14 }} /></td>
                  {COLUMNS.map(c => <td key={c.key}><div className="skeleton" style={{ height: 14, width: '70%' }} /></td>)}
                </tr>
              ))
            ) : filteredSorted.length === 0 ? (
              <tr>
                <td colSpan={COLUMNS.length + 1} style={{ textAlign: 'center', padding: '2rem' }}>
                  <span className="text-muted">{stocks.length === 0 ? 'No data loaded yet.' : 'No stocks match current filters.'}</span>
                </td>
              </tr>
            ) : (
              filteredSorted.map(stock => {
                const isTracked = trackedTickers.has(stock.ticker)
                return (
                <tr key={stock.ticker} onClick={() => navigate(`/markets/${stock.ticker}`)} style={{
                  cursor: 'pointer',
                  borderLeft: isTracked ? '3px solid var(--color-gold)' : '3px solid transparent',
                  background: stock.verdict === 'UNDERVALUED' ? 'color-mix(in srgb, var(--color-positive) 4%, transparent)' : stock.verdict === 'OVERVALUED' ? 'color-mix(in srgb, var(--color-negative) 4%, transparent)' : undefined
                }}>
                  <td style={{ padding: '0.4rem', textAlign: 'center' }}>
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleTracked(stock.ticker) }}
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer', padding: 0, lineHeight: 1,
                        fontSize: 'var(--text-base)', color: isTracked ? 'var(--color-gold)' : 'var(--color-text-muted)',
                        opacity: isTracked ? 1 : 0.4, transition: 'all 0.15s ease',
                      }}
                      title={isTracked ? 'Untrack stock' : 'Track stock'}
                    >{isTracked ? '\u2605' : '\u2606'}</button>
                  </td>
                  {COLUMNS.map(col => (
                    <td key={col.key} style={{ whiteSpace: 'nowrap' }}>
                      {stock.error && col.key !== 'ticker'
                        ? (col.key === 'currentPrice' ? <span style={{ color: 'var(--color-negative)', fontSize: 'var(--text-sm)' }}>{stock.error}</span> : '—')
                        : <ScreenerCell col={col.key} stock={stock} />
                      }
                    </td>
                  ))}
                </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {!loading && (
        <p className="text-faint" style={{ fontSize: 'var(--text-sm)', marginTop: '0.75rem' }}>
          Showing {filteredSorted.length} of {userStocks.length} stocks · Data refreshed nightly at 2am · Not financial advice
        </p>
      )}
    </div>
  )
}

function ScreenerCell({ col, stock }) {
  const v = stock[col]
  switch (col) {
    case 'ticker':
      return <div><strong>{stock.ticker}</strong>{stock.companyName && <div className="text-muted" style={{ fontSize: 'var(--text-sm)', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{stock.companyName}</div>}</div>
    case 'currentPrice': return <span className="mono" style={{ fontWeight: 600 }}>{formatCurrency(v)}</span>
    case 'buyBelowPrice': return <span className="mono" style={{ fontWeight: 700, color: 'var(--color-gold)' }}>{v != null ? formatCurrency(v) : 'N/A'}</span>
    case 'upside':
      if (v == null) return <span className="text-muted">N/A</span>
      return <span className="mono" style={{ color: v >= 0 ? 'var(--color-positive)' : 'var(--color-negative)' }}>{v >= 0 ? '+' : ''}{v.toFixed(1)}%</span>
    case 'verdict': return verdictBadge(v)
    case 'peRatio':
    case 'forwardPE': return <span className="mono">{v != null ? fmtNum(v) + 'x' : 'N/A'}</span>
    case 'pegRatio': return <span className="mono">{v != null ? fmtNum(v, 2) : 'N/A'}</span>
    case 'eps': return <span className="mono">{v != null ? formatCurrency(v) : 'N/A'}</span>
    case 'marketCap':
    case 'revenue':
    case 'freeCashFlow': return <span className="mono">{fmtLarge(v)}</span>
    case 'profitMargin':
    case 'returnOnEquity':
    case 'dividendYield': return <span className="mono">{fmtPct(v)}</span>
    case 'debtToEquity': return <span className="mono">{v != null ? fmtNum(v, 2) : 'N/A'}</span>
    case 'analystRating': return ratingBadge(v)
    default: return <span>{v != null ? v : 'N/A'}</span>
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 3: ANALYZER
// ═══════════════════════════════════════════════════════════════════════════════

function AnalyzerTab() {
  const [ticker, setTicker] = useState('')
  const [inputVal, setInputVal] = useState('')
  const [discountRate, setDiscountRate] = useState(0.10)

  const [ivData, setIvData] = useState(null)
  const [quoteData, setQuoteData] = useState(null)
  const [ratingsData, setRatingsData] = useState(null)

  const [loadingIV, setLoadingIV] = useState(false)
  const [loadingQuote, setLoadingQuote] = useState(false)
  const [loadingRatings, setLoadingRatings] = useState(false)

  const [errorIV, setErrorIV] = useState(null)
  const [errorQuote, setErrorQuote] = useState(null)
  const [errorRatings, setErrorRatings] = useState(null)

  const fetchAll = useCallback(async (sym, dr) => {
    const t = sym.toUpperCase().trim()
    if (!t) return

    setLoadingIV(true); setLoadingQuote(true); setLoadingRatings(true)
    setErrorIV(null); setErrorQuote(null); setErrorRatings(null)
    setIvData(null); setQuoteData(null); setRatingsData(null)

    const [ivRes, quoteRes, ratingsRes] = await Promise.allSettled([
      api.get(`/api/intrinsic/${t}?discountRate=${dr}`),
      api.get(`/api/quote/${t}`),
      api.get(`/api/ratings/${t}`),
    ])

    if (ivRes.status === 'fulfilled') setIvData(ivRes.value.data.data || ivRes.value.data)
    else setErrorIV(ivRes.reason?.response?.data?.error || ivRes.reason?.message || 'Failed')

    if (quoteRes.status === 'fulfilled') setQuoteData(quoteRes.value.data.data || quoteRes.value.data)
    else setErrorQuote(quoteRes.reason?.response?.data?.error || quoteRes.reason?.message || 'Failed')

    if (ratingsRes.status === 'fulfilled') setRatingsData(ratingsRes.value.data.data || ratingsRes.value.data)
    else setErrorRatings(ratingsRes.reason?.response?.data?.error || ratingsRes.reason?.message || 'Failed')

    setLoadingIV(false); setLoadingQuote(false); setLoadingRatings(false)
  }, [])

  const handleSearch = (e) => {
    e?.preventDefault()
    const sym = inputVal.trim().toUpperCase()
    if (!sym) return
    setTicker(sym)
    fetchAll(sym, discountRate)
  }

  const handleDiscountChange = (newRate) => {
    setDiscountRate(newRate)
    if (ticker) fetchAll(ticker, newRate)
  }

  const hasData = ivData || quoteData

  return (
    <div>
      <p className="text-muted" style={{ fontSize: 'var(--text-base)', marginBottom: '1rem' }}>
        Enter a ticker to calculate intrinsic value using Owner Earnings & DCF methods.
      </p>

      {/* Search */}
      <form onSubmit={handleSearch} style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', alignItems: 'center' }}>
        <input
          className="input"
          style={{ maxWidth: 240 }}
          value={inputVal}
          onChange={e => setInputVal(e.target.value.toUpperCase())}
          placeholder="Enter ticker (e.g. AAPL)"
        />
        <button type="submit" className="btn btn-primary" style={{ fontSize: 'var(--text-base)' }}>Analyze</button>
        {ticker && (
          <button type="button" className="btn btn-ghost" style={{ fontSize: 'var(--text-base)' }}
            onClick={() => fetchAll(ticker, discountRate)}>Refresh</button>
        )}
      </form>

      {/* Discount Rate */}
      <div className="card" style={{ marginBottom: '1.25rem', padding: '1rem' }}>
        <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, marginBottom: '0.5rem' }}>Valuation Settings</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span className="text-muted" style={{ fontSize: 'var(--text-sm)' }}>Discount Rate</span>
          <input
            type="range" min={0.08} max={0.15} step={0.005}
            value={discountRate}
            onChange={e => handleDiscountChange(parseFloat(e.target.value))}
            style={{ flex: 1, maxWidth: 300 }}
          />
          <span className="mono" style={{ fontSize: 'var(--text-base)' }}>{(discountRate * 100).toFixed(1)}%</span>
        </div>
        <p className="text-faint" style={{ fontSize: 'var(--text-sm)', marginTop: '0.35rem' }}>
          Adjust discount rate (8–15%). Higher = more conservative. {ticker && 'Changes auto-recalculate.'}
        </p>
      </div>

      {/* Company header */}
      {(hasData || loadingIV) && ticker && (
        <div style={{ marginBottom: '1rem' }}>
          {quoteData ? (
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem', flexWrap: 'wrap' }}>
              <h2 style={{ fontSize: 'var(--text-2xl)' }}>{quoteData.companyName || ticker}</h2>
              <span className="text-muted">{ticker}</span>
              <span className="mono" style={{ fontSize: 'var(--text-xl)', fontWeight: 700, color: 'var(--color-gold)' }}>
                {formatCurrency(quoteData.currentPrice)}
              </span>
              {quoteData.exchange && <span className="badge badge-neutral">{quoteData.exchange}</span>}
            </div>
          ) : (
            <div className="skeleton" style={{ height: 28, width: 300 }} />
          )}
        </div>
      )}

      {/* IV Summary */}
      {errorIV && !loadingIV && !ivData && <ErrorBanner message={`Intrinsic Value: ${errorIV}`} onRetry={() => fetchAll(ticker, discountRate)} />}
      {(loadingIV || ivData) && <IVSummarySection data={ivData} loading={loadingIV} />}

      {/* Key Metrics */}
      {errorQuote && !loadingQuote && <p style={{ color: 'var(--color-negative)', fontSize: 'var(--text-sm)', marginBottom: '0.75rem' }}>Quote error: {errorQuote}</p>}
      {(loadingQuote || quoteData) && <QuoteMetricsSection data={quoteData} loading={loadingQuote} />}

      {/* DCF Projections */}
      {ivData?.dcf?.projectedFCFs?.length > 0 && !ivData.dcf.error && (
        <DCFBarChart projectedFCFs={ivData.dcf.projectedFCFs} freeCashFlow={ivData.rawInputs?.freeCashFlow} />
      )}

      {/* Raw Inputs */}
      {ivData && <RawInputsSection data={ivData} />}

      {/* Analyst Ratings */}
      {ticker && (loadingRatings || ratingsData || errorRatings) && (
        <AnalystRatingsSection data={ratingsData} loading={loadingRatings} error={errorRatings} />
      )}

      {/* Empty state */}
      {!ticker && (
        <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
          <p style={{ fontSize: 'var(--text-3xl)', marginBottom: '0.5rem' }}>Enter a ticker to get started</p>
          <p className="text-muted" style={{ fontSize: 'var(--text-base)', maxWidth: 400, margin: '0 auto' }}>
            Search for any stock ticker to calculate its intrinsic value using Warren Buffett's Owner Earnings model and DCF analysis with a 30% margin of safety.
          </p>
        </div>
      )}
    </div>
  )
}

// ─── IV Summary Section ─────────────────────────────────────────────────────

function IVSummarySection({ data, loading }) {
  if (loading) return (
    <div className="card" style={{ marginBottom: '1.25rem', padding: '1.25rem' }}>
      <div className="skeleton" style={{ height: 80, marginBottom: 12 }} />
      <div className="grid-3">
        {[1,2,3,4,5].map(i => <div key={i} className="skeleton" style={{ height: 50 }} />)}
      </div>
    </div>
  )
  if (!data) return null

  const { summary, ownerEarnings, dcf, currentPrice } = data
  const upside = summary.mosPrice && currentPrice > 0
    ? ((summary.mosPrice - currentPrice) / currentPrice * 100)
    : null

  return (
    <div style={{ marginBottom: '1.25rem' }}>
      {/* Buy Below banner */}
      <div className="card" style={{ padding: '1.25rem', background: 'var(--color-surface-2)', marginBottom: '0.75rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div className="text-muted" style={{ fontSize: 'var(--text-sm)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>
              Buy Below (30% Margin of Safety)
            </div>
            <div className="mono" style={{ fontSize: 'var(--text-2xl)', fontWeight: 700, color: 'var(--color-gold)' }}>
              {summary.mosPrice != null ? formatCurrency(summary.mosPrice) : 'N/A'}
            </div>
            <div className="text-muted" style={{ fontSize: 'var(--text-sm)' }}>
              Raw IV: {summary.rawIV != null ? formatCurrency(summary.rawIV) : 'N/A'} · Current: {formatCurrency(currentPrice)}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            {verdictBadge(summary.verdict)}
            {upside != null && (
              <div className="mono" style={{ fontSize: 'var(--text-sm)', marginTop: '0.5rem', color: upside >= 0 ? 'var(--color-positive)' : 'var(--color-negative)' }}>
                {upside >= 0
                  ? `${upside.toFixed(1)}% upside to buy price`
                  : `${Math.abs(upside).toFixed(1)}% above buy price`
                }
              </div>
            )}
          </div>
        </div>
      </div>

      {/* IV breakdown */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '0.5rem' }}>
        {[
          { label: 'Owner Earnings IV', value: ownerEarnings?.error ? ownerEarnings.error : ownerEarnings?.iv != null ? formatCurrency(ownerEarnings.iv) : 'N/A', isError: !!ownerEarnings?.error },
          { label: 'DCF IV', value: dcf?.error ? dcf.error : dcf?.iv != null ? formatCurrency(dcf.iv) : 'N/A', isError: !!dcf?.error },
          { label: 'Raw IV (avg)', value: summary.rawIV != null ? formatCurrency(summary.rawIV) : 'N/A' },
          { label: 'Buy Below (MoS)', value: summary.mosPrice != null ? formatCurrency(summary.mosPrice) : 'N/A', accent: true },
          { label: 'Current Price', value: formatCurrency(currentPrice) },
        ].map(m => (
          <div key={m.label} className="card" style={{ padding: '0.75rem' }}>
            <div className="text-muted" style={{ fontSize: 'var(--text-sm)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>{m.label}</div>
            <div className="mono" style={{
              fontSize: m.isError ? 'var(--text-sm)' : 'var(--text-lg)', fontWeight: 600,
              color: m.isError ? 'var(--color-gold)' : m.accent ? 'var(--color-gold)' : 'var(--color-text-primary)'
            }}>{m.value}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Quote Metrics Section ──────────────────────────────────────────────────

function QuoteMetricsSection({ data, loading }) {
  if (loading) return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '0.5rem', marginBottom: '1.25rem' }}>
      {[1,2,3,4,5,6].map(i => <div key={i} className="skeleton" style={{ height: 50 }} />)}
    </div>
  )
  if (!data) return null

  const metrics = [
    { label: 'Market Cap', value: fmtLarge(data.marketCap) },
    { label: 'P/E Ratio', value: data.peRatio != null ? fmtNum(data.peRatio) + 'x' : 'N/A' },
    { label: 'Forward P/E', value: data.forwardPE != null ? fmtNum(data.forwardPE) + 'x' : 'N/A' },
    { label: 'PEG Ratio', value: data.pegRatio != null ? fmtNum(data.pegRatio, 2) : 'N/A' },
    { label: 'EPS (TTM)', value: data.eps != null ? formatCurrency(data.eps) : 'N/A' },
    { label: 'Book Value/Share', value: data.bookValuePerShare != null ? formatCurrency(data.bookValuePerShare) : 'N/A' },
    { label: 'Dividend Yield', value: fmtPct(data.dividendYield) },
    { label: 'Revenue (TTM)', value: fmtLarge(data.revenue) },
    { label: 'Profit Margin', value: fmtPct(data.profitMargin) },
    { label: 'Debt/Equity', value: data.debtToEquity != null ? fmtNum(data.debtToEquity, 2) : 'N/A' },
    { label: 'ROE', value: fmtPct(data.returnOnEquity) },
    { label: '52W High', value: data.fiftyTwoWeekHigh != null ? formatCurrency(data.fiftyTwoWeekHigh) : 'N/A' },
    { label: '52W Low', value: data.fiftyTwoWeekLow != null ? formatCurrency(data.fiftyTwoWeekLow) : 'N/A' },
    { label: 'Free Cash Flow', value: fmtLarge(data.freeCashFlow) },
  ]

  return (
    <div style={{ marginBottom: '1.25rem' }}>
      <h3 style={{ fontSize: 'var(--text-lg)', marginBottom: '0.75rem' }}>Key Metrics</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '0.5rem' }}>
        {metrics.map(m => (
          <div key={m.label} className="card" style={{ padding: '0.75rem' }}>
            <div className="text-muted" style={{ fontSize: 'var(--text-sm)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>{m.label}</div>
            <div className="mono" style={{ fontSize: 'var(--text-lg)', fontWeight: 600 }}>{m.value}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── DCF Bar Chart (CSS-only, no recharts) ──────────────────────────────────

function DCFBarChart({ projectedFCFs, freeCashFlow }) {
  if (!projectedFCFs || projectedFCFs.length === 0) return null

  const allValues = [freeCashFlow, ...projectedFCFs.map(d => d.fcf), ...projectedFCFs.map(d => d.discountedFCF)].filter(Boolean)
  const maxVal = Math.max(...allValues.map(Math.abs))

  return (
    <div className="card" style={{ marginBottom: '1.25rem', padding: '1.25rem' }}>
      <h3 style={{ fontSize: 'var(--text-lg)', marginBottom: '0.25rem' }}>10-Year DCF Projection</h3>
      <p className="text-muted" style={{ fontSize: 'var(--text-sm)', marginBottom: '1rem' }}>Projected vs. discounted free cash flows</p>
      <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'flex-end', height: 160 }}>
        {/* Base year */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
          <div className="mono" style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)' }}>{fmtLarge(freeCashFlow)}</div>
          <div style={{ width: '80%', background: 'var(--color-gold)', borderRadius: '3px 3px 0 0', height: `${Math.max(4, (Math.abs(freeCashFlow) / maxVal) * 140)}px` }} />
          <div className="mono" style={{ fontSize: 'var(--text-xs)' }}>Now</div>
        </div>
        {projectedFCFs.map(d => (
          <div key={d.year} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
            <div className="mono" style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>{fmtLarge(d.fcf)}</div>
            <div style={{ display: 'flex', gap: 1, width: '80%', justifyContent: 'center', alignItems: 'flex-end', height: `${Math.max(4, (Math.abs(d.fcf) / maxVal) * 140)}px` }}>
              <div style={{ width: '45%', background: 'var(--color-gold)', opacity: 0.7, borderRadius: '2px 2px 0 0', height: '100%' }} />
              <div style={{ width: '45%', background: 'var(--color-positive)', opacity: 0.7, borderRadius: '2px 2px 0 0', height: `${Math.max(4, (Math.abs(d.discountedFCF) / Math.abs(d.fcf)) * 100)}%` }} />
            </div>
            <div className="mono" style={{ fontSize: 'var(--text-xs)' }}>Y{d.year}</div>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: '1rem', marginTop: '0.75rem', justifyContent: 'center' }}>
        <span style={{ fontSize: 'var(--text-sm)', display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 10, height: 10, background: 'var(--color-gold)', opacity: 0.7, borderRadius: 2, display: 'inline-block' }} /> Projected FCF
        </span>
        <span style={{ fontSize: 'var(--text-sm)', display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 10, height: 10, background: 'var(--color-positive)', opacity: 0.7, borderRadius: 2, display: 'inline-block' }} /> Discounted FCF
        </span>
      </div>
    </div>
  )
}

// ─── Raw Inputs Section ─────────────────────────────────────────────────────

function RawInputsSection({ data }) {
  const { rawInputs, ownerEarnings, summary } = data
  if (!rawInputs) return null

  const rows = [
    ['Net Income (TTM)', fmtLarge(rawInputs.netIncome)],
    ['Depreciation & Amortization', fmtLarge(rawInputs.da)],
    ['Capital Expenditures', fmtLarge(rawInputs.capex)],
    ['Owner Earnings', fmtLarge(ownerEarnings?.ownerEarnings)],
    ['Free Cash Flow (TTM)', fmtLarge(rawInputs.freeCashFlow)],
    ['Shares Outstanding', rawInputs.sharesOutstanding ? (rawInputs.sharesOutstanding / 1e6).toFixed(0) + 'M' : 'N/A'],
    ['5Y EPS Growth Est. (raw)', rawInputs.growthRateRaw != null ? (rawInputs.growthRateRaw * 100).toFixed(2) + '%' : 'N/A'],
    ['Growth Rate Used (capped 15%)', summary?.growthRate != null ? (summary.growthRate * 100).toFixed(2) + '%' : 'N/A'],
    ['Discount Rate', (rawInputs.discountRate * 100).toFixed(1) + '%'],
    ['EPS (TTM)', rawInputs.eps != null ? formatCurrency(rawInputs.eps) : 'N/A'],
    ['P/E Ratio (TTM)', rawInputs.peRatio != null ? fmtNum(rawInputs.peRatio) + 'x' : 'N/A'],
    ['Book Value/Share', rawInputs.bookValuePerShare != null ? formatCurrency(rawInputs.bookValuePerShare) : 'N/A'],
  ]

  return (
    <div className="card" style={{ marginBottom: '1.25rem', padding: '1.25rem' }}>
      <h3 style={{ fontSize: 'var(--text-lg)', marginBottom: '0.75rem' }}>Raw Inputs & Data Sources</h3>
      <div className="table-wrapper">
        <table style={{ fontSize: 'var(--text-sm)' }}>
          <thead>
            <tr>
              <th>Metric</th>
              <th>Value</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([label, val]) => (
              <tr key={label}>
                <td>{label}</td>
                <td className="mono">{val}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Analyst Ratings Section ────────────────────────────────────────────────

function AnalystRatingsSection({ data, loading, error }) {
  if (loading) return (
    <div className="card" style={{ marginBottom: '1.25rem', padding: '1.25rem' }}>
      <h3 style={{ fontSize: 'var(--text-lg)', marginBottom: '0.75rem' }}>Analyst Consensus</h3>
      <div className="skeleton" style={{ height: 20, width: '50%', marginBottom: 8 }} />
      <div className="skeleton" style={{ height: 8, marginBottom: 12 }} />
      <div className="skeleton" style={{ height: 60 }} />
    </div>
  )

  if (error || !data) return (
    <div className="card" style={{ marginBottom: '1.25rem', padding: '1.25rem' }}>
      <h3 style={{ fontSize: 'var(--text-lg)', marginBottom: '0.5rem' }}>Analyst Consensus</h3>
      <p className="text-muted" style={{ fontSize: 'var(--text-base)' }}>{error || 'No analyst data available.'}</p>
    </div>
  )

  const { consensusLabel, consensusScore, trend, priceTargets, numberOfAnalystOpinions } = data

  function ratingColor(label) {
    if (!label) return 'var(--color-text-secondary)'
    const l = label.toLowerCase()
    if (l.includes('buy')) return 'var(--color-positive)'
    if (l.includes('sell')) return 'var(--color-negative)'
    return 'var(--color-gold)'
  }

  const bars = trend ? [
    { label: 'Strong Buy', count: trend.strongBuy, color: '#2D5A30' },
    { label: 'Buy', count: trend.buy, color: '#355E3B' },
    { label: 'Hold', count: trend.hold, color: '#8B7040' },
    { label: 'Sell', count: trend.sell, color: '#8B3A3A' },
    { label: 'Strong Sell', count: trend.strongSell, color: '#6B2A2A' },
  ] : []
  const maxCount = Math.max(...bars.map(b => b.count), 1)

  // Consensus meter
  const meterPct = consensusScore != null ? ((consensusScore - 1) / 4) * 100 : 50

  return (
    <div className="card" style={{ marginBottom: '1.25rem', padding: '1.25rem' }}>
      <h3 style={{ fontSize: 'var(--text-lg)', marginBottom: '0.75rem' }}>Analyst Consensus</h3>

      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.75rem' }}>
        <span style={{ fontSize: 'var(--text-xl)', fontWeight: 700, color: ratingColor(consensusLabel) }}>
          {consensusLabel}
        </span>
        <span className="text-muted" style={{ fontSize: 'var(--text-sm)' }}>
          {numberOfAnalystOpinions != null ? `${numberOfAnalystOpinions} analysts` : trend ? `${trend.totalAnalysts} analysts` : ''}
        </span>
        {consensusScore != null && (
          <span className="text-faint" style={{ fontSize: 'var(--text-sm)' }}>Score: {consensusScore.toFixed(2)} / 5</span>
        )}
      </div>

      {/* Consensus meter */}
      <div style={{ position: 'relative', marginBottom: '1.25rem' }}>
        <div style={{ height: 6, borderRadius: 3, background: 'linear-gradient(to right, var(--color-negative), var(--color-gold), var(--color-positive))' }} />
        <div style={{
          position: 'absolute', top: -3, width: 12, height: 12, borderRadius: '50%',
          background: 'var(--color-surface)', border: '2px solid var(--color-gold)',
          left: `${Math.max(2, Math.min(98, meterPct))}%`, transform: 'translateX(-50%)'
        }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.35rem' }}>
          {['Strong Sell', 'Sell', 'Hold', 'Buy', 'Strong Buy'].map(l => (
            <span key={l} className="text-faint" style={{ fontSize: 'var(--text-xs)' }}>{l}</span>
          ))}
        </div>
      </div>

      {/* Breakdown bars */}
      {bars.length > 0 && (
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end', height: 80, marginBottom: '1rem' }}>
          {bars.map(b => (
            <div key={b.label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
              <span className="mono" style={{ fontSize: 'var(--text-sm)' }}>{b.count}</span>
              <div style={{
                width: '60%', borderRadius: '3px 3px 0 0', background: b.color, opacity: 0.8,
                height: `${Math.max(4, (b.count / maxCount) * 60)}px`
              }} />
              <span className="text-faint" style={{ fontSize: 'var(--text-xs)', textAlign: 'center', lineHeight: 1.1 }}>{b.label}</span>
            </div>
          ))}
        </div>
      )}

      {/* Price targets */}
      {priceTargets && (
        <div>
          <h4 style={{ fontSize: 'var(--text-base)', marginBottom: '0.5rem', marginTop: '0.5rem' }}>Price Targets</h4>
          <div className="grid-3">
            {[
              { label: 'Low', value: priceTargets.low, color: 'var(--color-negative)' },
              { label: 'Mean', value: priceTargets.mean, color: 'var(--color-gold)' },
              { label: 'High', value: priceTargets.high, color: 'var(--color-positive)' },
            ].map(t => (
              <div key={t.label} style={{ textAlign: 'center' }}>
                <div className="text-muted" style={{ fontSize: 'var(--text-sm)', textTransform: 'uppercase' }}>{t.label}</div>
                <div className="mono" style={{ fontSize: 'var(--text-lg)', fontWeight: 600, color: t.color }}>
                  {t.value != null ? formatCurrency(t.value) : 'N/A'}
                </div>
              </div>
            ))}
          </div>
          {priceTargets.current && priceTargets.mean && (
            <p className="text-muted" style={{ fontSize: 'var(--text-sm)', marginTop: '0.5rem', textAlign: 'center' }}>
              Upside to mean target:{' '}
              <span className="mono" style={{ color: priceTargets.mean > priceTargets.current ? 'var(--color-positive)' : 'var(--color-negative)', fontWeight: 600 }}>
                {(((priceTargets.mean - priceTargets.current) / priceTargets.current) * 100).toFixed(1)}%
              </span>
            </p>
          )}
        </div>
      )}
    </div>
  )
}
