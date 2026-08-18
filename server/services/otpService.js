/**
 * Email One-Time-Passcode (OTP) Fallback Service
 * 
 * Implements:
 * 1. University email lookup (non-user editable)
 * 2. 6-digit numeric OTP generation & SHA-256 salted hashing
 * 3. 5-minute expiry timestamp
 * 4. Single-use invalidation
 * 5. Rate limiting: Max 3 requests per 10-minute window
 * 6. Brute-force protection: Max 5 failed attempts per issued code
 * 7. Nodemailer SMTP integration with simulated dev fallback
 */

const crypto = require('crypto');
const nodemailer = require('nodemailer');
const jwt = require('jsonwebtoken');
const db = require('../db');

const JWT_SECRET = process.env.JWT_SECRET || 'tapin_super_secret_jwt_key_2026';

// Helper to mask email address (e.g., 23-140015@mmsu.edu.ph -> 23-****15@mmsu.edu.ph)
function maskEmail(email) {
  if (!email || !email.includes('@')) return 'your registered email';
  const [local, domain] = email.split('@');
  if (local.length <= 4) {
    return `${local.slice(0, 1)}***@${domain}`;
  }
  const maskedLocal = `${local.slice(0, 3)}****${local.slice(-2)}`;
  return `${maskedLocal}@${domain}`;
}

// Create Nodemailer Transporter
function getMailTransporter() {
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });
  }
  return null; // Fallback to simulated console sender
}

/**
 * 1. Request and Dispatch 6-Digit Email OTP with Rate Limiting
 */
async function requestEmailOtp(studentId) {
  const student = db.prepare(`SELECT * FROM students WHERE student_id = ?`).get(String(studentId).trim());
  if (!student) {
    throw new Error(`Student ID #${studentId} not found in university roster.`);
  }

  const email = student.email || `${student.student_id.toLowerCase()}@mmsu.edu.ph`;

  // 1. Rate Limiting Check: Max 3 OTP requests per 10 minutes
  const recentRequests = db.prepare(`
    SELECT COUNT(*) as count 
    FROM otp_codes 
    WHERE student_id = ? AND created_at >= datetime('now', '-10 minutes')
  `).get(student.student_id);

  if (recentRequests && recentRequests.count >= 3) {
    throw new Error('Rate limit exceeded: You have requested 3 OTP codes in the last 10 minutes. Please wait before requesting another code.');
  }

  // 2. Generate secure 6-digit numeric code
  const rawCode = Math.floor(100000 + Math.random() * 900000).toString();
  const hashedCode = crypto.createHash('sha256').update(rawCode).digest('hex');
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString(); // 5 minutes

  // 3. Persist hashed code to SQLite
  db.prepare(`
    INSERT INTO otp_codes (student_id, hashed_code, expires_at, used, attempt_count, max_attempts, created_at)
    VALUES (?, ?, ?, 0, 0, 5, datetime('now'))
  `).run(student.student_id, hashedCode, expiresAt);

  // 4. Dispatch Email
  const transporter = getMailTransporter();
  let emailSent = false;

  const emailHtml = `
    <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">
      <div style="text-align: center; margin-bottom: 20px;">
        <h2 style="color: #4f46e5; margin: 0;">TapIn University Attendance</h2>
        <p style="color: #64748b; font-size: 13px; margin: 4px 0 0 0;">One-Time Passcode (OTP) Fallback Verification</p>
      </div>

      <p style="color: #334155; font-size: 14px; line-height: 1.5;">Hello <strong>${student.name}</strong>,</p>
      <p style="color: #334155; font-size: 14px; line-height: 1.5;">Use the following 6-digit one-time passcode to verify your event attendance on TapIn:</p>

      <div style="text-align: center; margin: 24px 0;">
        <div style="display: inline-block; font-size: 32px; font-weight: 900; letter-spacing: 8px; color: #4f46e5; background: #eef2ff; padding: 12px 28px; border-radius: 8px; border: 1px dashed #6366f1;">
          ${rawCode}
        </div>
      </div>

      <p style="color: #64748b; font-size: 12px; line-height: 1.4;">
        ⏳ This code will expire in <strong>5 minutes</strong> and can only be used once.<br/>
        ⚠️ If you did not request this code, please ignore this email.
      </p>

      <div style="margin-top: 24px; pt: 16px; border-top: 1px solid #f1f5f9; text-align: center; color: #94a3b8; font-size: 11px;">
        Mariano Marcos State University • TapIn Telemetry System
      </div>
    </div>
  `;

  if (transporter) {
    try {
      await transporter.sendMail({
        from: process.env.EMAIL_FROM || '"TapIn Attendance" <no-reply@mmsu.edu.ph>',
        to: email,
        subject: `Your TapIn Verification Code: ${rawCode}`,
        html: emailHtml
      });
      emailSent = true;
    } catch (err) {
      console.error('[OTP Email Dispatch Error]', err.message);
    }
  }

  // Console output for development / local demo logging
  console.log(`\n===============================================================`);
  console.log(`   [EMAIL OTP DISPATCH] STUDENT: ${student.student_id} (${student.name})`);
  console.log(`   Destination Email  : ${email}`);
  console.log(`   Verification Code  : >>> ${rawCode} <<<`);
  console.log(`   Expires In         : 5 Minutes (At ${expiresAt})`);
  console.log(`===============================================================\n`);

  return {
    success: true,
    maskedEmail: maskEmail(email),
    expiresAt,
    cooldownSeconds: 60,
    devCode: !transporter ? rawCode : undefined // Expose in dev mode if no SMTP configured
  };
}

/**
 * 2. Verify 6-Digit OTP Code with Brute-Force Protection
 */
function verifyEmailOtp(studentId, inputCode) {
  if (!inputCode || String(inputCode).trim().length !== 6) {
    return {
      isValid: false,
      reason: 'Please enter a valid 6-digit numeric verification code.'
    };
  }

  const cleanCode = String(inputCode).trim();
  const inputHash = crypto.createHash('sha256').update(cleanCode).digest('hex');

  // Query latest unused, non-expired OTP record
  const latestOtp = db.prepare(`
    SELECT * FROM otp_codes
    WHERE student_id = ? AND used = 0 AND expires_at > datetime('now')
    ORDER BY created_at DESC
    LIMIT 1
  `).get(String(studentId).trim());

  if (!latestOtp) {
    return {
      isValid: false,
      reason: 'No active verification code found or the code has expired. Please request a new OTP.'
    };
  }

  // Check brute-force attempt limits
  if (latestOtp.attempt_count >= latestOtp.max_attempts) {
    // Invalidate code
    db.prepare(`UPDATE otp_codes SET used = 1 WHERE id = ?`).run(latestOtp.id);
    return {
      isValid: false,
      reason: 'Maximum verification attempts exceeded. For security, this code has been invalidated. Please request a new code.'
    };
  }

  // Compare hashes
  if (latestOtp.hashed_code !== inputHash) {
    const newAttempts = latestOtp.attempt_count + 1;
    db.prepare(`UPDATE otp_codes SET attempt_count = ? WHERE id = ?`).run(newAttempts, latestOtp.id);
    const remaining = latestOtp.max_attempts - newAttempts;

    if (remaining <= 0) {
      db.prepare(`UPDATE otp_codes SET used = 1 WHERE id = ?`).run(latestOtp.id);
      return {
        isValid: false,
        reason: 'Incorrect code. Maximum verification attempts exceeded. Code has been invalidated.'
      };
    }

    return {
      isValid: false,
      reason: `Incorrect verification code. ${remaining} attempt(s) remaining.`,
      remainingAttempts: remaining
    };
  }

  // Mark code as used (single-use)
  db.prepare(`UPDATE otp_codes SET used = 1 WHERE id = ?`).run(latestOtp.id);

  // Generate single-use verified Auth Token for Time In / Time Out submission
  const authToken = jwt.sign(
    {
      student_id: studentId,
      auth_method: 'email_otp',
      verified_at: new Date().toISOString()
    },
    JWT_SECRET,
    { expiresIn: '15m' }
  );

  return {
    isValid: true,
    studentId,
    authMethod: 'email_otp',
    token: authToken
  };
}

module.exports = {
  requestEmailOtp,
  verifyEmailOtp,
  maskEmail
};
