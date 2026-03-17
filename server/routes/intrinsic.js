const express = require('express');
const { getYF } = require('../utils/yahoo');
const { withCache } = require('../utils/cache');
const { calculateIntrinsicSummary } = require('../utils/calculations');

const router = express.Router();

router.get('/:ticker', async (req, res, next) => {
  try {
    const yf = await getYF();
    const ticker = req.params.ticker.toUpperCase();
    const discountRate = Math.min(Math.max(parseFloat(req.query.discountRate) || 0.10, 0.08), 0.15);
    const cacheKey = `intrinsic:${ticker}:${discountRate}`;

    const data = await withCache(cacheKey, async () => {
      const [summaryModule, keyStats, financialData, earningsTrend, cashFlowModule, quoteData] = await Promise.allSettled([
        yf.quoteSummary(ticker, { modules: ['summaryDetail'] }),
        yf.quoteSummary(ticker, { modules: ['defaultKeyStatistics'] }),
        yf.quoteSummary(ticker, { modules: ['financialData'] }),
        yf.quoteSummary(ticker, { modules: ['earningsTrend'] }),
        yf.quoteSummary(ticker, { modules: ['cashflowStatementHistory'] }),
        yf.quote(ticker),
      ]);

      const sd = summaryModule.status === 'fulfilled' ? summaryModule.value.summaryDetail : {};
      const ks = keyStats.status === 'fulfilled' ? keyStats.value.defaultKeyStatistics : {};
      const fd = financialData.status === 'fulfilled' ? financialData.value.financialData : {};
      const et = earningsTrend.status === 'fulfilled' ? earningsTrend.value.earningsTrend : null;
      const cf = cashFlowModule.status === 'fulfilled' ? cashFlowModule.value.cashflowStatementHistory : null;
      const q = quoteData.status === 'fulfilled' ? quoteData.value : {};

      if (!q.regularMarketPrice && !fd.currentPrice) {
        throw new Error(`No data found for ticker: ${ticker}`);
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
      const sharesOutstanding = ks.sharesOutstanding || q.sharesOutstanding || 0;

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

      const result = calculateIntrinsicSummary({
        netIncome, da, capex, freeCashFlow,
        sharesOutstanding, growthRateRaw, discountRate, currentPrice
      });

      return {
        ticker,
        companyName: q.longName || q.shortName || ticker,
        currentPrice,
        rawInputs: {
          netIncome, da, capex, freeCashFlow, sharesOutstanding,
          growthRateRaw, discountRate,
          eps: ks.trailingEps,
          peRatio: sd.trailingPE,
          bookValuePerShare: ks.bookValue,
        },
        ...result,
      };
    });

    res.json(data);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
