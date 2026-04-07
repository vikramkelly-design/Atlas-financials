const db = require('../db');
const { withCache } = require('../utils/cache');

async function buildScreenerContext(userId) {
  const parts = [];

  // Plan data
  const plan = db.prepare('SELECT * FROM plans WHERE user_id = ? ORDER BY created_at DESC LIMIT 1').get(userId);
  if (plan) {
    const years = plan.target_age - plan.current_age;
    parts.push(`Plan: Goal $${plan.goal_amount.toLocaleString()} by age ${plan.target_age} (${years} years). Investing $${plan.monthly_investment}/mo. Risk tolerance: ${plan.risk_tolerance}.`);
  }

  // Watchlist
  const watchlist = db.prepare('SELECT ticker FROM watchlist WHERE user_id = ?').all(userId);
  if (watchlist.length > 0) {
    parts.push(`Watchlist: ${watchlist.map(w => w.ticker).join(', ')}`);
  }

  // Try to get cached screener results for context on undervalued stocks
  // We use the cache utility to avoid making live API calls during chat
  try {
    const cachedResults = [];
    const screenerTickers = db.prepare('SELECT ticker FROM screener_tickers WHERE user_id = ?').all(userId);
    const DEFAULT_TICKERS = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA', 'NVDA', 'META', 'BRK-B', 'JPM', 'V', 'WMT', 'JNJ', 'PG', 'KO', 'DIS'];
    const allTickers = [...new Set([...DEFAULT_TICKERS, ...screenerTickers.map(r => r.ticker)])];

    // Check cache for each ticker (don't make new API calls)
    for (const ticker of allTickers) {
      const cacheKey = `screener:${ticker}:0.1`;
      try {
        const cached = await withCache(cacheKey, async () => { throw new Error('skip'); }, 0);
        if (cached && cached.verdict) {
          cachedResults.push(cached);
        }
      } catch {
        // Not cached, skip — we don't want to slow down chat with live fetches
      }
    }

    if (cachedResults.length > 0) {
      const undervalued = cachedResults
        .filter(s => s.verdict === 'UNDERVALUED' && s.upside != null)
        .sort((a, b) => (b.upside || 0) - (a.upside || 0));

      if (undervalued.length > 0) {
        const top3 = undervalued.slice(0, 3).map(s =>
          `${s.ticker} (${s.companyName}): price $${s.currentPrice?.toFixed(2)}, buy below $${s.buyBelowPrice?.toFixed(2)}, ${s.upside?.toFixed(0)}% upside`
        );
        parts.push(`Top undervalued stocks in screener:\n${top3.join('\n')}`);
      }

      const overvalued = cachedResults.filter(s => s.verdict === 'OVERVALUED').length;
      const fairlyValued = cachedResults.filter(s => s.verdict === 'FAIRLY VALUED').length;
      parts.push(`Screener summary: ${undervalued.length} undervalued, ${fairlyValued} fairly valued, ${overvalued} overvalued out of ${cachedResults.length} stocks analyzed.`);
    }
  } catch {}

  return parts.join('\n');
}

module.exports = { buildScreenerContext };
