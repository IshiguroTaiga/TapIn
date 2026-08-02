const express = require('express');
const db = require('../db');
const { calculateDistance, isWithinGeofence } = require('../services/haversine');
const { spoofDetector } = require('../services/spoofDetection');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Student Submission: Time In / Time Out
router.post('/submit', (req, res) => {
  const { student_id, lat, lng, accuracy, timestamp, motionData, forceAction, strategy } = req.body;

  if (!student_id || lat === undefined || lng === undefined) {
    return res.status(400).json({ error: 'Student ID, latitude, and longitude are required' });
  }

  // 1. Verify Student Exists in Master Student Database
  const student = db.prepare(`SELECT * FROM students WHERE student_id = ?`).get(student_id.trim());
  if (!student) {
    return res.status(404).json({
      error: 'Student ID not found in university master database. Please check your Student ID or contact an administrator.'
    });
  }

  // 2. Fetch Currently Active Event
  const activeEvent = db.prepare(`SELECT * FROM events WHERE status = 'active' ORDER BY id DESC LIMIT 1`).get();
  if (!activeEvent) {
    return res.status(400).json({ error: 'No active university event is currently open for attendance recording.' });
  }

  // 3. Auto-detect action (Time In vs Time Out) if not explicitly forced
  const existingLogs = db.prepare(`
    SELECT * FROM attendance_logs 
    WHERE event_id = ? AND student_id = ? 
    ORDER BY timestamp ASC
  `).all(activeEvent.id, student.student_id);

  let action = forceAction;
  if (!action) {
    const hasTimeIn = existingLogs.some(l => l.action === 'time_in');
    const hasTimeOut = existingLogs.some(l => l.action === 'time_out');

    if (!hasTimeIn) {
      action = 'time_in';
    } else if (!hasTimeOut) {
      action = 'time_out';
    } else {
      action = 'time_out'; // default to time_out updates
    }
  }

  // 4. Geofence Distance Calculation using Haversine
  const distance = calculateDistance(lat, lng, activeEvent.center_lat, activeEvent.center_lng);
  const inRange = distance <= activeEvent.radius_m;

  // 5. GPS Spoofing Detection Module Pass
  const studentHistory = existingLogs.map(l => ({
    lat: l.lat,
    lng: l.lng,
    accuracy: l.accuracy,
    timestamp: l.timestamp
  }));

  const locationReport = {
    lat: parseFloat(lat),
    lng: parseFloat(lng),
    accuracy: accuracy !== undefined ? parseFloat(accuracy) : null,
    timestamp: timestamp || new Date().toISOString(),
    motionData
  };

  const spoofEval = spoofDetector.evaluate(locationReport, studentHistory, strategy || 'rule-based');

  // 6. Grace Period & Status Classification
  let status = 'valid';
  let rejected = false;
  let rejectionReason = null;

  if (spoofEval.isSpoofed) {
    rejected = true;
    rejectionReason = `GPS Anomaly / Spoofing Detected! Trust score: ${spoofEval.trustScore}/100. Flags: ${spoofEval.flags.join(', ')}`;
    status = 'rejected';
  } else if (!inRange) {
    // Check if student is within configured grace period distance/time
    // Borderline acceptance if student is slightly outside (e.g. within 2x radius during grace window)
    if (distance <= activeEvent.radius_m * 2.5) {
      status = 'borderline';
    } else {
      rejected = true;
      rejectionReason = `Location outside event geofence perimeter! You are ${Math.round(distance - activeEvent.radius_m)}m beyond the ${activeEvent.radius_m}m radius.`;
      status = 'rejected';
    }
  }

  // 7. Save Log in Database
  const logTimestamp = timestamp || new Date().toISOString();
  const insertStmt = db.prepare(`
    INSERT INTO attendance_logs 
    (event_id, student_id, action, lat, lng, accuracy, timestamp, in_range, trust_score, is_spoofed, spoof_flags, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertStmt.run(
    activeEvent.id,
    student.student_id,
    action,
    parseFloat(lat),
    parseFloat(lng),
    accuracy ? parseFloat(accuracy) : null,
    logTimestamp,
    inRange ? 1 : 0,
    spoofEval.trustScore,
    spoofEval.isSpoofed ? 1 : 0,
    spoofEval.flags.join(','),
    status
  );

  const responsePayload = {
    success: !rejected,
    action,
    student: {
      student_id: student.student_id,
      name: student.name,
      year: student.year,
      course: student.course,
      college: student.college
    },
    event: {
      id: activeEvent.id,
      name: activeEvent.name,
      radius_m: activeEvent.radius_m,
      grace_minutes: activeEvent.grace_minutes
    },
    geofence: {
      inRange,
      distanceMeters: distance,
      radiusMeters: activeEvent.radius_m
    },
    spoofDetection: {
      trustScore: spoofEval.trustScore,
      isSpoofed: spoofEval.isSpoofed,
      flags: spoofEval.flags,
      details: spoofEval.details,
      strategyUsed: spoofEval.strategy
    },
    status,
    timestamp: logTimestamp,
    message: rejected
      ? rejectionReason
      : status === 'borderline'
      ? `Successfully recorded ${action.toUpperCase()}! Note: Your location is slightly outside the primary radius, so it was logged as Borderline under the ${activeEvent.grace_minutes}-min grace period.`
      : `Successfully recorded ${action.toUpperCase()} for ${student.name}!`
  };

  // 8. Emit Real-time Socket.io Update to Live Dashboard
  const reqIo = req.app.get('io');
  if (reqIo) {
    reqIo.emit('attendance_updated', responsePayload);
  }

  if (rejected) {
    return res.status(422).json(responsePayload);
  }

  res.json(responsePayload);
});

// Live Admin Dashboard Statistics & Student Status Stream
router.get('/live/:eventId', authenticateToken, (req, res) => {
  const eventId = req.params.eventId;

  const event = db.prepare(`SELECT * FROM events WHERE id = ?`).get(eventId);
  if (!event) return res.status(404).json({ error: 'Event not found' });

  // Latest log per student for this event
  const latestLogs = db.prepare(`
    SELECT l.*, s.name, s.year, s.course, s.college
    FROM attendance_logs l
    JOIN students s ON l.student_id = s.student_id
    WHERE l.event_id = ?
    ORDER BY l.timestamp DESC
  `).all(eventId);

  // Group latest status per student
  const studentStatusMap = {};
  latestLogs.forEach(log => {
    if (!studentStatusMap[log.student_id]) {
      studentStatusMap[log.student_id] = log;
    }
  });

  const studentsList = Object.values(studentStatusMap);

  const inRangeCount = studentsList.filter(s => s.in_range === 1 && s.is_spoofed === 0).length;
  const outRangeCount = studentsList.filter(s => s.in_range === 0 && s.is_spoofed === 0 && s.status !== 'rejected').length;
  const flaggedCount = studentsList.filter(s => s.is_spoofed === 1 || s.status === 'rejected').length;

  res.json({
    event,
    summary: {
      totalActive: studentsList.length,
      inRangeCount,
      outRangeCount,
      flaggedCount
    },
    students: studentsList,
    recentActivity: latestLogs.slice(0, 30)
  });
});

// Historical View: Filterable Attendance Logs
router.get('/history', authenticateToken, (req, res) => {
  const { event_id, college, course, year, status } = req.query;

  let query = `
    SELECT l.*, s.name, s.year, s.course, s.college, e.name as event_name
    FROM attendance_logs l
    JOIN students s ON l.student_id = s.student_id
    JOIN events e ON l.event_id = e.id
    WHERE 1=1
  `;
  const params = [];

  if (event_id && event_id !== 'all') {
    query += ` AND l.event_id = ?`;
    params.push(event_id);
  }
  if (college && college !== 'all') {
    query += ` AND s.college = ?`;
    params.push(college);
  }
  if (course && course !== 'all') {
    query += ` AND s.course = ?`;
    params.push(course);
  }
  if (year && year !== 'all') {
    query += ` AND s.year = ?`;
    params.push(parseInt(year));
  }
  if (status && status !== 'all') {
    query += ` AND l.status = ?`;
    params.push(status);
  }

  query += ` ORDER BY l.timestamp DESC LIMIT 500`;

  const logs = db.prepare(query).all(...params);
  res.json(logs);
});

// CSV Export Endpoint
router.get('/export/csv', authenticateToken, (req, res) => {
  const { event_id } = req.query;
  let query = `
    SELECT l.id, l.timestamp, l.student_id, s.name, s.college, s.course, s.year,
           l.action, l.in_range, l.trust_score, l.is_spoofed, l.spoof_flags, l.status, e.name as event_name
    FROM attendance_logs l
    JOIN students s ON l.student_id = s.student_id
    JOIN events e ON l.event_id = e.id
  `;
  const params = [];
  if (event_id && event_id !== 'all') {
    query += ` WHERE l.event_id = ?`;
    params.push(event_id);
  }
  query += ` ORDER BY l.timestamp DESC`;

  const logs = db.prepare(query).all(...params);

  const headers = ['Log ID', 'Timestamp', 'Student ID', 'Student Name', 'College', 'Course', 'Year', 'Action', 'In Range', 'Trust Score', 'Spoofed', 'Spoof Flags', 'Status', 'Event Name'];
  const rows = logs.map(l => [
    l.id,
    l.timestamp,
    l.student_id,
    `"${l.name}"`,
    `"${l.college}"`,
    `"${l.course}"`,
    l.year,
    l.action,
    l.in_range ? 'Yes' : 'No',
    l.trust_score,
    l.is_spoofed ? 'YES' : 'No',
    `"${l.spoof_flags || ''}"`,
    l.status,
    `"${l.event_name}"`
  ]);

  const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="tapin_attendance_export_${Date.now()}.csv"`);
  res.send(csvContent);
});

module.exports = router;
