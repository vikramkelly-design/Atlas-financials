const express = require('express');
const router = express.Router();
const db = require('../db');

// GET /api/share/score/:token — PUBLIC, no auth
router.get('/score/:token', (req, res) => {
  try {
    const row = db.prepare(
      'SELECT score, spending_score, savings_score, portfolio_score, debt_score, goals_score, created_at FROM health_scores WHERE share_token = ?'
    ).get(req.params.token);

    if (!row) {
      return res.status(404).json({ success: false, error: 'Score not found' });
    }

    // Build categories without dollar amounts
    const scoreGrade = (s) => {
      if (s >= 18) return 'A';
      if (s >= 15) return 'B+';
      if (s >= 12) return 'B';
      if (s >= 9) return 'C+';
      if (s >= 6) return 'C';
      return 'D';
    };
    const overallGrade = (t) => {
      if (t >= 90) return 'A';
      if (t >= 80) return 'B+';
      if (t >= 70) return 'B';
      if (t >= 60) return 'C+';
      if (t >= 50) return 'C';
      return 'D';
    };

    const categories = [
      { name: 'Spending', score: row.spending_score, maxScore: 20, grade: scoreGrade(row.spending_score) },
      { name: 'Savings', score: row.savings_score, maxScore: 20, grade: scoreGrade(row.savings_score) },
      { name: 'Portfolio', score: row.portfolio_score, maxScore: 20, grade: scoreGrade(row.portfolio_score) },
      { name: 'Debt', score: row.debt_score, maxScore: 20, grade: scoreGrade(row.debt_score) },
      { name: 'Goals', score: row.goals_score, maxScore: 20, grade: scoreGrade(row.goals_score) },
    ];

    res.json({
      success: true,
      data: {
        score: row.score,
        grade: overallGrade(row.score),
        categories,
        created_at: row.created_at,
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
