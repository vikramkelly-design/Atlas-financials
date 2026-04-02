const express = require('express');
const router = express.Router();
const db = require('../db');
const { sendError } = require('../utils/errors');

// ── Ultimate Goals ──────────────────────────────────────────

// GET /api/atlas/ultimate — all ultimate goals for user
router.get('/ultimate', (req, res) => {
  try {
    const goals = db.prepare(
      'SELECT * FROM atlas_ultimate_goals WHERE user_id = ? ORDER BY created_at ASC'
    ).all(req.userId);
    res.json({ success: true, data: goals });
  } catch (err) {
    sendError(res, err);
  }
});

// POST /api/atlas/ultimate — create ultimate goal (max 5)
router.post('/ultimate', (req, res) => {
  try {
    const { name, description, target_amount, deadline, category } = req.body;
    if (!name || !target_amount || !deadline) {
      return res.status(400).json({ success: false, error: 'Name, target amount, and deadline are required' });
    }
    const count = db.prepare(
      'SELECT COUNT(*) as cnt FROM atlas_ultimate_goals WHERE user_id = ?'
    ).get(req.userId);
    if (count.cnt >= 5) {
      return res.status(400).json({ success: false, error: 'Maximum of 5 ultimate goals allowed' });
    }
    const result = db.prepare(
      `INSERT INTO atlas_ultimate_goals (user_id, name, description, target_amount, deadline, category)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(req.userId, name, description || null, target_amount, deadline, category || 'General');
    const goal = db.prepare('SELECT * FROM atlas_ultimate_goals WHERE id = ?').get(result.lastInsertRowid);
    res.json({ success: true, data: goal });
  } catch (err) {
    sendError(res, err);
  }
});

// PATCH /api/atlas/ultimate/:id — update ultimate goal
router.patch('/ultimate/:id', (req, res) => {
  try {
    const { id } = req.params;
    const fields = ['name', 'description', 'target_amount', 'deadline', 'category', 'status'];
    const updates = [];
    const values = [];
    for (const f of fields) {
      if (req.body[f] !== undefined) {
        updates.push(`${f} = ?`);
        values.push(req.body[f]);
      }
    }
    if (updates.length === 0) {
      return res.status(400).json({ success: false, error: 'No fields to update' });
    }
    if (req.body.status === 'completed') {
      updates.push("completed_at = datetime('now')");
    } else if (req.body.status && req.body.status !== 'completed') {
      updates.push('completed_at = NULL');
    }
    values.push(id, req.userId);
    db.prepare(`UPDATE atlas_ultimate_goals SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`).run(...values);
    const updated = db.prepare('SELECT * FROM atlas_ultimate_goals WHERE id = ? AND user_id = ?').get(id, req.userId);
    res.json({ success: true, data: updated });
  } catch (err) {
    sendError(res, err);
  }
});

// DELETE /api/atlas/ultimate/:id
router.delete('/ultimate/:id', (req, res) => {
  try {
    const { id } = req.params;
    db.prepare('DELETE FROM atlas_ultimate_goals WHERE id = ? AND user_id = ?').run(id, req.userId);
    res.json({ success: true });
  } catch (err) {
    sendError(res, err);
  }
});

// ── Milestone Goals ─────────────────────────────────────────

// GET /api/atlas/milestones/:ultimateId — milestones for an ultimate goal
router.get('/milestones/:ultimateId', (req, res) => {
  try {
    const goals = db.prepare(
      'SELECT * FROM atlas_goals WHERE user_id = ? AND ultimate_goal_id = ? ORDER BY sort_order ASC'
    ).all(req.userId, req.params.ultimateId);
    res.json({ success: true, data: goals });
  } catch (err) {
    sendError(res, err);
  }
});

// GET /api/atlas/current — the single current active milestone (for Dashboard)
router.get('/current', (req, res) => {
  try {
    const goal = db.prepare(
      `SELECT g.*, u.name as ultimate_name FROM atlas_goals g
       JOIN atlas_ultimate_goals u ON g.ultimate_goal_id = u.id
       WHERE g.user_id = ? AND g.status = 'active'
       ORDER BY g.sort_order ASC LIMIT 1`
    ).get(req.userId);
    res.json({ success: true, data: goal || null });
  } catch (err) {
    sendError(res, err);
  }
});

// POST /api/atlas/milestone — create milestone
router.post('/milestone', (req, res) => {
  try {
    const { ultimate_goal_id, name, description, target_amount, deadline, category } = req.body;
    if (!ultimate_goal_id || !name || !target_amount || !deadline) {
      return res.status(400).json({ success: false, error: 'Ultimate goal, name, target amount, and deadline are required' });
    }
    const maxOrder = db.prepare(
      'SELECT COALESCE(MAX(sort_order), -1) as mx FROM atlas_goals WHERE user_id = ? AND ultimate_goal_id = ?'
    ).get(req.userId, ultimate_goal_id);
    const sort_order = (maxOrder?.mx ?? -1) + 1;
    const result = db.prepare(
      `INSERT INTO atlas_goals (user_id, ultimate_goal_id, name, description, target_amount, deadline, category, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(req.userId, ultimate_goal_id, name, description || null, target_amount, deadline, category || 'General', sort_order);
    const goal = db.prepare('SELECT * FROM atlas_goals WHERE id = ?').get(result.lastInsertRowid);
    res.json({ success: true, data: goal });
  } catch (err) {
    sendError(res, err);
  }
});

// PATCH /api/atlas/:id — update milestone
router.patch('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const fields = ['name', 'description', 'target_amount', 'current_amount', 'deadline', 'category', 'status'];
    const updates = [];
    const values = [];
    for (const f of fields) {
      if (req.body[f] !== undefined) {
        updates.push(`${f} = ?`);
        values.push(req.body[f]);
      }
    }
    if (updates.length === 0) {
      return res.status(400).json({ success: false, error: 'No fields to update' });
    }
    if (req.body.current_amount !== undefined) {
      const goal = db.prepare('SELECT target_amount FROM atlas_goals WHERE id = ? AND user_id = ?').get(id, req.userId);
      if (goal && req.body.current_amount >= goal.target_amount && req.body.status !== 'active') {
        if (!updates.includes('status = ?')) {
          updates.push('status = ?');
          values.push('completed');
        }
      }
    }
    if (req.body.status === 'completed') {
      updates.push("completed_at = datetime('now')");
    } else if (req.body.status && req.body.status !== 'completed') {
      updates.push('completed_at = NULL');
    }
    values.push(id, req.userId);
    db.prepare(`UPDATE atlas_goals SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`).run(...values);
    const updated = db.prepare('SELECT * FROM atlas_goals WHERE id = ? AND user_id = ?').get(id, req.userId);
    res.json({ success: true, data: updated });
  } catch (err) {
    sendError(res, err);
  }
});

// DELETE /api/atlas/:id
router.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;
    db.prepare('DELETE FROM atlas_goals WHERE id = ? AND user_id = ?').run(id, req.userId);
    res.json({ success: true });
  } catch (err) {
    sendError(res, err);
  }
});

module.exports = router;
