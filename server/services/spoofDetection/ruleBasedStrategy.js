/**
 * Rule-Based Weighted Scoring Strategy for GPS Spoofing Detection
 */

const {
  checkSpeed,
  checkAccuracy,
  checkTimestamp,
  checkMotionMismatch
} = require('./heuristics');

class RuleBasedStrategy {
  constructor(config = {}) {
    this.name = 'rule-based';
    this.thresholdScore = config.thresholdScore || 60; // Below this score -> flagged as spoofed
  }

  /**
   * Evaluates a single location report against history.
   *
   * @param {Object} currentTrace { lat, lng, accuracy, timestamp, motionData }
   * @param {Array} history Array of previous traces for the student
   * @returns {Object} Evaluation result
   */
  evaluate(currentTrace, history = []) {
    let trustScore = 100;
    const flags = [];
    const details = [];

    const previousTrace = history.length > 0 ? history[history.length - 1] : null;

    // 1. Speed Heuristic
    const speedResult = checkSpeed(currentTrace, previousTrace);
    if (speedResult.flagged) {
      trustScore -= speedResult.penalty;
      flags.push(speedResult.flag);
      details.push(speedResult.reason);
    }

    // 2. Accuracy Heuristic
    const accuracyResult = checkAccuracy(currentTrace, history);
    if (accuracyResult.flagged) {
      trustScore -= accuracyResult.penalty;
      flags.push(accuracyResult.flag);
      details.push(accuracyResult.reason);
    }

    // 3. Timestamp Heuristic
    const timestampResult = checkTimestamp(currentTrace, previousTrace);
    if (timestampResult.flagged) {
      trustScore -= timestampResult.penalty;
      flags.push(timestampResult.flag);
      details.push(timestampResult.reason);
    }

    // 4. Sensor Motion Mismatch Heuristic
    const motionResult = checkMotionMismatch(currentTrace, previousTrace);
    if (motionResult.flagged) {
      trustScore -= motionResult.penalty;
      flags.push(motionResult.flag);
      details.push(motionResult.reason);
    }

    // Ensure trust score bounded between 0 and 100
    trustScore = Math.max(0, Math.min(100, Math.round(trustScore)));

    const isSpoofed =
      trustScore < this.thresholdScore ||
      flags.includes('IMPLAUSIBLE_SPEED') ||
      flags.includes('TIMESTAMP_OUT_OF_ORDER') ||
      flags.includes('STATIC_ACCURACY_PATTERN') ||
      (flags.includes('SUSPICIOUS_ACCURACY') && flags.includes('SENSOR_MOTION_MISMATCH'));

    return {
      strategy: this.name,
      trustScore,
      isSpoofed,
      flags,
      details,
      metrics: {
        speedMps: speedResult.speed || 0,
        accuracyMeters: currentTrace.accuracy || null,
        timeDeltaSec: previousTrace ? (new Date(currentTrace.timestamp) - new Date(previousTrace.timestamp)) / 1000 : 0
      }
    };
  }
}

module.exports = RuleBasedStrategy;
