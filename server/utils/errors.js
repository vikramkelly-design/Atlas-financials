function sendError(res, err, status = 500) {
  console.error(err);
  const message = process.env.NODE_ENV === 'production'
    ? 'Internal server error'
    : err.message || 'Internal server error';
  res.status(status).json({ success: false, error: message });
}

module.exports = { sendError };
