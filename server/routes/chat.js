const express = require('express');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const router = express.Router();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

const SYSTEM_PROMPT = `You are the Atlas assistant, an AI chatbot built into the Atlas personal finance app. You help users understand their finances, the app's features, and financial concepts. Keep answers concise (2-4 sentences unless more detail is asked for). Be friendly and use plain language.

You know about these app features:
- **Portfolio**: Users add stocks (ticker + shares). Shows cost basis, market value, gain/loss, weight. Includes AI-generated portfolio analysis covering sectors, allocation, risks, and potential.
- **Analytics**: Charts page with holdings allocation pie chart, portfolio performance vs S&P 500 line chart (1D/1W/1M/1Y), portfolio value over time area chart, and net worth breakdown.
- **Markets**: Three tabs — Watchlist (tracked stocks), Screener (sortable table of stocks with metrics like P/E, P/B, ROE, debt-to-equity, etc.), and Analyzer (deep-dive on a single stock with intrinsic value calculation).
- **Budget**: Transaction tracking, CSV import, AI-categorized spending, monthly summaries.
- **Intrinsic Value Calculator**: Uses Owner Earnings + Discounted Cash Flow (DCF) model with a 30% Margin of Safety. Shows whether a stock is UNDERVALUED, FAIRLY VALUED, or OVERVALUED relative to its calculated intrinsic value. The "Buy Below" price = intrinsic value * 0.7.
- **Screener Metrics**: P/E ratio (price/EPS), P/B (price/book), PEG (PE/growth), ROE (net income/equity), Debt/Equity, Profit Margin, Free Cash Flow, Revenue Growth, Dividend Yield, Current Ratio, Analyst Target.

When explaining metrics:
- P/E Ratio: How many years of earnings you're paying for. Lower can mean cheaper, but compare within the same industry.
- Intrinsic Value: What a stock is actually worth based on its cash flows, not just market sentiment.
- Margin of Safety: A 30% discount buffer so you only buy when the price is well below estimated value.
- DCF: Projects future cash flows and discounts them back to today's value using a required rate of return.

Always end financial explanations with: "This is for informational purposes only and is not financial advice."
Do not make specific buy/sell recommendations.`;

// Built-in knowledge base for when API is unavailable
const KNOWLEDGE = [
  { patterns: ['intrinsic value', 'iv ', 'intrinsic worth'], answer: 'Intrinsic value is what a stock is truly worth based on its fundamentals, not just what the market is charging. In Atlas, we calculate it using Owner Earnings (free cash flow adjusted for maintenance costs) and a Discounted Cash Flow (DCF) model. We then apply a 30% Margin of Safety — meaning the "Buy Below" price is 30% less than the calculated intrinsic value, giving you a buffer in case our estimates are off. You can find this in the Markets page under the Analyzer tab. This is for informational purposes only and is not financial advice.' },
  { patterns: ['dcf', 'discounted cash flow'], answer: 'DCF (Discounted Cash Flow) is a method that estimates what a company\'s future cash flows are worth in today\'s dollars. It projects how much cash a business will generate over time, then "discounts" those future amounts back to the present using a required rate of return (typically 10-15%). If the DCF value is higher than the current stock price, the stock may be undervalued. Atlas uses DCF as part of its intrinsic value calculation in the Analyzer. This is for informational purposes only and is not financial advice.' },
  { patterns: ['margin of safety', 'mos', 'buy below'], answer: 'The Margin of Safety is a concept from value investing (popularized by Benjamin Graham and Warren Buffett). Atlas applies a 30% margin of safety to the calculated intrinsic value. So if a stock\'s intrinsic value is $100, the "Buy Below" price would be $70. This buffer protects you if the valuation estimates are too optimistic. This is for informational purposes only and is not financial advice.' },
  { patterns: ['p/e', 'pe ratio', 'price to earnings', 'price-to-earnings'], answer: 'The P/E (Price-to-Earnings) ratio tells you how many years of current earnings you\'re paying for when you buy a stock. A P/E of 20 means the stock costs 20x its annual earnings. Lower P/E can indicate a cheaper stock, but always compare within the same industry — tech stocks typically have higher P/E than utilities. You can sort by P/E in the Screener tab on the Markets page. This is for informational purposes only and is not financial advice.' },
  { patterns: ['p/b', 'pb ratio', 'price to book', 'price-to-book'], answer: 'The P/B (Price-to-Book) ratio compares a stock\'s market price to its book value (assets minus liabilities per share). A P/B below 1 might mean the stock is trading for less than its net assets — potentially a bargain, or a sign of underlying problems. It\'s most useful for asset-heavy companies like banks. You can find it in the Screener. This is for informational purposes only and is not financial advice.' },
  { patterns: ['roe', 'return on equity'], answer: 'ROE (Return on Equity) measures how efficiently a company turns shareholders\' money into profits. It\'s calculated as net income divided by shareholders\' equity. An ROE above 15-20% is generally considered strong. However, very high ROE could also indicate high debt levels, so check debt-to-equity alongside it. This is for informational purposes only and is not financial advice.' },
  { patterns: ['peg', 'peg ratio', 'price earnings growth'], answer: 'The PEG ratio adjusts the P/E ratio by factoring in expected earnings growth. It\'s calculated as P/E divided by the earnings growth rate. A PEG below 1 suggests the stock may be undervalued relative to its growth, while above 1 could mean it\'s overpriced for its growth rate. It\'s a great way to compare growth stocks. This is for informational purposes only and is not financial advice.' },
  { patterns: ['debt to equity', 'debt/equity', 'd/e'], answer: 'Debt-to-Equity ratio shows how much debt a company uses compared to shareholder equity. A ratio of 1 means equal debt and equity. Higher values mean more leverage, which amplifies both gains and losses. Generally, below 1.5 is considered healthy, but this varies by industry — utilities and real estate often carry more debt. This is for informational purposes only and is not financial advice.' },
  { patterns: ['free cash flow', 'fcf'], answer: 'Free Cash Flow (FCF) is the cash a company generates after paying for operations and capital expenditures. It represents the money available for dividends, debt repayment, buybacks, or reinvestment. Positive and growing FCF is a strong sign of financial health. Atlas shows FCF in the Screener and uses it in the intrinsic value calculation. This is for informational purposes only and is not financial advice.' },
  { patterns: ['portfolio', 'holdings', 'add stock', 'my stocks'], answer: 'The Portfolio page lets you track your stock holdings. Add stocks by entering a ticker symbol, number of shares, and optionally your average cost (it auto-fetches the current price if you leave it blank). You\'ll see your cost basis, current market value, gain/loss, and each stock\'s weight in your portfolio. You can also generate an AI analysis that covers your sector allocation, risks, and potential.' },
  { patterns: ['analytics', 'charts', 'graphs', 'pie chart', 'performance'], answer: 'The Analytics page has your portfolio visualizations: a pie chart showing your holdings allocation, a line chart comparing your portfolio performance vs the S&P 500 (with 1D/1W/1M/1Y toggles), a portfolio value area chart over time, and a net worth breakdown card. Hover over the line charts to see exact values at any point.' },
  { patterns: ['screener', 'screen stocks', 'find stocks', 'filter'], answer: 'The Screener (in Markets > Screener tab) shows a sortable table of stocks with key metrics: P/E, P/B, PEG, ROE, Debt/Equity, Profit Margin, Free Cash Flow, Revenue Growth, Dividend Yield, Current Ratio, and Analyst Target. Click any column header to sort, and click the ? button next to each metric for an explanation of how it\'s calculated.' },
  { patterns: ['analyzer', 'analyze', 'deep dive', 'stock analysis'], answer: 'The Analyzer (in Markets > Analyzer tab) lets you do a deep-dive on any stock. Enter a ticker and it pulls up detailed financials, analyst ratings, and runs an intrinsic value calculation using DCF + Owner Earnings with a 30% Margin of Safety. It tells you whether the stock appears UNDERVALUED, FAIRLY VALUED, or OVERVALUED.' },
  { patterns: ['budget', 'spending', 'transactions', 'expenses'], answer: 'The Budget page helps you track spending. You can import transactions via CSV upload, and the AI will automatically categorize them (Food & Dining, Transport, Shopping, etc.). It shows monthly spending breakdowns, category totals, and you can set budget goals per category to track your progress.' },
  { patterns: ['watchlist', 'watch list', 'track stocks'], answer: 'The Watchlist (in Markets > Watchlist tab) lets you track stocks you\'re interested in. Add tickers and it shows real-time prices, day change, 52-week range, market cap, and volume. You can also get AI-generated one-sentence digests about each stock.' },
  { patterns: ['overvalued', 'undervalued', 'fairly valued', 'verdict'], answer: 'Atlas\'s valuation verdict compares a stock\'s current price to its calculated intrinsic value (using DCF + Owner Earnings). UNDERVALUED means the price is below the "Buy Below" price (intrinsic value minus 30% margin of safety). FAIRLY VALUED means it\'s between the Buy Below and intrinsic value. OVERVALUED means the market price exceeds the calculated intrinsic value. This is for informational purposes only and is not financial advice.' },
  { patterns: ['owner earnings'], answer: 'Owner Earnings is a concept from Warren Buffett. It\'s calculated as: Net Income + Depreciation/Amortization - Capital Expenditures. This gives a more accurate picture of how much cash a business truly generates for its owners compared to standard earnings metrics. Atlas uses Owner Earnings as the base for its DCF intrinsic value calculation. This is for informational purposes only and is not financial advice.' },
  { patterns: ['s&p', 'sp500', 's&p 500', 'benchmark', 'index'], answer: 'The S&P 500 is an index of the 500 largest U.S. companies by market cap. In Atlas\'s Analytics page, your portfolio performance is plotted against the S&P 500 so you can see if you\'re beating or trailing the overall market. Both lines are normalized to percentage return from the start date for fair comparison.' },
  { patterns: ['net worth'], answer: 'The Net Worth card on the Analytics page combines your portfolio value with any other assets and liabilities you\'ve entered. Net Worth = Portfolio Value + Other Assets - Liabilities. You can add assets and liabilities in the Net Worth section to get a complete picture of your financial standing.' },
  { patterns: ['hello', 'hi ', 'hey', 'howdy', 'what can you do', 'help'], answer: 'Hey there! I can help you understand any part of the Atlas app. Ask me about intrinsic value, how the screener metrics work (P/E, PEG, ROE, etc.), how to read your portfolio charts, what the valuation verdicts mean, or anything about your finances. What would you like to know?' },
];

function findFallbackAnswer(message) {
  const lower = message.toLowerCase();
  for (const entry of KNOWLEDGE) {
    if (entry.patterns.some(p => lower.includes(p))) {
      return entry.answer;
    }
  }
  return null;
}

const CONTEXT_PROMPTS = {
  budget: `You are a brutally honest budget and spending coach inside the Atlas finance app. The user is on the Budget page. Focus ONLY on budget-related topics: spending patterns, saving strategies, budget goals, transaction categories, cutting expenses, building emergency funds, debt payoff strategies. Be direct and specific with advice. If the user's habits are bad, tell them plainly. Give concrete dollar amounts and percentages when possible. Always end financial advice with: "This is for informational purposes only and is not financial advice."`,
  portfolio: `You are a knowledgeable investment analyst inside the Atlas finance app. The user is on the Portfolio page. Focus ONLY on portfolio-related topics: stock analysis, diversification, risk management, sector allocation, position sizing, cost basis, gain/loss analysis, valuation metrics, rebalancing strategies. Be direct and educational. Explain concepts simply but don't oversimplify. Always end financial explanations with: "This is for informational purposes only and is not financial advice."`,
  analytics: `You are a data-driven financial analyst inside the Atlas finance app. The user is on the Analytics page. Focus ONLY on analytics topics: interpreting performance charts, understanding portfolio returns vs S&P 500 benchmark, pie chart allocation analysis, net worth trends, time-weighted returns, volatility, drawdowns, correlation. Help users understand what their charts and data are telling them. Be precise with numbers. Always end with: "This is for informational purposes only and is not financial advice."`,
};

// POST /api/chat
router.post('/', async (req, res) => {
  try {
    const { message, history, context } = req.body;
    if (!message) return res.status(400).json({ success: false, error: 'Message is required' });

    const systemPrompt = context && CONTEXT_PROMPTS[context]
      ? CONTEXT_PROMPTS[context]
      : SYSTEM_PROMPT;

    // Build conversation history for context
    const contents = [];
    if (history && Array.isArray(history)) {
      for (const msg of history.slice(-10)) {
        contents.push({ role: msg.role === 'user' ? 'user' : 'model', parts: [{ text: msg.text }] });
      }
    }
    contents.push({ role: 'user', parts: [{ text: message }] });

    const result = await model.generateContent({
      contents,
      systemInstruction: { parts: [{ text: systemPrompt }] },
    });

    const reply = result.response.text();
    res.json({ success: true, data: { reply } });
  } catch (err) {
    console.error('[Chat] API error, using fallback:', err.message?.substring(0, 80));
    // Try knowledge base fallback
    const fallback = findFallbackAnswer(req.body.message || '');
    if (fallback) {
      return res.json({ success: true, data: { reply: fallback } });
    }
    res.json({
      success: true,
      data: {
        reply: "I can help you with questions about the app! Try asking about specific topics like \"What is intrinsic value?\", \"How does P/E ratio work?\", \"How do I use the screener?\", or \"What do the portfolio charts show?\" — I have built-in answers for many common questions."
      }
    });
  }
});

module.exports = router;
