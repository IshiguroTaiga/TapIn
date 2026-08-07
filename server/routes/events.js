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
router.post('/', authenticateToken, requireRole(['admin', 'superadmin']), (req, res) => {
  const {
    id,
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

  let eventId;
  if (id !== undefined && id !== null && String(id).trim() !== '') {
    const parsedId = parseInt(id);
    const existing = db.prepare(`SELECT id FROM events WHERE id = ?`).get(parsedId);
    if (existing) {
      return res.status(400).json({ error: `Event ID #${parsedId} is already in use. Please enter a different ID.` });
    }

    db.prepare(`
      INSERT INTO events (id, name, description, center_lat, center_lng, radius_m, grace_minutes, college_filter, course_filter, year_filter, status, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(parsedId, name, description || '', parseFloat(center_lat), parseFloat(center_lng), parseFloat(radius_m), parseInt(grace_minutes), college_filter, course_filter, year_filter, status, req.user.id);
    eventId = parsedId;
  } else {
    const result = db.prepare(`
      INSERT INTO events (name, description, center_lat, center_lng, radius_m, grace_minutes, college_filter, course_filter, year_filter, status, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(name, description || '', parseFloat(center_lat), parseFloat(center_lng), parseFloat(radius_m), parseInt(grace_minutes), college_filter, course_filter, year_filter, status, req.user.id);
    eventId = result.lastInsertRowid;
  }

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
router.put('/:id', authenticateToken, requireRole(['admin', 'superadmin']), (req, res) => {
  const { id } = req.params;
  const {
    new_id,
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

  let event = db.prepare(`SELECT * FROM events WHERE id = ?`).get(id);
  if (!event) {
    return res.status(404).json({ error: 'Event not found' });
  }

  let activeId = parseInt(id);

  // Handle changing Event ID if new_id is provided and different
  if (new_id !== undefined && new_id !== null && String(new_id).trim() !== '' && parseInt(new_id) !== activeId) {
    const targetId = parseInt(new_id);
    const existing = db.prepare(`SELECT id FROM events WHERE id = ?`).get(targetId);
    if (existing) {
      return res.status(400).json({ error: `Event ID #${targetId} is already in use.` });
    }

    try {
      db.pragma('foreign_keys = OFF');
      db.prepare(`UPDATE events SET id = ? WHERE id = ?`).run(targetId, activeId);
      db.prepare(`UPDATE event_windows SET event_id = ? WHERE event_id = ?`).run(targetId, activeId);
      db.prepare(`UPDATE attendance_logs SET event_id = ? WHERE event_id = ?`).run(targetId, activeId);
      db.prepare(`UPDATE violations SET event_id = ? WHERE event_id = ?`).run(targetId, activeId);
      db.pragma('foreign_keys = ON');
      activeId = targetId;
    } catch (err) {
      db.pragma('foreign_keys = ON');
      return res.status(500).json({ error: 'Failed to update Event ID: ' + err.message });
    }
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
    activeId
  );

  // Update windows if provided
  if (Array.isArray(windows)) {
    db.prepare(`DELETE FROM event_windows WHERE event_id = ?`).run(activeId);
    const insertWindow = db.prepare(`
      INSERT INTO event_windows (event_id, window_type, start_time, end_time)
      VALUES (?, ?, ?, ?)
    `);
    windows.forEach(w => {
      insertWindow.run(activeId, w.window_type, w.start_time, w.end_time);
    });
  }

  res.json({ message: 'Event updated successfully', newId: activeId });
});

// Delete event
router.delete('/:id', authenticateToken, requireRole(['admin', 'superadmin']), (req, res) => {
  const { id } = req.params;
  const event = db.prepare(`SELECT id FROM events WHERE id = ?`).get(id);
  if (!event) {
    return res.status(404).json({ error: 'Event not found' });
  }

  db.prepare(`DELETE FROM events WHERE id = ?`).run(id);
  res.json({ message: 'Event deleted successfully' });
});

module.exports = router;
