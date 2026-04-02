import { useState, useEffect, useMemo } from 'react'
import { api } from '../hooks/useApi'
import { formatCurrency } from '../components/NumberDisplay'
import ConfirmDialog from '../components/ConfirmDialog'

const CATEGORIES = [
  { key: 'Emergency Fund', icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z' },
  { key: 'Debt Payoff', icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
  { key: 'Savings', icon: 'M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z' },
  { key: 'Investment', icon: 'M13 7h8m0 0v8m0-8l-8 8-4-4-6 6' },
  { key: 'Purchase', icon: 'M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z' },
  { key: 'Retirement', icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' },
  { key: 'Education', icon: 'M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z' },
  { key: 'Travel', icon: 'M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
  { key: 'General', icon: 'M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z' },
]

function getCategoryIcon(cat) {
  return CATEGORIES.find(c => c.key === cat)?.icon || CATEGORIES[CATEGORIES.length - 1].icon
}

function daysUntil(deadline) {
  const now = new Date(); now.setHours(0, 0, 0, 0)
  return Math.ceil((new Date(deadline + 'T00:00:00') - now) / (1000 * 60 * 60 * 24))
}

function fmtDeadline(deadline) {
  const d = daysUntil(deadline)
  if (d < 0) return `${Math.abs(d)}d overdue`
  if (d === 0) return 'Due today'
  if (d === 1) return '1 day left'
  if (d < 30) return `${d} days left`
  if (d < 365) return `${Math.floor(d / 30)}mo left`
  return `${(d / 365).toFixed(1)}yr left`
}

function deadlineColor(deadline) {
  const d = daysUntil(deadline)
  if (d <= 7) return 'var(--color-danger)'
  if (d <= 30) return 'var(--color-accent)'
  return 'var(--color-text-faint)'
}

export default function Atlas() {
  const [ultimateGoals, setUltimateGoals] = useState([])
  const [selectedUltimate, setSelectedUltimate] = useState(null)
  const [milestones, setMilestones] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedMilestone, setSelectedMilestone] = useState(null)

  // Forms
  const [showUltimateForm, setShowUltimateForm] = useState(false)
  const [ultimateForm, setUltimateForm] = useState({ name: '', target_amount: '', deadline: '', category: 'Savings', description: '' })
  const [showMilestoneForm, setShowMilestoneForm] = useState(false)
  const [milestoneForm, setMilestoneForm] = useState({ name: '', target_amount: '', deadline: '', category: 'Savings', description: '' })
  const [formError, setFormError] = useState('')
  const [confirmDialog, setConfirmDialog] = useState({ open: false, title: '', message: '', onConfirm: () => {}, danger: false })

  const fetchUltimates = async () => {
    try {
      const res = await api.get('/api/atlas/ultimate')
      setUltimateGoals(res.data.data)
      // Auto-select first if none selected
      if (!selectedUltimate && res.data.data.length > 0) {
        setSelectedUltimate(res.data.data[0].id)
      }
    } catch {}
    setLoading(false)
  }

  const fetchMilestones = async (ultimateId) => {
    if (!ultimateId) { setMilestones([]); return }
    try {
      const res = await api.get(`/api/atlas/milestones/${ultimateId}`)
      setMilestones(res.data.data)
    } catch {}
  }

  useEffect(() => { fetchUltimates() }, [])
  useEffect(() => { if (selectedUltimate) fetchMilestones(selectedUltimate) }, [selectedUltimate])

  const currentUltimate = ultimateGoals.find(u => u.id === selectedUltimate)
  const completedMilestones = milestones.filter(m => m.status === 'completed')
  const activeMilestone = milestones.find(m => m.status === 'active')
  const totalMilestoneSaved = milestones.reduce((s, m) => s + m.current_amount, 0)

  // Check if we need to prompt for first milestone
  const needsFirstMilestone = selectedUltimate && milestones.length === 0
  // Check if current milestone is complete and needs next
  const needsNextMilestone = selectedUltimate && milestones.length > 0 && !activeMilestone && milestones.some(m => m.status === 'completed')

  const createUltimate = async (e) => {
    e.preventDefault()
    setFormError('')
    if (!ultimateForm.name.trim()) return setFormError('Name is required')
    if (!ultimateForm.target_amount || parseFloat(ultimateForm.target_amount) <= 0) return setFormError('Enter a valid target amount')
    if (!ultimateForm.deadline) return setFormError('Set a deadline')
    try {
      const res = await api.post('/api/atlas/ultimate', {
        name: ultimateForm.name.trim(),
        target_amount: parseFloat(ultimateForm.target_amount),
        deadline: ultimateForm.deadline,
        category: ultimateForm.category,
        description: ultimateForm.description.trim() || null,
      })
      setUltimateForm({ name: '', target_amount: '', deadline: '', category: 'Savings', description: '' })
      setShowUltimateForm(false)
      await fetchUltimates()
      setSelectedUltimate(res.data.data.id)
    } catch (err) {
      setFormError(err.response?.data?.error || err.message)
    }
  }

  const createMilestone = async (e) => {
    e.preventDefault()
    setFormError('')
    if (!milestoneForm.name.trim()) return setFormError('Name is required')
    if (!milestoneForm.target_amount || parseFloat(milestoneForm.target_amount) <= 0) return setFormError('Enter a valid target amount')
    if (!milestoneForm.deadline) return setFormError('Set a deadline')
    try {
      await api.post('/api/atlas/milestone', {
        ultimate_goal_id: selectedUltimate,
        name: milestoneForm.name.trim(),
        target_amount: parseFloat(milestoneForm.target_amount),
        deadline: milestoneForm.deadline,
        category: milestoneForm.category,
        description: milestoneForm.description.trim() || null,
      })
      setMilestoneForm({ name: '', target_amount: '', deadline: '', category: 'Savings', description: '' })
      setShowMilestoneForm(false)
      fetchMilestones(selectedUltimate)
    } catch (err) {
      setFormError(err.response?.data?.error || err.message)
    }
  }

  const updateMilestone = async (id, data) => {
    try {
      await api.patch(`/api/atlas/${id}`, data)
      fetchMilestones(selectedUltimate)
    } catch {}
  }

  const deleteMilestone = (id) => {
    setConfirmDialog({
      open: true,
      danger: true,
      title: 'Delete Milestone',
      message: 'Delete this milestone?',
      onConfirm: async () => {
        try {
          await api.delete(`/api/atlas/${id}`)
          setSelectedMilestone(null)
          fetchMilestones(selectedUltimate)
        } catch {}
        setConfirmDialog(d => ({ ...d, open: false }))
      }
    })
  }

  const deleteUltimate = (id) => {
    setConfirmDialog({
      open: true,
      danger: true,
      title: 'Delete Ultimate Goal',
      message: 'Delete this ultimate goal and all its milestones?',
      onConfirm: async () => {
        try {
          await api.delete(`/api/atlas/ultimate/${id}`)
          setSelectedUltimate(null)
          setMilestones([])
          setSelectedMilestone(null)
          fetchUltimates()
        } catch {}
        setConfirmDialog(d => ({ ...d, open: false }))
      }
    })
  }

  // SVG map layout — vertical path from bottom to top (start → ultimate goal)
  const layout = useMemo(() => {
    const nodes = []
    const paths = []
    const W = 500
    const centerX = W / 2
    const nodeSpacing = 130
    const totalNodes = milestones.length + 1 // milestones + ultimate at top
    const totalH = Math.max(300, totalNodes * nodeSpacing + 80)

    // Milestones from bottom to top
    for (let i = 0; i < milestones.length; i++) {
      const offset = (i % 2 === 0 ? -1 : 1) * 80
      const x = centerX + offset
      const y = totalH - 60 - i * nodeSpacing
      nodes.push({ x, y, milestone: milestones[i], type: 'milestone' })
    }

    // Ultimate goal at top
    if (currentUltimate) {
      const y = milestones.length > 0 ? totalH - 60 - milestones.length * nodeSpacing : totalH - 60
      nodes.push({ x: centerX, y: Math.max(50, y), type: 'ultimate', milestone: null })
    }

    // Paths between nodes
    for (let i = 0; i < nodes.length - 1; i++) {
      const a = nodes[i], b = nodes[i + 1]
      const midY = (a.y + b.y) / 2
      paths.push({
        d: `M ${a.x} ${a.y} C ${a.x} ${midY}, ${b.x} ${midY}, ${b.x} ${b.y}`,
        completed: a.type === 'milestone' && a.milestone.status === 'completed',
      })
    }

    return { nodes, paths, totalH, W }
  }, [milestones, currentUltimate])

  if (loading) {
    return (
      <div>
        <h1 style={{ fontSize: 'var(--text-3xl)', marginBottom: '1.5rem' }}>Atlas</h1>
        <div className="card" style={{ padding: '3rem', textAlign: 'center' }}>
          <div className="skeleton" style={{ height: 20, width: '40%', margin: '0 auto 1rem' }} />
          <div className="skeleton" style={{ height: 14, width: '60%', margin: '0 auto' }} />
        </div>
      </div>
    )
  }

  // ── No ultimate goals yet: onboarding ──
  if (ultimateGoals.length === 0 && !showUltimateForm) {
    return (
      <div>
        <h1 style={{ fontSize: 'var(--text-3xl)', marginBottom: '1.5rem' }}>Atlas</h1>
        <div className="card" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
          <svg width="56" height="56" fill="none" stroke="var(--color-accent)" strokeWidth="1.5" viewBox="0 0 24 24" style={{ margin: '0 auto 1.25rem', display: 'block' }}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l5.447 2.724A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
          </svg>
          <h2 style={{ fontSize: 'var(--text-xl)', marginBottom: '0.5rem' }}>Start Your Financial Journey</h2>
          <p style={{ color: 'var(--color-danger)', fontSize: 'var(--text-base)', marginBottom: '0.35rem', maxWidth: 420, margin: '0 auto 0.35rem' }}>
            Set an ultimate goal — the big destination you're working toward.
          </p>
          <p style={{ color: 'var(--color-text-faint)', fontSize: 'var(--text-sm)', marginBottom: '1.5rem', maxWidth: 420, margin: '0 auto 1.5rem' }}>
            Then break it into milestones. Complete one, set the next, and watch your map grow as you progress. You can have up to 5 ultimate goals.
          </p>
          <button className="btn btn-primary" style={{ fontSize: 'var(--text-base)', padding: '0.6rem 1.5rem' }} onClick={() => setShowUltimateForm(true)}>
            Set Your First Ultimate Goal
          </button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: 'var(--text-3xl)', marginBottom: '0.15rem' }}>Atlas</h1>
          <p style={{ color: 'var(--color-text-faint)', fontSize: 'var(--text-sm)' }}>Chart your financial journey</p>
        </div>
        {ultimateGoals.length < 5 && (
          <button className="btn btn-ghost" onClick={() => { setShowUltimateForm(!showUltimateForm); setShowMilestoneForm(false) }}
            style={{ fontSize: 'var(--text-sm)' }}>
            {showUltimateForm ? 'Cancel' : '+ Ultimate Goal'}
          </button>
        )}
      </div>

      {/* Ultimate Goal Form */}
      {showUltimateForm && <GoalForm title="New Ultimate Goal" form={ultimateForm} setForm={setUltimateForm} onSubmit={createUltimate} error={formError} onCancel={() => { setShowUltimateForm(false); setFormError('') }} />}

      {/* Ultimate Goal Tabs */}
      {ultimateGoals.length > 0 && (
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
          {ultimateGoals.map(u => (
            <button key={u.id} onClick={() => { setSelectedUltimate(u.id); setSelectedMilestone(null) }}
              style={{
                padding: '0.5rem 1rem', border: '1px solid', borderRadius: 2, cursor: 'pointer',
                fontSize: 'var(--text-sm)', fontWeight: 500, transition: 'all 0.15s',
                background: selectedUltimate === u.id ? 'var(--color-primary)' : 'var(--color-bg)',
                color: selectedUltimate === u.id ? 'var(--color-accent)' : 'var(--color-text)',
                borderColor: selectedUltimate === u.id ? 'var(--color-primary)' : 'var(--color-border)',
              }}>
              {u.status === 'completed' && <span style={{ marginRight: 4 }}>✓ </span>}
              {u.name}
            </button>
          ))}
        </div>
      )}

      {/* Selected Ultimate Goal Summary */}
      {currentUltimate && (
        <div className="card" style={{ marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                <svg width="18" height="18" fill="none" stroke="var(--color-accent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                  <path d={getCategoryIcon(currentUltimate.category)} />
                </svg>
                <span style={{ fontSize: 'var(--text-xs)', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-faint)' }}>Ultimate Goal</span>
                <span className="badge badge-neutral">{currentUltimate.category}</span>
              </div>
              <h2 style={{ fontSize: 'var(--text-xl)', marginBottom: '0.25rem' }}>{currentUltimate.name}</h2>
              {currentUltimate.description && <p style={{ color: 'var(--color-danger)', fontSize: 'var(--text-sm)', marginBottom: '0.5rem' }}>{currentUltimate.description}</p>}
              <div style={{ display: 'flex', gap: '1.5rem', fontSize: 'var(--text-sm)' }}>
                <span><span className="text-faint">Target:</span> <span className="mono" style={{ fontWeight: 600 }}>{formatCurrency(currentUltimate.target_amount)}</span></span>
                <span><span className="text-faint">Saved:</span> <span className="mono text-success" style={{ fontWeight: 600 }}>{formatCurrency(totalMilestoneSaved)}</span></span>
                <span><span className="text-faint">Deadline:</span> <span className="mono" style={{ color: deadlineColor(currentUltimate.deadline) }}>{fmtDeadline(currentUltimate.deadline)}</span></span>
              </div>
              {/* Overall progress toward ultimate */}
              <div style={{ marginTop: '0.75rem' }}>
                <div className="progress-bar" style={{ height: 8 }}>
                  <div className="progress-bar-fill" style={{
                    width: `${Math.min(100, (totalMilestoneSaved / currentUltimate.target_amount) * 100)}%`,
                    background: totalMilestoneSaved >= currentUltimate.target_amount ? 'var(--color-success)' : 'var(--color-primary)'
                  }} />
                </div>
                <p className="mono text-faint" style={{ fontSize: 'var(--text-sm)', textAlign: 'right', marginTop: '0.2rem' }}>
                  {((totalMilestoneSaved / currentUltimate.target_amount) * 100).toFixed(1)}% of ultimate goal
                </p>
              </div>
            </div>
            <button onClick={() => deleteUltimate(currentUltimate.id)} title="Delete ultimate goal"
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-faint)', fontSize: 'var(--text-base)', padding: '0.25rem' }}>×</button>
          </div>
        </div>
      )}

      {/* Milestone Form (for first milestone or adding next) */}
      {showMilestoneForm && <GoalForm title="New Milestone" form={milestoneForm} setForm={setMilestoneForm} onSubmit={createMilestone} error={formError} onCancel={() => { setShowMilestoneForm(false); setFormError('') }} />}

      {/* Prompt: Set first milestone */}
      {needsFirstMilestone && !showMilestoneForm && (
        <div className="card" style={{ textAlign: 'center', padding: '2.5rem 2rem', marginBottom: '1.25rem' }}>
          <h3 style={{ fontSize: 'var(--text-lg)', marginBottom: '0.5rem' }}>Set Your First Milestone</h3>
          <p style={{ color: 'var(--color-danger)', fontSize: 'var(--text-base)', marginBottom: '1rem', maxWidth: 380, margin: '0 auto 1rem' }}>
            Break your ultimate goal into smaller steps. What's the first milestone on your journey to "{currentUltimate?.name}"?
          </p>
          <button className="btn btn-primary" onClick={() => { setShowMilestoneForm(true); setFormError('') }}>
            Create First Milestone
          </button>
        </div>
      )}

      {/* Prompt: Set next milestone */}
      {needsNextMilestone && !showMilestoneForm && (
        <div className="card" style={{ textAlign: 'center', padding: '2rem', marginBottom: '1.25rem', background: 'var(--color-bg)', border: '1px solid var(--color-accent-40)' }}>
          <p style={{ fontSize: 'var(--text-lg)', marginBottom: '0.15rem' }}>🎉</p>
          <h3 style={{ fontSize: 'var(--text-lg)', marginBottom: '0.35rem' }}>Milestone Complete!</h3>
          <p style={{ color: 'var(--color-danger)', fontSize: 'var(--text-base)', marginBottom: '1rem' }}>
            Keep the momentum going — set your next milestone.
          </p>
          <button className="btn btn-primary" onClick={() => { setShowMilestoneForm(true); setFormError('') }}>
            Set Next Milestone
          </button>
        </div>
      )}

      {/* Map + Detail */}
      {milestones.length > 0 && (
        <div style={{ display: 'flex', gap: '1rem' }}>
          {/* Journey Map */}
          <div className="card" style={{ flex: 1, padding: '1.25rem', overflow: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <h2 style={{ fontSize: 'var(--text-lg)' }}>Your Journey</h2>
              {!needsNextMilestone && !showMilestoneForm && (
                <button className="btn btn-ghost" style={{ fontSize: 'var(--text-sm)', padding: '0.25rem 0.6rem' }}
                  onClick={() => { setShowMilestoneForm(true); setFormError('') }}>
                  + Milestone
                </button>
              )}
            </div>
            <svg viewBox={`0 0 ${layout.W} ${layout.totalH}`} width="100%" style={{ overflow: 'visible' }}>
              {/* Paths */}
              {layout.paths.map((p, i) => (
                <g key={i}>
                  <path d={p.d} fill="none" stroke="var(--color-border)" strokeWidth="5" strokeLinecap="round" />
                  {p.completed
                    ? <path d={p.d} fill="none" stroke="var(--color-success)" strokeWidth="5" strokeLinecap="round" />
                    : <path d={p.d} fill="none" stroke="var(--color-primary)" strokeWidth="5" strokeLinecap="round" strokeDasharray="8,8" strokeOpacity="0.25" />
                  }
                </g>
              ))}
              {/* Nodes */}
              {layout.nodes.map((node, i) => {
                if (node.type === 'ultimate') {
                  // Ultimate goal node at top — star/flag
                  const allDone = milestones.length > 0 && milestones.every(m => m.status === 'completed')
                  return (
                    <g key="ultimate">
                      <polygon
                        points={`${node.x},${node.y - 28} ${node.x + 8},${node.y - 10} ${node.x + 26},${node.y - 10} ${node.x + 12},${node.y + 2} ${node.x + 18},${node.y + 20} ${node.x},${node.y + 8} ${node.x - 18},${node.y + 20} ${node.x - 12},${node.y + 2} ${node.x - 26},${node.y - 10} ${node.x - 8},${node.y - 10}`}
                        fill={allDone ? 'var(--color-accent)' : 'var(--color-bg)'}
                        stroke={allDone ? 'var(--color-accent)' : 'var(--color-primary)'}
                        strokeWidth="2"
                      />
                      <text x={node.x} y={node.y + 38} textAnchor="middle" fontSize="11" fill="var(--color-text)"
                        fontWeight="700" fontFamily="var(--font-body)">
                        {currentUltimate.name.length > 20 ? currentUltimate.name.slice(0, 18) + '…' : currentUltimate.name}
                      </text>
                      <text x={node.x} y={node.y + 50} textAnchor="middle" fontSize="9" fill="var(--color-accent)"
                        fontFamily="var(--font-mono)" fontWeight="600">
                        ULTIMATE GOAL
                      </text>
                    </g>
                  )
                }

                // Milestone node
                const m = node.milestone
                const pct = m.target_amount > 0 ? Math.min(1, m.current_amount / m.target_amount) : 0
                const isCompleted = m.status === 'completed'
                const isPaused = m.status === 'paused'
                const isActive = m.status === 'active'
                const isSelected = selectedMilestone === m.id
                const nodeSize = 26

                return (
                  <g key={m.id} onClick={() => setSelectedMilestone(isSelected ? null : m.id)}
                    style={{ cursor: 'pointer' }}>
                    {isSelected && (
                      <rect x={node.x - nodeSize - 4} y={node.y - nodeSize - 4} width={(nodeSize + 4) * 2} height={(nodeSize + 4) * 2}
                        rx={4} fill="none" stroke="var(--color-accent)" strokeWidth="2" strokeDasharray="4,3" />
                    )}
                    {/* Node circle */}
                    <circle cx={node.x} cy={node.y} r={nodeSize}
                      fill={isCompleted ? 'var(--color-success)' : isPaused ? 'var(--color-border)' : isActive ? 'var(--color-bg)' : 'var(--color-bg)'}
                      stroke={isCompleted ? 'var(--color-success)' : isActive ? 'var(--color-primary)' : 'var(--color-text-faint)'}
                      strokeWidth={isActive ? 3 : 2} />
                    {/* Icon or checkmark */}
                    {isCompleted ? (
                      <text x={node.x} y={node.y + 5} textAnchor="middle" fontSize="18" fill="var(--color-bg)" fontWeight="700">✓</text>
                    ) : (
                      <svg x={node.x - 10} y={node.y - 10} width="20" height="20" viewBox="0 0 24 24" fill="none"
                        stroke={isActive ? 'var(--color-primary)' : 'var(--color-text-faint)'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d={getCategoryIcon(m.category)} />
                      </svg>
                    )}
                    {/* Progress arc for active */}
                    {isActive && pct > 0 && (
                      <circle cx={node.x} cy={node.y} r={nodeSize + 4}
                        fill="none" stroke="var(--color-accent)" strokeWidth="3"
                        strokeDasharray={`${pct * 2 * Math.PI * (nodeSize + 4)} ${2 * Math.PI * (nodeSize + 4)}`}
                        strokeLinecap="round"
                        transform={`rotate(-90 ${node.x} ${node.y})`} />
                    )}
                    {/* Step number */}
                    <text x={node.x} y={node.y + nodeSize + 16} textAnchor="middle" fontSize="11" fill="var(--color-text)"
                      fontWeight="600" fontFamily="var(--font-body)">
                      {m.name.length > 16 ? m.name.slice(0, 14) + '…' : m.name}
                    </text>
                    <text x={node.x} y={node.y + nodeSize + 28} textAnchor="middle" fontSize="9" fill="var(--color-danger)"
                      fontFamily="var(--font-mono)">
                      {isCompleted ? '✓ Completed' : `${formatCurrency(m.current_amount)} / ${formatCurrency(m.target_amount)}`}
                    </text>
                    <text x={node.x} y={node.y + nodeSize + 40} textAnchor="middle" fontSize="8.5"
                      fill={isCompleted ? 'var(--color-success)' : deadlineColor(m.deadline)} fontFamily="var(--font-mono)">
                      {isCompleted ? '' : fmtDeadline(m.deadline)}
                    </text>
                    {/* Step badge */}
                    <circle cx={node.x + nodeSize - 4} cy={node.y - nodeSize + 4} r={8}
                      fill="var(--color-primary)" stroke="var(--color-bg)" strokeWidth="1.5" />
                    <text x={node.x + nodeSize - 4} y={node.y - nodeSize + 7.5} textAnchor="middle" fontSize="8" fill="var(--color-accent)"
                      fontFamily="var(--font-mono)" fontWeight="700">
                      {i + 1}
                    </text>
                  </g>
                )
              })}
            </svg>
          </div>

          {/* Detail Panel */}
          {selectedMilestone && (() => {
            const ms = milestones.find(m => m.id === selectedMilestone)
            if (!ms) return null
            return (
              <MilestoneDetail
                milestone={ms}
                onUpdate={(data) => updateMilestone(ms.id, data)}
                onDelete={() => deleteMilestone(ms.id)}
                onClose={() => setSelectedMilestone(null)}
              />
            )
          })()}
        </div>
      )}

      <ConfirmDialog {...confirmDialog} onCancel={() => setConfirmDialog(d => ({ ...d, open: false }))} />
    </div>
  )
}


function GoalForm({ title, form, setForm, onSubmit, error, onCancel }) {
  return (
    <div className="card" style={{ marginBottom: '1.25rem' }}>
      <h3 style={{ fontSize: 'var(--text-lg)', marginBottom: '0.75rem' }}>{title}</h3>
      <form onSubmit={onSubmit}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: 'var(--text-xs)', textTransform: 'uppercase', color: 'var(--color-text-faint)', letterSpacing: '0.06em', marginBottom: 3 }}>Name</label>
            <input className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Emergency Fund" />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 'var(--text-xs)', textTransform: 'uppercase', color: 'var(--color-text-faint)', letterSpacing: '0.06em', marginBottom: 3 }}>Target Amount</label>
            <input className="input" type="number" step="0.01" min="0" value={form.target_amount} onChange={e => setForm(f => ({ ...f, target_amount: e.target.value }))} placeholder="10000" />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 'var(--text-xs)', textTransform: 'uppercase', color: 'var(--color-text-faint)', letterSpacing: '0.06em', marginBottom: 3 }}>Deadline</label>
            <input className="input" type="date" value={form.deadline} onChange={e => setForm(f => ({ ...f, deadline: e.target.value }))} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 'var(--text-xs)', textTransform: 'uppercase', color: 'var(--color-text-faint)', letterSpacing: '0.06em', marginBottom: 3 }}>Category</label>
            <select className="select" style={{ width: '100%' }} value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
              {CATEGORIES.map(c => <option key={c.key} value={c.key}>{c.key}</option>)}
            </select>
          </div>
        </div>
        <div style={{ marginBottom: '0.75rem' }}>
          <label style={{ display: 'block', fontSize: 'var(--text-xs)', textTransform: 'uppercase', color: 'var(--color-text-faint)', letterSpacing: '0.06em', marginBottom: 3 }}>Description (optional)</label>
          <input className="input" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Why this matters" />
        </div>
        {error && <p style={{ color: 'var(--color-danger)', fontSize: 'var(--text-sm)', marginBottom: '0.5rem' }}>{error}</p>}
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button type="submit" className="btn btn-primary">Create</button>
          <button type="button" className="btn btn-ghost" onClick={onCancel}>Cancel</button>
        </div>
      </form>
    </div>
  )
}


function MilestoneDetail({ milestone, onUpdate, onDelete, onClose }) {
  const [editAmount, setEditAmount] = useState(milestone.current_amount)
  const pct = milestone.target_amount > 0 ? Math.min(100, (milestone.current_amount / milestone.target_amount) * 100) : 0

  useEffect(() => { setEditAmount(milestone.current_amount) }, [milestone.current_amount])

  const saveProgress = () => {
    const val = parseFloat(editAmount)
    if (isNaN(val) || val < 0) return
    onUpdate({ current_amount: val })
  }

  return (
    <div className="card" style={{ width: 300, flexShrink: 0, alignSelf: 'flex-start', position: 'sticky', top: '1.25rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
        <span className="badge badge-neutral">{milestone.category}</span>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-faint)', fontSize: 'var(--text-lg)' }}>×</button>
      </div>

      <h3 style={{ fontSize: 'var(--text-lg)', marginBottom: '0.25rem' }}>{milestone.name}</h3>
      {milestone.description && <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-danger)', marginBottom: '0.75rem', lineHeight: 1.5 }}>{milestone.description}</p>}

      {/* Progress */}
      <div style={{ marginBottom: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-sm)', marginBottom: '0.35rem' }}>
          <span className="mono" style={{ color: 'var(--color-success)', fontWeight: 600 }}>{formatCurrency(milestone.current_amount)}</span>
          <span className="mono" style={{ color: 'var(--color-text)' }}>{formatCurrency(milestone.target_amount)}</span>
        </div>
        <div className="progress-bar" style={{ height: 8 }}>
          <div className="progress-bar-fill" style={{ width: `${pct}%`, background: pct >= 100 ? 'var(--color-success)' : 'var(--color-primary)' }} />
        </div>
        <p className="mono" style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-faint)', marginTop: '0.25rem', textAlign: 'right' }}>{pct.toFixed(1)}%</p>
      </div>

      {/* Deadline */}
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-sm)', marginBottom: '1rem', padding: '0.5rem 0.65rem', background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 2 }}>
        <span style={{ color: 'var(--color-text-faint)' }}>Deadline</span>
        <span className="mono" style={{ color: deadlineColor(milestone.deadline), fontWeight: 600 }}>
          {new Date(milestone.deadline + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
        </span>
      </div>

      {/* Update Progress */}
      {milestone.status !== 'completed' && (
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', fontSize: 'var(--text-xs)', textTransform: 'uppercase', color: 'var(--color-text-faint)', letterSpacing: '0.06em', marginBottom: 3 }}>Update Progress</label>
          <div style={{ display: 'flex', gap: '0.4rem' }}>
            <input className="input" type="number" step="0.01" min="0" value={editAmount}
              onChange={e => setEditAmount(e.target.value)} style={{ flex: 1 }} />
            <button className="btn btn-primary" onClick={saveProgress} style={{ fontSize: 'var(--text-sm)', padding: '0.35rem 0.65rem' }}>Save</button>
          </div>
        </div>
      )}

      {/* Status */}
      <div style={{ marginBottom: '1rem' }}>
        <label style={{ display: 'block', fontSize: 'var(--text-xs)', textTransform: 'uppercase', color: 'var(--color-text-faint)', letterSpacing: '0.06em', marginBottom: 3 }}>Status</label>
        <div style={{ display: 'flex', gap: '0.35rem' }}>
          {['active', 'completed', 'paused'].map(s => (
            <button key={s} onClick={() => onUpdate({ status: s })}
              className={`btn ${milestone.status === s ? 'btn-primary' : 'btn-ghost'}`}
              style={{ flex: 1, fontSize: 'var(--text-xs)', padding: '0.3rem 0.4rem', textTransform: 'capitalize' }}>
              {s}
            </button>
          ))}
        </div>
      </div>

      <button className="btn btn-danger" onClick={onDelete} style={{ width: '100%', fontSize: 'var(--text-sm)' }}>
        Delete Milestone
      </button>
    </div>
  )
}
