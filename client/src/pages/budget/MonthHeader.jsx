import { useState, useEffect } from 'react'
import { formatCurrency } from '../../components/NumberDisplay'

export default function MonthHeader({ month, year, income, incomeConfirmed, previousIncome, allocationLocked, onPrev, onNext, onConfirmIncome, onSaveAllocation }) {
  const [editing, setEditing] = useState(false)
  const [incomeInput, setIncomeInput] = useState('')
  // 2-step setup: 1 = income, 2 = allocation
  const [setupStep, setSetupStep] = useState(1)
  const [spend, setSpend] = useState(60)
  const [save, setSave] = useState(20)
  const [invest, setInvest] = useState(20)

  const monthLabel = new Date(year, month).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  const needsIncome = !income || (!incomeConfirmed && income === 0)
  const needsFullSetup = needsIncome || !allocationLocked

  // Auto-open edit when there's no income at all
  useEffect(() => {
    if (needsIncome && !editing) {
      setIncomeInput(String(previousIncome || ''))
      setSetupStep(1)
      setEditing(true)
    }
  }, [needsIncome])

  // If income is set but allocation isn't, jump to step 2
  useEffect(() => {
    if (!needsIncome && !allocationLocked && !editing) {
      setSetupStep(2)
      setEditing(true)
    }
  }, [needsIncome, allocationLocked])

  const startEdit = () => {
    setIncomeInput(String(income || previousIncome || ''))
    setSetupStep(1)
    setEditing(true)
  }

  const confirmIncomeStep = () => {
    const amt = parseFloat(incomeInput)
    if (amt && amt > 0) {
      onConfirmIncome(amt)
      if (!allocationLocked) {
        setSetupStep(2)
      } else {
        setEditing(false)
      }
    }
  }

  const confirmAllocation = () => {
    if (spend + save + invest === 100) {
      onSaveAllocation({ spend_pct: spend, savings_pct: save, invest_pct: invest })
      setEditing(false)
      setSetupStep(1)
    }
  }

  const adjust = (setter, value, others) => {
    const v = Math.max(0, Math.min(100, value))
    setter(v)
    const remainder = 100 - v
    const otherSum = others[0].get + others[1].get
    if (otherSum === 0) {
      others[0].set(Math.round(remainder / 2))
      others[1].set(remainder - Math.round(remainder / 2))
    } else {
      const r0 = Math.round((others[0].get / otherSum) * remainder)
      others[0].set(r0)
      others[1].set(remainder - r0)
    }
  }

  const sliders = [
    { label: 'Spend', value: spend, set: setSpend, get: spend, color: 'var(--color-negative)' },
    { label: 'Save', value: save, set: setSave, get: save, color: 'var(--color-positive)' },
    { label: 'Invest', value: invest, set: setInvest, get: invest, color: 'var(--color-gold)' },
  ]

  const allocationTotal = spend + save + invest
  const allocationValid = allocationTotal === 100
  const incomeForAllocation = parseFloat(incomeInput) || income || 0

  return (
    <div style={{ marginBottom: 'var(--space-lg)' }}>
      {/* Row 1: Month nav */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: editing ? '0.75rem' : 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button className="btn btn-ghost" onClick={onPrev} style={{ padding: '0.25rem 0.5rem', fontSize: 'var(--text-lg)' }}>&#8249;</button>
          <h2 style={{ fontSize: 'var(--text-xl)', margin: 0, minWidth: 180, textAlign: 'center' }}>{monthLabel}</h2>
          <button className="btn btn-ghost" onClick={onNext} style={{ padding: '0.25rem 0.5rem', fontSize: 'var(--text-lg)' }}>&#8250;</button>
        </div>

        {/* Compact income display when set */}
        {!editing && income > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span className="mono" style={{ fontSize: 'var(--text-lg)', fontWeight: 600 }}>
              {formatCurrency(income)}<span className="text-faint" style={{ fontSize: 'var(--text-sm)', fontWeight: 400 }}>/mo</span>
            </span>
            <button className="btn btn-ghost" onClick={startEdit} aria-label="Edit income" style={{ padding: '0.2rem 0.4rem' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            </button>
          </div>
        )}
      </div>

      {/* Combined income + allocation setup */}
      {editing && needsFullSetup && (
        <div className="card" style={{ padding: '1.75rem', textAlign: 'center' }}>
          {/* Step indicator */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
            {[1, 2].map(s => (
              <div key={s} style={{
                width: 8, height: 8, borderRadius: '50%',
                background: setupStep >= s ? 'var(--color-gold)' : 'var(--color-border)',
                transition: 'background 0.2s',
              }} />
            ))}
          </div>

          {/* Step 1: Income */}
          {setupStep === 1 && (
            <>
              <h3 style={{ fontSize: 'var(--text-lg)', marginBottom: '0.25rem' }}>How much do you bring in?</h3>
              <p className="text-faint" style={{ fontSize: 'var(--text-sm)', marginBottom: '1.25rem' }}>
                Enter your monthly take-home pay for {monthLabel}.
              </p>
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', alignItems: 'center' }}>
                <div style={{ position: 'relative', width: 200 }}>
                  <span style={{
                    position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
                    color: 'var(--color-text-muted)', fontSize: 'var(--text-xl)',
                  }}>$</span>
                  <input
                    className="input mono"
                    type="number"
                    value={incomeInput}
                    onChange={e => setIncomeInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && confirmIncomeStep()}
                    autoFocus
                    placeholder="0"
                    style={{ paddingLeft: '2rem', fontSize: 'var(--text-xl)', textAlign: 'center', width: '100%' }}
                  />
                </div>
                <button className="btn btn-primary" onClick={confirmIncomeStep} disabled={!(parseFloat(incomeInput) > 0)} style={{
                  fontSize: 'var(--text-sm)', padding: '0.5rem 1.25rem',
                  opacity: parseFloat(incomeInput) > 0 ? 1 : 0.4,
                }}>
                  Next
                </button>
              </div>
              {previousIncome > 0 && (
                <button
                  className="btn btn-ghost"
                  onClick={() => setIncomeInput(String(previousIncome))}
                  style={{ marginTop: '0.75rem', fontSize: 'var(--text-sm)' }}
                >
                  Use last month's ({formatCurrency(previousIncome)})
                </button>
              )}
            </>
          )}

          {/* Step 2: Allocation */}
          {setupStep === 2 && (
            <>
              <h3 style={{ fontSize: 'var(--text-lg)', marginBottom: '0.25rem' }}>Set your allocation</h3>
              <p className="text-faint" style={{ fontSize: 'var(--text-sm)', marginBottom: '1.25rem' }}>
                How should your {formatCurrency(incomeForAllocation)} be split this month?
              </p>

              {/* Stacked bar preview */}
              <div style={{ height: 12, borderRadius: 6, overflow: 'hidden', display: 'flex', marginBottom: '1.5rem' }}>
                <div style={{ width: `${spend}%`, background: 'var(--color-negative)', transition: 'width 0.2s' }} />
                <div style={{ width: `${save}%`, background: 'var(--color-positive)', transition: 'width 0.2s' }} />
                <div style={{ width: `${invest}%`, background: 'var(--color-gold)', transition: 'width 0.2s' }} />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem', marginBottom: '1.5rem', textAlign: 'left', maxWidth: 360, margin: '0 auto 1.5rem' }}>
                {sliders.map((s, i) => {
                  const others = sliders.filter((_, j) => j !== i)
                  return (
                    <div key={s.label}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
                        <span style={{ fontSize: 'var(--text-sm)', fontWeight: 500 }}>{s.label}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span className="mono" style={{ fontSize: 'var(--text-lg)', fontWeight: 600, color: s.color }}>
                            {s.value}%
                          </span>
                          <span className="text-faint mono" style={{ fontSize: 'var(--text-xs)' }}>
                            {formatCurrency(incomeForAllocation * s.value / 100)}
                          </span>
                        </div>
                      </div>
                      <input
                        type="range" min={0} max={100} value={s.value}
                        onChange={e => adjust(s.set, parseInt(e.target.value), others)}
                        style={{ width: '100%', accentColor: s.color }}
                      />
                    </div>
                  )
                })}
              </div>

              {!allocationValid && (
                <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-negative)', marginBottom: '0.75rem' }}>
                  Must total 100% (currently {allocationTotal}%)
                </p>
              )}

              <button
                className="btn btn-primary"
                disabled={!allocationValid}
                onClick={confirmAllocation}
                style={{ width: '100%', maxWidth: 360, opacity: allocationValid ? 1 : 0.4 }}
              >
                Lock allocation for this month
              </button>
            </>
          )}
        </div>
      )}

      {/* Inline edit (when income + allocation already exist, just updating income) */}
      {editing && !needsFullSetup && (
        <div className="card" style={{ padding: '0.75rem' }}>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <div style={{ position: 'relative', width: 140 }}>
              <span style={{
                position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
                color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)',
              }}>$</span>
              <input
                className="input mono"
                type="number"
                value={incomeInput}
                onChange={e => setIncomeInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { const amt = parseFloat(incomeInput); if (amt > 0) { onConfirmIncome(amt); setEditing(false) } } }}
                autoFocus
                placeholder="0"
                style={{ paddingLeft: '1.25rem', fontSize: 'var(--text-sm)', textAlign: 'center', width: '100%' }}
              />
            </div>
            <button className="btn btn-primary" onClick={() => { const amt = parseFloat(incomeInput); if (amt > 0) { onConfirmIncome(amt); setEditing(false) } }} disabled={!(parseFloat(incomeInput) > 0)} style={{
              fontSize: 'var(--text-sm)', padding: '0.3rem 0.75rem',
              opacity: parseFloat(incomeInput) > 0 ? 1 : 0.4,
            }}>
              Save
            </button>
            <button className="btn btn-ghost" onClick={() => setEditing(false)} style={{ fontSize: 'var(--text-sm)', padding: '0.3rem 0.5rem' }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Unconfirmed nudge — income exists from prev month but not confirmed for this one */}
      {!editing && income > 0 && !incomeConfirmed && (
        <div style={{
          padding: '0.5rem 0.75rem', borderRadius: 6, marginTop: '0.5rem',
          background: 'var(--color-gold-15)', border: '1px solid var(--color-gold-30)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>
            Still making {formatCurrency(income)}/mo?
          </span>
          <div style={{ display: 'flex', gap: '0.35rem' }}>
            <button className="btn btn-primary" onClick={() => onConfirmIncome(income)} style={{ fontSize: 'var(--text-xs)', padding: '0.2rem 0.6rem' }}>
              Yes, confirm
            </button>
            <button className="btn btn-ghost" onClick={startEdit} style={{ fontSize: 'var(--text-xs)', padding: '0.2rem 0.5rem' }}>
              Update
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
