const express = require('express');
const router = express.Router();
const db = require('../db');
const { sendError } = require('../utils/errors');

router.get('/', async (req, res) => {
  try {
    const plan = await db.get('SELECT * FROM plans WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1', [req.userId]);
    res.json({ success: true, data: plan || null });
  } catch (err) { sendError(res, err); }
});

router.post('/', async (req, res) => {
  try {
    const { goal_amount, target_age, current_age, monthly_investment, risk_tolerance } = req.body;
    const existing = await db.get('SELECT id FROM plans WHERE user_id = $1', [req.userId]);
    if (existing) {
      await db.run('UPDATE plans SET goal_amount=$1, target_age=$2, current_age=$3, monthly_investment=$4, risk_tolerance=$5, updated_at=NOW() WHERE user_id=$6',
        [goal_amount, target_age, current_age, monthly_investment, risk_tolerance || 'moderate', req.userId]);
    } else {
      await db.run('INSERT INTO plans (user_id, goal_amount, target_age, current_age, monthly_investment, risk_tolerance) VALUES ($1,$2,$3,$4,$5,$6)',
        [req.userId, goal_amount, target_age, current_age, monthly_investment, risk_tolerance || 'moderate']);
    }
    res.json({ success: true });
  } catch (err) { sendError(res, err); }
});

module.exports = router;
