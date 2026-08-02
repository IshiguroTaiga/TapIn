const express = require('express');
const db = require('../db');
const { evaluateEventPenalties } = require('../services/penaltyEngine');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Trigger penalty engine evaluation for an event
router.post('/evaluate/:eventId', authenticateToken, (req, res) => {
  const { eventId } = req.params;

  try {
    const results = evaluateEventPenalties(eventId);
    res.json({
      message: `Successfully evaluated penalties for event ID ${eventId}.`,
      count: results.length,
      results
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to evaluate penalties: ' + err.message });
  }
});

// Get penalty violation results for an event
router.get('/results/:eventId', authenticateToken, (req, res) => {
  const { eventId } = req.params;

  const violations = db.prepare(`
    SELECT v.*, s.name, s.college, s.course, s.year, vt.label as reason_label, vt.default_penalty
    FROM violations v
    JOIN students s ON v.student_id = s.student_id
    LEFT JOIN violation_types vt ON v.reason_code = vt.code
    WHERE v.event_id = ?
    ORDER BY v.created_at DESC
  `).all(eventId);

  res.json(violations);
});

// Get all configured violation types
router.get('/types', authenticateToken, (req, res) => {
  const types = db.prepare(`SELECT * FROM violation_types ORDER BY code ASC`).all();
  res.json(types);
});

// Create or update a violation type
router.post('/types', authenticateToken, (req, res) => {
  const { code, label, description, default_penalty } = req.body;

  if (!code || !label || !description) {
    return res.status(400).json({ error: 'Code, label, and description required' });
  }

  db.prepare(`
    INSERT OR REPLACE INTO violation_types (code, label, description, default_penalty)
    VALUES (?, ?, ?, ?)
  `).run(code.trim().toUpperCase(), label.trim(), description.trim(), default_penalty || 'Warning');

  res.json({ message: 'Violation type saved successfully' });
});

module.exports = router;
