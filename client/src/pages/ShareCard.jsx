import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { api } from '../hooks/useApi'

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

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#FFFCF5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: '#B89090', fontSize: '0.85rem' }}>Loading...</p>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div style={{ minHeight: '100vh', background: '#FFFCF5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <p style={{ color: '#8B3A2A', fontSize: '1rem', marginBottom: '1rem' }}>{error || 'Score not found.'}</p>
          <a href="/" style={{ color: '#C9A84C', fontSize: '0.85rem' }}>Go to Atlas</a>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#FFFCF5', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
      {/* Logo */}
      <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
        <span style={{ fontFamily: "'Allura', cursive", fontSize: 42, color: '#C9A84C' }}>Atlas</span>
        <p style={{ color: '#B89090', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Financial Health Score</p>
      </div>

      {/* Score Card */}
      <div style={{
        background: '#FFF8F0', border: '1px solid #E8DDD0', borderRadius: 2,
        padding: '2rem', maxWidth: 420, width: '100%', textAlign: 'center',
      }}>
        {/* Big Score */}
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: '0.35rem', marginBottom: '0.75rem' }}>
          <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '4rem', fontWeight: 700, color: '#1B2A4A' }}>{data.score}</span>
          <span style={{ fontSize: '1.5rem', color: '#B89090' }}>/ 100</span>
        </div>

        {/* Progress bar */}
        <div style={{ maxWidth: 300, margin: '0 auto 1rem' }}>
          <div style={{ height: 12, borderRadius: 6, background: '#E8DDD0', overflow: 'hidden' }}>
            <div style={{
              width: `${data.score}%`, height: '100%', borderRadius: 6,
              background: data.score >= 70 ? '#2A5C3A' : data.score >= 50 ? '#C9A84C' : '#8B3A2A',
              transition: 'width 0.5s',
            }} />
          </div>
        </div>

        {/* Grade */}
        <span style={{
          display: 'inline-block', fontSize: '1.3rem', fontWeight: 700, color: gradeColor(data.grade),
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
              borderBottom: i < data.categories.length - 1 ? '1px solid #E8DDD0' : 'none',
            }}>
              <div style={{ flex: 1 }}>
                <span style={{ fontSize: '0.85rem', color: '#6B1A1A' }}>{cat.name}</span>
                <div style={{ height: 4, borderRadius: 2, background: '#E8DDD0', overflow: 'hidden', marginTop: '0.25rem', maxWidth: 150 }}>
                  <div style={{
                    width: `${(cat.score / cat.maxScore) * 100}%`, height: '100%', borderRadius: 2,
                    background: gradeColor(cat.grade),
                  }} />
                </div>
              </div>
              <span style={{ fontSize: '0.95rem', fontWeight: 700, color: gradeColor(cat.grade), minWidth: 28, textAlign: 'right' }}>
                {cat.grade}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div style={{ textAlign: 'center', marginTop: '2rem' }}>
        <h2 style={{ fontSize: '1.25rem', marginBottom: '0.5rem', color: '#1B2A4A' }}>
          Check Your Financial Health
        </h2>
        <p style={{ fontSize: '0.85rem', color: '#8B3A3A', marginBottom: '1rem' }}>
          Take the free quiz and get your personalized score.
        </p>
        <a href="/" style={{
          display: 'inline-block', padding: '0.75rem 2rem', background: '#1B2A4A', color: '#C9A84C',
          borderRadius: 2, fontSize: '0.85rem', fontWeight: 600, textDecoration: 'none',
          textTransform: 'uppercase', letterSpacing: '0.06em',
        }}>
          Join Atlas Free
        </a>
      </div>
    </div>
  )
}
