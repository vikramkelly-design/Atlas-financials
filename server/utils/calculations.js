/**
 * Intrinsic Value Calculations
 * Method 1: Owner Earnings (Buffett)
 * Method 2: DCF (Discounted Cash Flow)
 */

function calculateOwnerEarningsIV({ netIncome, da, capex, growthRate, discountRate }) {
  const ownerEarnings = netIncome + da - capex;
  const spread = discountRate - growthRate;
  if (spread <= 0) {
    return { iv: null, ownerEarnings, error: 'Cannot calculate — growth exceeds discount rate' };
  }
  const iv = ownerEarnings / spread;
  return { iv, ownerEarnings, error: null };
}

function calculateDCFIV({ freeCashFlow, growthRate, discountRate, sharesOutstanding }) {
  if (!freeCashFlow || freeCashFlow <= 0) {
    return { iv: null, projectedFCFs: [], terminalValue: null, error: 'Free Cash Flow must be positive for DCF' };
  }
  if (!sharesOutstanding || sharesOutstanding <= 0) {
    return { iv: null, projectedFCFs: [], terminalValue: null, error: 'Shares outstanding unavailable' };
  }

  const terminalGrowthRate = 0.03;
  const projectedFCFs = [];
  let sumDiscountedFCF = 0;
  let currentFCF = freeCashFlow;

  for (let year = 1; year <= 10; year++) {
    currentFCF = currentFCF * (1 + growthRate);
    const discountedFCF = currentFCF / Math.pow(1 + discountRate, year);
    projectedFCFs.push({ year, fcf: currentFCF, discountedFCF });
    sumDiscountedFCF += discountedFCF;
  }

  const year10FCF = projectedFCFs[9].fcf;
  const terminalValue = (year10FCF * (1 + terminalGrowthRate)) / (discountRate - terminalGrowthRate);
  const discountedTerminalValue = terminalValue / Math.pow(1 + discountRate, 10);

  const totalIV = (sumDiscountedFCF + discountedTerminalValue) / sharesOutstanding;

  return {
    iv: totalIV,
    projectedFCFs,
    terminalValue,
    discountedTerminalValue,
    sumDiscountedFCF,
    sharesOutstanding,
    error: null
  };
}

function calculateIntrinsicSummary({
  netIncome, da, capex, freeCashFlow,
  sharesOutstanding, growthRateRaw, discountRate, currentPrice
}) {
  const growthRate = Math.min(growthRateRaw || 0.03, 0.15);

  const oeResult = calculateOwnerEarningsIV({ netIncome, da, capex, growthRate, discountRate });
  const dcfResult = calculateDCFIV({ freeCashFlow, growthRate, discountRate, sharesOutstanding });

  let oeIVPerShare = null;
  if (oeResult.iv !== null && sharesOutstanding > 0) {
    oeIVPerShare = oeResult.iv / sharesOutstanding;
  }

  const dcfIVPerShare = dcfResult.iv;

  const validValues = [oeIVPerShare, dcfIVPerShare].filter(v => v !== null && v > 0);
  let rawIV = null;
  let mosPrice = null;
  let verdict = 'N/A';

  if (validValues.length > 0) {
    rawIV = validValues.reduce((a, b) => a + b, 0) / validValues.length;
    mosPrice = rawIV * 0.70;

    if (currentPrice <= mosPrice) {
      verdict = 'UNDERVALUED';
    } else if (currentPrice <= mosPrice * 1.10) {
      verdict = 'FAIRLY VALUED';
    } else {
      verdict = 'OVERVALUED';
    }
  }

  return {
    ownerEarnings: {
      netIncome,
      da,
      capex,
      ownerEarnings: oeResult.ownerEarnings,
      iv: oeIVPerShare,
      error: oeResult.error
    },
    dcf: {
      freeCashFlow,
      projectedFCFs: dcfResult.projectedFCFs,
      terminalValue: dcfResult.terminalValue,
      discountedTerminalValue: dcfResult.discountedTerminalValue,
      iv: dcfIVPerShare,
      error: dcfResult.error
    },
    summary: {
      growthRate,
      discountRate,
      rawIV,
      mosPrice,
      currentPrice,
      verdict
    }
  };
}

module.exports = { calculateOwnerEarningsIV, calculateDCFIV, calculateIntrinsicSummary };
