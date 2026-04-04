const express = require('express');
const router = express.Router();
const db = require('../db');
const { sendError } = require('../utils/errors');

// GET /api/savings — full savings overview
router.get('/', (req, res) => {
  try {
    const user = db.prepare(`
      SELECT monthly_income, savings_balance, savings_goal_name, savings_goal_target,
             savings_pct, spend_pct, invest_pct, emergency_fund_complete
      FROM users WHERE id = ?
    `).get(req.userId);
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });

    const income = user.monthly_income || 0;
    const spendAmt = Math.round(income * (user.spend_pct / 100) * 100) / 100;
    const savingsAmt = Math.round(income * (user.savings_pct / 100) * 100) / 100;
    const investAmt = Math.round(income * (user.invest_pct / 100) * 100) / 100;

    // Emergency fund target = 3x monthly spending
    const efTarget = user.savings_goal_name === 'Emergency Fund'
      ? Math.round(spendAmt * 3 * 100) / 100
      : (user.savings_goal_target || 0);
    const efPct = efTarget > 0 ? Math.min(100, Math.round((user.savings_balance / efTarget) * 10000) / 100) : 0;

    // Dry powder = invest allocation + unspent budget rollover this month
    const now = new Date();
    const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const txns = db.prepare(
      'SELECT COALESCE(SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END), 0) as spent FROM transactions WHERE user_id = ? AND month = ?'
    ).get(req.userId, monthKey);
    const unspent = Math.max(0, spendAmt - (txns?.spent || 0));
    const dryPowder = Math.round((investAmt + unspent) * 100) / 100;

    res.json({
      success: true,
      data: {
        monthly_income: income,
        savings_balance: user.savings_balance,
        savings_goal_name: user.savings_goal_name,
        savings_goal_target: efTarget,
        spend_pct: user.spend_pct,
        savings_pct: user.savings_pct,
        invest_pct: user.invest_pct,
        spend_amt: spendAmt,
        savings_amt: savingsAmt,
        invest_amt: investAmt,
        dry_powder: dryPowder,
        ef_balance: user.savings_balance,
        ef_target: efTarget,
        ef_pct: efPct,
        emergency_fund_complete: !!user.emergency_fund_complete,
      }
    });
  } catch (err) {
    sendError(res, err);
  }
});

// POST /api/savings/setup — set income + allocation percentages + savings goal
router.post('/setup', (req, res) => {
  try {
    const { monthly_income, spend_pct, savings_pct, invest_pct, savings_goal_name, savings_goal_target } = req.body;
    const sp = parseInt(spend_pct) || 0;
    const sa = parseInt(savings_pct) || 0;
    const inv = parseInt(invest_pct) || 0;
    if (sp + sa + inv !== 100) {
      return res.status(400).json({ success: false, error: 'Percentages must add up to 100' });
    }
    const income = parseFloat(monthly_income) || 0;
    if (income <= 0) {
      return res.status(400).json({ success: false, error: 'Income must be positive' });
    }

    const goalName = savings_goal_name || 'Emergency Fund';
    let goalTarget = parseFloat(savings_goal_target) || 0;
    // Auto-calc emergency fund target
    if (goalName === 'Emergency Fund') {
      goalTarget = Math.round(income * (sp / 100) * 3 * 100) / 100;
    }

    db.prepare(`
      UPDATE users SET monthly_income = ?, spend_pct = ?, savings_pct = ?, invest_pct = ?,
                       savings_goal_name = ?, savings_goal_target = ?
      WHERE id = ?
    `).run(income, sp, sa, inv, goalName, goalTarget, req.userId);

    res.json({ success: true, data: { monthly_income: income, spend_pct: sp, savings_pct: sa, invest_pct: inv, savings_goal_name: goalName, savings_goal_target: goalTarget } });
  } catch (err) {
    sendError(res, err);
  }
});

// POST /api/savings/deposit — add savings deposit
router.post('/deposit', (req, res) => {
  try {
    const amount = parseFloat(req.body.amount);
    if (!amount || amount <= 0) return res.status(400).json({ success: false, error: 'Amount must be positive' });

    db.prepare('UPDATE users SET savings_balance = savings_balance + ? WHERE id = ?').run(amount, req.userId);

    // Log the transaction
    db.prepare('INSERT INTO savings_transactions (user_id, amount, type, note) VALUES (?, ?, ?, ?)')
      .run(req.userId, amount, 'deposit', req.body.note || 'Monthly savings deposit');

    // Check if goal is met
    const user = db.prepare('SELECT savings_balance, savings_goal_target, savings_goal_name FROM users WHERE id = ?').get(req.userId);
    let goalComplete = false;
    if (user.savings_balance >= user.savings_goal_target && user.savings_goal_target > 0) {
      if (user.savings_goal_name === 'Emergency Fund') {
        db.prepare('UPDATE users SET emergency_fund_complete = 1 WHERE id = ?').run(req.userId);
      }
      goalComplete = true;
    }

    res.json({ success: true, data: { new_balance: user.savings_balance, goal_complete: goalComplete } });
  } catch (err) {
    sendError(res, err);
  }
});

// POST /api/savings/graduate — move savings % to invest %
router.post('/graduate', (req, res) => {
  try {
    const user = db.prepare('SELECT savings_pct, invest_pct FROM users WHERE id = ?').get(req.userId);
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });

    const newInvest = user.invest_pct + user.savings_pct;
    db.prepare('UPDATE users SET invest_pct = ?, savings_pct = 0 WHERE id = ?').run(newInvest, req.userId);

    // Log the graduation
    db.prepare('INSERT INTO savings_transactions (user_id, amount, type, note) VALUES (?, ?, ?, ?)')
      .run(req.userId, 0, 'graduated', 'Emergency fund complete — savings allocation moved to investing');

    res.json({ success: true, data: { invest_pct: newInvest } });
  } catch (err) {
    sendError(res, err);
  }
});

// GET /api/savings/income-log?month=YYYY-MM — check if income confirmed for month
router.get('/income-log', (req, res) => {
  try {
    const month = req.query.month;
    if (!month) return res.status(400).json({ success: false, error: 'Month required' });
    const row = db.prepare('SELECT * FROM monthly_income_log WHERE user_id = ? AND month = ? LIMIT 1').get(req.userId, month);
    // Also get last month's income for pre-fill
    const parts = month.split('-');
    let prevMonth;
    if (parseInt(parts[1]) === 1) {
      prevMonth = `${parseInt(parts[0]) - 1}-12`;
    } else {
      prevMonth = `${parts[0]}-${String(parseInt(parts[1]) - 1).padStart(2, '0')}`;
    }
    const prev = db.prepare('SELECT income FROM monthly_income_log WHERE user_id = ? AND month = ? LIMIT 1').get(req.userId, prevMonth);
    const user = db.prepare('SELECT monthly_income FROM users WHERE id = ?').get(req.userId);

    res.json({
      success: true,
      data: {
        confirmed: !!row,
        income: row?.income || null,
        last_month_income: prev?.income || user?.monthly_income || 0,
      }
    });
  } catch (err) {
    sendError(res, err);
  }
});

// POST /api/savings/income-log — confirm income for a month
router.post('/income-log', (req, res) => {
  try {
    const { month, income } = req.body;
    if (!month) return res.status(400).json({ success: false, error: 'Month required' });
    const amt = parseFloat(income);
    if (!amt || amt <= 0) return res.status(400).json({ success: false, error: 'Income must be positive' });

    // Upsert
    const existing = db.prepare('SELECT id FROM monthly_income_log WHERE user_id = ? AND month = ?').get(req.userId, month);
    if (existing) {
      db.prepare('UPDATE monthly_income_log SET income = ? WHERE id = ?').run(amt, existing.id);
    } else {
      db.prepare('INSERT INTO monthly_income_log (user_id, month, income) VALUES (?, ?, ?)').run(req.userId, month, amt);
    }

    // Also update user's monthly_income for reference
    db.prepare('UPDATE users SET monthly_income = ? WHERE id = ?').run(amt, req.userId);

    res.json({ success: true, data: { month, income: amt } });
  } catch (err) {
    sendError(res, err);
  }
});

module.exports = router;
