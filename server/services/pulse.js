const db = require('../db');
const { callAI } = require('./claude');

function getWeekStart() {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Monday
  const monday = new Date(now.getFullYear(), now.getMonth(), diff);
  return monday.toISOString().split('T')[0];
}

async function generatePulse(userId) {
  const weekStart = getWeekStart();

  // Check if we already have one for this week
  const existing = db.prepare(
    'SELECT * FROM weekly_pulses WHERE user_id = ? AND week_start = ?'
  ).get(userId, weekStart);
  if (existing) return existing;

  // Get this week's spending
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);
  const weekEndStr = weekEnd.toISOString().split('T')[0];

  const txns = db.prepare(
    'SELECT * FROM transactions WHERE user_id = ? AND date >= ? AND date < ?'
  ).all(userId, weekStart, weekEndStr);
  const spendingTotal = txns.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);

  // Score change: compare latest score to the one before it
  const scores = db.prepare(
    'SELECT score FROM health_scores WHERE user_id = ? ORDER BY created_at DESC LIMIT 2'
  ).all(userId);
  const scoreChange = scores.length >= 2 ? scores[0].score - scores[1].score : 0;

  // Portfolio change (compare cost basis to rough value — we don't have live prices server-side, so use avg_cost as baseline)
  const positions = db.prepare(`
    SELECT pp.* FROM portfolio_positions pp
    JOIN portfolios p ON pp.portfolio_id = p.id
    WHERE p.user_id = ?
  `).all(userId);
  const portfolioChangePct = 0; // Can't get live prices server-side without Yahoo calls

  // AI tip based on user's data
  let aiTip = '';
  try {
    const budgetGoals = db.prepare('SELECT * FROM budget_goals WHERE user_id = ?').all(userId);
    const debts = db.prepare('SELECT * FROM debts WHERE user_id = ?').all(userId);
    const activeGoals = db.prepare('SELECT * FROM atlas_goals WHERE user_id = ? AND status = ?').all(userId, 'active');

    const context = {
      weeklySpending: spendingTotal.toFixed(2),
      scoreChange,
      numPositions: positions.length,
      numDebts: debts.length,
      totalDebt: debts.reduce((s, d) => s + d.balance, 0).toFixed(2),
      numGoals: activeGoals.length,
      budgetCategories: budgetGoals.map(g => g.category).join(', '),
    };

    aiTip = await callAI(
      'Give one specific, actionable financial tip in 1 sentence. Use plain English, real numbers if available. No disclaimers.',
      `User data this week: ${JSON.stringify(context)}. Give one tip to improve their finances this week.`
    );
  } catch {
    aiTip = spendingTotal > 0
      ? `You spent $${spendingTotal.toFixed(0)} this week — review your biggest expense and see if it was necessary.`
      : 'Import your bank transactions to start tracking your spending habits.';
  }

  // Save pulse
  db.prepare(`
    INSERT INTO weekly_pulses (user_id, week_start, score_change, spending_total, portfolio_change_pct, ai_tip)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(userId, weekStart, scoreChange, spendingTotal, portfolioChangePct, aiTip);

  return db.prepare(
    'SELECT * FROM weekly_pulses WHERE user_id = ? AND week_start = ?'
  ).get(userId, weekStart);
}

module.exports = { generatePulse };
