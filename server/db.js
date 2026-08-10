const path = require('path');
const Database = require('better-sqlite3');

const dbPath = path.join(__dirname, 'tapin.db');
const db = new Database(dbPath);

// Enable foreign keys and WAL mode for high reliability & performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS students (
      student_id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      year INTEGER NOT NULL,
      course TEXT NOT NULL,
      college TEXT NOT NULL,
      section TEXT DEFAULT 'A',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS admins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT CHECK(role IN ('admin', 'superadmin')) NOT NULL DEFAULT 'admin',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      center_lat REAL NOT NULL,
      center_lng REAL NOT NULL,
      radius_m REAL NOT NULL DEFAULT 100,
      polygon_coordinates TEXT,
      grace_minutes INTEGER NOT NULL DEFAULT 15,
      college_filter TEXT DEFAULT 'all',
      course_filter TEXT DEFAULT 'all',
      year_filter TEXT DEFAULT 'all',
      status TEXT CHECK(status IN ('active', 'upcoming', 'closed')) DEFAULT 'active',
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (created_by) REFERENCES admins(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS event_windows (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id INTEGER NOT NULL,
      window_type TEXT CHECK(window_type IN ('time_in', 'time_out')) NOT NULL,
      start_time DATETIME NOT NULL,
      end_time DATETIME NOT NULL,
      FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS attendance_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id INTEGER NOT NULL,
      student_id TEXT NOT NULL,
      action TEXT CHECK(action IN ('time_in', 'time_out')) NOT NULL,
      lat REAL NOT NULL,
      lng REAL NOT NULL,
      accuracy REAL,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      in_range INTEGER NOT NULL DEFAULT 1, -- 1 for true, 0 for false
      trust_score INTEGER DEFAULT 100,
      is_spoofed INTEGER DEFAULT 0,
      spoof_flags TEXT,
      status TEXT CHECK(status IN ('valid', 'borderline', 'rejected')) DEFAULT 'valid',
      FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
      FOREIGN KEY (student_id) REFERENCES students(student_id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS violations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id INTEGER NOT NULL,
      student_id TEXT NOT NULL,
      reason_code TEXT NOT NULL,
      reason_description TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
      FOREIGN KEY (student_id) REFERENCES students(student_id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS violation_types (
      code TEXT PRIMARY KEY,
      label TEXT NOT NULL,
      description TEXT NOT NULL,
      default_penalty TEXT DEFAULT 'Warning'
    );

    CREATE INDEX IF NOT EXISTS idx_logs_event_student ON attendance_logs (event_id, student_id);
    CREATE INDEX IF NOT EXISTS idx_logs_event_timestamp ON attendance_logs (event_id, timestamp DESC);
    CREATE INDEX IF NOT EXISTS idx_events_status ON events (status);
    CREATE INDEX IF NOT EXISTS idx_violations_event ON violations (event_id);
  `);

  try {
    db.exec(`
      UPDATE students SET college = 'College of Engineering' WHERE college = 'Engineering';
      UPDATE students SET college = 'College of Business, Economics and Accountancy' WHERE college LIKE '%Business%';
      UPDATE students SET college = 'College of Health Sciences' WHERE college = 'Health Sciences';
      UPDATE students SET college = 'College of Arts and Sciences' WHERE college = 'Arts and Sciences';
      UPDATE students SET college = 'College of Industrial Technology' WHERE college = 'Industrial Technology';
      UPDATE students SET college = 'College of Teacher Education' WHERE college = 'Teacher Education';

      UPDATE events SET college_filter = 'College of Engineering' WHERE college_filter = 'Engineering';
      UPDATE events SET college_filter = 'College of Business, Economics and Accountancy' WHERE college_filter LIKE '%Business%';
      UPDATE events SET college_filter = 'College of Health Sciences' WHERE college_filter = 'Health Sciences';
      UPDATE events SET college_filter = 'College of Arts and Sciences' WHERE college_filter = 'Arts and Sciences';
      UPDATE events SET college_filter = 'College of Industrial Technology' WHERE college_filter = 'Industrial Technology';
      UPDATE events SET college_filter = 'College of Teacher Education' WHERE college_filter = 'Teacher Education';

      -- Clean up dummy test students (keeping only Micko Gabriel D. Permison)
      DELETE FROM students WHERE student_id NOT IN ('23-140015');
    `);
  } catch (e) {}

  try {
    db.exec(`ALTER TABLE students ADD COLUMN section TEXT DEFAULT 'A';`);
  } catch (e) {}

  try {
    db.exec(`ALTER TABLE events ADD COLUMN polygon_coordinates TEXT;`);
  } catch (e) {}
}

initDb();

module.exports = db;
