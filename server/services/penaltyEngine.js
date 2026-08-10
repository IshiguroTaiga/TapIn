const db = require('../db');

/**
 * Penalty & Violation Evaluation Engine
 * 
 * Automatically evaluates students eligible for an event against the recorded attendance logs,
 * geofence grace period breaches, and spoof flags.
 */

function evaluateEventPenalties(eventId) {
  // Fetch event details
  const event = db.prepare(`SELECT * FROM events WHERE id = ?`).get(eventId);
  if (!event) {
    throw new Error(`Event with ID ${eventId} not found.`);
  }

  // Fetch event windows
  const windows = db.prepare(`SELECT * FROM event_windows WHERE event_id = ?`).all(eventId);
  const timeInWindow = windows.find(w => w.window_type === 'time_in');
  const timeOutWindow = windows.find(w => w.window_type === 'time_out');

  // Fetch targeted students based on college/course/year filters
  let studentQuery = `SELECT * FROM students WHERE 1=1`;
  const params = [];

  if (event.college_filter && event.college_filter !== 'all') {
    studentQuery += ` AND college = ?`;
    params.push(event.college_filter);
  }
  if (event.course_filter && event.course_filter !== 'all') {
    studentQuery += ` AND course = ?`;
    params.push(event.course_filter);
  }
  if (event.year_filter && event.year_filter !== 'all') {
    studentQuery += ` AND year = ?`;
    params.push(parseInt(event.year_filter));
  }

  const eligibleStudents = db.prepare(studentQuery).all(...params);

  // Fetch registered violation types config map
  const violationTypesList = db.prepare(`SELECT * FROM violation_types`).all();
  const violationConfigMap = {};
  violationTypesList.forEach(vt => {
    violationConfigMap[vt.code] = vt.label;
  });

  const evaluationResults = [];

  // Clear previous auto-generated violations for re-evaluation
  db.prepare(`DELETE FROM violations WHERE event_id = ?`).run(eventId);

  const insertViolation = db.prepare(`
    INSERT INTO violations (event_id, student_id, reason_code, reason_description)
    VALUES (?, ?, ?, ?)
  `);

  eligibleStudents.forEach(student => {
    // Fetch logs for this student for this event
    const logs = db.prepare(`
      SELECT * FROM attendance_logs 
      WHERE event_id = ? AND student_id = ? 
      ORDER BY timestamp ASC
    `).all(eventId, student.student_id);

    const timeInLogs = logs.filter(l => l.action === 'time_in');
    const timeOutLogs = logs.filter(l => l.action === 'time_out');
    const spoofedLogs = logs.filter(l => l.is_spoofed === 1);
    const graceExceededLogs = logs.filter(l => l.status === 'grace_exceeded');

    const violationsDetected = [];

    // 1. Check for Spoofing Anomalies
    if (spoofedLogs.length > 0) {
      violationsDetected.push({
        code: 'SPOOF_SUSPECTED',
        description: violationConfigMap['SPOOF_SUSPECTED'] || 'GPS Spoofing / Location Anomaly Detected'
      });
    }

    // 2. Check Time-In Presence
    if (timeInLogs.length === 0) {
      violationsDetected.push({
        code: 'NO_TIME_IN',
        description: violationConfigMap['NO_TIME_IN'] || 'No Time-In Recorded'
      });
    }

    // 3. Check Time-Out Presence (only if timed in or event ended)
    if (timeInLogs.length > 0 && timeOutLogs.length === 0) {
      violationsDetected.push({
        code: 'NO_TIME_OUT',
        description: violationConfigMap['NO_TIME_OUT'] || 'No Time-Out Recorded'
      });
    }

    // 4. Check Grace Period Exceedance
    if (graceExceededLogs.length > 0) {
      violationsDetected.push({
        code: 'EXCEEDED_GRACE_PERIOD',
        description: violationConfigMap['EXCEEDED_GRACE_PERIOD'] || 'Exceeded Allowed Geofence Grace Period'
      });
    }

    // 5. Incomplete Duration (timed out early before minimum event duration window)
    if (timeInLogs.length > 0 && timeOutLogs.length > 0 && timeOutWindow) {
      const timeOutTime = new Date(timeOutLogs[timeOutLogs.length - 1].timestamp).getTime();
      const expectedMinTimeOut = new Date(timeOutWindow.start_time).getTime();

      if (timeOutTime < expectedMinTimeOut) {
        violationsDetected.push({
          code: 'INCOMPLETE_DURATION',
          description: violationConfigMap['INCOMPLETE_DURATION'] || 'Did Not Complete Full Event Duration'
        });
      }
    }

    // Record violations in DB
    violationsDetected.forEach(v => {
      insertViolation.run(eventId, student.student_id, v.code, v.description);
    });

    const status = violationsDetected.length === 0 ? 'Compliant' : 'W/ Penalty';

    evaluationResults.push({
      student_id: student.student_id,
      name: student.name,
      year: student.year,
      course: student.course,
      college: student.college,
      status: status,
      violations: violationsDetected
    });
  });

  return evaluationResults;
}

module.exports = {
  evaluateEventPenalties
};
