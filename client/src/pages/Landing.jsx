import { useState } from 'react'
import Login from './Login'

const FEATURES = [
  { icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6', title: 'Dashboard', desc: 'Net worth, health score, and spending at a glance' },
  { icon: 'M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z', title: 'Budget', desc: 'Import bank CSVs and track spending with AI categories' },
  { icon: 'M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z', title: 'Portfolio', desc: 'Track stocks, see gains, and get AI analysis' },
  { icon: 'M13 7h8m0 0v8m0-8l-8 8-4-4-6 6', title: 'Markets', desc: 'Stock screener, watchlist, and intrinsic values' },
  { icon: 'M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l5.447 2.724A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7', title: 'Goal Planner', desc: 'Set goals, track milestones, and stay on course' },
  { icon: 'M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z', title: 'AI Coach', desc: 'Personal financial coach that knows your real data' },
]

const STEPS = [
  { num: '1', title: 'Sign Up Free', desc: 'Create your account in 30 seconds and take the financial health quiz.' },
  { num: '2', title: 'Connect Your Data', desc: 'Import bank CSVs, add portfolio holdings, and set your goals.' },
  { num: '3', title: 'Get Smarter', desc: 'AI-powered insights, health scores, and actionable tips every week.' },
]

export default function Landing({ onAuth }) {
  const [showLogin, setShowLogin] = useState(false)

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)' }}>
      {/* Nav */}
      <nav style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '1rem 2rem', maxWidth: 1100, margin: '0 auto',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontFamily: 'var(--font-brand)', fontSize: 36, color: 'var(--color-accent)' }}>Atlas</span>
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-faint)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Finance Terminal</span>
        </div>
        <button onClick={() => setShowLogin(true)} className="btn btn-primary">Log In</button>
      </nav>

      {/* Hero */}
      <section style={{ textAlign: 'center', padding: '4rem 2rem 3rem', maxWidth: 700, margin: '0 auto' }}>
        <h1 style={{ fontSize: 'var(--text-4xl)', lineHeight: 1.15, marginBottom: '1rem', color: 'var(--color-primary)' }}>
          Take Control of Your Money
        </h1>
        <p style={{ fontSize: 'var(--text-xl)', color: 'var(--color-text-muted)', lineHeight: 1.6, marginBottom: '2rem' }}>
          Track spending, grow your portfolio, crush debt, and get a personalized financial health score — all with AI-powered insights that actually make sense.
        </p>
        <button onClick={() => setShowLogin(true)} className="btn btn-primary btn-lg">
          Get Started Free
        </button>
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-faint)', marginTop: '0.75rem' }}>No credit card required</p>
      </section>

      {/* Features */}
      <section style={{ maxWidth: 1000, margin: '0 auto', padding: '2rem 2rem 3rem' }}>
        <h2 style={{ textAlign: 'center', fontSize: 'var(--text-2xl)', marginBottom: '2rem', color: 'var(--color-primary)' }}>Everything You Need</h2>
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '1rem',
        }}>
          {FEATURES.map(f => (
            <div key={f.title} style={{
              background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 2,
              padding: '1.5rem', transition: 'border-color 0.1s',
            }}>
              <svg width="24" height="24" fill="none" stroke="var(--color-accent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" style={{ marginBottom: '0.75rem' }}>
                <path d={f.icon} />
              </svg>
              <h3 style={{ fontSize: 'var(--text-lg)', marginBottom: '0.35rem', color: 'var(--color-primary)' }}>{f.title}</h3>
              <p style={{ fontSize: 'var(--text-base)', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How It Works */}
      <section style={{ background: 'var(--color-primary)', padding: '3rem 2rem' }}>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          <h2 style={{ textAlign: 'center', fontSize: 'var(--text-2xl)', marginBottom: '2rem', color: 'var(--color-accent)' }}>How It Works</h2>
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: '2rem',
          }}>
            {STEPS.map(s => (
              <div key={s.num} style={{ textAlign: 'center' }}>
                <div style={{
                  width: 48, height: 48, borderRadius: '50%', border: '2px solid var(--color-accent)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  margin: '0 auto 1rem', color: 'var(--color-accent)', fontSize: '1.25rem', fontWeight: 700,
                  fontFamily: "'DM Mono', monospace",
                }}>
                  {s.num}
                </div>
                <h3 style={{ fontSize: 'var(--text-lg)', marginBottom: '0.5rem', color: 'var(--color-accent)' }}>{s.title}</h3>
                <p style={{ fontSize: 'var(--text-base)', color: 'rgba(201, 168, 76, 0.7)', lineHeight: 1.5 }}>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{ textAlign: 'center', padding: '3rem 2rem' }}>
        <h2 style={{ fontSize: 'var(--text-3xl)', marginBottom: '0.75rem', color: 'var(--color-primary)' }}>
          Ready to Get Financially Fit?
        </h2>
        <p style={{ fontSize: 'var(--text-base)', color: 'var(--color-text-muted)', marginBottom: '1.5rem' }}>
          Join Atlas and start building real financial habits today.
        </p>
        <button onClick={() => setShowLogin(true)} className="btn btn-primary btn-lg">
          Create Free Account
        </button>
      </section>

      {/* Footer */}
      <footer style={{
        borderTop: '1px solid var(--color-border)', padding: '1.5rem 2rem',
        textAlign: 'center', color: 'var(--color-text-faint)', fontSize: 'var(--text-sm)',
        textTransform: 'uppercase', letterSpacing: '0.05em',
      }}>
        For informational purposes only. Not financial advice.
      </footer>

      {/* Login — Full Screen */}
      {showLogin && (
        <div className="login-overlay" style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'var(--color-bg)' }}>
          <button onClick={() => setShowLogin(false)} aria-label="Close login" style={{
            position: 'absolute', top: 16, right: 20, background: 'none', border: 'none',
            color: 'var(--color-text-faint)', fontSize: 'var(--text-2xl)', cursor: 'pointer', zIndex: 1,
          }}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="4" y1="4" x2="16" y2="16" />
              <line x1="16" y1="4" x2="4" y2="16" />
            </svg>
          </button>
          <Login onAuth={onAuth} />
        </div>
      )}
    </div>
  )
}
