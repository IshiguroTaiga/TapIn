/**
 * Heuristics for GPS Spoofing & Anomaly Detection
 */

const { calculateDistance } = require('../haversine');

/**
 * Checks for implausible travel speed between consecutive location reports.
 * Human walking speed ~ 1.4 m/s; sprinting ~ 8-10 m/s; driving on campus ~ 10-15 m/s.
 * Speed > 15 m/s (54 km/h) or instantaneous teleports (>50m in <2s) trigger flags.
 */
function checkSpeed(currentTrace, previousTrace) {
  if (!previousTrace || !previousTrace.timestamp || !previousTrace.lat || !previousTrace.lng) {
    return { flagged: false, speed: 0, penalty: 0, flag: null };
  }

  const distanceMeters = calculateDistance(
    previousTrace.lat,
    previousTrace.lng,
    currentTrace.lat,
    currentTrace.lng
  );

  const timeDeltaSeconds = (new Date(currentTrace.timestamp) - new Date(previousTrace.timestamp)) / 1000;

  if (timeDeltaSeconds <= 0) {
    // Zero or negative time difference with distance change is suspicious
    if (distanceMeters > 5) {
      return {
        flagged: true,
        speed: Infinity,
        penalty: 45,
        flag: 'IMPLAUSIBLE_SPEED',
        reason: 'Distance changed with zero or negative time interval'
      };
    }
    return { flagged: false, speed: 0, penalty: 0, flag: null };
  }

  const speedMetersPerSecond = distanceMeters / timeDeltaSeconds;

  // Speed threshold: 15 m/s = 54 km/h
  if (speedMetersPerSecond > 15) {
    const penalty = Math.min(50, Math.floor(speedMetersPerSecond * 2));
    return {
      flagged: true,
      speed: Math.round(speedMetersPerSecond * 100) / 100,
      penalty: penalty,
      flag: 'IMPLAUSIBLE_SPEED',
      reason: `Calculated speed of ${Math.round(speedMetersPerSecond * 3.6)} km/h exceeds realistic campus speed threshold`
    };
  }

  return {
    flagged: false,
    speed: Math.round(speedMetersPerSecond * 100) / 100,
    penalty: 0,
    flag: null
  };
}

/**
 * Checks for suspicious GPS accuracy metrics.
 * Genuine mobile GPS typically fluctuates between 3m - 25m accuracy with natural noise.
 * Accuracy == 0, perfectly static accuracy (e.g. 5.000000 across multiple updates), or accuracy < 0.3m is suspicious on standard web APIs.
 */
function checkAccuracy(currentTrace, history = []) {
  const accuracy = currentTrace.accuracy;

  if (accuracy === undefined || accuracy === null) {
    return { flagged: true, penalty: 15, flag: 'MISSING_ACCURACY', reason: 'GPS accuracy field missing' };
  }

  // Check 1: Zero accuracy or unrealistically exact (e.g., < 0.2 meters on commercial web Geolocation)
  if (accuracy <= 0.2) {
    return {
      flagged: true,
      penalty: 35,
      flag: 'SUSPICIOUS_ACCURACY',
      reason: 'Reported GPS accuracy is unrealistically exact (<= 0.2m)'
    };
  }

  // Check 2: Static accuracy repetition across recent history
  if (history && history.length >= 3) {
    const recentAccuracies = history.slice(-3).map(h => h.accuracy);
    const allIdentical = recentAccuracies.every(acc => Math.abs(acc - accuracy) < 0.0001);
    if (allIdentical) {
      return {
        flagged: true,
        penalty: 30,
        flag: 'STATIC_ACCURACY_PATTERN',
        reason: 'GPS accuracy value remained artificially identical across multiple consecutive readings'
      };
    }
  }

  return { flagged: false, penalty: 0, flag: null };
}

/**
 * Checks for timestamp irregularities (out of order, duplicate timestamps, exact integer millisecond patterns).
 */
function checkTimestamp(currentTrace, previousTrace) {
  if (!previousTrace) return { flagged: false, penalty: 0, flag: null };

  const currTime = new Date(currentTrace.timestamp).getTime();
  const prevTime = new Date(previousTrace.timestamp).getTime();

  // Out of order timestamps
  if (currTime < prevTime) {
    return {
      flagged: true,
      penalty: 40,
      flag: 'TIMESTAMP_OUT_OF_ORDER',
      reason: 'Location report timestamp precedes previous report'
    };
  }

  // Exact round number interval (e.g. exactly 1000.000 ms every single report) often indicates synthetic mock location scripts
  const timeDelta = currTime - prevTime;
  if (timeDelta > 0 && timeDelta % 1000 === 0 && timeDelta < 5000) {
    return {
      flagged: true,
      penalty: 20,
      flag: 'SYNTHETIC_TIMING_PATTERN',
      reason: 'Timestamp interval exhibits exact integer second repetition typical of automated scripts'
    };
  }

  return { flagged: false, penalty: 0, flag: null };
}

/**
 * Mismatch between reported position movement and accelerometer / device motion sensor data.
 * If position changed > 5 meters but device accelerometer magnitude indicates stationary state (~ 9.81 m/s^2 with 0 variance), flag it.
 */
function checkMotionMismatch(currentTrace, previousTrace) {
  if (!currentTrace.motionData || !previousTrace) {
    return { flagged: false, penalty: 0, flag: null };
  }

  const { accelX = 0, accelY = 0, accelZ = 9.81 } = currentTrace.motionData;
  const accelMagnitude = Math.sqrt(accelX * accelX + accelY * accelY + accelZ * accelZ);
  // Subtract standard Earth gravity (9.81 m/s^2)
  const linearAccel = Math.abs(accelMagnitude - 9.81);

  const distanceMeters = calculateDistance(
    previousTrace.lat,
    previousTrace.lng,
    currentTrace.lat,
    currentTrace.lng
  );

  // If distance changed significantly (> 10 meters in short time) but linear acceleration is near zero (< 0.1)
  const timeDeltaSeconds = (new Date(currentTrace.timestamp) - new Date(previousTrace.timestamp)) / 1000;
  if (timeDeltaSeconds > 0 && timeDeltaSeconds < 10) {
    const speed = distanceMeters / timeDeltaSeconds;
    if (speed > 3.0 && linearAccel < 0.08) {
      return {
        flagged: true,
        penalty: 35,
        flag: 'SENSOR_MOTION_MISMATCH',
        reason: 'Significant position movement reported while physical accelerometer senses no physical acceleration'
      };
    }
  }

  return { flagged: false, penalty: 0, flag: null };
}

module.exports = {
  checkSpeed,
  checkAccuracy,
  checkTimestamp,
  checkMotionMismatch
};
