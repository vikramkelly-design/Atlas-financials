const Anthropic = require('@anthropic-ai/sdk');
const db = require('../db');

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

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
  const result = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  });
  return result.content[0].text;
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

  const systemPrompt = 'Summarize spending in 2 sentences max. Use plain English, real dollar amounts. No disclaimers.';
  const userPrompt = `Here is the spending data for ${month}: ${JSON.stringify(spendingData)}. Write a plain-English summary of this month's finances.`;

  const content = await callAI(systemPrompt, userPrompt);
  saveInsight('budget', content, null, month);
  return content;
}

async function generatePortfolioAnalysis(positions) {
  const cached = getCachedInsight('portfolio', null, null);
  if (cached) return cached;

  const systemPrompt = 'Give a 2-3 sentence plain English overview of this portfolio. State what sectors they are in with percentages, and one key risk. No disclaimers, no jargon.';
  const userPrompt = `Here is a portfolio with the following holdings. Each entry has a ticker, number of shares, current dollar value, the sector it belongs to, and its weight (percentage of the total portfolio):\n\n${JSON.stringify(positions, null, 2)}\n\nGive a simple, plain-English overview of this portfolio.`;

  const content = await callAI(systemPrompt, userPrompt);
  saveInsight('portfolio', content, null, null);
  return content;
}

async function generateMarketDigest(ticker, companyName, price, changePercent) {
  const cached = getCachedInsight('market_digest', ticker, null);
  if (cached) return cached;

  const systemPrompt = 'Write one short sentence about this stock. Just the facts, no fluff.';
  const userPrompt = `Write one sentence about ${ticker} (${companyName}). Current price: $${price}, day change: ${changePercent}%.`;

  const content = await callAI(systemPrompt, userPrompt);
  saveInsight('market_digest', content, ticker, null);
  return content;
}

async function generateCompanyExplainer(ticker, companyName, sector, description) {
  const cached = getCachedInsight('market_explain', ticker, null);
  if (cached) return cached;

  const systemPrompt = 'Explain what this company does and how it makes money in 1-2 sentences. Plain English, no disclaimers.';
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

  const systemPrompt = `You are a straight-talking money analyst. Be honest and simple. No disclaimers. No fluff. Use real numbers.

Keep it short with these sections:

## Summary
2 sentences. How much they spent, how much they made, savings rate.
${hasBudgetGoals ? `
## Budget Check
List each budget goal: what they set, what they spent, over or under. One line each.
` : ''}
## Spending Breakdown
Each category with dollar amount and percent. Flag anything too high.

## Top Spending
Top 5 places they spend money with amounts.

## 3 Things To Fix
3 specific actions with dollar amounts. Keep each to one sentence.`;

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
