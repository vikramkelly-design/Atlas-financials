const express = require('express');
const router = express.Router();
const db = require('../db');
const { sendError } = require('../utils/errors');

// GET /api/plan — fetch user's current plan
router.get('/', (req, res) => {
  try {
    const plan = db.prepare('SELECT * FROM plans WHERE user_id = ? ORDER BY created_at DESC LIMIT 1').get(req.userId);
    res.json({ success: true, data: plan || null });
  } catch (err) {
    sendError(res, err);
  }
});

// POST /api/plan — save or update plan
router.post('/', (req, res) => {
  try {
    const { goal_amount, target_age, current_age, monthly_investment, risk_tolerance } = req.body;
    const existing = db.prepare('SELECT id FROM plans WHERE user_id = ?').get(req.userId);
    if (existing) {
      db.prepare('UPDATE plans SET goal_amount=?, target_age=?, current_age=?, monthly_investment=?, risk_tolerance=?, updated_at=CURRENT_TIMESTAMP WHERE user_id=?')
        .run(goal_amount, target_age, current_age, monthly_investment, risk_tolerance || 'moderate', req.userId);
    } else {
      db.prepare('INSERT INTO plans (user_id, goal_amount, target_age, current_age, monthly_investment, risk_tolerance) VALUES (?,?,?,?,?,?)')
        .run(req.userId, goal_amount, target_age, current_age, monthly_investment, risk_tolerance || 'moderate');
    }
    res.json({ success: true });
  } catch (err) {
    sendError(res, err);
  }
});

module.exports = router;
