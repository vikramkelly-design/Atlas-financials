const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error('FATAL: JWT_SECRET environment variable is required. Set it in server/.env');
  process.exit(1);
}

module.exports = { JWT_SECRET };
