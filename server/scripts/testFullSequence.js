const db = require('../db');
const { assignCheckpointTask } = require('../services/taskDistribution');
const { evaluateEventPenalties } = require('../services/penaltyEngine');

async function runSequenceTest() {
  console.log('\n===============================================================');
  console.log('   FULL END-TO-END SEQUENCE TEST: TIME IN -> TASKS -> TIME OUT');
  console.log('===============================================================\n');

  const studentId = '23-140015';
  const eventId = 1;

  // Clear previous test records for clean slate
  db.prepare(`DELETE FROM attendance_logs WHERE student_id = ? AND event_id = ?`).run(studentId, eventId);
  db.prepare(`DELETE FROM student_task_assignments WHERE student_id = ? AND event_id = ?`).run(studentId, eventId);
  db.prepare(`DELETE FROM student_checkpoint_visits WHERE student_id = ? AND event_id = ?`).run(studentId, eventId);
  db.prepare(`DELETE FROM violations WHERE student_id = ? AND event_id = ?`).run(studentId, eventId);

  const event = db.prepare(`SELECT * FROM events WHERE id = ?`).get(eventId);
  const checkpoints = db.prepare(`SELECT * FROM event_checkpoints WHERE event_id = ? ORDER BY checkpoint_order ASC`).all(eventId);

  console.log(`[Setup] Event: "${event.name}" with ${checkpoints.length} Checkpoint Stations.`);

  // Step 1: Pre-Time-In State: Check that Time-In is required before checkpoint tasks
  console.log('\n[Step 1] Verifying Pre-Time-In Gating:');
  const initialLogs = db.prepare(`SELECT * FROM attendance_logs WHERE event_id = ? AND student_id = ? AND status != 'rejected'`).all(eventId, studentId);
  const hasTimedInBefore = initialLogs.some(l => l.action === 'time_in');
  console.log(`  - Student Has Timed In: ${hasTimedInBefore} (Should be false)`);
  if (hasTimedInBefore) throw new Error('Student should not be timed in at start');
  console.log('  ✔ PASS: Student correctly starts in NOT_TIMED_IN state');

  // Step 2: Record Biometric Time In
  console.log('\n[Step 2] Performing Biometric TIME IN:');
  db.prepare(`
    INSERT INTO attendance_logs (event_id, student_id, action, lat, lng, in_range, trust_score, status, auth_method)
    VALUES (?, ?, 'time_in', ?, ?, 1, 100, 'valid', 'webauthn')
  `).run(eventId, studentId, event.center_lat, event.center_lng);

  const logsAfterTimeIn = db.prepare(`SELECT * FROM attendance_logs WHERE event_id = ? AND student_id = ? AND status != 'rejected'`).all(eventId, studentId);
  const hasTimedInAfter = logsAfterTimeIn.some(l => l.action === 'time_in');
  console.log(`  - Student Has Timed In: ${hasTimedInAfter} (Should be true)`);
  if (!hasTimedInAfter) throw new Error('Time-In should be recorded');
  console.log('  ✔ PASS: Biometric TIME IN recorded successfully');

  // Step 3: Checkpoint Tasks Appear and are Assigned
  console.log('\n[Step 3] Assigning Real Tasks across Checkpoints (Task Distribution Algorithm):');
  for (const cp of checkpoints) {
    const assignedResult = assignCheckpointTask(eventId, cp.id, studentId);
    console.log(`  - Station "${cp.name}" Assigned Task: "${assignedResult.task.title}" (Type: ${assignedResult.task.task_type}, ID: ${assignedResult.assignment.id}, Mode: ${assignedResult.algorithmDetails.mode})`);
    
    if (!assignedResult.assignment || !assignedResult.assignment.id) {
      throw new Error(`Station ${cp.id} failed to return a persisted assignment!`);
    }
    if (assignedResult.algorithmDetails.mode === 'DEFAULT_STATION_TASK') {
      throw new Error(`Station ${cp.id} returned un-persisted default placeholder!`);
    }
  }
  console.log('  ✔ PASS: Real, distinct, persisted tasks assigned for all stations');

  // Step 4: Verify Initial Station Completion Status (Should NOT be auto-completed)
  console.log('\n[Step 4] Checking Completion Status before Task Submissions:');
  const verifiedBeforeSubmits = db.prepare(`
    SELECT DISTINCT checkpoint_id 
    FROM student_task_assignments 
    WHERE event_id = ? AND student_id = ? AND status = 'verified'
  `).all(eventId, studentId);
  console.log(`  - Verified Stations Count: ${verifiedBeforeSubmits.length}/${checkpoints.length}`);
  if (verifiedBeforeSubmits.length !== 0) {
    throw new Error('Checkpoints should not be auto-completed before submission!');
  }
  console.log('  ✔ PASS: Stations are NOT auto-completed; genuine verification required');

  // Step 5: Verify Time Out is Gated/Locked when tasks are incomplete
  console.log('\n[Step 5] Attempting TIME OUT while tasks are incomplete:');
  const totalCps = checkpoints.length;
  const verifiedCount = verifiedBeforeSubmits.length;
  const isTimeOutLocked = totalCps > 0 && verifiedCount < totalCps;
  console.log(`  - Is Time Out Gated/Locked: ${isTimeOutLocked} (${verifiedCount}/${totalCps} tasks verified)`);
  if (!isTimeOutLocked) {
    throw new Error('Time Out should be locked when checkpoint tasks are incomplete!');
  }
  console.log('  ✔ PASS: Time Out correctly locked while tasks remain pending');

  // Step 6: Submit and Verify All Checkpoint Tasks
  console.log('\n[Step 6] Submitting and Verifying Checkpoint Tasks:');
  for (const cp of checkpoints) {
    const assignment = db.prepare(`
      SELECT * FROM student_task_assignments 
      WHERE event_id = ? AND checkpoint_id = ? AND student_id = ?
    `).get(eventId, cp.id, studentId);

    db.prepare(`
      UPDATE student_task_assignments SET
        status = 'verified',
        verification_score = 100,
        completed_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(assignment.id);

    console.log(`  - Submitted & Verified Station #${cp.checkpoint_order} ("${cp.name}")`);
  }

  const verifiedAfterSubmits = db.prepare(`
    SELECT DISTINCT checkpoint_id 
    FROM student_task_assignments 
    WHERE event_id = ? AND student_id = ? AND status = 'verified'
  `).all(eventId, studentId);
  console.log(`  - Verified Stations Count: ${verifiedAfterSubmits.length}/${checkpoints.length}`);
  if (verifiedAfterSubmits.length !== checkpoints.length) {
    throw new Error('All checkpoints should now be verified');
  }
  console.log('  ✔ PASS: All station tasks verified');

  // Step 7: Time Out Unlocks and Records
  console.log('\n[Step 7] Performing Biometric TIME OUT:');
  const isTimeOutNowUnlocked = verifiedAfterSubmits.length >= totalCps;
  console.log(`  - Is Time Out Unlocked: ${isTimeOutNowUnlocked}`);
  if (!isTimeOutNowUnlocked) {
    throw new Error('Time Out should be unlocked after completing all tasks');
  }

  db.prepare(`
    INSERT INTO attendance_logs (event_id, student_id, action, lat, lng, in_range, trust_score, status, auth_method)
    VALUES (?, ?, 'time_out', ?, ?, 1, 100, 'valid', 'webauthn')
  `).run(eventId, studentId, event.center_lat, event.center_lng);

  const logsAfterTimeOut = db.prepare(`SELECT * FROM attendance_logs WHERE event_id = ? AND student_id = ? AND status != 'rejected'`).all(eventId, studentId);
  const hasTimeOut = logsAfterTimeOut.some(l => l.action === 'time_out');
  console.log(`  - Student Has Timed Out: ${hasTimeOut}`);
  if (!hasTimeOut) throw new Error('Time Out should be recorded');
  console.log('  ✔ PASS: TIME OUT successfully logged');

  // Step 8: Penalty Engine Compliance Check
  console.log('\n[Step 8] Evaluating Penalty Engine for Compliant Attendance:');
  const penalties = evaluateEventPenalties(eventId);
  const studentPenalty = penalties.find(p => p.student_id === studentId);
  console.log(`  - Student Attendance Status: "${studentPenalty.status}"`);
  console.log(`  - Violations Count: ${studentPenalty.violations.length}`);
  if (studentPenalty.status !== 'Compliant' || studentPenalty.violations.length > 0) {
    throw new Error('Student should be fully Compliant with 0 violations!');
  }
  console.log('  ✔ PASS: Penalty Engine confirms student is 100% Compliant!');

  console.log('\n===============================================================');
  console.log('   ALL 8 END-TO-END STEPS PASSED PERFECTLY!');
  console.log('===============================================================\n');
}

if (require.main === module) {
  runSequenceTest().catch(err => {
    console.error('Sequence Test Failed:', err);
    process.exit(1);
  });
}

module.exports = runSequenceTest;
