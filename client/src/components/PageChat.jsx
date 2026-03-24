import { useState, useRef, useEffect } from 'react'
import { api } from '../hooks/useApi'

const WELCOME = {
  budget: "I'm your budget assistant. Ask me about your spending habits, how to save more, or get advice on budgeting strategies.",
  portfolio: "I'm your portfolio assistant. Ask me about your holdings, diversification, risk management, or any investment concepts.",
  analytics: "I'm your analytics assistant. Ask me about your charts, performance metrics, or how to interpret your portfolio data.",
}

export default function PageChat({ context }) {
  const [messages, setMessages] = useState([
    { role: 'assistant', text: WELCOME[context] || "How can I help?" }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])
  useEffect(() => { inputRef.current?.focus() }, [])

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
        context,
        history: updated.slice(1).map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', text: m.text })),
      })
      setMessages(prev => [...prev, { role: 'assistant', text: res.data.data.reply }])
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', text: "Connection error. Please try again." }])
    }
    setLoading(false)
  }

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 180px)', minHeight: 400 }}>
      {/* Header */}
      <div style={{
        padding: '0.6rem 0.85rem', borderBottom: '1px solid #EDE5DC',
        display: 'flex', alignItems: 'center', gap: '0.5rem',
        background: '#1B2A4A', borderRadius: '6px 6px 0 0', margin: '-1.25rem -1.25rem 0',
      }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#C9A84C' }} />
        <span style={{ color: '#C9A84C', fontFamily: "'Allura', cursive", fontSize: '1.2rem' }}>Atlas</span>
        <span style={{ color: 'rgba(201, 168, 76, 0.5)', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Personal Coach
        </span>
      </div>

      {/* Messages */}
      <div style={{
        flex: 1, overflowY: 'auto', padding: '0.75rem 0',
        display: 'flex', flexDirection: 'column', gap: '0.5rem',
      }}>
        {messages.map((msg, i) => (
          <div key={i} style={{ alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '85%' }}>
            <div style={{
              padding: '0.5rem 0.75rem', borderRadius: 4,
              background: msg.role === 'user' ? '#1B2A4A' : '#FFFCF5',
              color: msg.role === 'user' ? '#C9A84C' : '#8B3A3A',
              fontSize: '0.82rem', lineHeight: 1.6,
              border: msg.role === 'user' ? 'none' : '1px solid #E8DDD0',
              whiteSpace: 'pre-wrap',
            }}>
              {msg.text}
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ alignSelf: 'flex-start', maxWidth: '85%' }}>
            <div style={{
              padding: '0.5rem 0.75rem', borderRadius: 4,
              background: '#FFFCF5', border: '1px solid #E8DDD0',
              color: '#B89090', fontSize: '0.82rem',
            }}>
              <span style={{ animation: 'pulse 1s ease-in-out infinite' }}>Thinking...</span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form onSubmit={send} style={{
        padding: '0.65rem 0 0', borderTop: '1px solid #EDE5DC',
        display: 'flex', gap: '0.4rem',
      }}>
        <input ref={inputRef} value={input} onChange={e => setInput(e.target.value)}
          placeholder={`Ask about your ${context}...`} disabled={loading}
          style={{
            flex: 1, padding: '0.5rem 0.75rem', borderRadius: 4,
            border: '1px solid #E8DDD0', background: '#FFFCF5', color: '#6B1A1A',
            fontSize: '0.82rem', outline: 'none',
          }} />
        <button type="submit" disabled={loading || !input.trim()} style={{
          padding: '0.5rem 0.75rem', borderRadius: 4, border: '1px solid #1B2A4A',
          background: 'transparent', color: '#1B2A4A', cursor: 'pointer',
          opacity: loading || !input.trim() ? 0.3 : 1, fontSize: '0.72rem',
          textTransform: 'uppercase', letterSpacing: '0.04em',
        }}>
          Send
        </button>
      </form>
    </div>
  )
}
