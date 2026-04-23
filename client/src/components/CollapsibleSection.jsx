import { useState } from 'react'

export default function CollapsibleSection({ title, sectionKey, defaultOpen = true, children }) {
  const [open, setOpen] = useState(() => {
    const stored = localStorage.getItem('atlas_section_' + sectionKey)
    return stored !== null ? JSON.parse(stored) : defaultOpen
  })

  const toggle = () => {
    const next = !open
    setOpen(next)
    localStorage.setItem('atlas_section_' + sectionKey, JSON.stringify(next))
  }

  return (
    <div style={{ marginBottom: 'var(--space-lg)' }}>
      <div
        onClick={toggle}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          cursor: 'pointer', padding: '0.5rem 0', marginBottom: open ? '0.5rem' : 0,
          borderBottom: open ? '1px solid var(--color-border)' : 'none',
          userSelect: 'none',
        }}
      >
        <span className="label-caps" style={{ fontSize: 'var(--text-base)', letterSpacing: '0.06em' }}>{title}</span>
        <span style={{
          fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)',
          transform: open ? 'rotate(90deg)' : 'none',
          transition: 'transform 0.15s ease',
          display: 'inline-block',
        }}>&#9654;</span>
      </div>
      {open && children}
    </div>
  )
}
