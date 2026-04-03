import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api } from '../hooks/useApi'
import { formatCurrency } from '../components/NumberDisplay'
import LoadingSpinner from '../components/LoadingSpinner'
import ErrorBanner from '../components/ErrorBanner'

function fmtLarge(n) {
  if (n == null) return 'N/A'
  if (Math.abs(n) >= 1e12) return (n / 1e12).toFixed(1) + 'T'
  if (Math.abs(n) >= 1e9) return (n / 1e9).toFixed(1) + 'B'
  if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(1) + 'M'
  return n.toFixed(0)
}

function verdictBadge(v) {
  if (!v || v === 'N/A') return <span className="badge badge-neutral">N/A</span>
  if (v === 'UNDERVALUED') return <span className="verdict-badge verdict-undervalued">{v}</span>
  if (v === 'FAIRLY VALUED') return <span className="verdict-badge verdict-fairly">{v}</span>
  return <span className="verdict-badge verdict-overvalued">{v}</span>
}

export default function StockDetail() {
  const { ticker } = useParams()
  const navigate = useNavigate()
  const [quote, setQuote] = useState(null)
  const [iv, setIv] = useState(null)
  const [verdict, setVerdict] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [addingWatchlist, setAddingWatchlist] = useState(false)
  const [addingPortfolio, setAddingPortfolio] = useState(false)
  const [portfolioForm, setPortfolioForm] = useState({ shares: '', avgCost: '' })
  const [showPortfolioForm, setShowPortfolioForm] = useState(false)

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      setError(null)
      try {
        const [quoteRes, ivRes] = await Promise.allSettled([
          api.get(`/api/quote/${ticker}`),
          api.get(`/api/intrinsic/${ticker}`),
        ])

        if (quoteRes.status === 'fulfilled') {
          setQuote(quoteRes.value.data.data || quoteRes.value.data)
        }
        if (ivRes.status === 'fulfilled') {
          setIv(ivRes.value.data.data || ivRes.value.data)
        }

        // Fetch AI verdict explanation
        try {
          const explainRes = await api.get(`/api/markets/explain/${ticker}`)
          setVerdict(explainRes.data.data?.explanation || null)
        } catch {}
      } catch (err) {
        setError(err.message)
      }
      setLoading(false)
    }
    fetchData()
  }, [ticker])

  const addToWatchlist = async () => {
    setAddingWatchlist(true)
    try {
      await api.post('/api/watchlist', { ticker: ticker.toUpperCase() })
    } catch {}
    setAddingWatchlist(false)
  }

  const addToPortfolio = async () => {
    if (!portfolioForm.shares || !portfolioForm.avgCost) return
    setAddingPortfolio(true)
    try {
      await api.post('/api/portfolio/position', {
        ticker: ticker.toUpperCase(),
        shares: parseFloat(portfolioForm.shares),
        avg_cost: parseFloat(portfolioForm.avgCost),
      })
      setShowPortfolioForm(false)
      setPortfolioForm({ shares: '', avgCost: '' })
    } catch {}
    setAddingPortfolio(false)
  }

  if (loading) return <LoadingSpinner height={300} />
  if (error) return <ErrorBanner message={error} />

  const summary = iv?.summary
  const currentPrice = quote?.currentPrice || iv?.currentPrice || 0

  return (
    <div>
      <button onClick={() => navigate('/markets')} style={{
        background: 'none', border: 'none', cursor: 'pointer',
        color: 'var(--color-gold)', fontSize: 'var(--text-sm)',
        marginBottom: 'var(--space-md)', padding: 0,
      }}>
        ← Back to Markets
      </button>

      {/* Header */}
      <div style={{ marginBottom: 'var(--space-lg)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)', flexWrap: 'wrap' }}>
          <h1 style={{ fontSize: 'var(--text-3xl)' }}>
            {quote?.companyName || ticker}
          </h1>
          <span className="mono" style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>{ticker}</span>
          {summary && verdictBadge(summary.verdict)}
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--space-sm)', marginTop: 'var(--space-xs)' }}>
          <span className="mono" style={{ fontSize: 'var(--text-2xl)', fontWeight: 600, color: 'var(--color-text-primary)' }}>
            {formatCurrency(currentPrice)}
          </span>
          {quote?.sector && (
            <span style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>
              {quote.sector}{quote.industry ? ` · ${quote.industry}` : ''}
            </span>
          )}
        </div>
      </div>

      {/* AI Verdict */}
      {verdict && (
        <div className="card" style={{ marginBottom: 'var(--space-lg)', borderLeft: '3px solid var(--color-gold)' }}>
          <span className="label-caps" style={{ marginBottom: 'var(--space-xs)', display: 'block' }}>AI Verdict</span>
          <p style={{ fontSize: 'var(--text-base)', lineHeight: 1.6, color: 'var(--color-text-primary)' }}>{verdict}</p>
        </div>
      )}

      {/* DCF Breakdown */}
      {iv && (
        <div className="card" style={{ marginBottom: 'var(--space-lg)' }}>
          <h2 style={{ fontSize: 'var(--text-xl)', marginBottom: 'var(--space-md)' }}>Valuation Breakdown</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 'var(--space-md)' }}>
            {[
              ['Intrinsic Value', summary?.rawIV != null ? formatCurrency(summary.rawIV) : 'N/A'],
              ['Buy Below (30% MoS)', summary?.mosPrice != null ? formatCurrency(summary.mosPrice) : 'N/A'],
              ['Current Price', formatCurrency(currentPrice)],
              ['Free Cash Flow', iv.rawInputs?.freeCashFlow ? fmtLarge(iv.rawInputs.freeCashFlow) : 'N/A'],
              ['Growth Rate', iv.dcf?.growthRate != null ? (iv.dcf.growthRate * 100).toFixed(1) + '%' : 'N/A'],
              ['Discount Rate', iv.dcf?.discountRate != null ? (iv.dcf.discountRate * 100).toFixed(1) + '%' : 'N/A'],
              ['Terminal Value', iv.dcf?.terminalValue ? fmtLarge(iv.dcf.terminalValue) : 'N/A'],
              ['Upside', summary?.mosPrice && currentPrice > 0
                ? ((summary.mosPrice - currentPrice) / currentPrice * 100).toFixed(1) + '%'
                : 'N/A'],
            ].map(([label, val]) => (
              <div key={label} style={{ padding: 'var(--space-sm)', borderBottom: '1px solid var(--color-border)' }}>
                <span className="label-caps" style={{ display: 'block', marginBottom: 2 }}>{label}</span>
                <span className="mono" style={{ fontSize: 'var(--text-lg)', color: 'var(--color-text-primary)' }}>{val}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Key Stats */}
      {quote && (
        <div className="card" style={{ marginBottom: 'var(--space-lg)' }}>
          <h2 style={{ fontSize: 'var(--text-xl)', marginBottom: 'var(--space-md)' }}>Key Statistics</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-xs)' }}>
            {[
              ['P/E Ratio', quote.peRatio != null ? quote.peRatio.toFixed(1) + 'x' : '--'],
              ['Forward P/E', quote.forwardPE != null ? quote.forwardPE.toFixed(1) + 'x' : '--'],
              ['PEG Ratio', quote.pegRatio != null ? quote.pegRatio.toFixed(2) : '--'],
              ['EPS', quote.eps != null ? formatCurrency(quote.eps) : '--'],
              ['Revenue', quote.revenue ? fmtLarge(quote.revenue) : '--'],
              ['Market Cap', quote.marketCap ? fmtLarge(quote.marketCap) : '--'],
              ['Profit Margin', quote.profitMargin != null ? (quote.profitMargin * 100).toFixed(1) + '%' : '--'],
              ['Debt/Equity', quote.debtToEquity != null ? quote.debtToEquity.toFixed(2) : '--'],
              ['ROE', quote.returnOnEquity != null ? (quote.returnOnEquity * 100).toFixed(1) + '%' : '--'],
              ['Dividend Yield', quote.dividendYield != null ? (quote.dividendYield * 100).toFixed(2) + '%' : '--'],
            ].map(([label, val]) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0', borderBottom: '1px solid var(--color-border)' }}>
                <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>{label}</span>
                <span className="mono" style={{ fontSize: 'var(--text-sm)' }}>{val}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div style={{ display: 'flex', gap: 'var(--space-sm)', flexWrap: 'wrap' }}>
        <button className="btn btn-primary" onClick={addToWatchlist} disabled={addingWatchlist}>
          {addingWatchlist ? 'Adding...' : 'Add to Watchlist'}
        </button>
        <button className="btn btn-ghost" onClick={() => setShowPortfolioForm(!showPortfolioForm)}>
          {showPortfolioForm ? 'Cancel' : 'Add to Portfolio'}
        </button>
      </div>

      {showPortfolioForm && (
        <div className="card" style={{ marginTop: 'var(--space-md)', maxWidth: 400 }}>
          <div style={{ display: 'flex', gap: 'var(--space-sm)', flexWrap: 'wrap' }}>
            <input
              className="input"
              type="number"
              placeholder="Shares"
              value={portfolioForm.shares}
              onChange={e => setPortfolioForm(p => ({ ...p, shares: e.target.value }))}
              style={{ flex: 1, minWidth: 80 }}
            />
            <input
              className="input"
              type="number"
              step="0.01"
              placeholder="Avg cost"
              value={portfolioForm.avgCost}
              onChange={e => setPortfolioForm(p => ({ ...p, avgCost: e.target.value }))}
              style={{ flex: 1, minWidth: 80 }}
            />
            <button className="btn btn-primary" onClick={addToPortfolio} disabled={addingPortfolio}>
              {addingPortfolio ? 'Adding...' : 'Add'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
