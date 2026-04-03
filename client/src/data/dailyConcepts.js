const dailyConcepts = [
  {
    title: 'Compound Interest',
    short: 'Your money earns returns on its returns, creating exponential growth over time.',
    full: 'Compound interest means you earn interest not just on your original investment, but also on the interest that has already accumulated. Over decades, this creates a snowball effect that dramatically accelerates wealth building. For example, $10,000 invested at 10% annually becomes $67,275 in 20 years without adding a single dollar.'
  },
  {
    title: 'Dollar-Cost Averaging',
    short: 'Investing a fixed amount on a regular schedule regardless of market price.',
    full: 'Dollar-cost averaging removes the pressure of timing the market. By investing the same dollar amount each month, you automatically buy more shares when prices are low and fewer when prices are high. Over time, this tends to lower your average cost per share. For example, investing $500/month into an index fund means you accumulate more shares during dips.'
  },
  {
    title: 'Index Funds',
    short: 'A single investment that tracks an entire market index like the S&P 500.',
    full: 'Index funds hold every stock in a given index, giving you instant diversification at extremely low cost. They consistently outperform the majority of actively managed funds over long periods. Warren Buffett famously bet $1 million that an S&P 500 index fund would beat a basket of hedge funds over 10 years — and won.'
  },
  {
    title: 'Emergency Fund',
    short: 'Cash reserves covering 3-6 months of essential expenses for unexpected events.',
    full: 'An emergency fund prevents you from selling investments at a loss or taking on high-interest debt when life surprises you. Keep it in a high-yield savings account where it earns interest but stays accessible. For example, if your monthly essentials are $2,000, aim for $6,000-$12,000 set aside before investing aggressively.'
  },
  {
    title: 'P/E Ratio',
    short: 'Price-to-Earnings ratio measures how much investors pay per dollar of company profit.',
    full: 'The P/E ratio divides a stock\'s price by its earnings per share. A lower P/E may indicate a stock is undervalued relative to its earnings, while a higher P/E suggests investors expect strong future growth. For example, a stock at $100 with $5 EPS has a P/E of 20, meaning you pay $20 for every $1 of annual earnings.'
  },
  {
    title: 'Diversification',
    short: 'Spreading investments across different assets to reduce the impact of any single loss.',
    full: 'Diversification is the only free lunch in investing. By holding stocks across different sectors, geographies, and asset classes, a drop in one area gets offset by stability or gains in others. For example, holding both tech stocks and utility stocks means a tech crash doesn\'t wipe out your entire portfolio.'
  },
  {
    title: 'Market Capitalization',
    short: 'The total value of a company\'s outstanding shares, indicating its size.',
    full: 'Market cap equals share price multiplied by total shares outstanding. Large-cap companies (over $10B) tend to be more stable, while small-caps (under $2B) offer higher growth potential with more risk. For example, Apple\'s market cap of ~$3 trillion makes it a mega-cap, while a local biotech at $500M is a small-cap.'
  },
  {
    title: 'Expense Ratios',
    short: 'The annual fee a fund charges as a percentage of your investment.',
    full: 'Expense ratios directly eat into your returns every year. A fund charging 1% vs 0.03% on $100,000 costs you $970 more per year — and that compounds over decades into tens of thousands of dollars. Index funds from Vanguard or Fidelity often charge under 0.05%, while actively managed funds may charge 0.5-1.5%.'
  },
  {
    title: 'Intrinsic Value',
    short: 'The calculated true worth of a stock based on its future cash flows.',
    full: 'Intrinsic value estimates what a company is actually worth based on its ability to generate cash, independent of its current market price. When the market price falls below intrinsic value, value investors see a buying opportunity. Atlas calculates this using discounted cash flow analysis — the same method used by professional analysts.'
  },
  {
    title: 'Bull vs Bear Markets',
    short: 'Bull markets rise 20%+ from lows; bear markets fall 20%+ from highs.',
    full: 'Bull markets reflect broad investor optimism and rising prices, while bear markets signal widespread pessimism and declining prices. Historically, bull markets last much longer than bear markets — the average bull runs about 4.4 years vs 11.3 months for bears. The key insight: bear markets are temporary buying opportunities if you can stay patient.'
  },
  {
    title: 'Dividend Yield',
    short: 'The annual dividend payment expressed as a percentage of the stock price.',
    full: 'Dividend yield shows how much cash income a stock generates relative to its price. A $100 stock paying $3 annually has a 3% yield. Dividend-paying stocks provide income even when prices are flat, and reinvesting dividends supercharges compound growth. Companies like Coca-Cola and Johnson & Johnson have increased dividends for 50+ consecutive years.'
  },
  {
    title: 'Tax-Advantaged Accounts',
    short: 'Accounts like 401(k)s and Roth IRAs that reduce the tax drag on your investments.',
    full: 'Tax-advantaged accounts let your money compound faster by sheltering gains from annual taxes. Traditional 401(k) contributions reduce your taxable income now, while Roth IRA withdrawals are tax-free in retirement. For example, $6,500/year in a Roth IRA from age 20 to 60 at 10% growth becomes ~$3.5 million — all tax-free.'
  },
  {
    title: 'Margin of Safety',
    short: 'Buying stocks at a significant discount to their intrinsic value to protect against errors.',
    full: 'The margin of safety concept, popularized by Benjamin Graham, means only buying when the price is well below your estimate of intrinsic value. This buffer protects you if your analysis is slightly wrong. For example, if you calculate a stock\'s intrinsic value at $100, waiting to buy at $70 gives you a 30% margin of safety.'
  },
  {
    title: 'Asset Allocation',
    short: 'How you divide your portfolio between stocks, bonds, cash, and other investments.',
    full: 'Asset allocation is the single biggest driver of long-term portfolio returns. Young investors typically favor stocks (80-90%) for growth, while those approaching retirement shift toward bonds for stability. A common rule of thumb: subtract your age from 110 to get your stock allocation percentage. For example, at age 20, that suggests 90% stocks.'
  },
  {
    title: 'Free Cash Flow',
    short: 'The cash a company generates after paying all operating expenses and capital investments.',
    full: 'Free cash flow (FCF) is the truest measure of a company\'s financial health. Unlike earnings, which can be manipulated by accounting choices, cash flow shows actual money coming in. Companies with strong FCF can pay dividends, buy back shares, reduce debt, or invest in growth. Atlas uses FCF in its DCF valuation model.'
  },
  {
    title: 'Risk Tolerance',
    short: 'Your ability and willingness to endure investment losses for potentially higher returns.',
    full: 'Risk tolerance depends on your time horizon, income stability, and emotional comfort with volatility. A 20-year-old with steady income can afford high risk because they have decades to recover from downturns. The key is matching your portfolio to your actual tolerance — overestimating it leads to panic selling during crashes.'
  },
  {
    title: 'Market Efficiency',
    short: 'The theory that stock prices already reflect all available public information.',
    full: 'The efficient market hypothesis argues that you can\'t consistently beat the market because prices already factor in all known information. While not perfectly true, markets are efficient enough that most professionals fail to outperform index funds. This is why passive investing through index funds is recommended for most investors.'
  },
  {
    title: 'Debt-to-Equity Ratio',
    short: 'Measures how much a company relies on borrowed money versus shareholder investment.',
    full: 'The debt-to-equity ratio divides total liabilities by shareholder equity. A ratio above 2.0 suggests heavy leverage, which amplifies both gains and losses. Companies with low D/E ratios tend to weather recessions better. For example, a tech company with D/E of 0.3 is more financially stable than one at 2.5.'
  },
  {
    title: 'Time in the Market',
    short: 'Staying invested consistently beats trying to time market highs and lows.',
    full: 'Missing just the 10 best market days over a 20-year period can cut your returns in half. These best days often occur right after the worst days, so selling during a crash means missing the recovery. A study of S&P 500 returns from 2003-2022 showed that staying fully invested turned $10,000 into $64,844, while missing the 10 best days yielded only $29,708.'
  },
  {
    title: 'Revenue Growth Rate',
    short: 'The year-over-year percentage increase in a company\'s total sales.',
    full: 'Revenue growth shows whether a company is expanding its business. Consistent double-digit growth signals strong demand and competitive advantage. However, growth must eventually translate into profits. For example, a company growing revenue at 25% annually but burning cash may be less attractive than one growing at 12% with strong margins.'
  },
  {
    title: 'Opportunity Cost',
    short: 'What you give up by choosing one investment or purchase over another.',
    full: 'Every dollar spent is a dollar that can\'t be invested. Opportunity cost helps you evaluate trade-offs. A $5 daily coffee habit costs $1,825/year — invested at 10% annually for 30 years, that\'s over $300,000. This doesn\'t mean never buy coffee, but it helps put discretionary spending in perspective.'
  },
  {
    title: 'Earnings Per Share',
    short: 'A company\'s profit divided by its number of outstanding shares.',
    full: 'EPS tells you how much profit each share of stock represents. Rising EPS over multiple years indicates improving profitability. Watch for "diluted EPS" which accounts for stock options and convertible securities that could increase the share count. For example, a company earning $1B with 500M shares has an EPS of $2.00.'
  },
  {
    title: 'Rebalancing',
    short: 'Periodically adjusting your portfolio back to your target asset allocation.',
    full: 'As different investments grow at different rates, your portfolio drifts from its target allocation. Rebalancing means selling winners and buying laggards to maintain your desired risk level. This disciplined approach forces you to buy low and sell high. Most investors should rebalance once or twice per year.'
  },
  {
    title: 'Gross Margin',
    short: 'The percentage of revenue remaining after subtracting the direct cost of goods sold.',
    full: 'Gross margin reveals how efficiently a company produces its goods or services. Software companies often have 70-80% gross margins since code costs little to reproduce, while retailers might operate at 25-35%. Higher margins mean more room for profit. For example, a company with $1M revenue and $300K cost of goods has a 70% gross margin.'
  },
  {
    title: 'Inflation',
    short: 'The gradual increase in prices that reduces the purchasing power of your money.',
    full: 'At 3% annual inflation, $100 today buys only $74 worth of goods in 10 years. This is why keeping money in a low-interest savings account actually loses value over time. Investing in stocks, which have historically returned 7-10% annually, is one of the best ways to outpace inflation and grow real wealth.'
  },
  {
    title: 'Price-to-Book Ratio',
    short: 'Compares a stock\'s market value to the company\'s net asset value on its books.',
    full: 'P/B ratio divides market price by book value per share (total assets minus total liabilities divided by shares). A P/B under 1.0 means the market values the company at less than its net assets — a potential bargain. Banks and industrial companies are often evaluated by P/B. For example, a stock at $50 with book value of $40 has a P/B of 1.25.'
  },
  {
    title: 'Compounding Frequency',
    short: 'How often your investment returns are reinvested to generate additional returns.',
    full: 'More frequent compounding slightly increases your effective return. Daily compounding produces more than annual compounding on the same rate. This is why reinvesting dividends immediately is better than collecting cash. For example, $10,000 at 8% compounded annually yields $21,589 in 10 years, while daily compounding yields $22,255.'
  },
  {
    title: 'Sector Rotation',
    short: 'Different industry sectors outperform at different stages of the economic cycle.',
    full: 'The economy moves through expansion, peak, contraction, and trough phases. Each phase favors different sectors: technology and consumer discretionary thrive in early expansion, while utilities and healthcare outperform in recessions. Understanding this cycle helps explain why your portfolio performs differently over time, even if individual companies haven\'t changed.'
  },
  {
    title: 'Return on Equity',
    short: 'Measures how efficiently a company generates profit from shareholders\' investment.',
    full: 'ROE divides net income by shareholder equity. An ROE above 15% is generally considered strong, indicating the company efficiently turns invested capital into profits. Warren Buffett famously targets companies with consistently high ROE. For example, a company earning $50M with $200M in equity has a 25% ROE — excellent by most standards.'
  },
  {
    title: 'The 50/30/20 Rule',
    short: 'Allocate 50% of income to needs, 30% to wants, and 20% to saving and investing.',
    full: 'This budgeting framework simplifies money management into three clear buckets. Needs include rent, food, and insurance. Wants cover dining out, entertainment, and subscriptions. The 20% savings/investing portion is what builds wealth. For example, on a $4,000/month income: $2,000 needs, $1,200 wants, $800 toward investments and emergency fund.'
  },
]

export default dailyConcepts
