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

    // 5. Incomplete Duration & Dwell Ratio Analysis (D = Tin / Te >= 0.90 residency threshold per Babatunde et al. & Huang et al.)
    let dwellRatio = 1.0;
    if (timeInLogs.length > 0 && timeOutLogs.length > 0) {
      const timeInTime = new Date(timeInLogs[0].timestamp).getTime();
      const timeOutTime = new Date(timeOutLogs[timeOutLogs.length - 1].timestamp).getTime();
      const totalStudentSpanMs = Math.max(0, timeOutTime - timeInTime);

      // Event duration window Te
      let eventDurationMs = totalStudentSpanMs;
      if (timeInWindow && timeOutWindow) {
        const winStart = new Date(timeInWindow.start_time).getTime();
        const winEnd = new Date(timeOutWindow.end_time || timeOutWindow.start_time).getTime();
        if (winEnd > winStart) {
          eventDurationMs = winEnd - winStart;
        }
      }

      // Calculate Tin: time spent strictly inside polygon
      const nonGraceLogs = logs.filter(l => l.status !== 'grace_exceeded' && l.status !== 'rejected');
      const outsideLogs = logs.filter(l => l.in_range === 0);
      const outsideRatio = nonGraceLogs.length > 0 ? (outsideLogs.length / nonGraceLogs.length) : 0;
      const calculatedInsideMs = totalStudentSpanMs * (1 - outsideRatio);

      if (eventDurationMs > 0 && totalStudentSpanMs > 0) {
        dwellRatio = Math.min(1.0, calculatedInsideMs / eventDurationMs);
      }

      // Check early exit against timeOutWindow start time
      if (timeOutWindow) {
        const expectedMinTimeOut = new Date(timeOutWindow.start_time).getTime();
        if (timeOutTime < expectedMinTimeOut) {
          violationsDetected.push({
            code: 'INCOMPLETE_DURATION',
            description: violationConfigMap['INCOMPLETE_DURATION'] || 'Did Not Complete Full Event Duration (Early Time-Out)'
          });
        }
      }

      // Residency threshold check (theta = 0.90 default from Babatunde et al. [2])
      const dwellThreshold = 0.90;
      if (dwellRatio < dwellThreshold && !violationsDetected.some(v => v.code === 'INCOMPLETE_DURATION')) {
        violationsDetected.push({
          code: 'INCOMPLETE_DURATION',
          description: violationConfigMap['INCOMPLETE_DURATION'] || `Insufficient Dwell Residency: ${(dwellRatio * 100).toFixed(1)}% inside venue (< ${(dwellThreshold * 100)}% required)`
        });
      }
    }

    // 6. Incomplete Checkpoint Tasks
    const totalCheckpoints = db.prepare(`SELECT COUNT(*) as count FROM event_checkpoints WHERE event_id = ?`).get(eventId)?.count || 0;
    if (totalCheckpoints > 0 && timeInLogs.length > 0) {
      const verifiedAssignments = db.prepare(`
        SELECT COUNT(DISTINCT checkpoint_id) as count 
        FROM student_task_assignments 
        WHERE event_id = ? AND student_id = ? AND status = 'verified'
      `).get(eventId, student.student_id)?.count || 0;

      if (verifiedAssignments < totalCheckpoints) {
        violationsDetected.push({
          code: 'INCOMPLETE_CHECKPOINT_TASKS',
          description: violationConfigMap['INCOMPLETE_CHECKPOINT_TASKS'] || `Checkpoint Tasks Incomplete (${verifiedAssignments}/${totalCheckpoints} stations verified)`
        });
      }
    }

    // 7. Borderline Out of Bounds Check
    const borderlineLogs = logs.filter(l => l.status === 'borderline');
    if (borderlineLogs.length > 0) {
      violationsDetected.push({
        code: 'BORDERLINE_OUT_OF_BOUNDS',
        description: violationConfigMap['BORDERLINE_OUT_OF_BOUNDS'] || 'Borderline Location Attendance (Recorded within grace window slightly beyond polygon boundary)'
      });
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
      dwell_ratio: Math.round(dwellRatio * 100) / 100,
      dwell_percentage: Math.round(dwellRatio * 100),
      violations: violationsDetected
    });
  });

  return evaluationResults;
}

module.exports = {
  evaluateEventPenalties
};
