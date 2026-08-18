const express = require('express');
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');
const db = require('../db');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { generateStudentKeyPair, createPortableCredentialPass } = require('../services/cryptoAuth');

const router = express.Router();
const upload = multer({ dest: 'uploads/' });

// Public: Lookup student info by Student ID
router.get('/lookup/:student_id', (req, res) => {
  const { student_id } = req.params;
  const student = db.prepare(`
    SELECT student_id, name, year, course, college, section, public_key, key_enrolled_at 
    FROM students 
    WHERE student_id = ?
  `).get(student_id.trim());

  if (!student) {
    return res.status(404).json({ error: 'Student ID not found in master records' });
  }

  res.json({
    student_id: student.student_id,
    name: student.name,
    year: student.year,
    course: student.course,
    college: student.college,
    section: student.section || 'A',
    hasKeyEnrolled: !!student.public_key,
    keyEnrolledAt: student.key_enrolled_at
  });
});

// Student / Onboarding: Enroll Cryptographic Keypair
router.post('/enroll', (req, res) => {
  const { student_id, public_key } = req.body;

  if (!student_id) {
    return res.status(400).json({ error: 'Student ID is required for credential enrollment' });
  }

  const student = db.prepare(`SELECT * FROM students WHERE student_id = ?`).get(student_id.trim());
  if (!student) {
    return res.status(404).json({ error: 'Student ID not found in university database' });
  }

  let finalPublicKey = public_key;
  let privateKeyPem = null;
  let portablePass = null;

  // If public key not provided by client, generate Ed25519 keypair server-side and deliver pass
  if (!finalPublicKey) {
    const keyPair = generateStudentKeyPair();
    finalPublicKey = keyPair.publicKeyPem;
    privateKeyPem = keyPair.privateKeyPem;
    portablePass = createPortableCredentialPass(student, privateKeyPem);
  }

  db.prepare(`
    UPDATE students SET
      public_key = ?,
      key_enrolled_at = CURRENT_TIMESTAMP
    WHERE student_id = ?
  `).run(finalPublicKey, student.student_id);

  res.json({
    success: true,
    message: 'Cryptographic credential key pair successfully enrolled for student!',
    student: {
      student_id: student.student_id,
      name: student.name,
      hasKeyEnrolled: true,
      publicKeyPreview: finalPublicKey.substring(0, 40) + '...'
    },
    credentialPass: portablePass,
    privateKeyPem // only delivered once during initial enrollment
  });
});

// Student / Client: Generate and Enroll Keypair in 1-Click
router.post('/generate-keypair/:student_id', (req, res) => {
  const { student_id } = req.params;
  const student = db.prepare(`SELECT * FROM students WHERE student_id = ?`).get(student_id.trim());
  if (!student) {
    return res.status(404).json({ error: 'Student ID not found' });
  }

  const keyPair = generateStudentKeyPair();
  const portablePass = createPortableCredentialPass(student, keyPair.privateKeyPem);

  db.prepare(`
    UPDATE students SET
      public_key = ?,
      key_enrolled_at = CURRENT_TIMESTAMP
    WHERE student_id = ?
  `).run(keyPair.publicKeyPem, student.student_id);

  res.json({
    success: true,
    message: `Ed25519 Cryptographic Pass issued for ${student.name}`,
    student_id: student.student_id,
    publicKeyPem: keyPair.publicKeyPem,
    privateKeyPem: keyPair.privateKeyPem,
    credentialPass: portablePass
  });
});

// Admin: List students with filtering
router.get('/', authenticateToken, (req, res) => {
  const { college, course, year, search } = req.query;

  let query = `SELECT student_id, name, year, course, college, section, (public_key IS NOT NULL) as has_key_enrolled, key_enrolled_at, created_at FROM students WHERE 1=1`;
  const params = [];

  if (college && college !== 'all') {
    query += ` AND college = ?`;
    params.push(college);
  }
  if (course && course !== 'all') {
    query += ` AND course = ?`;
    params.push(course);
  }
  if (year && year !== 'all') {
    query += ` AND year = ?`;
    params.push(parseInt(year));
  }
  if (search) {
    query += ` AND (student_id LIKE ? OR name LIKE ?)`;
    params.push(`%${search}%`, `%${search}%`);
  }

  query += ` ORDER BY name ASC LIMIT 100`;

  const students = db.prepare(query).all(...params);
  res.json(students);
});

// Admin: Import Students from CSV file
router.post('/import-csv', authenticateToken, requireRole(['admin', 'superadmin']), upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'CSV file required' });
  }

  const results = [];
  const insertStmt = db.prepare(`
    INSERT OR REPLACE INTO students (student_id, name, year, course, college, section)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  fs.createReadStream(req.file.path)
    .pipe(csv())
    .on('data', (data) => {
      // Clean up headers and trim values
      const student_id = data.student_id || data.Student_ID || data['Student ID'] || data.id;
      const name = data.name || data.Name || data.student_name;
      const year = parseInt(data.year || data.Year || 1);
      const course = data.course || data.Course || 'General';
      const college = data.college || data.College || 'General';
      const section = data.section || data.Section || 'A';

      if (student_id && name) {
        results.push([student_id.trim(), name.trim(), year, course.trim(), college.trim(), section.trim()]);
      }
    })
    .on('end', () => {
      // Bulk insert in SQLite transaction
      const transaction = db.transaction((rows) => {
        for (const row of rows) {
          insertStmt.run(...row);
        }
      });

      try {
        transaction(results);
        fs.unlinkSync(req.file.path);
        res.json({
          message: `Successfully imported/updated ${results.length} student records from CSV.`,
          count: results.length
        });
      } catch (err) {
        if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        res.status(500).json({ error: 'Failed to import CSV: ' + err.message });
      }
    });
});

module.exports = router;
