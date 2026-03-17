const express = require('express');
const { getYF } = require('../utils/yahoo');
const { withCache } = require('../utils/cache');
const { calculateIntrinsicSummary } = require('../utils/calculations');

const router = express.Router();

const DEFAULT_TICKERS = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA', 'NVDA', 'META', 'BRK-B', 'JPM', 'V', 'WMT', 'JNJ', 'PG', 'KO', 'DIS'];

async function fetchStockData(ticker, discountRate = 0.10) {
  const cacheKey = `screener:${ticker}:${discountRate}`;
  return withCache(cacheKey, async () => {
    const yf = await getYF();
    const [quote, keyStats, financialData, earningsTrend, cashflow] = await Promise.allSettled([
      yf.quote(ticker),
      yf.quoteSummary(ticker, { modules: ['defaultKeyStatistics'] }),
      yf.quoteSummary(ticker, { modules: ['financialData'] }),
      yf.quoteSummary(ticker, { modules: ['earningsTrend'] }),
      yf.quoteSummary(ticker, { modules: ['cashflowStatementHistory'] }),
    ]);

    const q = quote.status === 'fulfilled' ? quote.value : {};
    const ks = keyStats.status === 'fulfilled' ? keyStats.value.defaultKeyStatistics : {};
    const fd = financialData.status === 'fulfilled' ? financialData.value.financialData : {};
    const et = earningsTrend.status === 'fulfilled' ? earningsTrend.value.earningsTrend : null;
    const cf = cashflow.status === 'fulfilled' ? cashflow.value.cashflowStatementHistory : null;

    if (!q.regularMarketPrice) {
      throw new Error(`No price data for ${ticker}`);
    }

    let growthRateRaw = 0.03;
    if (et && et.trend) {
      const fiveYearTrend = et.trend.find(t => t.period === '+5y');
      if (fiveYearTrend && fiveYearTrend.growth != null) {
        growthRateRaw = fiveYearTrend.growth;
      }
    }

    const currentPrice = q.regularMarketPrice || fd.currentPrice || 0;
    const freeCashFlow = fd.freeCashflow || 0;
    const sharesOutstanding = ks.sharesOutstanding || 0;

    let da = 0, capex = 0, netIncome = 0;
    if (cf && cf.cashflowStatements && cf.cashflowStatements.length > 0) {
      const latestCF = cf.cashflowStatements[0];
      da = latestCF.depreciation || 0;
      capex = Math.abs(latestCF.capitalExpenditures || 0);
      netIncome = latestCF.netIncome || 0;
    }
    if (!netIncome && fd.totalRevenue && fd.profitMargins) {
      netIncome = fd.totalRevenue * fd.profitMargins;
    }

    const ivResult = calculateIntrinsicSummary({
      netIncome, da, capex, freeCashFlow, sharesOutstanding,
      growthRateRaw, discountRate, currentPrice
    });

    const mosPrice = ivResult.summary.mosPrice;
    let upside = null;
    if (mosPrice && currentPrice > 0) {
      upside = ((mosPrice - currentPrice) / currentPrice) * 100;
    }

    return {
      ticker,
      companyName: q.longName || q.shortName || ticker,
      currentPrice,
      buyBelowPrice: mosPrice,
      rawIV: ivResult.summary.rawIV,
      upside,
      verdict: ivResult.summary.verdict,
      peRatio: q.trailingPE,
      forwardPE: q.forwardPE,
      pegRatio: ks.pegRatio,
      eps: ks.trailingEps,
      marketCap: q.marketCap,
      revenue: fd.totalRevenue,
      freeCashFlow,
      profitMargin: fd.profitMargins,
      debtToEquity: fd.debtToEquity,
      returnOnEquity: fd.returnOnEquity,
      dividendYield: q.dividendYield || q.trailingAnnualDividendYield,
      fiftyTwoWeekHigh: q.fiftyTwoWeekHigh,
      fiftyTwoWeekLow: q.fiftyTwoWeekLow,
      analystRating: fd.recommendationKey,
    };
  });
}

router.get('/defaults', (req, res) => {
  res.json({ tickers: DEFAULT_TICKERS });
});

router.post('/', async (req, res, next) => {
  try {
    const { tickers = DEFAULT_TICKERS, discountRate = 0.10 } = req.body;
    const uniqueTickers = [...new Set(tickers.map(t => t.toUpperCase()))];

    const results = await Promise.allSettled(
      uniqueTickers.map(ticker => fetchStockData(ticker, discountRate))
    );

    const stocks = results.map((result, i) => {
      if (result.status === 'fulfilled') return result.value;
      return {
        ticker: uniqueTickers[i],
        error: result.reason?.message || 'Failed to fetch',
        companyName: uniqueTickers[i],
      };
    });

    res.json({ stocks, defaultTickers: DEFAULT_TICKERS });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
