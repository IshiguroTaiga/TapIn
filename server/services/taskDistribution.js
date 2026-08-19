/**
 * Task Distribution Algorithm Service
 * 
 * Manages fair, anti-collusion task assignment from checkpoint task pools.
 * 
 * Rules & Toggles:
 * - Default: No two students at the same checkpoint in the same time window get the same task.
 * - Toggle 1: "Allow Duplicate Tasks" (allow_duplicate_tasks = 1/0)
 * - Toggle 2: "Randomize Tasks" (randomize_tasks = 1/0)
 * - Time Window: task_collision_window_minutes (default: 10 mins)
 */

const db = require('../db');

/**
 * Assigns an optimal task to a student entering a checkpoint zone.
 * 
 * @param {Number} eventId Event ID
 * @param {Number} checkpointId Checkpoint ID
 * @param {String} studentId Student ID
 * @returns {Object} { task, assignment, isExisting, algorithmDetails }
 */
function assignCheckpointTask(eventId, checkpointId, studentId) {
  // 1. Check if student already has an existing assignment for this checkpoint
  const existingAssignment = db.prepare(`
    SELECT a.*, t.title, t.description, t.task_type, t.instructions, t.verification_rule
    FROM student_task_assignments a
    JOIN checkpoint_tasks t ON a.task_id = t.id
    WHERE a.event_id = ? AND a.checkpoint_id = ? AND a.student_id = ?
    ORDER BY a.assigned_at DESC LIMIT 1
  `).get(eventId, checkpointId, studentId);

  if (existingAssignment) {
    return {
      isExisting: true,
      assignment: existingAssignment,
      task: {
        id: existingAssignment.task_id,
        title: existingAssignment.title,
        description: existingAssignment.description,
        task_type: existingAssignment.task_type,
        instructions: existingAssignment.instructions,
        verification_rule: existingAssignment.verification_rule
      },
      algorithmDetails: {
        mode: 'EXISTING_ASSIGNMENT_RESUMED',
        assignedAt: existingAssignment.assigned_at,
        status: existingAssignment.status
      }
    };
  }

  // 2. Fetch Event Settings & Toggles
  const event = db.prepare(`SELECT * FROM events WHERE id = ?`).get(eventId);
  const allowDuplicates = event ? Boolean(event.allow_duplicate_tasks) : false;
  const randomizeTasks = event ? Boolean(event.randomize_tasks) : false;
  const windowMinutes = event && event.task_collision_window_minutes ? parseInt(event.task_collision_window_minutes) : 10;

  // 3. Fetch all active tasks for this checkpoint
  let poolTasks = db.prepare(`
    SELECT * FROM checkpoint_tasks 
    WHERE checkpoint_id = ? AND is_active = 1
    ORDER BY id ASC
  `).all(checkpointId);

  if (!poolTasks || poolTasks.length === 0) {
    const cp = db.prepare(`SELECT * FROM event_checkpoints WHERE id = ?`).get(checkpointId);
    const cpName = cp?.name || `Checkpoint #${checkpointId}`;

    const insertTask = db.prepare(`
      INSERT INTO checkpoint_tasks (checkpoint_id, title, description, task_type, instructions, verification_rule, is_active)
      VALUES (?, ?, ?, ?, ?, ?, 1)
    `);

    insertTask.run(
      checkpointId,
      `${cpName} Photo Verification`,
      `Capture a clear verification photograph at ${cpName} to verify physical station presence.`,
      'photo',
      'Frame the landmark or station booth clearly in the viewfinder.',
      'EXIF_METADATA_AND_PHASH'
    );

    insertTask.run(
      checkpointId,
      `${cpName} Station Code`,
      `Confirm your presence by entering the station or desk identification code at ${cpName}.`,
      'text',
      'Look for the physical station sign and type the code or room number.',
      'EXACT_MATCH'
    );

    poolTasks = db.prepare(`
      SELECT * FROM checkpoint_tasks 
      WHERE checkpoint_id = ? AND is_active = 1
      ORDER BY id ASC
    `).all(checkpointId);
  }

  // 4. Determine Eligible Tasks
  let candidateTasks = [...poolTasks];
  let recentAssignments = [];

  if (!allowDuplicates) {
    // Find all tasks assigned to other students in the last `windowMinutes`
    const windowStart = new Date(Date.now() - windowMinutes * 60 * 1000).toISOString();
    recentAssignments = db.prepare(`
      SELECT task_id, student_id, assigned_at 
      FROM student_task_assignments
      WHERE checkpoint_id = ? AND student_id != ? AND assigned_at >= ?
    `).all(checkpointId, studentId, windowStart);

    const recentTaskIds = new Set(recentAssignments.map(r => r.task_id));

    // Filter out tasks currently active/assigned in the collision window
    const nonCollidingTasks = poolTasks.filter(t => !recentTaskIds.has(t.id));

    if (nonCollidingTasks.length > 0) {
      candidateTasks = nonCollidingTasks;
    } else {
      // All tasks in the pool have been assigned within the window.
      // Fallback: Pick the task assigned least recently or with lowest overall count.
      const taskUsageCounts = db.prepare(`
        SELECT task_id, COUNT(*) as count, MAX(assigned_at) as last_assigned
        FROM student_task_assignments
        WHERE checkpoint_id = ?
        GROUP BY task_id
      `).all(checkpointId);

      const usageMap = {};
      taskUsageCounts.forEach(u => { usageMap[u.task_id] = u; });

      // Sort candidate tasks by lowest usage count and oldest assignment
      candidateTasks = [...poolTasks].sort((a, b) => {
        const usageA = usageMap[a.id]?.count || 0;
        const usageB = usageMap[b.id]?.count || 0;
        if (usageA !== usageB) return usageA - usageB;
        const lastA = usageMap[a.id]?.last_assigned || '1970-01-01';
        const lastB = usageMap[b.id]?.last_assigned || '1970-01-01';
        return new Date(lastA) - new Date(lastB);
      });
    }
  }

  // 5. Task Selection: Randomized vs Deterministic Round-Robin / Least-Assigned
  let selectedTask;
  if (randomizeTasks) {
    // Uniform random selection from candidate pool
    const randomIndex = Math.floor(Math.random() * candidateTasks.length);
    selectedTask = candidateTasks[randomIndex];
  } else {
    // Deterministic balanced allocation (least-assigned across all time)
    const taskTotalCounts = db.prepare(`
      SELECT task_id, COUNT(*) as total_count 
      FROM student_task_assignments 
      WHERE checkpoint_id = ?
      GROUP BY task_id
    `).all(checkpointId);

    const countMap = {};
    taskTotalCounts.forEach(c => { countMap[c.task_id] = c.total_count; });

    candidateTasks.sort((a, b) => {
      const cntA = countMap[a.id] || 0;
      const cntB = countMap[b.id] || 0;
      return cntA - cntB;
    });

    selectedTask = candidateTasks[0];
  }

  // 6. Create Assignment Record in Database
  const insertStmt = db.prepare(`
    INSERT INTO student_task_assignments 
    (event_id, checkpoint_id, task_id, student_id, assigned_at, status)
    VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, 'assigned')
  `);

  const result = insertStmt.run(eventId, checkpointId, selectedTask.id, studentId);
  const newAssignment = db.prepare(`SELECT * FROM student_task_assignments WHERE id = ?`).get(result.lastInsertRowid);

  return {
    isExisting: false,
    assignment: newAssignment,
    task: selectedTask,
    algorithmDetails: {
      mode: allowDuplicates ? 'DUPLICATES_ALLOWED' : 'COLLISION_FREE_ANTI_COLLUSION',
      randomized: randomizeTasks,
      poolSize: poolTasks.length,
      candidatesAvailable: candidateTasks.length,
      recentCollisionsAvoided: recentAssignments.length,
      windowMinutes
    }
  };
}

/**
 * Gets all tasks and assignments summary for an event checkpoint.
 */
function getCheckpointTaskMetrics(checkpointId) {
  const tasks = db.prepare(`
    SELECT t.*, 
      (SELECT COUNT(*) FROM student_task_assignments a WHERE a.task_id = t.id) as total_assignments,
      (SELECT COUNT(*) FROM student_task_assignments a WHERE a.task_id = t.id AND a.status = 'verified') as completed_count
    FROM checkpoint_tasks t
    WHERE t.checkpoint_id = ?
    ORDER BY t.id ASC
  `).all(checkpointId);

  const recentAssignments = db.prepare(`
    SELECT a.*, s.name as student_name, t.title as task_title
    FROM student_task_assignments a
    JOIN students s ON a.student_id = s.student_id
    JOIN checkpoint_tasks t ON a.task_id = t.id
    WHERE a.checkpoint_id = ?
    ORDER BY a.assigned_at DESC LIMIT 20
  `).all(checkpointId);

  return {
    tasks,
    recentAssignments
  };
}

module.exports = {
  assignCheckpointTask,
  getCheckpointTaskMetrics
};
