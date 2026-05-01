const express = require('express');
const router = express.Router();
const db = require('../db');
const { sendError } = require('../utils/errors');

// GET /api/savings — full savings overview
router.get('/', async (req, res) => {
  try {
    const user = await db.get(`
      SELECT monthly_income, savings_balance, savings_goal_name, savings_goal_target,
             savings_pct, spend_pct, invest_pct, emergency_fund_complete
      FROM users WHERE id = $1
    `, [req.userId]);
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });

    const income = parseFloat(user.monthly_income) || 0;
    const spendPct = parseInt(user.spend_pct) || 0;
    const savingsPct = parseInt(user.savings_pct) || 0;
    const investPct = parseInt(user.invest_pct) || 0;
    const spendAmt = Math.round(income * (spendPct / 100) * 100) / 100;
    const savingsAmt = Math.round(income * (savingsPct / 100) * 100) / 100;
    const investAmt = Math.round(income * (investPct / 100) * 100) / 100;

    const savingsBalance = parseFloat(user.savings_balance) || 0;
    const efTarget = user.savings_goal_name === 'Emergency Fund'
      ? Math.round(spendAmt * 3 * 100) / 100
      : (parseFloat(user.savings_goal_target) || 0);
    const efPct = efTarget > 0 ? Math.min(100, Math.round((savingsBalance / efTarget) * 10000) / 100) : 0;

    const now = new Date();
    const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const monthStart = `${monthKey}-01`;
    const nextMonth = now.getMonth() === 11
      ? `${now.getFullYear() + 1}-01-01`
      : `${now.getFullYear()}-${String(now.getMonth() + 2).padStart(2, '0')}-01`;

    const txns = await db.get(
      'SELECT COALESCE(SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END), 0) as spent FROM transactions WHERE user_id = $1 AND month = $2',
      [req.userId, monthKey]
    );
    const unspent = Math.max(0, spendAmt - (parseFloat(txns?.spent) || 0));

    const investSpent = await db.get(`
      SELECT COALESCE(SUM(pt.total), 0) as total
      FROM portfolio_transactions pt
      JOIN portfolios p ON p.id = pt.portfolio_id
      WHERE p.user_id = $1 AND pt.source = 'savings' AND pt.type = 'buy'
        AND pt.created_at >= $2 AND pt.created_at < $3
    `, [req.userId, monthStart, nextMonth]);

    const dryPowder = Math.max(0, Math.round((investAmt + unspent - (parseFloat(investSpent?.total) || 0)) * 100) / 100);

    res.json({
      success: true,
      data: {
        monthly_income: income, savings_balance: user.savings_balance,
        savings_goal_name: user.savings_goal_name, savings_goal_target: efTarget,
        spend_pct: spendPct, savings_pct: savingsPct, invest_pct: investPct,
        spend_amt: spendAmt, savings_amt: savingsAmt, invest_amt: investAmt,
        dry_powder: dryPowder, free_cash: dryPowder,
        invest_spent: Math.round((parseFloat(investSpent?.total) || 0) * 100) / 100,
        ef_balance: savingsBalance, ef_target: efTarget, ef_pct: efPct,
        emergency_fund_complete: !!user.emergency_fund_complete,
      }
    });
  } catch (err) {
    sendError(res, err);
  }
});

// POST /api/savings/setup
router.post('/setup', async (req, res) => {
  try {
    const { monthly_income, spend_pct, savings_pct, invest_pct, savings_goal_name, savings_goal_target } = req.body;
    const sp = parseInt(spend_pct) || 0;
    const sa = parseInt(savings_pct) || 0;
    const inv = parseInt(invest_pct) || 0;
    if (sp + sa + inv !== 100) return res.status(400).json({ success: false, error: 'Percentages must add up to 100' });
    const income = parseFloat(monthly_income) || 0;
    if (income <= 0) return res.status(400).json({ success: false, error: 'Income must be positive' });

    const goalName = savings_goal_name || 'Emergency Fund';
    let goalTarget = parseFloat(savings_goal_target) || 0;
    if (goalName === 'Emergency Fund') goalTarget = Math.round(income * (sp / 100) * 3 * 100) / 100;

    await db.run(`
      UPDATE users SET monthly_income = $1, spend_pct = $2, savings_pct = $3, invest_pct = $4,
                       savings_goal_name = $5, savings_goal_target = $6
      WHERE id = $7
    `, [income, sp, sa, inv, goalName, goalTarget, req.userId]);

    res.json({ success: true, data: { monthly_income: income, spend_pct: sp, savings_pct: sa, invest_pct: inv, savings_goal_name: goalName, savings_goal_target: goalTarget } });
  } catch (err) {
    sendError(res, err);
  }
});

// GET /api/savings/deposited?month=YYYY-MM
router.get('/deposited', async (req, res) => {
  try {
    const month = req.query.month;
    if (!month) return res.status(400).json({ success: false, error: 'month query param required' });
    const row = await db.get(
      "SELECT id FROM savings_transactions WHERE user_id = $1 AND type = 'deposit' AND note LIKE $2",
      [req.userId, `${month}%`]
    );
    res.json({ success: true, data: { deposited: !!row } });
  } catch (err) {
    sendError(res, err);
  }
});

// POST /api/savings/deposit
router.post('/deposit', async (req, res) => {
  try {
    const amount = parseFloat(req.body.amount);
    if (!amount || amount <= 0) return res.status(400).json({ success: false, error: 'Amount must be positive' });

    const note = req.body.note || 'Monthly savings deposit';
    const monthMatch = note.match(/^(\d{4}-\d{2})/);
    if (monthMatch) {
      const existing = await db.get(
        "SELECT id FROM savings_transactions WHERE user_id = $1 AND type = 'deposit' AND note LIKE $2",
        [req.userId, `${monthMatch[1]}%`]
      );
      if (existing) return res.status(409).json({ success: false, error: 'Savings already logged for this month' });
    }

    await db.run('UPDATE users SET savings_balance = savings_balance + $1 WHERE id = $2', [amount, req.userId]);
    await db.run('INSERT INTO savings_transactions (user_id, amount, type, note) VALUES ($1, $2, $3, $4)',
      [req.userId, amount, 'deposit', note]);

    const user = await db.get('SELECT savings_balance, savings_goal_target, savings_goal_name FROM users WHERE id = $1', [req.userId]);
    let goalComplete = false;
    if (user.savings_balance >= user.savings_goal_target && user.savings_goal_target > 0) {
      if (user.savings_goal_name === 'Emergency Fund') {
        await db.run('UPDATE users SET emergency_fund_complete = 1 WHERE id = $1', [req.userId]);
      }
      goalComplete = true;
    }

    res.json({ success: true, data: { new_balance: user.savings_balance, goal_complete: goalComplete } });
  } catch (err) {
    sendError(res, err);
  }
});

// POST /api/savings/graduate
router.post('/graduate', async (req, res) => {
  try {
    const user = await db.get('SELECT savings_pct, invest_pct FROM users WHERE id = $1', [req.userId]);
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });

    const newInvest = user.invest_pct + user.savings_pct;
    await db.run('UPDATE users SET invest_pct = $1, savings_pct = 0 WHERE id = $2', [newInvest, req.userId]);
    await db.run('INSERT INTO savings_transactions (user_id, amount, type, note) VALUES ($1, $2, $3, $4)',
      [req.userId, 0, 'graduated', 'Emergency fund complete — savings allocation moved to investing']);

    res.json({ success: true, data: { invest_pct: newInvest } });
  } catch (err) {
    sendError(res, err);
  }
});

// GET /api/savings/income-log?month=YYYY-MM
router.get('/income-log', async (req, res) => {
  try {
    const month = req.query.month;
    if (!month) return res.status(400).json({ success: false, error: 'Month required' });
    const row = await db.get('SELECT * FROM monthly_income_log WHERE user_id = $1 AND month = $2 LIMIT 1', [req.userId, month]);
    const parts = month.split('-');
    let prevMonth;
    if (parseInt(parts[1]) === 1) { prevMonth = `${parseInt(parts[0]) - 1}-12`; }
    else { prevMonth = `${parts[0]}-${String(parseInt(parts[1]) - 1).padStart(2, '0')}`; }
    const prev = await db.get('SELECT income FROM monthly_income_log WHERE user_id = $1 AND month = $2 LIMIT 1', [req.userId, prevMonth]);
    const user = await db.get('SELECT monthly_income FROM users WHERE id = $1', [req.userId]);

    res.json({ success: true, data: { confirmed: !!row, income: row?.income || null, last_month_income: prev?.income || user?.monthly_income || 0 } });
  } catch (err) {
    sendError(res, err);
  }
});

// POST /api/savings/income-log
router.post('/income-log', async (req, res) => {
  try {
    const { month, income } = req.body;
    if (!month) return res.status(400).json({ success: false, error: 'Month required' });
    const amt = parseFloat(income);
    if (!amt || amt <= 0) return res.status(400).json({ success: false, error: 'Income must be positive' });

    const existing = await db.get('SELECT id FROM monthly_income_log WHERE user_id = $1 AND month = $2', [req.userId, month]);
    if (existing) { await db.run('UPDATE monthly_income_log SET income = $1 WHERE id = $2', [amt, existing.id]); }
    else { await db.run('INSERT INTO monthly_income_log (user_id, month, income) VALUES ($1, $2, $3)', [req.userId, month, amt]); }
    await db.run('UPDATE users SET monthly_income = $1 WHERE id = $2', [amt, req.userId]);

    res.json({ success: true, data: { month, income: amt } });
  } catch (err) {
    sendError(res, err);
  }
});

// POST /api/savings/pay-debt
router.post('/pay-debt', async (req, res) => {
  try {
    const { debt_id, amount } = req.body;
    const amt = parseFloat(amount);
    if (!debt_id) return res.status(400).json({ success: false, error: 'debt_id required' });
    if (!amt || amt <= 0) return res.status(400).json({ success: false, error: 'Amount must be positive' });

    const user = await db.get('SELECT savings_balance FROM users WHERE id = $1', [req.userId]);
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });
    if (user.savings_balance < amt) return res.status(400).json({ success: false, error: 'Insufficient savings balance' });

    const debt = await db.get('SELECT * FROM debts WHERE id = $1 AND user_id = $2', [debt_id, req.userId]);
    if (!debt) return res.status(404).json({ success: false, error: 'Debt not found' });

    const payAmount = Math.min(amt, debt.balance);
    await db.run('UPDATE users SET savings_balance = savings_balance - $1 WHERE id = $2', [payAmount, req.userId]);
    await db.run('UPDATE debts SET balance = GREATEST(0, balance - $1) WHERE id = $2', [payAmount, debt_id]);
    await db.run('INSERT INTO savings_transactions (user_id, amount, type, note) VALUES ($1, $2, $3, $4)',
      [req.userId, -payAmount, 'debt_payment', `Paid ${payAmount.toFixed(2)} toward ${debt.name}`]);

    const updatedDebt = await db.get('SELECT * FROM debts WHERE id = $1', [debt_id]);
    const updatedUser = await db.get('SELECT savings_balance FROM users WHERE id = $1', [req.userId]);

    res.json({ success: true, data: { new_savings_balance: updatedUser.savings_balance, debt: updatedDebt } });
  } catch (err) {
    sendError(res, err);
  }
});

// ── Savings Buckets ──────────────────────────────────────────

// GET /api/savings/buckets
router.get('/buckets', async (req, res) => {
  try {
    const buckets = await db.all('SELECT * FROM savings_buckets WHERE user_id = $1 ORDER BY sort_order, id', [req.userId]);
    res.json({ success: true, data: buckets });
  } catch (err) {
    sendError(res, err);
  }
});

// POST /api/savings/buckets
router.post('/buckets', async (req, res) => {
  try {
    const { name, target_amount } = req.body;
    if (!name) return res.status(400).json({ success: false, error: 'Name required' });

    const debts = await db.get('SELECT SUM(balance) as total FROM debts WHERE user_id = $1 AND balance > 0', [req.userId]);
    if (debts?.total > 0) return res.status(400).json({ success: false, error: 'Pay off all debts before creating savings buckets' });

    const target = parseFloat(target_amount) || 0;
    const result = await db.get('INSERT INTO savings_buckets (user_id, name, target_amount) VALUES ($1, $2, $3) RETURNING id',
      [req.userId, name.trim(), target]);
    const bucket = await db.get('SELECT * FROM savings_buckets WHERE id = $1', [result.id]);
    res.status(201).json({ success: true, data: bucket });
  } catch (err) {
    sendError(res, err);
  }
});

// POST /api/savings/buckets/:id/deposit
router.post('/buckets/:id/deposit', async (req, res) => {
  try {
    const bucket = await db.get('SELECT * FROM savings_buckets WHERE id = $1 AND user_id = $2', [req.params.id, req.userId]);
    if (!bucket) return res.status(404).json({ success: false, error: 'Bucket not found' });

    const amt = parseFloat(req.body.amount);
    if (!amt || amt <= 0) return res.status(400).json({ success: false, error: 'Amount must be positive' });

    if (bucket.name !== 'Emergency Fund') {
      const debts = await db.get('SELECT SUM(balance) as total FROM debts WHERE user_id = $1 AND balance > 0', [req.userId]);
      if (debts?.total > 0) return res.status(400).json({ success: false, error: 'Pay off all debts before funding this bucket' });
    }

    const user = await db.get('SELECT savings_balance FROM users WHERE id = $1', [req.userId]);
    if (user.savings_balance < amt) {
      return res.status(400).json({ success: false, error: `Insufficient savings balance (${user.savings_balance.toFixed(2)} available). Log your monthly savings first.` });
    }

    await db.run('UPDATE savings_buckets SET current_amount = current_amount + $1 WHERE id = $2', [amt, bucket.id]);
    await db.run('UPDATE users SET savings_balance = savings_balance - $1 WHERE id = $2', [amt, req.userId]);
    await db.run('INSERT INTO savings_transactions (user_id, amount, type, note) VALUES ($1, $2, $3, $4)',
      [req.userId, -amt, 'bucket_deposit', `Moved to bucket: ${bucket.name}`]);

    const updated = await db.get('SELECT * FROM savings_buckets WHERE id = $1', [bucket.id]);
    res.json({ success: true, data: updated });
  } catch (err) {
    sendError(res, err);
  }
});

// DELETE /api/savings/buckets/:id
router.delete('/buckets/:id', async (req, res) => {
  try {
    const bucket = await db.get('SELECT * FROM savings_buckets WHERE id = $1 AND user_id = $2', [req.params.id, req.userId]);
    if (!bucket) return res.status(404).json({ success: false, error: 'Bucket not found' });

    if (bucket.current_amount > 0) {
      await db.run('UPDATE users SET savings_balance = savings_balance + $1 WHERE id = $2', [bucket.current_amount, req.userId]);
      await db.run('INSERT INTO savings_transactions (user_id, amount, type, note) VALUES ($1, $2, $3, $4)',
        [req.userId, bucket.current_amount, 'bucket_return', `Returned from deleted bucket: ${bucket.name}`]);
    }

    await db.run('DELETE FROM savings_buckets WHERE id = $1', [bucket.id]);
    res.json({ success: true });
  } catch (err) {
    sendError(res, err);
  }
});

module.exports = router;
