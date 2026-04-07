import { useState, useRef, useEffect } from 'react'
import { api } from '../hooks/useApi'

const SUGGESTED = [
  "Am I on track for my plan?",
  "Where did I overspend last month?",
  "What should I do first?",
  "Which stock in the screener is the best value right now?",
  "Explain what a DCF is",
  "How diversified is my portfolio?",
]

export default function AskAtlas() {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])
  useEffect(() => { inputRef.current?.focus() }, [])

  const send = async (text) => {
    text = (text || input).trim()
    if (!text || loading) return
    const updated = [...messages, { role: 'user', text }]
    setMessages(updated)
    setInput('')
    setLoading(true)
    try {
      const res = await api.post('/api/chat', {
        message: text,
        context: 'atlas',
        history: updated.map(m => ({ role: m.role === 'user' ? 'user' : 'model', text: m.text })),
      })
      setMessages(prev => [...prev, { role: 'assistant', text: res.data.data.reply }])
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', text: "Connection issue. Try again in a moment." }])
    }
    setLoading(false)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 120px)' }}>
      <div style={{ marginBottom: 'var(--space-md)' }}>
        <h1 style={{ fontSize: 'var(--text-3xl)', marginBottom: 4 }}>Ask Atlas</h1>
        <p className="label-caps">Your financial coach — knows your data, not just textbooks</p>
      </div>

      <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        {/* Messages */}
        <div style={{
          flex: 1, overflowY: 'auto', padding: '0.75rem 0',
          display: 'flex', flexDirection: 'column', gap: '0.65rem',
        }}>
          {messages.length === 0 && !loading && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: 'var(--space-lg)', padding: 'var(--space-xl)' }}>
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontFamily: 'var(--font-serif)', fontSize: 'var(--text-2xl)', color: 'var(--color-navy)', marginBottom: 'var(--space-xs)' }}>
                  What do you want to know?
                </p>
                <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>
                  I have access to your portfolio, budget, plan, and screener data.
                </p>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-xs)', justifyContent: 'center', maxWidth: 500 }}>
                {SUGGESTED.map((s, i) => (
                  <button key={i} onClick={() => send(s)} style={{
                    background: 'var(--color-surface-2)', border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-sm)', padding: '0.4rem 0.7rem',
                    fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)',
                    cursor: 'pointer', transition: 'border-color 0.15s',
                  }}
                  onMouseEnter={e => e.target.style.borderColor = 'var(--color-gold)'}
                  onMouseLeave={e => e.target.style.borderColor = 'var(--color-border)'}
                  >{s}</button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} style={{ alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '80%' }}>
              {msg.role === 'assistant' && (
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-gold)', fontWeight: 500, marginBottom: 2, display: 'block' }}>Atlas</span>
              )}
              <div style={{
                padding: '0.6rem 0.85rem', borderRadius: 'var(--radius-sm)',
                background: msg.role === 'user' ? 'var(--color-navy)' : 'var(--color-surface-2)',
                color: msg.role === 'user' ? '#fff' : 'var(--color-text-primary)',
                fontSize: 'var(--text-base)', lineHeight: 1.65,
                whiteSpace: 'pre-wrap',
              }}>
                {msg.text}
              </div>
            </div>
          ))}

          {loading && (
            <div style={{ alignSelf: 'flex-start', maxWidth: '80%' }}>
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-gold)', fontWeight: 500, marginBottom: 2, display: 'block' }}>Atlas</span>
              <div style={{
                padding: '0.6rem 0.85rem', borderRadius: 'var(--radius-sm)',
                background: 'var(--color-surface-2)', color: 'var(--color-text-muted)',
                fontSize: 'var(--text-base)',
              }}>
                <span style={{ animation: 'pulse 1s ease-in-out infinite' }}>Thinking...</span>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <form onSubmit={e => { e.preventDefault(); send() }} style={{
          padding: '0.65rem 0 0', borderTop: '1px solid var(--color-border)',
          display: 'flex', gap: '0.4rem',
        }}>
          <input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Ask anything about your finances..."
            disabled={loading}
            style={{
              flex: 1, padding: '0.55rem 0.75rem', borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--color-border)', background: 'var(--color-bg)',
              color: 'var(--color-text-primary)', fontSize: 'var(--text-base)', outline: 'none',
            }}
          />
          <button type="submit" disabled={loading || !input.trim()} style={{
            padding: '0.55rem 1rem', borderRadius: 'var(--radius-sm)',
            border: 'none', background: 'var(--color-navy)', color: '#fff',
            cursor: 'pointer', opacity: loading || !input.trim() ? 0.3 : 1,
            fontSize: 'var(--text-sm)', fontWeight: 500,
          }}>
            Send
          </button>
        </form>
      </div>
    </div>
  )
}
