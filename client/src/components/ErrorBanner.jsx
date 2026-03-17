export default function ErrorBanner({ message, onRetry }) {
  return (
    <div style={{
      background: '#F5E8E8',
      border: '1px solid rgba(139, 58, 42, 0.2)',
      borderRadius: 2,
      padding: '0.85rem 1rem',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '1rem'
    }}>
      <span style={{ color: '#8B3A2A', fontSize: '0.82rem' }}>
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
