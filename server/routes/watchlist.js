const express = require('express');
const router = express.Router();
const db = require('../db');
const { sendError } = require('../utils/errors');

router.get('/', async (req, res) => {
  try {
    const items = await db.all('SELECT * FROM watchlist WHERE user_id = $1 ORDER BY added_at DESC', [req.userId]);
    res.json({ success: true, data: items });
  } catch (err) { sendError(res, err); }
});

router.post('/', async (req, res) => {
  try {
    const { ticker } = req.body;
    if (!ticker) return res.status(400).json({ success: false, error: 'Ticker required' });
    await db.run('INSERT INTO watchlist (user_id, ticker) VALUES ($1, $2) ON CONFLICT(user_id, ticker) DO NOTHING', [req.userId, ticker.toUpperCase()]);
    const item = await db.get('SELECT * FROM watchlist WHERE user_id = $1 AND ticker = $2', [req.userId, ticker.toUpperCase()]);
    res.json({ success: true, data: item });
  } catch (err) { sendError(res, err); }
});

router.delete('/:ticker', async (req, res) => {
  try {
    await db.run('DELETE FROM watchlist WHERE user_id = $1 AND ticker = $2', [req.userId, req.params.ticker.toUpperCase()]);
    res.json({ success: true });
  } catch (err) { sendError(res, err); }
});

module.exports = router;
