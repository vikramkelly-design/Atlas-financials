const db = require('../db');

async function buildUserContext(userId) {
  const parts = [];

  // Health score
  const score = await db.get(
    'SELECT * FROM health_scores WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1',
    [userId]
  );
  if (score) {
    parts.push(`Financial Health Score: ${score.score}/100 (Spending: ${score.spending_score}/20, Savings: ${score.savings_score}/20, Portfolio: ${score.portfolio_score}/20, Debt: ${score.debt_score}/20, Goals: ${score.goals_score}/20)`);
  }

  // Current month spending
  const now = new Date();
  const curMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const txns = await db.all('SELECT * FROM transactions WHERE user_id = $1 AND month = $2', [userId, curMonth]);
  if (txns.length > 0) {
    const totalSpent = txns.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);
    const totalIncome = txns.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0);
    const byCategory = {};
    txns.filter(t => t.amount < 0).forEach(t => {
      const cat = t.category || 'Other';
      byCategory[cat] = (byCategory[cat] || 0) + Math.abs(t.amount);
    });
    const catBreakdown = Object.entries(byCategory)
      .sort((a, b) => b[1] - a[1])
      .map(([cat, amt]) => `${cat}: $${amt.toFixed(0)}`)
      .join(', ');
    parts.push(`This month: $${totalSpent.toFixed(0)} spent, $${totalIncome.toFixed(0)} income. Categories: ${catBreakdown}`);
  }

  // Budget goals
  const budgetGoals = await db.all('SELECT * FROM budget_goals WHERE user_id = $1', [userId]);
  if (budgetGoals.length > 0) {
    const goals = budgetGoals.map(g => `${g.category}: $${g.monthly_limit}/mo`).join(', ');
    parts.push(`Budget limits: ${goals}`);

    // Check which are over
    if (txns.length > 0) {
      const byCategory = {};
      txns.filter(t => t.amount < 0).forEach(t => {
        const cat = t.category || 'Other';
        byCategory[cat] = (byCategory[cat] || 0) + Math.abs(t.amount);
      });
      const overBudget = budgetGoals
        .filter(g => (byCategory[g.category] || 0) > g.monthly_limit)
        .map(g => `${g.category} ($${(byCategory[g.category] || 0).toFixed(0)} vs $${g.monthly_limit} limit)`);
      if (overBudget.length > 0) {
        parts.push(`Over budget: ${overBudget.join(', ')}`);
      }
    }
  }

  // Portfolio
  const positions = await db.all(`
    SELECT pp.ticker, pp.shares, pp.avg_cost FROM portfolio_positions pp
    JOIN portfolios p ON pp.portfolio_id = p.id
    WHERE p.user_id = $1
  `, [userId]);
  if (positions.length > 0) {
    const holdings = positions.map(p => `${p.ticker} (${p.shares} shares @ $${parseFloat(p.avg_cost).toFixed(2)})`).join(', ');
    const totalCost = positions.reduce((s, p) => s + parseFloat(p.avg_cost) * p.shares, 0);
    parts.push(`Portfolio (${positions.length} holdings, $${totalCost.toFixed(0)} cost basis): ${holdings}`);
  }

  // Debts
  const debts = await db.all('SELECT * FROM debts WHERE user_id = $1', [userId]);
  if (debts.length > 0) {
    const debtList = debts.map(d => `${d.name}: $${parseFloat(d.balance).toFixed(0)} at ${d.interest_rate}% APR`).join(', ');
    const totalDebt = debts.reduce((s, d) => s + parseFloat(d.balance), 0);
    parts.push(`Debts ($${totalDebt.toFixed(0)} total): ${debtList}`);
  }

  // Goals
  const goals = await db.all('SELECT * FROM atlas_goals WHERE user_id = $1 AND status = $2', [userId, 'active']);
  if (goals.length > 0) {
    const goalList = goals.map(g => {
      const pct = g.target_amount > 0 ? Math.round((g.current_amount / g.target_amount) * 100) : 0;
      return `${g.name}: $${parseFloat(g.current_amount).toFixed(0)}/$${parseFloat(g.target_amount).toFixed(0)} (${pct}%)`;
    }).join(', ');
    parts.push(`Active goals: ${goalList}`);
  }

  // Net worth
  const assets = await db.get('SELECT COALESCE(SUM(value), 0) as total FROM net_worth_assets WHERE user_id = $1', [userId]);
  const liabilities = await db.get('SELECT COALESCE(SUM(value), 0) as total FROM net_worth_liabilities WHERE user_id = $1', [userId]);
  const assetsTotal = parseFloat(assets.total);
  const liabilitiesTotal = parseFloat(liabilities.total);
  if (assetsTotal > 0 || liabilitiesTotal > 0) {
    parts.push(`Net worth: $${(assetsTotal - liabilitiesTotal).toFixed(0)} (assets: $${assetsTotal.toFixed(0)}, liabilities: $${liabilitiesTotal.toFixed(0)})`);
  }

  if (parts.length === 0) {
    return 'This user has not added any financial data yet.';
  }

  return parts.join('\n');
}

module.exports = { buildUserContext };
