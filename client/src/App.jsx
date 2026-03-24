import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Budget from './pages/Budget'
import Portfolio from './pages/Portfolio'
import Markets from './pages/Markets'
import Analytics from './pages/Analytics'
import Atlas from './pages/Atlas'
import DebtPlanner from './pages/DebtPlanner'
import MyScore from './pages/MyScore'
import Login from './pages/Login'
import Onboarding from './pages/Onboarding'
import { api } from './hooks/useApi'

export default function App() {
  const [user, setUser] = useState(() => {
    const token = localStorage.getItem('ledger_token')
    const saved = localStorage.getItem('ledger_user')
    if (token && saved) {
      try { return JSON.parse(saved) } catch {}
    }
    return null
  })
  const [onboarded, setOnboarded] = useState(null) // null = loading, true/false

  useEffect(() => {
    if (!user) { setOnboarded(null); return }
    api.get('/api/insights/onboarding-status')
      .then(res => setOnboarded(res.data.data.completed))
      .catch(() => setOnboarded(true)) // if check fails, skip onboarding
  }, [user])

  if (!user) {
    return <Login onAuth={(u) => { setUser(u); setOnboarded(null) }} />
  }

  // Still checking onboarding status
  if (onboarded === null) {
    return <div style={{ minHeight: '100vh', background: '#FFFCF5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ color: '#B89090', fontSize: '0.85rem' }}>Loading...</p>
    </div>
  }

  // Show onboarding quiz for new users
  if (!onboarded) {
    return <Onboarding onComplete={() => setOnboarded(true)} />
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/budget" element={<Budget />} />
          <Route path="/debt" element={<DebtPlanner />} />
          <Route path="/portfolio" element={<Portfolio />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/markets" element={<Markets />} />
          <Route path="/atlas" element={<Atlas />} />
          <Route path="/score" element={<MyScore />} />
        </Route>
        <Route path="/login" element={<Navigate to="/" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
