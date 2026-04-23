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

    const insert = db.prepare(`
      INSERT INTO transactions (user_id, date, description, amount, category, month)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const insertMany = db.transaction((txns) => {
      for (const t of txns) {
        const month = t.date ? t.date.substring(0, 7) : null;
        insert.run(req.userId, t.date, t.description, t.amount, t.category || 'Other', month);
      }
    });

    insertMany(categorized);

    res.json({ success: true, data: { imported: categorized.length, transactions: categorized } });
  } catch (err) {
    sendError(res, err);
  }
});

// GET /api/budget/transactions
router.get('/transactions', (req, res) => {
  try {
    const { month } = req.query;
    let rows;
    if (month) {
      rows = db.prepare('SELECT * FROM transactions WHERE user_id = ? AND month = ? ORDER BY date DESC').all(req.userId, month);
    } else {
      rows = db.prepare('SELECT * FROM transactions WHERE user_id = ? ORDER BY date DESC').all(req.userId);
    }
    res.json({ success: true, data: rows });
  } catch (err) {
    sendError(res, err);
  }
});

// PATCH /api/budget/transaction/:id
router.patch('/transaction/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { category, notes } = req.body;
    const updates = [];
    const values = [];
    if (category) { updates.push('category = ?'); values.push(category); }
    if (notes !== undefined) { updates.push('notes = ?'); values.push(notes); }
    if (updates.length === 0) {
      return res.status(400).json({ success: false, error: 'No fields to update' });
    }
    values.push(id, req.userId);
    db.prepare(`UPDATE transactions SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`).run(...values);
    const updated = db.prepare('SELECT * FROM transactions WHERE id = ? AND user_id = ?').get(id, req.userId);
    res.json({ success: true, data: updated });
  } catch (err) {
    sendError(res, err);
  }
});

// GET /api/budget/summary/:month
router.get('/summary/:month', async (req, res) => {
  try {
    const { month } = req.params;
    const rows = db.prepare('SELECT category, SUM(amount) as total FROM transactions WHERE user_id = ? AND month = ? AND amount < 0 GROUP BY category').all(req.userId, month);
    const totalSpent = db.prepare('SELECT SUM(amount) as total FROM transactions WHERE user_id = ? AND month = ? AND amount < 0').get(req.userId, month);

    const spendingData = {
      totalSpent: totalSpent?.total || 0,
      byCategory: rows.reduce((acc, r) => { acc[r.category] = r.total; return acc; }, {})
    };

    const summary = await generateBudgetSummary(month, spendingData);
    res.json({ success: true, data: { summary, spending: spendingData } });
  } catch (err) {
    sendError(res, err);
  }
});

// POST /api/budget/goals
router.post('/goals', (req, res) => {
  try {
    const { goals } = req.body;
    if (!goals || !Array.isArray(goals)) {
      return res.status(400).json({ success: false, error: 'Goals array required' });
    }
    const upsert = db.prepare(`
      INSERT INTO budget_goals (user_id, category, monthly_limit) VALUES (?, ?, ?)
      ON CONFLICT(user_id, category) DO UPDATE SET monthly_limit = excluded.monthly_limit
    `);
    const saveAll = db.transaction((items) => {
      for (const g of items) {
        upsert.run(req.userId, g.category, g.monthly_limit);
      }
    });
    saveAll(goals);
    const all = db.prepare('SELECT * FROM budget_goals WHERE user_id = ?').all(req.userId);
    res.json({ success: true, data: all });
  } catch (err) {
    sendError(res, err);
  }
});

// GET /api/budget/goals
router.get('/goals', (req, res) => {
  try {
    const goals = db.prepare('SELECT * FROM budget_goals WHERE user_id = ?').all(req.userId);
    res.json({ success: true, data: goals });
  } catch (err) {
    sendError(res, err);
  }
});

// POST /api/budget/transaction — add a single manual transaction
router.post('/transaction', (req, res) => {
  try {
    const { date, description, amount, category } = req.body;
    if (!date || !description || amount === undefined) {
      return res.status(400).json({ success: false, error: 'Date, description, and amount are required' });
    }
    const month = date.substring(0, 7);
    const result = db.prepare(
      'INSERT INTO transactions (user_id, date, description, amount, category, month) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(req.userId, date, description, parseFloat(amount), category || 'Other', month);
    const row = db.prepare('SELECT * FROM transactions WHERE id = ?').get(result.lastInsertRowid);
    res.json({ success: true, data: row });
  } catch (err) {
    sendError(res, err);
  }
});

// DELETE /api/budget/transaction/:id
router.delete('/transaction/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM transactions WHERE id = ? AND user_id = ?').run(req.params.id, req.userId);
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
    // Fetch user's budget goals to cross-reference
    const budgetGoals = db.prepare('SELECT category, monthly_limit FROM budget_goals WHERE user_id = ?').all(req.userId);
    const goalsMap = {};
    budgetGoals.forEach(g => { goalsMap[g.category] = g.monthly_limit; });
    const analysis = await generateSpendingAnalysis(transactions, goalsMap);
    res.json({ success: true, data: { analysis } });
  } catch (err) {
    sendError(res, err);
  }
});

// GET /api/budget/overview?month=YYYY-MM — consolidated month view
router.get('/overview', (req, res) => {
  try {
    const month = req.query.month;
    if (!month) return res.status(400).json({ success: false, error: 'month query param required' });

    // Income status
    const incomeLog = db.prepare('SELECT income FROM monthly_income_log WHERE user_id = ? AND month = ? LIMIT 1').get(req.userId, month);
    const user = db.prepare('SELECT monthly_income FROM users WHERE id = ?').get(req.userId);

    // Previous month income for pre-fill
    const parts = month.split('-');
    let prevMonth;
    if (parseInt(parts[1]) === 1) {
      prevMonth = `${parseInt(parts[0]) - 1}-12`;
    } else {
      prevMonth = `${parts[0]}-${String(parseInt(parts[1]) - 1).padStart(2, '0')}`;
    }
    const prevLog = db.prepare('SELECT income FROM monthly_income_log WHERE user_id = ? AND month = ? LIMIT 1').get(req.userId, prevMonth);

    const income = incomeLog?.income || prevLog?.income || user?.monthly_income || 0;
    const incomeConfirmed = !!incomeLog;

    // Transactions
    const transactions = db.prepare('SELECT * FROM transactions WHERE user_id = ? AND month = ? ORDER BY date DESC').all(req.userId, month);

    // Goals
    const goalsRows = db.prepare('SELECT category, monthly_limit FROM budget_goals WHERE user_id = ?').all(req.userId);
    const goals = {};
    goalsRows.forEach(g => { goals[g.category] = g.monthly_limit; });

    // Spending by category
    const spendingRows = db.prepare(
      'SELECT category, SUM(amount) as total FROM transactions WHERE user_id = ? AND month = ? AND amount < 0 GROUP BY category'
    ).all(req.userId, month);
    const spendingByCategory = {};
    spendingRows.forEach(r => { spendingByCategory[r.category] = r.total; });

    const totalSpent = spendingRows.reduce((s, r) => s + r.total, 0);
    const remaining = income + totalSpent; // totalSpent is negative

    // Allocation for this month
    const allocation = db.prepare('SELECT spend_pct, savings_pct, invest_pct FROM monthly_allocation WHERE user_id = ? AND month = ?').get(req.userId, month);

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
router.post('/confirm-income', (req, res) => {
  try {
    const { month, income } = req.body;
    if (!month) return res.status(400).json({ success: false, error: 'Month required' });
    const amt = parseFloat(income);
    if (!amt || amt <= 0) return res.status(400).json({ success: false, error: 'Income must be positive' });

    const existing = db.prepare('SELECT id FROM monthly_income_log WHERE user_id = ? AND month = ?').get(req.userId, month);
    if (existing) {
      db.prepare('UPDATE monthly_income_log SET income = ? WHERE id = ?').run(amt, existing.id);
    } else {
      db.prepare('INSERT INTO monthly_income_log (user_id, month, income) VALUES (?, ?, ?)').run(req.userId, month, amt);
    }
    db.prepare('UPDATE users SET monthly_income = ? WHERE id = ?').run(amt, req.userId);

    res.json({ success: true, data: { month, income: amt } });
  } catch (err) {
    sendError(res, err);
  }
});

// POST /api/budget/set-allocation — lock spend/save/invest split for a month
router.post('/set-allocation', (req, res) => {
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

    // Check if already locked for this month
    const existing = db.prepare('SELECT id FROM monthly_allocation WHERE user_id = ? AND month = ?').get(req.userId, month);
    if (existing) {
      return res.status(409).json({ success: false, error: 'Allocation already set for this month' });
    }

    db.prepare('INSERT INTO monthly_allocation (user_id, month, spend_pct, savings_pct, invest_pct) VALUES (?, ?, ?, ?, ?)')
      .run(req.userId, month, s, sv, iv);

    // Also update the user's global allocation so other pages (Savings) see the latest
    db.prepare('UPDATE users SET spend_pct = ?, savings_pct = ?, invest_pct = ? WHERE id = ?')
      .run(s, sv, iv, req.userId);

    res.json({ success: true, data: { month, spend_pct: s, savings_pct: sv, invest_pct: iv } });
  } catch (err) {
    sendError(res, err);
  }
});

module.exports = router;
