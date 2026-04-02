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

module.exports = router;
