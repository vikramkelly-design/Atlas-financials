export const LEARN_CONTENT = {
  "DCF": {
    short: "Discounted Cash Flow — values a company based on its future cash generation, discounted to today's dollars.",
    example: "If a company will generate $1B over 10 years, DCF tells you what that future cash is worth right now.",
    why: "This is how Buffett thinks about value. Price is what you pay. Value is what you get. DCF calculates value."
  },
  "P/E Ratio": {
    short: "Price-to-Earnings — how many dollars you pay for every $1 of company earnings.",
    example: "A P/E of 28 means you pay $28 for every $1 Apple earns annually. S&P 500 average is around 20-25.",
    why: "High P/E can mean growth expectations or overvaluation. Low P/E can mean value or problems. Context is everything."
  },
  "Buy Below": {
    short: "The price at which Atlas considers a stock a true value buy — intrinsic value minus a 30% margin of safety.",
    example: "If intrinsic value is $100, Buy Below is $70. The 30% buffer protects you even if the model is slightly off.",
    why: "The margin of safety is Buffett's core principle. Never pay full price for a business."
  },
  "Intrinsic Value": {
    short: "What a business is actually worth based on its fundamentals — independent of what the stock market prices it at today.",
    example: "A stock might trade at $200 but have an intrinsic value of $140. Atlas finds that gap.",
    why: "The market is a voting machine short-term and a weighing machine long-term. Intrinsic value is the weight."
  },
  "Free Cash Flow": {
    short: "The cash a company generates after paying all operating costs and capital expenditures. The real money a business produces.",
    example: "A company with $10B revenue but $9.5B in costs has $500M FCF — that's what's actually available to grow the business.",
    why: "FCF is harder to manipulate than earnings. It's the metric serious investors watch most closely."
  },
  "Margin of Safety": {
    short: "Buying a stock at a significant discount to its intrinsic value to protect against errors in your own analysis.",
    example: "If intrinsic value is $100, waiting to buy at $70 gives you a 30% margin of safety.",
    why: "Introduced by Benjamin Graham, Buffett's mentor. The three most important words in investing."
  },
  "Discount Rate": {
    short: "The annual return rate you demand for taking on the risk of owning a stock. Higher risk means a higher required rate.",
    example: "A 10% discount rate means you won't buy unless the investment can return 10% annually.",
    why: "The discount rate translates future cash flows into today's value. It's your personal return hurdle."
  },
  "PEG Ratio": {
    short: "P/E ratio divided by the earnings growth rate. Adjusts the P/E to account for how fast the company is growing.",
    example: "A P/E of 30 with 30% growth gives a PEG of 1.0. Generally, PEG under 1.0 suggests undervaluation.",
    why: "PEG solves one of P/E's biggest flaws — fast-growing companies look expensive on P/E but can be cheap on PEG."
  },
  "Owner Earnings": {
    short: "Buffett's preferred profitability measure: net income plus depreciation minus capital expenditures.",
    example: "A company reporting $100M net income but spending $80M on maintenance capex really earns $20M for its owners.",
    why: "Reported earnings can be manipulated. Owner earnings cut through accounting to show real economic profit."
  },
  "EPS": {
    short: "Earnings Per Share — the company's total profit divided by the number of shares outstanding.",
    example: "If a company earns $10B and has 1B shares, EPS is $10. You own $10 of earnings for every share you hold.",
    why: "EPS growth over time is one of the clearest signals of a healthy, compounding business."
  },
  "Upside %": {
    short: "The percentage gain available if the stock reaches its intrinsic value from today's price.",
    example: "A stock at $100 with intrinsic value of $150 has 50% upside. That's how much you'd gain at full value.",
    why: "Upside tells you the reward. Always weigh it against the risk and your margin of safety."
  },
  "Forward P/E": {
    short: "P/E ratio calculated using next year's estimated earnings instead of last year's actual earnings.",
    example: "If a stock trades at $100 and analysts expect $5 EPS next year, Forward P/E is 20x.",
    why: "Forward P/E reflects where the business is going, not where it's been. More useful for growing companies."
  }
}
