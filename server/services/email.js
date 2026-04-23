const { Resend } = require('resend');

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const FROM_EMAIL = 'Atlas <onboarding@resend.dev>';
const APP_URL = process.env.APP_URL || 'http://localhost:5173';

async function sendEmail(to, subject, html) {
  if (resend) {
    try {
      await resend.emails.send({ from: FROM_EMAIL, to, subject, html });
      console.log(`[Email] Sent to ${to}: ${subject}`);
      return true;
    } catch (err) {
      console.error('[Email] Send failed:', err.message);
    }
  }

  // Fallback: log to console
  console.log(`\n[Email] To: ${to}`);
  console.log(`[Email] Subject: ${subject}`);
  console.log(`[Email] Body: ${html.replace(/<[^>]*>/g, '')}\n`);
  return true;
}

async function sendPasswordReset(email, token) {
  const resetLink = `${APP_URL}/reset-password?token=${token}`;
  return sendEmail(email, 'Reset Your Atlas Password', `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; padding: 2rem; background: #0D1B2A; border-radius: 8px;">
      <h1 style="color: #C9A84C; font-size: 1.4rem; margin-bottom: 1.5rem;">Atlas</h1>
      <p style="color: #E0D6C8; font-size: 1rem; line-height: 1.6;">
        We received a request to reset your password. Click the button below to choose a new one.
      </p>
      <div style="text-align: center; margin: 2rem 0;">
        <a href="${resetLink}" style="display: inline-block; background: #C9A84C; color: #0D1B2A; text-decoration: none; font-weight: 600; font-size: 1rem; padding: 0.75rem 2rem; border-radius: 4px;">
          Reset Password
        </a>
      </div>
      <p style="color: #8B9DB8; font-size: 0.85rem; line-height: 1.5;">
        This link expires in 1 hour. If you didn't request a password reset, you can safely ignore this email.
      </p>
      <hr style="border: none; border-top: 1px solid #1B2A4A; margin: 1.5rem 0;" />
      <p style="color: #5A6A7A; font-size: 0.75rem;">
        If the button doesn't work, paste this link into your browser:<br />
        <a href="${resetLink}" style="color: #C9A84C; word-break: break-all;">${resetLink}</a>
      </p>
    </div>
  `);
}

module.exports = { sendEmail, sendPasswordReset };
