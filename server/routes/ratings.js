const express = require('express');
const { getYF } = require('../utils/yahoo');
const { withCache } = require('../utils/cache');

const router = express.Router();

router.get('/:ticker', async (req, res, next) => {
  try {
    const yf = await getYF();
    const ticker = req.params.ticker.toUpperCase();
    const data = await withCache(`ratings:${ticker}`, async () => {
      const [recTrend, financialData] = await Promise.allSettled([
        yf.quoteSummary(ticker, { modules: ['recommendationTrend'] }),
        yf.quoteSummary(ticker, { modules: ['financialData'] }),
      ]);

      const rt = recTrend.status === 'fulfilled' ? recTrend.value.recommendationTrend : null;
      const fd = financialData.status === 'fulfilled' ? financialData.value.financialData : {};

      let trend = null;
      if (rt && rt.trend && rt.trend.length > 0) {
        trend = rt.trend[0];
      }

      const totalAnalysts = trend
        ? (trend.strongBuy || 0) + (trend.buy || 0) + (trend.hold || 0) + (trend.sell || 0) + (trend.strongSell || 0)
        : 0;

      let consensusScore = null;
      if (trend && totalAnalysts > 0) {
        consensusScore = (
          (trend.strongBuy || 0) * 5 +
          (trend.buy || 0) * 4 +
          (trend.hold || 0) * 3 +
          (trend.sell || 0) * 2 +
          (trend.strongSell || 0) * 1
        ) / totalAnalysts;
      }

      const getRatingLabel = (score) => {
        if (score == null) return 'N/A';
        if (score >= 4.5) return 'Strong Buy';
        if (score >= 3.5) return 'Buy';
        if (score >= 2.5) return 'Hold';
        if (score >= 1.5) return 'Sell';
        return 'Strong Sell';
      };

      return {
        ticker,
        trend: trend ? {
          strongBuy: trend.strongBuy || 0,
          buy: trend.buy || 0,
          hold: trend.hold || 0,
          sell: trend.sell || 0,
          strongSell: trend.strongSell || 0,
          totalAnalysts,
        } : null,
        consensusScore,
        consensusLabel: getRatingLabel(consensusScore),
        priceTargets: {
          low: fd.targetLowPrice,
          mean: fd.targetMeanPrice,
          high: fd.targetHighPrice,
          current: fd.currentPrice,
        },
        recommendationKey: fd.recommendationKey,
        numberOfAnalystOpinions: fd.numberOfAnalystOpinions,
      };
    });
    res.json(data);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
