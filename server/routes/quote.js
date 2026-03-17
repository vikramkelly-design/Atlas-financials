const express = require('express');
const { getYF } = require('../utils/yahoo');
const { withCache } = require('../utils/cache');

const router = express.Router();

router.get('/:ticker', async (req, res, next) => {
  try {
    const yf = await getYF();
    const ticker = req.params.ticker.toUpperCase();
    const data = await withCache(`quote:${ticker}`, async () => {
      const [quote, summaryDetail, defaultKeyStats, financialData] = await Promise.allSettled([
        yf.quote(ticker, {}, { skipValidation: true }),
        yf.quoteSummary(ticker, { modules: ['summaryDetail'] }),
        yf.quoteSummary(ticker, { modules: ['defaultKeyStatistics'] }),
        yf.quoteSummary(ticker, { modules: ['financialData'] }),
      ]);

      const q = quote.status === 'fulfilled' ? quote.value : {};
      const sd = summaryDetail.status === 'fulfilled' ? summaryDetail.value.summaryDetail : {};
      const ks = defaultKeyStats.status === 'fulfilled' ? defaultKeyStats.value.defaultKeyStatistics : {};
      const fd = financialData.status === 'fulfilled' ? financialData.value.financialData : {};

      if (!q.regularMarketPrice) {
        throw new Error(`No data found for ticker: ${ticker}`);
      }

      return {
        ticker,
        companyName: q.longName || q.shortName || ticker,
        currentPrice: q.regularMarketPrice,
        previousClose: q.regularMarketPreviousClose,
        marketCap: q.marketCap,
        currency: q.currency || 'USD',
        exchange: q.fullExchangeName,
        fiftyTwoWeekHigh: q.fiftyTwoWeekHigh,
        fiftyTwoWeekLow: q.fiftyTwoWeekLow,
        eps: ks.trailingEps,
        peRatio: sd.trailingPE,
        forwardPE: sd.forwardPE,
        pegRatio: ks.pegRatio,
        bookValuePerShare: ks.bookValue,
        priceToBook: ks.priceToBook,
        dividendYield: sd.dividendYield,
        sharesOutstanding: ks.sharesOutstanding,
        revenue: fd.totalRevenue,
        profitMargin: fd.profitMargins,
        debtToEquity: fd.debtToEquity,
        returnOnEquity: fd.returnOnEquity,
        freeCashFlow: fd.freeCashflow,
        revenueGrowth: fd.revenueGrowth,
        earningsGrowth: fd.earningsGrowth,
        currentRatio: fd.currentRatio,
        targetHighPrice: fd.targetHighPrice,
        targetLowPrice: fd.targetLowPrice,
        targetMeanPrice: fd.targetMeanPrice,
        recommendationMean: fd.recommendationMean,
        recommendationKey: fd.recommendationKey,
        numberOfAnalystOpinions: fd.numberOfAnalystOpinions,
      };
    });
    res.json(data);
  } catch (err) {
    next(err);
  }
});

// 10-day price history for sparkline charts
router.get('/:ticker/history', async (req, res, next) => {
  try {
    const yf = await getYF();
    const ticker = req.params.ticker.toUpperCase();
    const data = await withCache(`history:${ticker}`, async () => {
      const now = new Date();
      const tenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
      const result = await yf.chart(ticker, {
        period1: tenDaysAgo,
        period2: now,
        interval: '1d',
      }, { skipValidation: true });
      const quotes = result?.quotes || [];
      return quotes.map(q => ({
        date: q.date,
        close: q.close,
        high: q.high,
        low: q.low,
        open: q.open,
        volume: q.volume,
      })).filter(q => q.close != null);
    });
    res.json(data);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
