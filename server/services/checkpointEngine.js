/**
 * Checkpoint Engine Service
 * 
 * Manages event checkpoints nested inside the main event polygon geofence.
 * Handles checkpoint validation, containment checks, student checkpoint visits,
 * and progress tracking.
 */

const db = require('../db');
const { calculateDistance } = require('./haversine');
const { isWithinPolygonGeofence, normalizePolygon } = require('./geofence');

/**
 * Validates that all checkpoint points lie inside the event's polygon boundary.
 * 
 * @param {Array} checkpoints Array of { lat, lng, name, radius_m }
 * @param {Object} event Event object with polygon_coordinates, center_lat, center_lng, radius_m
 * @returns {Object} { isValid: Boolean, invalidCheckpoints: Array }
 */
function validateCheckpointsInsideEvent(checkpoints, event) {
  if (!Array.isArray(checkpoints) || checkpoints.length === 0) {
    return { isValid: true, invalidCheckpoints: [] };
  }

  const polygon = event.polygon_coordinates ? normalizePolygon(event.polygon_coordinates) : [];
  const invalidCheckpoints = [];

  checkpoints.forEach((cp, index) => {
    const lat = parseFloat(cp.lat);
    const lng = parseFloat(cp.lng);

    if (isNaN(lat) || isNaN(lng)) {
      invalidCheckpoints.push({ index, checkpoint: cp, reason: 'Invalid coordinates' });
      return;
    }

    let isInside = false;
    if (polygon && polygon.length >= 3) {
      const pipResult = isWithinPolygonGeofence([lat, lng], polygon, {
        centerLat: event.center_lat,
        centerLng: event.center_lng,
        radiusMeters: event.radius_m
      });
      isInside = pipResult.inRange;
    } else {
      const dist = calculateDistance(lat, lng, event.center_lat, event.center_lng);
      isInside = dist <= (event.radius_m || 100);
    }

    if (!isInside) {
      invalidCheckpoints.push({
        index,
        checkpoint: cp,
        reason: `Checkpoint "${cp.name || 'Checkpoint #' + (index + 1)}" coordinates (${lat}, ${lng}) lie outside the event venue polygon geofence`
      });
    }
  });

  return {
    isValid: invalidCheckpoints.length === 0,
    invalidCheckpoints
  };
}

/**
 * Gets all checkpoints for an event with attached active tasks count.
 */
function getEventCheckpoints(eventId) {
  const checkpoints = db.prepare(`
    SELECT * FROM event_checkpoints 
    WHERE event_id = ? 
    ORDER BY checkpoint_order ASC, id ASC
  `).all(eventId);

  const getTasksStmt = db.prepare(`
    SELECT * FROM checkpoint_tasks 
    WHERE checkpoint_id = ? AND is_active = 1 
    ORDER BY id ASC
  `);

  return checkpoints.map(cp => ({
    ...cp,
    tasks: getTasksStmt.all(cp.id)
  }));
}

/**
 * Evaluates student location against all checkpoints of an active event.
 * 
 * @param {Number} lat Student latitude
 * @param {Number} lng Student longitude
 * @param {Number} eventId Active event ID
 * @param {String} studentId Student ID
 * @returns {Object} { matchedCheckpoint, distanceMeters, inCheckpointZone, allCheckpointsProgress }
 */
function evaluateStudentCheckpointProximity(lat, lng, eventId, studentId) {
  const checkpoints = getEventCheckpoints(eventId);
  if (checkpoints.length === 0) {
    return {
      hasCheckpoints: false,
      matchedCheckpoint: null,
      inCheckpointZone: false,
      allCheckpointsProgress: []
    };
  }

  // Fetch student's completed or visited checkpoints for this event
  const visits = db.prepare(`
    SELECT checkpoint_id, visited_at FROM student_checkpoint_visits 
    WHERE event_id = ? AND student_id = ?
  `).all(eventId, studentId);

  const visitedSet = new Set(visits.map(v => v.checkpoint_id));

  let matchedCheckpoint = null;
  let minDistance = Infinity;

  const progressList = checkpoints.map(cp => {
    const dist = calculateDistance(lat, lng, cp.lat, cp.lng);
    const inZone = dist <= (cp.radius_m || 20);
    const isVisited = visitedSet.has(cp.id);

    if (inZone && dist < minDistance) {
      minDistance = dist;
      matchedCheckpoint = {
        ...cp,
        distanceMeters: Math.round(dist * 10) / 10,
        inZone: true,
        isVisited
      };
    }

    return {
      id: cp.id,
      name: cp.name,
      order: cp.checkpoint_order,
      lat: cp.lat,
      lng: cp.lng,
      radius_m: cp.radius_m,
      distanceMeters: Math.round(dist * 10) / 10,
      inZone,
      isVisited,
      taskCount: cp.tasks.length
    };
  });

  return {
    hasCheckpoints: true,
    matchedCheckpoint,
    inCheckpointZone: !!matchedCheckpoint,
    allCheckpointsProgress: progressList,
    totalCheckpoints: checkpoints.length,
    completedCount: visitedSet.size
  };
}

/**
 * Records a student visit to a checkpoint.
 */
function recordCheckpointVisit(eventId, checkpointId, studentId, telemetry = {}, signatureValid = 1) {
  const { lat = 0, lng = 0, accuracy = null, distance = 0 } = telemetry;

  const existing = db.prepare(`
    SELECT id, visited_at FROM student_checkpoint_visits
    WHERE event_id = ? AND checkpoint_id = ? AND student_id = ?
  `).get(eventId, checkpointId, studentId);

  if (existing) {
    return { isNew: false, visit: existing };
  }

  const result = db.prepare(`
    INSERT INTO student_checkpoint_visits 
    (event_id, checkpoint_id, student_id, lat, lng, accuracy, distance_to_checkpoint, credential_signature_valid)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(eventId, checkpointId, studentId, lat, lng, accuracy, distance, signatureValid ? 1 : 0);

  const newVisit = db.prepare(`SELECT * FROM student_checkpoint_visits WHERE id = ?`).get(result.lastInsertRowid);
  return { isNew: true, visit: newVisit };
}

module.exports = {
  validateCheckpointsInsideEvent,
  getEventCheckpoints,
  evaluateStudentCheckpointProximity,
  recordCheckpointVisit
};
