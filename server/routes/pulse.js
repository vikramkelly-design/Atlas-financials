const express = require('express');
const router = express.Router();
const { generatePulse } = require('../services/pulse');
const { sendError } = require('../utils/errors');

// GET /api/pulse/latest
router.get('/latest', async (req, res) => {
  try {
    const pulse = await generatePulse(req.userId);
    res.json({ success: true, data: pulse });
  } catch (err) {
    sendError(res, err);
  }
});

module.exports = router;
