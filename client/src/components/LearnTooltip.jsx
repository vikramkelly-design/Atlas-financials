import { useState } from 'react'
import { LEARN_CONTENT } from '../data/learnContent'

export default function LearnTooltip({ term }) {
  const [open, setOpen] = useState(false)
  const content = LEARN_CONTENT[term]
  if (!content) return null

  return (
    <span style={{ position: 'relative', display: 'inline-block' }}>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(!open) }}
        aria-label={`Learn about ${term}`}
        style={{
          width: 16, height: 16, borderRadius: '50%',
          border: '1px solid var(--color-border)',
          background: 'transparent', color: 'var(--color-text-muted)',
          fontSize: 10, cursor: 'pointer',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          marginLeft: 4, verticalAlign: 'middle',
          fontFamily: 'var(--font-sans)', fontWeight: 700,
        }}
      >?</button>
      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 99 }} />
          <div style={{
            position: 'absolute', bottom: 24, left: 0, zIndex: 100,
            width: 280, background: 'var(--color-sidebar)',
            border: '1px solid var(--color-sidebar-hover)',
            borderRadius: 'var(--radius-md)', padding: 'var(--space-md)',
            boxShadow: 'var(--shadow-elevated)',
          }}>
            <div style={{ fontFamily: 'var(--font-serif)', fontSize: 16, color: 'var(--color-gold)', marginBottom: 8 }}>
              {term}
            </div>
            <div style={{ fontSize: 13, color: 'var(--color-text-sidebar)', lineHeight: 1.5, marginBottom: 8 }}>
              {content.short}
            </div>
            <div style={{ fontSize: 12, color: 'var(--color-text-muted)', lineHeight: 1.5, marginBottom: 8, fontStyle: 'italic' }}>
              Example: {content.example}
            </div>
            <div style={{
              fontSize: 12, color: 'var(--color-gold-dim)', lineHeight: 1.5,
              borderTop: '1px solid var(--color-sidebar-hover)', paddingTop: 8,
            }}>
              {content.why}
            </div>
            <button onClick={() => setOpen(false)} style={{
              position: 'absolute', top: 8, right: 8,
              background: 'none', border: 'none',
              color: 'var(--color-text-muted)', cursor: 'pointer', fontSize: 12,
            }}>x</button>
          </div>
        </>
      )}
    </span>
  )
}
