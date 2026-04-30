const express = require('express');
const db = require('../db');
const { getYF } = require('../utils/yahoo');
const { withCache } = require('../utils/cache');
const { generatePortfolioAnalysis } = require('../services/claude');
const { sendError } = require('../utils/errors');

const router = express.Router();

// ── Portfolios ─────────────────────────────────────────────

router.get('/', async (req, res) => {
  try {
    const rows = await db.all('SELECT * FROM portfolios WHERE user_id = $1 ORDER BY created_at', [req.userId]);
    res.json({ success: true, data: rows });
  } catch (err) {
    sendError(res, err);
  }
});

router.post('/', async (req, res) => {
  try {
    const existing = await db.get('SELECT id FROM portfolios WHERE user_id = $1', [req.userId]);
    if (existing) return res.status(400).json({ success: false, error: 'You can only have one portfolio' });

    const { name = 'My Portfolio', initialDeposit = 0, recurringAmount = 0, recurringFrequency = null } = req.body;

    const result = await db.get(`
      INSERT INTO portfolios (user_id, name, cash_balance, initial_deposit, recurring_amount, recurring_frequency, last_recurring_deposit)
      VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id
    `, [req.userId, name.trim(), initialDeposit, initialDeposit, recurringAmount, recurringFrequency || null, recurringFrequency ? new Date().toISOString() : null]);

    const portfolio = await db.get('SELECT * FROM portfolios WHERE id = $1', [result.id]);

    if (initialDeposit > 0) {
      await db.run("INSERT INTO portfolio_transactions (portfolio_id, type, total) VALUES ($1, 'deposit', $2)", [portfolio.id, initialDeposit]);
    }

    res.status(201).json({ success: true, data: portfolio });
  } catch (err) {
    sendError(res, err);
  }
});

router.put('/:id', async (req, res) => {
  try {
    const portfolio = await db.get('SELECT * FROM portfolios WHERE id = $1 AND user_id = $2', [req.params.id, req.userId]);
    if (!portfolio) return res.status(404).json({ success: false, error: 'Portfolio not found' });

    const { name, recurringAmount, recurringFrequency } = req.body;
    await db.run(`
      UPDATE portfolios SET
        name = COALESCE($1, name),
        recurring_amount = COALESCE($2, recurring_amount),
        recurring_frequency = COALESCE($3, recurring_frequency)
      WHERE id = $4
    `, [name?.trim() || null, recurringAmount ?? null, recurringFrequency ?? null, portfolio.id]);

    const updated = await db.get('SELECT * FROM portfolios WHERE id = $1', [portfolio.id]);
    res.json({ success: true, data: updated });
  } catch (err) {
    sendError(res, err);
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const result = await db.run('DELETE FROM portfolios WHERE id = $1 AND user_id = $2', [req.params.id, req.userId]);
    if (result.rowCount === 0) return res.status(404).json({ success: false, error: 'Portfolio not found' });
    res.json({ success: true });
  } catch (err) {
    sendError(res, err);
  }
});

router.post('/:id/deposit', async (req, res) => {
  try {
    const portfolio = await db.get('SELECT * FROM portfolios WHERE id = $1 AND user_id = $2', [req.params.id, req.userId]);
    if (!portfolio) return res.status(404).json({ success: false, error: 'Portfolio not found' });

    const { amount } = req.body;
    if (!amount || amount <= 0) return res.status(400).json({ success: false, error: 'Amount must be positive' });

    await db.run('UPDATE portfolios SET cash_balance = cash_balance + $1 WHERE id = $2', [amount, portfolio.id]);
    await db.run("INSERT INTO portfolio_transactions (portfolio_id, type, total) VALUES ($1, 'deposit', $2)", [portfolio.id, amount]);

    const updated = await db.get('SELECT * FROM portfolios WHERE id = $1', [portfolio.id]);
    res.json({ success: true, data: updated });
  } catch (err) {
    sendError(res, err);
  }
});

// ── Positions ──────────────────────────────────────────────

router.get('/positions', async (req, res) => {
  try {
    const portfolio = await db.get('SELECT * FROM portfolios WHERE user_id = $1 ORDER BY id LIMIT 1', [req.userId]);
    if (!portfolio) return res.json({ success: true, data: [] });
    const positions = await db.all('SELECT * FROM portfolio_positions WHERE portfolio_id = $1 ORDER BY created_at', [portfolio.id]);
    res.json({ success: true, data: positions });
  } catch (err) {
    sendError(res, err);
  }
});

router.get('/:id/positions', async (req, res) => {
  try {
    const portfolio = await db.get('SELECT * FROM portfolios WHERE id = $1 AND user_id = $2', [req.params.id, req.userId]);
    if (!portfolio) return res.status(404).json({ success: false, error: 'Portfolio not found' });
    const positions = await db.all('SELECT * FROM portfolio_positions WHERE portfolio_id = $1 ORDER BY created_at', [portfolio.id]);
    res.json({ success: true, data: positions });
  } catch (err) {
    sendError(res, err);
  }
});

router.post('/:id/positions', async (req, res) => {
  try {
    const portfolio = await db.get('SELECT * FROM portfolios WHERE id = $1 AND user_id = $2', [req.params.id, req.userId]);
    if (!portfolio) return res.status(404).json({ success: false, error: 'Portfolio not found' });

    let { ticker, shares, avgCost, source, assetType } = req.body;
    if (!ticker || !shares) return res.status(400).json({ success: false, error: 'ticker and shares are required' });
    ticker = ticker.toUpperCase().trim();
    shares = parseFloat(shares);
    if (shares <= 0) return res.status(400).json({ success: false, error: 'shares must be positive' });
    const posSource = ['savings', 'stipend', 'gift', 'import'].includes(source) ? source : 'import';
    const posAssetType = assetType === 'etf' ? 'etf' : 'stock';

    if (!avgCost) {
      try {
        const yf = await getYF();
        const quote = await withCache(`quote-simple:${ticker}`, () => yf.quote(ticker, {}, { skipValidation: true }));
        avgCost = quote?.regularMarketPrice || 0;
      } catch { avgCost = 0; }
    }

    const totalCost = Math.round(avgCost * shares * 100) / 100;

    if (posSource === 'savings') {
      const user = await db.get('SELECT monthly_income, spend_pct, invest_pct FROM users WHERE id = $1', [req.userId]);
      if (user) {
        const income = user.monthly_income || 0;
        const spendAmt = Math.round(income * (user.spend_pct / 100) * 100) / 100;
        const investAmt = Math.round(income * (user.invest_pct / 100) * 100) / 100;

        const now = new Date();
        const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        const monthStart = `${monthKey}-01`;
        const nextMonth = now.getMonth() === 11
          ? `${now.getFullYear() + 1}-01-01`
          : `${now.getFullYear()}-${String(now.getMonth() + 2).padStart(2, '0')}-01`;

        const txns = await db.get(
          'SELECT COALESCE(SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END), 0) as spent FROM transactions WHERE user_id = $1 AND month = $2',
          [req.userId, monthKey]
        );
        const unspent = Math.max(0, spendAmt - (parseFloat(txns?.spent) || 0));

        const investSpent = await db.get(`
          SELECT COALESCE(SUM(pt.total), 0) as total
          FROM portfolio_transactions pt
          JOIN portfolios p ON p.id = pt.portfolio_id
          WHERE p.user_id = $1 AND pt.source = 'savings' AND pt.type = 'buy'
            AND pt.created_at >= $2 AND pt.created_at < $3
        `, [req.userId, monthStart, nextMonth]);

        const dryPowder = Math.max(0, Math.round((investAmt + unspent - (parseFloat(investSpent?.total) || 0)) * 100) / 100);
        if (totalCost > dryPowder) {
          return res.status(400).json({
            success: false,
            error: `Not enough investing cash. You have $${dryPowder.toFixed(2)} available but this order costs $${totalCost.toFixed(2)}`
          });
        }
      }
    }

    const existing = await db.get('SELECT * FROM portfolio_positions WHERE portfolio_id = $1 AND ticker = $2', [portfolio.id, ticker]);
    if (existing) {
      const newShares = existing.shares + shares;
      const newAvgCost = ((existing.avg_cost * existing.shares) + (avgCost * shares)) / newShares;
      await db.run('UPDATE portfolio_positions SET shares = $1, avg_cost = $2 WHERE id = $3', [newShares, newAvgCost, existing.id]);
    } else {
      await db.run('INSERT INTO portfolio_positions (portfolio_id, ticker, shares, avg_cost, source, asset_type) VALUES ($1, $2, $3, $4, $5, $6)', [portfolio.id, ticker, shares, avgCost, posSource, posAssetType]);
    }

    if (posSource === 'savings') {
      await db.run('INSERT INTO portfolio_transactions (portfolio_id, type, ticker, shares, price, total, source) VALUES ($1, $2, $3, $4, $5, $6, $7)',
        [portfolio.id, 'buy', ticker, shares, avgCost, totalCost, 'savings']);
    }

    const positions = await db.all('SELECT * FROM portfolio_positions WHERE portfolio_id = $1 ORDER BY created_at', [portfolio.id]);
    res.status(201).json({ success: true, data: positions });
  } catch (err) {
    sendError(res, err);
  }
});

router.delete('/:id/positions/:posId', async (req, res) => {
  try {
    const result = await db.run('DELETE FROM portfolio_positions WHERE id = $1 AND portfolio_id = $2', [req.params.posId, req.params.id]);
    if (result.rowCount === 0) return res.status(404).json({ success: false, error: 'Position not found' });
    res.json({ success: true });
  } catch (err) {
    sendError(res, err);
  }
});

// ── Orders ─────────────────────────────────────────────────

router.get('/:id/orders', async (req, res) => {
  try {
    const portfolio = await db.get('SELECT * FROM portfolios WHERE id = $1 AND user_id = $2', [req.params.id, req.userId]);
    if (!portfolio) return res.status(404).json({ success: false, error: 'Portfolio not found' });

    const status = req.query.status;
    let orders;
    if (status) {
      orders = await db.all('SELECT * FROM orders WHERE portfolio_id = $1 AND status = $2 ORDER BY created_at DESC', [portfolio.id, status]);
    } else {
      orders = await db.all('SELECT * FROM orders WHERE portfolio_id = $1 ORDER BY created_at DESC', [portfolio.id]);
    }
    res.json({ success: true, data: orders });
  } catch (err) {
    sendError(res, err);
  }
});

router.post('/:id/orders', async (req, res) => {
  try {
    const portfolio = await db.get('SELECT * FROM portfolios WHERE id = $1 AND user_id = $2', [req.params.id, req.userId]);
    if (!portfolio) return res.status(404).json({ success: false, error: 'Portfolio not found' });

    const { orderType, side, ticker, shares, targetPrice } = req.body;
    if (!orderType || !side || !ticker || !shares) return res.status(400).json({ success: false, error: 'orderType, side, ticker, and shares are required' });
    if (!['market', 'limit', 'stop_loss'].includes(orderType)) return res.status(400).json({ success: false, error: 'orderType must be market, limit, or stop_loss' });
    if (!['buy', 'sell'].includes(side)) return res.status(400).json({ success: false, error: 'side must be buy or sell' });
    if (shares <= 0) return res.status(400).json({ success: false, error: 'shares must be positive' });
    if ((orderType === 'limit' || orderType === 'stop_loss') && !targetPrice) return res.status(400).json({ success: false, error: 'targetPrice is required for limit and stop_loss orders' });

    if (orderType === 'stop_loss' || side === 'sell') {
      const position = await db.get('SELECT * FROM portfolio_positions WHERE portfolio_id = $1 AND ticker = $2', [portfolio.id, ticker.toUpperCase()]);
      if (!position || position.shares < shares) return res.status(400).json({ success: false, error: `Insufficient shares of ${ticker.toUpperCase()}. Own: ${position?.shares || 0}` });
    }

    if (orderType === 'market') {
      let price;
      try {
        const yf = await getYF();
        const quote = await withCache(`quote-simple:${ticker.toUpperCase()}`, () => yf.quote(ticker.toUpperCase(), {}, { skipValidation: true }));
        price = quote?.regularMarketPrice;
      } catch (err) { console.error(`[Order] Quote fetch failed for ${ticker}:`, err.message); }
      if (!price) return res.status(400).json({ success: false, error: `Could not fetch price for ${ticker}` });
      const total = price * shares;

      if (side === 'buy') {
        try { await executeMarketBuy(portfolio.id, ticker.toUpperCase(), shares, price, total); }
        catch (buyErr) { return res.status(400).json({ success: false, error: buyErr.message }); }
      } else {
        await executeMarketSell(portfolio.id, ticker.toUpperCase(), shares, price, total);
      }

      const order = await db.get('SELECT * FROM orders WHERE portfolio_id = $1 ORDER BY id DESC LIMIT 1', [portfolio.id]);
      return res.status(201).json({ success: true, data: order });
    }

    if (orderType === 'limit' && side === 'buy') {
      const estimatedTotal = targetPrice * shares;
      if (portfolio.cash_balance < estimatedTotal) return res.status(400).json({ success: false, error: `Insufficient cash. Need ~$${estimatedTotal.toFixed(2)}, have $${portfolio.cash_balance.toFixed(2)}` });
    }

    const result = await db.get(`
      INSERT INTO orders (portfolio_id, ticker, order_type, side, shares, target_price, status)
      VALUES ($1, $2, $3, $4, $5, $6, 'pending') RETURNING id
    `, [portfolio.id, ticker.toUpperCase(), orderType, side, shares, targetPrice]);

    const order = await db.get('SELECT * FROM orders WHERE id = $1', [result.id]);
    res.status(201).json({ success: true, data: order });
  } catch (err) {
    sendError(res, err);
  }
});

router.delete('/:id/orders/:orderId', async (req, res) => {
  try {
    const portfolio = await db.get('SELECT * FROM portfolios WHERE id = $1 AND user_id = $2', [req.params.id, req.userId]);
    if (!portfolio) return res.status(404).json({ success: false, error: 'Portfolio not found' });

    const result = await db.run(
      "UPDATE orders SET status = 'cancelled' WHERE id = $1 AND portfolio_id = $2 AND status = 'pending'",
      [req.params.orderId, portfolio.id]
    );
    if (result.rowCount === 0) return res.status(404).json({ success: false, error: 'Pending order not found' });
    res.json({ success: true });
  } catch (err) {
    sendError(res, err);
  }
});

// ── Transactions ───────────────────────────────────────────

router.get('/:id/transactions', async (req, res) => {
  try {
    const portfolio = await db.get('SELECT * FROM portfolios WHERE id = $1 AND user_id = $2', [req.params.id, req.userId]);
    if (!portfolio) return res.status(404).json({ success: false, error: 'Portfolio not found' });
    const txns = await db.all('SELECT * FROM portfolio_transactions WHERE portfolio_id = $1 ORDER BY created_at DESC LIMIT 100', [portfolio.id]);
    res.json({ success: true, data: txns });
  } catch (err) {
    sendError(res, err);
  }
});

// ── Historical Performance ────────────────────────────────

router.get('/:id/history', async (req, res, next) => {
  try {
    const portfolio = await db.get('SELECT * FROM portfolios WHERE id = $1 AND user_id = $2', [req.params.id, req.userId]);
    if (!portfolio) return res.status(404).json({ success: false, error: 'Portfolio not found' });

    const positions = await db.all('SELECT * FROM portfolio_positions WHERE portfolio_id = $1', [portfolio.id]);
    if (positions.length === 0) return res.json({ success: true, data: { portfolio: [], sp500: [] } });

    const earliestPosition = await db.get('SELECT MIN(created_at) as earliest FROM portfolio_positions WHERE portfolio_id = $1', [portfolio.id]);
    const inceptionDate = earliestPosition?.earliest ? new Date(earliestPosition.earliest) : new Date(portfolio.created_at);

    const period = req.query.period || '1y';
    const periodDays = { '1d': 1, '1w': 7, '1m': 30, '1y': 365 };
    const days = periodDays[period] || 365;
    const interval = period === '1d' ? '15m' : period === '1w' ? '1h' : '1d';

    const yf = await getYF();
    const now = new Date();
    const periodStart = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    const startDate = inceptionDate > periodStart ? inceptionDate : periodStart;

    const tickers = [...new Set(positions.map(p => p.ticker))];
    const allTickers = [...tickers, '^GSPC'];

    const historyByTicker = {};
    const results = await Promise.allSettled(allTickers.map(async (ticker) => {
      const data = await withCache(`chart:${ticker}:${period}`, async () => {
        const result = await yf.chart(ticker, { period1: startDate, period2: now, interval }, { skipValidation: true });
        const isIntraday = interval !== '1d';
        return (result?.quotes || []).filter(q => q.close != null).map(q => ({
          date: isIntraday ? new Date(q.date).toISOString() : new Date(q.date).toISOString().split('T')[0],
          close: q.close,
        }));
      });
      return { ticker, data };
    }));

    results.forEach(r => { if (r.status === 'fulfilled') historyByTicker[r.value.ticker] = r.value.data; });

    const allDatesSet = new Set();
    tickers.forEach(t => (historyByTicker[t] || []).forEach(d => allDatesSet.add(d.date)));
    const allDates = [...allDatesSet].sort();

    const priceMaps = {};
    tickers.forEach(t => { priceMaps[t] = {}; (historyByTicker[t] || []).forEach(d => { priceMaps[t][d.date] = d.close; }); });

    const lastKnown = {};
    const portfolioSeries = allDates.map(date => {
      let totalValue = 0;
      positions.forEach(pos => {
        if (priceMaps[pos.ticker]?.[date] != null) lastKnown[pos.ticker] = priceMaps[pos.ticker][date];
        totalValue += pos.shares * (lastKnown[pos.ticker] || 0);
      });
      return { date, value: Math.round(totalValue * 100) / 100 };
    });

    const portfolioStart = allDates.length > 0 ? allDates[0] : null;
    const sp500Series = (historyByTicker['^GSPC'] || [])
      .filter(d => portfolioStart && d.date >= portfolioStart)
      .map(d => ({ date: d.date, value: Math.round(d.close * 100) / 100 }));

    res.json({ success: true, data: { portfolio: portfolioSeries, sp500: sp500Series } });
  } catch (err) {
    next(err);
  }
});

// ── AI Analysis ────────────────────────────────────────────

router.get('/:id/analysis', async (req, res) => {
  try {
    const portfolio = await db.get('SELECT * FROM portfolios WHERE id = $1 AND user_id = $2', [req.params.id, req.userId]);
    if (!portfolio) return res.status(404).json({ success: false, error: 'Portfolio not found' });

    const positions = await db.all('SELECT * FROM portfolio_positions WHERE portfolio_id = $1', [portfolio.id]);
    if (positions.length === 0) return res.json({ success: true, data: { analysis: 'Add positions to your portfolio to generate an analysis.' } });

    const yf = await getYF();
    let totalValue = 0;
    const enriched = [];
    for (const pos of positions) {
      try {
        const quote = await withCache(`quote-simple:${pos.ticker}`, () => yf.quote(pos.ticker, {}, { skipValidation: true }));
        const price = quote?.regularMarketPrice || 0;
        const value = price * pos.shares;
        totalValue += value;
        let sector = 'Unknown';
        try { const summary = await withCache(`sector:${pos.ticker}`, () => yf.quoteSummary(pos.ticker, { modules: ['summaryProfile'] })); sector = summary.summaryProfile?.sector || 'Unknown'; } catch {}
        enriched.push({ ticker: pos.ticker, shares: pos.shares, value: Math.round(value * 100) / 100, sector, weight: 0 });
      } catch {
        enriched.push({ ticker: pos.ticker, shares: pos.shares, value: 0, sector: 'Unknown', weight: 0 });
      }
    }

    enriched.forEach(p => { p.weight = totalValue > 0 ? Math.round((p.value / totalValue) * 10000) / 100 : 0; });

    let analysis;
    try { analysis = await generatePortfolioAnalysis(enriched); }
    catch (err) { console.error('[Analysis] Claude API failed:', err.message); analysis = generateFallbackAnalysis(enriched, totalValue); }
    res.json({ success: true, data: { analysis, positions: enriched } });
  } catch (err) {
    sendError(res, err);
  }
});

function generateFallbackAnalysis(positions, totalValue) {
  const sectors = {};
  const sectorTickers = {};
  for (const p of positions) {
    const s = p.sector || 'Unknown';
    sectors[s] = (sectors[s] || 0) + p.weight;
    if (!sectorTickers[s]) sectorTickers[s] = [];
    sectorTickers[s].push(p.ticker);
  }
  const sorted = Object.entries(sectors).sort((a, b) => b[1] - a[1]);
  const sortedPositions = [...positions].sort((a, b) => b.weight - a.weight);
  const lines = [];
  const sectorParts = sorted.map(([s, w]) => { const tickers = sectorTickers[s].join(', '); return `${s} at ${w.toFixed(0)}% (${tickers})`; });
  lines.push(`Your portfolio is invested across ${sorted.length} sector${sorted.length > 1 ? 's' : ''}: ${sectorParts.join('; ')}.`);
  const holdingDesc = sortedPositions.map(p => `${p.ticker} (${p.weight.toFixed(0)}%)`).join(', ');
  lines.push(`Your holdings break down as ${holdingDesc}, with a total portfolio value of $${(totalValue).toLocaleString('en-US', { maximumFractionDigits: 0 })}.`);
  if (sorted.length === 1) lines.push(`A key risk is that everything is in ${sorted[0][0]} — if that sector faces a downturn, your entire portfolio would be affected.`);
  else if (sorted[0][1] > 50) { const topTickers = sectorTickers[sorted[0][0]].join(' and '); lines.push(`One risk to watch: ${sorted[0][0]} makes up ${sorted[0][1].toFixed(0)}% of your portfolio through ${topTickers}.`); }
  else lines.push(`Your sector diversification helps limit risk — no single sector dominates.`);
  const topHolding = sortedPositions[0];
  if (topHolding.weight > 40) lines.push(`${topHolding.ticker} is your largest position at ${topHolding.weight.toFixed(0)}% — strong returns if it performs well, but more volatility.`);
  else if (positions.length >= 3) lines.push(`You have exposure to multiple companies, giving you a chance to benefit from growth in several areas.`);
  else lines.push(`With ${positions.length} holding${positions.length > 1 ? 's' : ''}, consider adding more stocks for diversification.`);
  lines.push('This is for informational purposes only and is not financial advice.');
  return lines.join(' ');
}

// ── Helpers ────────────────────────────────────────────────

async function executeMarketBuy(portfolioId, ticker, shares, price, total) {
  await db.transaction(async (client) => {
    const { rows } = await client.query('SELECT cash_balance FROM portfolios WHERE id = $1', [portfolioId]);
    const portfolio = rows[0];
    if (portfolio.cash_balance < total) throw new Error(`Insufficient cash. Need $${total.toFixed(2)}, have $${portfolio.cash_balance.toFixed(2)}`);

    const orderResult = await client.query(`
      INSERT INTO orders (portfolio_id, ticker, order_type, side, shares, executed_price, status, executed_at)
      VALUES ($1, $2, 'market', 'buy', $3, $4, 'executed', NOW()) RETURNING id
    `, [portfolioId, ticker, shares, price]);
    const orderId = orderResult.rows[0].id;

    const { rows: existingRows } = await client.query('SELECT * FROM portfolio_positions WHERE portfolio_id = $1 AND ticker = $2', [portfolioId, ticker]);
    const existing = existingRows[0];
    if (existing) {
      const newShares = existing.shares + shares;
      const newAvgCost = Math.round(((existing.avg_cost * existing.shares) + total) / newShares * 100) / 100;
      await client.query('UPDATE portfolio_positions SET shares = $1, avg_cost = $2 WHERE id = $3', [newShares, newAvgCost, existing.id]);
    } else {
      await client.query('INSERT INTO portfolio_positions (portfolio_id, ticker, shares, avg_cost) VALUES ($1, $2, $3, $4)', [portfolioId, ticker, shares, price]);
    }

    await client.query('UPDATE portfolios SET cash_balance = cash_balance - $1 WHERE id = $2', [total, portfolioId]);
    await client.query("INSERT INTO portfolio_transactions (portfolio_id, order_id, type, ticker, shares, price, total) VALUES ($1, $2, 'buy', $3, $4, $5, $6)", [portfolioId, orderId, ticker, shares, price, total]);
  });
}

async function executeMarketSell(portfolioId, ticker, shares, price, total) {
  const existing = await db.get('SELECT * FROM portfolio_positions WHERE portfolio_id = $1 AND ticker = $2', [portfolioId, ticker]);
  if (!existing || existing.shares < shares) throw new Error('Insufficient shares');

  await db.transaction(async (client) => {
    const orderResult = await client.query(`
      INSERT INTO orders (portfolio_id, ticker, order_type, side, shares, executed_price, status, executed_at)
      VALUES ($1, $2, 'market', 'sell', $3, $4, 'executed', NOW()) RETURNING id
    `, [portfolioId, ticker, shares, price]);
    const orderId = orderResult.rows[0].id;

    const remainingShares = existing.shares - shares;
    if (remainingShares <= 0.0001) {
      await client.query('DELETE FROM portfolio_positions WHERE id = $1', [existing.id]);
    } else {
      await client.query('UPDATE portfolio_positions SET shares = $1 WHERE id = $2', [remainingShares, existing.id]);
    }

    await client.query('UPDATE portfolios SET cash_balance = cash_balance + $1 WHERE id = $2', [total, portfolioId]);
    await client.query("INSERT INTO portfolio_transactions (portfolio_id, order_id, type, ticker, shares, price, total) VALUES ($1, $2, 'sell', $3, $4, $5, $6)", [portfolioId, orderId, ticker, shares, price, total]);
  });
}

module.exports = router;
module.exports.executeMarketBuy = executeMarketBuy;
module.exports.executeMarketSell = executeMarketSell;
