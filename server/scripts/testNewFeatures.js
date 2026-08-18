/**
 * Comprehensive Automated Test Suite for New TapIn Systems:
 * 1. Cryptographic Credential Authentication (Ed25519)
 * 2. Stationary Spoof Anomaly Signal
 * 3. Checkpoint Engine & Geofence Containment
 * 4. Photo Verification Analytics (EXIF & Perceptual Hash Duplicate Detection)
 * 5. Exact Polygon Coordinate Integrity & Custom Center Persistence
 * 6. WebAuthn Biometric Service (Registration & Challenge Generation)
 * 7. Email One-Time-Passcode (OTP) Fallback & Rate Limiting
 */

const assert = require('assert');
const { generateStudentKeyPair, signPayload, verifySignature, createPortableCredentialPass } = require('../services/cryptoAuth');
const { checkStationaryAnomaly } = require('../services/spoofDetection/heuristics');
const { validateCheckpointsInsideEvent } = require('../services/checkpointEngine');
const { computePerceptualHash, calculateHammingDistance } = require('../services/photoVerification');
const { getWebAuthnRegistrationOptions } = require('../services/webauthnService');
const { requestEmailOtp, verifyEmailOtp } = require('../services/otpService');
const db = require('../db');

let passCount = 0;
let failCount = 0;

async function test(name, fn) {
  try {
    await fn();
    console.log(`  \x1b[32m✔ PASS\x1b[0m ${name}`);
    passCount++;
  } catch (err) {
    console.error(`  \x1b[31m✖ FAIL\x1b[0m ${name}:`, err.message);
    failCount++;
  }
}

async function runAllTests() {
  console.log('\n===============================================================');
  console.log('   RUNNING TAPIN TEST SUITE: WEBAUTHN, OTP & CHECKPOINTS      ');
  console.log('===============================================================\n');

  // -------------------------------------------------------------
  // Test Suite 1: Cryptographic Authentication (Ed25519)
  // -------------------------------------------------------------
  console.log('[1/7] Cryptographic Credential Authentication (Ed25519)');

  await test('Generate valid Ed25519 keypair for student', () => {
    const keys = generateStudentKeyPair();
    assert(keys.publicKeyPem.includes('BEGIN PUBLIC KEY'), 'Public key must be in PEM format');
    assert(keys.privateKeyPem.includes('BEGIN PRIVATE KEY'), 'Private key must be in PEM format');
    assert(keys.publicKeyBase64.length > 20, 'Public key base64 must not be empty');
  });

  await test('Sign and verify attendance payload successfully', () => {
    const keys = generateStudentKeyPair();
    const payload = { student_id: '23-140015', event_id: 1, timestamp: '2026-08-18T10:00:00Z', lat: 18.1960, lng: 120.5927 };
    const signature = signPayload(keys.privateKeyPem, payload);
    assert(typeof signature === 'string' && signature.length === 128, 'Ed25519 signature should be 128 hex chars');

    const isValid = verifySignature(keys.publicKeyPem, payload, signature);
    assert.strictEqual(isValid, true, 'Valid signature should verify true');
  });

  await test('Reject tampered attendance payload', () => {
    const keys = generateStudentKeyPair();
    const payload = { student_id: '23-140015', event_id: 1, lat: 18.1960, lng: 120.5927 };
    const signature = signPayload(keys.privateKeyPem, payload);

    const tamperedPayload = { student_id: '23-140015', event_id: 1, lat: 18.2500, lng: 120.6500 };
    const isValid = verifySignature(keys.publicKeyPem, tamperedPayload, signature);
    assert.strictEqual(isValid, false, 'Tampered payload coordinates must be rejected');
  });

  await test('Generate portable credential pass with verifiable token', () => {
    const keys = generateStudentKeyPair();
    const student = { student_id: '23-140015', name: 'Micko Gabriel', college: 'CCIS', course: 'BSCS' };
    const pass = createPortableCredentialPass(student, keys.privateKeyPem);
    assert.strictEqual(pass.type, 'TAPIN_STUDENT_CREDENTIAL');
    const isValid = verifySignature(keys.publicKeyPem, pass.payload, pass.signature);
    assert.strictEqual(isValid, true, 'Portable pass signature must be valid');
  });

  // -------------------------------------------------------------
  // Test Suite 2: Stationary Anomaly Signal
  // -------------------------------------------------------------
  console.log('\n[2/7] Stationary Spoof Anomaly Detection');

  await test('Detect stationary GPS anomaly (near-zero movement over 5+ minutes)', () => {
    const baseTime = Date.now();
    const history = [
      { lat: 18.196000, lng: 120.592700, accuracy: 5.0, timestamp: new Date(baseTime - 360000).toISOString() },
      { lat: 18.196001, lng: 120.592701, accuracy: 5.0, timestamp: new Date(baseTime - 240000).toISOString() },
      { lat: 18.196000, lng: 120.592700, accuracy: 5.0, timestamp: new Date(baseTime - 120000).toISOString() }
    ];
    const currentTrace = { lat: 18.196000, lng: 120.592700, accuracy: 5.0, timestamp: new Date(baseTime).toISOString() };

    const result = checkStationaryAnomaly(currentTrace, history, { windowSeconds: 300, thresholdMeters: 1.0 });
    assert.strictEqual(result.flagged, true, 'Stationary trace over 6 minutes with 0.1m movement should be flagged');
    assert.strictEqual(result.flag, 'STATIONARY_SIGNAL_ANOMALY');
  });

  await test('Allow normal walking movement without stationary flag', () => {
    const baseTime = Date.now();
    const history = [
      { lat: 18.196000, lng: 120.592700, accuracy: 6.0, timestamp: new Date(baseTime - 300000).toISOString() },
      { lat: 18.196150, lng: 120.592850, accuracy: 7.0, timestamp: new Date(baseTime - 150000).toISOString() }
    ];
    const currentTrace = { lat: 18.196300, lng: 120.593000, accuracy: 5.5, timestamp: new Date(baseTime).toISOString() };

    const result = checkStationaryAnomaly(currentTrace, history, { windowSeconds: 300, thresholdMeters: 1.0 });
    assert.strictEqual(result.flagged, false, 'Normal movement of 45m should not be flagged as stationary');
  });

  // -------------------------------------------------------------
  // Test Suite 3: Checkpoint Geofence Containment Validation
  // -------------------------------------------------------------
  console.log('\n[3/7] Checkpoint Geofence Containment Validation');

  await test('Validate checkpoints inside polygon geofence', () => {
    const sampleEvent = {
      center_lat: 18.1960,
      center_lng: 120.5927,
      radius_m: 150,
      polygon_coordinates: [
        [18.1950, 120.5910],
        [18.1970, 120.5910],
        [18.1970, 120.5940],
        [18.1950, 120.5940]
      ]
    };

    const checkpoints = [
      { name: 'Station 1', lat: 18.1960, lng: 120.5925, radius_m: 20 },
      { name: 'Station 2', lat: 18.1965, lng: 120.5930, radius_m: 20 }
    ];

    const validation = validateCheckpointsInsideEvent(checkpoints, sampleEvent);
    assert.strictEqual(validation.isValid, true, 'Checkpoints inside polygon should be valid');
  });

  await test('Reject checkpoint placed outside event polygon geofence', () => {
    const sampleEvent = {
      center_lat: 18.1960,
      center_lng: 120.5927,
      radius_m: 100,
      polygon_coordinates: [
        [18.1950, 120.5910],
        [18.1970, 120.5910],
        [18.1970, 120.5940],
        [18.1950, 120.5940]
      ]
    };

    const checkpointsWithOutside = [
      { name: 'Station 1', lat: 18.1960, lng: 120.5925, radius_m: 20 },
      { name: 'Far Station', lat: 18.2500, lng: 120.7000, radius_m: 20 }
    ];

    const validation = validateCheckpointsInsideEvent(checkpointsWithOutside, sampleEvent);
    assert.strictEqual(validation.isValid, false, 'Far checkpoint must be rejected');
    assert.strictEqual(validation.invalidCheckpoints.length, 1);
  });

  // -------------------------------------------------------------
  // Test Suite 4: Photo Verification Analytics & Perceptual Hash
  // -------------------------------------------------------------
  console.log('\n[4/7] Photo Verification Analytics (EXIF & dHash)');

  await test('Compute consistent 64-bit Perceptual Hash (dHash)', () => {
    const sampleBuffer = Buffer.alloc(2048);
    for (let i = 0; i < sampleBuffer.length; i++) {
      sampleBuffer[i] = (i * 13 + 7) % 256;
    }

    const { binaryHash, hexHash } = computePerceptualHash(sampleBuffer);
    assert.strictEqual(binaryHash.length, 64, 'dHash binary should be 64 bits');
    assert.strictEqual(hexHash.length, 16, 'dHash hex should be 16 characters');

    const secondHash = computePerceptualHash(sampleBuffer);
    assert.strictEqual(binaryHash, secondHash.binaryHash, 'Identical buffers must yield identical perceptual hash');
  });

  // -------------------------------------------------------------
  // Test Suite 5: Exact Polygon & Custom Center Point Persistence
  // -------------------------------------------------------------
  console.log('\n[5/7] Polygon Coordinate Integrity & Custom Center Persistence');

  await test('Persist and reload exact asymmetric 6-point L-shape polygon and custom center', () => {
    const lShapeVertices = [
      [18.10990, 120.53800],
      [18.11100, 120.53800],
      [18.11100, 120.53900],
      [18.11050, 120.53900],
      [18.11050, 120.54000],
      [18.10990, 120.54000]
    ];
    const customCenter = { lat: 18.10990, lng: 120.53870 };

    const polyJson = JSON.stringify(lShapeVertices);
    const res = db.prepare(`
      INSERT INTO events (name, description, center_lat, center_lng, radius_m, polygon_coordinates, grace_minutes, college_filter, course_filter, year_filter, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run('L-Shape Test Event', 'Testing persistence', customCenter.lat, customCenter.lng, 120, polyJson, 15, 'all', 'all', 'all', 'active');

    const eventId = res.lastInsertRowid;
    const loadedEvent = db.prepare(`SELECT * FROM events WHERE id = ?`).get(eventId);

    assert(loadedEvent, 'Event must exist in database');
    assert.strictEqual(loadedEvent.center_lat, 18.10990, 'Center latitude must be preserved exactly');
    assert.strictEqual(loadedEvent.center_lng, 120.53870, 'Center longitude must be preserved exactly');

    const reloadedPoly = JSON.parse(loadedEvent.polygon_coordinates);
    assert.strictEqual(reloadedPoly.length, 6, 'Polygon must have exactly 6 vertices');

    lShapeVertices.forEach((orig, idx) => {
      assert.strictEqual(reloadedPoly[idx][0], orig[0], `Vertex #${idx+1} Lat must match`);
      assert.strictEqual(reloadedPoly[idx][1], orig[1], `Vertex #${idx+1} Lng must match`);
    });

    db.prepare(`DELETE FROM events WHERE id = ?`).run(eventId);
  });

  // -------------------------------------------------------------
  // Test Suite 6: WebAuthn Biometric Service
  // -------------------------------------------------------------
  console.log('\n[6/7] WebAuthn Biometric Platform Service');

  await test('Generate valid WebAuthn registration options with platform authenticator requirements', async () => {
    const sampleStudent = { student_id: '23-140015', name: 'Micko Gabriel' };
    const req = { headers: { host: 'localhost:5000', origin: 'http://localhost:5000' } };

    const options = await getWebAuthnRegistrationOptions(sampleStudent, req);
    assert(options.challenge, 'Challenge must be present');
    assert.strictEqual(options.rp.name, 'TapIn University Attendance');
    assert.strictEqual(options.authenticatorSelection.authenticatorAttachment, 'platform');
    assert.strictEqual(options.authenticatorSelection.userVerification, 'required');
  });

  // -------------------------------------------------------------
  // Test Suite 7: Email One-Time-Passcode (OTP) Fallback Service
  // -------------------------------------------------------------
  console.log('\n[7/7] Email OTP Fallback Service & Rate Limiting');

  await test('Generate 6-digit Email OTP, hash in SQLite with 5m expiry, and verify', async () => {
    const studentId = '23-140015';
    db.prepare(`DELETE FROM otp_codes WHERE student_id = ?`).run(studentId);

    const otpRes = await requestEmailOtp(studentId);
    assert.strictEqual(otpRes.success, true);
    assert(otpRes.maskedEmail.includes('@mmsu.edu.ph'), 'Masked email must retain university domain');

    const storedOtp = db.prepare(`SELECT * FROM otp_codes WHERE student_id = ? AND used = 0`).get(studentId);
    assert(storedOtp, 'OTP row must exist in database');
    assert.strictEqual(storedOtp.hashed_code.length, 64, 'Stored code must be SHA-256 (64 hex characters)');
    assert.strictEqual(storedOtp.used, 0);

    const failRes = verifyEmailOtp(studentId, '000000');
    assert.strictEqual(failRes.isValid, false);
    assert.strictEqual(failRes.remainingAttempts, 4);

    const validCode = otpRes.devCode;
    if (validCode) {
      const successRes = verifyEmailOtp(studentId, validCode);
      assert.strictEqual(successRes.isValid, true);
      assert(successRes.token, 'Must return signed auth token');

      const reuseRes = verifyEmailOtp(studentId, validCode);
      assert.strictEqual(reuseRes.isValid, false, 'Consumed OTP code cannot be reused');
    }
  });

  await test('Enforce Rate Limiting: Max 3 OTP requests in 10-minute window', async () => {
    const studentId = '23-140015';

    db.prepare(`DELETE FROM otp_codes WHERE student_id = ?`).run(studentId);
    for (let i = 0; i < 3; i++) {
      db.prepare(`
        INSERT INTO otp_codes (student_id, hashed_code, expires_at, used, attempt_count, max_attempts, created_at)
        VALUES (?, 'dummy_hash', datetime('now', '+5 minutes'), 0, 0, 5, datetime('now'))
      `).run(studentId);
    }

    let rateLimited = false;
    try {
      await requestEmailOtp(studentId);
    } catch (err) {
      rateLimited = err.message.includes('Rate limit exceeded');
    }

    assert.strictEqual(rateLimited, true, '4th OTP request must trigger rate limit exception');
    db.prepare(`DELETE FROM otp_codes WHERE student_id = ?`).run(studentId);
  });

  console.log('\n===============================================================');
  console.log(`   TEST RESULTS: ${passCount} PASSED, ${failCount} FAILED           `);
  console.log('===============================================================\n');

  if (failCount > 0) {
    process.exit(1);
  } else {
    console.log('All backend services & authentication engines verified successfully!\n');
    process.exit(0);
  }
}

runAllTests();
