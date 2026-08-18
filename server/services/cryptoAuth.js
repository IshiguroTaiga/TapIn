/**
 * Cryptographic Authentication Service
 * 
 * Provides signed credential authentication for students (replacing device biometrics).
 * Uses high-performance Ed25519 public-key signature cryptography (Node.js native crypto).
 */

const crypto = require('crypto');

/**
 * Generates an Ed25519 asymmetric key pair for a student during enrollment.
 * 
 * @returns {Object} { publicKeyPem, privateKeyPem, publicKeyBase64, privateKeyBase64 }
 */
function generateStudentKeyPair() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519', {
    publicKeyEncoding: {
      type: 'spki',
      format: 'pem'
    },
    privateKeyEncoding: {
      type: 'pkcs8',
      format: 'pem'
    }
  });

  // Also provide compact base64-der formats for QR codes & portable tokens
  const pubDer = crypto.createPublicKey(publicKey).export({ type: 'spki', format: 'der' });
  const privDer = crypto.createPrivateKey(privateKey).export({ type: 'pkcs8', format: 'der' });

  return {
    publicKeyPem: publicKey,
    privateKeyPem: privateKey,
    publicKeyBase64: pubDer.toString('base64'),
    privateKeyBase64: privDer.toString('base64')
  };
}

/**
 * Normalizes a payload into a deterministic string for signing/verification.
 */
function normalizePayload(payload) {
  if (typeof payload === 'string') return payload;
  
  // Sort keys deterministically
  const sortedKeys = Object.keys(payload).sort();
  const normalized = {};
  sortedKeys.forEach(k => {
    // Exclude signature field itself if present
    if (k !== 'signature' && k !== 'signature_valid') {
      normalized[k] = payload[k];
    }
  });
  return JSON.stringify(normalized);
}

/**
 * Signs an attendance or checkpoint payload using the student's private key.
 * 
 * @param {String} privateKeyPemOrBase64 Student's private key (PEM or PKCS8 Base64)
 * @param {Object|String} payload Payload data to sign (e.g. { student_id, timestamp, event_id, nonce })
 * @returns {String} Hex-encoded Ed25519 signature
 */
function signPayload(privateKeyPemOrBase64, payload) {
  let privateKey = privateKeyPemOrBase64;
  if (!privateKey.includes('-----BEGIN PRIVATE KEY-----')) {
    // Wrap base64 in PEM format
    privateKey = `-----BEGIN PRIVATE KEY-----\n${privateKey}\n-----END PRIVATE KEY-----`;
  }

  const data = Buffer.from(normalizePayload(payload), 'utf8');
  const signature = crypto.sign(null, data, privateKey);
  return signature.toString('hex');
}

/**
 * Verifies an attendance signature against the student's registered public key.
 * 
 * @param {String} publicKeyPemOrBase64 Student's registered public key (PEM or SPKI Base64)
 * @param {Object|String} payload Payload data that was signed
 * @param {String} signatureHex Hex-encoded signature string
 * @returns {Boolean} True if signature is cryptographically valid
 */
function verifySignature(publicKeyPemOrBase64, payload, signatureHex) {
  if (!publicKeyPemOrBase64 || !signatureHex) return false;

  try {
    let publicKey = publicKeyPemOrBase64;
    if (!publicKey.includes('-----BEGIN PUBLIC KEY-----')) {
      publicKey = `-----BEGIN PUBLIC KEY-----\n${publicKey}\n-----END PUBLIC KEY-----`;
    }

    const data = Buffer.from(normalizePayload(payload), 'utf8');
    const signatureBuffer = Buffer.from(signatureHex, 'hex');

    return crypto.verify(null, data, publicKey, signatureBuffer);
  } catch (err) {
    console.error('[CryptoAuth] Verification error:', err.message);
    return false;
  }
}

/**
 * Creates a signed portable QR credential token for a student.
 * 
 * @param {Object} studentInfo { student_id, name, course, college }
 * @param {String} privateKeyPem Student's private key
 * @returns {Object} Portable credential packet
 */
function createPortableCredentialPass(studentInfo, privateKeyPem) {
  const issuedAt = new Date().toISOString();
  const credentialPayload = {
    student_id: studentInfo.student_id,
    name: studentInfo.name,
    college: studentInfo.college,
    course: studentInfo.course,
    issued_at: issuedAt,
    issuer: 'TapIn DOST-SEI Cryptographic Authority'
  };

  const signature = signPayload(privateKeyPem, credentialPayload);

  return {
    version: '1.0',
    type: 'TAPIN_STUDENT_CREDENTIAL',
    payload: credentialPayload,
    signature,
    token: Buffer.from(JSON.stringify({ payload: credentialPayload, signature })).toString('base64')
  };
}

module.exports = {
  generateStudentKeyPair,
  signPayload,
  verifySignature,
  createPortableCredentialPass,
  normalizePayload
};
