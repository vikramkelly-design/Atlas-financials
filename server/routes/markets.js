const express = require('express');
const { getYF } = require('../utils/yahoo');
const { withCache } = require('../utils/cache');
const { generateMarketDigest, generateCompanyExplainer } = require('../services/claude');

const router = express.Router();

// GET /api/markets/search?q=
router.get('/search', async (req, res, next) => {
  try {
    const { q } = req.query;
    if (!q) return res.json({ success: true, data: [] });
    const yf = await getYF();
    const result = await yf.search(q);
    const results = (result.quotes || [])
      .filter(item => ['EQUITY', 'ETF', 'MUTUALFUND', 'INDEX'].includes(item.quoteType))
      .slice(0, 8)
      .map(item => ({
        symbol: item.symbol,
        name: item.shortname || item.longname || item.symbol,
        exchange: item.exchange
      }));
    res.json({ success: true, data: results });
  } catch (err) {
    next(err);
  }
});

// GET /api/markets/prices?tickers=AAPL,MSFT
router.get('/prices', async (req, res, next) => {
  try {
    const { tickers } = req.query;
    if (!tickers) return res.json({ success: true, data: {} });
    const yf = await getYF();
    const tickerList = tickers.split(',').map(t => t.trim().toUpperCase()).filter(Boolean);
    const results = {};
    for (const ticker of tickerList) {
      try {
        const quote = await withCache(`quote-simple:${ticker}`, () => yf.quote(ticker, {}, { skipValidation: true }));
        results[ticker] = {
          ticker: quote.symbol,
          name: quote.shortName || quote.longName || ticker,
          price: quote.regularMarketPrice,
          change: quote.regularMarketChange,
          changePercent: quote.regularMarketChangePercent,
          previousClose: quote.regularMarketPreviousClose,
          high52: quote.fiftyTwoWeekHigh,
          low52: quote.fiftyTwoWeekLow,
          marketCap: quote.marketCap,
          volume: quote.regularMarketVolume
        };
      } catch (err) {
        results[ticker] = { ticker, error: err.message };
      }
    }
    res.json({ success: true, data: results });
  } catch (err) {
    next(err);
  }
});

// GET /api/markets/digest/:ticker
router.get('/digest/:ticker', async (req, res, next) => {
  try {
    const yf = await getYF();
    const ticker = req.params.ticker.toUpperCase();
    const quote = await withCache(`quote-simple:${ticker}`, () => yf.quote(ticker, {}, { skipValidation: true }));
    if (!quote?.regularMarketPrice) {
      return res.status(404).json({ success: false, error: 'Ticker not found' });
    }
    const digest = await generateMarketDigest(ticker, quote.shortName || quote.longName || ticker, quote.regularMarketPrice, quote.regularMarketChangePercent?.toFixed(2));
    res.json({ success: true, data: { digest } });
  } catch (err) {
    next(err);
  }
});

// GET /api/markets/explain/:ticker
router.get('/explain/:ticker', async (req, res, next) => {
  try {
    const yf = await getYF();
    const ticker = req.params.ticker.toUpperCase();
    const [quote, summary] = await Promise.allSettled([
      yf.quote(ticker),
      yf.quoteSummary(ticker, { modules: ['summaryProfile'] }),
    ]);
    const q = quote.status === 'fulfilled' ? quote.value : {};
    const profile = summary.status === 'fulfilled' ? summary.value.summaryProfile : {};
    const explanation = await generateCompanyExplainer(
      ticker,
      q.longName || q.shortName || ticker,
      profile.sector || 'Unknown',
      (profile.longBusinessSummary || 'No description available.').substring(0, 500)
    );
    res.json({ success: true, data: { explanation } });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
