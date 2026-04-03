export default function Navbar({ onMenuToggle, subtitle }) {
  const user = JSON.parse(localStorage.getItem('atlas_user') || '{}')

  const handleLogout = () => {
    localStorage.removeItem('atlas_token')
    localStorage.removeItem('atlas_user')
    window.location.href = '/login'
  }

  return (
    <nav style={{
      background: 'var(--color-navy)',
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
      borderBottom: '1px solid var(--color-gold-15)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        {/* Hamburger — visible on mobile only */}
        {onMenuToggle && (
          <button
            className="hamburger-btn"
            onClick={onMenuToggle}
            aria-label="Toggle navigation menu"
            style={{
              display: 'none', background: 'none', border: 'none',
              color: 'var(--color-gold)', fontSize: '1.25rem', cursor: 'pointer', padding: '0.25rem',
            }}
          >
            <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        )}
        <span style={{
          fontFamily: "var(--font-serif)",
          fontSize: 28,
          color: 'var(--color-gold)',
          lineHeight: 1,
        }}>
          Atlas
        </span>
        {subtitle && (
          <span className="nav-subtitle" style={{
            fontSize: 11,
            color: 'var(--color-text-muted)',
            letterSpacing: '0.04em',
            borderLeft: '1px solid var(--color-gold-20)',
            paddingLeft: '0.75rem',
          }}>
            {subtitle}
          </span>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <span className="nav-username" style={{ color: 'var(--color-gold-60)', fontSize: 'var(--text-sm)', fontFamily: "var(--font-mono)" }}>
          {user.name || user.email || 'Guest'}
        </span>
        <button onClick={handleLogout} aria-label="Log out" style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--color-text-sidebar)', fontSize: 'var(--text-xs)',
          textTransform: 'uppercase', letterSpacing: '0.06em',
          transition: 'color 0.15s',
        }} onMouseEnter={e => e.target.style.color = 'var(--color-gold)'}
           onMouseLeave={e => e.target.style.color = 'var(--color-text-sidebar)'}>
          Logout
        </button>
      </div>
    </nav>
  )
}
