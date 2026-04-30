const express = require('express');
const router = express.Router();
const db = require('../db');
const { categorizeTransactions, generateBudgetSummary, generateSpendingAnalysis } = require('../services/claude');
const { sendError } = require('../utils/errors');

// POST /api/budget/import
router.post('/import', async (req, res) => {
  try {
    const { transactions } = req.body;
    if (!transactions || !Array.isArray(transactions) || transactions.length === 0) {
      return res.status(400).json({ success: false, error: 'No transactions provided' });
    }

    const categorized = await categorizeTransactions(transactions);

    for (const t of categorized) {
      const month = t.date ? t.date.substring(0, 7) : null;
      await db.run(
        'INSERT INTO transactions (user_id, date, description, amount, category, month) VALUES ($1, $2, $3, $4, $5, $6)',
        [req.userId, t.date, t.description, t.amount, t.category || 'Other', month]
      );
    }

    res.json({ success: true, data: { imported: categorized.length, transactions: categorized } });
  } catch (err) {
    sendError(res, err);
  }
});

// GET /api/budget/transactions
router.get('/transactions', async (req, res) => {
  try {
    const { month } = req.query;
    let rows;
    if (month) {
      rows = await db.all('SELECT * FROM transactions WHERE user_id = $1 AND month = $2 ORDER BY date DESC', [req.userId, month]);
    } else {
      rows = await db.all('SELECT * FROM transactions WHERE user_id = $1 ORDER BY date DESC', [req.userId]);
    }
    res.json({ success: true, data: rows });
  } catch (err) {
    sendError(res, err);
  }
});

// PATCH /api/budget/transaction/:id
router.patch('/transaction/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { category, notes } = req.body;
    const updates = [];
    const values = [];
    let paramIdx = 1;
    if (category) { updates.push(`category = $${paramIdx++}`); values.push(category); }
    if (notes !== undefined) { updates.push(`notes = $${paramIdx++}`); values.push(notes); }
    if (updates.length === 0) {
      return res.status(400).json({ success: false, error: 'No fields to update' });
    }
    values.push(id, req.userId);
    await db.run(`UPDATE transactions SET ${updates.join(', ')} WHERE id = $${paramIdx++} AND user_id = $${paramIdx}`, values);
    const updated = await db.get('SELECT * FROM transactions WHERE id = $1 AND user_id = $2', [id, req.userId]);
    res.json({ success: true, data: updated });
  } catch (err) {
    sendError(res, err);
  }
});

// GET /api/budget/summary/:month
router.get('/summary/:month', async (req, res) => {
  try {
    const { month } = req.params;
    const rows = await db.all('SELECT category, SUM(amount) as total FROM transactions WHERE user_id = $1 AND month = $2 AND amount < 0 GROUP BY category', [req.userId, month]);
    const totalSpent = await db.get('SELECT SUM(amount) as total FROM transactions WHERE user_id = $1 AND month = $2 AND amount < 0', [req.userId, month]);

    const spendingData = {
      totalSpent: totalSpent?.total || 0,
      byCategory: rows.reduce((acc, r) => { acc[r.category] = parseFloat(r.total); return acc; }, {})
    };

    const summary = await generateBudgetSummary(month, spendingData);
    res.json({ success: true, data: { summary, spending: spendingData } });
  } catch (err) {
    sendError(res, err);
  }
});

// POST /api/budget/goals
router.post('/goals', async (req, res) => {
  try {
    const { goals } = req.body;
    if (!goals || !Array.isArray(goals)) {
      return res.status(400).json({ success: false, error: 'Goals array required' });
    }
    for (const g of goals) {
      await db.run(
        `INSERT INTO budget_goals (user_id, category, monthly_limit) VALUES ($1, $2, $3)
         ON CONFLICT(user_id, category) DO UPDATE SET monthly_limit = EXCLUDED.monthly_limit`,
        [req.userId, g.category, g.monthly_limit]
      );
    }
    const all = await db.all('SELECT * FROM budget_goals WHERE user_id = $1', [req.userId]);
    res.json({ success: true, data: all });
  } catch (err) {
    sendError(res, err);
  }
});

// GET /api/budget/goals
router.get('/goals', async (req, res) => {
  try {
    const goals = await db.all('SELECT * FROM budget_goals WHERE user_id = $1', [req.userId]);
    res.json({ success: true, data: goals });
  } catch (err) {
    sendError(res, err);
  }
});

// POST /api/budget/transaction — add a single manual transaction
router.post('/transaction', async (req, res) => {
  try {
    const { date, description, amount, category } = req.body;
    if (!date || !description || amount === undefined) {
      return res.status(400).json({ success: false, error: 'Date, description, and amount are required' });
    }
    const month = date.substring(0, 7);
    const result = await db.get(
      'INSERT INTO transactions (user_id, date, description, amount, category, month) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
      [req.userId, date, description, parseFloat(amount), category || 'Other', month]
    );
    const row = await db.get('SELECT * FROM transactions WHERE id = $1', [result.id]);
    res.json({ success: true, data: row });
  } catch (err) {
    sendError(res, err);
  }
});

// DELETE /api/budget/transaction/:id
router.delete('/transaction/:id', async (req, res) => {
  try {
    await db.run('DELETE FROM transactions WHERE id = $1 AND user_id = $2', [req.params.id, req.userId]);
    res.json({ success: true });
  } catch (err) {
    sendError(res, err);
  }
});

// POST /api/budget/analyze
router.post('/analyze', async (req, res) => {
  try {
    const { transactions } = req.body;
    if (!transactions || !Array.isArray(transactions) || transactions.length === 0) {
      return res.status(400).json({ success: false, error: 'No transactions provided' });
    }
    const budgetGoals = await db.all('SELECT category, monthly_limit FROM budget_goals WHERE user_id = $1', [req.userId]);
    const goalsMap = {};
    budgetGoals.forEach(g => { goalsMap[g.category] = g.monthly_limit; });
    const analysis = await generateSpendingAnalysis(transactions, goalsMap);
    res.json({ success: true, data: { analysis } });
  } catch (err) {
    sendError(res, err);
  }
});

// GET /api/budget/overview?month=YYYY-MM — consolidated month view
router.get('/overview', async (req, res) => {
  try {
    const month = req.query.month;
    if (!month) return res.status(400).json({ success: false, error: 'month query param required' });

    const incomeLog = await db.get('SELECT income FROM monthly_income_log WHERE user_id = $1 AND month = $2 LIMIT 1', [req.userId, month]);
    const user = await db.get('SELECT monthly_income FROM users WHERE id = $1', [req.userId]);

    const parts = month.split('-');
    let prevMonth;
    if (parseInt(parts[1]) === 1) {
      prevMonth = `${parseInt(parts[0]) - 1}-12`;
    } else {
      prevMonth = `${parts[0]}-${String(parseInt(parts[1]) - 1).padStart(2, '0')}`;
    }
    const prevLog = await db.get('SELECT income FROM monthly_income_log WHERE user_id = $1 AND month = $2 LIMIT 1', [req.userId, prevMonth]);

    const income = incomeLog?.income || prevLog?.income || user?.monthly_income || 0;
    const incomeConfirmed = !!incomeLog;

    const transactions = await db.all('SELECT * FROM transactions WHERE user_id = $1 AND month = $2 ORDER BY date DESC', [req.userId, month]);
    const goalsRows = await db.all('SELECT category, monthly_limit FROM budget_goals WHERE user_id = $1', [req.userId]);
    const goals = {};
    goalsRows.forEach(g => { goals[g.category] = g.monthly_limit; });

    const spendingRows = await db.all(
      'SELECT category, SUM(amount) as total FROM transactions WHERE user_id = $1 AND month = $2 AND amount < 0 GROUP BY category',
      [req.userId, month]
    );
    const spendingByCategory = {};
    spendingRows.forEach(r => { spendingByCategory[r.category] = parseFloat(r.total); });

    const totalSpent = spendingRows.reduce((s, r) => s + parseFloat(r.total), 0);
    const remaining = income + totalSpent;

    const allocation = await db.get('SELECT spend_pct, savings_pct, invest_pct FROM monthly_allocation WHERE user_id = $1 AND month = $2', [req.userId, month]);

    res.json({
      success: true,
      data: {
        income,
        income_confirmed: incomeConfirmed,
        previous_income: prevLog?.income || user?.monthly_income || 0,
        transactions,
        goals,
        spending_by_category: spendingByCategory,
        total_spent: totalSpent,
        remaining,
        transaction_count: transactions.length,
        allocation: allocation || null,
        allocation_locked: !!allocation,
      }
    });
  } catch (err) {
    sendError(res, err);
  }
});

// POST /api/budget/confirm-income — confirm income for a month
router.post('/confirm-income', async (req, res) => {
  try {
    const { month, income } = req.body;
    if (!month) return res.status(400).json({ success: false, error: 'Month required' });
    const amt = parseFloat(income);
    if (!amt || amt <= 0) return res.status(400).json({ success: false, error: 'Income must be positive' });

    const existing = await db.get('SELECT id FROM monthly_income_log WHERE user_id = $1 AND month = $2', [req.userId, month]);
    if (existing) {
      await db.run('UPDATE monthly_income_log SET income = $1 WHERE id = $2', [amt, existing.id]);
    } else {
      await db.run('INSERT INTO monthly_income_log (user_id, month, income) VALUES ($1, $2, $3)', [req.userId, month, amt]);
    }
    await db.run('UPDATE users SET monthly_income = $1 WHERE id = $2', [amt, req.userId]);

    res.json({ success: true, data: { month, income: amt } });
  } catch (err) {
    sendError(res, err);
  }
});

// POST /api/budget/set-allocation — lock spend/save/invest split for a month
router.post('/set-allocation', async (req, res) => {
  try {
    const { month, spend_pct, savings_pct, invest_pct } = req.body;
    if (!month) return res.status(400).json({ success: false, error: 'Month required' });

    const s = parseInt(spend_pct);
    const sv = parseInt(savings_pct);
    const iv = parseInt(invest_pct);
    if (isNaN(s) || isNaN(sv) || isNaN(iv)) {
      return res.status(400).json({ success: false, error: 'All percentages required' });
    }
    if (s + sv + iv !== 100) {
      return res.status(400).json({ success: false, error: 'Percentages must sum to 100' });
    }
    if (s < 0 || sv < 0 || iv < 0) {
      return res.status(400).json({ success: false, error: 'Percentages cannot be negative' });
    }

    const existing = await db.get('SELECT id FROM monthly_allocation WHERE user_id = $1 AND month = $2', [req.userId, month]);
    if (existing) {
      return res.status(409).json({ success: false, error: 'Allocation already set for this month' });
    }

    await db.run('INSERT INTO monthly_allocation (user_id, month, spend_pct, savings_pct, invest_pct) VALUES ($1, $2, $3, $4, $5)',
      [req.userId, month, s, sv, iv]);
    await db.run('UPDATE users SET spend_pct = $1, savings_pct = $2, invest_pct = $3 WHERE id = $4',
      [s, sv, iv, req.userId]);

    res.json({ success: true, data: { month, spend_pct: s, savings_pct: sv, invest_pct: iv } });
  } catch (err) {
    sendError(res, err);
  }
});

module.exports = router;
