import { useState } from 'react'
import { api } from '../hooks/useApi'
import { gradeColor } from '../utils/grades'

const BUDGET_CATEGORIES = ['Food & Dining', 'Transport', 'Shopping', 'Subscriptions', 'Health', 'Entertainment', 'Other']

const STEPS = [
  { title: 'Income & Spending', subtitle: 'How much comes in and goes out each month' },
  { title: 'Budget Goals', subtitle: 'Set a monthly limit for each category' },
  { title: 'Savings', subtitle: 'What you\'re putting away' },
  { title: 'Investments', subtitle: 'Are you growing your money' },
  { title: 'Debt', subtitle: 'What you owe vs what you own' },
  { title: 'Your Debts', subtitle: 'List each debt so we can build your payoff plan' },
  { title: 'Goals', subtitle: 'Where you\'re headed' },
  { title: 'Your Biggest Goal', subtitle: 'What matters most right now?' },
]

const GOAL_OPTIONS = ['Emergency Fund', 'Pay Off Debt', 'Save for House', 'Retirement', 'Investment Growth']

export default function Onboarding({ onComplete }) {
  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [answers, setAnswers] = useState({
    monthly_income: '',
    monthly_spending: '',
    monthly_savings: '',
    has_emergency_fund: '',
    invests: '',
    num_investments: '',
    concentrated: '',
    total_debt: '',
    total_assets: '',
    has_goal: '',
    goal_on_track: '',
    biggest_goal: '',
  })
  const [budgetGoals, setBudgetGoals] = useState(
    Object.fromEntries(BUDGET_CATEGORIES.map(c => [c, '']))
  )
  const [debtList, setDebtList] = useState([])
  const [debtForm, setDebtForm] = useState({ name: '', balance: '', interest_rate: '', min_payment: '' })

  const set = (key, val) => setAnswers(a => ({ ...a, [key]: val }))

  const addDebt = () => {
    if (!debtForm.name || !debtForm.balance || debtForm.interest_rate === '' || !debtForm.min_payment) return
    setDebtList(d => [...d, { ...debtForm }])
    setDebtForm({ name: '', balance: '', interest_rate: '', min_payment: '' })
  }

  const removeDebt = (i) => setDebtList(d => d.filter((_, idx) => idx !== i))

  const canNext = () => {
    if (step === 0) return answers.monthly_income && answers.monthly_spending
    if (step === 1) return true // budget goals are optional
    if (step === 2) return answers.monthly_savings && answers.has_emergency_fund
    if (step === 3) {
      if (!answers.invests) return false
      if (answers.invests === 'Yes') return answers.num_investments && answers.concentrated
      return true
    }
    if (step === 4) return answers.total_debt !== '' && answers.total_assets !== ''
    if (step === 5) return true // debt details optional (skip if no debt)
    if (step === 6) {
      if (!answers.has_goal) return false
      if (answers.has_goal === 'Yes') return !!answers.goal_on_track
      return true
    }
    if (step === 7) return !!answers.biggest_goal
    return true
  }

  // Skip debt details step if no debt
  const handleNext = () => {
    if (step === 4 && (parseFloat(answers.total_debt) || 0) <= 0) {
      setStep(6) // skip debt details, go to goals
    } else {
      setStep(s => s + 1)
    }
  }

  const handleBack = () => {
    if (step === 6 && (parseFloat(answers.total_debt) || 0) <= 0) {
      setStep(4) // skip back over debt details
    } else {
      setStep(s => s - 1)
    }
  }

  const submit = async () => {
    setLoading(true)
    try {
      const goals = BUDGET_CATEGORIES
        .filter(cat => budgetGoals[cat] && parseFloat(budgetGoals[cat]) > 0)
        .map(cat => ({ category: cat, monthly_limit: parseFloat(budgetGoals[cat]) }))

      const debts = debtList.map(d => ({
        name: d.name,
        balance: parseFloat(d.balance),
        interest_rate: parseFloat(d.interest_rate),
        min_payment: parseFloat(d.min_payment),
      }))

      const res = await api.post('/api/insights/onboarding', {
        monthly_income: parseFloat(answers.monthly_income) || 0,
        monthly_spending: parseFloat(answers.monthly_spending) || 0,
        monthly_savings: parseFloat(answers.monthly_savings) || 0,
        has_emergency_fund: answers.has_emergency_fund,
        invests: answers.invests,
        num_investments: answers.invests === 'Yes' ? answers.num_investments : null,
        concentrated: answers.invests === 'Yes' ? answers.concentrated : null,
        total_debt: parseFloat(answers.total_debt) || 0,
        total_assets: parseFloat(answers.total_assets) || 0,
        has_goal: answers.has_goal,
        goal_on_track: answers.has_goal === 'Yes' ? answers.goal_on_track : null,
        budget_goals: goals,
        debts,
        biggest_goal: answers.biggest_goal,
      })
      setResult(res.data.data)
    } catch (err) {
      console.error(err)
    }
    setLoading(false)
  }

  const inputStyle = {
    width: '100%', padding: '0.65rem 0.75rem', borderRadius: 2,
    border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)',
    fontSize: 'var(--text-base)', outline: 'none',
  }

  const OptionBtn = ({ selected, onClick, children }) => (
    <button type="button" onClick={onClick} style={{
      padding: '0.6rem 1.2rem', borderRadius: 2, cursor: 'pointer',
      border: selected ? '2px solid var(--color-primary)' : '1px solid var(--color-border)',
      background: selected ? 'var(--color-primary)' : 'var(--color-surface)',
      color: selected ? 'var(--color-accent)' : 'var(--color-text)',
      fontSize: 'var(--text-base)', fontWeight: selected ? 600 : 400,
      transition: 'all 0.1s',
    }}>
      {children}
    </button>
  )

  const lastStep = STEPS.length - 1

  // Show results (baseline qualitative view)
  if (result) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--color-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: '100%', maxWidth: 440, padding: '2rem' }}>
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <h1 style={{ fontFamily: 'var(--font-brand)', fontSize: 48, color: 'var(--color-accent)', fontWeight: 400, marginBottom: '0.5rem' }}>Atlas</h1>
            <p style={{ color: 'var(--color-text-faint)', fontSize: 'var(--text-sm)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Baseline Health Assessment</p>
          </div>

          <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
            <span className="score-reveal" style={{ fontSize: 'var(--text-4xl)', fontWeight: 700, color: 'var(--color-primary)' }}>{result.label}</span>
            <div style={{ marginTop: '0.75rem' }}>
              <span style={{ fontSize: 'var(--text-lg)', fontWeight: 600, color: gradeColor(result.grade), padding: '0.2rem 0.75rem', background: 'var(--color-surface)', border: `1px solid ${gradeColor(result.grade)}`, borderRadius: 2 }}>
                {result.grade}
              </span>
            </div>
          </div>

          <div style={{ border: '1px solid var(--color-border)', borderRadius: 2, overflow: 'hidden', marginBottom: '1rem' }}>
            {result.categories.map((cat, i) => (
              <div key={cat.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.65rem 0.85rem', borderBottom: i < result.categories.length - 1 ? '1px solid var(--color-border)' : 'none', background: 'var(--color-bg)' }}>
                <div>
                  <span style={{ fontSize: 'var(--text-base)', fontWeight: 500, color: 'var(--color-text)' }}>{cat.name}</span>
                  <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-faint)', marginTop: 2 }}>{cat.summary}</p>
                </div>
                <span style={{ fontSize: 'var(--text-lg)', fontWeight: 700, color: gradeColor(cat.grade), minWidth: 30, textAlign: 'right' }}>{cat.grade}</span>
              </div>
            ))}
          </div>

          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-accent)', background: 'var(--color-accent-15)', padding: '0.5rem 0.75rem', borderRadius: 2, textAlign: 'center', marginBottom: '1rem' }}>
            Your full numerical score unlocks after you add real data — import a CSV or add positions.
          </p>

          {result.aiSummary && (
            <p style={{ fontSize: 'var(--text-base)', color: 'var(--color-text-muted)', textAlign: 'center', marginBottom: '1.5rem', lineHeight: 1.5 }}>
              {result.aiSummary}
            </p>
          )}

          <button onClick={onComplete} style={{
            width: '100%', padding: '0.7rem', borderRadius: 2, border: 'none',
            background: 'var(--color-primary)', color: 'var(--color-accent)', fontSize: 'var(--text-base)',
            fontWeight: 600, cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.06em',
          }}>
            Go to Dashboard
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: '100%', maxWidth: 480, padding: '2rem' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <h1 style={{ fontFamily: 'var(--font-brand)', fontSize: 48, color: 'var(--color-accent)', fontWeight: 400, marginBottom: '0.5rem' }}>Atlas</h1>
          <p style={{ color: 'var(--color-text-faint)', fontSize: 'var(--text-sm)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Quick Financial Check-Up</p>
        </div>

        {/* Progress */}
        <div style={{ display: 'flex', gap: 4, marginBottom: '0.5rem' }}>
          {STEPS.map((_, i) => (
            <div key={i} style={{ flex: 1, height: 4, borderRadius: 2, background: i <= step ? 'var(--color-primary)' : 'var(--color-border)', transition: 'background 0.2s' }} />
          ))}
        </div>
        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-faint)', textAlign: 'center', marginBottom: '1.5rem' }}>Step {step + 1} of {STEPS.length}</p>

        {/* Step title */}
        <h2 style={{ fontSize: 'var(--text-lg)', color: 'var(--color-text)', marginBottom: '0.25rem' }}>{STEPS[step].title}</h2>
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-faint)', marginBottom: '1.5rem' }}>{STEPS[step].subtitle}</p>

        {/* Step 0: Income & Spending */}
        {step === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)', marginBottom: 4 }}>Monthly income (after taxes)</label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-faint)' }}>$</span>
                <input type="number" value={answers.monthly_income} onChange={e => set('monthly_income', e.target.value)}
                  placeholder="0" style={{ ...inputStyle, paddingLeft: '1.5rem' }} />
              </div>
            </div>
            <div>
              <label style={{ display: 'block', color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)', marginBottom: 4 }}>Monthly spending (roughly)</label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-faint)' }}>$</span>
                <input type="number" value={answers.monthly_spending} onChange={e => set('monthly_spending', e.target.value)}
                  placeholder="0" style={{ ...inputStyle, paddingLeft: '1.5rem' }} />
              </div>
            </div>
          </div>
        )}

        {/* Step 1: Budget Goals */}
        {step === 1 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {answers.monthly_spending && (
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-accent)', background: 'var(--color-accent-15)', padding: '0.5rem 0.75rem', borderRadius: 2 }}>
                You said you spend ~${parseFloat(answers.monthly_spending).toLocaleString()}/mo. Set limits below to keep yourself on track.
              </p>
            )}
            {BUDGET_CATEGORIES.map(cat => (
              <div key={cat} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text)', width: 130, flexShrink: 0 }}>{cat}</span>
                <div style={{ position: 'relative', flex: 1 }}>
                  <span style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-faint)', fontSize: 'var(--text-base)' }}>$</span>
                  <input type="number" value={budgetGoals[cat]}
                    onChange={e => setBudgetGoals(g => ({ ...g, [cat]: e.target.value }))}
                    placeholder="0" style={{ ...inputStyle, paddingLeft: '1.3rem', padding: '0.45rem 0.5rem 0.45rem 1.3rem' }} />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Step 2: Savings */}
        {step === 2 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)', marginBottom: 4 }}>Monthly savings</label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-faint)' }}>$</span>
                <input type="number" value={answers.monthly_savings} onChange={e => set('monthly_savings', e.target.value)}
                  placeholder="0" style={{ ...inputStyle, paddingLeft: '1.5rem' }} />
              </div>
            </div>
            <div>
              <label style={{ display: 'block', color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)', marginBottom: 4 }}>Do you have an emergency fund?</label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {['Yes', 'Working on it', 'No'].map(opt => (
                  <OptionBtn key={opt} selected={answers.has_emergency_fund === opt} onClick={() => set('has_emergency_fund', opt)}>{opt}</OptionBtn>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Investments */}
        {step === 3 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)', marginBottom: 4 }}>Do you invest?</label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {['Yes', 'No'].map(opt => (
                  <OptionBtn key={opt} selected={answers.invests === opt} onClick={() => set('invests', opt)}>{opt}</OptionBtn>
                ))}
              </div>
            </div>
            {answers.invests === 'Yes' && (
              <>
                <div>
                  <label style={{ display: 'block', color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)', marginBottom: 4 }}>How many different stocks or funds?</label>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    {['1-3', '4-7', '8+'].map(opt => (
                      <OptionBtn key={opt} selected={answers.num_investments === opt} onClick={() => set('num_investments', opt)}>{opt}</OptionBtn>
                    ))}
                  </div>
                </div>
                <div>
                  <label style={{ display: 'block', color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)', marginBottom: 4 }}>Is most of your money in one stock?</label>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    {['Yes', 'No'].map(opt => (
                      <OptionBtn key={opt} selected={answers.concentrated === opt} onClick={() => set('concentrated', opt)}>{opt}</OptionBtn>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* Step 4: Debt */}
        {step === 4 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)', marginBottom: 4 }}>Total debt (student loans, credit cards, mortgage, etc.)</label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-faint)' }}>$</span>
                <input type="number" value={answers.total_debt} onChange={e => set('total_debt', e.target.value)}
                  placeholder="0" style={{ ...inputStyle, paddingLeft: '1.5rem' }} />
              </div>
            </div>
            <div>
              <label style={{ display: 'block', color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)', marginBottom: 4 }}>Total assets (savings, property, investments, etc.)</label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-faint)' }}>$</span>
                <input type="number" value={answers.total_assets} onChange={e => set('total_assets', e.target.value)}
                  placeholder="0" style={{ ...inputStyle, paddingLeft: '1.5rem' }} />
              </div>
            </div>
          </div>
        )}

        {/* Step 5: Debt Details */}
        {step === 5 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div style={{ flex: '1 1 120px' }}>
                <label style={{ display: 'block', color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)', marginBottom: 3 }}>Name</label>
                <input style={inputStyle} placeholder="e.g. Visa" value={debtForm.name} onChange={e => setDebtForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div style={{ flex: '0 1 90px' }}>
                <label style={{ display: 'block', color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)', marginBottom: 3 }}>Balance</label>
                <input style={inputStyle} type="number" placeholder="$0" value={debtForm.balance} onChange={e => setDebtForm(f => ({ ...f, balance: e.target.value }))} />
              </div>
              <div style={{ flex: '0 1 70px' }}>
                <label style={{ display: 'block', color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)', marginBottom: 3 }}>APR %</label>
                <input style={inputStyle} type="number" step="0.1" placeholder="0" value={debtForm.interest_rate} onChange={e => setDebtForm(f => ({ ...f, interest_rate: e.target.value }))} />
              </div>
              <div style={{ flex: '0 1 90px' }}>
                <label style={{ display: 'block', color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)', marginBottom: 3 }}>Min/mo</label>
                <input style={inputStyle} type="number" placeholder="$0" value={debtForm.min_payment} onChange={e => setDebtForm(f => ({ ...f, min_payment: e.target.value }))} />
              </div>
              <button type="button" onClick={addDebt} style={{
                padding: '0.65rem 0.75rem', borderRadius: 2, border: 'none',
                background: 'var(--color-primary)', color: 'var(--color-accent)', fontSize: 'var(--text-sm)', fontWeight: 600, cursor: 'pointer', height: 38,
              }}>Add</button>
            </div>

            {debtList.length > 0 && (
              <div style={{ border: '1px solid var(--color-border)', borderRadius: 2 }}>
                {debtList.map((d, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0.65rem', borderBottom: i < debtList.length - 1 ? '1px solid var(--color-border)' : 'none' }}>
                    <div>
                      <span style={{ fontSize: 'var(--text-base)', fontWeight: 500 }}>{d.name}</span>
                      <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-faint)', marginLeft: '0.5rem' }}>{d.interest_rate}% APR</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-danger)' }}>${parseFloat(d.balance).toLocaleString()}</span>
                      <button type="button" onClick={() => removeDebt(i)} style={{ background: 'none', border: 'none', color: 'var(--color-text-faint)', cursor: 'pointer', fontSize: 'var(--text-lg)' }}>×</button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {debtList.length === 0 && (
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-faint)' }}>Add each debt above — credit cards, student loans, car loans, etc. This will auto-populate your Debt Planner.</p>
            )}
          </div>
        )}

        {/* Step 6: Goals */}
        {step === 6 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)', marginBottom: 4 }}>Do you have a financial goal you're working toward?</label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {['Yes', 'No'].map(opt => (
                  <OptionBtn key={opt} selected={answers.has_goal === opt} onClick={() => set('has_goal', opt)}>{opt}</OptionBtn>
                ))}
              </div>
            </div>
            {answers.has_goal === 'Yes' && (
              <div>
                <label style={{ display: 'block', color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)', marginBottom: 4 }}>Are you on track to hit it?</label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  {['Yes', 'Mostly', 'Not really'].map(opt => (
                    <OptionBtn key={opt} selected={answers.goal_on_track === opt} onClick={() => set('goal_on_track', opt)}>{opt}</OptionBtn>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 7: Biggest Goal */}
        {step === 7 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <label style={{ display: 'block', color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)', marginBottom: 4 }}>What is your biggest financial goal right now?</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {GOAL_OPTIONS.map(opt => (
                <OptionBtn key={opt} selected={answers.biggest_goal === opt} onClick={() => set('biggest_goal', opt)}>{opt}</OptionBtn>
              ))}
            </div>
          </div>
        )}

        {/* Navigation */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2rem', gap: '0.5rem' }}>
          {step > 0 ? (
            <button onClick={handleBack} style={{
              padding: '0.6rem 1.5rem', borderRadius: 2, border: '1px solid var(--color-border)',
              background: 'var(--color-surface)', color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)', cursor: 'pointer',
            }}>
              Back
            </button>
          ) : <div />}

          {step < lastStep ? (
            <button onClick={handleNext} disabled={!canNext()} style={{
              padding: '0.6rem 1.5rem', borderRadius: 2, border: 'none',
              background: canNext() ? 'var(--color-primary)' : 'var(--color-border)',
              color: canNext() ? 'var(--color-accent)' : 'var(--color-text-faint)',
              fontSize: 'var(--text-sm)', fontWeight: 600, cursor: canNext() ? 'pointer' : 'not-allowed',
              textTransform: 'uppercase', letterSpacing: '0.06em',
            }}>
              Next
            </button>
          ) : (
            <button onClick={submit} disabled={!canNext() || loading} style={{
              padding: '0.6rem 1.5rem', borderRadius: 2, border: 'none',
              background: canNext() ? 'var(--color-primary)' : 'var(--color-border)',
              color: canNext() ? 'var(--color-accent)' : 'var(--color-text-faint)',
              fontSize: 'var(--text-sm)', fontWeight: 600, cursor: canNext() ? 'pointer' : 'not-allowed',
              textTransform: 'uppercase', letterSpacing: '0.06em',
            }}>
              {loading ? 'Calculating...' : 'See My Score'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
