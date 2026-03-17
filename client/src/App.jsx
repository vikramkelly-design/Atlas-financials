import { useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Budget from './pages/Budget'
import Portfolio from './pages/Portfolio'
import Markets from './pages/Markets'
import Analytics from './pages/Analytics'
import Atlas from './pages/Atlas'
import Login from './pages/Login'

export default function App() {
  const [user, setUser] = useState(() => {
    const token = localStorage.getItem('ledger_token')
    const saved = localStorage.getItem('ledger_user')
    if (token && saved) {
      try { return JSON.parse(saved) } catch {}
    }
    return null
  })

  if (!user) {
    return <Login onAuth={setUser} />
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/budget" element={<Budget />} />
          <Route path="/portfolio" element={<Portfolio />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/markets" element={<Markets />} />
          <Route path="/atlas" element={<Atlas />} />
        </Route>
        <Route path="/login" element={<Navigate to="/" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
