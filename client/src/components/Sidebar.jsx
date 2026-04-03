import { NavLink } from 'react-router-dom'

const navItems = [
  { path: '/', label: 'Dashboard', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
  { path: '/markets', label: 'Markets', icon: 'M13 7h8m0 0v8m0-8l-8 8-4-4-6 6' },
  { path: '/portfolio', label: 'Portfolio', icon: 'M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z' },
  { path: '/plan', label: 'My Plan', icon: 'M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z' },
  { path: '/analytics', label: 'Analytics', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
  { path: '/budget', label: 'Budget', icon: 'M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z' },
  { path: '/atlas', label: 'Ask Atlas', icon: 'M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l5.447 2.724A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7' },
  { path: '/score', label: 'My Score', icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' },
  { path: '/settings', label: 'Settings', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065zM15 12a3 3 0 11-6 0 3 3 0 016 0z' },
]

export default function Sidebar({ open, onClose }) {
  return (
    <>
      {/* Mobile backdrop */}
      {open && (
        <div
          className="sidebar-backdrop"
          onClick={onClose}
          style={{
            display: 'none', position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.5)', zIndex: 98,
          }}
        />
      )}

      <aside className={`sidebar ${open ? 'sidebar-open' : ''}`} style={{
        background: 'var(--color-navy)',
        width: 200,
        position: 'fixed',
        top: 48,
        left: 0,
        bottom: 0,
        display: 'flex',
        flexDirection: 'column',
        borderRight: '1px solid var(--color-gold-15)',
        zIndex: 99,
        transition: 'transform 0.2s ease',
      }}>
        <nav style={{ flex: 1, paddingTop: '0.5rem' }}>
          {navItems.map(item => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              onClick={onClose}
              className={({ isActive }) => `sidebar-link${isActive ? ' sidebar-active' : ''}`}
              style={({ isActive }) => ({
                display: 'flex',
                alignItems: 'center',
                gap: '0.65rem',
                padding: '0.55rem 1rem',
                margin: '0.1rem 0.5rem',
                color: isActive ? 'var(--color-gold)' : 'var(--color-gold-60)',
                background: isActive ? 'var(--color-sidebar-hover)' : 'transparent',
                borderLeft: isActive ? '2px solid var(--color-gold)' : '2px solid transparent',
                fontSize: 'var(--text-sm)',
                fontWeight: isActive ? 500 : 400,
                letterSpacing: '0.03em',
                textTransform: 'uppercase',
                transition: 'all 0.1s ease',
                textDecoration: 'none',
                borderRadius: 0,
              })}
            >
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                <path d={item.icon} />
              </svg>
              {item.label}
              {item.path === '/markets' && (() => {
                const ts = parseInt(localStorage.getItem('atlas_screener_ts') || '0')
                const fresh = Date.now() - ts < 15 * 60 * 1000
                return (
                  <span style={{
                    marginLeft: 'auto',
                    width: 6, height: 6,
                    borderRadius: '50%',
                    background: fresh ? 'var(--color-positive)' : 'var(--color-text-muted)',
                    flexShrink: 0,
                  }} />
                )
              })()}
            </NavLink>
          ))}
        </nav>
        <div style={{
          padding: '0.75rem 1rem',
          color: 'var(--color-gold-40)',
          fontSize: 'var(--text-xs)',
          lineHeight: 1.4,
          borderTop: '1px solid var(--color-gold-15)',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}>
          For informational purposes only.
          <br />Not financial advice.
        </div>
      </aside>
    </>
  )
}
