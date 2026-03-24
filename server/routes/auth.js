const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'ledger-secret-key-change-in-prod';

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ success: false, error: 'Name, email, and password are required' });
    }
    if (password.length < 6) {
      return res.status(400).json({ success: false, error: 'Password must be at least 6 characters' });
    }

    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase().trim());
    if (existing) {
      return res.status(409).json({ success: false, error: 'An account with this email already exists' });
    }

    const hash = await bcrypt.hash(password, 10);
    const result = db.prepare('INSERT INTO users (name, email, password) VALUES (?, ?, ?)').run(
      name.trim(), email.toLowerCase().trim(), hash
    );

    const user = { id: result.lastInsertRowid, name: name.trim(), email: email.toLowerCase().trim() };
    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '30d' });

    res.status(201).json({ success: true, data: { token, user } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email and password are required' });
    }

    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase().trim());
    if (!user) {
      return res.status(401).json({ success: false, error: 'Invalid email or password' });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(401).json({ success: false, error: 'Invalid email or password' });
    }

    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ success: true, data: { token, user: { id: user.id, name: user.name, email: user.email } } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/auth/forgot-password
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, error: 'Email is required' });

    const user = db.prepare('SELECT id, email FROM users WHERE email = ?').get(email.toLowerCase().trim());
    if (!user) {
      // Don't reveal if email exists
      return res.json({ success: true, data: { message: 'If that email exists, a reset code has been sent.' } });
    }

    const crypto = require('crypto');
    const token = crypto.randomBytes(16).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour

    db.prepare('INSERT INTO password_resets (user_id, token, expires_at) VALUES (?, ?, ?)').run(user.id, token, expiresAt);

    const { sendPasswordReset } = require('../services/email');
    await sendPasswordReset(user.email, token);

    res.json({ success: true, data: { message: 'If that email exists, a reset code has been sent.' } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/auth/reset-password
router.post('/reset-password', async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) return res.status(400).json({ success: false, error: 'Token and password are required' });
    if (password.length < 6) return res.status(400).json({ success: false, error: 'Password must be at least 6 characters' });

    const reset = db.prepare('SELECT * FROM password_resets WHERE token = ? AND used = 0').get(token);
    if (!reset) return res.status(400).json({ success: false, error: 'Invalid or expired reset code' });

    const now = new Date();
    if (now > new Date(reset.expires_at)) {
      return res.status(400).json({ success: false, error: 'Reset code has expired' });
    }

    const hash = await bcrypt.hash(password, 10);
    db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hash, reset.user_id);
    db.prepare('UPDATE password_resets SET used = 1 WHERE id = ?').run(reset.id);

    res.json({ success: true, data: { message: 'Password reset successfully' } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
