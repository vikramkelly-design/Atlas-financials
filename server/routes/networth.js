const express = require('express');
const router = express.Router();
const db = require('../db');
const { sendError } = require('../utils/errors');

router.get('/', async (req, res) => {
  try {
    const assets = await db.all('SELECT * FROM net_worth_assets WHERE user_id = $1 ORDER BY id DESC', [req.userId]);
    const liabilities = await db.all('SELECT * FROM net_worth_liabilities WHERE user_id = $1 ORDER BY id DESC', [req.userId]);
    const totalAssets = assets.reduce((sum, a) => sum + parseFloat(a.value), 0);
    const totalLiabilities = liabilities.reduce((sum, l) => sum + parseFloat(l.value), 0);
    res.json({ success: true, data: { assets, liabilities, totalAssets, totalLiabilities, netWorth: totalAssets - totalLiabilities } });
  } catch (err) { sendError(res, err); }
});

router.post('/asset', async (req, res) => {
  try {
    const { validateString, validatePositiveAmount } = require('../utils/validate');
    const name = validateString(req.body.name, 'Name', 100);
    const value = validatePositiveAmount(req.body.value, 'Value');
    const type = req.body.type || 'Other';
    const result = await db.get('INSERT INTO net_worth_assets (user_id, name, value, type) VALUES ($1, $2, $3, $4) RETURNING id', [req.userId, name, value, type]);
    const asset = await db.get('SELECT * FROM net_worth_assets WHERE id = $1', [result.id]);
    res.json({ success: true, data: asset });
  } catch (err) {
    if (err.status === 400) return res.status(400).json({ success: false, error: err.message });
    sendError(res, err);
  }
});

router.delete('/asset/:id', async (req, res) => {
  try {
    await db.run('DELETE FROM net_worth_assets WHERE id = $1 AND user_id = $2', [req.params.id, req.userId]);
    res.json({ success: true });
  } catch (err) { sendError(res, err); }
});

router.post('/liability', async (req, res) => {
  try {
    const { validateString, validatePositiveAmount } = require('../utils/validate');
    const name = validateString(req.body.name, 'Name', 100);
    const value = validatePositiveAmount(req.body.value, 'Value');
    const result = await db.get('INSERT INTO net_worth_liabilities (user_id, name, value) VALUES ($1, $2, $3) RETURNING id', [req.userId, name, value]);
    const liability = await db.get('SELECT * FROM net_worth_liabilities WHERE id = $1', [result.id]);
    res.json({ success: true, data: liability });
  } catch (err) {
    if (err.status === 400) return res.status(400).json({ success: false, error: err.message });
    sendError(res, err);
  }
});

router.delete('/liability/:id', async (req, res) => {
  try {
    await db.run('DELETE FROM net_worth_liabilities WHERE id = $1 AND user_id = $2', [req.params.id, req.userId]);
    res.json({ success: true });
  } catch (err) { sendError(res, err); }
});

module.exports = router;
