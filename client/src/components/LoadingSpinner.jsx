export default function LoadingSpinner({ height = 120 }) {
  return (
    <div role="status" aria-busy="true" aria-label="Loading content" style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '0.75rem',
      padding: 'var(--space-md) 0'
    }}>
      <div className="skeleton" style={{ height: height * 0.3, width: '80%' }} />
      <div className="skeleton" style={{ height: height * 0.2, width: '60%' }} />
      <div className="skeleton" style={{ height: height * 0.2, width: '90%' }} />
    </div>
  )
}
