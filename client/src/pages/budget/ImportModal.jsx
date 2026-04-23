import { useState, useRef } from 'react'
import Papa from 'papaparse'
import useApi from '../../hooks/useApi'
import { formatCurrency } from '../../components/NumberDisplay'
import { useToast } from '../../components/Toast'

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

function renderBold(text) {
  const parts = text.split(/(\*\*[^*]+\*\*)/)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} style={{ color: 'var(--color-text-primary)' }}>{part.slice(2, -2)}</strong>
    }
    return part
  })
}

export default function ImportModal({ isOpen, onClose, onImportComplete }) {
  const { post } = useApi()
  const { toast } = useToast()
  const fileRef = useRef()
  const [preview, setPreview] = useState(null)
  const [importing, setImporting] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const [showGuide, setShowGuide] = useState(false)
  const [analysis, setAnalysis] = useState(null)
  const [analysisLoading, setAnalysisLoading] = useState(false)

  if (!isOpen) return null

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

  const doImport = async () => {
    if (!preview) return
    setImporting(true)
    try {
      const importRes = await post('/api/budget/import', { transactions: preview })
      const imported = importRes.data.transactions
      setPreview(null)
      toast('Transactions imported', 'success')

      // Trigger analysis
      setAnalysisLoading(true)
      try {
        const analysisRes = await post('/api/budget/analyze', { transactions: imported })
        setAnalysis(analysisRes.data.analysis)
      } catch (err) { toast(err.message || 'Analysis failed', 'error') }
      setAnalysisLoading(false)

      if (onImportComplete) onImportComplete()
    } catch (err) { toast(err.message || 'Import failed', 'error') }
    setImporting(false)
  }

  const handleClose = () => {
    setPreview(null)
    setAnalysis(null)
    setAnalysisLoading(false)
    onClose()
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300 }}
      onClick={handleClose}
    >
      <div
        className="card"
        style={{ maxWidth: 560, width: '100%', maxHeight: '90vh', overflow: 'auto' }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2 style={{ fontSize: 'var(--text-xl)', margin: 0 }}>Import Transactions</h2>
          <button className="btn btn-ghost" onClick={handleClose} style={{ fontSize: 'var(--text-lg)', padding: '0.2rem 0.5rem' }}>×</button>
        </div>

        {/* Drop zone */}
        {!analysis && (
          <div
            onDragOver={(e) => { e.preventDefault(); setDragActive(true) }}
            onDragLeave={() => setDragActive(false)}
            onDrop={(e) => { e.preventDefault(); setDragActive(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f) }}
            onClick={() => fileRef.current?.click()}
            style={{
              border: `2px dashed ${dragActive ? 'var(--color-gold)' : 'var(--color-border-dark)'}`,
              borderRadius: 8, padding: '1.5rem', textAlign: 'center', cursor: 'pointer',
              background: dragActive ? 'var(--color-gold-light)' : 'transparent',
              transition: 'all 0.15s ease',
            }}
          >
            <p style={{ fontSize: 'var(--text-base)', color: 'var(--color-text-secondary)' }}>Drop your bank CSV here, or click to browse</p>
            <input ref={fileRef} type="file" accept=".csv" onChange={(e) => { const f = e.target.files[0]; if (f) handleFile(f) }} style={{ display: 'none' }} />
          </div>
        )}

        {/* Bank guide */}
        {!analysis && (
          <>
            <button className="btn btn-ghost" onClick={() => setShowGuide(!showGuide)} style={{ marginTop: '0.5rem', fontSize: 'var(--text-sm)' }}>
              {showGuide ? 'Hide' : 'How to export your CSV'}
            </button>
            {showGuide && (
              <div style={{ marginTop: '0.5rem', padding: '0.75rem', background: 'var(--color-surface-2)', borderRadius: 8, fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>
                {['Chase', 'Bank of America', 'Wells Fargo', 'Capital One'].map(bank => (
                  <div key={bank} style={{ marginBottom: '0.5rem' }}>
                    <strong>{bank}:</strong> Log in → Account Activity → Download → CSV format
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* Preview */}
        {preview && !analysis && (
          <div style={{ marginTop: '0.75rem' }}>
            <h3 style={{ fontSize: 'var(--text-base)', marginBottom: '0.5rem' }}>Preview ({preview.length} transactions)</h3>
            <div className="table-wrapper">
              <table>
                <thead><tr><th>Date</th><th>Description</th><th>Amount</th></tr></thead>
                <tbody>
                  {preview.slice(0, 5).map((t, i) => (
                    <tr key={i}>
                      <td>{t.date}</td>
                      <td>{t.description}</td>
                      <td className="mono" style={{ color: t.amount < 0 ? 'var(--color-negative)' : 'var(--color-positive)' }}>{formatCurrency(t.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {preview.length > 5 && <p className="text-faint" style={{ fontSize: 'var(--text-sm)', marginTop: '0.25rem' }}>...and {preview.length - 5} more</p>}
            <button className="btn btn-primary" onClick={doImport} disabled={importing} style={{ marginTop: '0.75rem', width: '100%' }}>
              {importing ? 'Importing...' : `Import ${preview.length} transactions`}
            </button>
          </div>
        )}

        {/* Analysis loading */}
        {analysisLoading && (
          <div style={{ padding: '1.5rem', textAlign: 'center' }}>
            <div className="skeleton" style={{ height: 16, width: '60%', margin: '0 auto 0.75rem' }} />
            <div className="skeleton" style={{ height: 16, width: '80%', margin: '0 auto 0.75rem' }} />
            <div className="skeleton" style={{ height: 16, width: '45%', margin: '0 auto' }} />
            <p className="text-faint" style={{ fontSize: 'var(--text-sm)', marginTop: '0.75rem' }}>Analyzing your spending...</p>
          </div>
        )}

        {/* Analysis result */}
        {analysis && !analysisLoading && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--color-positive)' }} />
              <h3 style={{ fontSize: 'var(--text-base)', margin: 0 }}>AI Spending Analysis</h3>
            </div>
            <div style={{ fontSize: 'var(--text-sm)', lineHeight: 1.7, color: 'var(--color-text-primary)' }}>
              {analysis.split('\n').map((line, i) => {
                if (line.startsWith('## ')) return <h4 key={i} style={{ color: 'var(--color-gold)', marginTop: i > 0 ? '1rem' : 0, marginBottom: '0.3rem', textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: 'var(--text-xs)' }}>{line.replace('## ', '')}</h4>
                if (line.startsWith('- ')) return <div key={i} style={{ paddingLeft: '0.5rem', marginBottom: '0.15rem' }}>{renderBold(line.replace('- ', ''))}</div>
                if (line.trim() === '') return <div key={i} style={{ height: '0.4rem' }} />
                return <p key={i} style={{ marginBottom: '0.15rem' }}>{renderBold(line)}</p>
              })}
            </div>
            <button className="btn btn-primary" onClick={handleClose} style={{ marginTop: '1rem', width: '100%' }}>Done</button>
          </div>
        )}
      </div>
    </div>
  )
}
