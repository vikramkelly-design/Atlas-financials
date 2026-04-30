const db = require('../db');
const { getYF } = require('../utils/yahoo');
const { withCache } = require('../utils/cache');

const POLL_INTERVAL = 2 * 60 * 1000; // 2 minutes

async function checkAndExecuteOrders() {
  try {
    const pendingOrders = await db.all("SELECT * FROM orders WHERE status = 'pending'");
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
                await executeLimitBuy(order, currentPrice);
                console.log(`[OrderExecutor] Executed limit buy: ${order.shares} ${ticker} @ $${currentPrice}`);
              }
            } else if (order.order_type === 'stop_loss' && order.side === 'sell') {
              if (currentPrice <= order.target_price) {
                await executeStopLoss(order, currentPrice);
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

async function executeLimitBuy(order, executionPrice) {
  const total = executionPrice * order.shares;
  const portfolio = await db.get('SELECT * FROM portfolios WHERE id = $1', [order.portfolio_id]);

  if (!portfolio || portfolio.cash_balance < total) {
    await db.run("UPDATE orders SET status = 'cancelled' WHERE id = $1", [order.id]);
    return;
  }

  const existing = await db.get('SELECT * FROM portfolio_positions WHERE portfolio_id = $1 AND ticker = $2', [order.portfolio_id, order.ticker]);

  await db.transaction(async (client) => {
    await client.query("UPDATE orders SET status = 'executed', executed_price = $1, executed_at = NOW() WHERE id = $2", [executionPrice, order.id]);

    if (existing) {
      const newShares = existing.shares + order.shares;
      const newAvgCost = ((existing.avg_cost * existing.shares) + total) / newShares;
      await client.query('UPDATE portfolio_positions SET shares = $1, avg_cost = $2 WHERE id = $3', [newShares, newAvgCost, existing.id]);
    } else {
      await client.query('INSERT INTO portfolio_positions (portfolio_id, ticker, shares, avg_cost) VALUES ($1, $2, $3, $4)', [order.portfolio_id, order.ticker, order.shares, executionPrice]);
    }

    await client.query('UPDATE portfolios SET cash_balance = cash_balance - $1 WHERE id = $2', [total, order.portfolio_id]);
    await client.query("INSERT INTO portfolio_transactions (portfolio_id, order_id, type, ticker, shares, price, total) VALUES ($1, $2, 'buy', $3, $4, $5, $6)", [order.portfolio_id, order.id, order.ticker, order.shares, executionPrice, total]);
  });
}

async function executeStopLoss(order, executionPrice) {
  const existing = await db.get('SELECT * FROM portfolio_positions WHERE portfolio_id = $1 AND ticker = $2', [order.portfolio_id, order.ticker]);

  if (!existing || existing.shares < order.shares) {
    await db.run("UPDATE orders SET status = 'cancelled' WHERE id = $1", [order.id]);
    return;
  }

  const total = executionPrice * order.shares;

  await db.transaction(async (client) => {
    await client.query("UPDATE orders SET status = 'executed', executed_price = $1, executed_at = NOW() WHERE id = $2", [executionPrice, order.id]);

    const remainingShares = existing.shares - order.shares;
    if (remainingShares <= 0.0001) {
      await client.query('DELETE FROM portfolio_positions WHERE id = $1', [existing.id]);
    } else {
      await client.query('UPDATE portfolio_positions SET shares = $1 WHERE id = $2', [remainingShares, existing.id]);
    }

    await client.query('UPDATE portfolios SET cash_balance = cash_balance + $1 WHERE id = $2', [total, order.portfolio_id]);
    await client.query("INSERT INTO portfolio_transactions (portfolio_id, order_id, type, ticker, shares, price, total) VALUES ($1, $2, 'sell', $3, $4, $5, $6)", [order.portfolio_id, order.id, order.ticker, order.shares, executionPrice, total]);
  });
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
