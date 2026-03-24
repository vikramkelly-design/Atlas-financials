import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import Navbar from './Navbar'
import Sidebar from './Sidebar'
import ChatBot from './ChatBot'

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div>
      <Navbar onMenuToggle={() => setSidebarOpen(o => !o)} />
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <main className="main-content" style={{
        marginLeft: 200,
        marginTop: 48,
        padding: '1.25rem 1.5rem',
        minHeight: 'calc(100vh - 48px)'
      }}>
        <Outlet />
      </main>
      <ChatBot />
    </div>
  )
}
