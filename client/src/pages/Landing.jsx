import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, useInView } from 'motion/react'
import TypewriterText from '../components/TypewriterText'
import Login from './Login'

const EASE = [0.22, 1, 0.36, 1]

// ── Contour background — topographic lines that draw + drift ──
function ContourBackground({ opacity = 0.10 }) {
  const paths = [
    'M -50 200 Q 100 160 250 180 Q 400 200 550 170 Q 700 140 850 175',
    'M -30 240 Q 120 200 280 225 Q 440 250 580 210 Q 720 170 870 200',
    'M -60 280 Q 90 250 230 270 Q 380 290 530 255 Q 680 220 850 250',
    'M -40 150 Q 150 120 300 140 Q 450 160 600 130 Q 750 100 900 135',
    'M -20 320 Q 130 290 270 310 Q 420 330 560 295 Q 710 260 860 290',
    'M -70 110 Q 110 80 260 100 Q 410 120 560 90 Q 710 60 880 95',
  ]
  return (
    <div className="landing-contours">
      <svg viewBox="0 0 800 400" preserveAspectRatio="xMidYMid slice">
        {paths.map((d, i) => (
          <path
            key={i}
            className="landing-contour-path"
            d={d}
            style={{
              strokeDasharray: 950,
              strokeDashoffset: 950,
              stroke: `rgba(201, 168, 76, ${opacity})`,
            }}
          />
        ))}
      </svg>
    </div>
  )
}

// ── Count-up number ──
function CountUp({ target, prefix = '', suffix = '', duration = 1.5 }) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, amount: 0.5 })
  const [value, setValue] = useState(0)
  const hasRun = useRef(false)

  useEffect(() => {
    if (!inView || hasRun.current) return
    hasRun.current = true
    const start = performance.now()
    const step = (now) => {
      const t = Math.min((now - start) / (duration * 1000), 1)
      const eased = 1 - Math.pow(1 - t, 3)
      setValue(Math.round(target * eased))
      if (t < 1) requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  }, [inView, target, duration])

  const formatted = new Intl.NumberFormat('en-US').format(value)
  return <span ref={ref}>{prefix}{formatted}{suffix}</span>
}

// ── Screener data ──
const SCREENER_DATA = [
  { ticker: 'NVDA', name: 'NVIDIA Corp', price: 124.92, iv: 168.40, verdict: 'UNDERVALUED' },
  { ticker: 'AAPL', name: 'Apple Inc', price: 198.15, iv: 212.30, verdict: 'UNDERVALUED' },
  { ticker: 'MSFT', name: 'Microsoft', price: 428.50, iv: 395.10, verdict: 'OVERVALUED' },
  { ticker: 'AMZN', name: 'Amazon', price: 198.32, iv: 241.70, verdict: 'UNDERVALUED' },
  { ticker: 'GOOGL', name: 'Alphabet', price: 165.20, iv: 188.50, verdict: 'UNDERVALUED' },
]

// ── Main Landing Page ──
export default function Landing({ onAuth }) {
  const [showLogin, setShowLogin] = useState(false)
  const [navSolid, setNavSolid] = useState(false)

  useEffect(() => {
    const h = () => setNavSolid(window.scrollY > window.innerHeight * 0.8)
    window.addEventListener('scroll', h, { passive: true })
    return () => window.removeEventListener('scroll', h)
  }, [])

  const scrollTo = (id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
  const open = () => setShowLogin(true)

  return (
    <div style={{ background: '#0E1B2E', minHeight: '100vh' }}>

      {/* ── STICKY NAV ── */}
      <nav className="landing-sticky-nav" style={{
        transform: navSolid ? 'translateY(0)' : 'translateY(-100%)',
      }}>
        <div style={{ display: 'flex', gap: 'var(--space-lg)', alignItems: 'center' }}>
          <span style={{ fontFamily: 'var(--font-serif)', fontSize: 'var(--text-xl)', color: '#C9A84C', letterSpacing: '-0.01em' }}>
            Atlas
          </span>
          <div className="landing-sticky-nav-links" style={{ display: 'flex', gap: 'var(--space-md)' }}>
            {[
              { id: 'screener', label: 'Screener' },
              { id: 'money', label: 'Money' },
              { id: 'ai-coach', label: 'AI Coach' },
            ].map(s => (
              <button key={s.id} onClick={() => scrollTo(s.id)} style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: '#8A95A8', fontSize: 'var(--text-xs)',
                textTransform: 'uppercase', letterSpacing: '0.05em',
              }}>{s.label}</button>
            ))}
          </div>
        </div>
        <button className="btn landing-btn-gold" onClick={open}
          style={{ padding: '0.35rem 0.85rem', fontSize: 'var(--text-xs)' }}>
          Get Started
        </button>
      </nav>

      {/* ══════════ ZONE 1: HERO ══════════ */}
      <section style={{
        minHeight: '100vh', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '2rem', textAlign: 'center', position: 'relative',
        background: 'radial-gradient(ellipse at 50% 40%, #1E3250 0%, #0E1B2E 70%)',
      }}>
        <ContourBackground opacity={0.10} />

        {/* Top bar */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, zIndex: 2,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '1rem 2rem', maxWidth: 1100, margin: '0 auto', width: '100%',
        }}>
          <span style={{ fontFamily: 'var(--font-serif)', fontSize: 36, color: '#C9A84C', letterSpacing: '-0.01em' }}>
            Atlas
          </span>
          <button className="btn landing-btn-ghost" onClick={open}>Log In</button>
        </div>

        {/* Hero content */}
        <div style={{ position: 'relative', zIndex: 1, maxWidth: 700 }}>
          <div style={{
            fontFamily: 'var(--font-serif)',
            fontSize: 'clamp(2rem, 5vw, 3.5rem)',
            color: '#C9A84C',
            letterSpacing: '-0.02em',
            lineHeight: 1.15,
            minHeight: 'clamp(4rem, 10vw, 6rem)',
          }}>
            <TypewriterText
              text="Every stock has a real price. Most apps won't tell you."
              speed={38}
              startDelay={600}
            />
          </div>
          <p style={{
            color: 'rgba(201, 168, 76, 0.55)',
            fontSize: 'var(--text-base)',
            marginTop: 'var(--space-lg)',
            lineHeight: 1.5,
            opacity: 0,
            animation: 'proofReveal 0.4s cubic-bezier(0.22, 1, 0.36, 1) 2.6s both',
          }}>
            Atlas is the financial terminal built for beginners.
          </p>
        </div>

        {/* Proof points */}
        <div className="landing-proof-points" style={{
          display: 'flex', gap: 'clamp(1rem, 3vw, 2.5rem)',
          marginTop: 'var(--space-xl)', flexWrap: 'wrap', justifyContent: 'center',
          position: 'relative', zIndex: 1,
        }}>
          {[
            'DCF-based intrinsic values',
            'AI coach trained on your data',
            'Budget, save, invest \u2014 one app',
          ].map((t, i) => (
            <span key={i} className="landing-proof-point" style={{
              fontSize: 'var(--text-xs)', color: '#8A95A8',
              textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 500,
            }}>{t}</span>
          ))}
        </div>

        {/* CTA */}
        <button className="btn landing-btn-gold landing-cta-btn" onClick={open}
          style={{ marginTop: 'var(--space-xl)', padding: '0.65rem 2rem', fontSize: 'var(--text-base)', position: 'relative', zIndex: 1 }}>
          Get Started
        </button>
        <p className="landing-cta-btn" style={{
          fontSize: 'var(--text-xs)', color: '#5A6578',
          marginTop: 'var(--space-sm)', animationDelay: '2.5s',
          position: 'relative', zIndex: 1,
        }}>No credit card required</p>
      </section>

      {/* ══════════ ZONE 2: SCREENER ══════════ */}
      <section id="screener" className="landing-section" style={{ background: '#111D2E' }}>
        <div className="landing-split">
          <motion.div className="landing-split-text"
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.7, ease: EASE }}
          >
            <h2 style={{
              fontFamily: 'var(--font-serif)', fontSize: 'var(--text-3xl)',
              color: '#C9A84C', letterSpacing: '-0.02em', lineHeight: 1.15,
              marginBottom: 'var(--space-md)',
            }}>The Market Screener</h2>
            <p style={{ fontSize: 'var(--text-base)', color: '#C8D0DC', lineHeight: 1.65, maxWidth: '45ch' }}>
              Atlas scans 100+ stocks daily and calculates what each one is actually worth using
              discounted cash flow analysis. No guessing, no hype — just math.
            </p>
            <p style={{
              fontSize: 'var(--text-xs)', color: '#5A6578', marginTop: 'var(--space-lg)',
              textTransform: 'uppercase', letterSpacing: '0.05em',
            }}>Updated nightly. 98+ stocks tracked.</p>
          </motion.div>

          <motion.div className="landing-split-visual"
            initial={{ opacity: 0, x: 40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.7, ease: EASE, delay: 0.15 }}
          >
            <div className="landing-panel" style={{ overflow: 'hidden' }}>
              <div style={{
                display: 'grid', gridTemplateColumns: '1fr 0.8fr 0.8fr 1fr',
                padding: '0.6rem 0.85rem',
                borderBottom: '1px solid rgba(201, 168, 76, 0.06)',
                fontSize: 'var(--text-xs)', color: '#5A6578',
                textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 500,
              }}>
                <span>Stock</span>
                <span style={{ textAlign: 'right' }}>Price</span>
                <span style={{ textAlign: 'right' }}>IV</span>
                <span style={{ textAlign: 'right' }}>Verdict</span>
              </div>
              {SCREENER_DATA.map(s => (
                <div key={s.ticker} className="landing-screener-row" style={{
                  display: 'grid', gridTemplateColumns: '1fr 0.8fr 0.8fr 1fr',
                  padding: '0.55rem 0.85rem',
                  borderBottom: '1px solid rgba(255,255,255,0.03)',
                  fontSize: 'var(--text-sm)', alignItems: 'center',
                }}>
                  <div>
                    <span style={{ fontWeight: 600, color: '#C8D0DC' }}>{s.ticker}</span>
                    <span style={{ color: '#5A6578', marginLeft: 6, fontSize: 'var(--text-xs)' }}>{s.name}</span>
                  </div>
                  <span className="mono" style={{ textAlign: 'right', color: '#8A95A8' }}>${s.price.toFixed(2)}</span>
                  <span className="mono" style={{ textAlign: 'right', color: '#8A95A8' }}>${s.iv.toFixed(2)}</span>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{
                      display: 'inline-block', padding: '2px 8px', borderRadius: 2,
                      fontSize: 'var(--text-xs)', fontWeight: 600, letterSpacing: '0.03em',
                      background: s.verdict === 'UNDERVALUED' ? 'var(--color-undervalued-bg)' : 'var(--color-overvalued-bg)',
                      color: s.verdict === 'UNDERVALUED' ? 'var(--color-undervalued-text)' : 'var(--color-overvalued-text)',
                    }}>{s.verdict}</span>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* ══════════ ZONE 3: MONEY & PLAN ══════════ */}
      <section id="money" className="landing-section" style={{ background: '#0F1925' }}>
        <div className="landing-split landing-split-reverse">
          <motion.div className="landing-split-text"
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.7, ease: EASE }}
          >
            <h2 style={{
              fontFamily: 'var(--font-serif)', fontSize: 'var(--text-3xl)',
              color: '#C9A84C', letterSpacing: '-0.02em', lineHeight: 1.15,
              marginBottom: 'var(--space-md)',
            }}>Your Money, One Page.</h2>
            <p style={{ fontSize: 'var(--text-base)', color: '#C8D0DC', lineHeight: 1.65, maxWidth: '45ch' }}>
              Track spending, crush debt, grow savings, and see exactly how much you have left
              to invest this month — all in a single view.
            </p>
          </motion.div>

          <motion.div className="landing-split-visual"
            initial={{ opacity: 0, x: -40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.7, ease: EASE, delay: 0.15 }}
            style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}
          >
            {/* Allocation bar */}
            <div className="landing-panel" style={{ padding: 'var(--space-lg)' }}>
              <p style={{
                fontSize: 'var(--text-xs)', textTransform: 'uppercase',
                letterSpacing: '0.05em', color: '#5A6578', marginBottom: 'var(--space-sm)', fontWeight: 500,
              }}>Monthly Allocation</p>
              <div style={{ height: 8, borderRadius: 4, overflow: 'hidden', display: 'flex', marginBottom: 'var(--space-md)' }}>
                <div style={{ width: '60%', background: '#8B2635' }} />
                <div style={{ width: '20%', background: '#2E7D5E' }} />
                <div style={{ width: '20%', background: '#5B8DEF' }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--space-sm)', textAlign: 'center' }}>
                {[
                  { label: 'Left to Spend', value: '$847', color: '#2E7D5E' },
                  { label: 'Savings', value: '$2,140', color: '#2E7D5E' },
                  { label: 'Total Debt', value: '$3,200', color: '#8B2635' },
                ].map(n => (
                  <div key={n.label}>
                    <p style={{ fontSize: 'var(--text-xs)', color: '#5A6578', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 2 }}>{n.label}</p>
                    <span className="mono" style={{ fontSize: 'var(--text-lg)', fontWeight: 600, color: n.color }}>{n.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Atlas Plan projection */}
            <div className="landing-panel" style={{ padding: 'var(--space-md) var(--space-lg)' }}>
              <p style={{
                fontSize: 'var(--text-xs)', textTransform: 'uppercase',
                letterSpacing: '0.05em', color: '#5A6578', marginBottom: 'var(--space-xs)', fontWeight: 500,
              }}>The Atlas Plan</p>
              <p style={{ fontSize: 'var(--text-sm)', color: '#8A95A8', lineHeight: 1.5 }}>
                Invest <span className="mono" style={{ fontWeight: 600, color: '#C8D0DC' }}>$200/month</span> starting at 19
              </p>
              <p style={{ marginTop: 'var(--space-xs)' }}>
                <span className="mono" style={{ fontSize: 'var(--text-2xl)', fontWeight: 600, color: '#2E7D5E' }}>
                  $<CountUp target={1200000} prefix="" suffix="" />
                </span>
                <span style={{ fontSize: 'var(--text-sm)', color: '#5A6578', marginLeft: 8 }}>by age 55</span>
              </p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ══════════ ZONE 4: ATLAS AI ══════════ */}
      <section id="ai-coach" className="landing-section" style={{ background: '#141E2C' }}>
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.7, ease: EASE }}
          style={{ maxWidth: 700, width: '100%' }}
        >
          <h2 style={{
            fontFamily: 'var(--font-serif)', fontSize: 'var(--text-3xl)',
            color: '#C9A84C', letterSpacing: '-0.02em', lineHeight: 1.15,
            marginBottom: 'var(--space-2xl)', textAlign: 'center',
          }}>Your Financial Coach</h2>

          <ChatDemo />

          <p style={{
            fontSize: 'var(--text-base)', color: '#8A95A8',
            lineHeight: 1.65, textAlign: 'center',
            marginTop: 'var(--space-2xl)', maxWidth: '50ch',
            marginLeft: 'auto', marginRight: 'auto',
          }}>
            Atlas AI knows your budget, your portfolio, and the math.
            It's not a generic chatbot — it's your financial coach.
          </p>
        </motion.div>
      </section>

      {/* ══════════ ZONE 5: ACCENT DIVIDER ══════════ */}
      <section style={{
        borderTop: '1px solid rgba(201, 168, 76, 0.15)',
        borderBottom: '1px solid rgba(201, 168, 76, 0.15)',
        background: '#0E1B2E',
        padding: 'clamp(2.5rem, 5vw, 3.5rem) 2rem',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.6, ease: EASE }}
          style={{
            display: 'flex', gap: 'clamp(2rem, 5vw, 4rem)',
            flexWrap: 'wrap', justifyContent: 'center', textAlign: 'center',
          }}
        >
          {[
            '98+ Stocks Analyzed Nightly',
            'DCF-Powered Intrinsic Values',
          ].map(t => (
            <span key={t} style={{
              fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)',
              color: '#C9A84C', textTransform: 'uppercase',
              letterSpacing: '0.08em', fontWeight: 500,
              opacity: 0.7,
            }}>{t}</span>
          ))}
        </motion.div>
      </section>

      {/* ══════════ ZONE 6: FINAL CTA ══════════ */}
      <section style={{
        minHeight: '60vh', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        textAlign: 'center', padding: '5rem 2rem', position: 'relative',
        background: 'radial-gradient(ellipse at 50% 60%, #1E3250 0%, #0E1B2E 70%)',
      }}>
        <ContourBackground opacity={0.06} />
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.7, ease: EASE }}
          style={{ position: 'relative', zIndex: 1 }}
        >
          <h2 style={{
            fontFamily: 'var(--font-serif)', fontSize: 'var(--text-3xl)',
            color: '#C9A84C', letterSpacing: '-0.02em', lineHeight: 1.2,
            marginBottom: 'var(--space-sm)',
          }}>Take control of your finances.</h2>
          <p style={{ fontSize: 'var(--text-base)', color: '#5A6578', marginBottom: 'var(--space-xl)' }}>
            No credit card required. No ads.
          </p>
          <button className="btn landing-btn-gold" onClick={open}
            style={{ padding: '0.65rem 2rem', fontSize: 'var(--text-base)' }}>
            Get Started
          </button>
        </motion.div>
      </section>

      {/* Footer */}
      <footer style={{
        borderTop: '1px solid rgba(201, 168, 76, 0.06)', padding: '1.5rem 2rem',
        textAlign: 'center', color: '#5A6578', fontSize: 'var(--text-xs)',
        textTransform: 'uppercase', letterSpacing: '0.05em',
        background: '#0E1B2E',
      }}>
        For informational purposes only. Not financial advice.
      </footer>

      {/* Login overlay */}
      {showLogin && (
        <div className="login-overlay" style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'var(--color-bg)' }}>
          <button onClick={() => setShowLogin(false)} aria-label="Close login" style={{
            position: 'absolute', top: 16, right: 20, background: 'none', border: 'none',
            color: 'var(--color-text-muted)', fontSize: 'var(--text-2xl)', cursor: 'pointer', zIndex: 1,
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

// ── Chat Demo — triggers typewriter on viewport entry ──
function ChatDemo() {
  const [phase, setPhase] = useState(0)
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, amount: 0.4 })
  const [triggered, setTriggered] = useState(false)

  useEffect(() => {
    if (inView && !triggered) setTriggered(true)
  }, [inView, triggered])

  return (
    <div ref={ref} style={{
      display: 'flex', flexDirection: 'column', gap: 'var(--space-md)',
      maxWidth: 520, margin: '0 auto',
    }}>
      {/* User message */}
      {triggered && (
        <div className="landing-chat-bubble" style={{ alignSelf: 'flex-end', maxWidth: '80%' }}>
          <div style={{
            padding: '0.65rem 0.9rem', borderRadius: 'var(--radius-sm)',
            background: 'rgba(201, 168, 76, 0.15)',
            border: '1px solid rgba(201, 168, 76, 0.25)',
            color: '#C9A84C',
            fontSize: 'var(--text-base)', lineHeight: 1.6,
          }}>
            <TypewriterText
              text="What should I invest in with $500?"
              speed={30}
              onComplete={() => setTimeout(() => setPhase(1), 500)}
            />
          </div>
        </div>
      )}

      {/* Atlas response */}
      {phase >= 1 && (
        <div className="landing-chat-bubble" style={{ alignSelf: 'flex-start', maxWidth: '85%' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: '0.35rem',
            marginBottom: '0.3rem',
          }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#C9A84C' }} />
            <span style={{ fontFamily: 'var(--font-serif)', fontSize: 'var(--text-sm)', color: '#5A6578' }}>Atlas</span>
          </div>
          <div style={{
            padding: '0.65rem 0.9rem', borderRadius: 'var(--radius-sm)',
            background: '#1A2740',
            border: '1px solid rgba(255,255,255,0.06)',
            color: '#C8D0DC',
            fontSize: 'var(--text-base)', lineHeight: 1.6,
          }}>
            <TypewriterText
              text="With $500, I'd suggest starting with a broad ETF like VTI for diversification. Based on your risk tolerance and the screener, NVDA is also trading 18% below intrinsic value — but never put all your eggs in one basket."
              speed={18}
              cursor={true}
            />
          </div>
        </div>
      )}
    </div>
  )
}
