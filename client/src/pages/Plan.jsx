import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import useApi, { api } from '../hooks/useApi'
import { formatCurrency } from '../components/NumberDisplay'
import LoadingSpinner from '../components/LoadingSpinner'

function calculateProjection(goalAmount, currentAge, targetAge, monthlyInvestment) {
  const years = targetAge - currentAge
  const months = years * 12
  const rates = { conservative: 0.06, moderate: 0.08, aggressive: 0.11 }
  const sp500Rate = 0.07 / 12

  const yearlyData = []
  for (let y = 0; y <= years; y++) {
    const m = y * 12
    const entry = { age: currentAge + y }
    for (const [key, annual] of Object.entries(rates)) {
      const mr = annual / 12
      entry[key] = Math.round(monthlyInvestment * ((Math.pow(1 + mr, m) - 1) / (mr || 1)))
    }
    entry.sp500 = Math.round(monthlyInvestment * ((Math.pow(1 + sp500Rate, m) - 1) / (sp500Rate || 1)))
    yearlyData.push(entry)
  }

  // Use moderate for the "on track" check
  const moderateRate = rates.moderate / 12
  const projectedValue = Math.round(monthlyInvestment * ((Math.pow(1 + moderateRate, months) - 1) / moderateRate))
  const requiredMonthly = Math.round(goalAmount / ((Math.pow(1 + moderateRate, months) - 1) / moderateRate))

  return { projectedValue, yearlyData, requiredMonthly, years }
}

function GrowthChart({ data, goalAmount }) {
  if (!data || data.length < 2) return null

  const maxVal = Math.max(goalAmount, ...data.map(d => Math.max(d.aggressive, d.sp500)))
  const padding = { top: 20, right: 20, bottom: 30, left: 60 }
  const w = 600, h = 300
  const chartW = w - padding.left - padding.right
  const chartH = h - padding.top - padding.bottom

  const x = (i) => padding.left + (i / (data.length - 1)) * chartW
  const y = (v) => padding.top + chartH - (v / maxVal) * chartH

  const makePath = (key) => data.map((d, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(d[key]).toFixed(1)}`).join(' ')

  const lines = [
    { key: 'aggressive', color: 'var(--color-positive)', label: '11% Return', dash: '' },
    { key: 'moderate', color: 'var(--color-gold)', label: '8% Return', dash: '' },
    { key: 'conservative', color: '#5A7D9A', label: '6% Return', dash: '' },
    { key: 'sp500', color: 'var(--color-text-muted)', label: 'S&P 500 Avg (7%)', dash: '3,3' },
  ]

  const yTicks = [0, maxVal * 0.25, maxVal * 0.5, maxVal * 0.75, maxVal]
  const xTickInterval = Math.max(1, Math.ceil(data.length / 6))

  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', maxWidth: 600, height: 'auto' }}>
      {yTicks.map((v, i) => (
        <line key={i} x1={padding.left} x2={w - padding.right} y1={y(v)} y2={y(v)}
          stroke="var(--color-border)" strokeWidth="0.5" />
      ))}
      {yTicks.map((v, i) => (
        <text key={i} x={padding.left - 8} y={y(v) + 4} textAnchor="end"
          fontSize="10" fill="var(--color-text-muted)" fontFamily="var(--font-mono)">
          ${v >= 1e6 ? (v / 1e6).toFixed(1) + 'M' : v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v.toFixed(0)}
        </text>
      ))}
      {data.map((d, i) => i % xTickInterval === 0 || i === data.length - 1 ? (
        <text key={i} x={x(i)} y={h - 5} textAnchor="middle"
          fontSize="10" fill="var(--color-text-muted)" fontFamily="var(--font-mono)">
          {d.age}
        </text>
      ) : null)}

      {/* Goal line */}
      <line x1={padding.left} x2={w - padding.right} y1={y(goalAmount)} y2={y(goalAmount)}
        stroke="var(--color-gold)" strokeWidth="1" strokeDasharray="6,4" opacity="0.5" />
      <text x={w - padding.right + 2} y={y(goalAmount) + 4} fontSize="9" fill="var(--color-gold)">Goal</text>

      {/* All lines */}
      {lines.map(line => (
        <path key={line.key} d={makePath(line.key)} fill="none" stroke={line.color}
          strokeWidth={line.key === 'sp500' ? 1.5 : 2} strokeDasharray={line.dash} />
      ))}

      {/* Legend */}
      {lines.map((line, i) => {
        const lx = padding.left + i * 120
        return (
          <g key={line.key}>
            <line x1={lx} x2={lx + 16} y1={8} y2={8} stroke={line.color} strokeWidth="2" strokeDasharray={line.dash} />
            <text x={lx + 20} y={12} fontSize="9" fill={line.color}>{line.label}</text>
          </g>
        )
      })}
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

  // AI recommendations
  const [aiRecs, setAiRecs] = useState(null)
  const [aiRecsLoading, setAiRecsLoading] = useState(false)

  // Form state
  const [goalAmount, setGoalAmount] = useState('')
  const [targetAge, setTargetAge] = useState('')
  const [currentAge, setCurrentAge] = useState('')
  const [monthlyInvestment, setMonthlyInvestment] = useState('')

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
          setProjection(calculateProjection(p.goal_amount, p.current_age, p.target_age, p.monthly_investment))
        }
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
        monthly_investment: mi, risk_tolerance: 'moderate',
      })
      setPlan({ goal_amount: ga, target_age: ta, current_age: ca, monthly_investment: mi })
      setProjection(calculateProjection(ga, ca, ta, mi))
      setEditing(false)
      setAiRecs(null) // reset recommendations on plan change
    } catch {}
    setSaving(false)
  }

  const fetchAiRecommendations = async () => {
    setAiRecsLoading(true)
    try {
      const res = await api.post('/api/chat', {
        message: `I have a financial plan: I want to reach $${parseInt(goalAmount).toLocaleString()} by age ${targetAge}. I'm currently ${currentAge} years old and can invest $${parseInt(monthlyInvestment).toLocaleString()}/month. That gives me ${parseInt(targetAge) - parseInt(currentAge)} years. My projected value at 8% returns is $${projection?.projectedValue?.toLocaleString()}.

Recommend 3-5 specific stocks I should consider buying to reach this goal within my timeline. For each stock, explain why it fits my plan (growth potential, valuation, etc). You can recommend any publicly traded stock — use your full knowledge, not just a preset list. Consider my time horizon and the amount I can invest monthly.

Format each recommendation as:
**TICKER — Company Name**
Why: [1-2 sentence explanation]

End with one brief sentence of overall strategy advice.`,
        context: 'plan'
      })
      setAiRecs(res.data.data?.reply || res.data.response || res.data.data?.response)
    } catch { setAiRecs('Unable to generate recommendations right now. Try again later.') }
    setAiRecsLoading(false)
  }

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

          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', marginBottom: 'var(--space-lg)', flexWrap: 'wrap' }}>
            <span style={{ color: 'var(--color-text-secondary)' }}>I can invest</span>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <span style={{ color: 'var(--color-text-muted)', marginRight: 2 }}>$</span>
              <input className="input" type="number" value={monthlyInvestment} onChange={e => setMonthlyInvestment(e.target.value)}
                placeholder="200" style={{ width: 110 }} />
            </div>
            <span style={{ color: 'var(--color-text-secondary)' }}>per month</span>
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
            ? `At $${parseInt(monthlyInvestment).toLocaleString()}/month, you reach $${parseInt(goalAmount).toLocaleString()} at age ${targetAge} — you're on track.`
            : `At this rate you'll reach $${projection?.projectedValue?.toLocaleString()} by age ${targetAge}. To hit $${parseInt(goalAmount).toLocaleString()} you need $${projection?.requiredMonthly?.toLocaleString()}/month.`
          }
        </p>
      </div>

      {/* Chart — 3 projection lines */}
      {projection && (
        <div className="card" style={{ marginBottom: 'var(--space-lg)' }}>
          <span className="label-caps" style={{ marginBottom: 'var(--space-sm)', display: 'block' }}>Compound Growth Projection</span>
          <p className="text-faint" style={{ fontSize: 'var(--text-sm)', marginBottom: 'var(--space-sm)' }}>
            Three scenarios based on ${parseInt(monthlyInvestment).toLocaleString()}/month
          </p>
          <GrowthChart data={projection.yearlyData} goalAmount={parseFloat(goalAmount)} />
        </div>
      )}

      {/* AI Stock Recommendations */}
      <div className="card" style={{ marginBottom: 'var(--space-lg)' }}>
        <span className="label-caps" style={{ display: 'block' }}>AI Stock Recommendations</span>
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', marginBottom: 'var(--space-md)' }}>
          Stocks tailored to your {parseInt(targetAge) - parseInt(currentAge)}-year plan
        </p>

        {aiRecsLoading ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <LoadingSpinner height={20} />
            <span className="text-faint" style={{ fontSize: 'var(--text-sm)' }}>Atlas is analyzing stocks for your plan...</span>
          </div>
        ) : aiRecs ? (
          <div>
            <div style={{ fontSize: 'var(--text-base)', lineHeight: 1.8, color: 'var(--color-text-primary)', whiteSpace: 'pre-wrap' }}>
              {aiRecs.split(/(\*\*[^*]+\*\*)/).map((part, i) => {
                if (part.startsWith('**') && part.endsWith('**')) {
                  const inner = part.slice(2, -2)
                  const tickerMatch = inner.match(/^([A-Z]{1,5})/)
                  return (
                    <strong key={i} style={{ color: 'var(--color-gold)' }}>
                      {tickerMatch ? (
                        <span style={{ cursor: 'pointer' }} onClick={() => navigate(`/markets/${tickerMatch[1]}`)}>{inner}</span>
                      ) : inner}
                    </strong>
                  )
                }
                return part
              })}
            </div>
            <button className="btn btn-ghost" onClick={fetchAiRecommendations} style={{ fontSize: 'var(--text-sm)', marginTop: '0.75rem' }}>
              Refresh Recommendations
            </button>
          </div>
        ) : (
          <button className="btn btn-primary" onClick={fetchAiRecommendations} style={{ fontSize: 'var(--text-sm)' }}>
            Get AI Recommendations
          </button>
        )}
      </div>

      {/* Monthly Action */}
      <div className="card" style={{ borderLeft: '3px solid var(--color-gold)' }}>
        <span className="label-caps" style={{ display: 'block', marginBottom: 'var(--space-xs)' }}>This Month's Action</span>
        <p style={{ fontSize: 'var(--text-base)', color: 'var(--color-text-primary)' }}>
          Invest <span className="mono" style={{ fontWeight: 600 }}>${parseInt(monthlyInvestment).toLocaleString()}</span> before {endOfMonth}.
        </p>
        <button className="btn btn-ghost" style={{ marginTop: 'var(--space-sm)', fontSize: 'var(--text-sm)' }} onClick={() => navigate('/markets')}>
          Browse Markets →
        </button>
      </div>
    </div>
  )
}
