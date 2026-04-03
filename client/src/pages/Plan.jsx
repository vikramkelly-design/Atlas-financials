import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import useApi, { api } from '../hooks/useApi'
import { formatCurrency } from '../components/NumberDisplay'
import LoadingSpinner from '../components/LoadingSpinner'

const RISK_RETURNS = { conservative: 0.06, moderate: 0.08, aggressive: 0.11 }

function calculateProjection(goalAmount, currentAge, targetAge, monthlyInvestment, riskTolerance) {
  const annualRate = RISK_RETURNS[riskTolerance] || 0.08
  const monthlyRate = annualRate / 12
  const years = targetAge - currentAge
  const months = years * 12

  const fv = monthlyInvestment * ((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate)

  const yearlyData = []
  const sp500Rate = 0.07 / 12
  for (let y = 0; y <= years; y++) {
    const m = y * 12
    const value = monthlyInvestment * ((Math.pow(1 + monthlyRate, m) - 1) / monthlyRate)
    const sp500Value = monthlyInvestment * ((Math.pow(1 + sp500Rate, m) - 1) / sp500Rate)
    yearlyData.push({ age: currentAge + y, value: Math.round(value), sp500: Math.round(sp500Value) })
  }

  const requiredMonthly = goalAmount / ((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate)

  return { projectedValue: Math.round(fv), yearlyData, requiredMonthly: Math.round(requiredMonthly), years }
}

function GrowthChart({ data, goalAmount }) {
  if (!data || data.length < 2) return null

  const maxVal = Math.max(goalAmount, ...data.map(d => Math.max(d.value, d.sp500)))
  const padding = { top: 20, right: 20, bottom: 30, left: 60 }
  const w = 600, h = 280
  const chartW = w - padding.left - padding.right
  const chartH = h - padding.top - padding.bottom

  const x = (i) => padding.left + (i / (data.length - 1)) * chartW
  const y = (v) => padding.top + chartH - (v / maxVal) * chartH

  const planPath = data.map((d, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(d.value).toFixed(1)}`).join(' ')
  const sp500Path = data.map((d, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(d.sp500).toFixed(1)}`).join(' ')

  const yTicks = [0, maxVal * 0.25, maxVal * 0.5, maxVal * 0.75, maxVal]
  const xTickInterval = Math.max(1, Math.ceil(data.length / 6))

  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', maxWidth: 600, height: 'auto' }}>
      {/* Subtle grid lines */}
      {yTicks.map((v, i) => (
        <line key={i} x1={padding.left} x2={w - padding.right} y1={y(v)} y2={y(v)}
          stroke="var(--color-border)" strokeWidth="0.5" />
      ))}
      {/* Y-axis labels */}
      {yTicks.map((v, i) => (
        <text key={i} x={padding.left - 8} y={y(v) + 4} textAnchor="end"
          fontSize="10" fill="var(--color-text-muted)" fontFamily="var(--font-mono)">
          ${v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v.toFixed(0)}
        </text>
      ))}
      {/* X-axis labels */}
      {data.map((d, i) => i % xTickInterval === 0 || i === data.length - 1 ? (
        <text key={i} x={x(i)} y={h - 5} textAnchor="middle"
          fontSize="10" fill="var(--color-text-muted)" fontFamily="var(--font-mono)">
          {d.age}
        </text>
      ) : null)}
      {/* Goal line */}
      <line x1={padding.left} x2={w - padding.right} y1={y(goalAmount)} y2={y(goalAmount)}
        stroke="var(--color-gold)" strokeWidth="1" strokeDasharray="4,4" />
      <text x={w - padding.right + 2} y={y(goalAmount) + 4} fontSize="9" fill="var(--color-gold)">Goal</text>
      {/* S&P 500 line */}
      <path d={sp500Path} fill="none" stroke="var(--color-text-muted)" strokeWidth="1.5" strokeDasharray="3,3" />
      {/* Plan line */}
      <path d={planPath} fill="none" stroke="var(--color-gold)" strokeWidth="2" />
      {/* Legend */}
      <line x1={padding.left} x2={padding.left + 20} y1={8} y2={8} stroke="var(--color-gold)" strokeWidth="2" />
      <text x={padding.left + 24} y={12} fontSize="10" fill="var(--color-text-secondary)">Your Plan</text>
      <line x1={padding.left + 100} x2={padding.left + 120} y1={8} y2={8} stroke="var(--color-text-muted)" strokeWidth="1.5" strokeDasharray="3,3" />
      <text x={padding.left + 124} y={12} fontSize="10" fill="var(--color-text-muted)">S&P 500 Avg</text>
    </svg>
  )
}

export default function Plan() {
  const navigate = useNavigate()
  const { get } = useApi()
  const [plan, setPlan] = useState(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [screenerData, setScreenerData] = useState([])

  // Form state
  const [goalAmount, setGoalAmount] = useState('')
  const [targetAge, setTargetAge] = useState('')
  const [currentAge, setCurrentAge] = useState('')
  const [monthlyInvestment, setMonthlyInvestment] = useState('')
  const [riskTolerance, setRiskTolerance] = useState('moderate')

  // Projection
  const [projection, setProjection] = useState(null)

  useEffect(() => {
    const fetchPlan = async () => {
      setLoading(true)
      try {
        const res = await get('/api/plan')
        const p = res.data
        if (p) {
          setPlan(p)
          setGoalAmount(String(p.goal_amount))
          setTargetAge(String(p.target_age))
          setCurrentAge(String(p.current_age))
          setMonthlyInvestment(String(p.monthly_investment))
          setRiskTolerance(p.risk_tolerance || 'moderate')
          setProjection(calculateProjection(p.goal_amount, p.current_age, p.target_age, p.monthly_investment, p.risk_tolerance))
        }
      } catch {}

      // Fetch screener for undervalued stocks
      try {
        const scrRes = await api.post('/api/screener', { tickers: ['AAPL','MSFT','GOOGL','AMZN','TSLA','NVDA','META','BRK-B','JPM','V','WMT','JNJ','PG','KO','DIS'], discountRate: 0.10 })
        setScreenerData(scrRes.data.data?.stocks || scrRes.data.stocks || [])
      } catch {}

      setLoading(false)
    }
    fetchPlan()
  }, [])

  const savePlan = async () => {
    const ga = parseFloat(goalAmount)
    const ta = parseInt(targetAge)
    const ca = parseInt(currentAge)
    const mi = parseFloat(monthlyInvestment)
    if (!ga || !ta || !ca || !mi || ta <= ca) return

    setSaving(true)
    try {
      await api.post('/api/plan', {
        goal_amount: ga, target_age: ta, current_age: ca,
        monthly_investment: mi, risk_tolerance: riskTolerance,
      })
      setPlan({ goal_amount: ga, target_age: ta, current_age: ca, monthly_investment: mi, risk_tolerance: riskTolerance })
      setProjection(calculateProjection(ga, ca, ta, mi, riskTolerance))
      setEditing(false)
    } catch {}
    setSaving(false)
  }

  const undervalued = screenerData
    .filter(s => s.verdict === 'UNDERVALUED')
    .sort((a, b) => (b.upside || 0) - (a.upside || 0))

  const endOfMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0)
    .toLocaleDateString('en-US', { month: 'long', day: 'numeric' })

  if (loading) return <LoadingSpinner height={200} />

  // INPUT FORM STATE
  if (!plan || editing) {
    return (
      <div>
        <h1 style={{ fontSize: 'var(--text-3xl)', marginBottom: 'var(--space-xs)' }}>My Plan</h1>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-base)', marginBottom: 'var(--space-lg)' }}>
          Your road to the number.
        </p>

        <div className="card" style={{ maxWidth: 500 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', marginBottom: 'var(--space-md)', flexWrap: 'wrap' }}>
            <span style={{ color: 'var(--color-text-secondary)' }}>I want to reach</span>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <span style={{ color: 'var(--color-text-muted)', marginRight: 2 }}>$</span>
              <input className="input" type="number" value={goalAmount} onChange={e => setGoalAmount(e.target.value)}
                placeholder="100000" style={{ width: 130 }} />
            </div>
            <span style={{ color: 'var(--color-text-secondary)' }}>by age</span>
            <input className="input" type="number" value={targetAge} onChange={e => setTargetAge(e.target.value)}
              placeholder="25" style={{ width: 70 }} />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', marginBottom: 'var(--space-md)', flexWrap: 'wrap' }}>
            <span style={{ color: 'var(--color-text-secondary)' }}>I am currently</span>
            <input className="input" type="number" value={currentAge} onChange={e => setCurrentAge(e.target.value)}
              placeholder="17" style={{ width: 70 }} />
            <span style={{ color: 'var(--color-text-secondary)' }}>years old</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', marginBottom: 'var(--space-md)', flexWrap: 'wrap' }}>
            <span style={{ color: 'var(--color-text-secondary)' }}>I can invest</span>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <span style={{ color: 'var(--color-text-muted)', marginRight: 2 }}>$</span>
              <input className="input" type="number" value={monthlyInvestment} onChange={e => setMonthlyInvestment(e.target.value)}
                placeholder="200" style={{ width: 110 }} />
            </div>
            <span style={{ color: 'var(--color-text-secondary)' }}>per month</span>
          </div>

          <div style={{ marginBottom: 'var(--space-lg)' }}>
            <span style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--space-xs)', display: 'block' }}>Risk tolerance</span>
            <div style={{ display: 'flex', gap: 'var(--space-xs)' }}>
              {['conservative', 'moderate', 'aggressive'].map(r => (
                <button key={r} className={`btn ${riskTolerance === r ? 'btn-primary' : 'btn-ghost'}`}
                  onClick={() => setRiskTolerance(r)} style={{ fontSize: 'var(--text-sm)' }}>
                  {r.charAt(0).toUpperCase() + r.slice(1)}
                </button>
              ))}
            </div>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', marginTop: 'var(--space-xs)' }}>
              {riskTolerance === 'conservative' ? 'Assumes 6% annual return'
                : riskTolerance === 'moderate' ? 'Assumes 8% annual return'
                : 'Assumes 11% annual return'}
            </p>
          </div>

          <button className="btn btn-primary btn-lg" onClick={savePlan} disabled={saving} style={{ width: '100%' }}>
            {saving ? 'Saving...' : plan ? 'Update My Plan' : 'Calculate My Plan'}
          </button>
        </div>
      </div>
    )
  }

  // RESULTS VIEW
  const onTrack = projection && projection.projectedValue >= parseFloat(goalAmount)

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-lg)' }}>
        <div>
          <h1 style={{ fontSize: 'var(--text-3xl)', marginBottom: 'var(--space-xs)' }}>My Plan</h1>
          <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-base)' }}>Your road to the number.</p>
        </div>
        <button className="btn btn-ghost" onClick={() => setEditing(true)}>Edit Plan</button>
      </div>

      {/* Verdict */}
      <div className="card" style={{ marginBottom: 'var(--space-lg)', borderLeft: `3px solid ${onTrack ? 'var(--color-positive)' : 'var(--color-gold)'}` }}>
        <p style={{ fontFamily: 'var(--font-serif)', fontSize: 20, color: 'var(--color-text-primary)', lineHeight: 1.5 }}>
          {onTrack
            ? `At $${parseInt(monthlyInvestment).toLocaleString()}/month, you reach $${parseInt(goalAmount).toLocaleString()} at age ${targetAge} \u2014 you're on track.`
            : `At this rate you'll reach $${projection?.projectedValue?.toLocaleString()} by age ${targetAge}. To hit $${parseInt(goalAmount).toLocaleString()} you need $${projection?.requiredMonthly?.toLocaleString()}/month.`
          }
        </p>
      </div>

      {/* Chart */}
      {projection && (
        <div className="card" style={{ marginBottom: 'var(--space-lg)' }}>
          <span className="label-caps" style={{ marginBottom: 'var(--space-sm)', display: 'block' }}>Compound Growth Projection</span>
          <GrowthChart data={projection.yearlyData} goalAmount={parseFloat(goalAmount)} />
        </div>
      )}

      {/* Stocks That Fit */}
      <div className="card" style={{ marginBottom: 'var(--space-lg)' }}>
        <span className="label-caps" style={{ display: 'block' }}>Stocks That Fit Your Plan</span>
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', marginBottom: 'var(--space-md)' }}>
          Currently undervalued · Atlas DCF model
        </p>
        {undervalued.length > 0 ? undervalued.slice(0, 3).map(stock => (
          <div key={stock.ticker} onClick={() => navigate(`/markets/${stock.ticker}`)}
            style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: 'var(--space-sm) 0', borderBottom: '1px solid var(--color-border)',
              cursor: 'pointer',
            }}>
            <div>
              <span className="mono" style={{ fontWeight: 600 }}>{stock.ticker}</span>
              <span style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)', marginLeft: 'var(--space-sm)' }}>{stock.companyName}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
              <span className="mono" style={{ fontSize: 'var(--text-sm)', color: 'var(--color-positive)' }}>
                +{(stock.upside || 0).toFixed(0)}%
              </span>
              <span className="verdict-badge verdict-undervalued">UNDERVALUED</span>
            </div>
          </div>
        )) : (
          <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>No undervalued stocks right now.</p>
        )}
      </div>

      {/* Monthly Action */}
      <div className="card" style={{ borderLeft: '3px solid var(--color-gold)' }}>
        <span className="label-caps" style={{ display: 'block', marginBottom: 'var(--space-xs)' }}>This Month's Action</span>
        <p style={{ fontSize: 'var(--text-base)', color: 'var(--color-text-primary)' }}>
          Invest <span className="mono" style={{ fontWeight: 600 }}>${parseInt(monthlyInvestment).toLocaleString()}</span> before {endOfMonth}.
        </p>
        {undervalued[0] && (
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', marginTop: 'var(--space-xs)' }}>
            Your top pick: <strong>{undervalued[0].ticker}</strong> at {(undervalued[0].upside || 0).toFixed(0)}% below intrinsic value.
          </p>
        )}
        <button className="btn btn-ghost" style={{ marginTop: 'var(--space-sm)', fontSize: 'var(--text-sm)' }} onClick={() => navigate('/markets')}>
          View in Markets →
        </button>
      </div>
    </div>
  )
}
