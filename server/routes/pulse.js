const express = require('express');
const router = express.Router();
const { generatePulse } = require('../services/pulse');

// GET /api/pulse/latest
router.get('/latest', async (req, res) => {
  try {
    const pulse = await generatePulse(req.userId);
    res.json({ success: true, data: pulse });
  } catch (err) {
    console.error('[Pulse]', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
