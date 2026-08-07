const bcrypt = require('bcryptjs');
const db = require('./db');

function seed() {
  console.log('[Seed] Seeding initial database data...');

  // 1. Seed Admins
  const passwordHashSuper = bcrypt.hashSync('super123', 10);
  const passwordHashAdmin = bcrypt.hashSync('admin123', 10);

  const insertAdmin = db.prepare(`
    INSERT OR REPLACE INTO admins (id, username, password_hash, role)
    VALUES (?, ?, ?, ?)
  `);

  insertAdmin.run(1, 'superadmin', passwordHashSuper, 'superadmin');
  insertAdmin.run(2, 'admin', passwordHashAdmin, 'admin');

  // 2. Seed Violation Types (Configurable penalties)
  const insertViolationType = db.prepare(`
    INSERT OR REPLACE INTO violation_types (code, label, description, default_penalty)
    VALUES (?, ?, ?, ?)
  `);

  const violationTypes = [
    ['NO_TIME_IN', 'No Time-In Recorded', 'Student failed to log Time-In during any designated time-in window', 'Marked Absent'],
    ['NO_TIME_OUT', 'No Time-Out Recorded', 'Student logged Time-In but failed to log Time-Out when event ended', 'Partial Credit Deduction'],
    ['INCOMPLETE_DURATION', 'Did Not Complete Full Duration', 'Student left the event perimeter before designated completion time', 'Violation Warning'],
    ['EXCEEDED_GRACE_PERIOD', 'Exceeded Allowed Radius Grace Period', 'Student spent more than allowed grace period duration outside geofence', 'Grace Violation'],
    ['SPOOF_SUSPECTED', 'GPS Spoofing / Location Anomaly Detected', 'Location report failed real-time spoof detection algorithms', 'Security Audit Required'],
    ['BORDERLINE_OUT_OF_BOUNDS', 'Borderline Location Attendance', 'Timed in or out within grace window slightly beyond standard radius', 'Flagged Log']
  ];

  violationTypes.forEach(vt => insertViolationType.run(...vt));

  // 3. Seed Master Students List (Clean production state: Only Micko Gabriel D. Permison)
  db.prepare(`DELETE FROM students WHERE student_id != '23-140015'`).run();

  const insertStudent = db.prepare(`
    INSERT OR REPLACE INTO students (student_id, name, year, course, college)
    VALUES (?, ?, ?, ?, ?)
  `);

  const sampleStudents = [
    ['23-140015', 'Micko Gabriel D. Permison', 4, 'BS Computer Science', 'College of Computing and Information Sciences']
  ];

  sampleStudents.forEach(st => insertStudent.run(...st));

  console.log('[Seed] Database successfully seeded!');
}

if (require.main === module) {
  seed();
}

module.exports = seed;
