/**
 * GPS Spoofing Detection Module Facade
 * 
 * Provides a clean, swappable interface to evaluate location reports
 * using either Rule-Based or Machine Learning strategies.
 */

const RuleBasedStrategy = require('./ruleBasedStrategy');
const MLStrategy = require('./mlStrategy');

class SpoofDetector {
  constructor(defaultStrategy = 'rule-based') {
    this.strategies = {
      'rule-based': new RuleBasedStrategy(),
      'ml-classifier': new MLStrategy()
    };
    this.activeStrategy = defaultStrategy;
  }

  /**
   * Set active strategy ('rule-based' | 'ml-classifier')
   */
  setStrategy(strategyName) {
    if (!this.strategies[strategyName]) {
      throw new Error(`Unknown spoof detection strategy: ${strategyName}`);
    }
    this.activeStrategy = strategyName;
  }

  /**
   * Evaluates a location report trace against a student's previous trace history.
   *
   * @param {Object} locationReport { lat, lng, accuracy, timestamp, motionData }
   * @param {Array} history Array of previous traces
   * @param {String} [overrideStrategy] Optional strategy name for this call
   * @returns {Object} Evaluation outcome
   */
  evaluate(locationReport, history = [], overrideStrategy = null) {
    const strategyName = overrideStrategy || this.activeStrategy;
    const strategy = this.strategies[strategyName] || this.strategies['rule-based'];

    return strategy.evaluate(locationReport, history);
  }
}

// Singleton instance
const detectorInstance = new SpoofDetector();

module.exports = {
  SpoofDetector,
  spoofDetector: detectorInstance,
  RuleBasedStrategy,
  MLStrategy
};
