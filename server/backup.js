// PostgreSQL backups are handled by Railway's built-in database backup system.
// No manual file-based backup is needed.
//
// To export your data from Railway:
//   1. Go to your Railway project dashboard
//   2. Click your PostgreSQL plugin
//   3. Use the "Data" tab to browse tables
//   4. Use "Connect" tab to get connection string for pg_dump:
//      pg_dump "your-connection-string" > backup.sql

const scheduleBackup = () => {
  console.log('[Backup] Using Railway PostgreSQL — backups handled by Railway automatically.');
};

const runImmediateBackup = () => {
  // No-op for PostgreSQL on Railway
};

module.exports = { scheduleBackup, runImmediateBackup };
