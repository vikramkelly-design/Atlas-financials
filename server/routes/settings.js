const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();
const db = require('../db');
const { sendError } = require('../utils/errors');

router.get('/', async (req, res) => {
  try {
    const user = await db.get('SELECT id, name, email, created_at FROM users WHERE id = $1', [req.userId]);
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });

    let settings = await db.get('SELECT * FROM user_settings WHERE user_id = $1', [req.userId]);
    if (!settings) {
      await db.run('INSERT INTO user_settings (user_id) VALUES ($1)', [req.userId]);
      settings = await db.get('SELECT * FROM user_settings WHERE user_id = $1', [req.userId]);
    }

    res.json({
      success: true,
      data: {
        profile: { name: user.name, email: user.email, created_at: user.created_at },
        preferences: { debt_strategy: settings.debt_strategy },
      }
    });
  } catch (err) {
    sendError(res, err);
  }
});

router.patch('/profile', async (req, res) => {
  try {
    const { name, email } = req.body;
    if (!name || !email) return res.status(400).json({ success: false, error: 'Name and email are required' });
    const trimmedEmail = email.toLowerCase().trim();
    const existing = await db.get('SELECT id FROM users WHERE email = $1 AND id != $2', [trimmedEmail, req.userId]);
    if (existing) return res.status(409).json({ success: false, error: 'Email already in use' });
    await db.run('UPDATE users SET name = $1, email = $2 WHERE id = $3', [name.trim(), trimmedEmail, req.userId]);
    res.json({ success: true, data: { name: name.trim(), email: trimmedEmail } });
  } catch (err) {
    sendError(res, err);
  }
});

router.post('/change-password', async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) return res.status(400).json({ success: false, error: 'Current and new password are required' });
    if (newPassword.length < 6) return res.status(400).json({ success: false, error: 'New password must be at least 6 characters' });
    const user = await db.get('SELECT password FROM users WHERE id = $1', [req.userId]);
    const valid = await bcrypt.compare(currentPassword, user.password);
    if (!valid) return res.status(401).json({ success: false, error: 'Current password is incorrect' });
    const hash = await bcrypt.hash(newPassword, 10);
    await db.run('UPDATE users SET password = $1 WHERE id = $2', [hash, req.userId]);
    res.json({ success: true, data: { message: 'Password updated' } });
  } catch (err) {
    sendError(res, err);
  }
});

router.patch('/preferences', async (req, res) => {
  try {
    const { debt_strategy } = req.body;
    if (debt_strategy && !['avalanche', 'snowball'].includes(debt_strategy)) return res.status(400).json({ success: false, error: 'Invalid strategy' });
    let settings = await db.get('SELECT id FROM user_settings WHERE user_id = $1', [req.userId]);
    if (!settings) {
      await db.run('INSERT INTO user_settings (user_id, debt_strategy) VALUES ($1, $2)', [req.userId, debt_strategy || 'avalanche']);
    } else {
      await db.run('UPDATE user_settings SET debt_strategy = $1 WHERE user_id = $2', [debt_strategy || 'avalanche', req.userId]);
    }
    res.json({ success: true, data: { debt_strategy: debt_strategy || 'avalanche' } });
  } catch (err) {
    sendError(res, err);
  }
});

router.post('/track-dcf', async (req, res) => {
  try {
    const user = await db.get('SELECT has_viewed_dcf FROM users WHERE id = $1', [req.userId]);
    if (user && !user.has_viewed_dcf) {
      await db.run('UPDATE users SET has_viewed_dcf = 1, first_dcf_date = $1 WHERE id = $2', [new Date().toISOString(), req.userId]);
    }
    res.json({ success: true });
  } catch (err) {
    sendError(res, err);
  }
});

router.get('/flags', async (req, res) => {
  try {
    const user = await db.get('SELECT has_viewed_dcf, first_dcf_date, has_bought_undervalued FROM users WHERE id = $1', [req.userId]);
    res.json({ success: true, data: user || {} });
  } catch (err) {
    sendError(res, err);
  }
});

router.delete('/account', async (req, res) => {
  try {
    const { password } = req.body;
    if (!password) return res.status(400).json({ success: false, error: 'Password is required' });
    const user = await db.get('SELECT password FROM users WHERE id = $1', [req.userId]);
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ success: false, error: 'Incorrect password' });

    const tables = [
      'transactions', 'budget_goals', 'watchlist', 'net_worth_assets', 'net_worth_liabilities',
      'onboarding_answers', 'debts', 'health_scores', 'weekly_pulses', 'atlas_goals',
      'atlas_ultimate_goals', 'user_badges', 'user_settings', 'user_challenges', 'password_resets',
      'savings_transactions', 'savings_buckets', 'monthly_income_log', 'monthly_allocation',
      'screener_tickers', 'tracked_stocks', 'password_reset_tokens', 'plans',
    ];
    for (const table of tables) {
      await db.run(`DELETE FROM ${table} WHERE user_id = $1`, [req.userId]);
    }

    const portfolios = await db.all('SELECT id FROM portfolios WHERE user_id = $1', [req.userId]);
    for (const p of portfolios) {
      await db.run('DELETE FROM portfolio_positions WHERE portfolio_id = $1', [p.id]);
      await db.run('DELETE FROM portfolio_transactions WHERE portfolio_id = $1', [p.id]);
      await db.run('DELETE FROM orders WHERE portfolio_id = $1', [p.id]);
    }
    await db.run('DELETE FROM portfolios WHERE user_id = $1', [req.userId]);
    await db.run('DELETE FROM challenges WHERE user_id = $1', [req.userId]);
    await db.run('DELETE FROM users WHERE id = $1', [req.userId]);

    res.json({ success: true, data: { message: 'Account deleted' } });
  } catch (err) {
    sendError(res, err);
  }
});

module.exports = router;
