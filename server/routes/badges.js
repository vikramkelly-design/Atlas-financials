const express = require('express');
const router = express.Router();
const db = require('../db');
const { sendError } = require('../utils/errors');

const BADGE_DEFS = [
  { key: 'first_import', name: 'First Import', description: 'Upload your first bank CSV', icon: 'upload' },
  { key: 'first_stock', name: 'First Stock', description: 'Buy your first stock', icon: 'trending-up' },
  { key: 'emergency_fund', name: 'Safety Net', description: 'Start an emergency fund goal', icon: 'shield' },
  { key: 'debt_free', name: 'Debt Free', description: 'Pay off all your debts', icon: 'check-circle' },
  { key: 'first_goal', name: 'Goal Setter', description: 'Set your first Atlas goal', icon: 'target' },
  { key: 'score_check', name: 'Self Aware', description: 'View your health score', icon: 'activity' },
  { key: 'net_worth', name: 'Net Worth Tracked', description: 'Add your first asset', icon: 'dollar' },
  { key: 'budget_master', name: 'Budget Master', description: 'Stay under budget for a month', icon: 'award' },
  { key: 'five_holdings', name: 'Diversified', description: 'Own 5 different stocks', icon: 'layers' },
  { key: 'milestone_done', name: 'Milestone', description: 'Complete an Atlas milestone', icon: 'flag' },
];

function evaluateBadges(userId) {
  const earned = db.prepare('SELECT badge_key FROM user_badges WHERE user_id = ?').all(userId);
  const earnedKeys = new Set(earned.map(b => b.badge_key));
  const newBadges = [];

  for (const badge of BADGE_DEFS) {
    if (earnedKeys.has(badge.key)) continue;

    let qualifies = false;

    switch (badge.key) {
      case 'first_import': {
        const row = db.prepare('SELECT id FROM transactions WHERE user_id = ? LIMIT 1').get(userId);
        qualifies = !!row;
        break;
      }
      case 'first_stock': {
        const row = db.prepare(`
          SELECT pp.id FROM portfolio_positions pp
          JOIN portfolios p ON pp.portfolio_id = p.id
          WHERE p.user_id = ? LIMIT 1
        `).get(userId);
        qualifies = !!row;
        break;
      }
      case 'emergency_fund': {
        const row = db.prepare(`
          SELECT id FROM atlas_ultimate_goals
          WHERE user_id = ? AND LOWER(name) LIKE '%emergency%' LIMIT 1
        `).get(userId);
        if (!row) {
          const row2 = db.prepare(`
            SELECT id FROM atlas_goals
            WHERE user_id = ? AND LOWER(name) LIKE '%emergency%' LIMIT 1
          `).get(userId);
          qualifies = !!row2;
        } else {
          qualifies = true;
        }
        break;
      }
      case 'debt_free': {
        const debts = db.prepare('SELECT id FROM debts WHERE user_id = ?').all(userId);
        const hadDebt = db.prepare('SELECT id FROM onboarding_answers WHERE user_id = ? AND total_debt > 0 LIMIT 1').get(userId);
        qualifies = debts.length === 0 && !!hadDebt;
        break;
      }
      case 'first_goal': {
        const row = db.prepare('SELECT id FROM atlas_goals WHERE user_id = ? LIMIT 1').get(userId);
        if (!row) {
          const row2 = db.prepare('SELECT id FROM atlas_ultimate_goals WHERE user_id = ? LIMIT 1').get(userId);
          qualifies = !!row2;
        } else {
          qualifies = true;
        }
        break;
      }
      case 'score_check': {
        const row = db.prepare('SELECT id FROM health_scores WHERE user_id = ? LIMIT 1').get(userId);
        qualifies = !!row;
        break;
      }
      case 'net_worth': {
        const row = db.prepare('SELECT id FROM net_worth_assets WHERE user_id = ? LIMIT 1').get(userId);
        qualifies = !!row;
        break;
      }
      case 'budget_master': {
        const now = new Date();
        const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const prevMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;
        const goals = db.prepare('SELECT * FROM budget_goals WHERE user_id = ?').all(userId);
        if (goals.length > 0) {
          const txns = db.prepare('SELECT * FROM transactions WHERE user_id = ? AND month = ?').all(userId, prevMonth);
          const byCategory = {};
          txns.filter(t => t.amount < 0).forEach(t => {
            const cat = t.category || 'Other';
            byCategory[cat] = (byCategory[cat] || 0) + Math.abs(t.amount);
          });
          qualifies = goals.every(g => (byCategory[g.category] || 0) <= g.monthly_limit);
        }
        break;
      }
      case 'five_holdings': {
        const count = db.prepare(`
          SELECT COUNT(DISTINCT pp.ticker) as cnt FROM portfolio_positions pp
          JOIN portfolios p ON pp.portfolio_id = p.id
          WHERE p.user_id = ?
        `).get(userId);
        qualifies = count && count.cnt >= 5;
        break;
      }
      case 'milestone_done': {
        const row = db.prepare("SELECT id FROM atlas_goals WHERE user_id = ? AND status = 'completed' LIMIT 1").get(userId);
        qualifies = !!row;
        break;
      }
    }

    if (qualifies) {
      try {
        db.prepare('INSERT INTO user_badges (user_id, badge_key) VALUES (?, ?)').run(userId, badge.key);
        newBadges.push(badge);
      } catch {
        // unique constraint — already earned
      }
    }
  }

  return newBadges;
}

// GET /api/badges — all badges with earned status
router.get('/', (req, res) => {
  try {
    const earned = db.prepare('SELECT badge_key, earned_at FROM user_badges WHERE user_id = ?').all(req.userId);
    const earnedMap = {};
    for (const b of earned) earnedMap[b.badge_key] = b.earned_at;

    const badges = BADGE_DEFS.map(b => ({
      ...b,
      earned: !!earnedMap[b.key],
      earned_at: earnedMap[b.key] || null,
    }));

    res.json({ success: true, data: badges });
  } catch (err) {
    sendError(res, err);
  }
});

// POST /api/badges/check — evaluate and award new badges
router.post('/check', (req, res) => {
  try {
    const newBadges = evaluateBadges(req.userId);
    res.json({ success: true, data: { newBadges } });
  } catch (err) {
    sendError(res, err);
  }
});

module.exports = router;
