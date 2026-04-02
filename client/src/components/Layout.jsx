import { useState, useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import Navbar from './Navbar'
import Sidebar from './Sidebar'
import ChatBot from './ChatBot'

const PAGE_TITLES = {
  '/': 'Dashboard',
  '/budget': 'Budget',
  '/portfolio': 'Portfolio',
  '/analytics': 'Analytics',
  '/markets': 'Markets',
  '/atlas': 'Atlas',
  '/badges': 'Badges',
  '/score': 'My Score',
  '/settings': 'Settings',
}

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const location = useLocation()

  useEffect(() => {
    const title = PAGE_TITLES[location.pathname] || 'Atlas'
    document.title = `${title} | Atlas Finance Terminal`
  }, [location.pathname])

  return (
    <div>
      <a href="#main-content" className="skip-link">Skip to content</a>
      <Navbar onMenuToggle={() => setSidebarOpen(o => !o)} />
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <main id="main-content" className="main-content" style={{ minHeight: 'calc(100vh - 48px)' }}>
        <Outlet />
      </main>
      <ChatBot />
    </div>
  )
}
