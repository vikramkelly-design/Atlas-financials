let yahooFinance = null;

async function getYF() {
  if (!yahooFinance) {
    const YahooFinance = (await import('yahoo-finance2')).default;
    yahooFinance = new YahooFinance();
    try { yahooFinance.suppressNotices(['yahooSurvey']); } catch (_) {}
  }
  return yahooFinance;
}

module.exports = { getYF };
