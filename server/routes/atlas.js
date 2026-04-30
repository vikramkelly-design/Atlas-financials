const express = require('express');
const router = express.Router();
const db = require('../db');
const { sendError } = require('../utils/errors');

router.get('/ultimate', async (req, res) => {
  try {
    const goals = await db.all('SELECT * FROM atlas_ultimate_goals WHERE user_id = $1 ORDER BY created_at ASC', [req.userId]);
    res.json({ success: true, data: goals });
  } catch (err) { sendError(res, err); }
});

router.post('/ultimate', async (req, res) => {
  try {
    const { name, description, target_amount, deadline, category } = req.body;
    if (!name || !target_amount || !deadline) return res.status(400).json({ success: false, error: 'Name, target amount, and deadline are required' });
    const count = await db.get('SELECT COUNT(*) as cnt FROM atlas_ultimate_goals WHERE user_id = $1', [req.userId]);
    if (parseInt(count.cnt) >= 5) return res.status(400).json({ success: false, error: 'Maximum of 5 ultimate goals allowed' });
    const result = await db.get(
      'INSERT INTO atlas_ultimate_goals (user_id, name, description, target_amount, deadline, category) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
      [req.userId, name, description || null, target_amount, deadline, category || 'General']
    );
    const goal = await db.get('SELECT * FROM atlas_ultimate_goals WHERE id = $1', [result.id]);
    res.json({ success: true, data: goal });
  } catch (err) { sendError(res, err); }
});

router.patch('/ultimate/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const fields = ['name', 'description', 'target_amount', 'deadline', 'category', 'status'];
    const updates = [];
    const values = [];
    let paramIdx = 1;
    for (const f of fields) {
      if (req.body[f] !== undefined) { updates.push(`${f} = $${paramIdx++}`); values.push(req.body[f]); }
    }
    if (updates.length === 0) return res.status(400).json({ success: false, error: 'No fields to update' });
    if (req.body.status === 'completed') { updates.push(`completed_at = NOW()`); }
    else if (req.body.status && req.body.status !== 'completed') { updates.push('completed_at = NULL'); }
    values.push(id, req.userId);
    await db.run(`UPDATE atlas_ultimate_goals SET ${updates.join(', ')} WHERE id = $${paramIdx++} AND user_id = $${paramIdx}`, values);
    const updated = await db.get('SELECT * FROM atlas_ultimate_goals WHERE id = $1 AND user_id = $2', [id, req.userId]);
    res.json({ success: true, data: updated });
  } catch (err) { sendError(res, err); }
});

router.delete('/ultimate/:id', async (req, res) => {
  try {
    await db.run('DELETE FROM atlas_ultimate_goals WHERE id = $1 AND user_id = $2', [req.params.id, req.userId]);
    res.json({ success: true });
  } catch (err) { sendError(res, err); }
});

router.get('/milestones/:ultimateId', async (req, res) => {
  try {
    const goals = await db.all('SELECT * FROM atlas_goals WHERE user_id = $1 AND ultimate_goal_id = $2 ORDER BY sort_order ASC', [req.userId, req.params.ultimateId]);
    res.json({ success: true, data: goals });
  } catch (err) { sendError(res, err); }
});

router.get('/current', async (req, res) => {
  try {
    const goal = await db.get(`
      SELECT g.*, u.name as ultimate_name FROM atlas_goals g
      JOIN atlas_ultimate_goals u ON g.ultimate_goal_id = u.id
      WHERE g.user_id = $1 AND g.status = 'active'
      ORDER BY g.sort_order ASC LIMIT 1
    `, [req.userId]);
    res.json({ success: true, data: goal || null });
  } catch (err) { sendError(res, err); }
});

router.post('/milestone', async (req, res) => {
  try {
    const { ultimate_goal_id, name, description, target_amount, deadline, category } = req.body;
    if (!ultimate_goal_id || !name || !target_amount || !deadline) return res.status(400).json({ success: false, error: 'Ultimate goal, name, target amount, and deadline are required' });
    const maxOrder = await db.get('SELECT COALESCE(MAX(sort_order), -1) as mx FROM atlas_goals WHERE user_id = $1 AND ultimate_goal_id = $2', [req.userId, ultimate_goal_id]);
    const sort_order = (maxOrder?.mx ?? -1) + 1;
    const result = await db.get(
      'INSERT INTO atlas_goals (user_id, ultimate_goal_id, name, description, target_amount, deadline, category, sort_order) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id',
      [req.userId, ultimate_goal_id, name, description || null, target_amount, deadline, category || 'General', sort_order]
    );
    const goal = await db.get('SELECT * FROM atlas_goals WHERE id = $1', [result.id]);
    res.json({ success: true, data: goal });
  } catch (err) { sendError(res, err); }
});

router.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const fields = ['name', 'description', 'target_amount', 'current_amount', 'deadline', 'category', 'status'];
    const updates = [];
    const values = [];
    let paramIdx = 1;
    for (const f of fields) {
      if (req.body[f] !== undefined) { updates.push(`${f} = $${paramIdx++}`); values.push(req.body[f]); }
    }
    if (updates.length === 0) return res.status(400).json({ success: false, error: 'No fields to update' });
    if (req.body.current_amount !== undefined) {
      const goal = await db.get('SELECT target_amount FROM atlas_goals WHERE id = $1 AND user_id = $2', [id, req.userId]);
      if (goal && req.body.current_amount >= goal.target_amount && req.body.status !== 'active') {
        if (!updates.some(u => u.startsWith('status'))) { updates.push(`status = $${paramIdx++}`); values.push('completed'); }
      }
    }
    if (req.body.status === 'completed') { updates.push(`completed_at = NOW()`); }
    else if (req.body.status && req.body.status !== 'completed') { updates.push('completed_at = NULL'); }
    values.push(id, req.userId);
    await db.run(`UPDATE atlas_goals SET ${updates.join(', ')} WHERE id = $${paramIdx++} AND user_id = $${paramIdx}`, values);
    const updated = await db.get('SELECT * FROM atlas_goals WHERE id = $1 AND user_id = $2', [id, req.userId]);
    res.json({ success: true, data: updated });
  } catch (err) { sendError(res, err); }
});

router.delete('/:id', async (req, res) => {
  try {
    await db.run('DELETE FROM atlas_goals WHERE id = $1 AND user_id = $2', [req.params.id, req.userId]);
    res.json({ success: true });
  } catch (err) { sendError(res, err); }
});

module.exports = router;
