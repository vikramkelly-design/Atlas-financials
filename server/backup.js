const cron = require('node-cron')
const fs = require('fs')
const path = require('path')

const DB_PATH = path.join(__dirname, 'finwise.db')
const BACKUP_DIR = path.join(__dirname, 'backups')
const DAYS_TO_KEEP = 30

const runBackup = () => {
  try {
    if (!fs.existsSync(DB_PATH)) {
      console.error('[Backup] Database file not found at:', DB_PATH)
      return
    }

    if (!fs.existsSync(BACKUP_DIR)) {
      fs.mkdirSync(BACKUP_DIR, { recursive: true })
    }

    const timestamp = new Date().toISOString().slice(0, 10)
    const backupPath = path.join(BACKUP_DIR, `finwise-backup-${timestamp}.db`)

    fs.copyFileSync(DB_PATH, backupPath)
    console.log(`[Backup] Success: finwise-backup-${timestamp}.db`)

    const files = fs.readdirSync(BACKUP_DIR)
    files.forEach(file => {
      const filePath = path.join(BACKUP_DIR, file)
      const stats = fs.statSync(filePath)
      const daysOld = (Date.now() - stats.mtimeMs) / (1000 * 60 * 60 * 24)
      if (daysOld > DAYS_TO_KEEP) {
        fs.unlinkSync(filePath)
        console.log(`[Backup] Deleted old backup: ${file}`)
      }
    })

  } catch (err) {
    console.error('[Backup] Failed:', err.message)
  }
}

const scheduleBackup = () => {
  cron.schedule('0 2 * * *', () => {
    console.log('[Backup] Running scheduled backup...')
    runBackup()
  })
  console.log('[Backup] Scheduler started. Runs daily at 2am.')
}

const runImmediateBackup = () => {
  console.log('[Backup] Running startup backup...')
  runBackup()
}

module.exports = { scheduleBackup, runImmediateBackup }
