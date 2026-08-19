const express = require('express');
const db = require('../db');
const { isWithinPolygonGeofence, calculateDistance, normalizePolygon } = require('../services/geofence');
const { spoofDetector } = require('../services/spoofDetection');
const { verifySignature } = require('../services/cryptoAuth');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Student Submission: Time In / Time Out
router.post('/submit', (req, res) => {
  const { student_id, lat, lng, accuracy, timestamp, motionData, forceAction, strategy, signature, evalConfig } = req.body;

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

  // 2. Multi-Mode Authentication Verification (Optional Biometrics / OTP / Signatures)
  const { auth_method, auth_token, webauthn_response, otp_code } = req.body;
  let signatureValid = 1;
  let signatureChecked = false;
  let signatureError = null;
  let resolvedAuthMethod = auth_method || 'student_id';

  if (auth_token && resolvedAuthMethod === 'webauthn') {
    try {
      const { JWT_SECRET } = require('../middleware/auth');
      const jwt = require('jsonwebtoken');
      const decoded = jwt.verify(auth_token, JWT_SECRET);
      if (decoded.student_id === student.student_id) {
        signatureChecked = true;
        signatureValid = 1;
      }
    } catch (err) {
      // Non-blocking fallback to student_id
      resolvedAuthMethod = 'student_id';
    }
  } else if (auth_token && resolvedAuthMethod === 'email_otp') {
    try {
      const { JWT_SECRET } = require('../middleware/auth');
      const jwt = require('jsonwebtoken');
      const decoded = jwt.verify(auth_token, JWT_SECRET);
      if (decoded.student_id === student.student_id) {
        signatureChecked = true;
        signatureValid = 1;
      }
    } catch (err) {
      resolvedAuthMethod = 'student_id';
    }
  } else if (signature && student.public_key) {
    const payloadToVerify = {
      student_id: student.student_id,
      event_id: req.body.event_id || 0,
      lat: parseFloat(lat),
      lng: parseFloat(lng)
    };
    const isValid = verifySignature(student.public_key, payloadToVerify, signature);
    signatureChecked = true;
    signatureValid = isValid ? 1 : 0;
    if (!isValid) {
      signatureError = 'Cryptographic Signature Verification Failed! Presented credential token signature did not match public key on file.';
    }
  } else {
    // Standard direct student ID verification from master database
    resolvedAuthMethod = 'student_id';
    signatureValid = 1;
  }

  // 3. Fetch Active Event (Honoring event_id if provided by student event selector)
  const { event_id } = req.body;
  let activeEvent;
  if (event_id) {
    activeEvent = db.prepare(`SELECT * FROM events WHERE id = ? AND status = 'active'`).get(event_id);
  }
  if (!activeEvent) {
    activeEvent = db.prepare(`SELECT * FROM events WHERE status = 'active' ORDER BY id DESC LIMIT 1`).get();
  }

  if (!activeEvent) {
    return res.status(400).json({ error: 'No active university event is currently open for attendance recording.' });
  }

  // 4. Verify College Eligibility Filter (Strict restriction)
  if (activeEvent.college_filter !== 'all' && activeEvent.college_filter !== student.college) {
    return res.status(403).json({
      error: `Access Restricted! This event is exclusive to ${activeEvent.college_filter} students. Your recorded college is ${student.college}.`
    });
  }

  // 5. Auto-detect action (Time In vs Time Out) if not explicitly forced
  // 5. Auto-detect action (Time In vs Time Out) ignoring rejected attempts
  const existingLogs = db.prepare(`
    SELECT * FROM attendance_logs 
    WHERE event_id = ? AND student_id = ? 
    ORDER BY timestamp ASC
  `).all(activeEvent.id, student.student_id);

  const existingValidLogs = existingLogs.filter(l => l.status !== 'rejected');
  const hasTimeIn = existingValidLogs.some(l => l.action === 'time_in');
  const hasTimeOut = existingValidLogs.some(l => l.action === 'time_out');

  let action = forceAction;
  if (!action) {
    if (!hasTimeIn) {
      action = 'time_in';
    } else if (!hasTimeOut) {
      action = 'time_out';
    } else {
      action = 'time_out'; // default to time_out updates
    }
  }

  // 5b. Time-Out Gating: Verify all required checkpoint tasks are completed before Time Out is permitted
  if (action === 'time_out') {
    const totalCheckpoints = db.prepare(`SELECT COUNT(*) as count FROM event_checkpoints WHERE event_id = ?`).get(activeEvent.id)?.count || 0;
    if (totalCheckpoints > 0) {
      const verifiedAssignments = db.prepare(`
        SELECT COUNT(DISTINCT checkpoint_id) as count 
        FROM student_task_assignments 
        WHERE event_id = ? AND student_id = ? AND status = 'verified'
      `).get(activeEvent.id, student.student_id)?.count || 0;

      if (verifiedAssignments < totalCheckpoints) {
        return res.status(403).json({
          error: `Time Out Locked: You must complete all checkpoint station tasks first (${verifiedAssignments}/${totalCheckpoints} stations verified).`,
          checkpointProgress: {
            completedStations: verifiedAssignments,
            totalStations: totalCheckpoints,
            remainingStations: totalCheckpoints - verifiedAssignments
          }
        });
      }
    }
  }

  // 6. Ray-Casting Point-in-Polygon Geofence Verification with Fast Pre-filtering
  const polygon = activeEvent.polygon_coordinates ? normalizePolygon(activeEvent.polygon_coordinates) : [];
  const geofenceResult = isWithinPolygonGeofence([parseFloat(lat), parseFloat(lng)], polygon, {
    centerLat: activeEvent.center_lat,
    centerLng: activeEvent.center_lng,
    radiusMeters: activeEvent.radius_m
  });

  const inRange = geofenceResult.inRange;
  const distance = geofenceResult.distanceToCentroid;

  // 7. Dynamic Spoof Settings & GPS Spoofing Detection Pass (Speed + Accuracy + Timing + Accelerometer + Stationary Anomaly)
  const windowSetting = db.prepare(`SELECT value FROM system_settings WHERE key = 'stationary_window_seconds'`).get();
  const thresholdSetting = db.prepare(`SELECT value FROM system_settings WHERE key = 'stationary_movement_threshold_m'`).get();

  const dynamicEvalOptions = {
    stationaryWindowSeconds: evalConfig?.stationaryWindowSeconds || (windowSetting ? parseFloat(windowSetting.value) : 300),
    stationaryThresholdMeters: evalConfig?.stationaryThresholdMeters || (thresholdSetting ? parseFloat(thresholdSetting.value) : 1.0)
  };

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

  const spoofEval = spoofDetector.evaluate(locationReport, studentHistory, strategy || 'rule-based', dynamicEvalOptions);

  // 8. Grace Period & Status Classification
  let status = 'valid';
  let rejected = false;
  let rejectionReason = null;

  if (signatureChecked && signatureValid === 0) {
    rejected = true;
    rejectionReason = signatureError;
    status = 'rejected';
  } else if (spoofEval.isSpoofed) {
    rejected = true;
    rejectionReason = `GPS Anomaly / Spoofing Detected! Trust score: ${spoofEval.trustScore}/100. Flags: ${spoofEval.flags.join(', ')}`;
    status = 'rejected';
  } else if (!inRange) {
    // Check if student is within configured grace period distance/time
    const borderlineTolerance = Math.max(activeEvent.radius_m * 2.2, 100);
    if (distance <= borderlineTolerance) {
      status = 'borderline';
    } else {
      rejected = true;
      rejectionReason = `Location outside event geofence polygon! Your coordinates are outside the designated venue boundary.`;
      status = 'rejected';
    }
  }

  // 9. Save Log in Database
  const logTimestamp = timestamp || new Date().toISOString();
  const insertStmt = db.prepare(`
    INSERT INTO attendance_logs 
    (event_id, student_id, action, lat, lng, accuracy, timestamp, in_range, trust_score, is_spoofed, spoof_flags, status, signature_valid, signature_payload, auth_method)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
    status,
    signatureValid,
    signature ? String(signature).substring(0, 128) : (auth_token ? 'AUTH_TOKEN_VERIFIED' : null),
    resolvedAuthMethod
  );

  const responsePayload = {
    success: !rejected,
    action,
    authMethod: resolvedAuthMethod,
    student: {
      student_id: student.student_id,
      name: student.name,
      year: student.year,
      course: student.course,
      college: student.college,
      section: student.section || 'A',
      hasKeyEnrolled: !!student.public_key,
      hasWebAuthn: webauthnCreds.length > 0
    },
    authVerification: {
      authMethod: resolvedAuthMethod,
      signatureChecked,
      signatureValid: signatureValid === 1,
      modeDescription: resolvedAuthMethod === 'webauthn' 
        ? 'FIDO2 / WebAuthn Platform Biometrics (Face ID/Touch ID/Windows Hello)' 
        : (resolvedAuthMethod === 'email_otp' ? 'University Email 6-Digit One-Time-Passcode (OTP)' : 'Ed25519 Cryptographic Signature')
    },
    event: {
      id: activeEvent.id,
      name: activeEvent.name,
      radius_m: activeEvent.radius_m,
      grace_minutes: activeEvent.grace_minutes
    },
    geofence: {
      algorithm: 'Ray-Casting Point-in-Polygon (PIP) with Haversine Pre-filter',
      inRange,
      onBoundary: geofenceResult.onBoundary,
      crossings: geofenceResult.crossings,
      preFiltered: geofenceResult.preFiltered,
      distanceMeters: Math.round(distance * 10) / 10,
      polygonVertices: polygon.length
    },
    spoofDetection: {
      trustScore: spoofEval.trustScore,
      isSpoofed: spoofEval.isSpoofed,
      flags: spoofEval.flags,
      details: spoofEval.details,
      strategyUsed: spoofEval.strategy,
      stationaryMetrics: {
        windowSeconds: dynamicEvalOptions.stationaryWindowSeconds,
        thresholdMeters: dynamicEvalOptions.stationaryThresholdMeters,
        displacementMeters: spoofEval.metrics?.stationaryDisplacement || 0
      }
    },
    status,
    timestamp: logTimestamp,
    message: rejected
      ? rejectionReason
      : status === 'borderline'
      ? `Successfully recorded ${action.toUpperCase()}! Note: Your location is slightly outside the venue polygon boundary, so it was logged as Borderline under the ${activeEvent.grace_minutes}-min grace period.`
      : `Successfully recorded ${action.toUpperCase()} for ${student.name}!`
  };

  // 10. Emit Real-time Socket.io Update to Live Dashboard
  const reqIo = req.app.get('io');
  if (reqIo) {
    reqIo.emit('attendance_updated', responsePayload);
  }

  if (rejected) {
    return res.status(422).json(responsePayload);
  }

  res.json(responsePayload);
});

// Student Public Status: Check current student attendance and next action
router.get('/student-status/:eventId/:studentId', (req, res) => {
  const { eventId, studentId } = req.params;
  const sId = String(studentId).trim();
  const eId = parseInt(eventId);

  const student = db.prepare(`SELECT * FROM students WHERE student_id = ?`).get(sId);
  if (!student) {
    return res.status(404).json({ error: 'Student not found in master database' });
  }

  const logs = db.prepare(`
    SELECT * FROM attendance_logs 
    WHERE event_id = ? AND student_id = ?
    ORDER BY timestamp ASC
  `).all(eId, sId);

  const validLogs = logs.filter(l => l.status !== 'rejected');
  const timeInLog = validLogs.find(l => l.action === 'time_in');
  const timeOutLog = validLogs.find(l => l.action === 'time_out');

  const hasTimedIn = !!timeInLog;
  const hasTimedOut = !!timeOutLog;

  let nextAction = 'time_in';
  if (hasTimedIn && !hasTimedOut) {
    nextAction = 'time_out';
  } else if (hasTimedIn && hasTimedOut) {
    nextAction = 'completed';
  }

  // Checkpoint progress
  const totalCheckpoints = db.prepare(`SELECT COUNT(*) as count FROM event_checkpoints WHERE event_id = ?`).get(eId)?.count || 0;
  const visitedCheckpoints = db.prepare(`SELECT COUNT(DISTINCT checkpoint_id) as count FROM student_checkpoint_visits WHERE event_id = ? AND student_id = ?`).get(eId, sId)?.count || 0;

  res.json({
    eventId: eId,
    studentId: sId,
    hasTimedIn,
    hasTimedOut,
    nextAction,
    timeInRecord: timeInLog || null,
    timeOutRecord: timeOutLog || null,
    checkpointProgress: {
      completedStations: visitedCheckpoints,
      totalStations: totalCheckpoints,
      allCompleted: totalCheckpoints > 0 ? visitedCheckpoints >= totalCheckpoints : true
    },
    logs
  });
});

// Live Admin Dashboard Statistics & Student Status Stream
router.get('/live/:eventId', authenticateToken, (req, res) => {
  const eventId = req.params.eventId;

  const rawEvent = db.prepare(`SELECT * FROM events WHERE id = ?`).get(eventId);
  if (!rawEvent) return res.status(404).json({ error: 'Event not found' });

  const event = {
    ...rawEvent,
    polygon_coordinates: normalizePolygon(rawEvent.polygon_coordinates)
  };

  // Latest log per student for this event
  const latestLogs = db.prepare(`
    SELECT l.*, s.name, s.year, s.course, s.college, s.section, (s.public_key IS NOT NULL) as has_key_enrolled
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
    SELECT l.*, s.name, s.year, s.course, s.college, s.section, (s.public_key IS NOT NULL) as has_key_enrolled, e.name as event_name
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
    SELECT l.id, l.timestamp, l.student_id, s.name, s.college, s.course, s.year, s.section,
           l.action, l.in_range, l.trust_score, l.is_spoofed, l.spoof_flags, l.status, l.signature_valid, e.name as event_name
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

  const headers = ['Log ID', 'Timestamp', 'Student ID', 'Student Name', 'College', 'Course', 'Year', 'Section', 'Action', 'In Range', 'Trust Score', 'Spoofed', 'Spoof Flags', 'Signature Valid', 'Status', 'Event Name'];
  const rows = logs.map(l => [
    l.id,
    l.timestamp,
    l.student_id,
    `"${l.name}"`,
    `"${l.college}"`,
    `"${l.course}"`,
    l.year,
    `"${l.section || 'A'}"`,
    l.action,
    l.in_range ? 'Yes' : 'No',
    l.trust_score,
    l.is_spoofed ? 'YES' : 'No',
    `"${l.spoof_flags || ''}"`,
    l.signature_valid ? 'Verified' : 'Invalid/Missing',
    l.status,
    `"${l.event_name}"`
  ]);

  const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="tapin_attendance_export_${Date.now()}.csv"`);
  res.send(csvContent);
});

module.exports = router;
