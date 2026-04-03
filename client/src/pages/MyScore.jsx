import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import useApi, { api } from '../hooks/useApi'
import { gradeColor, gradeBg } from '../utils/grades'
import LoadingSpinner from '../components/LoadingSpinner'
import ErrorBanner from '../components/ErrorBanner'
import { useToast } from '../components/Toast'

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

  const fetchScore = async (force = false) => {
    if (force) setRecalculating(true)
    else setLoading(true)
    setError(null)
    try {
      const [scoreRes, posRes, txRes, goalRes] = await Promise.all([
        get(`/api/insights/health-score${force ? '?force=true' : ''}`),
        get('/api/portfolio/positions'),
        get('/api/budget/transactions'),
        get('/api/atlas/current').catch(() => ({ data: null })),
      ])
      setScore(scoreRes.data)
      const positions = posRes.data || []
      const transactions = txRes.data || []
      const goals = goalRes.data ? [goalRes.data] : []
      setHasRealData(positions.length > 0 || transactions.length > 0 || goals.length > 0)
    } catch (err) {
      setError(err.message)
    }
    setLoading(false)
    setRecalculating(false)
  }

  useEffect(() => { fetchScore() }, [])

  if (loading) return <LoadingSpinner height={200} />
  if (error) return <ErrorBanner message={error} onRetry={() => fetchScore()} />

  if (!hasRealData) {
    return (
      <div>
        <h1 style={{ fontSize: 'var(--text-3xl)', marginBottom: 'var(--space-lg)' }}>My Score</h1>
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
        <h1 style={{ fontSize: 'var(--text-3xl)', marginBottom: 'var(--space-lg)' }}>My Score</h1>
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h1 style={{ fontSize: 'var(--text-3xl)' }}>My Score</h1>
          <button className="btn btn-ghost" onClick={() => fetchScore(true)} disabled={recalculating} style={{ fontSize: 'var(--text-sm)' }}>
            {recalculating ? 'Checking...' : 'Check for Updates'}
          </button>
        </div>

        <div className="card" style={{ textAlign: 'center', marginBottom: '1rem' }}>
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

        <div style={{ background: 'var(--color-gold-15)', border: '1px solid var(--color-gold-30)', borderRadius: 2, padding: '0.65rem 0.85rem', marginBottom: '1rem', fontSize: 'var(--text-sm)', color: 'var(--color-gold)' }}>
          This is a baseline score from your quiz answers. Import a bank CSV or add portfolio positions to unlock your full numerical score.
        </div>

        <div className="card" style={{ marginBottom: '1rem' }}>
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
          <div className="card">
            <p style={{ fontSize: 'var(--text-base)', color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>{score.aiSummary}</p>
          </div>
        )}
      </div>
    )
  }

  // Full numerical view
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: 'var(--text-3xl)' }}>My Score</h1>
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

      {/* Big Score */}
      <div className="card" style={{ textAlign: 'center', marginBottom: '1rem' }}>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>Financial Health Score</p>
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
          Calculated from your savings rate, portfolio health, budget adherence, debt load, and goal progress.
        </p>
      </div>

      {/* Category Breakdown */}
      <div className="card" style={{ marginBottom: '1rem' }}>
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
        <div className="card">
          <p style={{ fontSize: 'var(--text-base)', color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
            {score.aiSummary}
          </p>
        </div>
      )}
    </div>
  )
}
