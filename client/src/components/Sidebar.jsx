import { NavLink } from 'react-router-dom'

const navItems = [
  { path: '/', label: 'Dashboard', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
  { path: '/budget', label: 'Budget', icon: 'M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z' },
  { path: '/debt', label: 'Debt Planner', icon: 'M19 14l-7 7m0 0l-7-7m7 7V3' },
  { path: '/portfolio', label: 'Portfolio', icon: 'M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z' },
  { path: '/analytics', label: 'Analytics', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
  { path: '/markets', label: 'Markets', icon: 'M13 7h8m0 0v8m0-8l-8 8-4-4-6 6' },
  { path: '/atlas', label: 'Atlas', icon: 'M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l5.447 2.724A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7' },
]

export default function Sidebar() {
  return (
    <aside style={{
      background: '#1B2A4A',
      width: 200,
      position: 'fixed',
      top: 48,
      left: 0,
      bottom: 0,
      display: 'flex',
      flexDirection: 'column',
      borderRight: '1px solid rgba(201, 168, 76, 0.15)',
      zIndex: 99,
    }}>
      <nav style={{ flex: 1, paddingTop: '0.5rem' }}>
        {navItems.map(item => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/'}
            className={({ isActive }) => isActive ? 'sidebar-active' : ''}
            style={({ isActive }) => ({
              display: 'flex',
              alignItems: 'center',
              gap: '0.65rem',
              padding: '0.55rem 1rem',
              margin: '0.1rem 0.5rem',
              color: isActive ? '#C9A84C' : 'rgba(201, 168, 76, 0.6)',
              background: isActive ? '#243555' : 'transparent',
              borderLeft: isActive ? '2px solid #C9A84C' : '2px solid transparent',
              fontSize: '0.78rem',
              fontWeight: isActive ? 500 : 400,
              letterSpacing: '0.03em',
              textTransform: 'uppercase',
              transition: 'all 0.1s ease',
              textDecoration: 'none',
              borderRadius: 0,
            })}
            onMouseEnter={e => {
              if (!e.currentTarget.classList.contains('sidebar-active'))
                e.currentTarget.style.background = '#1F3057'
            }}
            onMouseLeave={e => {
              if (!e.currentTarget.classList.contains('sidebar-active'))
                e.currentTarget.style.background = 'transparent'
            }}
          >
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
              <path d={item.icon} />
            </svg>
            {item.label}
          </NavLink>
        ))}
      </nav>
      <div style={{
        padding: '0.75rem 1rem',
        color: 'rgba(201, 168, 76, 0.4)',
        fontSize: '0.6rem',
        lineHeight: 1.4,
        borderTop: '1px solid rgba(201, 168, 76, 0.15)',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
      }}>
        For informational purposes only.
        <br />Not financial advice.
      </div>
    </aside>
  )
}
