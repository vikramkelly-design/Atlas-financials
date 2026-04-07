import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { api } from '../hooks/useApi'
import { formatCurrency, numColor } from '../components/NumberDisplay'
import LoadingSpinner from '../components/LoadingSpinner'
import ErrorBanner from '../components/ErrorBanner'
import PageChat from '../components/PageChat'

const PIE_COLORS = ['#8B6914', '#3B6B3B', '#5A7D9A', '#8B3A2A', '#6B5B3B', '#4A6B4A', '#7A5C10', '#2D5A5A', '#8B7040', '#6B2A6B']
const PERIODS = [
  { key: '1d', label: '1D' },
  { key: '1w', label: '1W' },
  { key: '1m', label: '1M' },
  { key: '1y', label: '1Y' },
]

export default function Analytics() {
  const [portfolios, setPortfolios] = useState([])
  const [activeId, setActiveId] = useState(null)
  const [positions, setPositions] = useState([])
  const [prices, setPrices] = useState({})
  const [history, setHistory] = useState({ portfolio: [], sp500: [] })
  const [period, setPeriod] = useState('1m')
  const [loading, setLoading] = useState(true)
  const [histLoading, setHistLoading] = useState(false)
  const [error, setError] = useState(null)
  const [tab, setTab] = useState('analytics')

  useEffect(() => {
    (async () => {
      try {
        const pRes = await api.get('/api/portfolio')
        setPortfolios(pRes.data.data)
        if (pRes.data.data.length > 0) setActiveId(pRes.data.data[0].id)
      } catch (err) { setError(err.message) }
      setLoading(false)
    })()
  }, [])

  useEffect(() => {
    if (!activeId) return
    let tickers = []
    ;(async () => {
      try {
        const res = await api.get(`/api/portfolio/${activeId}/positions`)
        setPositions(res.data.data)
        tickers = [...new Set(res.data.data.map(p => p.ticker))]
        if (tickers.length > 0) {
          const pRes = await api.get(`/api/markets/prices?tickers=${tickers.join(',')}`)
          setPrices(pRes.data.data)
        }
      } catch {}
    })()
    // Auto-refresh prices every 60s
    const interval = setInterval(async () => {
      if (tickers.length > 0) {
        try {
          const pRes = await api.get(`/api/markets/prices?tickers=${tickers.join(',')}`)
          setPrices(pRes.data.data)
        } catch {}
      }
    }, 60000)
    return () => clearInterval(interval)
  }, [activeId])

  useEffect(() => {
    if (!activeId) return
    setHistLoading(true)
    ;(async () => {
      try {
        const res = await api.get(`/api/portfolio/${activeId}/history?period=${period}`)
        setHistory(res.data.data)
      } catch { setHistory({ portfolio: [], sp500: [] }) }
      setHistLoading(false)
    })()
  }, [activeId, period])

  const enriched = useMemo(() => {
    return positions.map(pos => {
      const quote = prices[pos.ticker] || {}
      const currentPrice = quote.price || null
      const costBasis = pos.shares * pos.avg_cost
      const currentValue = currentPrice != null ? pos.shares * currentPrice : null
      const gain = currentValue != null ? currentValue - costBasis : null
      const gainPct = gain != null && costBasis > 0 ? (gain / costBasis) * 100 : null
      return { ...pos, currentPrice, name: quote.name, currentValue, costBasis, gain, gainPct }
    })
  }, [positions, prices])

  const totalValue = useMemo(() => enriched.reduce((s, p) => s + (p.currentValue ?? 0), 0), [enriched])

  if (loading) return <LoadingSpinner height={200} />
  if (error) return <ErrorBanner message={error} />

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h1 style={{ fontSize: 'var(--text-3xl)' }}>Analytics</h1>
      </div>

      <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '1.5rem', borderBottom: '2px solid var(--color-border)' }}>
        {[
          { key: 'analytics', label: 'Analytics' },
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

      {tab === 'chat' && <PageChat context="analytics" />}

      {tab === 'analytics' && <>
      {portfolios.length > 1 && (
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
          {portfolios.map(p => (
            <div key={p.id} onClick={() => setActiveId(p.id)} style={{
              padding: '0.4rem 0.75rem', borderRadius: 4, cursor: 'pointer', fontSize: 'var(--text-base)',
              background: p.id === activeId ? 'var(--color-navy)' : 'var(--color-surface)',
              color: p.id === activeId ? 'var(--color-gold)' : 'var(--color-text-primary)',
              border: '1px solid ' + (p.id === activeId ? 'var(--color-navy)' : 'var(--color-border)'),
            }}>
              {p.name}
            </div>
          ))}
        </div>
      )}

      {enriched.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
          <p className="text-muted">Add stocks in your Portfolio to see analytics.</p>
        </div>
      ) : (
        <>
          <div style={{ marginBottom: '1rem' }}>
            <PieChart enriched={enriched} totalValue={totalValue} />
          </div>
          <PerformanceChart history={history} period={period} setPeriod={setPeriod} loading={histLoading} />
          <ValueChart history={history} period={period} loading={histLoading} />
        </>
      )}
      </>}
    </div>
  )
}


// ═══════════════════════════════════════════════════════════════
// PIE CHART
// ═══════════════════════════════════════════════════════════════

function PieChart({ enriched, totalValue }) {
  const sorted = [...enriched].sort((a, b) => (b.currentValue || 0) - (a.currentValue || 0))
  let cumAngle = 0
  const segments = sorted.map((p, i) => {
    const pct = totalValue > 0 ? (p.currentValue || 0) / totalValue : 0
    const startAngle = cumAngle
    cumAngle += pct * 360
    return { ...p, pct, startAngle, endAngle: cumAngle, color: PIE_COLORS[i % PIE_COLORS.length] }
  })

  function arcPath(cx, cy, r, startAngle, endAngle) {
    if (endAngle - startAngle >= 359.99)
      return `M ${cx - r} ${cy} A ${r} ${r} 0 1 1 ${cx + r} ${cy} A ${r} ${r} 0 1 1 ${cx - r} ${cy}`
    const s = (startAngle - 90) * Math.PI / 180, e = (endAngle - 90) * Math.PI / 180
    const x1 = cx + r * Math.cos(s), y1 = cy + r * Math.sin(s)
    const x2 = cx + r * Math.cos(e), y2 = cy + r * Math.sin(e)
    return `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${endAngle - startAngle > 180 ? 1 : 0} 1 ${x2} ${y2} Z`
  }

  return (
    <div className="card" style={{ padding: '1.25rem' }}>
      <h2 style={{ fontSize: 'var(--text-lg)', marginBottom: '1rem' }}>Holdings Allocation</h2>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
        <svg viewBox="0 0 120 120" width="140" height="140" style={{ flexShrink: 0 }}>
          {segments.map(seg => (
            <path key={seg.ticker} d={arcPath(60, 60, 55, seg.startAngle, seg.endAngle)}
              fill={seg.color} stroke="var(--color-surface)" strokeWidth="1.5" />
          ))}
          <circle cx="60" cy="60" r="28" fill="var(--color-surface)" />
          <text x="60" y="56" textAnchor="middle" fill="var(--color-text-primary)" fontSize={totalValue >= 1e6 ? '7' : totalValue >= 1e4 ? '8' : '9'} fontWeight="700" fontFamily="var(--font-mono)">
            {totalValue >= 1e6 ? `$${(totalValue / 1e6).toFixed(1)}M` : totalValue >= 1e4 ? `$${(totalValue / 1e3).toFixed(1)}K` : formatCurrency(totalValue).replace('.00', '')}
          </text>
          <text x="60" y="68" textAnchor="middle" fill="var(--color-text-secondary)" fontSize="7">Total Value</text>
        </svg>
        <div style={{ fontSize: 'var(--text-sm)', flex: 1 }}>
          {segments.map(seg => (
            <div key={seg.ticker} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
              <span style={{ width: 10, height: 10, borderRadius: 2, background: seg.color, flexShrink: 0 }} />
              <span className="mono" style={{ fontWeight: 600, minWidth: 48 }}>{seg.ticker}</span>
              <span className="text-muted">{(seg.pct * 100).toFixed(1)}%</span>
              <span className="mono text-muted" style={{ marginLeft: 'auto', fontSize: 'var(--text-sm)' }}>{formatCurrency(seg.currentValue || 0)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}


// ═══════════════════════════════════════════════════════════════
// NET WORTH CARD
// ═══════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════
// HOVER HOOK — shared by both charts
// ═══════════════════════════════════════════════════════════════

function useChartHover(svgRef, dataLen, pad, cw) {
  const [hoverIdx, setHoverIdx] = useState(null)

  const onMouseMove = useCallback((e) => {
    if (!svgRef.current || dataLen < 2) return
    const rect = svgRef.current.getBoundingClientRect()
    const mouseX = e.clientX - rect.left
    // Convert pixel x to SVG viewBox x
    const svgWidth = rect.width
    const viewBoxWidth = svgRef.current.viewBox.baseVal.width
    const scale = viewBoxWidth / svgWidth
    const svgX = mouseX * scale
    const relX = svgX - pad.left
    if (relX < 0 || relX > cw) { setHoverIdx(null); return }
    const idx = Math.round((relX / cw) * (dataLen - 1))
    setHoverIdx(Math.max(0, Math.min(dataLen - 1, idx)))
  }, [svgRef, dataLen, pad.left, cw])

  const onMouseLeave = useCallback(() => setHoverIdx(null), [])

  return { hoverIdx, onMouseMove, onMouseLeave }
}


// ═══════════════════════════════════════════════════════════════
// PERFORMANCE CHART — Portfolio % vs S&P 500 % (with hover dot)
// ═══════════════════════════════════════════════════════════════

function PerformanceChart({ history, period, setPeriod, loading }) {
  const svgRef = useRef(null)
  const { portfolio, sp500 } = history

  const pNorm = useMemo(() => {
    if (portfolio.length < 2) return []
    const base = portfolio[0].value
    if (base === 0) return []
    return portfolio.map(d => ({ date: d.date, pct: ((d.value - base) / base) * 100, value: d.value }))
  }, [portfolio])

  // Align S&P to portfolio dates for proper comparison
  const sNorm = useMemo(() => {
    if (sp500.length < 2 || pNorm.length < 2) return []
    // Build a lookup by date
    const spMap = {}
    sp500.forEach(d => { spMap[d.date] = d.value })
    // Find the S&P value on the portfolio's first date (or nearest)
    let base = null
    for (const d of pNorm) {
      if (spMap[d.date] != null) { base = spMap[d.date]; break }
    }
    if (!base) return []
    // Map over portfolio dates, using last-known S&P value
    let lastSp = base
    return pNorm.map(d => {
      if (spMap[d.date] != null) lastSp = spMap[d.date]
      return { date: d.date, pct: ((lastSp - base) / base) * 100, value: lastSp }
    })
  }, [sp500, pNorm])

  const W = 700, H = 280, PAD = { top: 20, right: 20, bottom: 40, left: 55 }
  const cw = W - PAD.left - PAD.right, ch = H - PAD.top - PAD.bottom

  const allPcts = [...pNorm.map(d => d.pct), ...sNorm.map(d => d.pct)]
  const yMin = allPcts.length > 0 ? Math.min(...allPcts) : -5
  const yMax = allPcts.length > 0 ? Math.max(...allPcts) : 5
  const yPad = Math.max((yMax - yMin) * 0.1, 1)
  const yLow = yMin - yPad, yHigh = yMax + yPad

  function toPolyline(data) {
    if (data.length === 0) return ''
    return data.map((d, i) => {
      const x = PAD.left + (i / (data.length - 1)) * cw
      const y = PAD.top + ch - ((d.pct - yLow) / (yHigh - yLow)) * ch
      return `${x},${y}`
    }).join(' ')
  }

  function dataToXY(data, idx) {
    const x = PAD.left + (idx / (data.length - 1)) * cw
    const y = PAD.top + ch - ((data[idx].pct - yLow) / (yHigh - yLow)) * ch
    return { x, y }
  }

  const yTicks = useMemo(() => {
    const range = yHigh - yLow
    const step = niceStep(range, 5)
    const ticks = []
    let v = Math.ceil(yLow / step) * step
    while (v <= yHigh) { ticks.push(v); v += step }
    return ticks
  }, [yLow, yHigh])

  const xLabels = useMemo(() => {
    const src = pNorm.length > 0 ? pNorm : sNorm
    if (src.length < 2) return []
    const step = Math.max(1, Math.floor(src.length / 6))
    const labels = []
    for (let i = 0; i < src.length; i += step) {
      labels.push({ x: PAD.left + (i / (src.length - 1)) * cw, label: fmtDate(src[i].date) })
    }
    if (labels.length > 0 && labels[labels.length - 1].label !== fmtDate(src[src.length - 1].date))
      labels.push({ x: PAD.left + cw, label: fmtDate(src[src.length - 1].date) })
    return labels
  }, [pNorm, sNorm, cw])

  const pFinal = pNorm.length > 0 ? pNorm[pNorm.length - 1].pct : null
  const sFinal = sNorm.length > 0 ? sNorm[sNorm.length - 1].pct : null

  const { hoverIdx, onMouseMove, onMouseLeave } = useChartHover(svgRef, pNorm.length, PAD, cw)

  // Hover data
  const hoverP = hoverIdx != null && pNorm[hoverIdx] ? pNorm[hoverIdx] : null
  const hoverS = hoverIdx != null && sNorm[hoverIdx] ? sNorm[hoverIdx] : null

  return (
    <div className="card" style={{ marginBottom: '1rem', padding: '1.25rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        <h2 style={{ fontSize: 'var(--text-lg)' }}>Performance vs S&P 500</h2>
        <div style={{ display: 'flex', gap: '0.25rem' }}>
          {PERIODS.map(p => (
            <button key={p.key} onClick={() => setPeriod(p.key)} className={`btn ${period === p.key ? 'btn-primary' : 'btn-ghost'}`}
              style={{ fontSize: 'var(--text-sm)', padding: '0.2rem 0.55rem' }}>{p.label}</button>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: '1.25rem', fontSize: 'var(--text-sm)', marginBottom: '0.5rem' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <span style={{ width: 14, height: 3, background: 'var(--color-gold)', borderRadius: 2 }} />
          Portfolio {pFinal != null && <span className="mono" style={{ color: numColor(pFinal), fontWeight: 600 }}>{pFinal >= 0 ? '+' : ''}{pFinal.toFixed(2)}%</span>}
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <span style={{ width: 14, height: 3, background: 'var(--color-text-secondary)', borderRadius: 2 }} />
          S&P 500 {sFinal != null && <span className="mono" style={{ color: numColor(sFinal), fontWeight: 600 }}>{sFinal >= 0 ? '+' : ''}{sFinal.toFixed(2)}%</span>}
        </span>
      </div>

      {loading ? (
        <div style={{ height: H, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><LoadingSpinner height={40} /></div>
      ) : pNorm.length < 2 && sNorm.length < 2 ? (
        <div style={{ height: H, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <p className="text-muted" style={{ fontSize: 'var(--text-base)' }}>Not enough data for this period.</p>
        </div>
      ) : (
        <div style={{ position: 'relative' }}>
          <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} width="100%" style={{ overflow: 'visible', cursor: 'crosshair' }}
            onMouseMove={onMouseMove} onMouseLeave={onMouseLeave}>
            {/* Grid */}
            {yTicks.map(v => {
              const y = PAD.top + ch - ((v - yLow) / (yHigh - yLow)) * ch
              return (
                <g key={v}>
                  <line x1={PAD.left} x2={PAD.left + cw} y1={y} y2={y} stroke="var(--color-border)" strokeWidth="0.5" strokeDasharray="3,3" />
                  <text x={PAD.left - 8} y={y + 3} textAnchor="end" fontSize="9" fill="var(--color-text-secondary)" fontFamily="var(--font-mono)">
                    {v >= 0 ? '+' : ''}{v.toFixed(1)}%
                  </text>
                </g>
              )
            })}

            {yLow < 0 && yHigh > 0 && (
              <line x1={PAD.left} x2={PAD.left + cw}
                y1={PAD.top + ch - ((0 - yLow) / (yHigh - yLow)) * ch}
                y2={PAD.top + ch - ((0 - yLow) / (yHigh - yLow)) * ch}
                stroke="var(--color-border-dark)" strokeWidth="1" />
            )}

            {xLabels.map((l, i) => (
              <text key={i} x={l.x} y={H - 8} textAnchor="middle" fontSize="8.5" fill="var(--color-text-secondary)" fontFamily="var(--font-mono)">{l.label}</text>
            ))}

            {/* S&P line */}
            {sNorm.length >= 2 && (
              <polyline points={toPolyline(sNorm)} fill="none" stroke="var(--color-text-secondary)" strokeWidth="1.5" strokeLinejoin="round" strokeOpacity="0.6" />
            )}

            {/* Portfolio line */}
            {pNorm.length >= 2 && (
              <polyline points={toPolyline(pNorm)} fill="none" stroke="var(--color-gold)" strokeWidth="2.5" strokeLinejoin="round" />
            )}

            {/* Hover crosshair + dots */}
            {hoverIdx != null && pNorm.length >= 2 && (() => {
              const pp = dataToXY(pNorm, hoverIdx)
              const sp = sNorm.length > hoverIdx ? dataToXY(sNorm, hoverIdx) : null
              return (
                <>
                  <line x1={pp.x} x2={pp.x} y1={PAD.top} y2={PAD.top + ch} stroke="var(--color-border-dark)" strokeWidth="0.8" strokeDasharray="4,3" />
                  <circle cx={pp.x} cy={pp.y} r="4.5" fill="var(--color-gold)" stroke="var(--color-surface)" strokeWidth="2" />
                  {sp && <circle cx={sp.x} cy={sp.y} r="3.5" fill="var(--color-text-secondary)" stroke="var(--color-surface)" strokeWidth="2" />}
                </>
              )
            })()}

            {/* Axes */}
            <line x1={PAD.left} x2={PAD.left} y1={PAD.top} y2={PAD.top + ch} stroke="var(--color-border-dark)" strokeWidth="1" />
            <line x1={PAD.left} x2={PAD.left + cw} y1={PAD.top + ch} y2={PAD.top + ch} stroke="var(--color-border-dark)" strokeWidth="1" />
          </svg>

          {/* Tooltip (HTML overlay for crisp text) */}
          {hoverP && (
            <ChartTooltip svgRef={svgRef} W={W} idx={hoverIdx} dataLen={pNorm.length} pad={PAD} cw={cw}>
              <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', marginBottom: 3 }}>{fmtDateFull(hoverP.date)}</div>
              <div style={{ fontSize: 'var(--text-sm)' }}>
                <span style={{ color: 'var(--color-gold)', fontWeight: 600 }}>Portfolio:</span>{' '}
                <span className="mono" style={{ color: numColor(hoverP.pct), fontWeight: 600 }}>{hoverP.pct >= 0 ? '+' : ''}{hoverP.pct.toFixed(2)}%</span>
                <span className="mono text-muted" style={{ marginLeft: 4, fontSize: 'var(--text-sm)' }}>({formatCurrency(hoverP.value)})</span>
              </div>
              {hoverS && (
                <div style={{ fontSize: 'var(--text-sm)' }}>
                  <span style={{ color: 'var(--color-text-secondary)', fontWeight: 600 }}>S&P 500:</span>{' '}
                  <span className="mono" style={{ color: numColor(hoverS.pct), fontWeight: 600 }}>{hoverS.pct >= 0 ? '+' : ''}{hoverS.pct.toFixed(2)}%</span>
                </div>
              )}
            </ChartTooltip>
          )}
        </div>
      )}
    </div>
  )
}


// ═══════════════════════════════════════════════════════════════
// VALUE CHART — Portfolio Value Over Time (Area, with hover dot)
// ═══════════════════════════════════════════════════════════════

function ValueChart({ history, period, loading }) {
  const svgRef = useRef(null)
  const { portfolio } = history

  const W = 700, H = 260, PAD = { top: 20, right: 20, bottom: 40, left: 65 }
  const cw = W - PAD.left - PAD.right, ch = H - PAD.top - PAD.bottom

  const values = portfolio.map(d => d.value)
  const yMin = values.length > 0 ? Math.min(...values) : 0
  const yMax = values.length > 0 ? Math.max(...values) : 100
  const yPad = Math.max((yMax - yMin) * 0.1, 10)
  const yLow = Math.max(yMin - yPad, 0), yHigh = yMax + yPad

  const polyline = useMemo(() => {
    if (portfolio.length < 2) return ''
    return portfolio.map((d, i) => {
      const x = PAD.left + (i / (portfolio.length - 1)) * cw
      const y = PAD.top + ch - ((d.value - yLow) / (yHigh - yLow)) * ch
      return `${x},${y}`
    }).join(' ')
  }, [portfolio, yLow, yHigh, cw, ch])

  const areaPath = useMemo(() => {
    if (portfolio.length < 2) return ''
    const baseY = PAD.top + ch
    const points = portfolio.map((d, i) => {
      const x = PAD.left + (i / (portfolio.length - 1)) * cw
      const y = PAD.top + ch - ((d.value - yLow) / (yHigh - yLow)) * ch
      return `${x},${y}`
    })
    return `M ${PAD.left},${baseY} L ${points.join(' L ')} L ${PAD.left + cw},${baseY} Z`
  }, [portfolio, yLow, yHigh, cw, ch])

  const yTicks = useMemo(() => {
    const range = yHigh - yLow
    const step = niceStep(range, 5)
    const ticks = []
    let v = Math.ceil(yLow / step) * step
    while (v <= yHigh) { ticks.push(v); v += step }
    return ticks
  }, [yLow, yHigh])

  const xLabels = useMemo(() => {
    if (portfolio.length < 2) return []
    const step = Math.max(1, Math.floor(portfolio.length / 6))
    const labels = []
    for (let i = 0; i < portfolio.length; i += step) {
      labels.push({ x: PAD.left + (i / (portfolio.length - 1)) * cw, label: fmtDate(portfolio[i].date) })
    }
    const last = portfolio[portfolio.length - 1]
    if (labels.length > 0 && labels[labels.length - 1].label !== fmtDate(last.date))
      labels.push({ x: PAD.left + cw, label: fmtDate(last.date) })
    return labels
  }, [portfolio, cw])

  const startVal = portfolio.length > 0 ? portfolio[0].value : 0
  const endVal = portfolio.length > 0 ? portfolio[portfolio.length - 1].value : 0
  const changePct = startVal > 0 ? ((endVal - startVal) / startVal) * 100 : 0

  const { hoverIdx, onMouseMove, onMouseLeave } = useChartHover(svgRef, portfolio.length, PAD, cw)
  const hoverD = hoverIdx != null && portfolio[hoverIdx] ? portfolio[hoverIdx] : null

  function dataToXY(idx) {
    const x = PAD.left + (idx / (portfolio.length - 1)) * cw
    const y = PAD.top + ch - ((portfolio[idx].value - yLow) / (yHigh - yLow)) * ch
    return { x, y }
  }

  return (
    <div className="card" style={{ padding: '1.25rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
        <div>
          <h2 style={{ fontSize: 'var(--text-lg)', marginBottom: '0.15rem' }}>Portfolio Value</h2>
          {portfolio.length >= 2 && (
            <span className="mono" style={{ fontSize: 'var(--text-sm)', color: numColor(changePct) }}>
              {formatCurrency(endVal)} ({changePct >= 0 ? '+' : ''}{changePct.toFixed(2)}%)
            </span>
          )}
        </div>
      </div>

      {loading ? (
        <div style={{ height: H, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><LoadingSpinner height={40} /></div>
      ) : portfolio.length < 2 ? (
        <div style={{ height: H, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <p className="text-muted" style={{ fontSize: 'var(--text-base)' }}>Not enough data for this period.</p>
        </div>
      ) : (
        <div style={{ position: 'relative' }}>
          <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} width="100%" style={{ overflow: 'visible', cursor: 'crosshair' }}
            onMouseMove={onMouseMove} onMouseLeave={onMouseLeave}>
            {yTicks.map(v => {
              const y = PAD.top + ch - ((v - yLow) / (yHigh - yLow)) * ch
              return (
                <g key={v}>
                  <line x1={PAD.left} x2={PAD.left + cw} y1={y} y2={y} stroke="var(--color-border)" strokeWidth="0.5" strokeDasharray="3,3" />
                  <text x={PAD.left - 8} y={y + 3} textAnchor="end" fontSize="9" fill="var(--color-text-secondary)" fontFamily="var(--font-mono)">{fmtDollar(v)}</text>
                </g>
              )
            })}

            {xLabels.map((l, i) => (
              <text key={i} x={l.x} y={H - 8} textAnchor="middle" fontSize="8.5" fill="var(--color-text-secondary)" fontFamily="var(--font-mono)">{l.label}</text>
            ))}

            <path d={areaPath} fill="var(--color-gold)" fillOpacity="0.12" />
            <polyline points={polyline} fill="none" stroke="var(--color-gold)" strokeWidth="2.5" strokeLinejoin="round" />

            {/* Hover crosshair + dot */}
            {hoverIdx != null && portfolio.length >= 2 && (() => {
              const p = dataToXY(hoverIdx)
              return (
                <>
                  <line x1={p.x} x2={p.x} y1={PAD.top} y2={PAD.top + ch} stroke="var(--color-border-dark)" strokeWidth="0.8" strokeDasharray="4,3" />
                  <circle cx={p.x} cy={p.y} r="4.5" fill="var(--color-gold)" stroke="var(--color-surface)" strokeWidth="2" />
                </>
              )
            })()}

            <line x1={PAD.left} x2={PAD.left} y1={PAD.top} y2={PAD.top + ch} stroke="var(--color-border-dark)" strokeWidth="1" />
            <line x1={PAD.left} x2={PAD.left + cw} y1={PAD.top + ch} y2={PAD.top + ch} stroke="var(--color-border-dark)" strokeWidth="1" />
          </svg>

          {/* Tooltip */}
          {hoverD && (
            <ChartTooltip svgRef={svgRef} W={W} idx={hoverIdx} dataLen={portfolio.length} pad={PAD} cw={cw}>
              <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', marginBottom: 3 }}>{fmtDateFull(hoverD.date)}</div>
              <div style={{ fontSize: 'var(--text-base)', fontWeight: 600 }}>
                <span className="mono" style={{ color: 'var(--color-gold)' }}>{formatCurrency(hoverD.value)}</span>
              </div>
              {startVal > 0 && (
                <div className="mono" style={{ fontSize: 'var(--text-sm)', color: numColor(hoverD.value - startVal) }}>
                  {hoverD.value >= startVal ? '+' : ''}{formatCurrency(hoverD.value - startVal)} ({((hoverD.value - startVal) / startVal * 100).toFixed(2)}%)
                </div>
              )}
            </ChartTooltip>
          )}
        </div>
      )}
    </div>
  )
}


// ═══════════════════════════════════════════════════════════════
// CHART TOOLTIP — positioned via HTML overlay
// ═══════════════════════════════════════════════════════════════

function ChartTooltip({ svgRef, W, idx, dataLen, pad, cw, children }) {
  if (!svgRef.current) return null
  const rect = svgRef.current.getBoundingClientRect()
  const scale = rect.width / W
  const dotSvgX = pad.left + (idx / (dataLen - 1)) * cw
  const dotPixelX = dotSvgX * scale
  // Flip tooltip to left side if near right edge
  const tooltipWidth = 190
  const flipped = dotPixelX + tooltipWidth + 12 > rect.width
  return (
    <div style={{
      position: 'absolute',
      top: 8,
      left: flipped ? dotPixelX - tooltipWidth - 8 : dotPixelX + 8,
      background: 'var(--color-surface)',
      border: '1px solid var(--color-border)',
      borderRadius: 6,
      padding: '0.5rem 0.65rem',
      pointerEvents: 'none',
      zIndex: 10,
      boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
      minWidth: tooltipWidth,
    }}>
      {children}
    </div>
  )
}


// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════

function niceStep(range, targetTicks) {
  const raw = range / targetTicks
  const mag = Math.pow(10, Math.floor(Math.log10(raw)))
  const norm = raw / mag
  if (norm <= 1) return mag
  if (norm <= 2) return 2 * mag
  if (norm <= 5) return 5 * mag
  return 10 * mag
}

function fmtDate(dateStr) {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  if (dateStr.includes('T')) {
    const d = new Date(dateStr)
    const h = d.getHours(), min = d.getMinutes()
    const ampm = h >= 12 ? 'PM' : 'AM'
    return `${h % 12 || 12}:${String(min).padStart(2, '0')} ${ampm}`
  }
  const [, m, d] = dateStr.split('-')
  return `${months[parseInt(m) - 1]} ${parseInt(d)}`
}

function fmtDateFull(dateStr) {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  if (dateStr.includes('T')) {
    const d = new Date(dateStr)
    const h = d.getHours(), min = d.getMinutes()
    const ampm = h >= 12 ? 'PM' : 'AM'
    return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()} ${h % 12 || 12}:${String(min).padStart(2, '0')} ${ampm}`
  }
  const [y, m, d] = dateStr.split('-')
  return `${months[parseInt(m) - 1]} ${parseInt(d)}, ${y}`
}

function fmtDollar(v) {
  if (v >= 1000000) return `$${(v / 1000000).toFixed(1)}M`
  if (v >= 1000) return `$${(v / 1000).toFixed(1)}K`
  return `$${v.toFixed(0)}`
}
