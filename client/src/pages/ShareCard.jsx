import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { api } from '../hooks/useApi'
import { gradeColor, gradeBg } from '../utils/grades'

export default function ShareCard() {
  const { token } = useParams()
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get(`/api/share/score/${token}`)
      .then(res => setData(res.data.data))
      .catch(() => setError('Score not found or link has expired.'))
      .finally(() => setLoading(false))
  }, [token])

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--color-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-base)' }}>Loading...</p>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--color-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <p style={{ color: 'var(--color-negative)', fontSize: 'var(--text-lg)', marginBottom: '1rem' }}>{error || 'Score not found.'}</p>
          <a href="/" style={{ color: 'var(--color-gold)', fontSize: 'var(--text-base)' }}>Go to Atlas</a>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
      {/* Logo */}
      <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
        <span style={{ fontFamily: 'var(--font-serif)', fontSize: 42, color: 'var(--color-gold)' }}>Atlas</span>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-xs)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Financial Health Score</p>
      </div>

      {/* Score Card */}
      <div style={{
        background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 2,
        padding: '2rem', maxWidth: 420, width: '100%', textAlign: 'center',
      }}>
        {/* Big Score */}
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: '0.35rem', marginBottom: '0.75rem' }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '4rem', fontWeight: 700, color: 'var(--color-navy)' }}>{data.score}</span>
          <span style={{ fontSize: 'var(--text-2xl)', color: 'var(--color-text-muted)' }}>/ 100</span>
        </div>

        {/* Progress bar */}
        <div style={{ maxWidth: 300, margin: '0 auto 1rem' }}>
          <div style={{ height: 12, borderRadius: 6, background: 'var(--color-border)', overflow: 'hidden' }}>
            <div style={{
              width: `${data.score}%`, height: '100%', borderRadius: 6,
              background: data.score >= 70 ? 'var(--color-positive)' : data.score >= 50 ? 'var(--color-gold)' : 'var(--color-negative)',
              transition: 'width 0.5s',
            }} />
          </div>
        </div>

        {/* Grade */}
        <span style={{
          display: 'inline-block', fontSize: 'var(--text-xl)', fontWeight: 700, color: gradeColor(data.grade),
          padding: '0.3rem 1rem', background: gradeBg(data.grade),
          border: `1px solid ${gradeColor(data.grade)}`, borderRadius: 2, marginBottom: '1.5rem',
        }}>
          {data.grade}
        </span>

        {/* Categories */}
        <div style={{ textAlign: 'left', marginTop: '1rem' }}>
          {data.categories?.map((cat, i) => (
            <div key={cat.name} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '0.5rem 0',
              borderBottom: i < data.categories.length - 1 ? '1px solid var(--color-border)' : 'none',
            }}>
              <div style={{ flex: 1 }}>
                <span style={{ fontSize: 'var(--text-base)', color: 'var(--color-text-primary)' }}>{cat.name}</span>
                <div style={{ height: 4, borderRadius: 2, background: 'var(--color-border)', overflow: 'hidden', marginTop: '0.25rem', maxWidth: 150 }}>
                  <div style={{
                    width: `${(cat.score / cat.maxScore) * 100}%`, height: '100%', borderRadius: 2,
                    background: gradeColor(cat.grade),
                  }} />
                </div>
              </div>
              <span style={{ fontSize: 'var(--text-lg)', fontWeight: 700, color: gradeColor(cat.grade), minWidth: 28, textAlign: 'right' }}>
                {cat.grade}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div style={{ textAlign: 'center', marginTop: '2rem' }}>
        <h2 style={{ fontSize: 'var(--text-xl)', marginBottom: '0.5rem', color: 'var(--color-navy)' }}>
          Check Your Financial Health
        </h2>
        <p style={{ fontSize: 'var(--text-base)', color: 'var(--color-text-secondary)', marginBottom: '1rem' }}>
          Take the free quiz and get your personalized score.
        </p>
        <a href="/" style={{
          display: 'inline-block', padding: '0.75rem 2rem', background: 'var(--color-navy)', color: 'var(--color-gold)',
          borderRadius: 2, fontSize: 'var(--text-base)', fontWeight: 600, textDecoration: 'none',
          textTransform: 'uppercase', letterSpacing: '0.06em',
        }}>
          Join Atlas Free
        </a>
      </div>
    </div>
  )
}
