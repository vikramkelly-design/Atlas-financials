const express = require('express');
const router = express.Router();
const db = require('../db');
const { sendError } = require('../utils/errors');

const WEEKLY_CONCEPTS = [
  { term: 'Compound Interest', short: 'Earning returns on your returns — the most powerful force in investing.' },
  { term: 'Dollar-Cost Averaging', short: 'Investing a fixed amount regularly regardless of price — reduces timing risk.' },
  { term: 'Margin of Safety', short: 'Buying below intrinsic value to protect against errors in your analysis.' },
  { term: 'Diversification', short: 'Spreading investments across assets so no single loss can hurt you badly.' },
  { term: 'P/E Ratio', short: 'Price-to-Earnings — how much you pay per dollar of company profit.' },
  { term: 'Free Cash Flow', short: 'Cash a company generates after expenses — the real money available to investors.' },
  { term: 'Index Funds', short: 'Low-cost funds that track an entire market — hard to beat over 20+ years.' },
  { term: 'Emergency Fund', short: '3-6 months of expenses in cash — prevents you from selling investments at the worst time.' },
  { term: 'Intrinsic Value', short: 'What a business is actually worth based on future cash flows, not market mood.' },
  { term: 'Risk Tolerance', short: 'How much portfolio volatility you can handle without panic-selling.' },
];

// GET /api/digest — weekly summary for dashboard
router.get('/', (req, res) => {
  try {
    const userId = req.userId;
    const currentMonth = new Date().toISOString().slice(0, 7);

    // Portfolio holdings count
    const portfolios = db.prepare('SELECT id FROM portfolios WHERE user_id = ?').all(userId);
    let holdingsCount = 0;
    for (const p of portfolios) {
      const count = db.prepare('SELECT COUNT(*) as cnt FROM portfolio_positions WHERE portfolio_id = ?').get(p.id);
      holdingsCount += count?.cnt || 0;
    }

    // Budget status
    const budgetGoals = db.prepare('SELECT * FROM budget_goals WHERE user_id = ?').all(userId);
    const transactions = db.prepare(
      "SELECT * FROM transactions WHERE user_id = ? AND month = ?"
    ).all(userId, currentMonth);

    const totalBudget = budgetGoals.reduce((sum, g) => sum + g.monthly_limit, 0);
    const totalSpent = transactions
      .filter(t => t.amount < 0)
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);
    const budgetStatus = totalBudget > 0 ? (totalSpent <= totalBudget ? 'on_track' : 'over_budget') : 'no_budget';
    const budgetPct = totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0;

    // Plan progress
    const plan = db.prepare('SELECT * FROM plans WHERE user_id = ? ORDER BY created_at DESC LIMIT 1').get(userId);

    // Weekly learning concept (rotate by week number)
    const weekNum = Math.floor(Date.now() / (1000 * 60 * 60 * 24 * 7));
    const weeklyConcept = WEEKLY_CONCEPTS[weekNum % WEEKLY_CONCEPTS.length];

    res.json({
      success: true,
      data: {
        generatedAt: new Date().toISOString(),
        portfolioHoldingsCount: holdingsCount,
        budgetStatus,
        budgetPct,
        totalSpent,
        totalBudget,
        plan: plan ? {
          goalAmount: plan.goal_amount,
          targetAge: plan.target_age,
          monthlyInvestment: plan.monthly_investment,
        } : null,
        weeklyConcept,
      }
    });
  } catch (err) {
    sendError(res, err);
  }
});

module.exports = router;
