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
      public_key TEXT,
      key_enrolled_at DATETIME,
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
      allow_duplicate_tasks INTEGER DEFAULT 0,
      randomize_tasks INTEGER DEFAULT 0,
      task_collision_window_minutes INTEGER DEFAULT 10,
      max_checkpoints INTEGER DEFAULT 3,
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

    CREATE TABLE IF NOT EXISTS event_checkpoints (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id INTEGER NOT NULL,
      checkpoint_order INTEGER NOT NULL DEFAULT 1,
      name TEXT NOT NULL,
      description TEXT,
      lat REAL NOT NULL,
      lng REAL NOT NULL,
      radius_m REAL NOT NULL DEFAULT 20.0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS checkpoint_tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      checkpoint_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      task_type TEXT CHECK(task_type IN ('photo', 'code', 'quiz', 'text')) DEFAULT 'photo',
      instructions TEXT,
      verification_rule TEXT DEFAULT 'EXIF_METADATA_AND_PHASH',
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (checkpoint_id) REFERENCES event_checkpoints(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS student_checkpoint_visits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id INTEGER NOT NULL,
      checkpoint_id INTEGER NOT NULL,
      student_id TEXT NOT NULL,
      visited_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      lat REAL NOT NULL,
      lng REAL NOT NULL,
      accuracy REAL,
      distance_to_checkpoint REAL,
      credential_signature_valid INTEGER DEFAULT 1,
      FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
      FOREIGN KEY (checkpoint_id) REFERENCES event_checkpoints(id) ON DELETE CASCADE,
      FOREIGN KEY (student_id) REFERENCES students(student_id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS student_task_assignments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id INTEGER NOT NULL,
      checkpoint_id INTEGER NOT NULL,
      task_id INTEGER NOT NULL,
      student_id TEXT NOT NULL,
      assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      status TEXT CHECK(status IN ('assigned', 'submitted', 'verified', 'rejected')) DEFAULT 'assigned',
      submission_data TEXT,
      photo_url TEXT,
      photo_hash TEXT,
      exif_metadata TEXT,
      verification_score REAL DEFAULT 100,
      flag_duplicate INTEGER DEFAULT 0,
      duplicate_source_id INTEGER,
      duplicate_reason TEXT,
      completed_at DATETIME,
      FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
      FOREIGN KEY (checkpoint_id) REFERENCES event_checkpoints(id) ON DELETE CASCADE,
      FOREIGN KEY (task_id) REFERENCES checkpoint_tasks(id) ON DELETE CASCADE,
      FOREIGN KEY (student_id) REFERENCES students(student_id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS system_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      description TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
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
      signature_valid INTEGER DEFAULT 1,
      signature_payload TEXT,
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

    CREATE TABLE IF NOT EXISTS webauthn_credentials (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id TEXT NOT NULL,
      credential_id TEXT UNIQUE NOT NULL,
      public_key TEXT NOT NULL,
      counter INTEGER DEFAULT 0,
      transports TEXT,
      device_label TEXT,
      registered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (student_id) REFERENCES students(student_id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS webauthn_challenges (
      student_id TEXT PRIMARY KEY,
      challenge TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS otp_codes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id TEXT NOT NULL,
      hashed_code TEXT NOT NULL,
      expires_at DATETIME NOT NULL,
      used INTEGER DEFAULT 0,
      attempt_count INTEGER DEFAULT 0,
      max_attempts INTEGER DEFAULT 5,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (student_id) REFERENCES students(student_id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_logs_event_student ON attendance_logs (event_id, student_id);
    CREATE INDEX IF NOT EXISTS idx_logs_event_timestamp ON attendance_logs (event_id, timestamp DESC);
    CREATE INDEX IF NOT EXISTS idx_events_status ON events (status);
    CREATE INDEX IF NOT EXISTS idx_violations_event ON violations (event_id);
    CREATE INDEX IF NOT EXISTS idx_checkpoints_event ON event_checkpoints (event_id);
    CREATE INDEX IF NOT EXISTS idx_tasks_checkpoint ON checkpoint_tasks (checkpoint_id);
    CREATE INDEX IF NOT EXISTS idx_assignments_student ON student_task_assignments (event_id, checkpoint_id, student_id);
    CREATE INDEX IF NOT EXISTS idx_webauthn_student ON webauthn_credentials (student_id);
    CREATE INDEX IF NOT EXISTS idx_otp_student ON otp_codes (student_id, expires_at);
  `);

  // Safe table migrations for existing database schemas
  try { db.exec(`ALTER TABLE students ADD COLUMN email TEXT;`); } catch (e) {}
  try { db.exec(`ALTER TABLE students ADD COLUMN public_key TEXT;`); } catch (e) {}
  try { db.exec(`ALTER TABLE students ADD COLUMN key_enrolled_at DATETIME;`); } catch (e) {}
  try { db.exec(`ALTER TABLE events ADD COLUMN allow_duplicate_tasks INTEGER DEFAULT 0;`); } catch (e) {}
  try { db.exec(`ALTER TABLE events ADD COLUMN randomize_tasks INTEGER DEFAULT 0;`); } catch (e) {}
  try { db.exec(`ALTER TABLE events ADD COLUMN task_collision_window_minutes INTEGER DEFAULT 10;`); } catch (e) {}
  try { db.exec(`ALTER TABLE events ADD COLUMN max_checkpoints INTEGER DEFAULT 3;`); } catch (e) {}
  try { db.exec(`ALTER TABLE attendance_logs ADD COLUMN auth_method TEXT DEFAULT 'webauthn';`); } catch (e) {}
  try { db.exec(`ALTER TABLE attendance_logs ADD COLUMN signature_valid INTEGER DEFAULT 1;`); } catch (e) {}
  try { db.exec(`ALTER TABLE attendance_logs ADD COLUMN signature_payload TEXT;`); } catch (e) {}

  // Populate default university emails for existing students missing an email
  try {
    db.exec(`UPDATE students SET email = LOWER(student_id) || '@mmsu.edu.ph' WHERE email IS NULL OR email = '';`);
  } catch (e) {}

  // Seed default system settings
  try {
    const insertSetting = db.prepare(`
      INSERT OR IGNORE INTO system_settings (key, value, description)
      VALUES (?, ?, ?)
    `);
    insertSetting.run('stationary_window_seconds', '300', 'Time window in seconds to evaluate stationary GPS anomaly');
    insertSetting.run('stationary_movement_threshold_m', '1.0', 'Maximum displacement in meters below which stationary anomaly triggers');
    insertSetting.run('duplicate_hamming_threshold', '5', 'Maximum Hamming distance for perceptual hash duplicate photo detection (<=5 out of 64 bits)');
  } catch (e) {}

  try {
    const { normalizePolygon, calculateCentroid, calculateMaxRadius } = require('./services/geofence');
    const eventsWithoutPoly = db.prepare(`SELECT id, center_lat, center_lng, radius_m FROM events WHERE polygon_coordinates IS NULL OR polygon_coordinates = '' OR polygon_coordinates = '[]'`).all();
    
    const updateStmt = db.prepare(`UPDATE events SET polygon_coordinates = ?, center_lat = ?, center_lng = ?, radius_m = ? WHERE id = ?`);
    
    eventsWithoutPoly.forEach(ev => {
      const cLat = ev.center_lat || 18.1960;
      const cLng = ev.center_lng || 120.5927;
      const R = 6371000;
      const rad = (ev.radius_m || 120) / 2;
      const cosLat = Math.cos(cLat * (Math.PI / 180));
      
      const offsets = [
        [-rad, -rad],
        [+rad, -rad],
        [+rad, +rad],
        [+rad * 0.4, +rad],
        [+rad * 0.4, -rad * 0.2],
        [-rad * 0.4, -rad * 0.2],
        [-rad * 0.4, +rad],
        [-rad, +rad]
      ];
      const uShape = offsets.map(([dy, dx]) => [
        Math.round((cLat + (dy / R) * (180 / Math.PI)) * 100000) / 100000,
        Math.round((cLng + (dx / (R * cosLat)) * (180 / Math.PI)) * 100000) / 100000
      ]);

      const norm = normalizePolygon(uShape);
      const centroid = calculateCentroid(norm);
      const maxR = calculateMaxRadius(norm, centroid);
      updateStmt.run(JSON.stringify(norm), centroid.lat, centroid.lng, maxR, ev.id);
    });
  } catch (e) {}
}

initDb();

module.exports = db;
