export default function Plan() {
  return (
    <div>
      <h1 style={{ marginBottom: 'var(--space-sm)' }}>My Plan</h1>
      <div className="card" style={{ marginTop: 'var(--space-lg)', textAlign: 'center', padding: 'var(--space-2xl)' }}>
        <p style={{ fontSize: 'var(--text-lg)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-sm)' }}>
          Your financial roadmap is coming soon.
        </p>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-base)' }}>
          Set a target number, and Atlas will show you how to get there.
        </p>
      </div>
    </div>
  )
}
