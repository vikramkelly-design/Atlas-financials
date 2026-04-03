import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Budget from './pages/Budget'
import Portfolio from './pages/Portfolio'
import Markets from './pages/Markets'
import Analytics from './pages/Analytics'
import Atlas from './pages/Atlas'
import MyScore from './pages/MyScore'
import Badges from './pages/Badges'
import Settings from './pages/Settings'
import Landing from './pages/Landing'
import ShareCard from './pages/ShareCard'
import ForgotPassword from './pages/ForgotPassword'
import Onboarding from './pages/Onboarding'
import Plan from './pages/Plan'
import NotFound from './pages/NotFound'
import SplashScreen from './components/SplashScreen'
import BadgePopup from './components/BadgePopup'
import { ToastProvider } from './components/Toast'
import { api } from './hooks/useApi'

export default function App() {
  // One-time migration from old localStorage keys
  if (localStorage.getItem('ledger_token') && !localStorage.getItem('atlas_token')) {
    localStorage.setItem('atlas_token', localStorage.getItem('ledger_token'))
    localStorage.setItem('atlas_user', localStorage.getItem('ledger_user'))
    localStorage.removeItem('ledger_token')
    localStorage.removeItem('ledger_user')
  }

  const [user, setUser] = useState(() => {
    const token = localStorage.getItem('atlas_token')
    const saved = localStorage.getItem('atlas_user')
    if (token && saved) {
      try { return JSON.parse(saved) } catch {}
    }
    return null
  })
  const [onboarded, setOnboarded] = useState(null) // null = loading, true/false
  const [showSplash, setShowSplash] = useState(false)
  const [earnedBadge, setEarnedBadge] = useState(null)

  useEffect(() => {
    if (!user) { setOnboarded(null); return }
    api.get('/api/insights/onboarding-status')
      .then(res => {
        const completed = res.data.data.completed
        setOnboarded(completed)
        if (completed) setShowSplash(true)
      })
      .catch(() => setOnboarded(true)) // if check fails, skip onboarding
  }, [user])

  const handleSplashComplete = () => {
    setShowSplash(false)
    // Check for new badges after splash
    api.post('/api/badges/check')
      .then(res => {
        const newBadges = res.data.data?.newBadges
        if (newBadges && newBadges.length > 0) setEarnedBadge(newBadges[0])
      })
      .catch(() => {})
  }

  // Public routes accessible without login
  if (!user) {
    return (
      <ToastProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/share/score/:token" element={<ShareCard />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="*" element={<Landing onAuth={(u) => { setUser(u); setOnboarded(null) }} />} />
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    )
  }

  // Still checking onboarding status
  if (onboarded === null) {
    return <SplashScreen onComplete={() => {}} />
  }

  // Show onboarding quiz for new users
  if (!onboarded) {
    return <Onboarding onComplete={() => { setOnboarded(true); setShowSplash(true) }} />
  }

  // Show splash after login or onboarding completion
  if (showSplash) {
    return <SplashScreen onComplete={handleSplashComplete} />
  }

  return (
    <ToastProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/share/score/:token" element={<ShareCard />} />
          <Route element={<Layout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/budget" element={<Budget />} />
            <Route path="/debt" element={<Navigate to="/budget" replace />} />
            <Route path="/portfolio" element={<Portfolio />} />
            <Route path="/plan" element={<Plan />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/markets" element={<Markets />} />
            <Route path="/atlas" element={<Atlas />} />
            <Route path="/badges" element={<Badges />} />
            <Route path="/score" element={<MyScore />} />
            <Route path="/settings" element={<Settings />} />
          </Route>
          <Route path="/challenges" element={<Navigate to="/badges" replace />} />
          <Route path="/login" element={<Navigate to="/" replace />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
        {earnedBadge && <BadgePopup badge={earnedBadge} onClose={() => setEarnedBadge(null)} />}
      </BrowserRouter>
    </ToastProvider>
  )
}
