const express = require('express');
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');
const db = require('../db');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();
const upload = multer({ dest: 'uploads/' });

// Public: Lookup student info by Student ID (for immediate confirmation on landing page)
router.get('/lookup/:student_id', (req, res) => {
  const { student_id } = req.params;
  const student = db.prepare(`
    SELECT student_id, name, year, course, college 
    FROM students 
    WHERE student_id = ?
  `).get(student_id.trim());

  if (!student) {
    return res.status(404).json({ error: 'Student ID not found in master records' });
  }

  res.json(student);
});

// Admin: List students with filtering
router.get('/', authenticateToken, (req, res) => {
  const { college, course, year, search } = req.query;

  let query = `SELECT * FROM students WHERE 1=1`;
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
    INSERT OR REPLACE INTO students (student_id, name, year, course, college)
    VALUES (?, ?, ?, ?, ?)
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

      if (student_id && name) {
        results.push([student_id.trim(), name.trim(), year, course.trim(), college.trim()]);
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
        fs.unlinkSync(req.file.path); // remove temp uploaded file
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
