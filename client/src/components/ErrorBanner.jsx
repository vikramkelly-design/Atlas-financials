export default function ErrorBanner({ message, onRetry }) {
  return (
    <div role="alert" style={{
      background: 'var(--color-danger-light)',
      border: '1px solid rgba(139, 58, 42, 0.2)',
      borderRadius: 2,
      padding: '0.85rem 1rem',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 'var(--space-md)'
    }}>
      <span style={{ color: 'var(--color-danger)', fontSize: 'var(--text-base)' }}>
        {message || 'Something went wrong.'}
      </span>
      {onRetry && (
        <button className="btn btn-ghost" onClick={onRetry} style={{ flexShrink: 0 }}>
          Retry
        </button>
      )}
    </div>
  )
}
