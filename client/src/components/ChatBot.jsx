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
      setMessages(prev => [...prev, { role: 'assistant', text: res.data.data.reply }])
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', text: "Connection error. Please try again." }])
    }
    setLoading(false)
  }

  return (
    <>
      {!open && (
        <button onClick={() => setOpen(true)} style={{
          position: 'fixed', bottom: 20, right: 20, width: 44, height: 44,
          borderRadius: 2, background: '#1B2A4A', border: 'none',
          cursor: 'pointer', boxShadow: '0 2px 12px rgba(0,0,0,0.15)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000,
        }}>
          <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="#C9A84C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
          </svg>
        </button>
      )}

      {open && (
        <div style={{
          position: 'fixed', bottom: 20, right: 20, width: 370, height: 500,
          background: '#FFF8F0', borderRadius: 2, border: '1px solid #E8DDD0',
          display: 'flex', flexDirection: 'column', zIndex: 1000,
          boxShadow: '0 4px 24px rgba(0,0,0,0.1)',
        }}>
          {/* Header */}
          <div style={{
            padding: '0.6rem 0.85rem', borderBottom: '1px solid #EDE5DC',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            background: '#1B2A4A', borderRadius: '2px 2px 0 0',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#C9A84C' }} />
              <span style={{ color: '#C9A84C', fontFamily: "'Allura', cursive", fontSize: '1.2rem' }}>Atlas</span>
              <span style={{ color: 'rgba(201, 168, 76, 0.5)', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>AI</span>
            </div>
            <button onClick={() => setOpen(false)} style={{
              background: 'none', border: '1px solid rgba(201, 168, 76, 0.3)', borderRadius: 2,
              color: '#C9A84C', cursor: 'pointer', fontSize: '0.7rem', padding: '0.1rem 0.4rem',
            }}>ESC</button>
          </div>

          {/* Messages */}
          <div style={{
            flex: 1, overflowY: 'auto', padding: '0.65rem',
            display: 'flex', flexDirection: 'column', gap: '0.5rem',
          }}>
            {messages.map((msg, i) => (
              <div key={i} style={{ alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '85%' }}>
                <div style={{
                  padding: '0.45rem 0.65rem',
                  borderRadius: 2,
                  background: msg.role === 'user' ? '#1B2A4A' : '#FFFCF5',
                  color: msg.role === 'user' ? '#C9A84C' : '#8B3A3A',
                  fontSize: '0.78rem', lineHeight: 1.55,
                  border: msg.role === 'user' ? 'none' : '1px solid #E8DDD0',
                }}>
                  {msg.text}
                </div>
              </div>
            ))}
            {loading && (
              <div style={{ alignSelf: 'flex-start', maxWidth: '85%' }}>
                <div style={{
                  padding: '0.45rem 0.65rem', borderRadius: 2,
                  background: '#FFFCF5', border: '1px solid #E8DDD0',
                  color: '#B89090', fontSize: '0.78rem',
                }}>
                  <span style={{ animation: 'pulse 1s ease-in-out infinite' }}>Processing...</span>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <form onSubmit={send} style={{
            padding: '0.5rem', borderTop: '1px solid #EDE5DC',
            display: 'flex', gap: '0.4rem',
          }}>
            <input ref={inputRef} value={input} onChange={e => setInput(e.target.value)}
              placeholder="Ask about IV, P/E, portfolio..." disabled={loading}
              style={{
                flex: 1, padding: '0.45rem 0.65rem', borderRadius: 2,
                border: '1px solid #E8DDD0', background: '#FFFCF5', color: '#6B1A1A',
                fontSize: '0.78rem', outline: 'none',
              }} />
            <button type="submit" disabled={loading || !input.trim()} style={{
              padding: '0.45rem 0.65rem', borderRadius: 2, border: '1px solid #1B2A4A',
              background: 'transparent', color: '#1B2A4A', cursor: 'pointer',
              opacity: loading || !input.trim() ? 0.3 : 1, fontSize: '0.7rem',
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
