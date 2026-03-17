const express = require('express');
const db = require('../db');
const { getYF } = require('../utils/yahoo');
const { withCache } = require('../utils/cache');
const { generatePortfolioAnalysis } = require('../services/claude');

const router = express.Router();

// ── Portfolios ─────────────────────────────────────────────

// List portfolios
router.get('/', (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM portfolios WHERE user_id = ? ORDER BY created_at').all(req.userId);
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Create portfolio
router.post('/', (req, res) => {
  try {
    const { name, initialDeposit = 0, recurringAmount = 0, recurringFrequency = null } = req.body;
    if (!name) return res.status(400).json({ success: false, error: 'Portfolio name is required' });

    const result = db.prepare(`
      INSERT INTO portfolios (user_id, name, cash_balance, initial_deposit, recurring_amount, recurring_frequency, last_recurring_deposit)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(req.userId, name.trim(), initialDeposit, initialDeposit, recurringAmount, recurringFrequency || null, recurringFrequency ? new Date().toISOString() : null);

    const portfolio = db.prepare('SELECT * FROM portfolios WHERE id = ?').get(result.lastInsertRowid);

    if (initialDeposit > 0) {
      db.prepare(`INSERT INTO portfolio_transactions (portfolio_id, type, total) VALUES (?, 'deposit', ?)`).run(portfolio.id, initialDeposit);
    }

    res.status(201).json({ success: true, data: portfolio });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Update portfolio
router.put('/:id', (req, res) => {
  try {
    const portfolio = db.prepare('SELECT * FROM portfolios WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
    if (!portfolio) return res.status(404).json({ success: false, error: 'Portfolio not found' });

    const { name, recurringAmount, recurringFrequency } = req.body;
    db.prepare(`
      UPDATE portfolios SET
        name = COALESCE(?, name),
        recurring_amount = COALESCE(?, recurring_amount),
        recurring_frequency = COALESCE(?, recurring_frequency)
      WHERE id = ?
    `).run(name?.trim() || null, recurringAmount ?? null, recurringFrequency ?? null, portfolio.id);

    const updated = db.prepare('SELECT * FROM portfolios WHERE id = ?').get(portfolio.id);
    res.json({ success: true, data: updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Delete portfolio
router.delete('/:id', (req, res) => {
  try {
    const result = db.prepare('DELETE FROM portfolios WHERE id = ?').run(req.params.id);
    if (result.changes === 0) return res.status(404).json({ success: false, error: 'Portfolio not found' });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Add cash deposit
router.post('/:id/deposit', (req, res) => {
  try {
    const portfolio = db.prepare('SELECT * FROM portfolios WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
    if (!portfolio) return res.status(404).json({ success: false, error: 'Portfolio not found' });

    const { amount } = req.body;
    if (!amount || amount <= 0) return res.status(400).json({ success: false, error: 'Amount must be positive' });

    db.prepare('UPDATE portfolios SET cash_balance = cash_balance + ? WHERE id = ?').run(amount, portfolio.id);
    db.prepare("INSERT INTO portfolio_transactions (portfolio_id, type, total) VALUES (?, 'deposit', ?)").run(portfolio.id, amount);

    const updated = db.prepare('SELECT * FROM portfolios WHERE id = ?').get(portfolio.id);
    res.json({ success: true, data: updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Positions ──────────────────────────────────────────────

// Shortcut: get all positions from default (first) portfolio — used by Dashboard
router.get('/positions', (req, res) => {
  try {
    const portfolio = db.prepare('SELECT * FROM portfolios WHERE user_id = ? ORDER BY id LIMIT 1').get(req.userId);
    if (!portfolio) return res.json({ success: true, data: [] });
    const positions = db.prepare('SELECT * FROM portfolio_positions WHERE portfolio_id = ? ORDER BY created_at').all(portfolio.id);
    res.json({ success: true, data: positions });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/:id/positions', (req, res) => {
  try {
    const portfolio = db.prepare('SELECT * FROM portfolios WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
    if (!portfolio) return res.status(404).json({ success: false, error: 'Portfolio not found' });

    const positions = db.prepare('SELECT * FROM portfolio_positions WHERE portfolio_id = ? ORDER BY created_at').all(portfolio.id);
    res.json({ success: true, data: positions });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Add position directly (no cash/trading required)
router.post('/:id/positions', async (req, res) => {
  try {
    const portfolio = db.prepare('SELECT * FROM portfolios WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
    if (!portfolio) return res.status(404).json({ success: false, error: 'Portfolio not found' });

    let { ticker, shares, avgCost } = req.body;
    if (!ticker || !shares) return res.status(400).json({ success: false, error: 'ticker and shares are required' });
    ticker = ticker.toUpperCase().trim();
    shares = parseFloat(shares);
    if (shares <= 0) return res.status(400).json({ success: false, error: 'shares must be positive' });

    // If no avgCost provided, fetch current price
    if (!avgCost) {
      try {
        const yf = await getYF();
        const quote = await withCache(`quote-simple:${ticker}`, () => yf.quote(ticker, {}, { skipValidation: true }));
        avgCost = quote?.regularMarketPrice || 0;
      } catch { avgCost = 0; }
    }

    const existing = db.prepare('SELECT * FROM portfolio_positions WHERE portfolio_id = ? AND ticker = ?').get(portfolio.id, ticker);
    if (existing) {
      const newShares = existing.shares + shares;
      const newAvgCost = ((existing.avg_cost * existing.shares) + (avgCost * shares)) / newShares;
      db.prepare('UPDATE portfolio_positions SET shares = ?, avg_cost = ? WHERE id = ?').run(newShares, newAvgCost, existing.id);
    } else {
      db.prepare('INSERT INTO portfolio_positions (portfolio_id, ticker, shares, avg_cost) VALUES (?, ?, ?, ?)').run(portfolio.id, ticker, shares, avgCost);
    }

    const positions = db.prepare('SELECT * FROM portfolio_positions WHERE portfolio_id = ? ORDER BY created_at').all(portfolio.id);
    res.status(201).json({ success: true, data: positions });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Remove position
router.delete('/:id/positions/:posId', (req, res) => {
  try {
    const result = db.prepare('DELETE FROM portfolio_positions WHERE id = ? AND portfolio_id = ?').run(req.params.posId, req.params.id);
    if (result.changes === 0) return res.status(404).json({ success: false, error: 'Position not found' });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Orders ─────────────────────────────────────────────────

router.get('/:id/orders', (req, res) => {
  try {
    const portfolio = db.prepare('SELECT * FROM portfolios WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
    if (!portfolio) return res.status(404).json({ success: false, error: 'Portfolio not found' });

    const status = req.query.status;
    const query = status
      ? 'SELECT * FROM orders WHERE portfolio_id = ? AND status = ? ORDER BY created_at DESC'
      : 'SELECT * FROM orders WHERE portfolio_id = ? ORDER BY created_at DESC';
    const orders = status ? db.prepare(query).all(portfolio.id, status) : db.prepare(query).all(portfolio.id);
    res.json({ success: true, data: orders });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Place order
router.post('/:id/orders', async (req, res) => {
  try {
    const portfolio = db.prepare('SELECT * FROM portfolios WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
    if (!portfolio) return res.status(404).json({ success: false, error: 'Portfolio not found' });

    const { orderType, side, ticker, shares, targetPrice } = req.body;

    if (!orderType || !side || !ticker || !shares) {
      return res.status(400).json({ success: false, error: 'orderType, side, ticker, and shares are required' });
    }
    if (!['market', 'limit', 'stop_loss'].includes(orderType)) {
      return res.status(400).json({ success: false, error: 'orderType must be market, limit, or stop_loss' });
    }
    if (!['buy', 'sell'].includes(side)) {
      return res.status(400).json({ success: false, error: 'side must be buy or sell' });
    }
    if (shares <= 0) {
      return res.status(400).json({ success: false, error: 'shares must be positive' });
    }
    if ((orderType === 'limit' || orderType === 'stop_loss') && !targetPrice) {
      return res.status(400).json({ success: false, error: 'targetPrice is required for limit and stop_loss orders' });
    }

    // Verify shares for sell/stop_loss
    if (orderType === 'stop_loss' || side === 'sell') {
      const position = db.prepare('SELECT * FROM portfolio_positions WHERE portfolio_id = ? AND ticker = ?').get(portfolio.id, ticker.toUpperCase());
      if (!position || position.shares < shares) {
        return res.status(400).json({ success: false, error: `Insufficient shares of ${ticker.toUpperCase()}. Own: ${position?.shares || 0}` });
      }
    }

    // Market orders execute immediately
    if (orderType === 'market') {
      let price;
      try {
        const yf = await getYF();
        const quote = await withCache(
          `quote-simple:${ticker.toUpperCase()}`,
          () => yf.quote(ticker.toUpperCase(), {}, { skipValidation: true })
        );
        price = quote?.regularMarketPrice;
      } catch (err) {
        console.error(`[Order] Quote fetch failed for ${ticker}:`, err.message);
      }
      if (!price) {
        return res.status(400).json({ success: false, error: `Could not fetch price for ${ticker}` });
      }
      const total = price * shares;

      if (side === 'buy') {
        if (portfolio.cash_balance < total) {
          return res.status(400).json({ success: false, error: `Insufficient cash. Need $${total.toFixed(2)}, have $${portfolio.cash_balance.toFixed(2)}` });
        }
        executeMarketBuy(portfolio.id, ticker.toUpperCase(), shares, price, total);
      } else {
        executeMarketSell(portfolio.id, ticker.toUpperCase(), shares, price, total);
      }

      const order = db.prepare('SELECT * FROM orders WHERE portfolio_id = ? ORDER BY id DESC LIMIT 1').get(portfolio.id);
      return res.status(201).json({ success: true, data: order });
    }

    // Limit/stop_loss go to pending
    if (orderType === 'limit' && side === 'buy') {
      const estimatedTotal = targetPrice * shares;
      if (portfolio.cash_balance < estimatedTotal) {
        return res.status(400).json({ success: false, error: `Insufficient cash. Need ~$${estimatedTotal.toFixed(2)}, have $${portfolio.cash_balance.toFixed(2)}` });
      }
    }

    const result = db.prepare(`
      INSERT INTO orders (portfolio_id, ticker, order_type, side, shares, target_price, status)
      VALUES (?, ?, ?, ?, ?, ?, 'pending')
    `).run(portfolio.id, ticker.toUpperCase(), orderType, side, shares, targetPrice);

    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json({ success: true, data: order });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Cancel order
router.delete('/:id/orders/:orderId', (req, res) => {
  try {
    const portfolio = db.prepare('SELECT * FROM portfolios WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
    if (!portfolio) return res.status(404).json({ success: false, error: 'Portfolio not found' });

    const result = db.prepare(
      "UPDATE orders SET status = 'cancelled' WHERE id = ? AND portfolio_id = ? AND status = 'pending'"
    ).run(req.params.orderId, portfolio.id);

    if (result.changes === 0) return res.status(404).json({ success: false, error: 'Pending order not found' });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Transactions ───────────────────────────────────────────

router.get('/:id/transactions', (req, res) => {
  try {
    const portfolio = db.prepare('SELECT * FROM portfolios WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
    if (!portfolio) return res.status(404).json({ success: false, error: 'Portfolio not found' });

    const txns = db.prepare('SELECT * FROM portfolio_transactions WHERE portfolio_id = ? ORDER BY created_at DESC LIMIT 100').all(portfolio.id);
    res.json({ success: true, data: txns });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Historical Performance ────────────────────────────────

router.get('/:id/history', async (req, res, next) => {
  try {
    const portfolio = db.prepare('SELECT * FROM portfolios WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
    if (!portfolio) return res.status(404).json({ success: false, error: 'Portfolio not found' });

    const positions = db.prepare('SELECT * FROM portfolio_positions WHERE portfolio_id = ?').all(portfolio.id);
    if (positions.length === 0) return res.json({ success: true, data: { portfolio: [], sp500: [] } });

    // Find the earliest position creation date as the portfolio inception
    const earliestPosition = db.prepare(
      'SELECT MIN(created_at) as earliest FROM portfolio_positions WHERE portfolio_id = ?'
    ).get(portfolio.id);
    const inceptionDate = earliestPosition?.earliest ? new Date(earliestPosition.earliest + 'Z') : new Date(portfolio.created_at + 'Z');

    const period = req.query.period || '1y';
    const periodDays = { '1d': 1, '1w': 7, '1m': 30, '1y': 365 };
    const days = periodDays[period] || 365;
    // Use intraday interval for 1d, otherwise daily
    const interval = period === '1d' ? '15m' : period === '1w' ? '1h' : '1d';

    const yf = await getYF();
    const now = new Date();
    const periodStart = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    // Use the later of period start vs inception date — never show data before portfolio existed
    const startDate = inceptionDate > periodStart ? inceptionDate : periodStart;

    const tickers = [...new Set(positions.map(p => p.ticker))];
    const allTickers = [...tickers, '^GSPC'];

    // Fetch historical data for all tickers in parallel
    const historyByTicker = {};
    const results = await Promise.allSettled(allTickers.map(async (ticker) => {
      const data = await withCache(`chart:${ticker}:${period}`, async () => {
        const result = await yf.chart(ticker, {
          period1: startDate,
          period2: now,
          interval,
        }, { skipValidation: true });
        const isIntraday = interval !== '1d';
        return (result?.quotes || []).filter(q => q.close != null).map(q => ({
          date: isIntraday ? new Date(q.date).toISOString() : new Date(q.date).toISOString().split('T')[0],
          close: q.close,
        }));
      });
      return { ticker, data };
    }));

    results.forEach(r => {
      if (r.status === 'fulfilled') historyByTicker[r.value.ticker] = r.value.data;
    });

    // Build daily portfolio value series using all dates from portfolio tickers
    const allDatesSet = new Set();
    tickers.forEach(t => (historyByTicker[t] || []).forEach(d => allDatesSet.add(d.date)));
    const allDates = [...allDatesSet].sort();

    // Build price lookup maps for fast access
    const priceMaps = {};
    tickers.forEach(t => {
      priceMaps[t] = {};
      (historyByTicker[t] || []).forEach(d => { priceMaps[t][d.date] = d.close; });
    });

    // For each date, calculate total portfolio value using last-known price
    const lastKnown = {};
    const portfolioSeries = allDates.map(date => {
      let totalValue = 0;
      positions.forEach(pos => {
        if (priceMaps[pos.ticker]?.[date] != null) {
          lastKnown[pos.ticker] = priceMaps[pos.ticker][date];
        }
        totalValue += pos.shares * (lastKnown[pos.ticker] || 0);
      });
      return { date, value: Math.round(totalValue * 100) / 100 };
    });

    // S&P 500 series — trim to only dates within portfolio range
    const portfolioStart = allDates.length > 0 ? allDates[0] : null;
    const sp500Series = (historyByTicker['^GSPC'] || [])
      .filter(d => portfolioStart && d.date >= portfolioStart)
      .map(d => ({
        date: d.date,
        value: Math.round(d.close * 100) / 100,
      }));

    res.json({ success: true, data: { portfolio: portfolioSeries, sp500: sp500Series } });
  } catch (err) {
    next(err);
  }
});

// ── AI Analysis ────────────────────────────────────────────

router.get('/:id/analysis', async (req, res) => {
  try {
    const portfolio = db.prepare('SELECT * FROM portfolios WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
    if (!portfolio) return res.status(404).json({ success: false, error: 'Portfolio not found' });

    const positions = db.prepare('SELECT * FROM portfolio_positions WHERE portfolio_id = ?').all(portfolio.id);
    if (positions.length === 0) {
      return res.json({ success: true, data: { analysis: 'Add positions to your portfolio to generate an analysis.' } });
    }

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
        try {
          const summary = await withCache(`sector:${pos.ticker}`, () => yf.quoteSummary(pos.ticker, { modules: ['summaryProfile'] }));
          sector = summary.summaryProfile?.sector || 'Unknown';
        } catch {}

        enriched.push({ ticker: pos.ticker, shares: pos.shares, value: Math.round(value * 100) / 100, sector, weight: 0 });
      } catch {
        enriched.push({ ticker: pos.ticker, shares: pos.shares, value: 0, sector: 'Unknown', weight: 0 });
      }
    }

    enriched.forEach(p => {
      p.weight = totalValue > 0 ? Math.round((p.value / totalValue) * 10000) / 100 : 0;
    });

    let analysis;
    try {
      analysis = await generatePortfolioAnalysis(enriched);
    } catch (err) {
      console.error('[Analysis] Claude API failed, using built-in summary:', err.message);
      analysis = generateFallbackAnalysis(enriched, totalValue);
    }
    res.json({ success: true, data: { analysis, positions: enriched } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

function generateFallbackAnalysis(positions, totalValue) {
  // Group by sector with tickers
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

  // Sentence 1: Sector breakdown with company names
  const sectorParts = sorted.map(([s, w]) => {
    const tickers = sectorTickers[s].join(', ');
    return `${s} at ${w.toFixed(0)}% (${tickers})`;
  });
  lines.push(`Your portfolio is invested across ${sorted.length} sector${sorted.length > 1 ? 's' : ''}: ${sectorParts.join('; ')}.`);

  // Sentence 2: Company-specific holdings breakdown
  const holdingDesc = sortedPositions.map(p => `${p.ticker} (${p.weight.toFixed(0)}%)`).join(', ');
  lines.push(`Your holdings break down as ${holdingDesc}, with a total portfolio value of $${(totalValue).toLocaleString('en-US', { maximumFractionDigits: 0 })}.`);

  // Sentence 3: Risks — be specific about companies and sectors
  if (sorted.length === 1) {
    lines.push(`A key risk is that everything is in ${sorted[0][0]} — if that sector faces a downturn (like regulatory changes or slowing demand), your entire portfolio would be affected, so adding stocks from different sectors like healthcare or consumer staples could help protect you.`);
  } else if (sorted[0][1] > 50) {
    const topSector = sorted[0][0];
    const topTickers = sectorTickers[topSector].join(' and ');
    lines.push(`One risk to watch: ${topSector} makes up ${sorted[0][1].toFixed(0)}% of your portfolio through ${topTickers}, so a slowdown in that sector could hit you harder than a more diversified portfolio.`);
  } else {
    lines.push(`Your sector diversification helps limit risk — no single sector dominates, which means trouble in one area won't wipe out your whole portfolio.`);
  }

  // Sentence 4: Potential/strengths — specific to actual companies
  const topHolding = sortedPositions[0];
  if (topHolding.weight > 40) {
    lines.push(`On the upside, ${topHolding.ticker} is your largest position at ${topHolding.weight.toFixed(0)}% — if ${topHolding.ticker} performs well, it will drive strong portfolio returns, but that concentration also means more volatility.`);
  } else if (positions.length >= 3) {
    lines.push(`The upside is that you have exposure to multiple companies across different parts of the economy, which gives you a chance to benefit from growth in several areas at once.`);
  } else {
    lines.push(`With ${positions.length} holding${positions.length > 1 ? 's' : ''}, consider adding more stocks from different sectors to reduce risk and capture broader market growth.`);
  }

  lines.push('This is for informational purposes only and is not financial advice.');
  return lines.join(' ');
}

// ── Helpers ────────────────────────────────────────────────

function executeMarketBuy(portfolioId, ticker, shares, price, total) {
  const insertOrder = db.prepare(`
    INSERT INTO orders (portfolio_id, ticker, order_type, side, shares, executed_price, status, executed_at)
    VALUES (?, ?, 'market', 'buy', ?, ?, 'executed', datetime('now'))
  `);

  const existing = db.prepare('SELECT * FROM portfolio_positions WHERE portfolio_id = ? AND ticker = ?').get(portfolioId, ticker);

  const txn = db.transaction(() => {
    const orderResult = insertOrder.run(portfolioId, ticker, shares, price);

    if (existing) {
      const newShares = existing.shares + shares;
      const newAvgCost = ((existing.avg_cost * existing.shares) + total) / newShares;
      db.prepare('UPDATE portfolio_positions SET shares = ?, avg_cost = ? WHERE id = ?').run(newShares, newAvgCost, existing.id);
    } else {
      db.prepare('INSERT INTO portfolio_positions (portfolio_id, ticker, shares, avg_cost) VALUES (?, ?, ?, ?)').run(portfolioId, ticker, shares, price);
    }

    db.prepare('UPDATE portfolios SET cash_balance = cash_balance - ? WHERE id = ?').run(total, portfolioId);
    db.prepare("INSERT INTO portfolio_transactions (portfolio_id, order_id, type, ticker, shares, price, total) VALUES (?, ?, 'buy', ?, ?, ?, ?)").run(portfolioId, orderResult.lastInsertRowid, ticker, shares, price, total);
  });

  txn();
}

function executeMarketSell(portfolioId, ticker, shares, price, total) {
  const existing = db.prepare('SELECT * FROM portfolio_positions WHERE portfolio_id = ? AND ticker = ?').get(portfolioId, ticker);
  if (!existing || existing.shares < shares) throw new Error('Insufficient shares');

  const insertOrder = db.prepare(`
    INSERT INTO orders (portfolio_id, ticker, order_type, side, shares, executed_price, status, executed_at)
    VALUES (?, ?, 'market', 'sell', ?, ?, 'executed', datetime('now'))
  `);

  const txn = db.transaction(() => {
    const orderResult = insertOrder.run(portfolioId, ticker, shares, price);

    const remainingShares = existing.shares - shares;
    if (remainingShares <= 0.0001) {
      db.prepare('DELETE FROM portfolio_positions WHERE id = ?').run(existing.id);
    } else {
      db.prepare('UPDATE portfolio_positions SET shares = ? WHERE id = ?').run(remainingShares, existing.id);
    }

    db.prepare('UPDATE portfolios SET cash_balance = cash_balance + ? WHERE id = ?').run(total, portfolioId);
    db.prepare("INSERT INTO portfolio_transactions (portfolio_id, order_id, type, ticker, shares, price, total) VALUES (?, ?, 'sell', ?, ?, ?, ?)").run(portfolioId, orderResult.lastInsertRowid, ticker, shares, price, total);
  });

  txn();
}

module.exports = router;
module.exports.executeMarketBuy = executeMarketBuy;
module.exports.executeMarketSell = executeMarketSell;
