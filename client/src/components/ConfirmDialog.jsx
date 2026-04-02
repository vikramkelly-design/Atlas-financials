import { useEffect, useRef } from 'react'

export default function ConfirmDialog({ open, title, message, onConfirm, onCancel, danger = false }) {
  const cancelRef = useRef()

  useEffect(() => {
    if (open) {
      // Focus the cancel button on open
      cancelRef.current?.focus()
      const handleEsc = (e) => { if (e.key === 'Escape') onCancel() }
      document.addEventListener('keydown', handleEsc)
      return () => document.removeEventListener('keydown', handleEsc)
    }
  }, [open, onCancel])

  if (!open) return null

  return (
    <div onClick={onCancel} role="dialog" aria-modal="true" aria-labelledby="confirm-dialog-title" style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', display: 'flex',
      alignItems: 'center', justifyContent: 'center', zIndex: 9999,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 2,
        padding: 'var(--space-lg)', maxWidth: 380, width: '90%',
      }}>
        <h3 id="confirm-dialog-title" style={{ fontSize: 'var(--text-lg)', marginBottom: 'var(--space-sm)', color: 'var(--color-text)' }}>{title}</h3>
        <p style={{ fontSize: 'var(--text-base)', color: 'var(--color-text-muted)', marginBottom: 'var(--space-lg)', lineHeight: 1.5 }}>{message}</p>
        <div style={{ display: 'flex', gap: 'var(--space-sm)', justifyContent: 'flex-end' }}>
          <button ref={cancelRef} className="btn btn-ghost" onClick={onCancel}>Cancel</button>
          <button className={danger ? 'btn btn-danger' : 'btn btn-primary'} onClick={onConfirm}>
            {danger ? 'Delete' : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  )
}
