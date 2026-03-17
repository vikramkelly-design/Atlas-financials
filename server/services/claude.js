const { GoogleGenerativeAI } = require('@google/generative-ai');
const db = require('../db');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

function getCachedInsight(type, ticker, month) {
  const row = db.prepare(`
    SELECT content, created_at FROM ai_insights
    WHERE type = ? AND (ticker = ? OR ticker IS NULL) AND (month = ? OR month IS NULL)
    ORDER BY created_at DESC LIMIT 1
  `).get(type, ticker || null, month || null);

  if (row) {
    const createdAt = new Date(row.created_at + 'Z');
    const now = new Date();
    const hoursDiff = (now - createdAt) / (1000 * 60 * 60);
    if (hoursDiff < 24) return row.content;
  }
  return null;
}

function saveInsight(type, content, ticker, month) {
  db.prepare(`
    INSERT INTO ai_insights (type, ticker, month, content) VALUES (?, ?, ?, ?)
  `).run(type, ticker || null, month || null, content);
}

async function callAI(systemPrompt, userPrompt) {
  const result = await model.generateContent({
    contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
    systemInstruction: { parts: [{ text: systemPrompt }] },
  });
  return result.response.text();
}

async function categorizeTransactions(transactions) {
  const batches = [];
  for (let i = 0; i < transactions.length; i += 50) {
    batches.push(transactions.slice(i, i + 50));
  }

  const results = [];
  for (const batch of batches) {
    const items = batch.map((t, idx) => ({ id: idx, description: t.description, amount: t.amount }));
    const systemPrompt = 'You are a financial transaction categorizer. Categorize each transaction into exactly one of these categories: Food & Dining, Transport, Shopping, Subscriptions, Health, Entertainment, Income, Transfer, Other. Return ONLY a JSON array of objects with "id" and "category" fields. No explanation, no markdown.';
    const userPrompt = `Categorize these transactions: ${JSON.stringify(items)}`;

    try {
      const response = await callAI(systemPrompt, userPrompt);
      const cleaned = response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const categories = JSON.parse(cleaned);
      categories.forEach(cat => {
        if (batch[cat.id]) {
          batch[cat.id].category = cat.category;
        }
      });
    } catch (err) {
      console.error('AI categorization error:', err.message);
    }
    results.push(...batch);
  }
  return results;
}

async function generateBudgetSummary(month, spendingData) {
  const cached = getCachedInsight('budget', null, month);
  if (cached) return cached;

  const systemPrompt = 'You are a personal finance assistant. Write clear, plain-English summaries of spending data. Be specific about numbers. Never give tax advice. Always be encouraging and non-judgmental. Keep responses to 3-4 sentences.';
  const userPrompt = `Here is the spending data for ${month}: ${JSON.stringify(spendingData)}. Write a plain-English summary of this month's finances.`;

  const content = await callAI(systemPrompt, userPrompt);
  saveInsight('budget', content, null, month);
  return content;
}

async function generatePortfolioAnalysis(positions) {
  const cached = getCachedInsight('portfolio', null, null);
  if (cached) return cached;

  const systemPrompt = 'You are a friendly financial educator who explains things in simple, everyday language that anyone can understand — no jargon. Write 2 to 5 sentences. Cover: (1) what sectors/industries the portfolio is invested in and roughly what percentage each sector makes up, (2) any risks like being too concentrated in one area, and (3) potential upsides or strengths of the portfolio mix. End with: "This is for informational purposes only and is not financial advice."';
  const userPrompt = `Here is a portfolio with the following holdings. Each entry has a ticker, number of shares, current dollar value, the sector it belongs to, and its weight (percentage of the total portfolio):\n\n${JSON.stringify(positions, null, 2)}\n\nGive a simple, plain-English overview of this portfolio.`;

  const content = await callAI(systemPrompt, userPrompt);
  saveInsight('portfolio', content, null, null);
  return content;
}

async function generateMarketDigest(ticker, companyName, price, changePercent) {
  const cached = getCachedInsight('market_digest', ticker, null);
  if (cached) return cached;

  const systemPrompt = 'You are a financial data summarizer. Write exactly one sentence summarizing a stock\'s recent context. Be factual and neutral. Never recommend buying or selling. No disclaimers needed for single-sentence digests.';
  const userPrompt = `Write one sentence about ${ticker} (${companyName}). Current price: $${price}, day change: ${changePercent}%.`;

  const content = await callAI(systemPrompt, userPrompt);
  saveInsight('market_digest', content, ticker, null);
  return content;
}

async function generateCompanyExplainer(ticker, companyName, sector, description) {
  const cached = getCachedInsight('market_explain', ticker, null);
  if (cached) return cached;

  const systemPrompt = 'You are a financial educator. Explain companies in plain English that anyone can understand. Focus on what the company does and how it makes money. Keep responses to 3 sentences maximum. End with: "This is for informational purposes only."';
  const userPrompt = `Explain what ${ticker} (${companyName}) does and how it generates revenue. Sector: ${sector}. Description: ${description}.`;

  const content = await callAI(systemPrompt, userPrompt);
  saveInsight('market_explain', content, ticker, null);
  return content;
}

async function generateSpendingAnalysis(transactions, budgetGoals = {}) {
  const totalSpent = transactions.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);
  const totalIncome = transactions.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0);
  const byCategory = {};
  transactions.filter(t => t.amount < 0).forEach(t => {
    const cat = t.category || 'Other';
    byCategory[cat] = (byCategory[cat] || 0) + Math.abs(t.amount);
  });
  const topMerchants = {};
  transactions.filter(t => t.amount < 0).forEach(t => {
    const desc = t.description?.substring(0, 40) || 'Unknown';
    topMerchants[desc] = (topMerchants[desc] || 0) + Math.abs(t.amount);
  });
  const top5Merchants = Object.entries(topMerchants).sort((a, b) => b[1] - a[1]).slice(0, 5);

  // Cross-reference with budget goals
  const budgetComparison = {};
  Object.entries(byCategory).forEach(([cat, spent]) => {
    const limit = budgetGoals[cat];
    if (limit && limit > 0) {
      budgetComparison[cat] = {
        spent: spent.toFixed(2),
        limit: limit.toFixed(2),
        over: spent > limit,
        overBy: spent > limit ? (spent - limit).toFixed(2) : '0.00',
        percentOfLimit: ((spent / limit) * 100).toFixed(1),
      };
    }
  });

  const data = {
    transactionCount: transactions.length,
    totalSpent: totalSpent.toFixed(2),
    totalIncome: totalIncome.toFixed(2),
    savingsRate: totalIncome > 0 ? ((1 - totalSpent / totalIncome) * 100).toFixed(1) : 'N/A',
    byCategory,
    budgetGoals: Object.keys(budgetGoals).length > 0 ? budgetGoals : 'No budget goals set',
    budgetComparison: Object.keys(budgetComparison).length > 0 ? budgetComparison : 'No budget goals to compare against',
    top5Merchants: top5Merchants.map(([name, amt]) => ({ name, amount: amt.toFixed(2) })),
    dateRange: {
      from: transactions.map(t => t.date).filter(Boolean).sort()[0] || 'unknown',
      to: transactions.map(t => t.date).filter(Boolean).sort().pop() || 'unknown',
    }
  };

  const hasBudgetGoals = Object.keys(budgetGoals).length > 0;

  const systemPrompt = `You are a brutally honest personal finance analyst. You do NOT sugarcoat anything. You tell people exactly where they are failing with their money — no hand-holding, no "great job" unless they genuinely earned it. Think of yourself as the tough-love financial advisor who says what nobody else will.

Your job is to analyze spending data${hasBudgetGoals ? ' and cross-reference it against the user\'s own budget goals they set for themselves' : ''}, then call out every problem you see.

Structure your response with these exact section headers using markdown:

## The Hard Truth
A 2-3 sentence brutally honest summary. If they're overspending, say it plainly. If their savings rate is bad, don't dance around it. If they set budget goals and blew past them, call that out immediately.
${hasBudgetGoals ? `
## Budget Goal Report Card
Go through EVERY budget goal they set and grade them. For each category where they set a limit, state: the limit they set, what they actually spent, and whether they passed or failed. If they went over, tell them exactly how much over and what percentage over. If they have no budget goals set for a category where they spent heavily, call that out too — they're spending blindly.
` : ''}
## Where Your Money Is Actually Going
Break down each spending category with exact dollar amounts and percentages. Highlight any category that seems disproportionately high. If someone is spending 40% of their income on dining out, say "that's a problem" — don't call it "an area for potential optimization."

## Your Worst Habits
Identify the top merchants and recurring charges. Point out patterns that indicate wasteful spending — frequent food delivery, subscription stacking, impulse purchases. Be specific about dollar amounts.

## What You Need To Hear
4-5 bullet points of hard truths. Examples:
- If savings rate is under 20%, tell them they're not building wealth
- If they blew their budget in a category, tell them their budget is meaningless if they don't follow it
- If they have high discretionary spending, tell them exactly what they're sacrificing long-term
- If they have no budget goals set, tell them they're flying blind

## What To Do Right Now
4-5 specific, concrete actions — not vague advice. Give exact dollar amounts to cut. Name the specific merchants or categories to reduce. If they consistently fail a budget goal, tell them to either fix their spending or set a realistic goal instead of lying to themselves.

Be direct, be specific, use their actual numbers. No filler, no pleasantries. But be constructive — the goal is to help them improve, not just roast them. End with: "This analysis is for informational purposes only and is not financial advice."`;

  const userPrompt = `Analyze this spending data and don't hold back:\n${JSON.stringify(data, null, 2)}`;

  try {
    return await callAI(systemPrompt, userPrompt);
  } catch (err) {
    console.error('AI spending analysis error:', err.message);
    // Fallback analysis — still brutally honest
    const cats = Object.entries(byCategory).sort((a, b) => b[1] - a[1]);
    const topCat = cats[0] || ['None', 0];
    const savingsRate = totalIncome > 0 ? ((1 - totalSpent / totalIncome) * 100).toFixed(1) : 'N/A';

    let budgetReport = '';
    if (hasBudgetGoals) {
      const lines = Object.entries(budgetComparison).map(([cat, info]) => {
        if (info.over) {
          return `- **${cat}**: OVER BUDGET. You set $${info.limit}, you spent $${info.spent} — that's $${info.overBy} over (${info.percentOfLimit}% of your limit). You failed your own goal.`;
        }
        return `- **${cat}**: Under budget. You set $${info.limit}, you spent $${info.spent} (${info.percentOfLimit}%). At least you held the line here.`;
      });
      const uncovered = cats.filter(([cat]) => !budgetGoals[cat] && cat !== 'Income' && cat !== 'Transfer');
      if (uncovered.length > 0) {
        lines.push(`- **No budget set for**: ${uncovered.map(([c, a]) => `${c} ($${a.toFixed(2)})`).join(', ')} — you're spending blindly in these categories.`);
      }
      budgetReport = `\n\n## Budget Goal Report Card\n${lines.join('\n')}`;
    }

    return `## The Hard Truth
You had ${transactions.length} transactions totaling **$${totalSpent.toFixed(2)}** in spending against **$${totalIncome.toFixed(2)}** in income.${savingsRate !== 'N/A' ? ` Your savings rate is **${savingsRate}%**${parseFloat(savingsRate) < 20 ? ' — that is not enough to build any real wealth. The recommended minimum is 20% and you are not hitting it.' : '.'}` : ''} ${!hasBudgetGoals ? 'You have no budget goals set, which means you are spending with zero accountability.' : ''}
${budgetReport}

## Where Your Money Is Actually Going
${cats.map(([cat, amt]) => `- **${cat}**: $${amt.toFixed(2)} (${totalSpent > 0 ? ((amt / totalSpent) * 100).toFixed(1) : 0}% of total spending)`).join('\n')}

## Your Worst Habits
${top5Merchants.map(([name, amt]) => `- **${name}**: $${amt.toFixed(2)}`).join('\n')}
Your top merchant alone accounts for $${top5Merchants.length > 0 ? top5Merchants[0][1].toFixed(2) : '0'} — that is real money being drained.

## What You Need To Hear
- Your largest spending category is **${topCat[0]}** at $${topCat[1].toFixed(2)} — ${totalSpent > 0 && topCat[1] / totalSpent > 0.3 ? 'that is over 30% of your spending in one category, which is a red flag' : 'keep an eye on this'}
${cats.length > 1 ? `- Your top two categories eat up ${totalSpent > 0 ? (((cats[0][1] + cats[1][1]) / totalSpent) * 100).toFixed(0) : 0}% of all your spending` : ''}
${savingsRate !== 'N/A' && parseFloat(savingsRate) < 20 ? '- At your current savings rate, you are falling behind on building any meaningful financial cushion' : ''}
${!hasBudgetGoals ? '- You have zero budget goals set. That means you have zero spending discipline. Set limits or keep wondering where your money went.' : ''}
- Every dollar you spend without tracking it is a dollar you chose not to invest in your future

## What To Do Right Now
- ${hasBudgetGoals ? 'Actually follow the budget goals you set — they are meaningless if you ignore them' : 'Set budget limits for every category immediately using the Budget Goals section below'}
- Cut your **${topCat[0]}** spending by at least 15% next month — that saves you $${(topCat[1] * 0.15).toFixed(2)}
- Review every subscription and cancel anything you have not used in the last 30 days
- Track your spending weekly, not monthly — by the time you see a monthly report the damage is done

This analysis is for informational purposes only and is not financial advice.`;
  }
}

module.exports = {
  categorizeTransactions,
  generateBudgetSummary,
  generatePortfolioAnalysis,
  generateMarketDigest,
  generateCompanyExplainer,
  generateSpendingAnalysis
};
