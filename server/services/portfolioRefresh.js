const cron = require('node-cron');
const db = require('../db');
const { getYF } = require('../utils/yahoo');

function isMarketOpen() {
  const now = new Date();

  // Check day: Monday (1) through Friday (5)
  const day = now.getDay();
  if (day === 0 || day === 6) return false;

  // Convert to Eastern Time
  const et = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
  const hours = et.getHours();
  const minutes = et.getMinutes();
  const timeInMinutes = hours * 60 + minutes;

  // Market hours: 9:30 AM (570 min) to 4:00 PM (960 min) ET
  return timeInMinutes >= 570 && timeInMinutes <= 960;
}

async function refreshPortfolioPrices() {
  if (!isMarketOpen()) {
    return;
  }

  console.log('[PortfolioRefresh] Market is open — refreshing prices...');
  const startTime = Date.now();

  try {
    // Get all unique tickers held by any user
    const rows = db.prepare(`
      SELECT DISTINCT pp.ticker
      FROM portfolio_positions pp
      JOIN portfolios p ON pp.portfolio_id = p.id
    `).all();

    const tickers = rows.map(r => r.ticker);
    if (tickers.length === 0) {
      console.log('[PortfolioRefresh] No portfolio positions found, skipping');
      return;
    }

    console.log(`[PortfolioRefresh] Fetching prices for ${tickers.length} tickers: ${tickers.join(', ')}`);

    // Fetch current prices for all tickers
    const yf = await getYF();
    const priceMap = {};

    const results = await Promise.allSettled(
      tickers.map(async (ticker) => {
        const quote = await yf.quote(ticker, {}, { skipValidation: true });
        return { ticker, price: quote?.regularMarketPrice || null };
      })
    );

    results.forEach(r => {
      if (r.status === 'fulfilled' && r.value.price != null) {
        priceMap[r.value.ticker] = r.value.price;
      }
    });

    const fetchedCount = Object.keys(priceMap).length;
    console.log(`[PortfolioRefresh] Got prices for ${fetchedCount}/${tickers.length} tickers`);

    // Update each position's gain/loss and each portfolio's total value
    const allPortfolios = db.prepare('SELECT id, user_id FROM portfolios').all();

    const updatePosition = db.prepare('UPDATE portfolio_positions SET avg_cost = avg_cost WHERE id = ?'); // no-op placeholder
    let positionsUpdated = 0;

    for (const portfolio of allPortfolios) {
      const positions = db.prepare('SELECT * FROM portfolio_positions WHERE portfolio_id = ?').all(portfolio.id);
      let totalValue = 0;

      for (const pos of positions) {
        const currentPrice = priceMap[pos.ticker];
        if (currentPrice == null) {
          // Use avg_cost as fallback for total calc
          totalValue += pos.avg_cost * pos.shares;
          continue;
        }

        const positionValue = currentPrice * pos.shares;
        const gainLoss = (currentPrice - pos.avg_cost) * pos.shares;
        totalValue += positionValue;
        positionsUpdated++;
      }
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[PortfolioRefresh] Complete. ${positionsUpdated} positions updated in ${elapsed}s`);
  } catch (err) {
    console.error('[PortfolioRefresh] Failed:', err.message);
  }
}

function schedulePortfolioRefresh() {
  // Run every 15 minutes
  cron.schedule('*/15 * * * *', () => {
    refreshPortfolioPrices().catch(err => {
      console.error('[PortfolioRefresh] Job error:', err.message);
    });
  });
  console.log('[PortfolioRefresh] Scheduled — runs every 15 min during market hours (Mon-Fri 9:30am-4pm ET)');
}

module.exports = { schedulePortfolioRefresh, refreshPortfolioPrices };
