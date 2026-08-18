const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { authenticateToken, requireRole, JWT_SECRET } = require('../middleware/auth');

const router = express.Router();

// Admin Login
router.post('/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }

  const admin = db.prepare(`SELECT * FROM admins WHERE username = ?`).get(username);
  if (!admin) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const isValid = bcrypt.compareSync(password, admin.password_hash);
  if (!isValid) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = jwt.sign(
    { id: admin.id, username: admin.username, role: admin.role },
    JWT_SECRET,
    { expiresIn: '24h' }
  );

  res.json({
    token,
    user: {
      id: admin.id,
      username: admin.username,
      role: admin.role
    }
  });
});

// Verify current session token
router.get('/me', authenticateToken, (req, res) => {
  res.json({ user: req.user });
});

// Superadmin: List all admins
router.get('/admins', authenticateToken, requireRole(['superadmin']), (req, res) => {
  const admins = db.prepare(`SELECT id, username, role, created_at FROM admins ORDER BY id ASC`).all();
  res.json(admins);
});

// Superadmin: Create new admin
router.post('/admins', authenticateToken, requireRole(['superadmin']), (req, res) => {
  const { username, password, role = 'admin' } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }

  const existing = db.prepare(`SELECT id FROM admins WHERE username = ?`).get(username);
  if (existing) {
    return res.status(400).json({ error: 'Username already exists' });
  }

  const hash = bcrypt.hashSync(password, 10);
  const result = db.prepare(`
    INSERT INTO admins (username, password_hash, role)
    VALUES (?, ?, ?)
  `).run(username, hash, role);

  res.status(201).json({
    message: 'Admin account created successfully',
    admin: {
      id: result.lastInsertRowid,
      username,
      role
    }
  });
});

// Superadmin: Edit admin account
router.put('/admins/:id', authenticateToken, requireRole(['superadmin']), (req, res) => {
  const { id } = req.params;
  const { username, password, role } = req.body;

  const admin = db.prepare(`SELECT * FROM admins WHERE id = ?`).get(id);
  if (!admin) {
    return res.status(404).json({ error: 'Admin account not found' });
  }

  let updateQuery = `UPDATE admins SET username = ?, role = ?`;
  const params = [username || admin.username, role || admin.role];

  if (password && password.trim() !== '') {
    updateQuery += `, password_hash = ?`;
    params.push(bcrypt.hashSync(password, 10));
  }

  updateQuery += ` WHERE id = ?`;
  params.push(id);

  db.prepare(updateQuery).run(...params);

  res.json({ message: 'Admin account updated successfully' });
});

// Superadmin: Delete admin account
router.delete('/admins/:id', authenticateToken, requireRole(['superadmin']), (req, res) => {
  const { id } = req.params;

  const admin = db.prepare(`SELECT * FROM admins WHERE id = ?`).get(id);
  if (!admin) {
    return res.status(404).json({ error: 'Admin account not found' });
  }

  if (admin.role === 'superadmin' && req.user.id === parseInt(id)) {
    return res.status(400).json({ error: 'Cannot delete your own superadmin account' });
  }

  db.prepare(`DELETE FROM admins WHERE id = ?`).run(id);
  res.json({ message: 'Admin account deleted successfully' });
});

// ============================================================================
// 1. WebAuthn Biometric Platform Authentication Endpoints
// ============================================================================
const {
  getWebAuthnRegistrationOptions,
  verifyWebAuthnRegistration,
  getWebAuthnAuthenticationOptions,
  verifyWebAuthnAuthentication
} = require('../services/webauthnService');

// Get WebAuthn Registration Options (Enrollment challenge)
router.post('/webauthn/register-options', async (req, res) => {
  const { student_id } = req.body;
  if (!student_id) {
    return res.status(400).json({ error: 'Student ID is required' });
  }

  const student = db.prepare(`SELECT * FROM students WHERE student_id = ?`).get(String(student_id).trim());
  if (!student) {
    return res.status(404).json({ error: `Student ID #${student_id} not found in student roster.` });
  }

  try {
    const options = await getWebAuthnRegistrationOptions(student, req);
    res.json(options);
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate WebAuthn registration options: ' + err.message });
  }
});

// Verify WebAuthn Registration and Store Platform Credential
router.post('/webauthn/register-verify', async (req, res) => {
  const { student_id, response } = req.body;
  if (!student_id || !response) {
    return res.status(400).json({ error: 'Student ID and WebAuthn credential response are required' });
  }

  try {
    const result = await verifyWebAuthnRegistration(String(student_id).trim(), response, req);
    res.json({
      success: true,
      message: 'Biometric device credential enrolled successfully!',
      result
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Check if Student has registered WebAuthn platform biometrics on file
router.get('/webauthn/status/:studentId', (req, res) => {
  const { studentId } = req.params;
  const creds = db.prepare(`
    SELECT credential_id, device_label, registered_at 
    FROM webauthn_credentials 
    WHERE student_id = ?
  `).all(String(studentId).trim());

  res.json({
    student_id: studentId,
    has_webauthn: creds.length > 0,
    credentials: creds
  });
});

// Get WebAuthn Authentication Options (Check-in Challenge)
router.post('/webauthn/login-options', async (req, res) => {
  const { student_id } = req.body;
  if (!student_id) {
    return res.status(400).json({ error: 'Student ID is required' });
  }

  try {
    const options = await getWebAuthnAuthenticationOptions(String(student_id).trim(), req);
    res.json(options);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Verify WebAuthn Authentication (Biometric check-in verification)
router.post('/webauthn/login-verify', async (req, res) => {
  const { student_id, response } = req.body;
  if (!student_id || !response) {
    return res.status(400).json({ error: 'Student ID and biometric response are required' });
  }

  try {
    const result = await verifyWebAuthnAuthentication(String(student_id).trim(), response, req);
    
    // Generate single-use JWT verification token for attendance submission
    const authToken = jwt.sign(
      {
        student_id: String(student_id).trim(),
        auth_method: 'webauthn',
        credential_id: result.credentialId,
        verified_at: new Date().toISOString()
      },
      JWT_SECRET,
      { expiresIn: '15m' }
    );

    res.json({
      success: true,
      auth_method: 'webauthn',
      token: authToken,
      result
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ============================================================================
// 2. Email One-Time-Passcode (OTP) Fallback Endpoints
// ============================================================================
const { requestEmailOtp, verifyEmailOtp } = require('../services/otpService');

// Request 6-Digit Email OTP (With Rate Limiting)
router.post('/otp/request', async (req, res) => {
  const { student_id } = req.body;
  if (!student_id) {
    return res.status(400).json({ error: 'Student ID is required' });
  }

  try {
    const result = await requestEmailOtp(String(student_id).trim());
    res.json(result);
  } catch (err) {
    res.status(429).json({ error: err.message });
  }
});

// Verify 6-Digit Email OTP (With Brute-Force Protection)
router.post('/otp/verify', (req, res) => {
  const { student_id, code } = req.body;
  if (!student_id || !code) {
    return res.status(400).json({ error: 'Student ID and 6-digit OTP code are required' });
  }

  const result = verifyEmailOtp(String(student_id).trim(), code);
  if (!result.isValid) {
    return res.status(400).json({
      error: result.reason,
      remainingAttempts: result.remainingAttempts
    });
  }

  res.json({
    success: true,
    auth_method: 'email_otp',
    token: result.token,
    student_id: result.studentId
  });
});

module.exports = router;

