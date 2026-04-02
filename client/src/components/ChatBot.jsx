import { useState, useRef, useEffect } from 'react'
import { api } from '../hooks/useApi'

export default function ChatBot() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState([
    { role: 'assistant', text: "Welcome to Atlas. Ask me anything about intrinsic value, screener metrics, portfolio analysis, or any financial concepts." }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])
  useEffect(() => { if (open) inputRef.current?.focus() }, [open])

  // ESC keyboard shortcut to close
  useEffect(() => {
    if (!open) return
    const handler = (e) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open])

  const send = async (e) => {
    e.preventDefault()
    const text = input.trim()
    if (!text || loading) return
    const updated = [...messages, { role: 'user', text }]
    setMessages(updated)
    setInput('')
    setLoading(true)
    try {
      const res = await api.post('/api/chat', {
        message: text,
        history: updated.slice(1).map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', text: m.text })),
      })
      setMessages(prev => [...prev, { role: 'assistant', text: res.data.data.reply }].slice(-50))
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', text: "Connection error. Please try again." }].slice(-50))
    }
    setLoading(false)
  }

  return (
    <>
      {!open && (
        <button onClick={() => setOpen(true)} aria-label="Open AI chat assistant" style={{
          position: 'fixed', bottom: 20, right: 20, width: 44, height: 44,
          borderRadius: 2, background: 'var(--color-primary)', border: 'none',
          cursor: 'pointer', boxShadow: '0 2px 12px rgba(0,0,0,0.15)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000,
        }}>
          <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="var(--color-accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
          </svg>
        </button>
      )}

      {open && (
        <div className="chatbot-panel" role="dialog" aria-modal="true" aria-label="AI Chat Assistant" style={{
          position: 'fixed', bottom: 20, right: 20, width: 370, height: 500,
          background: 'var(--color-surface)', borderRadius: 2, border: '1px solid var(--color-border)',
          display: 'flex', flexDirection: 'column', zIndex: 1000,
          boxShadow: '0 4px 24px rgba(0,0,0,0.1)',
        }}>
          {/* Header */}
          <div style={{
            padding: '0.6rem 0.85rem', borderBottom: '1px solid var(--color-border)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            background: 'var(--color-primary)', borderRadius: '2px 2px 0 0',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--color-accent)' }} />
              <span style={{ color: 'var(--color-accent)', fontFamily: 'var(--font-brand)', fontSize: 'var(--text-xl)' }}>Atlas</span>
              <span style={{ color: 'var(--color-accent-50)', fontSize: 'var(--text-xs)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>AI</span>
            </div>
            <button onClick={() => setOpen(false)} aria-label="Close chat" style={{
              background: 'none', border: '1px solid var(--color-accent-30)', borderRadius: 2,
              color: 'var(--color-accent)', cursor: 'pointer', fontSize: 'var(--text-sm)', padding: '0.1rem 0.4rem',
            }}>ESC</button>
          </div>

          {/* Messages */}
          <div aria-live="polite" style={{
            flex: 1, overflowY: 'auto', padding: '0.65rem',
            display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)',
          }}>
            {messages.map((msg, i) => (
              <div key={i} style={{ alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '85%' }}>
                <div style={{
                  padding: '0.45rem 0.65rem',
                  borderRadius: 2,
                  background: msg.role === 'user' ? 'var(--color-primary)' : 'var(--color-bg)',
                  color: msg.role === 'user' ? 'var(--color-accent)' : 'var(--color-text-muted)',
                  fontSize: 'var(--text-sm)', lineHeight: 1.55,
                  border: msg.role === 'user' ? 'none' : '1px solid var(--color-border)',
                }}>
                  {msg.text}
                </div>
              </div>
            ))}
            {loading && (
              <div style={{ alignSelf: 'flex-start', maxWidth: '85%' }}>
                <div style={{
                  padding: '0.45rem 0.65rem', borderRadius: 2,
                  background: 'var(--color-bg)', border: '1px solid var(--color-border)',
                  color: 'var(--color-text-faint)', fontSize: 'var(--text-sm)',
                }}>
                  <span style={{ animation: 'pulse 1s ease-in-out infinite' }}>Processing...</span>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <form onSubmit={send} style={{
            padding: 'var(--space-sm)', borderTop: '1px solid var(--color-border)',
            display: 'flex', gap: '0.4rem',
          }}>
            <input ref={inputRef} value={input} onChange={e => setInput(e.target.value)}
              placeholder="Ask about IV, P/E, portfolio..." disabled={loading}
              style={{
                flex: 1, padding: '0.45rem 0.65rem', borderRadius: 2,
                border: '1px solid var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text)',
                fontSize: 'var(--text-sm)', outline: 'none',
              }} />
            <button type="submit" disabled={loading || !input.trim()} style={{
              padding: '0.45rem 0.65rem', borderRadius: 2, border: '1px solid var(--color-primary)',
              background: 'transparent', color: 'var(--color-primary)', cursor: 'pointer',
              opacity: loading || !input.trim() ? 0.3 : 1, fontSize: 'var(--text-sm)',
              textTransform: 'uppercase', letterSpacing: '0.04em',
            }}>
              Send
            </button>
          </form>
        </div>
      )}
    </>
  )
}
