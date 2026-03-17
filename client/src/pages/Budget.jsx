import { useState, useEffect, useRef } from 'react'
import Papa from 'papaparse'
import useApi, { api } from '../hooks/useApi'
import { formatCurrency } from '../components/NumberDisplay'
import LoadingSpinner from '../components/LoadingSpinner'
import ErrorBanner from '../components/ErrorBanner'
import PageChat from '../components/PageChat'

const CATEGORIES = ['Food & Dining', 'Transport', 'Shopping', 'Subscriptions', 'Health', 'Entertainment', 'Income', 'Transfer', 'Other']
const CATEGORY_COLORS = {
  'Food & Dining': '#8B6914',
  'Transport': '#3B6B3B',
  'Shopping': '#8B3A2A',
  'Subscriptions': '#5B4FA0',
  'Health': '#2A6B8B',
  'Entertainment': '#8B5E3A',
  'Income': '#3B8B3B',
  'Transfer': '#6B6560',
  'Other': '#9E9890'
}

function normalizeHeaders(row) {
  const keys = Object.keys(row)
  const find = (candidates) => {
    for (const c of candidates) {
      const found = keys.find(k => k.toLowerCase().trim() === c.toLowerCase())
      if (found) return row[found]
    }
    return null
  }

  const amount = parseFloat(find(['Amount', 'Debit', 'Credit', 'Transaction Amount']) || '0')
  const date = find(['Date', 'Transaction Date', 'Posted Date']) || ''
  const description = find(['Description', 'Merchant', 'Details', 'Memo']) || ''

  return { amount, date, description }
}

export default function Budget() {
  const fileRef = useRef()
  const { loading, error, get, post, patch, setError } = useApi()
  const [transactions, setTransactions] = useState([])
  const [months, setMonths] = useState([])
  const [selectedMonth, setSelectedMonth] = useState('')
  const [preview, setPreview] = useState(null)
  const [importing, setImporting] = useState(false)
  const [summary, setSummary] = useState(null)
  const [summaryLoading, setSummaryLoading] = useState(false)
  const [goals, setGoals] = useState({})
  const [dragActive, setDragActive] = useState(false)
  const [sortField, setSortField] = useState('date')
  const [sortDir, setSortDir] = useState(-1)
  const [showGuide, setShowGuide] = useState(false)
  const [analysis, setAnalysis] = useState(null)
  const [analysisLoading, setAnalysisLoading] = useState(false)
  const [tab, setTab] = useState('budget')

  const fetchTransactions = async (month) => {
    try {
      const url = month ? `/api/budget/transactions?month=${month}` : '/api/budget/transactions'
      const res = await get(url)
      setTransactions(res.data)
      // Extract unique months
      const allRes = await get('/api/budget/transactions')
      const uniqueMonths = [...new Set(allRes.data.map(t => t.month).filter(Boolean))].sort().reverse()
      setMonths(uniqueMonths)
      if (!month && uniqueMonths.length > 0) {
        setSelectedMonth(uniqueMonths[0])
        const filtered = allRes.data.filter(t => t.month === uniqueMonths[0])
        setTransactions(filtered)
      }
    } catch (err) { console.error(err) }
  }

  const fetchGoals = async () => {
    try {
      const res = await get('/api/budget/goals')
      const goalsMap = {}
      res.data.forEach(g => { goalsMap[g.category] = g.monthly_limit })
      setGoals(goalsMap)
    } catch (err) { console.error(err) }
  }

  useEffect(() => { fetchTransactions(); fetchGoals() }, [])

  const handleFile = (file) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const parsed = results.data
          .map(normalizeHeaders)
          .filter(r => r.amount !== 0 && r.description.trim() !== '')
        setPreview(parsed)
      }
    })
  }

  const onDrop = (e) => {
    e.preventDefault()
    setDragActive(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  const onFileSelect = (e) => {
    const file = e.target.files[0]
    if (file) handleFile(file)
  }

  const doImport = async () => {
    if (!preview) return
    setImporting(true)
    try {
      const importRes = await post('/api/budget/import', { transactions: preview })
      const imported = importRes.data.transactions
      setPreview(null)
      await fetchTransactions()
      // Trigger AI analysis
      setAnalysisLoading(true)
      try {
        const analysisRes = await post('/api/budget/analyze', { transactions: imported })
        setAnalysis(analysisRes.data.analysis)
      } catch (err) { console.error('Analysis error:', err) }
      setAnalysisLoading(false)
    } catch (err) { console.error(err) }
    setImporting(false)
  }

  const onMonthChange = async (month) => {
    setSelectedMonth(month)
    setSummary(null)
    try {
      const res = await get(`/api/budget/transactions?month=${month}`)
      setTransactions(res.data)
    } catch (err) { console.error(err) }
  }

  const fetchSummary = async () => {
    if (!selectedMonth) return
    setSummaryLoading(true)
    try {
      const res = await get(`/api/budget/summary/${selectedMonth}`)
      setSummary(res.data)
    } catch (err) { console.error(err) }
    setSummaryLoading(false)
  }

  const updateCategory = async (id, category) => {
    try {
      await patch(`/api/budget/transaction/${id}`, { category })
      setTransactions(prev => prev.map(t => t.id === id ? { ...t, category } : t))
    } catch (err) { console.error(err) }
  }

  const saveGoals = async () => {
    const goalsArray = Object.entries(goals)
      .filter(([, limit]) => limit > 0)
      .map(([category, monthly_limit]) => ({ category, monthly_limit: parseFloat(monthly_limit) }))
    try {
      await post('/api/budget/goals', { goals: goalsArray })
    } catch (err) { console.error(err) }
  }

  // Spending by category
  const spendingByCategory = {}
  transactions.filter(t => t.amount < 0).forEach(t => {
    const cat = t.category || 'Other'
    spendingByCategory[cat] = (spendingByCategory[cat] || 0) + Math.abs(t.amount)
  })
  const totalSpent = Object.values(spendingByCategory).reduce((s, v) => s + v, 0)

  const renderBold = (text) => {
    const parts = text.split(/(\*\*[^*]+\*\*)/)
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i} style={{ color: '#6B1A1A' }}>{part.slice(2, -2)}</strong>
      }
      return part
    })
  }

  // Sorted transactions
  const sorted = [...transactions].sort((a, b) => {
    if (sortField === 'date') return sortDir * (new Date(a.date) - new Date(b.date))
    if (sortField === 'amount') return sortDir * (a.amount - b.amount)
    return 0
  })

  return (
    <div>
      <h1 style={{ fontSize: '1.75rem', marginBottom: '1rem' }}>Budget</h1>

      <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '1.5rem', borderBottom: '2px solid var(--color-border)' }}>
        {[
          { key: 'budget', label: 'Budget' },
          { key: 'chat', label: 'AI Chat' },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            padding: '0.6rem 1.25rem', border: 'none', borderBottom: tab === t.key ? '2px solid var(--color-accent)' : '2px solid transparent',
            background: 'none', cursor: 'pointer', fontWeight: tab === t.key ? 600 : 400,
            color: tab === t.key ? 'var(--color-accent)' : 'var(--color-text-muted)',
            fontSize: '0.9rem', marginBottom: '-2px', transition: 'all 0.15s ease',
          }}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'chat' && <PageChat context="budget" />}

      {tab === 'budget' && <>
      {/* CSV Import */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div
          onDragOver={(e) => { e.preventDefault(); setDragActive(true) }}
          onDragLeave={() => setDragActive(false)}
          onDrop={onDrop}
          onClick={() => fileRef.current?.click()}
          style={{
            border: `2px dashed ${dragActive ? 'var(--color-accent)' : 'var(--color-border-dark)'}`,
            borderRadius: 8,
            padding: '2rem',
            textAlign: 'center',
            cursor: 'pointer',
            background: dragActive ? 'var(--color-accent-light)' : 'transparent',
            transition: 'all 0.15s ease'
          }}
        >
          <p style={{ fontSize: '1rem', color: 'var(--color-text-muted)' }}>Drop your bank CSV here, or click to browse</p>
          <input ref={fileRef} type="file" accept=".csv" onChange={onFileSelect} style={{ display: 'none' }} />
        </div>

        <button className="btn btn-ghost" onClick={() => setShowGuide(!showGuide)} style={{ marginTop: '0.75rem', fontSize: '0.8rem' }}>
          {showGuide ? 'Hide' : 'How to export your CSV'}
        </button>

        {showGuide && (
          <div style={{ marginTop: '0.75rem', padding: '1rem', background: 'var(--color-surface-2)', borderRadius: 8, fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
            <div style={{ marginBottom: '0.75rem' }}>
              <strong>Chase:</strong>
              <ol style={{ paddingLeft: '1.25rem', marginTop: '0.25rem' }}><li>Log in to chase.com</li><li>Go to your account activity</li><li>Click "Download account activity"</li><li>Select CSV format and date range</li></ol>
            </div>
            <div style={{ marginBottom: '0.75rem' }}>
              <strong>Bank of America:</strong>
              <ol style={{ paddingLeft: '1.25rem', marginTop: '0.25rem' }}><li>Log in to bankofamerica.com</li><li>Go to Statements & Documents</li><li>Click "Download transactions"</li><li>Choose CSV and your date range</li></ol>
            </div>
            <div style={{ marginBottom: '0.75rem' }}>
              <strong>Wells Fargo:</strong>
              <ol style={{ paddingLeft: '1.25rem', marginTop: '0.25rem' }}><li>Log in to wellsfargo.com</li><li>Go to Account Activity</li><li>Click "Download" at the top</li><li>Select Comma Separated (CSV)</li></ol>
            </div>
            <div>
              <strong>Capital One:</strong>
              <ol style={{ paddingLeft: '1.25rem', marginTop: '0.25rem' }}><li>Log in to capitalone.com</li><li>Select your account</li><li>Click "Download Transactions"</li><li>Choose CSV format</li></ol>
            </div>
          </div>
        )}

        {/* Preview */}
        {preview && (
          <div style={{ marginTop: '1rem' }}>
            <h3 style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>Preview ({preview.length} transactions)</h3>
            <div className="table-wrapper">
              <table>
                <thead><tr><th>Date</th><th>Description</th><th>Amount</th></tr></thead>
                <tbody>
                  {preview.slice(0, 5).map((t, i) => (
                    <tr key={i}>
                      <td>{t.date}</td>
                      <td>{t.description}</td>
                      <td className="mono" style={{ color: t.amount < 0 ? 'var(--color-danger)' : 'var(--color-success)' }}>{formatCurrency(t.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {preview.length > 5 && <p className="text-faint" style={{ fontSize: '0.8rem', marginTop: '0.35rem' }}>...and {preview.length - 5} more</p>}
            <button className="btn btn-primary" onClick={doImport} disabled={importing} style={{ marginTop: '0.75rem' }}>
              {importing ? 'Importing...' : `Import ${preview.length} transactions`}
            </button>
          </div>
        )}
      </div>

      {/* AI Analysis */}
      {(analysisLoading || analysis) && (
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: analysisLoading ? '#C9A84C' : '#2A5C3A' }} />
              <h2 style={{ fontSize: '1.25rem' }}>AI Spending Analysis</h2>
            </div>
            {analysis && (
              <button className="btn btn-ghost" onClick={() => setAnalysis(null)} style={{ fontSize: '0.7rem', padding: '0.25rem 0.5rem' }}>
                Dismiss
              </button>
            )}
          </div>
          {analysisLoading ? (
            <div style={{ padding: '2rem', textAlign: 'center' }}>
              <div className="skeleton" style={{ height: 16, width: '60%', margin: '0 auto 0.75rem' }} />
              <div className="skeleton" style={{ height: 16, width: '80%', margin: '0 auto 0.75rem' }} />
              <div className="skeleton" style={{ height: 16, width: '45%', margin: '0 auto' }} />
              <p className="text-faint" style={{ fontSize: '0.78rem', marginTop: '1rem' }}>Analyzing your spending patterns...</p>
            </div>
          ) : (
            <div style={{ fontSize: '0.85rem', lineHeight: 1.7, color: 'var(--color-text)' }}>
              {analysis.split('\n').map((line, i) => {
                if (line.startsWith('## ')) {
                  return <h3 key={i} style={{ color: 'var(--color-accent)', marginTop: i > 0 ? '1.25rem' : 0, marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: '0.8rem' }}>{line.replace('## ', '')}</h3>
                }
                if (line.startsWith('- ')) {
                  return <div key={i} style={{ paddingLeft: '0.75rem', marginBottom: '0.25rem', borderLeft: '2px solid var(--color-border-dark)' }}>{renderBold(line.replace('- ', ''))}</div>
                }
                if (line.trim() === '') return <div key={i} style={{ height: '0.5rem' }} />
                return <p key={i} style={{ marginBottom: '0.25rem' }}>{renderBold(line)}</p>
              })}
            </div>
          )}
        </div>
      )}

      {/* Monthly Summary */}
      {months.length > 0 && (
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h2 style={{ fontSize: '1.25rem' }}>Monthly Summary</h2>
            <select className="select" value={selectedMonth} onChange={e => onMonthChange(e.target.value)}>
              {months.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>

          <span className="mono" style={{ fontSize: '1.75rem', color: 'var(--color-danger)' }}>
            {formatCurrency(totalSpent)}
          </span>
          <p className="text-muted" style={{ fontSize: '0.8rem', marginBottom: '1rem' }}>total spent</p>

          {/* Category bars */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.25rem' }}>
            {Object.entries(spendingByCategory).sort((a, b) => b[1] - a[1]).map(([cat, amount]) => (
              <div key={cat}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '0.2rem' }}>
                  <span>{cat}</span>
                  <span className="mono">{formatCurrency(amount)}</span>
                </div>
                <div style={{ height: 6, background: 'var(--color-surface-2)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%',
                    width: `${totalSpent > 0 ? (amount / totalSpent) * 100 : 0}%`,
                    background: CATEGORY_COLORS[cat] || 'var(--color-accent)',
                    borderRadius: 3
                  }} />
                </div>
              </div>
            ))}
          </div>

          {/* AI Summary */}
          {summary ? (
            <div style={{ padding: '1rem', background: 'var(--color-accent-light)', borderRadius: 8, marginBottom: '0.5rem' }}>
              <p style={{ fontSize: '0.9rem', lineHeight: 1.6 }}>{summary.summary}</p>
            </div>
          ) : (
            <button className="btn btn-ghost" onClick={fetchSummary} disabled={summaryLoading}>
              {summaryLoading ? 'Generating...' : 'Generate AI Summary'}
            </button>
          )}
          {summary && (
            <button className="btn btn-ghost" onClick={() => { setSummary(null); fetchSummary() }} style={{ fontSize: '0.8rem' }}>
              Regenerate summary
            </button>
          )}
        </div>
      )}

      {/* Transaction Table */}
      {transactions.length > 0 && (
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem' }}>Transactions</h2>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th onClick={() => { setSortField('date'); setSortDir(d => -d) }} style={{ cursor: 'pointer' }}>
                    Date {sortField === 'date' ? (sortDir > 0 ? '\u2191' : '\u2193') : ''}
                  </th>
                  <th>Description</th>
                  <th onClick={() => { setSortField('amount'); setSortDir(d => -d) }} style={{ cursor: 'pointer' }}>
                    Amount {sortField === 'amount' ? (sortDir > 0 ? '\u2191' : '\u2193') : ''}
                  </th>
                  <th>Category</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map(t => (
                  <tr key={t.id}>
                    <td style={{ whiteSpace: 'nowrap' }}>{t.date}</td>
                    <td>{t.description}</td>
                    <td className="mono" style={{ color: t.amount < 0 ? 'var(--color-danger)' : 'var(--color-success)', whiteSpace: 'nowrap' }}>
                      {formatCurrency(t.amount)}
                    </td>
                    <td>
                      <select className="select" value={t.category} onChange={e => updateCategory(t.id, e.target.value)} style={{ fontSize: '0.8rem', padding: '0.25rem 0.5rem' }}>
                        {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </td>
                    <td className="text-faint" style={{ fontSize: '0.8rem' }}>{t.notes || ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Budget Goals */}
      <div className="card">
        <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem' }}>Budget Goals</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1rem' }}>
          {CATEGORIES.filter(c => c !== 'Income' && c !== 'Transfer').map(cat => {
            const spent = spendingByCategory[cat] || 0
            const limit = goals[cat] || 0
            const over = limit > 0 && spent > limit
            return (
              <div key={cat} className="card" style={{
                padding: '1rem',
                background: over ? '#F5E8E8' : '#FFF8F0'
              }}>
                <h4 style={{ fontSize: '0.85rem', marginBottom: '0.5rem' }}>{cat}</h4>
                <input
                  className="input"
                  type="number"
                  step="1"
                  placeholder="Monthly limit"
                  value={goals[cat] || ''}
                  onChange={e => setGoals(prev => ({ ...prev, [cat]: e.target.value }))}
                  style={{ fontSize: '0.8rem', marginBottom: '0.5rem' }}
                />
                {limit > 0 && (
                  <>
                    <div className="progress-bar">
                      <div className="progress-bar-fill" style={{
                        width: `${Math.min(100, (spent / limit) * 100)}%`,
                        background: over ? '#8B3A2A' : '#1B2A4A'
                      }} />
                    </div>
                    <p className="mono" style={{ fontSize: '0.75rem', marginTop: '0.25rem', color: over ? 'var(--color-danger)' : 'var(--color-text-muted)' }}>
                      {formatCurrency(spent)} / {formatCurrency(limit)}
                    </p>
                  </>
                )}
              </div>
            )
          })}
        </div>
        <button className="btn btn-primary" onClick={saveGoals} style={{ marginTop: '1rem' }}>Save Goals</button>
      </div>
      </>}
    </div>
  )
}
