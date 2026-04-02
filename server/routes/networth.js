const express = require('express');
const router = express.Router();
const db = require('../db');
const { sendError } = require('../utils/errors');

// GET /api/networth
router.get('/', (req, res) => {
  try {
    const assets = db.prepare('SELECT * FROM net_worth_assets WHERE user_id = ? ORDER BY id DESC').all(req.userId);
    const liabilities = db.prepare('SELECT * FROM net_worth_liabilities WHERE user_id = ? ORDER BY id DESC').all(req.userId);
    const totalAssets = assets.reduce((sum, a) => sum + a.value, 0);
    const totalLiabilities = liabilities.reduce((sum, l) => sum + l.value, 0);
    res.json({
      success: true,
      data: { assets, liabilities, totalAssets, totalLiabilities, netWorth: totalAssets - totalLiabilities }
    });
  } catch (err) {
    sendError(res, err);
  }
});

// POST /api/networth/asset
router.post('/asset', (req, res) => {
  try {
    const { validateString, validatePositiveAmount } = require('../utils/validate');
    const name = validateString(req.body.name, 'Name', 100);
    const value = validatePositiveAmount(req.body.value, 'Value');
    const type = req.body.type || 'Other';
    const result = db.prepare('INSERT INTO net_worth_assets (user_id, name, value, type) VALUES (?, ?, ?, ?)').run(req.userId, name, value, type);
    const asset = db.prepare('SELECT * FROM net_worth_assets WHERE id = ?').get(result.lastInsertRowid);
    res.json({ success: true, data: asset });
  } catch (err) {
    if (err.status === 400) return res.status(400).json({ success: false, error: err.message });
    sendError(res, err);
  }
});

// DELETE /api/networth/asset/:id
router.delete('/asset/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM net_worth_assets WHERE id = ? AND user_id = ?').run(req.params.id, req.userId);
    res.json({ success: true });
  } catch (err) {
    sendError(res, err);
  }
});

// POST /api/networth/liability
router.post('/liability', (req, res) => {
  try {
    const { validateString, validatePositiveAmount } = require('../utils/validate');
    const name = validateString(req.body.name, 'Name', 100);
    const value = validatePositiveAmount(req.body.value, 'Value');
    const result = db.prepare('INSERT INTO net_worth_liabilities (user_id, name, value) VALUES (?, ?, ?)').run(req.userId, name, value);
    const liability = db.prepare('SELECT * FROM net_worth_liabilities WHERE id = ?').get(result.lastInsertRowid);
    res.json({ success: true, data: liability });
  } catch (err) {
    if (err.status === 400) return res.status(400).json({ success: false, error: err.message });
    sendError(res, err);
  }
});

// DELETE /api/networth/liability/:id
router.delete('/liability/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM net_worth_liabilities WHERE id = ? AND user_id = ?').run(req.params.id, req.userId);
    res.json({ success: true });
  } catch (err) {
    sendError(res, err);
  }
});

module.exports = router;
