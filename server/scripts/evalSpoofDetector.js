/**
 * Evaluation Harness CLI Tool for GPS Spoofing Detection Research Module
 * 
 * Usage:
 *   node server/scripts/evalSpoofDetector.js [--dataset path/to/dataset.csv] [--strategy rule-based|ml-classifier]
 * 
 * Outputs:
 *   Confusion Matrix, Accuracy, Precision, Recall, Specificity, False Positive Rate (FPR), F1 Score.
 */

const fs = require('fs');
const path = require('path');
const { SpoofDetector } = require('../services/spoofDetection');

// Parse CLI arguments
const args = process.argv.slice(2);
let datasetPath = path.join(__dirname, '../data/sample_traces.csv');
let strategyName = 'rule-based';

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--dataset' && args[i + 1]) {
    datasetPath = path.resolve(args[i + 1]);
    i++;
  } else if (args[i] === '--strategy' && args[i + 1]) {
    strategyName = args[i + 1];
    i++;
  }
}

if (!fs.existsSync(datasetPath)) {
  console.error(`Error: Dataset file not found at ${datasetPath}`);
  console.log(`Tip: Run "node server/scripts/generateSampleDataset.js" first to create a sample dataset.`);
  process.exit(1);
}

console.log(`\n===============================================================`);
console.log(`   TAPIN GPS SPOOFING DETECTOR - RESEARCH EVALUATION HARNESS   `);
console.log(`===============================================================`);
console.log(`Dataset Path : ${datasetPath}`);
console.log(`Strategy     : ${strategyName.toUpperCase()}\n`);

// Simple CSV parser
const fileContent = fs.readFileSync(datasetPath, 'utf8');
const lines = fileContent.trim().split('\n');
const headers = lines[0].split(',').map(h => h.trim());

const records = [];
for (let i = 1; i < lines.length; i++) {
  if (!lines[i].trim()) continue;
  const values = lines[i].split(',').map(v => v.trim());
  const row = {};
  headers.forEach((h, idx) => {
    row[h] = values[idx];
  });
  records.push(row);
}

// Group records by student_id and sort chronologically
const studentHistories = {};
records.forEach(r => {
  const sid = r.student_id || 'UNKNOWN';
  if (!studentHistories[sid]) studentHistories[sid] = [];
  studentHistories[sid].push({
    trace_id: r.trace_id,
    lat: parseFloat(r.lat),
    lng: parseFloat(r.lng),
    accuracy: parseFloat(r.accuracy),
    timestamp: r.timestamp,
    motionData: (r.accel_x !== undefined) ? {
      accelX: parseFloat(r.accel_x),
      accelY: parseFloat(r.accel_y),
      accelZ: parseFloat(r.accel_z)
    } : null,
    is_spoofed_actual: r.is_spoofed === 'true' || r.is_spoofed === '1',
    ground_truth_label: r.ground_truth_label || ''
  });
});

// Sort each student's traces chronologically
Object.keys(studentHistories).forEach(sid => {
  studentHistories[sid].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
});

const detector = new SpoofDetector(strategyName);

let TP = 0; // True Positive: Actual Spoofed, Predicted Spoofed
let FP = 0; // False Positive: Actual Legit, Predicted Spoofed
let TN = 0; // True Negative: Actual Legit, Predicted Legit
let FN = 0; // False Negative: Actual Spoofed, Predicted Legit

console.log(`Evaluating ${records.length} location traces across ${Object.keys(studentHistories).length} students...\n`);

console.log(`---------------------------------------------------------------------------------------------------------`);
console.log(`Trace ID         | Actual  | Predicted | Score | Flags / Notes`);
console.log(`---------------------------------------------------------------------------------------------------------`);

Object.keys(studentHistories).forEach(sid => {
  const traces = studentHistories[sid];
  const history = [];

  traces.forEach(trace => {
    const evalResult = detector.evaluate(trace, history, strategyName);

    const actual = trace.is_spoofed_actual ? 'SPOOFED' : 'LEGIT';
    const predicted = evalResult.isSpoofed ? 'SPOOFED' : 'LEGIT';

    if (trace.is_spoofed_actual && evalResult.isSpoofed) TP++;
    else if (!trace.is_spoofed_actual && evalResult.isSpoofed) FP++;
    else if (!trace.is_spoofed_actual && !evalResult.isSpoofed) TN++;
    else if (trace.is_spoofed_actual && !evalResult.isSpoofed) FN++;

    const flagStr = evalResult.flags.length > 0 ? evalResult.flags.join(', ') : 'OK';
    console.log(`${trace.trace_id.padEnd(16)} | ${actual.padEnd(7)} | ${predicted.padEnd(9)} | ${String(evalResult.trustScore).padStart(5)} | ${flagStr}`);

    // Update history for next trace of this student
    history.push(trace);
  });
});

console.log(`---------------------------------------------------------------------------------------------------------\n`);

// Metric Calculations
const total = TP + FP + TN + FN;
const accuracy = total > 0 ? (TP + TN) / total : 0;
const precision = (TP + FP) > 0 ? TP / (TP + FP) : 0;
const recall = (TP + FN) > 0 ? TP / (TP + FN) : 0;
const specificity = (TN + FP) > 0 ? TN / (TN + FP) : 0;
const fpr = (FP + TN) > 0 ? FP / (FP + TN) : 0;
const f1 = (precision + recall) > 0 ? (2 * precision * recall) / (precision + recall) : 0;

console.log(`===============================================================`);
console.log(`                  EVALUATION METRICS SUMMARY                   `);
console.log(`===============================================================`);
console.log(` Total Evaluation Samples : ${total}`);
console.log(` True Positives (TP)      : ${TP}`);
console.log(` False Positives (FP)     : ${FP}`);
console.log(` True Negatives (TN)      : ${TN}`);
console.log(` False Negatives (FN)     : ${FN}`);
console.log(`---------------------------------------------------------------`);
console.log(` Accuracy                 : ${(accuracy * 100).toFixed(2)}%`);
console.log(` Precision                : ${(precision * 100).toFixed(2)}%`);
console.log(` Recall (Sensitivity)    : ${(recall * 100).toFixed(2)}%`);
console.log(` Specificity (TNR)        : ${(specificity * 100).toFixed(2)}%`);
console.log(` False Positive Rate (FPR): ${(fpr * 100).toFixed(2)}%`);
console.log(` F1 Score                 : ${(f1 * 100).toFixed(2)}%`);
console.log(`===============================================================\n`);
