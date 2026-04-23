const cron = require('node-cron');
const db = require('../db');
const { getYF } = require('../utils/yahoo');
const { calculateIntrinsicSummary } = require('../utils/calculations');
const { fetchStockDataFMP } = require('../utils/fmp');

const SP100 = [
  'AAPL','MSFT','NVDA','AMZN','META','GOOGL','TSLA','BRK-B','JPM','LLY',
  'AVGO','V','UNH','XOM','MA','COST','HD','PG','JNJ','ABBV',
  'BAC','MRK','CRM','CVX','WMT','KO','NFLX','PEP','TMO','ACN',
  'MCD','CSCO','ABT','LIN','DHR','TXN','NEE','PM','ORCL','IBM',
  'AMGN','QCOM','GE','RTX','HON','SPGI','UPS','CAT','GS','BLK',
  'MS','AMAT','BKNG','ISRG','AXP','SYK','VRTX','ADI','GILD','MMC',
  'TJX','PLD','MDLZ','ADP','CB','SCHW','C','CVS','REGN','ZTS',
  'ETN','MO','BSX','DE','SO','DUK','BMY','SBUX','EOG','ELV',
  'PGR','AON','ITW','NOC','FI','APH','CME','MCO','WM','CL',
  'HUM','USB','TGT','NSC','FDX','EMR','PSA','D','OXY',
];

const BATCH_SIZE = 20;
const BATCH_DELAY_MS = 30000;
const DISCOUNT_RATE = 0.10;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchStockData(ticker) {
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
    growthRateRaw, discountRate: DISCOUNT_RATE, currentPrice
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
}

function saveToCache(ticker, data) {
  const upsert = db.prepare(`
    INSERT INTO screener_cache (ticker, data, refreshed_at) VALUES (?, ?, datetime('now'))
    ON CONFLICT(ticker) DO UPDATE SET data = excluded.data, refreshed_at = excluded.refreshed_at
  `);
  upsert.run(ticker, JSON.stringify(data));
}

async function processBatch(batch, batchNum, totalBatches) {
  console.log(`[NightlyScreener] Batch ${batchNum}/${totalBatches}: ${batch.join(', ')}`);
  const results = await Promise.allSettled(batch.map(t => fetchStockData(t)));

  let success = 0, failed = 0;
  const fmpRetries = [];

  results.forEach((result, i) => {
    if (result.status === 'fulfilled') {
      saveToCache(batch[i], result.value);
      success++;
    } else {
      console.error(`[NightlyScreener] Yahoo failed: ${batch[i]} — ${result.reason?.message}`);
      fmpRetries.push(batch[i]);
      failed++;
    }
  });

  // Retry failed tickers with FMP fallback
  if (fmpRetries.length > 0 && process.env.FMP_API_KEY) {
    console.log(`[NightlyScreener] Retrying ${fmpRetries.length} with FMP: ${fmpRetries.join(', ')}`);
    const fmpResults = await Promise.allSettled(fmpRetries.map(t => fetchStockDataFMP(t)));
    fmpResults.forEach((result, i) => {
      if (result.status === 'fulfilled') {
        saveToCache(fmpRetries[i], result.value);
        success++;
        failed--;
        console.log(`[NightlyScreener] FMP recovered: ${fmpRetries[i]}`);
      } else {
        console.error(`[NightlyScreener] FMP also failed: ${fmpRetries[i]} — ${result.reason?.message}`);
      }
    });
  }

  console.log(`[NightlyScreener] Batch ${batchNum} done: ${success} ok, ${failed} failed`);
}

async function runNightlyScreener() {
  console.log('[NightlyScreener] Starting nightly refresh...');
  const startTime = Date.now();

  // Build full ticker list: S&P 100 + user-added tickers not in S&P 100
  const sp100Set = new Set(SP100);
  const userRows = db.prepare('SELECT DISTINCT ticker FROM screener_tickers').all();
  const userExtra = userRows.map(r => r.ticker).filter(t => !sp100Set.has(t));
  const allTickers = [...SP100, ...userExtra];

  console.log(`[NightlyScreener] ${SP100.length} S&P 100 + ${userExtra.length} user-added = ${allTickers.length} total`);

  // Process in batches of 20 with 30s delays
  const batches = [];
  for (let i = 0; i < allTickers.length; i += BATCH_SIZE) {
    batches.push(allTickers.slice(i, i + BATCH_SIZE));
  }

  for (let i = 0; i < batches.length; i++) {
    await processBatch(batches[i], i + 1, batches.length);
    if (i < batches.length - 1) {
      console.log(`[NightlyScreener] Waiting 30s before next batch...`);
      await sleep(BATCH_DELAY_MS);
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
  console.log(`[NightlyScreener] Complete. ${allTickers.length} stocks refreshed in ${elapsed}s`);
}

function scheduleNightlyScreener() {
  // Run at 2:00 AM every day
  cron.schedule('0 2 * * *', () => {
    console.log('[NightlyScreener] Cron triggered');
    runNightlyScreener().catch(err => {
      console.error('[NightlyScreener] Job failed:', err.message);
    });
  });
  console.log('[NightlyScreener] Scheduled — runs daily at 2:00 AM');
}

module.exports = { scheduleNightlyScreener, runNightlyScreener, fetchStockData, saveToCache, SP100 };
