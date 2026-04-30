const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { getCacheStats, clearCache } = require('./utils/cache');
const { startOrderExecutor } = require('./services/orderExecutor');
const auth = require('./middleware/auth');
const { scheduleNightlyScreener, runNightlyScreener } = require('./services/nightlyScreener');
const { schedulePortfolioRefresh } = require('./services/portfolioRefresh');
const db = require('./db');
const { initializeDatabase } = require('./db');

const app = express();
const PORT = process.env.PORT || 3001;

// Security headers — relaxed for cross-origin API access
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: false,
}));

// Rate limiting — disabled in development to prevent 429 errors during local work
const isDev = process.env.NODE_ENV !== 'production';
const globalLimiter = isDev ? (req, res, next) => next() : rateLimit({ windowMs: 60000, max: 300, standardHeaders: true, legacyHeaders: false });
const authLimiter = isDev ? (req, res, next) => next() : rateLimit({ windowMs: 60000, max: 10, message: { success: false, error: 'Too many attempts. Try again in a minute.' } });
const aiLimiter = isDev ? (req, res, next) => next() : rateLimit({ windowMs: 60000, max: 20, message: { success: false, error: 'Too many AI requests. Try again in a minute.' } });
app.use(globalLimiter);

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173'
}));
app.use(express.json({ limit: '1mb' }));

// Public routes
app.use('/api/auth', authLimiter, require('./routes/auth'));
app.use('/api/share', require('./routes/share'));

// Protected routes — require auth
app.use('/api/chat', auth, aiLimiter, require('./routes/chat'));
app.use('/api/budget', auth, require('./routes/budget'));
app.use('/api/networth', auth, require('./routes/networth'));
app.use('/api/watchlist', auth, require('./routes/watchlist'));
app.use('/api/portfolio', auth, require('./routes/portfolio'));

// Market data routes — also protected
app.use('/api/quote', auth, require('./routes/quote'));
app.use('/api/intrinsic', auth, require('./routes/intrinsic'));
app.use('/api/screener', auth, require('./routes/screener'));
app.use('/api/ratings', auth, require('./routes/ratings'));
app.use('/api/markets', auth, require('./routes/markets'));
app.use('/api/atlas', auth, require('./routes/atlas'));
app.use('/api/insights', auth, require('./routes/insights'));
app.use('/api/debt', auth, require('./routes/debt'));
app.use('/api/pulse', auth, require('./routes/pulse'));
app.use('/api/badges', auth, require('./routes/badges'));
app.use('/api/settings', auth, require('./routes/settings'));
app.use('/api/plan', auth, require('./routes/plan'));
app.use('/api/savings', auth, require('./routes/savings'));
app.use('/api/digest', auth, require('./routes/digest'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', cache: getCacheStats(), timestamp: new Date().toISOString() });
});

// Cache control (requires auth)
app.delete('/api/cache', auth, (req, res) => {
  clearCache();
  res.json({ message: 'Cache cleared.' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  const message = process.env.NODE_ENV === 'production' ? 'Internal server error' : (err.message || 'Internal server error');
  res.status(500).json({ success: false, error: message });
});

// Initialize database then start server
initializeDatabase()
  .then(() => {
    const server = app.listen(PORT, async () => {
      console.log(`Atlas server running on port ${PORT}`);
      startOrderExecutor();
      scheduleNightlyScreener();
      schedulePortfolioRefresh();

      // Run screener on startup if cache is stale (>18 hours old)
      try {
        const latest = await db.get('SELECT MAX(refreshed_at) as latest FROM screener_cache');
        const lastRefresh = latest?.latest ? new Date(latest.latest) : null;
        const hoursOld = lastRefresh ? (Date.now() - lastRefresh.getTime()) / (1000 * 60 * 60) : Infinity;
        if (hoursOld > 18) {
          console.log(`[NightlyScreener] Cache is ${hoursOld === Infinity ? 'empty' : Math.round(hoursOld) + 'h old'} — running refresh on startup`);
          runNightlyScreener().catch(err => console.error('[NightlyScreener] Startup refresh failed:', err.message));
        } else {
          console.log(`[NightlyScreener] Cache is ${Math.round(hoursOld)}h old — fresh enough, skipping startup refresh`);
        }
      } catch (err) {
        console.error('[NightlyScreener] Stale check failed:', err.message);
      }
    });

    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`\n  Port ${PORT} is already in use.`);
        console.error(`  Run this to free it:  lsof -ti:${PORT} | xargs kill -9\n`);
        process.exit(1);
      } else {
        throw err;
      }
    });
  })
  .catch(err => {
    console.error('[DB] Failed to initialize database:', err);
    process.exit(1);
  });
