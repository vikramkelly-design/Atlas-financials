require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { getCacheStats, clearCache } = require('./utils/cache');
const { startOrderExecutor } = require('./services/orderExecutor');
const auth = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? 'https://your-vercel-domain.vercel.app'
    : 'http://localhost:5173'
}));
app.use(express.json({ limit: '10mb' }));

// Initialize database (runs schema + seeds)
require('./db');

// Public routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/share', require('./routes/share'));

// Protected routes — require auth
app.use('/api/chat', auth, require('./routes/chat'));
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
app.use('/api/challenges', auth, require('./routes/challenges'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', cache: getCacheStats(), timestamp: new Date().toISOString() });
});

// Cache control
app.delete('/api/cache', (req, res) => {
  clearCache();
  res.json({ message: 'Cache cleared.' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ success: false, error: err.message || 'Internal server error' });
});

const server = app.listen(PORT, () => {
  console.log(`Atlas server running on port ${PORT}`);
  startOrderExecutor();
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
