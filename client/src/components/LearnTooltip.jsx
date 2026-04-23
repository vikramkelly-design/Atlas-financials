import { useState, useRef } from 'react'
import { LEARN_CONTENT } from '../data/learnContent'

export default function LearnTooltip({ term }) {
  const [open, setOpen] = useState(false)
  const btnRef = useRef(null)
  const [pos, setPos] = useState({ top: 0, left: 0 })
  const content = LEARN_CONTENT[term]
  if (!content) return null

  const handleClick = (e) => {
    e.stopPropagation()
    if (!open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect()
      setPos({
        top: rect.top - 8,
        left: Math.min(Math.max(rect.left - 120, 8), window.innerWidth - 276),
      })
    }
    setOpen(!open)
  }

  return (
    <span style={{ position: 'relative', display: 'inline-block' }}>
      <button
        ref={btnRef}
        onClick={handleClick}
        aria-label={`Learn about ${term}`}
        style={{
          background: 'none', border: '1px solid var(--color-border-dark)', borderRadius: '50%',
          width: 14, height: 14, fontSize: 'var(--text-xs)', lineHeight: '12px', textAlign: 'center',
          cursor: 'pointer', color: 'var(--color-text-secondary)',
          padding: 7, margin: -7, marginLeft: -4,
          fontWeight: 700, verticalAlign: 'middle',
        }}
        title="Click for explanation"
      >?</button>
      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 99 }} />
          <div style={{
            position: 'fixed', top: pos.top, left: pos.left, transform: 'translateY(-100%)',
            width: 260, padding: '0.65rem 0.75rem',
            background: 'var(--color-surface)', border: '1px solid var(--color-border)',
            borderRadius: 6, fontSize: 'var(--text-sm)', lineHeight: 1.5,
            color: 'var(--color-text-primary)', zIndex: 100,
            whiteSpace: 'normal', wordWrap: 'break-word', overflow: 'hidden',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
          }}>
            <div style={{ fontWeight: 700, color: 'var(--color-gold)', marginBottom: 6 }}>
              {term}
            </div>
            <div style={{ marginBottom: 6 }}>
              {content.short}
            </div>
            <div style={{ color: 'var(--color-text-secondary)', fontStyle: 'italic', marginBottom: 6 }}>
              Example: {content.example}
            </div>
            <div style={{
              color: 'var(--color-text-secondary)',
              borderTop: '1px solid var(--color-border)', paddingTop: 6,
            }}>
              {content.why}
            </div>
          </div>
        </>
      )}
    </span>
  )
}
