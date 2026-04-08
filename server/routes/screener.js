const express = require('express');
const db = require('../db');
const { fetchStockData, saveToCache, SP100 } = require('../services/nightlyScreener');

const router = express.Router();

// GET /api/screener/defaults — return S&P 100 list
router.get('/defaults', (req, res) => {
  res.json({ tickers: SP100 });
});

// GET /api/screener — return cached screener data (no live API calls)
router.get('/', (req, res) => {
  try {
    const rows = db.prepare('SELECT ticker, data, refreshed_at FROM screener_cache ORDER BY ticker').all();
    const stocks = rows.map(r => {
      try { return JSON.parse(r.data); } catch { return { ticker: r.ticker, error: 'Parse error' }; }
    });
    const lastRefreshed = rows.length > 0
      ? rows.reduce((latest, r) => r.refreshed_at > latest ? r.refreshed_at : latest, rows[0].refreshed_at)
      : null;
    res.json({ success: true, stocks, lastRefreshed });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/screener — kept for backwards compat (dashboard uses it)
// Returns cached data only, no live fetches
router.post('/', (req, res) => {
  try {
    const { tickers } = req.body;
    const tickerList = Array.isArray(tickers) ? tickers.map(t => t.toUpperCase()) : SP100;

    const placeholders = tickerList.map(() => '?').join(',');
    const rows = db.prepare(`SELECT ticker, data, refreshed_at FROM screener_cache WHERE ticker IN (${placeholders})`).all(...tickerList);
    const stocks = rows.map(r => {
      try { return JSON.parse(r.data); } catch { return { ticker: r.ticker, error: 'Parse error' }; }
    });
    const lastRefreshed = rows.length > 0
      ? rows.reduce((latest, r) => r.refreshed_at > latest ? r.refreshed_at : latest, rows[0].refreshed_at)
      : null;
    res.json({ success: true, stocks, lastRefreshed });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/screener/fetch-single — on-demand fetch for a new user-added ticker
router.post('/fetch-single', async (req, res) => {
  try {
    const ticker = (req.body.ticker || '').toUpperCase().trim();
    if (!ticker) return res.status(400).json({ success: false, error: 'Ticker required' });

    // Check cache first
    const cached = db.prepare('SELECT data FROM screener_cache WHERE ticker = ?').get(ticker);
    if (cached) {
      return res.json({ success: true, data: JSON.parse(cached.data), source: 'cache' });
    }

    // Not in cache — fetch live
    const data = await fetchStockData(ticker);
    saveToCache(ticker, data);
    res.json({ success: true, data, source: 'live' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/screener/last-refreshed — get the timestamp of the most recent nightly refresh
router.get('/last-refreshed', (req, res) => {
  try {
    const row = db.prepare('SELECT MAX(refreshed_at) as last FROM screener_cache').get();
    res.json({ success: true, lastRefreshed: row?.last || null });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/screener/tickers — get user's saved screener tickers
router.get('/tickers', (req, res) => {
  try {
    const rows = db.prepare('SELECT ticker FROM screener_tickers WHERE user_id = ? ORDER BY added_at').all(req.userId);
    const tickers = rows.map(r => r.ticker);
    res.json({ success: true, data: tickers.length > 0 ? tickers : null });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/screener/tickers — save user's screener tickers (replace all)
router.post('/tickers', (req, res) => {
  try {
    const { tickers } = req.body;
    if (!Array.isArray(tickers)) return res.status(400).json({ success: false, error: 'tickers must be an array' });
    const unique = [...new Set(tickers.map(t => t.toUpperCase()))];
    db.prepare('DELETE FROM screener_tickers WHERE user_id = ?').run(req.userId);
    const insert = db.prepare('INSERT INTO screener_tickers (user_id, ticker) VALUES (?, ?)');
    for (const t of unique) {
      insert.run(req.userId, t);
    }
    res.json({ success: true, data: unique });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/screener/tracked — get user's tracked (starred) stocks
router.get('/tracked', (req, res) => {
  try {
    const rows = db.prepare('SELECT ticker FROM tracked_stocks WHERE user_id = ? ORDER BY created_at').all(req.userId);
    res.json({ success: true, data: rows.map(r => r.ticker) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/screener/tracked — toggle a tracked stock (star/unstar)
router.post('/tracked', (req, res) => {
  try {
    const ticker = (req.body.ticker || '').toUpperCase().trim();
    if (!ticker) return res.status(400).json({ success: false, error: 'Ticker required' });

    const existing = db.prepare('SELECT id FROM tracked_stocks WHERE user_id = ? AND ticker = ?').get(req.userId, ticker);
    if (existing) {
      db.prepare('DELETE FROM tracked_stocks WHERE id = ?').run(existing.id);
      res.json({ success: true, tracked: false });
    } else {
      db.prepare('INSERT INTO tracked_stocks (user_id, ticker) VALUES (?, ?)').run(req.userId, ticker);
      res.json({ success: true, tracked: true });
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
