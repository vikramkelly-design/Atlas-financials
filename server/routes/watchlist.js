const express = require('express');
const router = express.Router();
const db = require('../db');
const { sendError } = require('../utils/errors');

// GET /api/watchlist
router.get('/', (req, res) => {
  try {
    const items = db.prepare('SELECT * FROM watchlist WHERE user_id = ? ORDER BY added_at DESC').all(req.userId);
    res.json({ success: true, data: items });
  } catch (err) {
    sendError(res, err);
  }
});

// POST /api/watchlist
router.post('/', (req, res) => {
  try {
    const { ticker } = req.body;
    if (!ticker) return res.status(400).json({ success: false, error: 'Ticker required' });
    db.prepare('INSERT OR IGNORE INTO watchlist (user_id, ticker) VALUES (?, ?)').run(req.userId, ticker.toUpperCase());
    const item = db.prepare('SELECT * FROM watchlist WHERE user_id = ? AND ticker = ?').get(req.userId, ticker.toUpperCase());
    res.json({ success: true, data: item });
  } catch (err) {
    sendError(res, err);
  }
});

// DELETE /api/watchlist/:ticker
router.delete('/:ticker', (req, res) => {
  try {
    db.prepare('DELETE FROM watchlist WHERE user_id = ? AND ticker = ?').run(req.userId, req.params.ticker.toUpperCase());
    res.json({ success: true });
  } catch (err) {
    sendError(res, err);
  }
});

module.exports = router;
