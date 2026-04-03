export default function EmptyState({ icon, title, description, actionLabel, onAction }) {
  return (
    <div className="card" style={{ padding: '2.5rem 2rem', textAlign: 'center' }}>
      {icon && (
        <svg
          width="40"
          height="40"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--color-gold)"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ marginBottom: '1rem' }}
        >
          <path d={icon} />
        </svg>
      )}
      <h3
        style={{
          fontSize: 'var(--text-xl)',
          color: 'var(--color-text-primary)',
          marginBottom: '0.5rem',
        }}
      >
        {title}
      </h3>
      {description && (
        <p
          style={{
            fontSize: 'var(--text-base)',
            color: 'var(--color-text-secondary)',
            maxWidth: '400px',
            margin: '0 auto',
          }}
        >
          {description}
        </p>
      )}
      {actionLabel && onAction && (
        <button
          className="btn btn-primary"
          onClick={onAction}
          style={{ marginTop: '1.5rem' }}
        >
          {actionLabel}
        </button>
      )}
    </div>
  )
}
