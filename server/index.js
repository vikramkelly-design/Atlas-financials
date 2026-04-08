require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { getCacheStats, clearCache } = require('./utils/cache');
const { startOrderExecutor } = require('./services/orderExecutor');
const auth = require('./middleware/auth');
const { scheduleNightlyScreener } = require('./services/nightlyScreener');

const app = express();
const PORT = process.env.PORT || 3001;

// Security headers
app.use(helmet());

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

// Initialize database (runs schema + seeds)
require('./db');

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

const server = app.listen(PORT, () => {
  console.log(`Atlas server running on port ${PORT}`);
  startOrderExecutor();
  scheduleNightlyScreener();
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
