const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'finwise.db'));

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    date TEXT NOT NULL,
    description TEXT NOT NULL,
    amount REAL NOT NULL,
    category TEXT DEFAULT 'Other',
    notes TEXT,
    month TEXT,
    imported_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS budget_goals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    category TEXT NOT NULL,
    monthly_limit REAL NOT NULL
  );

  CREATE TABLE IF NOT EXISTS portfolios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    name TEXT NOT NULL,
    cash_balance REAL DEFAULT 0,
    initial_deposit REAL DEFAULT 0,
    recurring_amount REAL DEFAULT 0,
    recurring_frequency TEXT CHECK(recurring_frequency IN ('weekly','monthly','yearly', NULL)),
    last_recurring_deposit TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS portfolio_positions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    portfolio_id INTEGER REFERENCES portfolios(id) ON DELETE CASCADE,
    ticker TEXT NOT NULL,
    shares REAL NOT NULL,
    avg_cost REAL NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    portfolio_id INTEGER REFERENCES portfolios(id) ON DELETE CASCADE,
    ticker TEXT NOT NULL,
    order_type TEXT CHECK(order_type IN ('market','limit','stop_loss')),
    side TEXT CHECK(side IN ('buy','sell')),
    shares REAL NOT NULL,
    target_price REAL,
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending','executed','cancelled')),
    executed_price REAL,
    executed_at TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS portfolio_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    portfolio_id INTEGER REFERENCES portfolios(id) ON DELETE CASCADE,
    order_id INTEGER REFERENCES orders(id),
    type TEXT CHECK(type IN ('buy','sell','deposit','recurring_deposit')),
    ticker TEXT,
    shares REAL,
    price REAL,
    total REAL NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS watchlist (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    ticker TEXT NOT NULL,
    added_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS net_worth_assets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    name TEXT NOT NULL,
    value REAL NOT NULL,
    type TEXT DEFAULT 'Other'
  );

  CREATE TABLE IF NOT EXISTS net_worth_liabilities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    name TEXT NOT NULL,
    value REAL NOT NULL
  );

  CREATE TABLE IF NOT EXISTS atlas_ultimate_goals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    target_amount REAL NOT NULL,
    deadline TEXT NOT NULL,
    category TEXT DEFAULT 'General',
    status TEXT DEFAULT 'active' CHECK(status IN ('active','completed')),
    created_at TEXT DEFAULT (datetime('now')),
    completed_at TEXT
  );

  CREATE TABLE IF NOT EXISTS atlas_goals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    ultimate_goal_id INTEGER REFERENCES atlas_ultimate_goals(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    target_amount REAL NOT NULL,
    current_amount REAL DEFAULT 0,
    deadline TEXT NOT NULL,
    category TEXT DEFAULT 'General',
    status TEXT DEFAULT 'active' CHECK(status IN ('active','completed','paused')),
    sort_order INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    completed_at TEXT
  );

  CREATE TABLE IF NOT EXISTS ai_insights (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL,
    ticker TEXT,
    month TEXT,
    content TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );
`);

// Add user_id columns to existing tables if they don't exist yet
const migrate = [
  'ALTER TABLE transactions ADD COLUMN user_id INTEGER',
  'ALTER TABLE budget_goals ADD COLUMN user_id INTEGER',
  'ALTER TABLE portfolios ADD COLUMN user_id INTEGER',
  'ALTER TABLE watchlist ADD COLUMN user_id INTEGER',
  'ALTER TABLE net_worth_assets ADD COLUMN user_id INTEGER',
  'ALTER TABLE net_worth_liabilities ADD COLUMN user_id INTEGER',
  'ALTER TABLE atlas_goals ADD COLUMN ultimate_goal_id INTEGER REFERENCES atlas_ultimate_goals(id) ON DELETE CASCADE',
];
for (const sql of migrate) {
  try { db.exec(sql); } catch {}
}

// Drop the old unique constraint on watchlist ticker (now per-user)
try { db.exec('CREATE UNIQUE INDEX IF NOT EXISTS watchlist_user_ticker ON watchlist(user_id, ticker)'); } catch {}

// Drop old unique on budget_goals category (now per-user)
try { db.exec('CREATE UNIQUE INDEX IF NOT EXISTS budget_goals_user_cat ON budget_goals(user_id, category)'); } catch {}

module.exports = db;
