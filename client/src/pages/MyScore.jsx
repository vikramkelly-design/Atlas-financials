import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import useApi, { api } from '../hooks/useApi'
import { gradeColor, gradeBg } from '../utils/grades'
import LoadingSpinner from '../components/LoadingSpinner'
import ErrorBanner from '../components/ErrorBanner'
import { useToast } from '../components/Toast'

const CREDENTIALS = [
  { id: 'first_holding', name: 'Investor', description: 'Added your first portfolio holding', icon: '📈' },
  { id: 'first_dcf', name: 'Value Analyst', description: 'Viewed a full DCF breakdown on a stock', icon: '🔍' },
  { id: 'plan_set', name: 'Planner', description: 'Created your Atlas financial plan', icon: '🎯' },
  { id: 'budget_3months', name: 'Disciplined', description: 'Stayed under budget 3 months in a row', icon: '🏆' },
  { id: 'watchlist_10', name: 'Analyst', description: 'Added 10 or more stocks to your watchlist', icon: '👁' },
  { id: 'first_undervalued_buy', name: 'Contrarian', description: 'Added a stock when it was undervalued', icon: '⚖️' },
  { id: 'long_hold', name: 'Long Game', description: 'Held a portfolio position for 12+ months', icon: '⏳' },
]

function formatDate(d) {
  if (!d) return null
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function MyScore() {
  const { get } = useApi()
  const { toast } = useToast()
  const navigate = useNavigate()
  const [score, setScore] = useState(null)
  const [hasRealData, setHasRealData] = useState(false)
  const [loading, setLoading] = useState(true)
  const [recalculating, setRecalculating] = useState(false)
  const [error, setError] = useState(null)
  const [sharing, setSharing] = useState(false)
  const [credentials, setCredentials] = useState([])

  const fetchScore = async (force = false) => {
    if (force) setRecalculating(true)
    else setLoading(true)
    setError(null)
    try {
      const [scoreRes, posRes, txRes, goalRes, flagsRes, planRes, watchlistRes] = await Promise.all([
        get(`/api/insights/health-score${force ? '?force=true' : ''}`).catch(() => ({ data: null })),
        get('/api/portfolio/positions').catch(() => ({ data: [] })),
        get('/api/budget/transactions').catch(() => ({ data: [] })),
        get('/api/atlas/current').catch(() => ({ data: null })),
        get('/api/settings/flags').catch(() => ({ data: {} })),
        get('/api/plan').catch(() => ({ data: null })),
        get('/api/watchlist').catch(() => ({ data: [] })),
      ])
      setScore(scoreRes.data)
      const positions = posRes.data || []
      const transactions = txRes.data || []
      const goals = goalRes.data ? [goalRes.data] : []
      const flags = flagsRes.data || {}
      const plan = planRes.data
      const watchlist = watchlistRes.data || []

      setHasRealData(positions.length > 0 || transactions.length > 0 || goals.length > 0)

      // Build credentials
      const firstHolding = positions.length > 0
      const firstHoldingDate = firstHolding && positions[0]?.created_at ? positions[0].created_at : null

      // Check for long hold (12+ months)
      const now = new Date()
      const hasLongHold = positions.some(p => {
        if (!p.created_at) return false
        const created = new Date(p.created_at)
        const diffMs = now - created
        return diffMs >= 365 * 24 * 60 * 60 * 1000
      })

      // Budget streak: check last 3 months
      let budgetStreak = 0
      try {
        const budgetGoals = await get('/api/budget/goals').catch(() => ({ data: [] }))
        const goals = budgetGoals.data || []
        if (goals.length > 0) {
          for (let i = 1; i <= 3; i++) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
            const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
            const monthTxRes = await get(`/api/budget/transactions?month=${month}`).catch(() => ({ data: [] }))
            const monthTx = (monthTxRes.data || []).filter(t => t.amount < 0)
            const byCategory = {}
            monthTx.forEach(t => {
              const cat = t.category || 'Other'
              byCategory[cat] = (byCategory[cat] || 0) + Math.abs(t.amount)
            })
            const underBudget = goals.every(g => (byCategory[g.category] || 0) <= g.monthly_limit)
            if (underBudget) budgetStreak++
            else break
          }
        }
      } catch {}

      setCredentials(CREDENTIALS.map(cred => {
        switch (cred.id) {
          case 'first_holding':
            return { ...cred, earned: firstHolding, earnedDate: firstHoldingDate }
          case 'first_dcf':
            return { ...cred, earned: !!flags.has_viewed_dcf, earnedDate: flags.first_dcf_date }
          case 'plan_set':
            return { ...cred, earned: plan !== null, earnedDate: plan?.created_at }
          case 'budget_3months':
            return { ...cred, earned: budgetStreak >= 3, earnedDate: null }
          case 'watchlist_10':
            return { ...cred, earned: watchlist.length >= 10, earnedDate: null }
          case 'first_undervalued_buy':
            return { ...cred, earned: !!flags.has_bought_undervalued, earnedDate: null }
          case 'long_hold':
            return { ...cred, earned: hasLongHold, earnedDate: null }
          default:
            return { ...cred, earned: false, earnedDate: null }
        }
      }))
    } catch (err) {
      setError(err.message)
    }
    setLoading(false)
    setRecalculating(false)
  }

  useEffect(() => { fetchScore() }, [])

  if (loading) return <LoadingSpinner height={200} />
  if (error) return <ErrorBanner message={error} onRetry={() => fetchScore()} />

  const earnedCount = credentials.filter(c => c.earned).length

  if (!hasRealData) {
    return (
      <div>
        <h1 style={{ fontSize: 'var(--text-3xl)', marginBottom: 4 }}>My Score</h1>
        <p className="label-caps" style={{ marginBottom: 'var(--space-lg)' }}>Your track record as an investor</p>
        <div className="card" style={{ textAlign: 'center', padding: 'var(--space-2xl)' }}>
          <p style={{ fontFamily: 'var(--font-serif)', fontSize: 18 }}>
            Your financial health score appears once you add your first data.
          </p>
          <p style={{ color: 'var(--color-text-muted)', fontSize: 14, marginTop: 'var(--space-sm)' }}>
            Takes about 2 minutes to set up.
          </p>
          <button className="btn btn-primary" style={{ marginTop: 'var(--space-md)' }} onClick={() => navigate('/portfolio')}>
            Add your first holding →
          </button>
        </div>
      </div>
    )
  }

  if (!score) {
    return (
      <div>
        <h1 style={{ fontSize: 'var(--text-3xl)', marginBottom: 4 }}>My Score</h1>
        <p className="label-caps" style={{ marginBottom: 'var(--space-lg)' }}>Your track record as an investor</p>
        <div className="card" style={{ textAlign: 'center', padding: 'var(--space-2xl)' }}>
          <p style={{ color: 'var(--color-text-secondary)' }}>Score is being calculated. Try recalculating.</p>
          <button className="btn btn-primary" style={{ marginTop: 'var(--space-md)' }} onClick={() => fetchScore(true)}>
            Calculate Score
          </button>
        </div>
      </div>
    )
  }

  // Baseline view (qualitative, no numbers)
  if (score.scoreType === 'baseline') {
    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-lg)' }}>
          <div>
            <h1 style={{ fontSize: 'var(--text-3xl)', marginBottom: 4 }}>My Score</h1>
            <p className="label-caps">Your track record as an investor</p>
          </div>
          <button className="btn btn-ghost" onClick={() => fetchScore(true)} disabled={recalculating} style={{ fontSize: 'var(--text-sm)' }}>
            {recalculating ? 'Checking...' : 'Check for Updates'}
          </button>
        </div>

        <div className="card" style={{ textAlign: 'center', marginBottom: 'var(--space-md)' }}>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>Baseline Assessment</p>
          <div style={{ marginBottom: '0.75rem' }}>
            <span style={{ fontSize: 'var(--text-4xl)', fontWeight: 700, color: 'var(--color-navy)' }}>{score.label}</span>
          </div>
          <span style={{
            fontSize: 'var(--text-xl)', fontWeight: 700, color: gradeColor(score.grade),
            padding: '0.3rem 1rem', background: gradeBg(score.grade),
            border: `1px solid ${gradeColor(score.grade)}`, borderRadius: 2,
          }}>
            {score.grade}
          </span>
        </div>

        <div style={{ background: 'var(--color-gold-15)', border: '1px solid var(--color-gold-30)', borderRadius: 2, padding: '0.65rem 0.85rem', marginBottom: 'var(--space-md)', fontSize: 'var(--text-sm)', color: 'var(--color-gold)' }}>
          This is a baseline score from your quiz answers. Import a bank CSV or add portfolio positions to unlock your full numerical score.
        </div>

        <div className="card" style={{ marginBottom: 'var(--space-md)' }}>
          <h3 style={{ fontSize: 'var(--text-lg)', marginBottom: '0.75rem' }}>Breakdown</h3>
          {score.categories?.map((cat, i) => (
            <div key={cat.name} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '0.65rem 0',
              borderBottom: i < score.categories.length - 1 ? '1px solid var(--color-border)' : 'none',
            }}>
              <div style={{ flex: 1 }}>
                <span style={{ fontSize: 'var(--text-base)', fontWeight: 500, color: 'var(--color-text-primary)' }}>{cat.name}</span>
                {cat.summary && <p className="text-faint" style={{ fontSize: 'var(--text-sm)', marginTop: 2 }}>{cat.summary}</p>}
              </div>
              <span style={{ fontSize: 'var(--text-xl)', fontWeight: 700, color: gradeColor(cat.grade), minWidth: 36, textAlign: 'right' }}>
                {cat.grade}
              </span>
            </div>
          ))}
        </div>

        {score.aiSummary && (
          <div className="card" style={{ marginBottom: 'var(--space-lg)' }}>
            <p style={{ fontSize: 'var(--text-base)', color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>{score.aiSummary}</p>
          </div>
        )}

        {/* Track Record */}
        <TrackRecord credentials={credentials} earnedCount={earnedCount} />
      </div>
    )
  }

  // Full numerical view
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-lg)' }}>
        <div>
          <h1 style={{ fontSize: 'var(--text-3xl)', marginBottom: 4 }}>My Score</h1>
          <p className="label-caps">Your track record as an investor</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            className="btn btn-ghost"
            onClick={async () => {
              setSharing(true)
              try {
                const res = await api.post('/api/insights/share-score')
                const url = `${window.location.origin}/share/score/${res.data.data.token}`
                navigator.clipboard.writeText(url).catch(() => {})
                toast('Share link copied to clipboard!', 'success')
              } catch {}
              setSharing(false)
            }}
            disabled={sharing}
            style={{ fontSize: 'var(--text-sm)' }}
          >
            {sharing ? 'Generating...' : 'Share My Score'}
          </button>
          <button
            className="btn btn-ghost"
            onClick={() => fetchScore(true)}
            disabled={recalculating}
            style={{ fontSize: 'var(--text-sm)' }}
          >
            {recalculating ? 'Recalculating...' : 'Recalculate'}
          </button>
        </div>
      </div>

      {/* Investor Score */}
      <div className="card" style={{ textAlign: 'center', marginBottom: 'var(--space-md)' }}>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>Investor Score</p>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: '0.35rem', marginBottom: '0.75rem' }}>
          <span className="mono" style={{ fontSize: 'var(--text-5xl)', fontWeight: 700, color: 'var(--color-navy)' }}>{score.score}</span>
          <span style={{ fontSize: 'var(--text-2xl)', color: 'var(--color-text-muted)' }}>/ 100</span>
        </div>
        <div style={{ maxWidth: 350, margin: '0 auto 1rem' }}>
          <div style={{ height: 12, borderRadius: 6, background: 'var(--color-surface-2)', overflow: 'hidden' }}>
            <div style={{
              width: `${score.score}%`, height: '100%', borderRadius: 6,
              background: score.score >= 70 ? 'var(--color-positive)' : score.score >= 50 ? 'var(--color-gold)' : 'var(--color-negative)',
              transition: 'width 0.5s',
            }} />
          </div>
        </div>
        <span style={{
          fontSize: 'var(--text-xl)', fontWeight: 700, color: gradeColor(score.grade),
          padding: '0.3rem 1rem', background: gradeBg(score.grade),
          border: `1px solid ${gradeColor(score.grade)}`, borderRadius: 2,
        }}>
          {score.grade}
        </span>
        <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: 'var(--space-md)' }}>
          Reflects your savings rate, investment consistency, budget discipline, and plan progress over the last 90 days.
        </p>
      </div>

      {/* Category Breakdown */}
      <div className="card" style={{ marginBottom: 'var(--space-md)' }}>
        <h3 style={{ fontSize: 'var(--text-lg)', marginBottom: '0.75rem' }}>Breakdown</h3>
        {score.categories?.map((cat, i) => (
          <div key={cat.name} style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '0.65rem 0',
            borderBottom: i < score.categories.length - 1 ? '1px solid var(--color-border)' : 'none',
          }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                <span style={{ fontSize: 'var(--text-base)', fontWeight: 500, color: 'var(--color-text-primary)' }}>{cat.name}</span>
                <span className="mono text-faint" style={{ fontSize: 'var(--text-sm)' }}>{cat.score}/{cat.maxScore}</span>
              </div>
              {cat.summary && (
                <p className="text-faint" style={{ fontSize: 'var(--text-sm)' }}>{cat.summary}</p>
              )}
              <div style={{ height: 6, borderRadius: 3, background: 'var(--color-surface-2)', overflow: 'hidden', marginTop: '0.35rem', maxWidth: 200 }}>
                <div style={{
                  width: `${(cat.score / cat.maxScore) * 100}%`, height: '100%', borderRadius: 3,
                  background: gradeColor(cat.grade),
                }} />
              </div>
            </div>
            <span style={{
              fontSize: 'var(--text-xl)', fontWeight: 700, color: gradeColor(cat.grade),
              minWidth: 36, textAlign: 'right',
            }}>
              {cat.grade}
            </span>
          </div>
        ))}
      </div>

      {/* AI Summary */}
      {score.aiSummary && (
        <div className="card" style={{ marginBottom: 'var(--space-lg)' }}>
          <p style={{ fontSize: 'var(--text-base)', color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
            {score.aiSummary}
          </p>
        </div>
      )}

      {/* Track Record */}
      <TrackRecord credentials={credentials} earnedCount={earnedCount} />
    </div>
  )
}

function TrackRecord({ credentials, earnedCount }) {
  const earned = credentials.filter(c => c.earned)
  const locked = credentials.filter(c => !c.earned)

  return (
    <>
      <div style={{ marginBottom: 'var(--space-md)', marginTop: 'var(--space-lg)' }}>
        <h2 style={{ fontSize: 'var(--text-2xl)', marginBottom: 4 }}>Track Record</h2>
        <p className="label-caps">{earnedCount} of {credentials.length} credentials earned</p>
      </div>

      {earned.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)', marginBottom: 'var(--space-lg)' }}>
          {earned.map(cred => (
            <div key={cred.id} className="card" style={{
              display: 'flex', alignItems: 'center', gap: 'var(--space-md)',
              padding: '0.85rem 1.15rem',
              borderLeft: '3px solid var(--color-gold)',
            }}>
              <span style={{ fontSize: 22, flexShrink: 0 }}>{cred.icon}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--color-text-primary)' }}>{cred.name}</div>
                <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>{cred.description}</div>
              </div>
              {cred.earnedDate && (
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-positive)', whiteSpace: 'nowrap' }}>
                  {formatDate(cred.earnedDate)}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {locked.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
          {locked.map(cred => (
            <div key={cred.id} className="card" style={{
              display: 'flex', alignItems: 'center', gap: 'var(--space-md)',
              padding: '0.85rem 1.15rem',
              opacity: 0.4,
            }}>
              <span style={{ fontSize: 22, flexShrink: 0 }}>{cred.icon}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--color-text-muted)' }}>{cred.name}</div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>{cred.description}</div>
              </div>
              <span style={{ fontSize: 16 }}>🔒</span>
            </div>
          ))}
        </div>
      )}
    </>
  )
}
