import { useState, useEffect } from 'react'
import useApi from '../hooks/useApi'
import LoadingSpinner from '../components/LoadingSpinner'
import ErrorBanner from '../components/ErrorBanner'

export default function MyScore() {
  const { get } = useApi()
  const [score, setScore] = useState(null)
  const [loading, setLoading] = useState(true)
  const [recalculating, setRecalculating] = useState(false)
  const [error, setError] = useState(null)

  const fetchScore = async (force = false) => {
    if (force) setRecalculating(true)
    else setLoading(true)
    setError(null)
    try {
      const res = await get(`/api/insights/health-score${force ? '?force=true' : ''}`)
      setScore(res.data)
    } catch (err) {
      setError(err.message)
    }
    setLoading(false)
    setRecalculating(false)
  }

  useEffect(() => { fetchScore() }, [])

  const gradeColor = (grade) => {
    if (grade === 'A' || grade === 'B+') return '#2A5C3A'
    if (grade === 'B' || grade === 'C+') return '#8B6A2A'
    return '#8B3A2A'
  }

  const gradeBg = (grade) => {
    if (grade === 'A' || grade === 'B+') return '#E8F5E8'
    if (grade === 'B' || grade === 'C+') return '#FFF8E8'
    return '#F5E8E8'
  }

  if (loading) return <LoadingSpinner height={200} />
  if (error) return <ErrorBanner message={error} onRetry={() => fetchScore()} />

  if (!score) {
    return (
      <div>
        <h1 style={{ fontSize: '1.75rem', marginBottom: '1.5rem' }}>My Score</h1>
        <div className="card" style={{ textAlign: 'center', padding: '2rem' }}>
          <p className="text-muted" style={{ fontSize: '0.9rem' }}>Complete the onboarding quiz to get your score.</p>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.75rem' }}>My Score</h1>
        <button
          className="btn btn-ghost"
          onClick={() => fetchScore(true)}
          disabled={recalculating}
          style={{ fontSize: '0.8rem' }}
        >
          {recalculating ? 'Recalculating...' : 'Recalculate'}
        </button>
      </div>

      {/* Big Score */}
      <div className="card" style={{ textAlign: 'center', marginBottom: '1rem' }}>
        <p style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>Financial Health Score</p>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: '0.35rem', marginBottom: '0.75rem' }}>
          <span className="mono" style={{ fontSize: '4rem', fontWeight: 700, color: '#1B2A4A' }}>{score.score}</span>
          <span style={{ fontSize: '1.5rem', color: 'var(--color-text-faint)' }}>/ 100</span>
        </div>
        <div style={{ maxWidth: 350, margin: '0 auto 1rem' }}>
          <div style={{ height: 12, borderRadius: 6, background: 'var(--color-surface-2)', overflow: 'hidden' }}>
            <div style={{
              width: `${score.score}%`, height: '100%', borderRadius: 6,
              background: score.score >= 70 ? '#2A5C3A' : score.score >= 50 ? '#C9A84C' : '#8B3A2A',
              transition: 'width 0.5s',
            }} />
          </div>
        </div>
        <span style={{
          fontSize: '1.3rem', fontWeight: 700, color: gradeColor(score.grade),
          padding: '0.3rem 1rem', background: gradeBg(score.grade),
          border: `1px solid ${gradeColor(score.grade)}`, borderRadius: 2,
        }}>
          {score.grade}
        </span>
      </div>

      {/* Category Breakdown */}
      <div className="card" style={{ marginBottom: '1rem' }}>
        <h3 style={{ fontSize: '0.95rem', marginBottom: '0.75rem' }}>Breakdown</h3>
        {score.categories?.map((cat, i) => (
          <div key={cat.name} style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '0.65rem 0',
            borderBottom: i < score.categories.length - 1 ? '1px solid var(--color-border)' : 'none',
          }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                <span style={{ fontSize: '0.9rem', fontWeight: 500, color: 'var(--color-text)' }}>{cat.name}</span>
                <span className="mono text-faint" style={{ fontSize: '0.75rem' }}>{cat.score}/{cat.maxScore}</span>
              </div>
              {cat.summary && (
                <p className="text-faint" style={{ fontSize: '0.75rem' }}>{cat.summary}</p>
              )}
              <div style={{ height: 6, borderRadius: 3, background: 'var(--color-surface-2)', overflow: 'hidden', marginTop: '0.35rem', maxWidth: 200 }}>
                <div style={{
                  width: `${(cat.score / cat.maxScore) * 100}%`, height: '100%', borderRadius: 3,
                  background: gradeColor(cat.grade),
                }} />
              </div>
            </div>
            <span style={{
              fontSize: '1.1rem', fontWeight: 700, color: gradeColor(cat.grade),
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
          <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', lineHeight: 1.6 }}>
            {score.aiSummary}
          </p>
        </div>
      )}
    </div>
  )
}
