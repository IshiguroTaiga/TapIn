const express = require('express');
const { spoofDetector } = require('../services/spoofDetection');
const { exec } = require('child_process');
const path = require('path');

const router = express.Router();

// Real-time evaluation of custom test trace
router.post('/evaluate', (req, res) => {
  const { currentTrace, history = [], strategy = 'rule-based' } = req.body;

  if (!currentTrace || currentTrace.lat === undefined || currentTrace.lng === undefined) {
    return res.status(400).json({ error: 'Latitude and Longitude are required for test trace' });
  }

  try {
    const result = spoofDetector.evaluate(currentTrace, history, strategy);
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
