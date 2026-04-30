const express = require('express');
const router = express.Router();
const db = require('../db');
const { sendError } = require('../utils/errors');

const BADGE_DEFS = [
  { key: 'first_import', name: 'Data Pioneer', description: 'Imported your first financial statement', icon: 'upload' },
  { key: 'first_stock', name: 'Market Entry', description: 'Acquired your first equity position', icon: 'trending-up' },
  { key: 'emergency_fund', name: 'Risk Managed', description: 'Established an emergency fund', icon: 'shield' },
  { key: 'debt_free', name: 'Clean Slate', description: 'Eliminated all outstanding debt', icon: 'check-circle' },
  { key: 'first_goal', name: 'Strategic Planner', description: 'Set your first financial objective', icon: 'target' },
  { key: 'score_check', name: 'Self Assessed', description: 'Reviewed your financial health score', icon: 'activity' },
  { key: 'net_worth', name: 'Balance Sheet', description: 'Tracked your first asset', icon: 'dollar' },
  { key: 'budget_master', name: 'Disciplined', description: 'Stayed under budget for a full month', icon: 'award' },
  { key: 'five_holdings', name: 'Diversified Portfolio', description: 'Achieved 5-stock diversification', icon: 'layers' },
  { key: 'milestone_done', name: 'Objective Complete', description: 'Completed a financial milestone', icon: 'flag' },
];

async function evaluateBadges(userId) {
  const earned = await db.all('SELECT badge_key FROM user_badges WHERE user_id = $1', [userId]);
  const earnedKeys = new Set(earned.map(b => b.badge_key));
  const newBadges = [];

  for (const badge of BADGE_DEFS) {
    if (earnedKeys.has(badge.key)) continue;
    let qualifies = false;

    switch (badge.key) {
      case 'first_import': { const row = await db.get('SELECT id FROM transactions WHERE user_id = $1 LIMIT 1', [userId]); qualifies = !!row; break; }
      case 'first_stock': { const row = await db.get('SELECT pp.id FROM portfolio_positions pp JOIN portfolios p ON pp.portfolio_id = p.id WHERE p.user_id = $1 LIMIT 1', [userId]); qualifies = !!row; break; }
      case 'emergency_fund': {
        const row = await db.get("SELECT id FROM atlas_ultimate_goals WHERE user_id = $1 AND LOWER(name) LIKE '%emergency%' LIMIT 1", [userId]);
        if (!row) { const row2 = await db.get("SELECT id FROM atlas_goals WHERE user_id = $1 AND LOWER(name) LIKE '%emergency%' LIMIT 1", [userId]); qualifies = !!row2; }
        else qualifies = true;
        break;
      }
      case 'debt_free': {
        const debts = await db.all('SELECT id FROM debts WHERE user_id = $1', [userId]);
        const hadDebt = await db.get('SELECT id FROM onboarding_answers WHERE user_id = $1 AND total_debt > 0 LIMIT 1', [userId]);
        qualifies = debts.length === 0 && !!hadDebt;
        break;
      }
      case 'first_goal': {
        const row = await db.get('SELECT id FROM atlas_goals WHERE user_id = $1 LIMIT 1', [userId]);
        if (!row) { const row2 = await db.get('SELECT id FROM atlas_ultimate_goals WHERE user_id = $1 LIMIT 1', [userId]); qualifies = !!row2; }
        else qualifies = true;
        break;
      }
      case 'score_check': { const row = await db.get('SELECT id FROM health_scores WHERE user_id = $1 LIMIT 1', [userId]); qualifies = !!row; break; }
      case 'net_worth': { const row = await db.get('SELECT id FROM net_worth_assets WHERE user_id = $1 LIMIT 1', [userId]); qualifies = !!row; break; }
      case 'budget_master': {
        const now = new Date();
        const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const prevMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;
        const goals = await db.all('SELECT * FROM budget_goals WHERE user_id = $1', [userId]);
        if (goals.length > 0) {
          const txns = await db.all('SELECT * FROM transactions WHERE user_id = $1 AND month = $2', [userId, prevMonth]);
          const byCategory = {};
          txns.filter(t => t.amount < 0).forEach(t => { const cat = t.category || 'Other'; byCategory[cat] = (byCategory[cat] || 0) + Math.abs(t.amount); });
          qualifies = goals.every(g => (byCategory[g.category] || 0) <= g.monthly_limit);
        }
        break;
      }
      case 'five_holdings': {
        const count = await db.get('SELECT COUNT(DISTINCT pp.ticker) as cnt FROM portfolio_positions pp JOIN portfolios p ON pp.portfolio_id = p.id WHERE p.user_id = $1', [userId]);
        qualifies = count && parseInt(count.cnt) >= 5;
        break;
      }
      case 'milestone_done': { const row = await db.get("SELECT id FROM atlas_goals WHERE user_id = $1 AND status = 'completed' LIMIT 1", [userId]); qualifies = !!row; break; }
    }

    if (qualifies) {
      try {
        await db.run('INSERT INTO user_badges (user_id, badge_key) VALUES ($1, $2)', [userId, badge.key]);
        newBadges.push(badge);
      } catch { /* unique constraint */ }
    }
  }
  return newBadges;
}

router.get('/', async (req, res) => {
  try {
    const earned = await db.all('SELECT badge_key, earned_at FROM user_badges WHERE user_id = $1', [req.userId]);
    const earnedMap = {};
    for (const b of earned) earnedMap[b.badge_key] = b.earned_at;
    const badges = BADGE_DEFS.map(b => ({ ...b, earned: !!earnedMap[b.key], earned_at: earnedMap[b.key] || null }));
    res.json({ success: true, data: badges });
  } catch (err) { sendError(res, err); }
});

router.post('/check', async (req, res) => {
  try {
    const newBadges = await evaluateBadges(req.userId);
    res.json({ success: true, data: { newBadges } });
  } catch (err) { sendError(res, err); }
});

module.exports = router;
