const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config');

function auth(req, res, next) {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ success: false, error: 'Not authenticated' });
  const token = header.replace('Bearer ', '');
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.id;
    next();
  } catch {
    res.status(401).json({ success: false, error: 'Invalid token' });
  }
}

module.exports = auth;
