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
  '/plan': 'My Plan',
  '/settings': 'Settings',
}

const PAGE_SUBTITLES = {
  '/': 'Your financial picture',
  '/markets': 'What\'s worth buying',
  '/portfolio': 'What you own',
  '/budget': 'Your monthly fuel',
  '/analytics': 'How you\'re doing',
  '/plan': 'Your road to the number',
  '/settings': 'Preferences',
}

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const location = useLocation()

  useEffect(() => {
    const title = PAGE_TITLES[location.pathname] || 'Atlas'
    document.title = `${title} | Atlas`
  }, [location.pathname])

  return (
    <div>
      <a href="#main-content" className="skip-link">Skip to content</a>
      <Navbar subtitle={PAGE_SUBTITLES[location.pathname]} onMenuToggle={() => setSidebarOpen(o => !o)} />
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <main id="main-content" className="main-content" style={{ minHeight: 'calc(100vh - 48px)' }}>
        <Outlet />
      </main>
      <ChatBot />
    </div>
  )
}
