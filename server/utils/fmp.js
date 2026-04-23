const BASE = 'https://financialmodelingprep.com/stable';
const { calculateIntrinsicSummary } = require('./calculations');

async function fmpFetch(endpoint) {
  const key = process.env.FMP_API_KEY;
  if (!key) throw new Error('FMP_API_KEY not set');
  const url = `${BASE}/${endpoint}${endpoint.includes('?') ? '&' : '?'}apikey=${key}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`FMP ${res.status}: ${res.statusText}`);
  const data = await res.json();
  if (data?.['Error Message']) throw new Error(`FMP: ${data['Error Message']}`);
  return data;
}

async function fetchStockDataFMP(ticker) {
  const [quoteArr, profileArr, ratiosArr, cashflowArr] = await Promise.allSettled([
    fmpFetch(`quote?symbol=${ticker}`),
    fmpFetch(`profile?symbol=${ticker}`),
    fmpFetch(`ratios-ttm?symbol=${ticker}`),
    fmpFetch(`cash-flow-statement?symbol=${ticker}&period=annual&limit=1`),
  ]);

  const quote = quoteArr.status === 'fulfilled' && quoteArr.value?.[0] ? quoteArr.value[0] : null;
  const profile = profileArr.status === 'fulfilled' && profileArr.value?.[0] ? profileArr.value[0] : null;
  const ratios = ratiosArr.status === 'fulfilled' && ratiosArr.value?.[0] ? ratiosArr.value[0] : {};
  const cashflow = cashflowArr.status === 'fulfilled' && cashflowArr.value?.[0] ? cashflowArr.value[0] : {};

  if (!quote || !quote.price) {
    throw new Error(`FMP: No price data for ${ticker}`);
  }

  const currentPrice = quote.price;
  const sharesOutstanding = quote.marketCap && currentPrice > 0 ? Math.round(quote.marketCap / currentPrice) : 0;
  const freeCashFlow = cashflow.freeCashFlow || 0;
  const netIncome = cashflow.netIncome || 0;
  const da = cashflow.depreciationAndAmortization || 0;
  const capex = Math.abs(cashflow.investmentsInPropertyPlantAndEquipment || cashflow.capitalExpenditure || 0);

  // Use PEG ratio to estimate growth, or fallback to 3%
  let growthRateRaw = 0.03;
  const peg = ratios.priceToEarningsGrowthRatioTTM;
  const pe = ratios.priceToEarningsRatioTTM;
  if (peg && pe && peg > 0) {
    growthRateRaw = (pe / peg) / 100;
  }
  growthRateRaw = Math.max(-0.05, Math.min(growthRateRaw, 0.30));

  const ivResult = calculateIntrinsicSummary({
    netIncome, da, capex, freeCashFlow, sharesOutstanding,
    growthRateRaw, discountRate: 0.10, currentPrice,
  });

  const mosPrice = ivResult.summary.mosPrice;
  let upside = null;
  if (mosPrice && currentPrice > 0) {
    upside = ((mosPrice - currentPrice) / currentPrice) * 100;
  }

  return {
    ticker,
    companyName: profile?.companyName || quote.name || ticker,
    currentPrice,
    buyBelowPrice: mosPrice,
    rawIV: ivResult.summary.rawIV,
    upside,
    verdict: ivResult.summary.verdict,
    peRatio: ratios.priceToEarningsRatioTTM || null,
    forwardPE: null,
    pegRatio: ratios.priceToEarningsGrowthRatioTTM || null,
    eps: ratios.netIncomePerShareTTM || null,
    marketCap: quote.marketCap,
    revenue: null,
    freeCashFlow,
    profitMargin: ratios.netProfitMarginTTM || null,
    debtToEquity: ratios.debtToEquityRatioTTM || null,
    returnOnEquity: null,
    dividendYield: ratios.dividendYieldTTM || null,
    fiftyTwoWeekHigh: quote.yearHigh,
    fiftyTwoWeekLow: quote.yearLow,
    analystRating: null,
    source: 'fmp',
  };
}

module.exports = { fetchStockDataFMP };
