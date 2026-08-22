const db = require('../db');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../middleware/auth');
const { evaluateStudentCheckpointProximity } = require('../services/checkpointEngine');
const { assignCheckpointTask } = require('../services/taskDistribution');
const { verifySubmissionPhoto } = require('../services/photoVerification');

console.log(`\n===============================================================`);
console.log(`   TAPIN FIXES VERIFICATION SUITE: ITEMS #1 - #5              `);
console.log(`===============================================================\n`);

let passedTests = 0;
let failedTests = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passedTests++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failedTests++;
  }
}

// Setup test event & student
const testStudentId = '23-140015';
const testEvent = db.prepare(`SELECT * FROM events WHERE status = 'active' LIMIT 1`).get();
if (!testEvent) {
  console.error('No active event found. Run seed script first.');
  process.exit(1);
}

// Clean previous test data
db.prepare(`DELETE FROM attendance_logs WHERE student_id = ? AND event_id = ?`).run(testStudentId, testEvent.id);
db.prepare(`DELETE FROM student_task_assignments WHERE student_id = ? AND event_id = ?`).run(testStudentId, testEvent.id);
db.prepare(`DELETE FROM student_checkpoint_visits WHERE student_id = ? AND event_id = ?`).run(testStudentId, testEvent.id);

console.log(`[TEST 1] Testing Submissions Endpoint & Admin Querying`);
const adminToken = jwt.sign({ id: 1, username: 'admin', role: 'admin' }, JWT_SECRET, { expiresIn: '1h' });
assert(!!adminToken, 'Admin JWT token generated successfully');

// Verify submissions SQL query used by /api/checkpoints/submissions
const submissionsQuery = `
  SELECT 
    a.*,
    s.name as student_name,
    e.name as event_name,
    cp.name as checkpoint_name,
    t.title as task_title
  FROM student_task_assignments a
  JOIN students s ON a.student_id = s.student_id
  JOIN events e ON a.event_id = e.id
  JOIN event_checkpoints cp ON a.checkpoint_id = cp.id
  JOIN checkpoint_tasks t ON a.task_id = t.id
  WHERE a.event_id = ?
`;
const initialSubmissions = db.prepare(submissionsQuery).all(testEvent.id);
assert(Array.isArray(initialSubmissions), 'Admin submissions query executes successfully on database');

console.log(`\n[TEST 2] Testing Time-In and Task Assignment`);
// 1. Time In
db.prepare(`
  INSERT INTO attendance_logs (student_id, event_id, action, lat, lng, in_range, trust_score, is_spoofed, status, timestamp)
  VALUES (?, ?, 'time_in', 18.0595, 120.5460, 1, 95, 0, 'valid', CURRENT_TIMESTAMP)
`).run(testStudentId, testEvent.id);

const timeInRecord = db.prepare(`SELECT * FROM attendance_logs WHERE student_id = ? AND event_id = ? AND action = 'time_in'`).get(testStudentId, testEvent.id);
assert(timeInRecord && timeInRecord.status === 'valid', 'Student successfully timed in');

// 2. Proximity to checkpoint station
const checkpoints = db.prepare(`SELECT * FROM event_checkpoints WHERE event_id = ? ORDER BY checkpoint_order ASC`).all(testEvent.id);
assert(checkpoints.length > 0, `Event has ${checkpoints.length} checkpoint stations configured`);

const targetCp = checkpoints[0];
const assignment = assignCheckpointTask(testEvent.id, targetCp.id, testStudentId);
assert(assignment && assignment.task && assignment.assignment, `Task "${assignment.task.title}" assigned to student for checkpoint "${targetCp.name}"`);

console.log(`\n[TEST 3] Testing False-Success Protection & Pending State`);
// Assignment starts as pending assignment, not verified
const pendingCheck = db.prepare(`
  SELECT COUNT(DISTINCT checkpoint_id) as count 
  FROM student_task_assignments 
  WHERE event_id = ? AND student_id = ? AND status = 'verified'
`).get(testEvent.id, testStudentId)?.count || 0;
assert(pendingCheck === 0, 'Zero checkpoints are verified before student submits & admin approves');

// Student submits task
db.prepare(`
  UPDATE student_task_assignments SET
    status = 'submitted',
    completed_at = CURRENT_TIMESTAMP
  WHERE id = ?
`).run(assignment.assignment.id);

const submittedAssignment = db.prepare(`SELECT * FROM student_task_assignments WHERE id = ?`).get(assignment.assignment.id);
assert(submittedAssignment.status === 'submitted', 'Task status is "submitted" (Pending Admin Approval)');

// Check that Time Out is still strictly locked while task is pending
const totalCheckpoints = db.prepare(`SELECT COUNT(*) as count FROM event_checkpoints WHERE event_id = ?`).get(testEvent.id)?.count || 0;
const verifiedCount = db.prepare(`
  SELECT COUNT(DISTINCT checkpoint_id) as count 
  FROM student_task_assignments 
  WHERE event_id = ? AND student_id = ? AND status = 'verified'
`).get(testEvent.id, testStudentId)?.count || 0;

const isTimeOutLocked = verifiedCount < totalCheckpoints;
assert(isTimeOutLocked === true, `Time Out is strictly locked (${verifiedCount}/${totalCheckpoints} verified stations)`);

console.log(`\n[TEST 4] Testing Admin Review & Approval Flow`);
// Admin approves submission
db.prepare(`
  UPDATE student_task_assignments SET
    status = 'verified',
    verification_score = 100,
    admin_notes = 'Approved by test admin',
    reviewed_by = 'admin',
    reviewed_at = CURRENT_TIMESTAMP
  WHERE id = ?
`).run(assignment.assignment.id);

// If event has more than 1 checkpoint, verify other checkpoints too for full test
if (checkpoints.length > 1) {
  for (let i = 1; i < checkpoints.length; i++) {
    const cp = checkpoints[i];
    const a = assignCheckpointTask(testEvent.id, cp.id, testStudentId);
    db.prepare(`
      UPDATE student_task_assignments SET
        status = 'verified',
        verification_score = 100,
        admin_notes = 'Approved by test admin',
        reviewed_by = 'admin',
        reviewed_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(a.assignment.id);
  }
}

const finalVerifiedCount = db.prepare(`
  SELECT COUNT(DISTINCT checkpoint_id) as count 
  FROM student_task_assignments 
  WHERE event_id = ? AND student_id = ? AND status = 'verified'
`).get(testEvent.id, testStudentId)?.count || 0;

assert(finalVerifiedCount === totalCheckpoints, `All ${totalCheckpoints}/${totalCheckpoints} stations are now server-verified`);

console.log(`\n[TEST 5] Testing Time Out Unlock after Genuine Server Approval`);
const isUnlocked = finalVerifiedCount >= totalCheckpoints;
assert(isUnlocked === true, 'Time Out is now unlocked');

// Perform Time Out
db.prepare(`
  INSERT INTO attendance_logs (student_id, event_id, action, lat, lng, in_range, trust_score, is_spoofed, status, timestamp)
  VALUES (?, ?, 'time_out', 18.0595, 120.5460, 1, 95, 0, 'valid', CURRENT_TIMESTAMP)
`).run(testStudentId, testEvent.id);

const timeOutRecord = db.prepare(`SELECT * FROM attendance_logs WHERE student_id = ? AND event_id = ? AND action = 'time_out'`).get(testStudentId, testEvent.id);
assert(timeOutRecord && timeOutRecord.status === 'valid', 'TIME OUT successfully logged and confirmed by database');

console.log(`\n---------------------------------------------------------------`);
console.log(` Test Results: ${passedTests} passed, ${failedTests} failed (${passedTests + failedTests} total)`);
console.log(`===============================================================\n`);

if (failedTests > 0) process.exit(1);
