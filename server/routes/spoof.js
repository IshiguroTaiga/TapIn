const express = require('express');
const { spoofDetector } = require('../services/spoofDetection');
const { exec } = require('child_process');
const path = require('path');
const db = require('../db');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();

// Get configurable spoof detection settings
router.get('/config', (req, res) => {
  const settings = db.prepare(`SELECT key, value, description FROM system_settings`).all();
  const configMap = {};
  settings.forEach(s => {
    configMap[s.key] = isNaN(s.value) ? s.value : parseFloat(s.value);
  });

  res.json({
    stationary_window_seconds: configMap.stationary_window_seconds || 300,
    stationary_movement_threshold_m: configMap.stationary_movement_threshold_m || 1.0,
    duplicate_hamming_threshold: configMap.duplicate_hamming_threshold || 5,
    activeStrategy: spoofDetector.activeStrategy
  });
});

// Admin: Update spoof detection settings
router.post('/config', authenticateToken, requireRole(['admin', 'superadmin']), (req, res) => {
  const { stationary_window_seconds, stationary_movement_threshold_m, duplicate_hamming_threshold, activeStrategy } = req.body;

  if (stationary_window_seconds !== undefined) {
    db.prepare(`INSERT OR REPLACE INTO system_settings (key, value, description) VALUES ('stationary_window_seconds', ?, 'Time window in seconds to evaluate stationary GPS anomaly')`).run(String(stationary_window_seconds));
  }
  if (stationary_movement_threshold_m !== undefined) {
    db.prepare(`INSERT OR REPLACE INTO system_settings (key, value, description) VALUES ('stationary_movement_threshold_m', ?, 'Maximum displacement in meters below which stationary anomaly triggers')`).run(String(stationary_movement_threshold_m));
  }
  if (duplicate_hamming_threshold !== undefined) {
    db.prepare(`INSERT OR REPLACE INTO system_settings (key, value, description) VALUES ('duplicate_hamming_threshold', ?, 'Maximum Hamming distance for duplicate photo detection')`).run(String(duplicate_hamming_threshold));
  }
  if (activeStrategy) {
    spoofDetector.setStrategy(activeStrategy);
  }

  // Update detector instance memory config
  spoofDetector.updateConfig({
    stationaryWindowSeconds: stationary_window_seconds ? parseFloat(stationary_window_seconds) : undefined,
    stationaryThresholdMeters: stationary_movement_threshold_m ? parseFloat(stationary_movement_threshold_m) : undefined
  });

  res.json({
    message: 'Spoof detection configuration updated successfully',
    config: {
      stationary_window_seconds: stationary_window_seconds || 300,
      stationary_movement_threshold_m: stationary_movement_threshold_m || 1.0,
      activeStrategy: spoofDetector.activeStrategy
    }
  });
});

// Real-time evaluation of custom test trace
router.post('/evaluate', (req, res) => {
  const { currentTrace, history = [], strategy = 'rule-based', evalConfig } = req.body;

  if (!currentTrace || currentTrace.lat === undefined || currentTrace.lng === undefined) {
    return res.status(400).json({ error: 'Latitude and Longitude are required for test trace' });
  }

  try {
    const result = spoofDetector.evaluate(currentTrace, history, strategy, evalConfig || {});
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Run evaluation harness and return JSON metrics
router.get('/run-harness', (req, res) => {
  const { strategy = 'rule-based' } = req.query;

  const scriptPath = path.join(__dirname, '../scripts/evalSpoofDetector.js');
  const datasetPath = path.join(__dirname, '../data/sample_traces.csv');

  const command = `node "${scriptPath}" --dataset "${datasetPath}" --strategy ${strategy}`;

  exec(command, { cwd: path.join(__dirname, '../..') }, (error, stdout, stderr) => {
    if (error) {
      return res.status(500).json({ error: 'Evaluation harness failed: ' + error.message, stderr });
    }

    res.json({
      stdout,
      strategyUsed: strategy,
      datasetPath
    });
  });
});

module.exports = router;
