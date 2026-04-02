import { useNavigate } from 'react-router-dom'
import { useEffect } from 'react'

export default function NotFound() {
  const navigate = useNavigate()

  useEffect(() => {
    document.title = '404 | Atlas Finance Terminal'
  }, [])

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-bg)' }}>
      <div style={{ textAlign: 'center', maxWidth: 400, padding: 'var(--space-xl)' }}>
        <span style={{ fontFamily: 'var(--font-brand)', fontSize: 48, color: 'var(--color-accent)' }}>Atlas</span>
        <h1 style={{ fontSize: 'var(--text-4xl)', color: 'var(--color-primary)', marginTop: 'var(--space-md)', marginBottom: 'var(--space-sm)' }}>404</h1>
        <p style={{ fontSize: 'var(--text-lg)', color: 'var(--color-text-muted)', marginBottom: 'var(--space-lg)' }}>
          The page you're looking for doesn't exist.
        </p>
        <button className="btn btn-primary" onClick={() => navigate('/')}>Back to Dashboard</button>
      </div>
    </div>
  )
}
