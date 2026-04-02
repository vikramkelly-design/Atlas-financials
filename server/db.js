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

  CREATE TABLE IF NOT EXISTS onboarding_answers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    monthly_income REAL,
    monthly_spending REAL,
    monthly_savings REAL,
    has_emergency_fund TEXT,
    invests TEXT,
    num_investments TEXT,
    concentrated TEXT,
    total_debt REAL,
    total_assets REAL,
    has_goal TEXT,
    goal_on_track TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS debts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    balance REAL NOT NULL,
    interest_rate REAL NOT NULL,
    min_payment REAL NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS health_scores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    score INTEGER,
    spending_score INTEGER,
    savings_score INTEGER,
    portfolio_score INTEGER,
    debt_score INTEGER,
    goals_score INTEGER,
    ai_summary TEXT,
    share_token TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS weekly_pulses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    week_start TEXT NOT NULL,
    score_change INTEGER,
    spending_total REAL,
    portfolio_change_pct REAL,
    ai_tip TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS password_resets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    token TEXT NOT NULL UNIQUE,
    expires_at TEXT NOT NULL,
    used INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS challenges (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    name TEXT NOT NULL,
    description TEXT,
    type TEXT CHECK(type IN ('spending','saving','debt')),
    target_value REAL NOT NULL,
    month TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS user_challenges (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    challenge_id INTEGER NOT NULL,
    status TEXT DEFAULT 'active' CHECK(status IN ('active','completed','failed')),
    progress REAL DEFAULT 0,
    joined_at TEXT DEFAULT (datetime('now')),
    completed_at TEXT
  );

  CREATE TABLE IF NOT EXISTS user_badges (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    badge_key TEXT NOT NULL,
    earned_at TEXT DEFAULT (datetime('now')),
    UNIQUE(user_id, badge_key)
  );

  CREATE TABLE IF NOT EXISTS user_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER UNIQUE NOT NULL,
    debt_strategy TEXT DEFAULT 'avalanche',
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

// Add share_token column to health_scores if not exists
const migrate2 = [
  'ALTER TABLE health_scores ADD COLUMN share_token TEXT',
  'ALTER TABLE users ADD COLUMN email_verified INTEGER DEFAULT 1',
  'ALTER TABLE users ADD COLUMN verification_code TEXT',
  'ALTER TABLE users ADD COLUMN verification_expires TEXT',
  'ALTER TABLE challenges ADD COLUMN user_id INTEGER',
];
for (const sql of migrate2) {
  try { db.exec(sql); } catch {}
}

// Add biggest_goal and is_baseline columns
const migrate3 = [
  'ALTER TABLE onboarding_answers ADD COLUMN biggest_goal TEXT',
  'ALTER TABLE health_scores ADD COLUMN is_baseline INTEGER DEFAULT 0',
];
for (const sql of migrate3) {
  try { db.exec(sql); } catch {}
}

// Performance indexes on user_id and foreign key columns
const indexes = [
  'CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id)',
  'CREATE INDEX IF NOT EXISTS idx_transactions_user_month ON transactions(user_id, month)',
  'CREATE INDEX IF NOT EXISTS idx_budget_goals_user_id ON budget_goals(user_id)',
  'CREATE INDEX IF NOT EXISTS idx_portfolios_user_id ON portfolios(user_id)',
  'CREATE INDEX IF NOT EXISTS idx_watchlist_user_id ON watchlist(user_id)',
  'CREATE INDEX IF NOT EXISTS idx_net_worth_assets_user_id ON net_worth_assets(user_id)',
  'CREATE INDEX IF NOT EXISTS idx_net_worth_liabilities_user_id ON net_worth_liabilities(user_id)',
  'CREATE INDEX IF NOT EXISTS idx_debts_user_id ON debts(user_id)',
  'CREATE INDEX IF NOT EXISTS idx_health_scores_user_id ON health_scores(user_id)',
  'CREATE INDEX IF NOT EXISTS idx_atlas_goals_user_id ON atlas_goals(user_id)',
  'CREATE INDEX IF NOT EXISTS idx_atlas_ultimate_goals_user_id ON atlas_ultimate_goals(user_id)',
  'CREATE INDEX IF NOT EXISTS idx_onboarding_answers_user_id ON onboarding_answers(user_id)',
  'CREATE INDEX IF NOT EXISTS idx_portfolio_positions_portfolio_id ON portfolio_positions(portfolio_id)',
  'CREATE INDEX IF NOT EXISTS idx_orders_portfolio_id ON orders(portfolio_id)',
  'CREATE INDEX IF NOT EXISTS idx_portfolio_transactions_portfolio_id ON portfolio_transactions(portfolio_id)',
  'CREATE INDEX IF NOT EXISTS idx_user_badges_user_id ON user_badges(user_id)',
  'CREATE INDEX IF NOT EXISTS idx_user_settings_user_id ON user_settings(user_id)',
];
for (const sql of indexes) {
  try { db.exec(sql); } catch {}
}

module.exports = db;
