const express = require('express');
const router = express.Router();
const db = require('../db');
const { generateHealthSummary } = require('../services/claude');
const { sendError } = require('../utils/errors');

function scoreGrade(score) { if (score >= 18) return 'A'; if (score >= 15) return 'B+'; if (score >= 12) return 'B'; if (score >= 9) return 'C+'; if (score >= 6) return 'C'; return 'D'; }
function overallGrade(total) { if (total >= 90) return 'A'; if (total >= 80) return 'B+'; if (total >= 70) return 'B'; if (total >= 60) return 'C+'; if (total >= 50) return 'C'; return 'D'; }
function calcSpendingScore(income, spending) { if (!income || income <= 0) return { score: 10, summary: 'No income data' }; const ratio = spending / income; if (ratio < 0.6) return { score: 20, summary: `Spending ${Math.round(ratio * 100)}% of income — great` }; if (ratio < 0.8) return { score: 15, summary: `Spending ${Math.round(ratio * 100)}% of income — solid` }; if (ratio <= 1) return { score: 10, summary: `Spending ${Math.round(ratio * 100)}% of income — tight` }; return { score: 5, summary: 'Spending more than you earn' }; }
function calcSavingsScore(income, savings) { if (!income || income <= 0) return { score: 10, summary: 'No income data' }; const rate = savings / income; if (rate >= 0.2) return { score: 20, summary: `${Math.round(rate * 100)}% savings rate — excellent` }; if (rate >= 0.15) return { score: 15, summary: `${Math.round(rate * 100)}% savings rate — good` }; if (rate >= 0.1) return { score: 10, summary: `${Math.round(rate * 100)}% savings rate — okay` }; if (rate >= 0.05) return { score: 5, summary: `${Math.round(rate * 100)}% savings rate — low` }; return { score: 2, summary: 'Under 5% savings rate' }; }
function calcPortfolioScoreFromQuiz(invests, numInvestments, concentrated) { if (invests !== 'Yes') return { score: 5, summary: 'Not investing yet' }; let score = 5; if (numInvestments === '8+') score += 10; else if (numInvestments === '4-7') score += 7; else score += 3; if (concentrated !== 'Yes') score += 5; return { score: Math.min(score, 20), summary: score >= 15 ? 'Diversified portfolio' : score >= 10 ? 'Some diversification' : 'Concentrated in few investments' }; }
function calcDebtScore(debt, assets) { if (!debt || debt <= 0) return { score: 20, summary: 'No debt' }; if (!assets || assets <= 0) return { score: 5, summary: `$${Math.round(debt).toLocaleString()} in debt` }; const ratio = debt / assets; if (ratio < 0.25) return { score: 15, summary: `Debt is ${Math.round(ratio * 100)}% of assets — manageable` }; if (ratio < 0.5) return { score: 10, summary: `Debt is ${Math.round(ratio * 100)}% of assets — moderate` }; if (ratio < 0.75) return { score: 5, summary: `Debt is ${Math.round(ratio * 100)}% of assets — high` }; return { score: 2, summary: 'Debt exceeds 75% of assets' }; }
function calcGoalsScoreFromQuiz(hasGoal, onTrack) { if (hasGoal !== 'Yes') return { score: 10, summary: 'No financial goals set' }; if (onTrack === 'Yes') return { score: 20, summary: 'On track with goals' }; if (onTrack === 'Mostly') return { score: 15, summary: 'Mostly on track' }; return { score: 8, summary: 'Behind on goals' }; }

router.get('/onboarding-status', async (req, res) => {
  try { const row = await db.get('SELECT id FROM onboarding_answers WHERE user_id = $1 LIMIT 1', [req.userId]); res.json({ success: true, data: { completed: !!row } }); }
  catch (err) { sendError(res, err); }
});

router.post('/onboarding', async (req, res) => {
  try {
    const { monthly_income, monthly_spending, monthly_savings, has_emergency_fund, invests, num_investments, concentrated, total_debt, total_assets, has_goal, goal_on_track, budget_goals, debts, biggest_goal } = req.body;

    await db.run(`INSERT INTO onboarding_answers (user_id, monthly_income, monthly_spending, monthly_savings, has_emergency_fund, invests, num_investments, concentrated, total_debt, total_assets, has_goal, goal_on_track, biggest_goal) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
      [req.userId, monthly_income||0, monthly_spending||0, monthly_savings||0, has_emergency_fund||'No', invests||'No', num_investments||null, concentrated||null, total_debt||0, total_assets||0, has_goal||'No', goal_on_track||null, biggest_goal||null]);

    if (budget_goals && Array.isArray(budget_goals)) {
      for (const g of budget_goals) {
        if (g.category && g.monthly_limit > 0) {
          await db.run('INSERT INTO budget_goals (user_id, category, monthly_limit) VALUES ($1, $2, $3) ON CONFLICT(user_id, category) DO UPDATE SET monthly_limit = EXCLUDED.monthly_limit', [req.userId, g.category, g.monthly_limit]);
        }
      }
    }

    if (debts && Array.isArray(debts)) {
      for (const d of debts) {
        if (d.name && d.balance > 0) {
          await db.run('INSERT INTO debts (user_id, name, balance, interest_rate, min_payment) VALUES ($1, $2, $3, $4, $5)', [req.userId, d.name, d.balance, d.interest_rate || 0, d.min_payment || 0]);
        }
      }
    }

    const spending = calcSpendingScore(monthly_income, monthly_spending);
    const savings = calcSavingsScore(monthly_income, monthly_savings);
    const portfolio = calcPortfolioScoreFromQuiz(invests, num_investments, concentrated);
    const debt = calcDebtScore(total_debt, total_assets);
    const goals = calcGoalsScoreFromQuiz(has_goal, goal_on_track);
    const total = spending.score + savings.score + portfolio.score + debt.score + goals.score;

    const categories = [
      { name: 'Spending', score: spending.score, maxScore: 20, grade: scoreGrade(spending.score), summary: spending.summary },
      { name: 'Savings', score: savings.score, maxScore: 20, grade: scoreGrade(savings.score), summary: savings.summary },
      { name: 'Portfolio', score: portfolio.score, maxScore: 20, grade: scoreGrade(portfolio.score), summary: portfolio.summary },
      { name: 'Debt', score: debt.score, maxScore: 20, grade: scoreGrade(debt.score), summary: debt.summary },
      { name: 'Goals', score: goals.score, maxScore: 20, grade: scoreGrade(goals.score), summary: goals.summary },
    ];

    let aiSummary = '';
    try { aiSummary = await generateHealthSummary({ score: total, spendingGrade: scoreGrade(spending.score), savingsGrade: scoreGrade(savings.score), portfolioGrade: scoreGrade(portfolio.score), debtGrade: scoreGrade(debt.score), goalsGrade: scoreGrade(goals.score) }); }
    catch { aiSummary = total >= 70 ? "You're in decent financial shape — keep building on your strengths." : "There's room to improve — focus on the areas with lower grades."; }

    await db.run('INSERT INTO health_scores (user_id, score, spending_score, savings_score, portfolio_score, debt_score, goals_score, ai_summary, is_baseline) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,1)',
      [req.userId, total, spending.score, savings.score, portfolio.score, debt.score, goals.score, aiSummary]);

    if (biggest_goal) {
      const goalMap = {
        'Emergency Fund': { name: 'Build Emergency Fund', target: (monthly_spending || 3000) * 6, years: 1, category: 'Savings' },
        'Pay Off Debt': { name: 'Pay Off All Debt', target: total_debt || 10000, years: 2, category: 'Debt' },
        'Save for House': { name: 'Save for a House', target: 50000, years: 3, category: 'Savings' },
        'Retirement': { name: 'Retirement Savings', target: 100000, years: 10, category: 'Investing' },
        'Investment Growth': { name: 'Grow Investments', target: 25000, years: 3, category: 'Investing' },
      };
      const mapped = goalMap[biggest_goal];
      if (mapped) {
        const deadline = new Date(); deadline.setFullYear(deadline.getFullYear() + mapped.years);
        try { await db.run('INSERT INTO atlas_ultimate_goals (user_id, name, description, target_amount, deadline, category) VALUES ($1,$2,$3,$4,$5,$6)', [req.userId, mapped.name, 'Auto-created from your onboarding quiz — your biggest financial goal.', mapped.target, deadline.toISOString().split('T')[0], mapped.category]); } catch {}
      }
    }

    function qualitativeLabel(score) { if (score >= 90) return 'Excellent'; if (score >= 80) return 'Strong'; if (score >= 70) return 'Good'; if (score >= 60) return 'Fair'; if (score >= 50) return 'Needs Work'; return 'Needs Attention'; }

    res.json({ success: true, data: { scoreType: 'baseline', label: qualitativeLabel(total), grade: overallGrade(total), categories: categories.map(c => ({ name: c.name, grade: c.grade, summary: c.summary })), aiSummary } });
  } catch (err) { sendError(res, err); }
});

router.get('/health-score', async (req, res) => {
  try {
    const force = req.query.force === 'true';

    if (!force) {
      const existing = await db.get('SELECT * FROM health_scores WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1', [req.userId]);
      if (existing) {
        const hoursSince = (Date.now() - new Date(existing.created_at).getTime()) / (1000 * 60 * 60);
        if (hoursSince < 24) {
          const txnCount = await db.get('SELECT COUNT(*) as cnt FROM transactions WHERE user_id = $1', [req.userId]);
          const posCount = await db.get('SELECT COUNT(*) as cnt FROM portfolio_positions pp JOIN portfolios p ON pp.portfolio_id = p.id WHERE p.user_id = $1', [req.userId]);
          const isBaseline = existing.is_baseline && parseInt(txnCount.cnt) === 0 && parseInt(posCount.cnt) === 0;

          const categories = [
            { name: 'Spending', score: existing.spending_score, maxScore: 20, grade: scoreGrade(existing.spending_score), summary: '' },
            { name: 'Savings', score: existing.savings_score, maxScore: 20, grade: scoreGrade(existing.savings_score), summary: '' },
            { name: 'Portfolio', score: existing.portfolio_score, maxScore: 20, grade: scoreGrade(existing.portfolio_score), summary: '' },
            { name: 'Debt', score: existing.debt_score, maxScore: 20, grade: scoreGrade(existing.debt_score), summary: '' },
            { name: 'Goals', score: existing.goals_score, maxScore: 20, grade: scoreGrade(existing.goals_score), summary: '' },
          ];

          if (isBaseline) {
            function qualitativeLabel(score) { if (score >= 90) return 'Excellent'; if (score >= 80) return 'Strong'; if (score >= 70) return 'Good'; if (score >= 60) return 'Fair'; if (score >= 50) return 'Needs Work'; return 'Needs Attention'; }
            return res.json({ success: true, data: { scoreType: 'baseline', label: qualitativeLabel(existing.score), grade: overallGrade(existing.score), categories: categories.map(c => ({ name: c.name, grade: c.grade, summary: c.summary })), aiSummary: existing.ai_summary } });
          }
          return res.json({ success: true, data: { scoreType: 'full', score: existing.score, grade: overallGrade(existing.score), categories, aiSummary: existing.ai_summary } });
        }
      }
    }

    const now = new Date();
    const curMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    const txns = await db.all('SELECT * FROM transactions WHERE user_id = $1 AND month = $2', [req.userId, curMonth]);
    const positions = await db.all('SELECT pp.* FROM portfolio_positions pp JOIN portfolios p ON pp.portfolio_id = p.id WHERE p.user_id = $1', [req.userId]);
    const nwAssets = await db.get('SELECT COALESCE(SUM(value), 0) as total FROM net_worth_assets WHERE user_id = $1', [req.userId]);
    const nwLiabilities = await db.get('SELECT COALESCE(SUM(value), 0) as total FROM net_worth_liabilities WHERE user_id = $1', [req.userId]);
    const debtTotal = await db.get('SELECT COALESCE(SUM(balance), 0) as total FROM debts WHERE user_id = $1', [req.userId]);
    const goals = await db.all("SELECT * FROM atlas_goals WHERE user_id = $1 AND status = 'active'", [req.userId]);
    const budgetGoals = await db.all('SELECT * FROM budget_goals WHERE user_id = $1', [req.userId]);

    const totalDebtAmount = Math.max(parseFloat(nwLiabilities.total), parseFloat(debtTotal.total));
    const hasRealData = txns.length > 0 || positions.length > 0 || parseFloat(debtTotal.total) > 0;

    let spending, savings, portfolio, debt, goalsScore;

    if (hasRealData) {
      const totalSpent = txns.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);
      const totalIncome = txns.filter(t => t.amount > 0).reduce((s, t) => s + parseFloat(t.amount), 0);
      spending = calcSpendingScore(totalIncome, totalSpent);
      savings = calcSavingsScore(totalIncome, totalIncome - totalSpent);

      const uniqueTickers = new Set(positions.map(p => p.ticker));
      const posCount = uniqueTickers.size;
      const totalValue = positions.reduce((s, p) => s + (p.avg_cost * p.shares), 0);
      const maxPosition = totalValue > 0 ? Math.max(...positions.map(p => (p.avg_cost * p.shares) / totalValue)) : 0;
      let portScore = 5;
      if (posCount >= 8) portScore += 10; else if (posCount >= 4) portScore += 7; else if (posCount >= 1) portScore += 3;
      if (maxPosition < 0.4) portScore += 5;
      portfolio = { score: Math.min(portScore, 20), summary: posCount > 0 ? `${posCount} holdings` : 'No investments' };

      debt = calcDebtScore(totalDebtAmount, parseFloat(nwAssets.total));

      if (goals.length === 0) { goalsScore = { score: 10, summary: 'No goals set' }; }
      else {
        const onTrack = goals.filter(g => { if (!g.target_amount || g.target_amount <= 0) return true; return (g.current_amount / g.target_amount) >= 0.5; }).length;
        const pct = onTrack / goals.length;
        if (pct >= 0.8) goalsScore = { score: 20, summary: 'Most goals on track' }; else if (pct >= 0.5) goalsScore = { score: 15, summary: 'Some goals on track' }; else goalsScore = { score: 8, summary: 'Behind on most goals' };
      }
    } else {
      const ob = await db.get('SELECT * FROM onboarding_answers WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1', [req.userId]);
      if (!ob) return res.json({ success: true, data: null });
      spending = calcSpendingScore(ob.monthly_income, ob.monthly_spending);
      savings = calcSavingsScore(ob.monthly_income, ob.monthly_savings);
      portfolio = calcPortfolioScoreFromQuiz(ob.invests, ob.num_investments, ob.concentrated);
      debt = calcDebtScore(ob.total_debt, ob.total_assets);
      goalsScore = calcGoalsScoreFromQuiz(ob.has_goal, ob.goal_on_track);
    }

    const total = spending.score + savings.score + portfolio.score + debt.score + goalsScore.score;
    const categories = [
      { name: 'Spending', score: spending.score, maxScore: 20, grade: scoreGrade(spending.score), summary: spending.summary },
      { name: 'Savings', score: savings.score, maxScore: 20, grade: scoreGrade(savings.score), summary: savings.summary },
      { name: 'Portfolio', score: portfolio.score, maxScore: 20, grade: scoreGrade(portfolio.score), summary: portfolio.summary },
      { name: 'Debt', score: debt.score, maxScore: 20, grade: scoreGrade(debt.score), summary: debt.summary },
      { name: 'Goals', score: goalsScore.score, maxScore: 20, grade: scoreGrade(goalsScore.score), summary: goalsScore.summary },
    ];

    let aiSummary = '';
    try { aiSummary = await generateHealthSummary({ score: total, spendingGrade: scoreGrade(spending.score), savingsGrade: scoreGrade(savings.score), portfolioGrade: scoreGrade(portfolio.score), debtGrade: scoreGrade(debt.score), goalsGrade: scoreGrade(goalsScore.score) }); }
    catch { aiSummary = total >= 70 ? "You're in decent shape — keep it up." : "Some areas need work — check the grades below."; }

    await db.run('INSERT INTO health_scores (user_id, score, spending_score, savings_score, portfolio_score, debt_score, goals_score, ai_summary, is_baseline) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,0)',
      [req.userId, total, spending.score, savings.score, portfolio.score, debt.score, goalsScore.score, aiSummary]);

    res.json({ success: true, data: { scoreType: 'full', score: total, grade: overallGrade(total), categories, aiSummary } });
  } catch (err) { sendError(res, err); }
});

router.post('/share-score', async (req, res) => {
  try {
    const latest = await db.get('SELECT * FROM health_scores WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1', [req.userId]);
    if (!latest) return res.status(404).json({ success: false, error: 'No score found' });
    if (latest.share_token) return res.json({ success: true, data: { token: latest.share_token } });
    const crypto = require('crypto');
    const token = crypto.randomBytes(12).toString('hex');
    await db.run('UPDATE health_scores SET share_token = $1 WHERE id = $2', [token, latest.id]);
    res.json({ success: true, data: { token } });
  } catch (err) { sendError(res, err); }
});

router.get('/dashboard', async (req, res) => {
  try {
    const insights = [];
    const now = new Date();
    const curMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;

    const curTxns = await db.all('SELECT * FROM transactions WHERE user_id = $1 AND month = $2', [req.userId, curMonth]);
    const prevTxns = await db.all('SELECT * FROM transactions WHERE user_id = $1 AND month = $2', [req.userId, prevMonth]);

    if (curTxns.length > 0) {
      const curSpent = curTxns.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);
      const prevSpent = prevTxns.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);
      if (prevSpent > 0) {
        const change = ((curSpent - prevSpent) / prevSpent * 100).toFixed(0);
        if (Math.abs(change) >= 10) insights.push({ type: 'spending', content: `Spending is ${change > 0 ? 'up' : 'down'} ${Math.abs(change)}% vs last month — $${curSpent.toFixed(0)} vs $${prevSpent.toFixed(0)}`, created_at: now.toISOString() });
      }

      const byCategory = {};
      curTxns.filter(t => t.amount < 0).forEach(t => { const cat = t.category || 'Other'; byCategory[cat] = (byCategory[cat] || 0) + Math.abs(t.amount); });
      const prevByCategory = {};
      prevTxns.filter(t => t.amount < 0).forEach(t => { const cat = t.category || 'Other'; prevByCategory[cat] = (prevByCategory[cat] || 0) + Math.abs(t.amount); });
      for (const [cat, amount] of Object.entries(byCategory)) {
        const prev = prevByCategory[cat] || 0;
        if (prev > 0 && amount > prev) {
          const pctChange = ((amount - prev) / prev * 100).toFixed(0);
          if (pctChange >= 25 && amount > 50) { insights.push({ type: 'spending', content: `${cat} spending up ${pctChange}% — $${amount.toFixed(0)} vs $${prev.toFixed(0)} last month`, created_at: now.toISOString() }); break; }
        }
      }
    }

    const budgetGoals = await db.all('SELECT * FROM budget_goals WHERE user_id = $1', [req.userId]);
    if (budgetGoals.length > 0 && curTxns.length > 0) {
      const byCategory = {};
      curTxns.filter(t => t.amount < 0).forEach(t => { const cat = t.category || 'Other'; byCategory[cat] = (byCategory[cat] || 0) + Math.abs(t.amount); });
      for (const goal of budgetGoals) {
        const spent = byCategory[goal.category] || 0;
        if (spent > goal.monthly_limit) insights.push({ type: 'budget', content: `${goal.category}: $${spent.toFixed(0)} spent vs $${parseFloat(goal.monthly_limit).toFixed(0)} limit — $${(spent - goal.monthly_limit).toFixed(0)} over budget`, created_at: now.toISOString() });
      }
    }

    const goals = await db.all("SELECT * FROM atlas_goals WHERE user_id = $1 AND status = 'active'", [req.userId]);
    for (const goal of goals.slice(0, 2)) {
      if (goal.target_amount > 0 && goal.deadline) {
        const deadline = new Date(goal.deadline + 'T00:00:00');
        const daysLeft = Math.max(0, Math.ceil((deadline - now) / (1000 * 60 * 60 * 24)));
        const pct = (goal.current_amount / goal.target_amount * 100).toFixed(0);
        const remaining = goal.target_amount - goal.current_amount;
        if (remaining > 0 && daysLeft > 0 && daysLeft <= 60) insights.push({ type: 'goals', content: `${goal.name}: ${pct}% done, $${remaining.toFixed(0)} to go with ${daysLeft} days left`, created_at: now.toISOString() });
      }
    }

    res.json({ success: true, data: insights.slice(0, 5) });
  } catch (err) { sendError(res, err); }
});

module.exports = router;
