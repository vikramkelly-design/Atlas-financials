const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();
const db = require('../db');
const { sendError } = require('../utils/errors');

// GET /api/settings — profile + preferences
router.get('/', (req, res) => {
  try {
    const user = db.prepare('SELECT id, name, email FROM users WHERE id = ?').get(req.userId);
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });

    let settings = db.prepare('SELECT * FROM user_settings WHERE user_id = ?').get(req.userId);
    if (!settings) {
      db.prepare('INSERT INTO user_settings (user_id) VALUES (?)').run(req.userId);
      settings = db.prepare('SELECT * FROM user_settings WHERE user_id = ?').get(req.userId);
    }

    res.json({
      success: true,
      data: {
        profile: { name: user.name, email: user.email },
        preferences: { debt_strategy: settings.debt_strategy },
      }
    });
  } catch (err) {
    sendError(res, err);
  }
});

// PATCH /api/settings/profile — update name/email
router.patch('/profile', (req, res) => {
  try {
    const { name, email } = req.body;
    if (!name || !email) return res.status(400).json({ success: false, error: 'Name and email are required' });

    const trimmedEmail = email.toLowerCase().trim();
    const existing = db.prepare('SELECT id FROM users WHERE email = ? AND id != ?').get(trimmedEmail, req.userId);
    if (existing) return res.status(409).json({ success: false, error: 'Email already in use' });

    db.prepare('UPDATE users SET name = ?, email = ? WHERE id = ?').run(name.trim(), trimmedEmail, req.userId);
    res.json({ success: true, data: { name: name.trim(), email: trimmedEmail } });
  } catch (err) {
    sendError(res, err);
  }
});

// POST /api/settings/change-password
router.post('/change-password', async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, error: 'Current and new password are required' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, error: 'New password must be at least 6 characters' });
    }

    const user = db.prepare('SELECT password FROM users WHERE id = ?').get(req.userId);
    const valid = await bcrypt.compare(currentPassword, user.password);
    if (!valid) return res.status(401).json({ success: false, error: 'Current password is incorrect' });

    const hash = await bcrypt.hash(newPassword, 10);
    db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hash, req.userId);

    res.json({ success: true, data: { message: 'Password updated' } });
  } catch (err) {
    sendError(res, err);
  }
});

// PATCH /api/settings/preferences — update debt_strategy etc.
router.patch('/preferences', (req, res) => {
  try {
    const { debt_strategy } = req.body;
    if (debt_strategy && !['avalanche', 'snowball'].includes(debt_strategy)) {
      return res.status(400).json({ success: false, error: 'Invalid strategy' });
    }

    let settings = db.prepare('SELECT id FROM user_settings WHERE user_id = ?').get(req.userId);
    if (!settings) {
      db.prepare('INSERT INTO user_settings (user_id, debt_strategy) VALUES (?, ?)').run(req.userId, debt_strategy || 'avalanche');
    } else {
      db.prepare('UPDATE user_settings SET debt_strategy = ? WHERE user_id = ?').run(debt_strategy || 'avalanche', req.userId);
    }

    res.json({ success: true, data: { debt_strategy: debt_strategy || 'avalanche' } });
  } catch (err) {
    sendError(res, err);
  }
});

// POST /api/settings/track-dcf — mark that user has viewed a DCF breakdown
router.post('/track-dcf', (req, res) => {
  try {
    const user = db.prepare('SELECT has_viewed_dcf FROM users WHERE id = ?').get(req.userId);
    if (user && !user.has_viewed_dcf) {
      db.prepare('UPDATE users SET has_viewed_dcf = 1, first_dcf_date = datetime(?) WHERE id = ?')
        .run(new Date().toISOString(), req.userId);
    }
    res.json({ success: true });
  } catch (err) {
    sendError(res, err);
  }
});

// GET /api/settings/flags — get user flags for track record
router.get('/flags', (req, res) => {
  try {
    const user = db.prepare('SELECT has_viewed_dcf, first_dcf_date, has_bought_undervalued FROM users WHERE id = ?').get(req.userId);
    res.json({ success: true, data: user || {} });
  } catch (err) {
    sendError(res, err);
  }
});

// DELETE /api/settings/account — delete all user data
router.delete('/account', async (req, res) => {
  try {
    const { password } = req.body;
    if (!password) return res.status(400).json({ success: false, error: 'Password is required' });

    const user = db.prepare('SELECT password FROM users WHERE id = ?').get(req.userId);
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ success: false, error: 'Incorrect password' });

    // Delete all user data
    const tables = [
      'transactions', 'budget_goals', 'watchlist', 'net_worth_assets', 'net_worth_liabilities',
      'onboarding_answers', 'debts', 'health_scores', 'weekly_pulses', 'atlas_goals',
      'atlas_ultimate_goals', 'user_badges', 'user_settings', 'user_challenges', 'password_resets',
    ];
    for (const table of tables) {
      db.prepare(`DELETE FROM ${table} WHERE user_id = ?`).run(req.userId);
    }

    // Delete portfolios and cascade
    const portfolios = db.prepare('SELECT id FROM portfolios WHERE user_id = ?').all(req.userId);
    for (const p of portfolios) {
      db.prepare('DELETE FROM portfolio_positions WHERE portfolio_id = ?').run(p.id);
      db.prepare('DELETE FROM portfolio_transactions WHERE portfolio_id = ?').run(p.id);
      db.prepare('DELETE FROM orders WHERE portfolio_id = ?').run(p.id);
    }
    db.prepare('DELETE FROM portfolios WHERE user_id = ?').run(req.userId);

    // Delete challenges owned by user
    db.prepare('DELETE FROM challenges WHERE user_id = ?').run(req.userId);

    // Delete user
    db.prepare('DELETE FROM users WHERE id = ?').run(req.userId);

    res.json({ success: true, data: { message: 'Account deleted' } });
  } catch (err) {
    sendError(res, err);
  }
});

module.exports = router;
