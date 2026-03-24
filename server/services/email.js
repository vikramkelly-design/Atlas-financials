// Email service — uses console logging as fallback when no email provider configured
// To enable real emails: npm install resend, set RESEND_API_KEY in .env

let resend = null;
try {
  const { Resend } = require('resend');
  if (process.env.RESEND_API_KEY) {
    resend = new Resend(process.env.RESEND_API_KEY);
  }
} catch {
  // resend not installed, use console fallback
}

const FROM_EMAIL = process.env.FROM_EMAIL || 'Atlas <noreply@atlas-finance.app>';

async function sendEmail(to, subject, html) {
  if (resend) {
    try {
      await resend.emails.send({ from: FROM_EMAIL, to, subject, html });
      return true;
    } catch (err) {
      console.error('[Email] Send failed:', err.message);
    }
  }

  // Fallback: log to console (useful during development)
  console.log(`\n[Email] To: ${to}`);
  console.log(`[Email] Subject: ${subject}`);
  console.log(`[Email] Body: ${html.replace(/<[^>]*>/g, '')}\n`);
  return true;
}

async function sendVerificationCode(email, code) {
  return sendEmail(email, 'Your Atlas Verification Code', `
    <div style="font-family: sans-serif; max-width: 400px; margin: 0 auto; padding: 2rem;">
      <h1 style="color: #C9A84C; font-size: 1.5rem;">Atlas Finance</h1>
      <p style="color: #6B1A1A;">Your verification code is:</p>
      <div style="background: #1B2A4A; color: #C9A84C; font-size: 2rem; font-weight: 700; text-align: center; padding: 1rem; border-radius: 4px; letter-spacing: 0.3em; margin: 1rem 0;">
        ${code}
      </div>
      <p style="color: #8B3A3A; font-size: 0.85rem;">This code expires in 15 minutes.</p>
    </div>
  `);
}

async function sendPasswordReset(email, token) {
  return sendEmail(email, 'Reset Your Atlas Password', `
    <div style="font-family: sans-serif; max-width: 400px; margin: 0 auto; padding: 2rem;">
      <h1 style="color: #C9A84C; font-size: 1.5rem;">Atlas Finance</h1>
      <p style="color: #6B1A1A;">Use this code to reset your password:</p>
      <div style="background: #1B2A4A; color: #C9A84C; font-size: 1.5rem; font-weight: 700; text-align: center; padding: 1rem; border-radius: 4px; letter-spacing: 0.1em; margin: 1rem 0;">
        ${token}
      </div>
      <p style="color: #8B3A3A; font-size: 0.85rem;">This code expires in 1 hour. If you didn't request a password reset, ignore this email.</p>
    </div>
  `);
}

module.exports = { sendEmail, sendVerificationCode, sendPasswordReset };
