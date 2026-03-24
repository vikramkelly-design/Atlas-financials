export default function Navbar({ onMenuToggle }) {
  const user = JSON.parse(localStorage.getItem('ledger_user') || '{}')

  const handleLogout = () => {
    localStorage.removeItem('ledger_token')
    localStorage.removeItem('ledger_user')
    window.location.href = '/login'
  }

  return (
    <nav style={{
      background: '#1B2A4A',
      height: 48,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 1.25rem',
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      zIndex: 100,
      borderBottom: '1px solid rgba(201, 168, 76, 0.15)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        {/* Hamburger — visible on mobile only */}
        {onMenuToggle && (
          <button
            className="hamburger-btn"
            onClick={onMenuToggle}
            style={{
              display: 'none', background: 'none', border: 'none',
              color: '#C9A84C', fontSize: '1.25rem', cursor: 'pointer', padding: '0.25rem',
            }}
          >
            <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        )}
        <span style={{
          fontFamily: "'Allura', cursive",
          fontSize: 28,
          color: '#C9A84C',
          lineHeight: 1,
        }}>
          Atlas
        </span>
        <span className="nav-subtitle" style={{
          fontSize: '0.55rem',
          color: 'rgba(201, 168, 76, 0.4)',
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          borderLeft: '1px solid rgba(201, 168, 76, 0.2)',
          paddingLeft: '0.75rem',
        }}>
          Finance Terminal
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <span className="nav-username" style={{ color: 'rgba(201, 168, 76, 0.6)', fontSize: '0.75rem', fontFamily: "'DM Mono', monospace" }}>
          {user.name || user.email || 'Guest'}
        </span>
        <button onClick={handleLogout} style={{
          background: 'transparent', border: '1px solid rgba(201, 168, 76, 0.3)', borderRadius: 2,
          color: '#C9A84C', fontSize: '0.65rem', padding: '0.2rem 0.55rem',
          cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.06em',
          transition: 'all 0.1s',
        }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = '#C9A84C'; e.currentTarget.style.background = 'rgba(201, 168, 76, 0.1)' }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(201, 168, 76, 0.3)'; e.currentTarget.style.background = 'transparent' }}
        >
          Logout
        </button>
      </div>
    </nav>
  )
}
