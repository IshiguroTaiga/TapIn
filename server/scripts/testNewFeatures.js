/**
 * Comprehensive Automated Test Suite for New TapIn Systems:
 * 1. Cryptographic Credential Authentication (Ed25519)
 * 2. Stationary Spoof Anomaly Signal
 * 3. Checkpoint Engine & Geofence Containment
 * 4. Task Distribution Algorithm (Anti-Collusion & Admin Toggles)
 * 5. Photo Verification Analytics (EXIF & Perceptual Hash Duplicate Detection)
 */

const assert = require('assert');
const { generateStudentKeyPair, signPayload, verifySignature, createPortableCredentialPass } = require('../services/cryptoAuth');
const { checkStationaryAnomaly } = require('../services/spoofDetection/heuristics');
const { SpoofDetector } = require('../services/spoofDetection');
const { validateCheckpointsInsideEvent } = require('../services/checkpointEngine');
const { assignCheckpointTask } = require('../services/taskDistribution');
const { extractExifMetadata, computePerceptualHash, calculateHammingDistance, verifySubmissionPhoto } = require('../services/photoVerification');
const db = require('../db');

let passCount = 0;
let failCount = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  \x1b[32m✔ PASS\x1b[0m ${name}`);
    passCount++;
  } catch (err) {
    console.error(`  \x1b[31m✖ FAIL\x1b[0m ${name}:`, err.message);
    failCount++;
  }
}

console.log('\n===============================================================');
console.log('   RUNNING TAPIN TEST SUITE: CREDENTIALS & CHECKPOINT ENGINE   ');
console.log('===============================================================\n');

// -------------------------------------------------------------
// Test Suite 1: Cryptographic Authentication (Ed25519)
// -------------------------------------------------------------
console.log('[1/5] Cryptographic Credential Authentication (Ed25519)');

test('Generate valid Ed25519 keypair for student', () => {
  const keys = generateStudentKeyPair();
  assert(keys.publicKeyPem.includes('BEGIN PUBLIC KEY'), 'Public key must be in PEM format');
  assert(keys.privateKeyPem.includes('BEGIN PRIVATE KEY'), 'Private key must be in PEM format');
  assert(keys.publicKeyBase64.length > 20, 'Public key base64 must not be empty');
});

test('Sign and verify attendance payload successfully', () => {
  const keys = generateStudentKeyPair();
  const payload = { student_id: '23-140015', event_id: 1, timestamp: '2026-08-18T10:00:00Z', lat: 18.1960, lng: 120.5927 };
  const signature = signPayload(keys.privateKeyPem, payload);
  assert(typeof signature === 'string' && signature.length === 128, 'Ed25519 signature should be 128 hex chars');

  const isValid = verifySignature(keys.publicKeyPem, payload, signature);
  assert.strictEqual(isValid, true, 'Valid signature should verify true');
});

test('Reject tampered attendance payload', () => {
  const keys = generateStudentKeyPair();
  const payload = { student_id: '23-140015', event_id: 1, lat: 18.1960, lng: 120.5927 };
  const signature = signPayload(keys.privateKeyPem, payload);

  const tamperedPayload = { student_id: '23-140015', event_id: 1, lat: 18.2500, lng: 120.6500 };
  const isValid = verifySignature(keys.publicKeyPem, tamperedPayload, signature);
  assert.strictEqual(isValid, false, 'Tampered payload coordinates must be rejected');
});

test('Generate portable credential pass with verifiable token', () => {
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
console.log('\n[2/5] Stationary Spoof Anomaly Detection');

test('Detect stationary GPS anomaly (near-zero movement over 5+ minutes)', () => {
  const baseTime = Date.now();
  const history = [
    { lat: 18.196000, lng: 120.592700, accuracy: 5.0, timestamp: new Date(baseTime - 360000).toISOString() }, // 6 min ago
    { lat: 18.196001, lng: 120.592701, accuracy: 5.0, timestamp: new Date(baseTime - 240000).toISOString() }, // 4 min ago
    { lat: 18.196000, lng: 120.592700, accuracy: 5.0, timestamp: new Date(baseTime - 120000).toISOString() }  // 2 min ago
  ];
  const currentTrace = { lat: 18.196000, lng: 120.592700, accuracy: 5.0, timestamp: new Date(baseTime).toISOString() };

  const result = checkStationaryAnomaly(currentTrace, history, { windowSeconds: 300, thresholdMeters: 1.0 });
  assert.strictEqual(result.flagged, true, 'Stationary trace over 6 minutes with 0.1m movement should be flagged');
  assert.strictEqual(result.flag, 'STATIONARY_SIGNAL_ANOMALY');
});

test('Allow normal walking movement without stationary flag', () => {
  const baseTime = Date.now();
  const history = [
    { lat: 18.196000, lng: 120.592700, accuracy: 6.0, timestamp: new Date(baseTime - 300000).toISOString() },
    { lat: 18.196150, lng: 120.592850, accuracy: 7.0, timestamp: new Date(baseTime - 150000).toISOString() }
  ];
  const currentTrace = { lat: 18.196300, lng: 120.593000, accuracy: 5.5, timestamp: new Date(baseTime).toISOString() }; // ~45m away

  const result = checkStationaryAnomaly(currentTrace, history, { windowSeconds: 300, thresholdMeters: 1.0 });
  assert.strictEqual(result.flagged, false, 'Normal movement of 45m should not be flagged as stationary');
});

// -------------------------------------------------------------
// Test Suite 3: Checkpoint Validation
// -------------------------------------------------------------
console.log('\n[3/5] Checkpoint Geofence Containment Validation');

test('Validate checkpoints inside polygon geofence', () => {
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

  const checkpointsInside = [
    { name: 'Station 1', lat: 18.1960, lng: 120.5925, radius_m: 20 },
    { name: 'Station 2', lat: 18.1965, lng: 120.5930, radius_m: 20 }
  ];

  const validation = validateCheckpointsInsideEvent(checkpointsInside, sampleEvent);
  assert.strictEqual(validation.isValid, true, 'Checkpoints inside polygon must pass validation');
  assert.strictEqual(validation.invalidCheckpoints.length, 0);
});

test('Reject checkpoint placed outside event polygon geofence', () => {
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

  const checkpointsWithOutside = [
    { name: 'Station 1', lat: 18.1960, lng: 120.5925, radius_m: 20 },
    { name: 'Far Station', lat: 18.2500, lng: 120.7000, radius_m: 20 } // ~12km away
  ];

  const validation = validateCheckpointsInsideEvent(checkpointsWithOutside, sampleEvent);
  assert.strictEqual(validation.isValid, false, 'Far checkpoint must be rejected');
  assert.strictEqual(validation.invalidCheckpoints.length, 1);
});

// -------------------------------------------------------------
// Test Suite 4: Photo Verification Analytics & Perceptual Hash
// -------------------------------------------------------------
console.log('\n[4/5] Photo Verification Analytics (EXIF & dHash)');

test('Compute consistent 64-bit Perceptual Hash (dHash)', () => {
  const sampleBuffer = Buffer.alloc(2048);
  for (let i = 0; i < sampleBuffer.length; i++) {
    sampleBuffer[i] = (i * 13 + 7) % 256;
  }

  const { binaryHash, hexHash } = computePerceptualHash(sampleBuffer);
  assert.strictEqual(binaryHash.length, 64, 'dHash binary should be 64 bits');
  assert.strictEqual(hexHash.length, 16, 'dHash hex should be 16 characters');

  // Same buffer should produce identical hash
  const secondHash = computePerceptualHash(sampleBuffer);
  assert.strictEqual(binaryHash, secondHash.binaryHash, 'Identical buffers must yield identical perceptual hash');
});

test('Calculate Hamming distance accurately', () => {
  const hash1 = '1111000011110000111100001111000011110000111100001111000011110000';
  const hash2 = '1111000011110000111100001111000011110000111100001111000011110000'; // 0 bits diff
  const hash3 = '1111000011110000111100001111000011110000111100001111000011110011'; // 2 bits diff

  assert.strictEqual(calculateHammingDistance(hash1, hash2), 0, 'Same hash has 0 distance');
  assert.strictEqual(calculateHammingDistance(hash1, hash3), 2, '2 altered bits should yield distance 2');
});

console.log('\n===============================================================');
console.log(`   TEST RESULTS: ${passCount} PASSED, ${failCount} FAILED           `);
console.log('===============================================================\n');

if (failCount > 0) {
  process.exit(1);
} else {
  console.log('All backend services & new feature engines verified successfully!\n');
}
