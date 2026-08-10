const express = require('express');
const db = require('../db');
const { authenticateToken, requireRole } = require('../middleware/auth');
const {
  normalizePolygon,
  calculateCentroid,
  calculateMaxRadius
} = require('../services/geofence');

const router = express.Router();

/**
 * Helper to generate a default regular polygon (hexagon) around a center point
 */
function generateDefaultPolygon(centerLat, centerLng, radiusMeters = 100) {
  const points = [];
  const earthRadius = 6371000;
  const numSides = 6;
  for (let i = 0; i < numSides; i++) {
    const angle = (i * 2 * Math.PI) / numSides;
    const dLat = (radiusMeters * Math.cos(angle)) / earthRadius;
    const dLng = (radiusMeters * Math.sin(angle)) / (earthRadius * Math.cos(centerLat * (Math.PI / 180)));
    const lat = centerLat + dLat * (180 / Math.PI);
    const lng = centerLng + dLng * (180 / Math.PI);
    points.push([Math.round(lat * 100000) / 100000, Math.round(lng * 100000) / 100000]);
  }
  return points;
}

/**
 * Format event object with parsed polygon coordinates
 */
function formatEvent(e) {
  if (!e) return null;
  let poly = null;
  if (e.polygon_coordinates) {
    try {
      poly = typeof e.polygon_coordinates === 'string' ? JSON.parse(e.polygon_coordinates) : e.polygon_coordinates;
    } catch (err) {
      poly = null;
    }
  }

  // Fallback to generated polygon if not set
  if (!poly || !Array.isArray(poly) || poly.length < 3) {
    poly = generateDefaultPolygon(e.center_lat, e.center_lng, e.radius_m || 100);
  }

  return {
    ...e,
    polygon_coordinates: poly
  };
}

// Get all events
router.get('/', (req, res) => {
  const events = db.prepare(`
    SELECT e.*, a.username as creator_name 
    FROM events e 
    LEFT JOIN admins a ON e.created_by = a.id 
    ORDER BY e.created_at DESC
  `).all();

  // Attach windows for each event & format polygon
  const getWindows = db.prepare(`SELECT * FROM event_windows WHERE event_id = ? ORDER BY start_time ASC`);
  const formattedEvents = events.map(e => {
    const formatted = formatEvent(e);
    formatted.windows = getWindows.all(e.id);
    return formatted;
  });

  res.json(formattedEvents);
});

// Get active event for student view (single latest with fallback)
router.get('/active', (req, res) => {
  const { college, student_id } = req.query;

  let targetCollege = college;
  if (!targetCollege && student_id) {
    const student = db.prepare(`SELECT college FROM students WHERE student_id = ?`).get(String(student_id).trim());
    if (student) {
      targetCollege = student.college;
    }
  }

  let query = `SELECT * FROM events WHERE status = 'active'`;
  const params = [];

  if (targetCollege && targetCollege !== 'all') {
    query += ` AND (LOWER(TRIM(college_filter)) = 'all' OR LOWER(TRIM(college_filter)) = LOWER(TRIM(?)))`;
    params.push(targetCollege);
  }

  query += ` ORDER BY id DESC LIMIT 1`;

  let activeEvent = db.prepare(query).get(...params);
  if (!activeEvent) {
    activeEvent = db.prepare(`SELECT * FROM events WHERE status = 'active' ORDER BY id DESC LIMIT 1`).get();
  }

  if (!activeEvent) {
    return res.json(null);
  }

  const formatted = formatEvent(activeEvent);
  formatted.windows = db.prepare(`SELECT * FROM event_windows WHERE event_id = ? ORDER BY start_time ASC`).all(activeEvent.id);
  res.json(formatted);
});

// Helper handler for active events list
const handleActiveEventsList = (req, res) => {
  const { college, student_id } = req.query;

  let targetCollege = college;
  if (!targetCollege && student_id) {
    const student = db.prepare(`SELECT college FROM students WHERE student_id = ?`).get(String(student_id).trim());
    if (student) {
      targetCollege = student.college;
    }
  }

  let query = `SELECT * FROM events WHERE status = 'active'`;
  const params = [];

  if (targetCollege && targetCollege !== 'all') {
    query += ` AND (LOWER(TRIM(college_filter)) = 'all' OR LOWER(TRIM(college_filter)) = LOWER(TRIM(?)))`;
    params.push(targetCollege);
  }

  query += ` ORDER BY id DESC`;

  let activeEvents = db.prepare(query).all(...params);

  // Fallback 1: If no match for student's college, fetch University-wide active events
  if (activeEvents.length === 0 && targetCollege && targetCollege !== 'all') {
    activeEvents = db.prepare(`SELECT * FROM events WHERE status = 'active' AND LOWER(TRIM(college_filter)) = 'all' ORDER BY id DESC`).all();
  }

  // Fallback 2: If still empty, return all active events so students are never blocked by string format mismatches
  if (activeEvents.length === 0) {
    activeEvents = db.prepare(`SELECT * FROM events WHERE status = 'active' ORDER BY id DESC`).all();
  }

  const getWindows = db.prepare(`SELECT * FROM event_windows WHERE event_id = ? ORDER BY start_time ASC`);
  const formattedList = activeEvents.map(e => {
    const formatted = formatEvent(e);
    formatted.windows = getWindows.all(e.id);
    return formatted;
  });

  res.json(formattedList);
};

// Register active events endpoints
router.get('/active/all', handleActiveEventsList);
router.get('/active-list', handleActiveEventsList);
router.get('/active_all', handleActiveEventsList);

// Get single event details
router.get('/:id', (req, res) => {
  const event = db.prepare(`SELECT * FROM events WHERE id = ?`).get(req.params.id);
  if (!event) {
    return res.status(404).json({ error: 'Event not found' });
  }

  const formatted = formatEvent(event);
  formatted.windows = db.prepare(`SELECT * FROM event_windows WHERE event_id = ?`).all(event.id);
  res.json(formatted);
});

// Create new event
router.post('/', authenticateToken, requireRole(['admin', 'superadmin']), (req, res) => {
  let {
    id,
    name,
    description,
    center_lat,
    center_lng,
    radius_m = 100,
    polygon_coordinates,
    grace_minutes = 15,
    college_filter = 'all',
    course_filter = 'all',
    year_filter = 'all',
    status = 'active',
    windows = []
  } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Event Name is required' });
  }

  // Handle polygon coordinates & derive centroid and bounding radius
  let normalizedPoly = normalizePolygon(polygon_coordinates);
  if (normalizedPoly.length >= 3) {
    const centroid = calculateCentroid(normalizedPoly);
    if (center_lat === undefined || isNaN(parseFloat(center_lat))) {
      center_lat = centroid.lat;
    }
    if (center_lng === undefined || isNaN(parseFloat(center_lng))) {
      center_lng = centroid.lng;
    }
    const maxR = calculateMaxRadius(normalizedPoly, centroid);
    if (radius_m === undefined || isNaN(parseFloat(radius_m))) {
      radius_m = maxR;
    }
  } else {
    // Generate default hexagon polygon around center_lat/center_lng if not provided
    const lat = center_lat !== undefined ? parseFloat(center_lat) : 18.1960;
    const lng = center_lng !== undefined ? parseFloat(center_lng) : 120.5927;
    const rad = radius_m !== undefined ? parseFloat(radius_m) : 100;
    center_lat = lat;
    center_lng = lng;
    radius_m = rad;
    normalizedPoly = generateDefaultPolygon(lat, lng, rad);
  }

  const polygonString = JSON.stringify(normalizedPoly);

  let eventId;
  if (id !== undefined && id !== null && String(id).trim() !== '') {
    const parsedId = parseInt(id);
    const existing = db.prepare(`SELECT id FROM events WHERE id = ?`).get(parsedId);
    if (existing) {
      return res.status(400).json({ error: `Event ID #${parsedId} is already in use. Please enter a different ID.` });
    }

    db.prepare(`
      INSERT INTO events (id, name, description, center_lat, center_lng, radius_m, polygon_coordinates, grace_minutes, college_filter, course_filter, year_filter, status, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(parsedId, name, description || '', parseFloat(center_lat), parseFloat(center_lng), parseFloat(radius_m), polygonString, parseInt(grace_minutes), college_filter, course_filter, year_filter, status, req.user.id);
    eventId = parsedId;
  } else {
    const result = db.prepare(`
      INSERT INTO events (name, description, center_lat, center_lng, radius_m, polygon_coordinates, grace_minutes, college_filter, course_filter, year_filter, status, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(name, description || '', parseFloat(center_lat), parseFloat(center_lng), parseFloat(radius_m), polygonString, parseInt(grace_minutes), college_filter, course_filter, year_filter, status, req.user.id);
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

  // Emit socket event for real-time admin sync
  const reqIo = req.app.get('io');
  if (reqIo) reqIo.emit('events_updated', { action: 'create', eventId });

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
    polygon_coordinates,
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

  let finalPolyString = event.polygon_coordinates;
  let finalCenterLat = center_lat !== undefined ? parseFloat(center_lat) : event.center_lat;
  let finalCenterLng = center_lng !== undefined ? parseFloat(center_lng) : event.center_lng;
  let finalRadius = radius_m !== undefined ? parseFloat(radius_m) : event.radius_m;

  if (polygon_coordinates) {
    const norm = normalizePolygon(polygon_coordinates);
    if (norm.length >= 3) {
      finalPolyString = JSON.stringify(norm);
      const centroid = calculateCentroid(norm);
      if (center_lat === undefined) finalCenterLat = centroid.lat;
      if (center_lng === undefined) finalCenterLng = centroid.lng;
      if (radius_m === undefined) finalRadius = calculateMaxRadius(norm, centroid);
    }
  }

  db.prepare(`
    UPDATE events SET
      name = ?,
      description = ?,
      center_lat = ?,
      center_lng = ?,
      radius_m = ?,
      polygon_coordinates = ?,
      grace_minutes = ?,
      college_filter = ?,
      course_filter = ?,
      year_filter = ?,
      status = ?
    WHERE id = ?
  `).run(
    name || event.name,
    description !== undefined ? description : event.description,
    finalCenterLat,
    finalCenterLng,
    finalRadius,
    finalPolyString,
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

  // Emit socket event for real-time admin sync
  const reqIo = req.app.get('io');
  if (reqIo) reqIo.emit('events_updated', { action: 'update', eventId: activeId });

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

  // Emit socket event for real-time admin sync
  const reqIo = req.app.get('io');
  if (reqIo) reqIo.emit('events_updated', { action: 'delete', eventId: id });

  res.json({ message: 'Event deleted successfully' });
});

module.exports = router;
