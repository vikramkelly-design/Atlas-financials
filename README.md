# FinWise

AI-powered personal finance app with budget tracking, portfolio management, and market intelligence.

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure your Anthropic API key

Create or edit `server/.env`:

```
ANTHROPIC_API_KEY=your_actual_key_here
PORT=3001
NODE_ENV=development
```

Get your API key from [console.anthropic.com](https://console.anthropic.com/).

### 3. Run the app

```bash
npm run dev
```

This starts both the backend (port 3001) and frontend (port 5173).

Open [http://localhost:5173](http://localhost:5173) in your browser.

## Features

- **Budget & Cash Flow** — Import bank CSV files, auto-categorize transactions with AI, view monthly spending summaries
- **Portfolio Management** — Track positions, view allocation breakdowns, intrinsic value calculator
- **Market Intelligence** — Watchlist with live prices, AI-generated stock digests, earnings calendar
- **Net Worth Tracker** — Manual asset and liability tracking

## Tech Stack

- React 18 + Vite (frontend)
- Node.js + Express (backend)
- SQLite via better-sqlite3
- Anthropic Claude API for AI features
- yahoo-finance2 for market data

## Notes

- The SQLite database (`finwise.db`) is created automatically on first run in `server/`
- Market data comes from Yahoo Finance and may be delayed
- AI features require a valid Anthropic API key
- For informational purposes only. Not financial advice.
