import { useState, useEffect, useCallback } from 'react'
import useApi from '../hooks/useApi'
import { useToast } from '../components/Toast'
import PageChat from '../components/PageChat'
import LoadingSpinner from '../components/LoadingSpinner'

import MonthHeader from './budget/MonthHeader'
import SpendingOverview from './budget/SpendingOverview'
import CategoryGrid from './budget/CategoryGrid'
import TransactionList from './budget/TransactionList'
import ImportModal from './budget/ImportModal'
import BudgetSetup from './budget/BudgetSetup'
// AllocationSetup is now integrated into MonthHeader

const CATEGORIES = ['Food & Dining', 'Transport', 'Shopping', 'Subscriptions', 'Health', 'Entertainment', 'Income', 'Transfer', 'Other']

export default function Budget() {
  const { get, post, patch, del } = useApi()
  const { toast } = useToast()

  const now = new Date()
  const [viewYear, setViewYear] = useState(now.getFullYear())
  const [viewMonth, setViewMonth] = useState(now.getMonth())
  const [overview, setOverview] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showImport, setShowImport] = useState(false)
  const [showSetup, setShowSetup] = useState(false)
  const [categoryFilter, setCategoryFilter] = useState(null)

  const monthKey = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}`

  const fetchOverview = useCallback(async () => {
    setLoading(true)
    try {
      const res = await get(`/api/budget/overview?month=${monthKey}`)
      setOverview(res.data)
      // Show setup for category limits if income + allocation are set but no goals exist
      if (res.data.income && res.data.income_confirmed && res.data.allocation_locked && Object.keys(res.data.goals || {}).length === 0 && (res.data.transactions || []).length === 0) {
        setShowSetup(true)
      }
    } catch (err) {
      toast(err.message || 'Failed to load budget', 'error')
    }
    setLoading(false)
  }, [monthKey])

  useEffect(() => { fetchOverview() }, [fetchOverview])

  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11) }
    else setViewMonth(m => m - 1)
  }

  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0) }
    else setViewMonth(m => m + 1)
  }

  const confirmIncome = async (amount) => {
    try {
      await post('/api/budget/confirm-income', { month: monthKey, income: amount })
      toast('Income confirmed', 'success')
      fetchOverview()
    } catch (err) { toast(err.message || 'Failed to confirm income', 'error') }
  }

  const saveAllocation = async ({ spend_pct, savings_pct, invest_pct }) => {
    try {
      await post('/api/budget/set-allocation', { month: monthKey, spend_pct, savings_pct, invest_pct })
      toast('Allocation locked for this month', 'success')
      await fetchOverview()
      setShowSetup(true)
    } catch (err) { toast(err.message || 'Failed to save allocation', 'error') }
  }

  const updateGoal = async (category, limit) => {
    const currentGoals = overview?.goals || {}
    const updated = { ...currentGoals, [category]: limit }
    const goalsArray = Object.entries(updated)
      .filter(([, v]) => v > 0)
      .map(([cat, monthly_limit]) => ({ category: cat, monthly_limit: parseFloat(monthly_limit) }))
    try {
      await post('/api/budget/goals', { goals: goalsArray })
      toast('Limit updated', 'success')
      fetchOverview()
    } catch (err) { toast(err.message || 'Failed to save limit', 'error') }
  }

  const addTransaction = async (txn) => {
    try {
      await post('/api/budget/transaction', txn)
      toast('Transaction added', 'success')
      fetchOverview()
    } catch (err) { toast(err.message || 'Failed to add transaction', 'error') }
  }

  const updateCategory = async (id, category) => {
    try {
      await patch(`/api/budget/transaction/${id}`, { category })
      fetchOverview()
    } catch (err) { toast(err.message || 'Failed to update category', 'error') }
  }

  const deleteTransaction = async (id) => {
    try {
      await del(`/api/budget/transaction/${id}`)
      fetchOverview()
    } catch (err) { toast(err.message || 'Failed to delete transaction', 'error') }
  }

  const completeSetup = async ({ goals }) => {
    try {
      if (goals.length > 0) {
        await post('/api/budget/goals', { goals })
        toast('Limits saved', 'success')
      }
      setShowSetup(false)
      fetchOverview()
    } catch (err) { toast(err.message || 'Failed to save limits', 'error') }
  }

  if (loading && !overview) return <LoadingSpinner height={300} />

  const transactions = overview?.transactions || []
  const goals = overview?.goals || {}
  const spending = overview?.spending_by_category || {}
  const income = overview?.income || 0
  const totalSpent = overview?.total_spent || 0
  const remaining = overview?.remaining || 0
  const incomeConfirmed = overview?.income_confirmed || false
  const allocation = overview?.allocation || null
  const allocationLocked = overview?.allocation_locked || false

  // Build chat context
  const spendingByCategory = {}
  transactions.filter(t => t.amount < 0).forEach(t => {
    const cat = t.category || 'Other'
    spendingByCategory[cat] = (spendingByCategory[cat] || 0) + Math.abs(t.amount)
  })

  return (
    <div>
      <MonthHeader
        month={viewMonth}
        year={viewYear}
        income={income}
        incomeConfirmed={incomeConfirmed}
        previousIncome={overview?.previous_income || 0}
        allocationLocked={allocationLocked}
        onPrev={prevMonth}
        onNext={nextMonth}
        onConfirmIncome={confirmIncome}
        onSaveAllocation={saveAllocation}
      />

      {/* Allocation not set prompt */}
      {incomeConfirmed && !allocationLocked && (
        <div className="card" style={{
          marginBottom: 'var(--space-lg)',
          padding: '1.25rem',
          background: 'var(--color-gold-10)',
          border: '1px solid var(--color-gold-30)',
          textAlign: 'center',
        }}>
          <p style={{ fontSize: 'var(--text-base)', fontWeight: 500, color: 'var(--color-text-primary)', marginBottom: '0.25rem' }}>
            Set your allocation for this month
          </p>
          <p className="text-faint" style={{ fontSize: 'var(--text-sm)', marginBottom: '0.75rem' }}>
            Split your income between spending, saving, and investing to unlock your budget breakdown.
          </p>
          <button className="btn btn-primary" onClick={() => {
            // Scroll to top where MonthHeader will show the setup
            window.scrollTo({ top: 0, behavior: 'smooth' })
          }}>
            Complete setup
          </button>
        </div>
      )}

      <SpendingOverview
        income={income}
        totalSpent={totalSpent}
        remaining={remaining}
      />

      {/* Locked allocation bar */}
      {allocationLocked && income > 0 && (
        <div className="card" style={{ marginBottom: 'var(--space-lg)' }}>
          <p className="label-caps" style={{ marginBottom: '0.5rem' }}>Monthly Allocation (locked)</p>
          <div style={{ height: 10, borderRadius: 5, overflow: 'hidden', display: 'flex', marginBottom: '0.75rem' }}>
            <div style={{ width: `${allocation.spend_pct}%`, background: 'var(--color-negative)' }} />
            <div style={{ width: `${allocation.savings_pct}%`, background: 'var(--color-positive)' }} />
            <div style={{ width: `${allocation.invest_pct}%`, background: 'var(--color-accent)' }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem', textAlign: 'center' }}>
            {[
              { label: 'Spend', pct: allocation.spend_pct, color: 'var(--color-negative)' },
              { label: 'Save', pct: allocation.savings_pct, color: 'var(--color-positive)' },
              { label: 'Invest', pct: allocation.invest_pct, color: 'var(--color-accent)' },
            ].map(s => (
              <div key={s.label}>
                <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>{s.label}</span>
                <p className="mono" style={{ fontSize: 'var(--text-base)', fontWeight: 600, color: s.color, margin: 0 }}>
                  {s.pct}% <span className="text-faint" style={{ fontSize: 'var(--text-xs)', fontWeight: 400 }}>${Math.round(income * s.pct / 100)}</span>
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      <CategoryGrid
        categories={CATEGORIES}
        spending={spending}
        goals={goals}
        onUpdateGoal={updateGoal}
        onSelectCategory={setCategoryFilter}
        selectedCategory={categoryFilter}
      />

      <TransactionList
        transactions={transactions}
        categoryFilter={categoryFilter}
        onAdd={addTransaction}
        onUpdateCategory={updateCategory}
        onDelete={deleteTransaction}
      />

      {/* Import button */}
      <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
        <button className="btn btn-primary" onClick={() => setShowImport(true)} style={{ padding: '0.5rem 1.5rem' }}>
          Import Bank CSV
        </button>
      </div>

      {/* AI Chat */}
      <PageChat
        context="budget"
        systemContext={`Monthly income: ${income}. Month: ${monthKey}. Spending by category: ${JSON.stringify(spendingByCategory)}. Budget limits: ${JSON.stringify(goals)}. Total spent: ${Math.abs(totalSpent)}. Remaining: ${remaining}.${allocationLocked ? ` Allocation: ${allocation.spend_pct}% spend, ${allocation.savings_pct}% save, ${allocation.invest_pct}% invest.` : ''}`}
        suggestedPrompts={[
          'Where am I overspending this month?',
          'How can I cut back on spending?',
          'Am I on track with my budget?',
        ]}
      />

      {/* Modals */}
      <ImportModal
        isOpen={showImport}
        onClose={() => setShowImport(false)}
        onImportComplete={fetchOverview}
      />

      {showSetup && <BudgetSetup income={income} spendBudget={allocationLocked ? Math.round(income * allocation.spend_pct / 100) : income} onComplete={completeSetup} onSkip={() => setShowSetup(false)} />}
    </div>
  )
}
