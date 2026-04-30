const express = require('express');
const db = require('../db');
const { fetchStockData, saveToCache, SP100 } = require('../services/nightlyScreener');

const router = express.Router();

router.get('/defaults', (req, res) => { res.json({ tickers: SP100 }); });

router.get('/', async (req, res) => {
  try {
    const rows = await db.all('SELECT ticker, data, refreshed_at FROM screener_cache ORDER BY ticker');
    const stocks = rows.map(r => { try { return JSON.parse(r.data); } catch { return { ticker: r.ticker, error: 'Parse error' }; } });
    const lastRefreshed = rows.length > 0 ? rows.reduce((latest, r) => r.refreshed_at > latest ? r.refreshed_at : latest, rows[0].refreshed_at) : null;
    res.json({ success: true, stocks, lastRefreshed });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

router.post('/', async (req, res) => {
  try {
    const { tickers } = req.body;
    const tickerList = Array.isArray(tickers) ? tickers.map(t => t.toUpperCase()) : SP100;
    const placeholders = tickerList.map((_, i) => `$${i + 1}`).join(',');
    const rows = await db.all(`SELECT ticker, data, refreshed_at FROM screener_cache WHERE ticker IN (${placeholders})`, tickerList);
    const stocks = rows.map(r => { try { return JSON.parse(r.data); } catch { return { ticker: r.ticker, error: 'Parse error' }; } });
    const lastRefreshed = rows.length > 0 ? rows.reduce((latest, r) => r.refreshed_at > latest ? r.refreshed_at : latest, rows[0].refreshed_at) : null;
    res.json({ success: true, stocks, lastRefreshed });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

router.post('/fetch-single', async (req, res) => {
  try {
    const ticker = (req.body.ticker || '').toUpperCase().trim();
    if (!ticker) return res.status(400).json({ success: false, error: 'Ticker required' });
    const cached = await db.get('SELECT data FROM screener_cache WHERE ticker = $1', [ticker]);
    if (cached) return res.json({ success: true, data: JSON.parse(cached.data), source: 'cache' });
    const data = await fetchStockData(ticker);
    await saveToCache(ticker, data);
    res.json({ success: true, data, source: 'live' });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

router.get('/last-refreshed', async (req, res) => {
  try {
    const row = await db.get('SELECT MAX(refreshed_at) as last FROM screener_cache');
    res.json({ success: true, lastRefreshed: row?.last || null });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

router.get('/tickers', async (req, res) => {
  try {
    const rows = await db.all('SELECT ticker FROM screener_tickers WHERE user_id = $1 ORDER BY added_at', [req.userId]);
    const tickers = rows.map(r => r.ticker);
    res.json({ success: true, data: tickers.length > 0 ? tickers : null });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

router.post('/tickers', async (req, res) => {
  try {
    const { tickers } = req.body;
    if (!Array.isArray(tickers)) return res.status(400).json({ success: false, error: 'tickers must be an array' });
    const unique = [...new Set(tickers.map(t => t.toUpperCase()))];
    await db.run('DELETE FROM screener_tickers WHERE user_id = $1', [req.userId]);
    for (const t of unique) { await db.run('INSERT INTO screener_tickers (user_id, ticker) VALUES ($1, $2)', [req.userId, t]); }
    res.json({ success: true, data: unique });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

router.get('/tracked', async (req, res) => {
  try {
    const rows = await db.all('SELECT ticker FROM tracked_stocks WHERE user_id = $1 ORDER BY created_at', [req.userId]);
    res.json({ success: true, data: rows.map(r => r.ticker) });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

router.post('/tracked', async (req, res) => {
  try {
    const ticker = (req.body.ticker || '').toUpperCase().trim();
    if (!ticker) return res.status(400).json({ success: false, error: 'Ticker required' });
    const existing = await db.get('SELECT id FROM tracked_stocks WHERE user_id = $1 AND ticker = $2', [req.userId, ticker]);
    if (existing) { await db.run('DELETE FROM tracked_stocks WHERE id = $1', [existing.id]); res.json({ success: true, tracked: false }); }
    else { await db.run('INSERT INTO tracked_stocks (user_id, ticker) VALUES ($1, $2)', [req.userId, ticker]); res.json({ success: true, tracked: true }); }
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

module.exports = router;
