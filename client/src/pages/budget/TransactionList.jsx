import { useState } from 'react'
import { formatCurrency } from '../../components/NumberDisplay'

const CATEGORIES = ['Food & Dining', 'Transport', 'Shopping', 'Subscriptions', 'Health', 'Entertainment', 'Income', 'Transfer', 'Other']

function formatDate(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function TransactionList({ transactions, categoryFilter, onAdd, onUpdateCategory, onDelete }) {
  const [sortBy, setSortBy] = useState('date')
  const [sortDir, setSortDir] = useState('desc')
  const [addForm, setAddForm] = useState({ date: '', description: '', amount: '', category: 'Other' })
  const [showAdd, setShowAdd] = useState(false)

  const toggleSort = (field) => {
    if (sortBy === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortBy(field); setSortDir('desc') }
  }

  const filtered = categoryFilter
    ? transactions.filter(t => t.category === categoryFilter)
    : transactions

  const sorted = [...filtered].sort((a, b) => {
    const dir = sortDir === 'asc' ? 1 : -1
    if (sortBy === 'date') return dir * (a.date > b.date ? 1 : -1)
    if (sortBy === 'amount') return dir * (a.amount - b.amount)
    return 0
  })

  const handleAdd = (e) => {
    e.preventDefault()
    if (!addForm.date || !addForm.description || !addForm.amount) return
    onAdd({
      date: addForm.date,
      description: addForm.description,
      amount: parseFloat(addForm.amount),
      category: addForm.category,
    })
    setAddForm({ date: '', description: '', amount: '', category: 'Other' })
    setShowAdd(false)
  }

  const sortArrow = (field) => {
    if (sortBy !== field) return ''
    return sortDir === 'asc' ? ' ↑' : ' ↓'
  }

  return (
    <div className="card" style={{ marginBottom: 'var(--space-lg)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
        <h3 style={{ fontSize: 'var(--text-lg)', margin: 0 }}>
          Transactions
          {categoryFilter && <span className="text-faint" style={{ fontSize: 'var(--text-sm)', marginLeft: '0.5rem' }}>({categoryFilter})</span>}
        </h3>
        <button className="btn btn-ghost" onClick={() => setShowAdd(!showAdd)} style={{ fontSize: 'var(--text-sm)', padding: '0.25rem 0.6rem' }}>
          {showAdd ? 'Cancel' : '+ Add'}
        </button>
      </div>

      {/* Add form */}
      {showAdd && (
        <form onSubmit={handleAdd} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ flex: '0 1 120px' }}>
            <label style={{ display: 'block', fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>Date</label>
            <input className="input" type="date" value={addForm.date} onChange={e => setAddForm(f => ({ ...f, date: e.target.value }))} />
          </div>
          <div style={{ flex: '1 1 160px' }}>
            <label style={{ display: 'block', fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>Description</label>
            <input className="input" value={addForm.description} onChange={e => setAddForm(f => ({ ...f, description: e.target.value }))} placeholder="e.g. Grocery store" />
          </div>
          <div style={{ flex: '0 1 100px' }}>
            <label style={{ display: 'block', fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>Amount</label>
            <input className="input mono" type="number" step="0.01" value={addForm.amount} onChange={e => setAddForm(f => ({ ...f, amount: e.target.value }))} placeholder="-50.00" />
          </div>
          <div style={{ flex: '0 1 130px' }}>
            <label style={{ display: 'block', fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>Category</label>
            <select className="input" value={addForm.category} onChange={e => setAddForm(f => ({ ...f, category: e.target.value }))}>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <button className="btn btn-primary" type="submit" style={{ height: 36 }}>Add</button>
        </form>
      )}

      {/* Table */}
      {sorted.length === 0 ? (
        <p className="text-faint" style={{ textAlign: 'center', padding: '1.5rem 0', fontSize: 'var(--text-sm)' }}>
          {categoryFilter ? `No ${categoryFilter} transactions this month.` : 'No transactions this month. Import a CSV or add one manually.'}
        </p>
      ) : (
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th onClick={() => toggleSort('date')} style={{ cursor: 'pointer', userSelect: 'none' }}>Date{sortArrow('date')}</th>
                <th>Description</th>
                <th>Category</th>
                <th onClick={() => toggleSort('amount')} style={{ cursor: 'pointer', userSelect: 'none', textAlign: 'right' }}>Amount{sortArrow('amount')}</th>
                <th style={{ width: 36 }} />
              </tr>
            </thead>
            <tbody>
              {sorted.map(t => (
                <tr key={t.id}>
                  <td style={{ whiteSpace: 'nowrap', fontSize: 'var(--text-sm)' }}>{formatDate(t.date)}</td>
                  <td style={{ fontSize: 'var(--text-sm)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.description}</td>
                  <td>
                    <select
                      value={t.category || 'Other'}
                      onChange={e => onUpdateCategory(t.id, e.target.value)}
                      style={{
                        background: 'transparent', border: 'none', color: 'var(--color-text-secondary)',
                        fontSize: 'var(--text-xs)', cursor: 'pointer', padding: '0.15rem',
                      }}
                    >
                      {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </td>
                  <td className="mono" style={{
                    textAlign: 'right', fontSize: 'var(--text-sm)', fontWeight: 500,
                    color: t.amount < 0 ? 'var(--color-negative)' : 'var(--color-positive)',
                  }}>
                    {formatCurrency(t.amount)}
                  </td>
                  <td>
                    <button
                      className="btn btn-ghost"
                      onClick={() => onDelete(t.id)}
                      style={{ padding: '0.15rem 0.3rem', fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}
                      aria-label="Delete transaction"
                    >
                      ×
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {sorted.length > 0 && (
        <p className="text-faint" style={{ fontSize: 'var(--text-xs)', marginTop: '0.5rem', textAlign: 'right' }}>
          {sorted.length} transaction{sorted.length !== 1 ? 's' : ''}
          {categoryFilter ? ` in ${categoryFilter}` : ''}
        </p>
      )}
    </div>
  )
}
