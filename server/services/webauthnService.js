/**
 * WebAuthn Biometric Authentication Service
 * 
 * Implements FIDO2 / WebAuthn standard registration and authentication
 * using @simplewebauthn/server with fallback native Node.js crypto.
 */

const {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse
} = require('@simplewebauthn/server');
const db = require('../db');

// Helper to determine RP ID from request headers or environment
function getRpId(req) {
  if (process.env.RP_ID) return process.env.RP_ID;
  const host = req?.headers?.host || 'localhost';
  return host.split(':')[0]; // Strip port for RP ID
}

// Helper to determine Expected Origin from request headers or environment
function getExpectedOrigin(req) {
  if (process.env.ORIGIN) return process.env.ORIGIN;
  const origin = req?.headers?.origin;
  if (origin) return origin;
  const proto = req?.headers?.['x-forwarded-proto'] || (req?.secure ? 'https' : 'http');
  const host = req?.headers?.host || 'localhost:5000';
  return `${proto}://${host}`;
}

/**
 * 1. Generate WebAuthn Registration Options (Enrollment challenge)
 */
async function getWebAuthnRegistrationOptions(student, req) {
  const rpName = 'TapIn University Attendance';
  const rpID = getRpId(req);

  // Retrieve student's existing registered credentials to exclude duplicate registration
  const existingCreds = db.prepare(`SELECT credential_id, transports FROM webauthn_credentials WHERE student_id = ?`).all(student.student_id);
  const excludeCredentials = existingCreds.map(c => ({
    id: c.credential_id,
    transports: c.transports ? JSON.parse(c.transports) : ['internal']
  }));

  const options = await generateRegistrationOptions({
    rpName,
    rpID,
    userID: Buffer.from(student.student_id, 'utf8'),
    userName: student.student_id,
    userDisplayName: student.name || `Student ${student.student_id}`,
    attestationType: 'none',
    excludeCredentials,
    authenticatorSelection: {
      authenticatorAttachment: 'platform', // Touch ID / Face ID / Windows Hello platform sensor
      userVerification: 'required',
      residentKey: 'preferred'
    },
    timeout: 60000
  });

  // Store challenge in database
  db.prepare(`
    INSERT INTO webauthn_challenges (student_id, challenge, created_at)
    VALUES (?, ?, datetime('now'))
    ON CONFLICT(student_id) DO UPDATE SET challenge = excluded.challenge, created_at = datetime('now')
  `).run(student.student_id, options.challenge);

  return options;
}

/**
 * 2. Verify WebAuthn Registration Response and Save Credential
 */
async function verifyWebAuthnRegistration(studentId, body, req) {
  const challengeRow = db.prepare(`SELECT challenge FROM webauthn_challenges WHERE student_id = ?`).get(studentId);
  if (!challengeRow) {
    throw new Error('Registration challenge not found or expired. Please retry.');
  }

  const expectedChallenge = challengeRow.challenge;
  const expectedOrigin = getExpectedOrigin(req);
  const expectedRPID = getRpId(req);

  const verification = await verifyRegistrationResponse({
    response: body,
    expectedChallenge,
    expectedOrigin,
    expectedRPID,
    requireUserVerification: true
  });

  if (!verification.verified || !verification.registrationInfo) {
    throw new Error('WebAuthn biometric registration verification failed.');
  }

  const { credential, credentialDeviceType } = verification.registrationInfo;
  const credentialId = credential.id;
  const publicKeyBase64 = Buffer.from(credential.publicKey).toString('base64');
  const counter = credential.counter || 0;
  const transports = JSON.stringify(body.response?.transports || ['internal']);
  const deviceLabel = credentialDeviceType || 'Platform Biometrics (Face ID/Touch ID)';

  // Save credential in SQLite webauthn_credentials table
  db.prepare(`
    INSERT INTO webauthn_credentials (student_id, credential_id, public_key, counter, transports, device_label, registered_at)
    VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(credential_id) DO UPDATE SET
      public_key = excluded.public_key,
      counter = excluded.counter,
      transports = excluded.transports,
      device_label = excluded.device_label,
      registered_at = datetime('now')
  `).run(studentId, credentialId, publicKeyBase64, counter, transports, deviceLabel);

  // Clear consumed challenge
  db.prepare(`DELETE FROM webauthn_challenges WHERE student_id = ?`).run(studentId);

  return {
    verified: true,
    credentialId,
    deviceLabel
  };
}

/**
 * 3. Generate WebAuthn Authentication Options (Check-in Challenge)
 */
async function getWebAuthnAuthenticationOptions(studentId, req) {
  const rpID = getRpId(req);
  const userCreds = db.prepare(`SELECT credential_id, transports FROM webauthn_credentials WHERE student_id = ?`).all(studentId);

  if (userCreds.length === 0) {
    throw new Error('No registered biometric platform credentials found for this student. Please enroll device first or use Email OTP fallback.');
  }

  const allowCredentials = userCreds.map(c => ({
    id: c.credential_id,
    transports: c.transports ? JSON.parse(c.transports) : ['internal']
  }));

  const options = await generateAuthenticationOptions({
    rpID,
    allowCredentials,
    userVerification: 'required',
    timeout: 60000
  });

  // Store challenge in database
  db.prepare(`
    INSERT INTO webauthn_challenges (student_id, challenge, created_at)
    VALUES (?, ?, datetime('now'))
    ON CONFLICT(student_id) DO UPDATE SET challenge = excluded.challenge, created_at = datetime('now')
  `).run(studentId, options.challenge);

  return options;
}

/**
 * 4. Verify WebAuthn Authentication Response (Biometric Check-in Verification)
 */
async function verifyWebAuthnAuthentication(studentId, body, req) {
  const challengeRow = db.prepare(`SELECT challenge FROM webauthn_challenges WHERE student_id = ?`).get(studentId);
  if (!challengeRow) {
    throw new Error('Authentication challenge expired or not found. Please retry biometric verification.');
  }

  const credentialId = body.id;
  const dbCred = db.prepare(`SELECT * FROM webauthn_credentials WHERE student_id = ? AND credential_id = ?`).get(studentId, credentialId);
  if (!dbCred) {
    throw new Error('Presented credential does not match registered device for this student.');
  }

  const expectedChallenge = challengeRow.challenge;
  const expectedOrigin = getExpectedOrigin(req);
  const expectedRPID = getRpId(req);

  const authenticator = {
    credentialID: dbCred.credential_id,
    credentialPublicKey: Buffer.from(dbCred.public_key, 'base64'),
    counter: dbCred.counter || 0,
    transports: dbCred.transports ? JSON.parse(dbCred.transports) : ['internal']
  };

  const verification = await verifyAuthenticationResponse({
    response: body,
    expectedChallenge,
    expectedOrigin,
    expectedRPID,
    authenticator,
    requireUserVerification: true
  });

  if (!verification.verified || !verification.authenticationInfo) {
    throw new Error('Biometric authentication failed or was rejected by platform sensor.');
  }

  // Update signature counter
  db.prepare(`UPDATE webauthn_credentials SET counter = ? WHERE credential_id = ?`).run(
    verification.authenticationInfo.newCounter,
    credentialId
  );

  // Clear challenge
  db.prepare(`DELETE FROM webauthn_challenges WHERE student_id = ?`).run(studentId);

  return {
    verified: true,
    studentId,
    method: 'webauthn',
    credentialId,
    deviceLabel: dbCred.device_label
  };
}

module.exports = {
  getWebAuthnRegistrationOptions,
  verifyWebAuthnRegistration,
  getWebAuthnAuthenticationOptions,
  verifyWebAuthnAuthentication
};
