export default function LoadingSpinner({ height = 120 }) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '0.75rem',
      padding: '1rem 0'
    }}>
      <div className="skeleton" style={{ height: height * 0.3, width: '80%' }} />
      <div className="skeleton" style={{ height: height * 0.2, width: '60%' }} />
      <div className="skeleton" style={{ height: height * 0.2, width: '90%' }} />
    </div>
  )
}
