/**
 * Machine Learning (Logistic Regression) Classifier Strategy for GPS Spoofing Detection
 */

const { calculateDistance } = require('../haversine');
const {
  checkSpeed,
  checkAccuracy,
  checkTimestamp,
  checkMotionMismatch,
  checkStationaryAnomaly
} = require('./heuristics');

class MLStrategy {
  constructor(weights = null) {
    this.name = 'ml-classifier';
    // Calibrated logistic regression weights (intercept + feature coefficients)
    this.weights = weights || {
      bias: -2.85,
      speed: 0.42,              // Feature 1: Calculated speed (m/s)
      accuracyLow: 2.80,        // Feature 2: Accuracy <= 0.2m (binary)
      staticAccuracy: 2.15,     // Feature 3: Static accuracy pattern (binary)
      timestampAnomaly: 2.65,   // Feature 4: Out-of-order or synthetic cadence (binary)
      motionMismatch: 2.40,     // Feature 5: Motion sensor mismatch (binary)
      stationaryAnomaly: 2.50   // Feature 6: Stationary signal anomaly (binary)
    };
  }

  /**
   * Sigmoid activation function
   */
  sigmoid(z) {
    return 1 / (1 + Math.exp(-z));
  }

  /**
   * Extract feature vector from trace report & history
   */
  extractFeatures(currentTrace, history = [], evalOptions = {}) {
    const previousTrace = history.length > 0 ? history[history.length - 1] : null;

    const speedRes = checkSpeed(currentTrace, previousTrace);
    const accuracyRes = checkAccuracy(currentTrace, history);
    const timestampRes = checkTimestamp(currentTrace, previousTrace);
    const motionRes = checkMotionMismatch(currentTrace, previousTrace);
    const stationaryRes = checkStationaryAnomaly(currentTrace, history, evalOptions);

    const f_speed = speedRes.speed || 0;
    const f_accuracyLow = (currentTrace.accuracy !== undefined && currentTrace.accuracy <= 0.2) ? 1 : 0;
    const f_staticAccuracy = (accuracyRes.flag === 'STATIC_ACCURACY_PATTERN') ? 1 : 0;
    const f_timestampAnomaly = (timestampRes.flagged) ? 1 : 0;
    const f_motionMismatch = (motionRes.flagged) ? 1 : 0;
    const f_stationaryAnomaly = (stationaryRes.flagged) ? 1 : 0;

    return {
      features: {
        f_speed,
        f_accuracyLow,
        f_staticAccuracy,
        f_timestampAnomaly,
        f_motionMismatch,
        f_stationaryAnomaly
      },
      heuristicFlags: [
        speedRes.flag,
        accuracyRes.flag,
        timestampRes.flag,
        motionRes.flag,
        stationaryRes.flag
      ].filter(Boolean),
      heuristicDetails: [
        speedRes.reason,
        accuracyRes.reason,
        timestampRes.reason,
        motionRes.reason,
        stationaryRes.reason
      ].filter(Boolean)
    };
  }

  /**
   * Evaluates a trace report using the ML model
   */
  evaluate(currentTrace, history = [], evalOptions = {}) {
    const { features, heuristicFlags, heuristicDetails } = this.extractFeatures(currentTrace, history, evalOptions);

    // Compute logit z = w0 + w1*x1 + w2*x2 + ...
    const z = this.weights.bias +
      (this.weights.speed * features.f_speed) +
      (this.weights.accuracyLow * features.f_accuracyLow) +
      (this.weights.staticAccuracy * features.f_staticAccuracy) +
      (this.weights.timestampAnomaly * features.f_timestampAnomaly) +
      (this.weights.motionMismatch * features.f_motionMismatch) +
      (this.weights.stationaryAnomaly * features.f_stationaryAnomaly);

    const spoofProbability = this.sigmoid(z);
    const isSpoofed = spoofProbability >= 0.50;
    const trustScore = Math.round((1 - spoofProbability) * 100);

    return {
      strategy: this.name,
      trustScore,
      isSpoofed,
      spoofProbability: Math.round(spoofProbability * 10000) / 10000,
      flags: heuristicFlags,
      details: heuristicDetails,
      metrics: {
        probability: Math.round(spoofProbability * 100) + '%',
        logit: Math.round(z * 100) / 100
      }
    };
  }
}

module.exports = MLStrategy;
