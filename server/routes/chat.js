const express = require('express');
const Anthropic = require('@anthropic-ai/sdk');
const { buildUserContext } = require('../services/userContext');

const router = express.Router();

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `You are Atlas, a finance assistant. Answer in 1-3 sentences. Use plain English anyone can understand. No disclaimers. No jargon. Just give the answer with real numbers when possible.

You know the app features: Portfolio (track stocks), Markets (watchlist, screener, stock analyzer), Budget (track spending, import CSV), and Analytics (portfolio stats, net worth).`;

// Built-in knowledge base for when API is unavailable
const KNOWLEDGE = [
  { patterns: ['intrinsic value', 'iv ', 'intrinsic worth'], answer: 'Intrinsic value is what a stock is actually worth based on its cash flows. Atlas calculates it and applies a 30% safety buffer — so the "Buy Below" price is 30% less than the estimated value. Check it in Markets > Analyzer.' },
  { patterns: ['dcf', 'discounted cash flow'], answer: 'DCF estimates what a company\'s future cash is worth today. If the DCF value is higher than the stock price, it might be a deal.' },
  { patterns: ['margin of safety', 'mos', 'buy below'], answer: 'Margin of Safety is a 30% discount buffer. If a stock\'s value is $100, the Buy Below price is $70 — so you only buy when it\'s well under the estimated value.' },
  { patterns: ['p/e', 'pe ratio', 'price to earnings', 'price-to-earnings'], answer: 'P/E tells you how many years of earnings you\'re paying for. P/E of 20 = you\'re paying 20x what the company earns per year. Lower can mean cheaper, but compare within the same industry.' },
  { patterns: ['p/b', 'pb ratio', 'price to book', 'price-to-book'], answer: 'P/B compares stock price to what the company owns minus what it owes. Below 1 could mean it\'s cheap. Above 1 means you\'re paying a premium.' },
  { patterns: ['roe', 'return on equity'], answer: 'ROE shows how well a company turns money into profit. Above 15% is generally good.' },
  { patterns: ['peg', 'peg ratio', 'price earnings growth'], answer: 'PEG adjusts P/E for growth. Below 1 = potentially cheap for its growth rate. Above 1 = possibly expensive.' },
  { patterns: ['debt to equity', 'debt/equity', 'd/e'], answer: 'Debt-to-Equity shows how much the company borrows vs what it owns. Below 1.5 is usually healthy.' },
  { patterns: ['free cash flow', 'fcf'], answer: 'Free Cash Flow is the cash left after paying bills and investing in the business. More is better.' },
  { patterns: ['portfolio', 'holdings', 'add stock', 'my stocks'], answer: 'Go to Portfolio, enter a ticker and number of shares. It shows your cost, current value, and gain/loss.' },
  { patterns: ['analytics', 'charts', 'graphs', 'pie chart', 'performance'], answer: 'Analytics shows your portfolio breakdown, performance over time, and net worth.' },
  { patterns: ['screener', 'screen stocks', 'find stocks', 'filter'], answer: 'Screener is in Markets. It shows a table of stocks with key numbers. Click any column to sort.' },
  { patterns: ['analyzer', 'analyze', 'deep dive', 'stock analysis'], answer: 'Analyzer is in Markets. Enter a ticker to see financials and whether the stock looks cheap or expensive.' },
  { patterns: ['budget', 'spending', 'transactions', 'expenses'], answer: 'Budget lets you import transactions via CSV. It auto-categorizes your spending and shows monthly totals.' },
  { patterns: ['watchlist', 'watch list', 'track stocks'], answer: 'Watchlist is in Markets. Add tickers to track prices, daily changes, and key stats.' },
  { patterns: ['overvalued', 'undervalued', 'fairly valued', 'verdict'], answer: 'UNDERVALUED = price is below the Buy Below target. FAIRLY VALUED = price is close to estimated value. OVERVALUED = price is above estimated value.' },
  { patterns: ['owner earnings'], answer: 'Owner Earnings = Net Income + Depreciation - Capital Expenses. It shows the real cash a business makes for its owners.' },
  { patterns: ['s&p', 'sp500', 's&p 500', 'benchmark', 'index'], answer: 'The S&P 500 tracks the 500 biggest US companies. Atlas compares your portfolio performance against it.' },
  { patterns: ['net worth'], answer: 'Net Worth = Portfolio Value + Other Assets - Debts. Add your assets and debts in the Net Worth section.' },
  { patterns: ['hello', 'hi ', 'hey', 'howdy', 'what can you do', 'help'], answer: 'Hey! Ask me anything about the app or your finances. I\'ll keep it simple.' },
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
  budget: 'You are Atlas, a budget assistant. Keep answers to 1-3 sentences. Use real numbers. No disclaimers. Focus on spending, saving, and budget goals.',
  portfolio: 'You are Atlas, a portfolio assistant. Keep answers to 1-3 sentences. Use real numbers. No disclaimers. Focus on stocks, diversification, and gains/losses.',
  analytics: 'You are Atlas, an analytics assistant. Keep answers to 1-3 sentences. Use real numbers. No disclaimers. Focus on portfolio performance and net worth.',
};

// POST /api/chat
router.post('/', async (req, res) => {
  try {
    const { message, history, context } = req.body;
    if (!message) return res.status(400).json({ success: false, error: 'Message is required' });

    // Build personalized context from user's real financial data
    let userFinancialContext = '';
    try {
      userFinancialContext = buildUserContext(req.userId);
    } catch {}

    let systemPrompt = context && CONTEXT_PROMPTS[context]
      ? CONTEXT_PROMPTS[context]
      : SYSTEM_PROMPT;

    if (userFinancialContext && userFinancialContext !== 'This user has not added any financial data yet.') {
      systemPrompt += `\n\nHere is this user's actual financial data — reference it when giving advice:\n${userFinancialContext}`;
    }

    // Build conversation history for context
    const messages = [];
    if (history && Array.isArray(history)) {
      for (const msg of history.slice(-10)) {
        messages.push({ role: msg.role === 'user' ? 'user' : 'assistant', content: msg.text });
      }
    }
    messages.push({ role: 'user', content: message });

    const result = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      system: systemPrompt,
      messages,
    });

    const reply = result.content[0].text;
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
