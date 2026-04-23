import { useState } from 'react'
import { formatCurrency } from '../../components/NumberDisplay'

const CATEGORIES = ['Food & Dining', 'Transport', 'Shopping', 'Subscriptions', 'Health', 'Entertainment', 'Other']

const CATEGORY_ICONS = {
  'Food & Dining': '🍽', Transport: '🚗', Shopping: '🛍', Subscriptions: '📱',
  Health: '💊', Entertainment: '🎬', Other: '📦',
}

function progressColor(pct) {
  if (pct > 85) return 'var(--color-negative)'
  if (pct > 60) return 'var(--color-gold)'
  return 'var(--color-positive)'
}

export default function CategoryGrid({ spending, goals, onUpdateGoal, onSelectCategory, selectedCategory }) {
  const [editingCat, setEditingCat] = useState(null)
  const [limitInput, setLimitInput] = useState('')

  const startEdit = (cat, e) => {
    e.stopPropagation()
    setEditingCat(cat)
    setLimitInput(String(goals[cat] || ''))
  }

  const saveLimit = (cat) => {
    const val = parseFloat(limitInput)
    if (val && val > 0) {
      onUpdateGoal(cat, val)
    }
    setEditingCat(null)
  }

  // Only show categories that have spending or goals
  const activeCategories = CATEGORIES.filter(cat => {
    const spent = Math.abs(spending[cat] || 0)
    const limit = goals[cat] || 0
    return spent > 0 || limit > 0
  })

  // Always show at least the standard set even if empty
  const categoriesToShow = activeCategories.length > 0 ? CATEGORIES : CATEGORIES

  return (
    <div style={{ marginBottom: 'var(--space-lg)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
        <h3 style={{ fontSize: 'var(--text-lg)', margin: 0 }}>Spending by Category</h3>
        {selectedCategory && (
          <button className="btn btn-ghost" onClick={() => onSelectCategory(null)} style={{ fontSize: 'var(--text-xs)', padding: '0.2rem 0.5rem' }}>
            Clear filter
          </button>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.75rem' }}>
        {categoriesToShow.map(cat => {
          const spent = Math.abs(spending[cat] || 0)
          const limit = goals[cat] || 0
          const pct = limit > 0 ? Math.min(100, (spent / limit) * 100) : 0
          const isSelected = selectedCategory === cat
          const isEditing = editingCat === cat

          return (
            <div
              key={cat}
              onClick={() => onSelectCategory(isSelected ? null : cat)}
              className="card"
              style={{
                cursor: 'pointer', padding: '0.75rem',
                border: isSelected ? '2px solid var(--color-gold)' : '1px solid var(--color-border)',
                background: isSelected ? 'var(--color-gold-15)' : undefined,
                transition: 'border-color 0.15s, background 0.15s',
              }}
            >
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <span style={{ fontSize: 'var(--text-base)' }}>{CATEGORY_ICONS[cat] || '📦'}</span>
                  <span style={{ fontSize: 'var(--text-sm)', fontWeight: 500 }}>{cat}</span>
                </div>
                <button
                  className="btn btn-ghost"
                  onClick={(e) => startEdit(cat, e)}
                  style={{ padding: '0.15rem 0.3rem', fontSize: 'var(--text-xs)' }}
                  aria-label={`Edit ${cat} limit`}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                </button>
              </div>

              {/* Amount + limit */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.35rem' }}>
                <span className="mono" style={{ fontSize: 'var(--text-base)', fontWeight: 600, color: spent > 0 ? 'var(--color-text-primary)' : 'var(--color-text-muted)' }}>
                  {formatCurrency(spent)}
                </span>
                {isEditing ? (
                  <div style={{ display: 'flex', gap: '0.25rem' }} onClick={e => e.stopPropagation()}>
                    <input
                      className="input mono"
                      type="number"
                      value={limitInput}
                      onChange={e => setLimitInput(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && saveLimit(cat)}
                      autoFocus
                      placeholder="$0"
                      style={{ width: 70, fontSize: 'var(--text-xs)', padding: '0.15rem 0.3rem' }}
                    />
                    <button className="btn btn-primary" onClick={() => saveLimit(cat)} style={{ fontSize: 'var(--text-xs)', padding: '0.15rem 0.4rem' }}>Set</button>
                  </div>
                ) : (
                  <span className="text-faint mono" style={{ fontSize: 'var(--text-xs)' }}>
                    {limit > 0 ? `/ ${formatCurrency(limit)}` : 'No limit'}
                  </span>
                )}
              </div>

              {/* Progress bar */}
              {limit > 0 && (
                <div style={{ height: 5, borderRadius: 3, overflow: 'hidden', background: 'var(--color-surface-2)' }}>
                  <div style={{
                    height: '100%', width: `${pct}%`, borderRadius: 3,
                    background: progressColor(pct),
                    transition: 'width 0.3s ease',
                  }} />
                </div>
              )}
              {limit > 0 && pct > 85 && (
                <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-negative)', marginTop: '0.25rem' }}>
                  {pct >= 100 ? 'Over limit' : 'Nearing limit'}
                </p>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
