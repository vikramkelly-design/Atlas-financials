const db = require('../db');
const { getYF } = require('../utils/yahoo');
const { withCache } = require('../utils/cache');

const POLL_INTERVAL = 2 * 60 * 1000; // 2 minutes

async function checkAndExecuteOrders() {
  try {
    const pendingOrders = db.prepare("SELECT * FROM orders WHERE status = 'pending'").all();
    if (pendingOrders.length === 0) return;

    const byTicker = {};
    for (const order of pendingOrders) {
      if (!byTicker[order.ticker]) byTicker[order.ticker] = [];
      byTicker[order.ticker].push(order);
    }

    const yf = await getYF();

    for (const [ticker, orders] of Object.entries(byTicker)) {
      try {
        const quote = await withCache(`quote-simple:${ticker}`, () => yf.quote(ticker, {}, { skipValidation: true }));
        if (!quote || !quote.regularMarketPrice) continue;
        const currentPrice = quote.regularMarketPrice;

        for (const order of orders) {
          try {
            if (order.order_type === 'limit' && order.side === 'buy') {
              if (currentPrice <= order.target_price) {
                executeLimitBuy(order, currentPrice);
                console.log(`[OrderExecutor] Executed limit buy: ${order.shares} ${ticker} @ $${currentPrice}`);
              }
            } else if (order.order_type === 'stop_loss' && order.side === 'sell') {
              if (currentPrice <= order.target_price) {
                executeStopLoss(order, currentPrice);
                console.log(`[OrderExecutor] Executed stop loss: ${order.shares} ${ticker} @ $${currentPrice}`);
              }
            }
          } catch (err) {
            console.error(`[OrderExecutor] Failed to execute order ${order.id}:`, err.message);
          }
        }
      } catch (err) {
        console.error(`[OrderExecutor] Failed to fetch quote for ${ticker}:`, err.message);
      }
    }
  } catch (err) {
    console.error('[OrderExecutor] Error:', err);
  }
}

function executeLimitBuy(order, executionPrice) {
  const total = executionPrice * order.shares;
  const portfolio = db.prepare('SELECT * FROM portfolios WHERE id = ?').get(order.portfolio_id);

  if (!portfolio || portfolio.cash_balance < total) {
    db.prepare("UPDATE orders SET status = 'cancelled' WHERE id = ?").run(order.id);
    return;
  }

  const existing = db.prepare('SELECT * FROM portfolio_positions WHERE portfolio_id = ? AND ticker = ?').get(order.portfolio_id, order.ticker);

  const txn = db.transaction(() => {
    db.prepare("UPDATE orders SET status = 'executed', executed_price = ?, executed_at = datetime('now') WHERE id = ?").run(executionPrice, order.id);

    if (existing) {
      const newShares = existing.shares + order.shares;
      const newAvgCost = ((existing.avg_cost * existing.shares) + total) / newShares;
      db.prepare('UPDATE portfolio_positions SET shares = ?, avg_cost = ? WHERE id = ?').run(newShares, newAvgCost, existing.id);
    } else {
      db.prepare('INSERT INTO portfolio_positions (portfolio_id, ticker, shares, avg_cost) VALUES (?, ?, ?, ?)').run(order.portfolio_id, order.ticker, order.shares, executionPrice);
    }

    db.prepare('UPDATE portfolios SET cash_balance = cash_balance - ? WHERE id = ?').run(total, order.portfolio_id);
    db.prepare("INSERT INTO portfolio_transactions (portfolio_id, order_id, type, ticker, shares, price, total) VALUES (?, ?, 'buy', ?, ?, ?, ?)").run(order.portfolio_id, order.id, order.ticker, order.shares, executionPrice, total);
  });

  txn();
}

function executeStopLoss(order, executionPrice) {
  const existing = db.prepare('SELECT * FROM portfolio_positions WHERE portfolio_id = ? AND ticker = ?').get(order.portfolio_id, order.ticker);

  if (!existing || existing.shares < order.shares) {
    db.prepare("UPDATE orders SET status = 'cancelled' WHERE id = ?").run(order.id);
    return;
  }

  const total = executionPrice * order.shares;

  const txn = db.transaction(() => {
    db.prepare("UPDATE orders SET status = 'executed', executed_price = ?, executed_at = datetime('now') WHERE id = ?").run(executionPrice, order.id);

    const remainingShares = existing.shares - order.shares;
    if (remainingShares <= 0.0001) {
      db.prepare('DELETE FROM portfolio_positions WHERE id = ?').run(existing.id);
    } else {
      db.prepare('UPDATE portfolio_positions SET shares = ? WHERE id = ?').run(remainingShares, existing.id);
    }

    db.prepare('UPDATE portfolios SET cash_balance = cash_balance + ? WHERE id = ?').run(total, order.portfolio_id);
    db.prepare("INSERT INTO portfolio_transactions (portfolio_id, order_id, type, ticker, shares, price, total) VALUES (?, ?, 'sell', ?, ?, ?, ?)").run(order.portfolio_id, order.id, order.ticker, order.shares, executionPrice, total);
  });

  txn();
}

let intervalId = null;

function startOrderExecutor() {
  console.log(`[OrderExecutor] Started — checking every ${POLL_INTERVAL / 1000}s`);
  checkAndExecuteOrders();
  intervalId = setInterval(checkAndExecuteOrders, POLL_INTERVAL);
}

function stopOrderExecutor() {
  if (intervalId) clearInterval(intervalId);
}

module.exports = { startOrderExecutor, stopOrderExecutor };
