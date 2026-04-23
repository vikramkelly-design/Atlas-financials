import { useState, useRef, useEffect } from 'react'
import { api } from '../hooks/useApi'

const TOPICS = [
  { label: 'Budget', prompt: 'Where am I overspending this month?', icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
  { label: 'Savings', prompt: 'Should I pay off debt or keep saving?', icon: 'M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z' },
  { label: 'Portfolio', prompt: 'How is my portfolio performing?', icon: 'M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z' },
  { label: 'Markets', prompt: 'What stocks look undervalued right now?', icon: 'M13 7h8m0 0v8m0-8l-8 8-4-4-6 6' },
  { label: 'Plan', prompt: 'Help me build a financial plan', icon: 'M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z' },
]

export default function AtlasAI() {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => { window.scrollTo(0, 0) }, [])
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])
  useEffect(() => { inputRef.current?.focus() }, [])

  const send = async (text) => {
    if (!text?.trim() || loading) return
    const updated = [...messages, { role: 'user', text: text.trim() }]
    setMessages(updated)
    setInput('')
    setLoading(true)
    try {
      const res = await api.post('/api/chat', {
        message: text.trim(),
        context: 'atlas',
        history: updated.map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', text: m.text })),
      })
      setMessages(prev => [...prev, { role: 'assistant', text: res.data.data.reply }])
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', text: 'Connection error. Please try again.' }])
    }
    setLoading(false)
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    send(input)
  }

  const hasMessages = messages.length > 0

  return (
    <div className="atlas-ai-page" style={{
      display: 'flex', flexDirection: 'column',
      height: 'calc(100vh - 48px)', overflow: 'hidden',
    }}>

      {/* Empty state — hero + topics */}
      {!hasMessages && (
        <div className="atlas-ai-hero" style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          padding: 'var(--space-xl)',
        }}>
          {/* Status dot */}
          <div className="atlas-ai-status" style={{
            width: 8, height: 8, borderRadius: '50%',
            background: 'var(--color-gold)',
            marginBottom: 'var(--space-md)',
            animation: 'statusPulse 2s ease-in-out infinite',
          }} />

          {/* Title */}
          <h1 style={{
            fontFamily: 'var(--font-serif)',
            fontSize: 'var(--text-4xl)',
            fontWeight: 400,
            color: 'var(--color-text-primary)',
            letterSpacing: '-0.02em',
            lineHeight: 1.1,
            marginBottom: 'var(--space-sm)',
          }}>
            Atlas
          </h1>
          <p style={{
            fontSize: 'var(--text-xs)',
            textTransform: 'uppercase',
            letterSpacing: 'var(--spacing-letter-wide)',
            color: 'var(--color-text-muted)',
            marginBottom: 'var(--space-2xl)',
          }}>
            Personal Finance Coach
          </p>

          {/* Topic cards */}
          <div style={{
            display: 'flex', flexWrap: 'wrap', gap: 'var(--space-sm)',
            justifyContent: 'center', maxWidth: 560,
          }}>
            {TOPICS.map((t, i) => (
              <button
                key={t.label}
                className="atlas-topic-card"
                onClick={() => send(t.prompt)}
                style={{
                  background: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '0.6rem 1rem',
                  cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: '0.5rem',
                  color: 'var(--color-text-secondary)',
                  fontSize: 'var(--text-sm)',
                  animationDelay: `${i * 80}ms`,
                }}
              >
                <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" style={{ flexShrink: 0, opacity: 0.5 }}>
                  <path d={t.icon} />
                </svg>
                {t.label}
              </button>
            ))}
          </div>

          {/* Subtext */}
          <p style={{
            fontSize: 'var(--text-xs)',
            color: 'var(--color-text-muted)',
            marginTop: 'var(--space-xl)',
            maxWidth: 400, textAlign: 'center', lineHeight: 1.5,
          }}>
            Ask me about your budget, savings, debt, portfolio, or market analysis. I have full context on your financial data.
          </p>
        </div>
      )}

      {/* Conversation */}
      {hasMessages && (
        <>
          {/* Header bar */}
          <div style={{
            padding: '0.5rem var(--space-lg)',
            borderBottom: '1px solid var(--color-border)',
            display: 'flex', alignItems: 'center', gap: '0.5rem',
            flexShrink: 0,
          }}>
            <span style={{
              width: 6, height: 6, borderRadius: '50%',
              background: 'var(--color-gold)',
              animation: 'statusPulse 2s ease-in-out infinite',
            }} />
            <span style={{
              fontFamily: 'var(--font-serif)',
              fontSize: 'var(--text-lg)',
              color: 'var(--color-text-primary)',
              letterSpacing: '-0.01em',
            }}>Atlas</span>
            <span style={{
              fontSize: 'var(--text-xs)',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: 'var(--color-text-muted)',
            }}>Coach</span>
            <button
              className="atlas-clear-btn"
              onClick={() => setMessages([])}
              style={{
                marginLeft: 'auto', background: 'none', border: 'none',
                color: 'var(--color-text-muted)', fontSize: 'var(--text-xs)',
                cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.04em',
                padding: '0.25rem 0.5rem',
              }}
            >
              New chat
            </button>
          </div>

          {/* Messages */}
          <div style={{
            flex: 1, overflowY: 'auto',
            padding: 'var(--space-lg)', paddingBottom: 0,
            display: 'flex', flexDirection: 'column', gap: 'var(--space-md)',
          }}>
            <div style={{ maxWidth: 680, width: '100%', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className="atlas-msg"
                  style={{
                    alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                    maxWidth: '85%',
                  }}
                >
                  {msg.role === 'assistant' && (
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: '0.35rem',
                      marginBottom: '0.3rem',
                    }}>
                      <span style={{
                        width: 5, height: 5, borderRadius: '50%',
                        background: 'var(--color-gold)',
                      }} />
                      <span style={{
                        fontFamily: 'var(--font-serif)',
                        fontSize: 'var(--text-sm)',
                        color: 'var(--color-text-muted)',
                        letterSpacing: '-0.01em',
                      }}>Atlas</span>
                    </div>
                  )}
                  <div style={{
                    padding: '0.6rem 0.85rem',
                    borderRadius: 'var(--radius-sm)',
                    background: msg.role === 'user' ? 'var(--color-navy)' : 'var(--color-surface)',
                    color: msg.role === 'user' ? 'var(--color-gold)' : 'var(--color-text-secondary)',
                    border: msg.role === 'user' ? 'none' : '1px solid var(--color-border)',
                    fontSize: 'var(--text-base)',
                    lineHeight: 1.65,
                    whiteSpace: 'pre-wrap',
                  }}>
                    {msg.text}
                  </div>
                </div>
              ))}

              {/* Thinking indicator */}
              {loading && (
                <div className="atlas-msg" style={{ alignSelf: 'flex-start' }}>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: '0.35rem',
                    marginBottom: '0.3rem',
                  }}>
                    <span style={{
                      width: 5, height: 5, borderRadius: '50%',
                      background: 'var(--color-gold)',
                      animation: 'statusPulse 1s ease-in-out infinite',
                    }} />
                    <span style={{
                      fontFamily: 'var(--font-serif)',
                      fontSize: 'var(--text-sm)',
                      color: 'var(--color-text-muted)',
                    }}>Atlas</span>
                  </div>
                  <div style={{
                    padding: '0.6rem 0.85rem',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--color-surface)',
                    border: '1px solid var(--color-border)',
                    display: 'flex', gap: '4px', alignItems: 'center',
                  }}>
                    {[0, 1, 2].map(d => (
                      <span key={d} style={{
                        width: 5, height: 5, borderRadius: '50%',
                        background: 'var(--color-text-muted)',
                        animation: `dotBounce 1.2s ease-in-out ${d * 0.15}s infinite`,
                      }} />
                    ))}
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>
          </div>
        </>
      )}

      {/* Input area — always at bottom */}
      <div style={{
        flexShrink: 0,
        padding: 'var(--space-md) var(--space-lg) var(--space-lg)',
        ...(hasMessages ? { borderTop: '1px solid var(--color-border)' } : {}),
      }}>
        <form onSubmit={handleSubmit} style={{
          maxWidth: 680, margin: '0 auto',
          display: 'flex', gap: 'var(--space-sm)',
          alignItems: 'flex-end',
        }}>
          <input
            ref={inputRef}
            className="atlas-input"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Ask Atlas anything about your finances..."
            disabled={loading}
            style={{
              flex: 1,
              padding: '0.65rem 0.85rem',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--color-border)',
              background: 'var(--color-surface)',
              color: 'var(--color-text-primary)',
              fontSize: 'var(--text-base)',
              outline: 'none',
              transition: 'border-color 0.2s, box-shadow 0.2s',
            }}
          />
          <button
            type="submit"
            className="atlas-send-btn"
            disabled={loading || !input.trim()}
            style={{
              padding: '0.65rem 1rem',
              borderRadius: 'var(--radius-sm)',
              border: 'none',
              background: 'var(--color-navy)',
              color: 'var(--color-gold)',
              cursor: 'pointer',
              opacity: loading || !input.trim() ? 0.3 : 1,
              fontSize: 'var(--text-sm)',
              fontWeight: 500,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              display: 'flex', alignItems: 'center', gap: '0.35rem',
            }}
          >
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
            Send
          </button>
        </form>
        <p style={{
          maxWidth: 680, margin: '0.5rem auto 0',
          fontSize: 'var(--text-xs)',
          color: 'var(--color-text-muted)',
          textAlign: 'center',
        }}>
          For informational purposes only. Not financial advice.
        </p>
      </div>
    </div>
  )
}
