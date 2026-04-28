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

    // Dry powder = invest allocation + unspent budget - stock purchases from savings this month
    const now = new Date();
    const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const monthStart = `${monthKey}-01`;
    const nextMonth = now.getMonth() === 11
      ? `${now.getFullYear() + 1}-01-01`
      : `${now.getFullYear()}-${String(now.getMonth() + 2).padStart(2, '0')}-01`;

    const txns = db.prepare(
      'SELECT COALESCE(SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END), 0) as spent FROM transactions WHERE user_id = ? AND month = ?'
    ).get(req.userId, monthKey);
    const unspent = Math.max(0, spendAmt - (txns?.spent || 0));

    // Sum stock purchases made from savings/investing money this month
    const investSpent = db.prepare(`
      SELECT COALESCE(SUM(pt.total), 0) as total
      FROM portfolio_transactions pt
      JOIN portfolios p ON p.id = pt.portfolio_id
      WHERE p.user_id = ? AND pt.source = 'savings' AND pt.type = 'buy'
        AND pt.created_at >= ? AND pt.created_at < ?
    `).get(req.userId, monthStart, nextMonth);

    const dryPowder = Math.max(0, Math.round((investAmt + unspent - (investSpent?.total || 0)) * 100) / 100);

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
        free_cash: dryPowder,
        invest_spent: Math.round((investSpent?.total || 0) * 100) / 100,
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
// GET /api/savings/deposited?month=YYYY-MM — check if savings already logged this month
router.get('/deposited', (req, res) => {
  try {
    const month = req.query.month;
    if (!month) return res.status(400).json({ success: false, error: 'month query param required' });
    const row = db.prepare(
      "SELECT id FROM savings_transactions WHERE user_id = ? AND type = 'deposit' AND note LIKE ?"
    ).get(req.userId, `${month}%`);
    res.json({ success: true, data: { deposited: !!row } });
  } catch (err) {
    sendError(res, err);
  }
});

router.post('/deposit', (req, res) => {
  try {
    const amount = parseFloat(req.body.amount);
    if (!amount || amount <= 0) return res.status(400).json({ success: false, error: 'Amount must be positive' });

    // Block duplicate monthly deposits
    const note = req.body.note || 'Monthly savings deposit';
    const monthMatch = note.match(/^(\d{4}-\d{2})/);
    if (monthMatch) {
      const existing = db.prepare(
        "SELECT id FROM savings_transactions WHERE user_id = ? AND type = 'deposit' AND note LIKE ?"
      ).get(req.userId, `${monthMatch[1]}%`);
      if (existing) {
        return res.status(409).json({ success: false, error: 'Savings already logged for this month' });
      }
    }

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

// POST /api/savings/pay-debt — transfer savings to pay off a debt
router.post('/pay-debt', (req, res) => {
  try {
    const { debt_id, amount } = req.body;
    const amt = parseFloat(amount);
    if (!debt_id) return res.status(400).json({ success: false, error: 'debt_id required' });
    if (!amt || amt <= 0) return res.status(400).json({ success: false, error: 'Amount must be positive' });

    const user = db.prepare('SELECT savings_balance FROM users WHERE id = ?').get(req.userId);
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });
    if (user.savings_balance < amt) {
      return res.status(400).json({ success: false, error: 'Insufficient savings balance' });
    }

    const debt = db.prepare('SELECT * FROM debts WHERE id = ? AND user_id = ?').get(debt_id, req.userId);
    if (!debt) return res.status(404).json({ success: false, error: 'Debt not found' });

    const payAmount = Math.min(amt, debt.balance);

    db.prepare('UPDATE users SET savings_balance = savings_balance - ? WHERE id = ?').run(payAmount, req.userId);
    db.prepare('UPDATE debts SET balance = MAX(0, balance - ?) WHERE id = ?').run(payAmount, debt_id);
    db.prepare('INSERT INTO savings_transactions (user_id, amount, type, note) VALUES (?, ?, ?, ?)')
      .run(req.userId, -payAmount, 'debt_payment', `Paid ${payAmount.toFixed(2)} toward ${debt.name}`);

    const updatedDebt = db.prepare('SELECT * FROM debts WHERE id = ?').get(debt_id);
    const updatedUser = db.prepare('SELECT savings_balance FROM users WHERE id = ?').get(req.userId);

    res.json({
      success: true,
      data: {
        new_savings_balance: updatedUser.savings_balance,
        debt: updatedDebt,
      }
    });
  } catch (err) {
    sendError(res, err);
  }
});

// ── Savings Buckets ──────────────────────────────────────────

// GET /api/savings/buckets — list all savings buckets
router.get('/buckets', (req, res) => {
  try {
    const buckets = db.prepare('SELECT * FROM savings_buckets WHERE user_id = ? ORDER BY sort_order, id').all(req.userId);
    res.json({ success: true, data: buckets });
  } catch (err) {
    sendError(res, err);
  }
});

// POST /api/savings/buckets — create a new bucket
router.post('/buckets', (req, res) => {
  try {
    const { name, target_amount } = req.body;
    if (!name) return res.status(400).json({ success: false, error: 'Name required' });

    // Check if user has debts — must pay debts first
    const debts = db.prepare('SELECT SUM(balance) as total FROM debts WHERE user_id = ? AND balance > 0').get(req.userId);
    if (debts?.total > 0) {
      return res.status(400).json({ success: false, error: 'Pay off all debts before creating savings buckets' });
    }

    const target = parseFloat(target_amount) || 0;
    const result = db.prepare('INSERT INTO savings_buckets (user_id, name, target_amount) VALUES (?, ?, ?)')
      .run(req.userId, name.trim(), target);
    const bucket = db.prepare('SELECT * FROM savings_buckets WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json({ success: true, data: bucket });
  } catch (err) {
    sendError(res, err);
  }
});

// POST /api/savings/buckets/:id/deposit — add money to a bucket
router.post('/buckets/:id/deposit', (req, res) => {
  try {
    const bucket = db.prepare('SELECT * FROM savings_buckets WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
    if (!bucket) return res.status(404).json({ success: false, error: 'Bucket not found' });

    const amt = parseFloat(req.body.amount);
    if (!amt || amt <= 0) return res.status(400).json({ success: false, error: 'Amount must be positive' });

    // Check debts — must be debt-free for non-emergency buckets
    if (bucket.name !== 'Emergency Fund') {
      const debts = db.prepare('SELECT SUM(balance) as total FROM debts WHERE user_id = ? AND balance > 0').get(req.userId);
      if (debts?.total > 0) {
        return res.status(400).json({ success: false, error: 'Pay off all debts before funding this bucket' });
      }
    }

    // Check savings balance
    const user = db.prepare('SELECT savings_balance FROM users WHERE id = ?').get(req.userId);
    if (user.savings_balance < amt) {
      return res.status(400).json({ success: false, error: `Insufficient savings balance (${user.savings_balance.toFixed(2)} available). Log your monthly savings first.` });
    }

    db.prepare('UPDATE savings_buckets SET current_amount = current_amount + ? WHERE id = ?').run(amt, bucket.id);
    db.prepare('UPDATE users SET savings_balance = savings_balance - ? WHERE id = ?').run(amt, req.userId);
    db.prepare('INSERT INTO savings_transactions (user_id, amount, type, note) VALUES (?, ?, ?, ?)')
      .run(req.userId, -amt, 'bucket_deposit', `Moved to bucket: ${bucket.name}`);

    const updated = db.prepare('SELECT * FROM savings_buckets WHERE id = ?').get(bucket.id);
    res.json({ success: true, data: updated });
  } catch (err) {
    sendError(res, err);
  }
});

// DELETE /api/savings/buckets/:id — delete a bucket (returns money to savings)
router.delete('/buckets/:id', (req, res) => {
  try {
    const bucket = db.prepare('SELECT * FROM savings_buckets WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
    if (!bucket) return res.status(404).json({ success: false, error: 'Bucket not found' });

    if (bucket.current_amount > 0) {
      db.prepare('UPDATE users SET savings_balance = savings_balance + ? WHERE id = ?').run(bucket.current_amount, req.userId);
      db.prepare('INSERT INTO savings_transactions (user_id, amount, type, note) VALUES (?, ?, ?, ?)')
        .run(req.userId, bucket.current_amount, 'bucket_return', `Returned from deleted bucket: ${bucket.name}`);
    }

    db.prepare('DELETE FROM savings_buckets WHERE id = ?').run(bucket.id);
    res.json({ success: true });
  } catch (err) {
    sendError(res, err);
  }
});

module.exports = router;
