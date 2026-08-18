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
    ['EXCEEDED_GRACE_PERIOD', 'Exceeded Allowed Geofence Grace Period', 'Student spent more than allowed grace period duration outside event polygon geofence', 'Grace Violation'],
    ['SPOOF_SUSPECTED', 'GPS Spoofing / Location Anomaly Detected', 'Location report failed real-time spoof detection algorithms', 'Security Audit Required'],
    ['BORDERLINE_OUT_OF_BOUNDS', 'Borderline Location Attendance', 'Timed in or out within grace window slightly beyond polygon boundary', 'Flagged Log']
  ];

  violationTypes.forEach(vt => insertViolationType.run(...vt));

  // 3. Seed Master Students List (Clean production state: Only Micko Gabriel D. Permison)
  db.prepare(`DELETE FROM students WHERE student_id != '23-140015'`).run();

  const insertStudent = db.prepare(`
    INSERT OR REPLACE INTO students (student_id, name, year, course, college, section)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const sampleStudents = [
    ['23-140015', 'Micko Gabriel D. Permison', 4, 'BS Computer Science', 'College of Computing and Information Sciences', 'A']
  ];

  sampleStudents.forEach(st => insertStudent.run(...st));

  // 4. Seed Checkpoints and Task Pools for Active Events
  const events = db.prepare(`SELECT id, center_lat, center_lng FROM events`).all();
  events.forEach(ev => {
    const countCheckpoints = db.prepare(`SELECT COUNT(*) as cnt FROM event_checkpoints WHERE event_id = ?`).get(ev.id).cnt;
    if (countCheckpoints === 0) {
      const cLat = ev.center_lat;
      const cLng = ev.center_lng;

      // Seed 3 nested checkpoints
      const cpStmt = db.prepare(`
        INSERT INTO event_checkpoints (event_id, checkpoint_order, name, description, lat, lng, radius_m)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      const taskStmt = db.prepare(`
        INSERT INTO checkpoint_tasks (checkpoint_id, title, description, task_type, instructions, verification_rule)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      // Checkpoint 1
      const cp1 = cpStmt.run(ev.id, 1, 'Station 1 - East Entrance & Registration', 'Main registration and kit distribution desk', cLat + 0.0003, cLng + 0.0003, 25.0);
      taskStmt.run(cp1.lastInsertRowid, 'Capture Registration Banner', 'Take a clear verification photo of the registration desk and official welcome banner.', 'photo', 'Position camera to show the banner clearly without obstructing attendees.', 'EXIF_METADATA_AND_PHASH');
      taskStmt.run(cp1.lastInsertRowid, 'Event Schedule Board Photo', 'Photograph the physical program schedule posted near the entrance.', 'photo', 'Ensure the schedule text is legible.', 'EXIF_METADATA_AND_PHASH');

      // Checkpoint 2
      const cp2 = cpStmt.run(ev.id, 2, 'Station 2 - Innovation Exhibit Showcase', 'Research poster presentations and project demo booths', cLat - 0.0002, cLng + 0.0002, 25.0);
      taskStmt.run(cp2.lastInsertRowid, 'Exhibit Booth Verification', 'Take a photo of any student research demo booth in this section.', 'photo', 'Capture the booth poster or display screen.', 'EXIF_METADATA_AND_PHASH');
      taskStmt.run(cp2.lastInsertRowid, 'Keynote Hall Number', 'Enter the designated room or hall number for the upcoming keynote.', 'text', 'Check the door sign or floor directory and type the room number.', 'EXACT_MATCH');

      // Checkpoint 3
      const cp3 = cpStmt.run(ev.id, 3, 'Station 3 - South Exit & Feedback Terminal', 'Evaluation kiosk and certificate stamping station', cLat - 0.0003, cLng - 0.0003, 25.0);
      taskStmt.run(cp3.lastInsertRowid, 'Feedback Terminal Screen Photo', 'Photograph the completed survey confirmation screen at the terminal.', 'photo', 'Show the green submission confirmation checkmark.', 'EXIF_METADATA_AND_PHASH');
    }
  });

  console.log('[Seed] Database successfully seeded with checkpoints and task pools!');
}

if (require.main === module) {
  seed();
}

module.exports = seed;
