import { useState, useRef, useEffect } from 'react'
import { api } from '../hooks/useApi'

const TOPICS = [
  {
    category: 'Budgeting',
    prompts: [
      'How should I allocate my budget between spending, saving, and investing?',
      'What is a good savings rate for my income level?',
    ],
  },
  {
    category: 'Investing',
    prompts: [
      'What is intrinsic value and how is it calculated?',
      'How do I start investing with a small amount?',
      'What stocks should I consider for long-term growth?',
    ],
  },
  {
    category: 'Debt & Savings',
    prompts: [
      'How should I prioritize paying off debt vs saving?',
      'How do I set up an emergency fund?',
    ],
  },
  {
    category: 'Using Atlas',
    prompts: [
      'How do I use the stock screener?',
      'How do I track my net worth?',
      'What does my financial health score mean?',
    ],
  },
]

const SYSTEM_PROMPT = `You are Atlas, a knowledgeable personal finance assistant built into the Atlas finance app. You help users with budgeting, investing, saving, debt management, and navigating the Atlas platform.

Atlas app features you can reference:
- Budget: CSV import, spending categories, allocation sliders (spend/save/invest split), monthly income tracking
- Screener: Intrinsic value analysis via DCF, earnings-based, and book value methods. Shows verdict (undervalued/fairly valued/overvalued), buy-below price, upside %
- Portfolio: Real-time prices, gain/loss tracking, buy/sell/stop-loss orders
- Net worth: Assets and liabilities tracker
- Savings: Buckets, emergency fund tracking, debt payoff from savings
- Plan: Set a goal amount and target age, see projected growth at 6%/8%/11% returns
- Health score: Composite score from spending habits, savings rate, diversification, and goal progress

Guidelines:
- Be direct and specific. Lead with the answer.
- Use numbers and examples when possible.
- When discussing stocks, note this is educational, not financial advice.
- Reference specific Atlas features when relevant (e.g. "You can check this in the Screener tab").
- Keep responses under 300 words unless the user asks for detail.`

function formatMessage(text) {
  // Convert **bold** to spans, and split paragraphs
  return text.split('\n').map((line, i) => {
    const parts = line.split(/(\*\*[^*]+\*\*)/).map((seg, j) => {
      if (seg.startsWith('**') && seg.endsWith('**')) {
        return <strong key={j} style={{ color: 'var(--color-text-primary)', fontWeight: 600 }}>{seg.slice(2, -2)}</strong>
      }
      return seg
    })
    return <span key={i}>{parts}{i < text.split('\n').length - 1 && <br />}</span>
  })
}

export default function Atlas() {
  const user = JSON.parse(localStorage.getItem('atlas_user') || '{}')
  const firstName = user.name ? user.name.split(' ')[0] : ''
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  const sendMessage = async (text) => {
    if (!text?.trim() || loading) return
    const trimmed = text.trim()
    const updated = [...messages, { role: 'user', text: trimmed }]
    setMessages(updated)
    setInput('')
    setLoading(true)
    try {
      const res = await api.post('/api/chat', {
        message: trimmed,
        context: 'atlas',
        systemPrompt: SYSTEM_PROMPT,
        history: updated.map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', text: m.text })),
      })
      setMessages(prev => [...prev, { role: 'assistant', text: res.data.data?.reply || 'I wasn\'t able to generate a response. Please try again.' }])
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', text: 'Connection error. Please try again.' }])
    }
    setLoading(false)
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    sendMessage(input)
  }

  const clearChat = () => {
    setMessages([])
    setInput('')
  }

  const hasMessages = messages.length > 0

  return (
    <div style={{ maxWidth: 860, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 'var(--space-lg)' }}>
        <h1 style={{ fontSize: 'var(--text-3xl)', marginBottom: '0.15rem' }}>Ask Atlas</h1>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>
          Personal finance guidance, on demand
        </p>
      </div>

      {/* Empty state — topic grid */}
      {!hasMessages && (
        <div style={{ marginBottom: 'var(--space-xl)' }}>
          <p style={{ fontSize: 'var(--text-base)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-lg)', lineHeight: 1.6 }}>
            {firstName ? `${firstName}, what` : 'What'} can I help you with? Pick a topic or type your own question below.
          </p>

          <div className="grid-2" style={{ gap: 'var(--space-md)' }}>
            {TOPICS.map((topic) => (
              <div key={topic.category} className="card atlas-topic-card" style={{ padding: '1rem 1.1rem' }}>
                <span className="label-caps" style={{ display: 'block', marginBottom: '0.6rem' }}>{topic.category}</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  {topic.prompts.map((prompt, j) => (
                    <button
                      key={j}
                      className="atlas-prompt-btn"
                      onClick={() => sendMessage(prompt)}
                      style={{
                        background: 'none', border: '1px solid var(--color-border)',
                        borderRadius: 4, padding: '0.5rem 0.7rem', textAlign: 'left',
                        fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)',
                        cursor: 'pointer', lineHeight: 1.45,
                      }}
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Chat area */}
      {hasMessages && (
        <div className="card atlas-chat-card" style={{
          display: 'flex', flexDirection: 'column',
          height: 'calc(100vh - 220px)', minHeight: 400,
          padding: 0, overflow: 'hidden',
        }}>
          {/* Chat toolbar */}
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '0.5rem 0.85rem', borderBottom: '1px solid var(--color-border)',
            background: 'var(--color-surface)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span style={{
                width: 7, height: 7, borderRadius: '50%',
                background: loading ? 'var(--color-gold)' : 'var(--color-positive)',
                boxShadow: loading ? '0 0 6px var(--color-gold-40)' : '0 0 6px rgba(46,125,94,0.3)',
                animation: loading ? 'statusPulse 1.4s ease-in-out infinite' : 'none',
              }} />
              <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>
                {loading ? 'Atlas is thinking...' : 'Atlas'}
              </span>
            </div>
            <button onClick={clearChat} className="atlas-clear-btn" style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)',
              textTransform: 'uppercase', letterSpacing: '0.05em',
              padding: '0.25rem 0.5rem', borderRadius: 'var(--radius-sm)',
            }}>
              New conversation
            </button>
          </div>

          {/* Messages */}
          <div style={{
            flex: 1, overflowY: 'auto', padding: '1.1rem 1.1rem 0.6rem',
            display: 'flex', flexDirection: 'column', gap: '0.9rem',
          }}>
            {messages.map((msg, i) => (
              <div key={i} className="atlas-msg" style={{
                display: 'flex', gap: '0.6rem',
                flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
                animationDelay: `${Math.min(i * 50, 200)}ms`,
              }}>
                {/* Avatar */}
                <div style={{
                  width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 'var(--text-xs)', fontWeight: 600, marginTop: 2,
                  background: msg.role === 'user' ? 'var(--color-navy)' : 'var(--color-gold-15)',
                  color: msg.role === 'user' ? 'var(--color-gold)' : 'var(--color-gold-dim)',
                  border: msg.role === 'user' ? 'none' : '1px solid var(--color-gold-20)',
                }}>
                  {msg.role === 'user' ? (firstName?.[0] || 'Y').toUpperCase() : 'A'}
                </div>

                {/* Bubble */}
                <div style={{
                  maxWidth: '78%',
                  padding: '0.7rem 0.9rem', borderRadius: 8,
                  background: msg.role === 'user' ? 'var(--color-navy)' : 'var(--color-surface)',
                  color: msg.role === 'user' ? '#E8E0D0' : 'var(--color-text-secondary)',
                  fontSize: 'var(--text-base)', lineHeight: 1.65,
                  border: msg.role === 'user' ? 'none' : '1px solid var(--color-border)',
                }}>
                  {msg.role === 'assistant' ? formatMessage(msg.text) : msg.text}
                </div>
              </div>
            ))}
            {loading && (
              <div className="atlas-msg" style={{ display: 'flex', gap: '0.6rem' }}>
                <div style={{
                  width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 'var(--text-xs)', fontWeight: 600,
                  background: 'var(--color-gold-15)', color: 'var(--color-gold-dim)',
                  border: '1px solid var(--color-gold-20)',
                }}>A</div>
                <div style={{
                  padding: '0.7rem 0.9rem', borderRadius: 6,
                  background: 'var(--color-surface)', border: '1px solid var(--color-border)',
                  display: 'flex', alignItems: 'center', gap: '0.35rem',
                }}>
                  <span style={{ display: 'inline-flex', gap: '0.25rem' }}>
                    {[0, 1, 2].map(n => (
                      <span key={n} style={{
                        width: 5, height: 5, borderRadius: '50%', background: 'var(--color-gold)',
                        animation: `dotBounce 1.2s ease-in-out ${n * 0.15}s infinite`,
                      }} />
                    ))}
                  </span>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input bar */}
          <form onSubmit={handleSubmit} style={{
            padding: '0.75rem 1.1rem', borderTop: '1px solid var(--color-border)',
            display: 'flex', gap: '0.5rem', background: 'var(--color-surface)',
          }}>
            <input
              ref={inputRef}
              className="atlas-input"
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Ask a question..."
              disabled={loading}
              style={{
                flex: 1, padding: '0.55rem 0.8rem', borderRadius: 4,
                border: '1px solid var(--color-border)', background: 'var(--color-bg)',
                color: 'var(--color-text-primary)', fontSize: 'var(--text-base)', outline: 'none',
                transition: 'border-color 0.2s, box-shadow 0.2s',
              }}
            />
            <button type="submit" disabled={loading || !input.trim()} className="atlas-send-btn" style={{
              padding: '0.55rem 1.1rem', borderRadius: 4,
              border: 'none', background: 'var(--color-navy)',
              color: 'var(--color-gold)', cursor: 'pointer',
              opacity: loading || !input.trim() ? 0.35 : 1,
              fontSize: 'var(--text-sm)', fontWeight: 500,
              letterSpacing: '0.03em',
            }}>
              Send
            </button>
          </form>
        </div>
      )}

      {/* Input when no messages — prominent bottom bar */}
      {!hasMessages && (
        <form onSubmit={handleSubmit} style={{
          display: 'flex', gap: '0.5rem',
        }}>
          <input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Or type your own question..."
            disabled={loading}
            className="input atlas-input"
            style={{
              flex: 1, padding: '0.6rem 0.85rem',
              fontSize: 'var(--text-base)',
              transition: 'border-color 0.2s, box-shadow 0.2s',
            }}
          />
          <button type="submit" disabled={loading || !input.trim()} className="btn btn-primary atlas-send-btn" style={{
            opacity: loading || !input.trim() ? 0.35 : 1,
          }}>
            Ask Atlas
          </button>
        </form>
      )}

      {/* Disclaimer */}
      <p style={{
        fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)',
        textAlign: 'center', marginTop: 'var(--space-md)', lineHeight: 1.4,
      }}>
        Atlas provides general financial education, not personalized investment advice.
      </p>
    </div>
  )
}
