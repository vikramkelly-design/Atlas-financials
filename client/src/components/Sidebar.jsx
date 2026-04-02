import { NavLink } from 'react-router-dom'

const navItems = [
  { path: '/', label: 'Dashboard', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
  { path: '/markets', label: 'Markets', icon: 'M13 7h8m0 0v8m0-8l-8 8-4-4-6 6' },
  { path: '/portfolio', label: 'Portfolio', icon: 'M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z' },
  { path: '/analytics', label: 'Analytics', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
  { path: '/budget', label: 'Budget', icon: 'M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z' },
  { path: '/atlas', label: 'Ask Atlas', icon: 'M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l5.447 2.724A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7' },
  { path: '/score', label: 'My Score', icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' },
  { path: '/badges', label: 'Progress', icon: 'M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z' },
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
        background: 'var(--color-primary)',
        width: 200,
        position: 'fixed',
        top: 48,
        left: 0,
        bottom: 0,
        display: 'flex',
        flexDirection: 'column',
        borderRight: '1px solid var(--color-accent-15)',
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
                color: isActive ? 'var(--color-accent)' : 'var(--color-accent-60)',
                background: isActive ? 'var(--color-primary-hover)' : 'transparent',
                borderLeft: isActive ? '2px solid var(--color-accent)' : '2px solid transparent',
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
                const count = parseInt(localStorage.getItem('atlas_undervalued_count') || '0')
                return count > 0 ? (
                  <span style={{
                    marginLeft: 'auto',
                    fontSize: 'var(--text-xs)',
                    background: 'var(--color-success)',
                    color: '#fff',
                    padding: '0 0.35rem',
                    borderRadius: 2,
                    fontWeight: 600,
                    lineHeight: '1.4',
                  }}>
                    {count}
                  </span>
                ) : null
              })()}
            </NavLink>
          ))}
        </nav>
        <div style={{
          padding: '0.75rem 1rem',
          color: 'var(--color-accent-40)',
          fontSize: 'var(--text-xs)',
          lineHeight: 1.4,
          borderTop: '1px solid var(--color-accent-15)',
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
