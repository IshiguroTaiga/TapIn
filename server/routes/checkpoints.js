const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../db');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { validateCheckpointsInsideEvent, getEventCheckpoints, evaluateStudentCheckpointProximity, recordCheckpointVisit } = require('../services/checkpointEngine');
const { assignCheckpointTask, getCheckpointTaskMetrics } = require('../services/taskDistribution');
const { verifySubmissionPhoto } = require('../services/photoVerification');
const { verifySignature } = require('../services/cryptoAuth');

const router = express.Router();

// Configure multer for photo submissions
const uploadStorage = multer.memoryStorage();
const upload = multer({
  storage: uploadStorage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB max photo
});

// 1. Get all checkpoints and task pools for an event
router.get('/event/:eventId', (req, res) => {
  const { eventId } = req.params;
  const event = db.prepare(`SELECT * FROM events WHERE id = ?`).get(eventId);
  if (!event) return res.status(404).json({ error: 'Event not found' });

  const checkpoints = getEventCheckpoints(eventId);
  res.json({
    eventId: parseInt(eventId),
    maxCheckpoints: event.max_checkpoints || 3,
    allowDuplicateTasks: Boolean(event.allow_duplicate_tasks),
    randomizeTasks: Boolean(event.randomize_tasks),
    taskCollisionWindowMinutes: event.task_collision_window_minutes || 10,
    checkpoints
  });
});

// 2. Admin: Save/Update Checkpoints for an event (Up to 3 checkpoints, validated inside polygon geofence)
router.post('/event/:eventId', authenticateToken, requireRole(['admin', 'superadmin']), (req, res) => {
  const { eventId } = req.params;
  const { checkpoints, allowDuplicateTasks, randomizeTasks, taskCollisionWindowMinutes } = req.body;

  const event = db.prepare(`SELECT * FROM events WHERE id = ?`).get(eventId);
  if (!event) return res.status(404).json({ error: 'Event not found' });

  if (!Array.isArray(checkpoints)) {
    return res.status(400).json({ error: 'Checkpoints must be an array' });
  }

  const maxAllowed = event.max_checkpoints || 3;
  if (checkpoints.length > maxAllowed) {
    return res.status(400).json({ error: `Maximum of ${maxAllowed} checkpoints allowed for this event.` });
  }

  // Validate checkpoints lie within event polygon boundary
  const validation = validateCheckpointsInsideEvent(checkpoints, event);
  if (!validation.isValid) {
    return res.status(422).json({
      error: 'Geofence Boundary Violation: Checkpoint is placed outside the event venue boundary polygon.',
      details: validation.invalidCheckpoints
    });
  }

  // Save event-level task distribution settings
  db.prepare(`
    UPDATE events SET
      allow_duplicate_tasks = ?,
      randomize_tasks = ?,
      task_collision_window_minutes = ?
    WHERE id = ?
  `).run(
    allowDuplicateTasks ? 1 : 0,
    randomizeTasks ? 1 : 0,
    parseInt(taskCollisionWindowMinutes || 10),
    eventId
  );

  // Sync checkpoints in transaction
  const saveCheckpoints = db.transaction((cps) => {
    // Collect existing checkpoint IDs to keep or delete
    const existingCheckpoints = db.prepare(`SELECT id FROM event_checkpoints WHERE event_id = ?`).all(eventId);
    const existingIds = new Set(existingCheckpoints.map(c => c.id));
    const keptIds = new Set();

    const insertCheckpoint = db.prepare(`
      INSERT INTO event_checkpoints (event_id, checkpoint_order, name, description, lat, lng, radius_m)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const updateCheckpoint = db.prepare(`
      UPDATE event_checkpoints SET
        checkpoint_order = ?,
        name = ?,
        description = ?,
        lat = ?,
        lng = ?,
        radius_m = ?
      WHERE id = ? AND event_id = ?
    `);

    cps.forEach((cp, idx) => {
      const order = idx + 1;
      const name = cp.name || `Checkpoint #${order}`;
      const desc = cp.description || '';
      const lat = parseFloat(cp.lat);
      const lng = parseFloat(cp.lng);
      const radius = cp.radius_m ? parseFloat(cp.radius_m) : 20.0;

      if (cp.id && existingIds.has(parseInt(cp.id))) {
        updateCheckpoint.run(order, name, desc, lat, lng, radius, cp.id, eventId);
        keptIds.add(parseInt(cp.id));
      } else {
        const result = insertCheckpoint.run(eventId, order, name, desc, lat, lng, radius);
        keptIds.add(result.lastInsertRowid);
      }
    });

    // Delete removed checkpoints
    existingCheckpoints.forEach(c => {
      if (!keptIds.has(c.id)) {
        db.prepare(`DELETE FROM event_checkpoints WHERE id = ?`).run(c.id);
      }
    });
  });

  try {
    saveCheckpoints(checkpoints);
    const updated = getEventCheckpoints(eventId);

    const reqIo = req.app.get('io');
    if (reqIo) reqIo.emit('checkpoints_updated', { eventId, checkpoints: updated });

    res.json({
      message: 'Checkpoints successfully configured',
      checkpoints: updated
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save checkpoints: ' + err.message });
  }
});

// 3. Admin: Add task to checkpoint pool
router.post('/:checkpointId/tasks', authenticateToken, requireRole(['admin', 'superadmin']), (req, res) => {
  const { checkpointId } = req.params;
  const { title, description, task_type = 'photo', instructions, verification_rule } = req.body;

  if (!title || !description) {
    return res.status(400).json({ error: 'Task title and description are required' });
  }

  const cp = db.prepare(`SELECT * FROM event_checkpoints WHERE id = ?`).get(checkpointId);
  if (!cp) return res.status(404).json({ error: 'Checkpoint not found' });

  const result = db.prepare(`
    INSERT INTO checkpoint_tasks (checkpoint_id, title, description, task_type, instructions, verification_rule, is_active)
    VALUES (?, ?, ?, ?, ?, ?, 1)
  `).run(checkpointId, title, description, task_type, instructions || '', verification_rule || 'EXIF_METADATA_AND_PHASH');

  const createdTask = db.prepare(`SELECT * FROM checkpoint_tasks WHERE id = ?`).get(result.lastInsertRowid);
  res.status(201).json({ message: 'Task added to checkpoint pool', task: createdTask });
});

// 4. Admin: Update Task
router.put('/tasks/:taskId', authenticateToken, requireRole(['admin', 'superadmin']), (req, res) => {
  const { taskId } = req.params;
  const { title, description, task_type, instructions, is_active } = req.body;

  const task = db.prepare(`SELECT * FROM checkpoint_tasks WHERE id = ?`).get(taskId);
  if (!task) return res.status(404).json({ error: 'Task not found' });

  db.prepare(`
    UPDATE checkpoint_tasks SET
      title = COALESCE(?, title),
      description = COALESCE(?, description),
      task_type = COALESCE(?, task_type),
      instructions = COALESCE(?, instructions),
      is_active = COALESCE(?, is_active)
    WHERE id = ?
  `).run(title, description, task_type, instructions, is_active !== undefined ? (is_active ? 1 : 0) : task.is_active, taskId);

  const updated = db.prepare(`SELECT * FROM checkpoint_tasks WHERE id = ?`).get(taskId);
  res.json({ message: 'Task updated', task: updated });
});

// 5. Admin: Delete Task
router.delete('/tasks/:taskId', authenticateToken, requireRole(['admin', 'superadmin']), (req, res) => {
  const { taskId } = req.params;
  const task = db.prepare(`SELECT * FROM checkpoint_tasks WHERE id = ?`).get(taskId);
  if (!task) return res.status(404).json({ error: 'Task not found' });

  db.prepare(`DELETE FROM checkpoint_tasks WHERE id = ?`).run(taskId);
  res.json({ message: 'Task deleted successfully' });
});

// 6. Student Proximity & Dynamic Task Assignment
router.post('/proximity', (req, res) => {
  const { student_id, event_id, lat, lng, accuracy, signature } = req.body;

  if (!student_id || !event_id || lat === undefined || lng === undefined) {
    return res.status(400).json({ error: 'student_id, event_id, lat, and lng are required' });
  }

  const student = db.prepare(`SELECT * FROM students WHERE student_id = ?`).get(student_id.trim());
  if (!student) return res.status(404).json({ error: 'Student not found' });

  // Optional cryptographic signature check if signed credential pass was presented
  let signatureValid = 1;
  if (student.public_key && signature) {
    const payload = { student_id: student.student_id, event_id: parseInt(event_id), lat: parseFloat(lat), lng: parseFloat(lng) };
    signatureValid = verifySignature(student.public_key, payload, signature) ? 1 : 0;
  }

  const proximity = evaluateStudentCheckpointProximity(parseFloat(lat), parseFloat(lng), parseInt(event_id), student.student_id);

  let taskAssignment = null;
  if (proximity.inCheckpointZone && proximity.matchedCheckpoint) {
    // Record Checkpoint Visit
    recordCheckpointVisit(parseInt(event_id), proximity.matchedCheckpoint.id, student.student_id, {
      lat: parseFloat(lat),
      lng: parseFloat(lng),
      accuracy: accuracy ? parseFloat(accuracy) : null,
      distance: proximity.matchedCheckpoint.distanceMeters
    }, signatureValid);

    // Assign Task via Task Distribution Algorithm
    taskAssignment = assignCheckpointTask(parseInt(event_id), proximity.matchedCheckpoint.id, student.student_id);
  }

  res.json({
    proximity,
    taskAssignment,
    signatureVerified: student.public_key ? signatureValid === 1 : null
  });
});

// 7. Student: Submit Task Verification (Photo upload with EXIF & Perceptual Hash Duplicate Detection)
router.post('/tasks/:assignmentId/submit', upload.single('photo'), (req, res) => {
  const { assignmentId } = req.params;
  const { student_id, answer_text, signature } = req.body;

  const assignment = db.prepare(`
    SELECT a.*, t.task_type, t.title as task_title, cp.name as checkpoint_name, cp.lat as cp_lat, cp.lng as cp_lng, cp.radius_m as cp_radius
    FROM student_task_assignments a
    JOIN checkpoint_tasks t ON a.task_id = t.id
    JOIN event_checkpoints cp ON a.checkpoint_id = cp.id
    WHERE a.id = ?
  `).get(assignmentId);

  if (!assignment) {
    return res.status(404).json({ error: 'Task assignment not found' });
  }

  if (student_id && assignment.student_id !== student_id.trim()) {
    return res.status(403).json({ error: 'Student ID does not match this assignment' });
  }

  const student = db.prepare(`SELECT * FROM students WHERE student_id = ?`).get(assignment.student_id);

  // If task requires photo
  if (assignment.task_type === 'photo') {
    if (!req.file) {
      return res.status(400).json({ error: 'Photo submission required for this verification task' });
    }

    const checkpointObj = {
      id: assignment.checkpoint_id,
      name: assignment.checkpoint_name,
      lat: assignment.cp_lat,
      lng: assignment.cp_lng,
      radius_m: assignment.cp_radius
    };

    // Run Photo Verification Analytics (EXIF + Perceptual Hash Duplicate Detection)
    const photoAnalysis = verifySubmissionPhoto(req.file.buffer, checkpointObj, assignment.event_id, assignment.student_id);

    // Save image to uploads folder
    const uploadsDir = path.join(__dirname, '../../uploads');
    if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
    
    const filename = `task_${assignment.id}_${Date.now()}.jpg`;
    const filePath = path.join(uploadsDir, filename);
    fs.writeFileSync(filePath, req.file.buffer);
    const photoUrl = `/uploads/${filename}`;

    // Update assignment record
    db.prepare(`
      UPDATE student_task_assignments SET
        status = ?,
        photo_url = ?,
        photo_hash = ?,
        exif_metadata = ?,
        verification_score = ?,
        flag_duplicate = ?,
        duplicate_source_id = ?,
        duplicate_reason = ?,
        completed_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      photoAnalysis.status,
      photoUrl,
      photoAnalysis.duplicateDetection.perceptualHashHex,
      JSON.stringify(photoAnalysis.metadata),
      photoAnalysis.score,
      photoAnalysis.duplicateDetection.isDuplicate ? 1 : 0,
      photoAnalysis.duplicateDetection.matchedStudent ? photoAnalysis.duplicateDetection.matchedStudent.assignment_id : null,
      photoAnalysis.duplicateReason,
      assignment.id
    );

    const updatedAssignment = db.prepare(`SELECT * FROM student_task_assignments WHERE id = ?`).get(assignment.id);

    const responsePayload = {
      success: photoAnalysis.success,
      status: photoAnalysis.status,
      message: photoAnalysis.success
        ? `Task "${assignment.task_title}" successfully verified and completed!`
        : `Task verification flagged: ${photoAnalysis.duplicateReason}`,
      assignment: updatedAssignment,
      photoAnalysis
    };

    const reqIo = req.app.get('io');
    if (reqIo) reqIo.emit('task_submission_updated', responsePayload);

    if (!photoAnalysis.success) {
      return res.status(422).json(responsePayload);
    }

    return res.json(responsePayload);
  } else {
    // Text / Code / Quiz submission
    db.prepare(`
      UPDATE student_task_assignments SET
        status = 'verified',
        submission_data = ?,
        verification_score = 100,
        completed_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(answer_text || '', assignment.id);

    const updated = db.prepare(`SELECT * FROM student_task_assignments WHERE id = ?`).get(assignment.id);
    return res.json({
      success: true,
      status: 'verified',
      message: `Task "${assignment.task_title}" completed!`,
      assignment: updated
    });
  }
});

// 8. Get student checkpoint and task progress for an event
router.get('/student-status/:eventId/:studentId', (req, res) => {
  const { eventId, studentId } = req.params;

  const visits = db.prepare(`
    SELECT v.*, cp.name as checkpoint_name, cp.checkpoint_order
    FROM student_checkpoint_visits v
    JOIN event_checkpoints cp ON v.checkpoint_id = cp.id
    WHERE v.event_id = ? AND v.student_id = ?
    ORDER BY cp.checkpoint_order ASC
  `).all(eventId, studentId.trim());

  const assignments = db.prepare(`
    SELECT a.*, t.title as task_title, t.description as task_description, t.task_type, cp.name as checkpoint_name
    FROM student_task_assignments a
    JOIN checkpoint_tasks t ON a.task_id = t.id
    JOIN event_checkpoints cp ON a.checkpoint_id = cp.id
    WHERE a.event_id = ? AND a.student_id = ?
    ORDER BY a.assigned_at ASC
  `).all(eventId, studentId.trim());

  res.json({
    eventId: parseInt(eventId),
    studentId: studentId.trim(),
    visits,
    assignments
  });
});

module.exports = router;
