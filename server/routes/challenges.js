const express = require('express');
const router = express.Router();
const db = require('../db');

// Seed challenges for the current month if none exist
function seedChallenges() {
  const now = new Date();
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const existing = db.prepare('SELECT id FROM challenges WHERE month = ?').get(month);
  if (existing) return;

  const defaults = [
    { name: 'No-Spend Weekend', description: 'Spend $0 on Saturday and Sunday this week.', type: 'spending', target_value: 0 },
    { name: 'Save $500', description: 'Save at least $500 this month from your income.', type: 'saving', target_value: 500 },
    { name: 'Cut Dining 20%', description: 'Spend 20% less on Food & Dining compared to last month.', type: 'spending', target_value: 20 },
    { name: 'Pay $200 Toward Debt', description: 'Make at least $200 in extra debt payments this month.', type: 'debt', target_value: 200 },
  ];

  const insert = db.prepare(
    'INSERT INTO challenges (name, description, type, target_value, month) VALUES (?, ?, ?, ?, ?)'
  );
  for (const c of defaults) {
    insert.run(c.name, c.description, c.type, c.target_value, month);
  }
}

// GET /api/challenges — available challenges this month
router.get('/', (req, res) => {
  try {
    seedChallenges();
    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const challenges = db.prepare('SELECT * FROM challenges WHERE month = ?').all(month);

    // Get user's joined challenges
    const userChallenges = db.prepare(
      'SELECT challenge_id, status, progress FROM user_challenges WHERE user_id = ?'
    ).all(req.userId);
    const joinedMap = {};
    for (const uc of userChallenges) {
      joinedMap[uc.challenge_id] = { status: uc.status, progress: uc.progress };
    }

    const result = challenges.map(c => ({
      ...c,
      joined: !!joinedMap[c.id],
      status: joinedMap[c.id]?.status || null,
      progress: joinedMap[c.id]?.progress || 0,
    }));

    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/challenges/join/:id
router.post('/join/:id', (req, res) => {
  try {
    const challenge = db.prepare('SELECT * FROM challenges WHERE id = ?').get(req.params.id);
    if (!challenge) return res.status(404).json({ success: false, error: 'Challenge not found' });

    const existing = db.prepare(
      'SELECT id FROM user_challenges WHERE user_id = ? AND challenge_id = ?'
    ).get(req.userId, challenge.id);
    if (existing) return res.json({ success: true, data: { message: 'Already joined' } });

    db.prepare(
      'INSERT INTO user_challenges (user_id, challenge_id) VALUES (?, ?)'
    ).run(req.userId, challenge.id);

    res.json({ success: true, data: { message: 'Joined challenge' } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/challenges/mine — user's active/completed challenges with progress
router.get('/mine', (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT c.*, uc.status as user_status, uc.progress, uc.joined_at, uc.completed_at as user_completed_at
      FROM user_challenges uc
      JOIN challenges c ON uc.challenge_id = c.id
      WHERE uc.user_id = ?
      ORDER BY uc.joined_at DESC
    `).all(req.userId);

    // Recalculate progress for active challenges
    const now = new Date();
    const curMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;

    const curTxns = db.prepare('SELECT * FROM transactions WHERE user_id = ? AND month = ?').all(req.userId, curMonth);
    const prevTxns = db.prepare('SELECT * FROM transactions WHERE user_id = ? AND month = ?').all(req.userId, prevMonth);

    for (const row of rows) {
      if (row.user_status !== 'active') continue;

      let progress = 0;
      let completed = false;

      if (row.name === 'Save $500') {
        const income = curTxns.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0);
        const spent = curTxns.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);
        const saved = income - spent;
        progress = Math.min(100, Math.max(0, (saved / row.target_value) * 100));
        completed = saved >= row.target_value;
      } else if (row.name === 'Cut Dining 20%') {
        const curDining = curTxns.filter(t => t.amount < 0 && t.category === 'Food & Dining').reduce((s, t) => s + Math.abs(t.amount), 0);
        const prevDining = prevTxns.filter(t => t.amount < 0 && t.category === 'Food & Dining').reduce((s, t) => s + Math.abs(t.amount), 0);
        if (prevDining > 0) {
          const reduction = ((prevDining - curDining) / prevDining) * 100;
          progress = Math.min(100, Math.max(0, (reduction / row.target_value) * 100));
          completed = reduction >= row.target_value;
        }
      } else if (row.name === 'Pay $200 Toward Debt') {
        // Approximate: check if any debt balances decreased
        progress = 0; // would need payment tracking
      } else if (row.name === 'No-Spend Weekend') {
        // Check last weekend
        const lastSat = new Date(now);
        lastSat.setDate(lastSat.getDate() - lastSat.getDay() - 1);
        const lastSun = new Date(lastSat);
        lastSun.setDate(lastSun.getDate() + 1);
        const satStr = lastSat.toISOString().split('T')[0];
        const sunStr = lastSun.toISOString().split('T')[0];
        const weekendSpend = curTxns.filter(t => t.amount < 0 && (t.date === satStr || t.date === sunStr))
          .reduce((s, t) => s + Math.abs(t.amount), 0);
        completed = weekendSpend === 0 && curTxns.length > 0;
        progress = completed ? 100 : weekendSpend > 0 ? 0 : 50;
      }

      // Update progress in DB
      if (completed && row.user_status === 'active') {
        db.prepare('UPDATE user_challenges SET status = ?, progress = ?, completed_at = datetime(?) WHERE user_id = ? AND challenge_id = ?')
          .run('completed', 100, 'now', req.userId, row.id);
        row.user_status = 'completed';
        row.progress = 100;
      } else {
        db.prepare('UPDATE user_challenges SET progress = ? WHERE user_id = ? AND challenge_id = ?')
          .run(Math.round(progress), req.userId, row.id);
        row.progress = Math.round(progress);
      }
    }

    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
