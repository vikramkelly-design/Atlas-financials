import { useState } from 'react'
import { api } from '../hooks/useApi'

const STEPS = [
  { title: 'Income & Spending', subtitle: 'How much comes in and goes out each month' },
  { title: 'Savings', subtitle: 'What you\'re putting away' },
  { title: 'Investments', subtitle: 'Are you growing your money' },
  { title: 'Debt', subtitle: 'What you owe vs what you own' },
  { title: 'Goals', subtitle: 'Where you\'re headed' },
]

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
  })

  const set = (key, val) => setAnswers(a => ({ ...a, [key]: val }))

  const canNext = () => {
    if (step === 0) return answers.monthly_income && answers.monthly_spending
    if (step === 1) return answers.monthly_savings && answers.has_emergency_fund
    if (step === 2) {
      if (!answers.invests) return false
      if (answers.invests === 'Yes') return answers.num_investments && answers.concentrated
      return true
    }
    if (step === 3) return answers.total_debt !== '' && answers.total_assets !== ''
    if (step === 4) {
      if (!answers.has_goal) return false
      if (answers.has_goal === 'Yes') return !!answers.goal_on_track
      return true
    }
    return true
  }

  const submit = async () => {
    setLoading(true)
    try {
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
      })
      setResult(res.data.data)
    } catch (err) {
      console.error(err)
    }
    setLoading(false)
  }

  const inputStyle = {
    width: '100%', padding: '0.65rem 0.75rem', borderRadius: 2,
    border: '1px solid #E8DDD0', background: '#FFF8F0', color: '#6B1A1A',
    fontSize: '0.9rem', outline: 'none',
  }

  const OptionBtn = ({ selected, onClick, children }) => (
    <button type="button" onClick={onClick} style={{
      padding: '0.6rem 1.2rem', borderRadius: 2, cursor: 'pointer',
      border: selected ? '2px solid #1B2A4A' : '1px solid #E8DDD0',
      background: selected ? '#1B2A4A' : '#FFF8F0',
      color: selected ? '#C9A84C' : '#6B1A1A',
      fontSize: '0.85rem', fontWeight: selected ? 600 : 400,
      transition: 'all 0.1s',
    }}>
      {children}
    </button>
  )

  const gradeColor = (grade) => {
    if (grade === 'A' || grade === 'B+') return '#2A5C3A'
    if (grade === 'B' || grade === 'C+') return '#8B6A2A'
    return '#8B3A2A'
  }

  // Show results
  if (result) {
    return (
      <div style={{ minHeight: '100vh', background: '#FFFCF5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: '100%', maxWidth: 440, padding: '2rem' }}>
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <h1 style={{ fontFamily: "'Allura', cursive", fontSize: 48, color: '#C9A84C', fontWeight: 400, marginBottom: '0.5rem' }}>Atlas</h1>
            <p style={{ color: '#B89090', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Your Financial Health Score</p>
          </div>

          <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
            <span style={{ fontSize: '4rem', fontWeight: 700, color: '#1B2A4A', fontFamily: 'var(--font-mono)' }}>{result.score}</span>
            <span style={{ fontSize: '1.5rem', color: '#B89090' }}> / 100</span>
            <div style={{ margin: '0.75rem auto', maxWidth: 300 }}>
              <div style={{ height: 10, borderRadius: 5, background: '#E8DDD0', overflow: 'hidden' }}>
                <div style={{ width: `${result.score}%`, height: '100%', borderRadius: 5, background: result.score >= 70 ? '#2A5C3A' : result.score >= 50 ? '#C9A84C' : '#8B3A2A', transition: 'width 0.5s' }} />
              </div>
            </div>
            <span style={{ fontSize: '1.1rem', fontWeight: 600, color: gradeColor(result.grade), padding: '0.2rem 0.75rem', background: '#FFF8F0', border: `1px solid ${gradeColor(result.grade)}`, borderRadius: 2 }}>
              {result.grade}
            </span>
          </div>

          <div style={{ border: '1px solid #E8DDD0', borderRadius: 2, overflow: 'hidden', marginBottom: '1.5rem' }}>
            {result.categories.map((cat, i) => (
              <div key={cat.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.65rem 0.85rem', borderBottom: i < result.categories.length - 1 ? '1px solid #E8DDD0' : 'none', background: '#FFFCF5' }}>
                <div>
                  <span style={{ fontSize: '0.85rem', fontWeight: 500, color: '#6B1A1A' }}>{cat.name}</span>
                  <p style={{ fontSize: '0.75rem', color: '#B89090', marginTop: 2 }}>{cat.summary}</p>
                </div>
                <span style={{ fontSize: '1rem', fontWeight: 700, color: gradeColor(cat.grade), minWidth: 30, textAlign: 'right' }}>{cat.grade}</span>
              </div>
            ))}
          </div>

          {result.aiSummary && (
            <p style={{ fontSize: '0.85rem', color: '#8B3A3A', textAlign: 'center', marginBottom: '1.5rem', lineHeight: 1.5 }}>
              {result.aiSummary}
            </p>
          )}

          <button onClick={onComplete} style={{
            width: '100%', padding: '0.7rem', borderRadius: 2, border: 'none',
            background: '#1B2A4A', color: '#C9A84C', fontSize: '0.85rem',
            fontWeight: 600, cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.06em',
          }}>
            Go to Dashboard
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#FFFCF5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: '100%', maxWidth: 440, padding: '2rem' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <h1 style={{ fontFamily: "'Allura', cursive", fontSize: 48, color: '#C9A84C', fontWeight: 400, marginBottom: '0.5rem' }}>Atlas</h1>
          <p style={{ color: '#B89090', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Quick Financial Check-Up</p>
        </div>

        {/* Progress */}
        <div style={{ display: 'flex', gap: 4, marginBottom: '2rem' }}>
          {STEPS.map((_, i) => (
            <div key={i} style={{ flex: 1, height: 4, borderRadius: 2, background: i <= step ? '#1B2A4A' : '#E8DDD0', transition: 'background 0.2s' }} />
          ))}
        </div>

        {/* Step title */}
        <h2 style={{ fontSize: '1.1rem', color: '#6B1A1A', marginBottom: '0.25rem' }}>{STEPS[step].title}</h2>
        <p style={{ fontSize: '0.8rem', color: '#B89090', marginBottom: '1.5rem' }}>{STEPS[step].subtitle}</p>

        {/* Step 1: Income & Spending */}
        {step === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', color: '#8B3A3A', fontSize: '0.75rem', marginBottom: 4 }}>Monthly income (after taxes)</label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#B89090' }}>$</span>
                <input type="number" value={answers.monthly_income} onChange={e => set('monthly_income', e.target.value)}
                  placeholder="0" style={{ ...inputStyle, paddingLeft: '1.5rem' }} />
              </div>
            </div>
            <div>
              <label style={{ display: 'block', color: '#8B3A3A', fontSize: '0.75rem', marginBottom: 4 }}>Monthly spending (roughly)</label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#B89090' }}>$</span>
                <input type="number" value={answers.monthly_spending} onChange={e => set('monthly_spending', e.target.value)}
                  placeholder="0" style={{ ...inputStyle, paddingLeft: '1.5rem' }} />
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Savings */}
        {step === 1 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', color: '#8B3A3A', fontSize: '0.75rem', marginBottom: 4 }}>Monthly savings</label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#B89090' }}>$</span>
                <input type="number" value={answers.monthly_savings} onChange={e => set('monthly_savings', e.target.value)}
                  placeholder="0" style={{ ...inputStyle, paddingLeft: '1.5rem' }} />
              </div>
            </div>
            <div>
              <label style={{ display: 'block', color: '#8B3A3A', fontSize: '0.75rem', marginBottom: 4 }}>Do you have an emergency fund?</label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {['Yes', 'Working on it', 'No'].map(opt => (
                  <OptionBtn key={opt} selected={answers.has_emergency_fund === opt} onClick={() => set('has_emergency_fund', opt)}>{opt}</OptionBtn>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Investments */}
        {step === 2 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', color: '#8B3A3A', fontSize: '0.75rem', marginBottom: 4 }}>Do you invest?</label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {['Yes', 'No'].map(opt => (
                  <OptionBtn key={opt} selected={answers.invests === opt} onClick={() => set('invests', opt)}>{opt}</OptionBtn>
                ))}
              </div>
            </div>
            {answers.invests === 'Yes' && (
              <>
                <div>
                  <label style={{ display: 'block', color: '#8B3A3A', fontSize: '0.75rem', marginBottom: 4 }}>How many different stocks or funds?</label>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    {['1-3', '4-7', '8+'].map(opt => (
                      <OptionBtn key={opt} selected={answers.num_investments === opt} onClick={() => set('num_investments', opt)}>{opt}</OptionBtn>
                    ))}
                  </div>
                </div>
                <div>
                  <label style={{ display: 'block', color: '#8B3A3A', fontSize: '0.75rem', marginBottom: 4 }}>Is most of your money in one stock?</label>
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
        {step === 3 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', color: '#8B3A3A', fontSize: '0.75rem', marginBottom: 4 }}>Total debt (student loans, credit cards, mortgage, etc.)</label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#B89090' }}>$</span>
                <input type="number" value={answers.total_debt} onChange={e => set('total_debt', e.target.value)}
                  placeholder="0" style={{ ...inputStyle, paddingLeft: '1.5rem' }} />
              </div>
            </div>
            <div>
              <label style={{ display: 'block', color: '#8B3A3A', fontSize: '0.75rem', marginBottom: 4 }}>Total assets (savings, property, investments, etc.)</label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#B89090' }}>$</span>
                <input type="number" value={answers.total_assets} onChange={e => set('total_assets', e.target.value)}
                  placeholder="0" style={{ ...inputStyle, paddingLeft: '1.5rem' }} />
              </div>
            </div>
          </div>
        )}

        {/* Step 5: Goals */}
        {step === 4 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', color: '#8B3A3A', fontSize: '0.75rem', marginBottom: 4 }}>Do you have a financial goal you're working toward?</label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {['Yes', 'No'].map(opt => (
                  <OptionBtn key={opt} selected={answers.has_goal === opt} onClick={() => set('has_goal', opt)}>{opt}</OptionBtn>
                ))}
              </div>
            </div>
            {answers.has_goal === 'Yes' && (
              <div>
                <label style={{ display: 'block', color: '#8B3A3A', fontSize: '0.75rem', marginBottom: 4 }}>Are you on track to hit it?</label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  {['Yes', 'Mostly', 'Not really'].map(opt => (
                    <OptionBtn key={opt} selected={answers.goal_on_track === opt} onClick={() => set('goal_on_track', opt)}>{opt}</OptionBtn>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Navigation */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2rem', gap: '0.5rem' }}>
          {step > 0 ? (
            <button onClick={() => setStep(s => s - 1)} style={{
              padding: '0.6rem 1.5rem', borderRadius: 2, border: '1px solid #E8DDD0',
              background: '#FFF8F0', color: '#8B3A3A', fontSize: '0.8rem', cursor: 'pointer',
            }}>
              Back
            </button>
          ) : <div />}

          {step < 4 ? (
            <button onClick={() => setStep(s => s + 1)} disabled={!canNext()} style={{
              padding: '0.6rem 1.5rem', borderRadius: 2, border: 'none',
              background: canNext() ? '#1B2A4A' : '#E8DDD0',
              color: canNext() ? '#C9A84C' : '#B89090',
              fontSize: '0.8rem', fontWeight: 600, cursor: canNext() ? 'pointer' : 'not-allowed',
              textTransform: 'uppercase', letterSpacing: '0.06em',
            }}>
              Next
            </button>
          ) : (
            <button onClick={submit} disabled={!canNext() || loading} style={{
              padding: '0.6rem 1.5rem', borderRadius: 2, border: 'none',
              background: canNext() ? '#1B2A4A' : '#E8DDD0',
              color: canNext() ? '#C9A84C' : '#B89090',
              fontSize: '0.8rem', fontWeight: 600, cursor: canNext() ? 'pointer' : 'not-allowed',
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
