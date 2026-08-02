const express = require('express');
const db = require('../db');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();

// Get all events
router.get('/', (req, res) => {
  const events = db.prepare(`
    SELECT e.*, a.username as creator_name 
    FROM events e 
    LEFT JOIN admins a ON e.created_by = a.id 
    ORDER BY e.created_at DESC
  `).all();

  // Attach windows for each event
  const getWindows = db.prepare(`SELECT * FROM event_windows WHERE event_id = ? ORDER BY start_time ASC`);
  events.forEach(e => {
    e.windows = getWindows.all(e.id);
  });

  res.json(events);
});

// Get active event for student view
router.get('/active', (req, res) => {
  const activeEvent = db.prepare(`
    SELECT * FROM events WHERE status = 'active' ORDER BY id DESC LIMIT 1
  `).get();

  if (!activeEvent) {
    return res.status(404).json({ error: 'No active event found' });
  }

  activeEvent.windows = db.prepare(`SELECT * FROM event_windows WHERE event_id = ?`).all(activeEvent.id);
  res.json(activeEvent);
});

// Get single event details
router.get('/:id', (req, res) => {
  const event = db.prepare(`SELECT * FROM events WHERE id = ?`).get(req.params.id);
  if (!event) {
    return res.status(404).json({ error: 'Event not found' });
  }

  event.windows = db.prepare(`SELECT * FROM event_windows WHERE event_id = ?`).all(event.id);
  res.json(event);
});

// Create new event
router.post('/', authenticateToken, (req, res) => {
  const {
    name,
    description,
    center_lat,
    center_lng,
    radius_m = 100,
    grace_minutes = 15,
    college_filter = 'all',
    course_filter = 'all',
    year_filter = 'all',
    status = 'active',
    windows = []
  } = req.body;

  if (!name || center_lat === undefined || center_lng === undefined) {
    return res.status(400).json({ error: 'Name, center latitude, and center longitude required' });
  }

  const result = db.prepare(`
    INSERT INTO events (name, description, center_lat, center_lng, radius_m, grace_minutes, college_filter, course_filter, year_filter, status, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(name, description || '', parseFloat(center_lat), parseFloat(center_lng), parseFloat(radius_m), parseInt(grace_minutes), college_filter, course_filter, year_filter, status, req.user.id);

  const eventId = result.lastInsertRowid;

  // Insert windows
  const insertWindow = db.prepare(`
    INSERT INTO event_windows (event_id, window_type, start_time, end_time)
    VALUES (?, ?, ?, ?)
  `);

  windows.forEach(w => {
    insertWindow.run(eventId, w.window_type, w.start_time, w.end_time);
  });

  res.status(201).json({
    message: 'Event created successfully',
    eventId
  });
});

// Update event
router.put('/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  const {
    name,
    description,
    center_lat,
    center_lng,
    radius_m,
    grace_minutes,
    college_filter,
    course_filter,
    year_filter,
    status,
    windows
  } = req.body;

  const event = db.prepare(`SELECT * FROM events WHERE id = ?`).get(id);
  if (!event) {
    return res.status(404).json({ error: 'Event not found' });
  }

  db.prepare(`
    UPDATE events SET
      name = ?,
      description = ?,
      center_lat = ?,
      center_lng = ?,
      radius_m = ?,
      grace_minutes = ?,
      college_filter = ?,
      course_filter = ?,
      year_filter = ?,
      status = ?
    WHERE id = ?
  `).run(
    name || event.name,
    description !== undefined ? description : event.description,
    center_lat !== undefined ? parseFloat(center_lat) : event.center_lat,
    center_lng !== undefined ? parseFloat(center_lng) : event.center_lng,
    radius_m !== undefined ? parseFloat(radius_m) : event.radius_m,
    grace_minutes !== undefined ? parseInt(grace_minutes) : event.grace_minutes,
    college_filter || event.college_filter,
    course_filter || event.course_filter,
    year_filter || event.year_filter,
    status || event.status,
    id
  );

  // Update windows if provided
  if (Array.isArray(windows)) {
    db.prepare(`DELETE FROM event_windows WHERE event_id = ?`).run(id);
    const insertWindow = db.prepare(`
      INSERT INTO event_windows (event_id, window_type, start_time, end_time)
      VALUES (?, ?, ?, ?)
    `);
    windows.forEach(w => {
      insertWindow.run(id, w.window_type, w.start_time, w.end_time);
    });
  }

  res.json({ message: 'Event updated successfully' });
});

// Delete event
router.delete('/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  db.prepare(`DELETE FROM events WHERE id = ?`).run(id);
  res.json({ message: 'Event deleted successfully' });
});

module.exports = router;
