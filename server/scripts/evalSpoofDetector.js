/**
 * Evaluation Harness CLI Tool for GPS Spoofing Detection Research Module
 * 
 * Implements Section 3.4.3 of the Thesis:
 * "Empirical Evaluation of the Anti-Spoofing Engines"
 * 
 * Usage:
 *   node server/scripts/evalSpoofDetector.js [--dataset path/to/dataset.csv] [--strategy rule-based|ml-classifier|compare]
 * 
 * Outputs:
 *   Confusion Matrix (TP, FP, TN, FN), Accuracy, Precision, Recall, Specificity,
 *   False Positive Rate (FPR), F1 Score, and McNemar's paired test comparing
 *   Strategy A (Rule-Based) vs. Strategy B (ML Logistic Regression).
 */

const fs = require('fs');
const path = require('path');
const { SpoofDetector } = require('../services/spoofDetection');

// Parse CLI arguments
const args = process.argv.slice(2);
let datasetPath = path.join(__dirname, '../data/sample_traces.csv');
let strategyName = 'compare'; // default to dual comparison

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
  console.log(`Dataset not found at ${datasetPath}. Automatically generating benchmark traces...`);
  require('./generateSampleDataset');
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
    student_id: sid,
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

Object.keys(studentHistories).forEach(sid => {
  studentHistories[sid].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
});

function evaluateSingleStrategy(strat) {
  const detector = new SpoofDetector(strat);
  let TP = 0, FP = 0, TN = 0, FN = 0;
  const traceOutcomes = [];

  Object.keys(studentHistories).forEach(sid => {
    const traces = studentHistories[sid];
    const history = [];

    traces.forEach(trace => {
      const evalResult = detector.evaluate(trace, history, strat);
      const isCorrect = (trace.is_spoofed_actual === evalResult.isSpoofed);

      if (trace.is_spoofed_actual && evalResult.isSpoofed) TP++;
      else if (!trace.is_spoofed_actual && evalResult.isSpoofed) FP++;
      else if (!trace.is_spoofed_actual && !evalResult.isSpoofed) TN++;
      else if (trace.is_spoofed_actual && !evalResult.isSpoofed) FN++;

      traceOutcomes.push({
        trace_id: trace.trace_id,
        student_id: sid,
        actual: trace.is_spoofed_actual,
        predicted: evalResult.isSpoofed,
        score: evalResult.trustScore,
        flags: evalResult.flags,
        isCorrect
      });

      history.push(trace);
    });
  });

  const total = TP + FP + TN + FN;
  const accuracy = total > 0 ? (TP + TN) / total : 0;
  const precision = (TP + FP) > 0 ? TP / (TP + FP) : 0;
  const recall = (TP + FN) > 0 ? TP / (TP + FN) : 0;
  const specificity = (TN + FP) > 0 ? TN / (TN + FP) : 0;
  const fpr = (FP + TN) > 0 ? FP / (FP + TN) : 0;
  const f1 = (precision + recall) > 0 ? (2 * precision * recall) / (precision + recall) : 0;

  return {
    strat,
    TP, FP, TN, FN, total,
    accuracy, precision, recall, specificity, fpr, f1,
    traceOutcomes
  };
}

if (strategyName === 'compare') {
  const resRule = evaluateSingleStrategy('rule-based');
  const resML = evaluateSingleStrategy('ml-classifier');

  console.log(`---------------------------------------------------------------------------------------------------------`);
  console.log(`Trace ID         | Actual  | Rule Pred | ML Pred   | Rule Score | Attack Vector / Notes`);
  console.log(`---------------------------------------------------------------------------------------------------------`);

  for (let i = 0; i < resRule.traceOutcomes.length; i++) {
    const rO = resRule.traceOutcomes[i];
    const mO = resML.traceOutcomes[i];
    const actualStr = rO.actual ? 'SPOOFED' : 'LEGIT';
    const rPredStr = rO.predicted ? 'SPOOFED' : 'LEGIT';
    const mPredStr = mO.predicted ? 'SPOOFED' : 'LEGIT';
    const flagStr = rO.flags.length > 0 ? rO.flags.join(', ') : 'OK';

    console.log(`${rO.trace_id.padEnd(16)} | ${actualStr.padEnd(7)} | ${rPredStr.padEnd(9)} | ${mPredStr.padEnd(9)} | ${String(rO.score).padStart(10)} | ${flagStr}`);
  }
  console.log(`---------------------------------------------------------------------------------------------------------\n`);

  // McNemar's paired test calculation:
  // a: both correct, b: rule correct & ML wrong, c: ML correct & rule wrong, d: both wrong
  let n_a = 0, n_b = 0, n_c = 0, n_d = 0;
  for (let i = 0; i < resRule.traceOutcomes.length; i++) {
    const rCorrect = resRule.traceOutcomes[i].isCorrect;
    const mCorrect = resML.traceOutcomes[i].isCorrect;
    if (rCorrect && mCorrect) n_a++;
    else if (rCorrect && !mCorrect) n_b++;
    else if (!rCorrect && mCorrect) n_c++;
    else if (!rCorrect && !mCorrect) n_d++;
  }

  // Continuity-corrected McNemar Chi-Square
  const bPlusC = n_b + n_c;
  const mcNemarChi2 = bPlusC > 0 ? Math.pow(Math.abs(n_b - n_c) - 1, 2) / bPlusC : 0;

  console.log(`=============================================================================`);
  console.log(`            DUAL STRATEGY EMPIRICAL COMPARISON (SECTION 3.4.3)               `);
  console.log(`=============================================================================`);
  console.log(` Metric                          | Strategy A (Rule-Based) | Strategy B (ML) `);
  console.log(`---------------------------------+-------------------------+-----------------`);
  console.log(` Overall Accuracy                | ${(resRule.accuracy * 100).toFixed(2)}%                  | ${(resML.accuracy * 100).toFixed(2)}%`);
  console.log(` Precision                       | ${(resRule.precision * 100).toFixed(2)}%                  | ${(resML.precision * 100).toFixed(2)}%`);
  console.log(` Recall (Sensitivity)           | ${(resRule.recall * 100).toFixed(2)}%                  | ${(resML.recall * 100).toFixed(2)}%`);
  console.log(` Specificity (TNR)               | ${(resRule.specificity * 100).toFixed(2)}%                  | ${(resML.specificity * 100).toFixed(2)}%`);
  console.log(` False Positive Rate (FPR)       | ${(resRule.fpr * 100).toFixed(2)}%                  | ${(resML.fpr * 100).toFixed(2)}%`);
  console.log(` F1 Score                        | ${(resRule.f1 * 100).toFixed(2)}%                  | ${(resML.f1 * 100).toFixed(2)}%`);
  console.log(` True Positives (TP)             | ${resRule.TP}                      | ${resML.TP}`);
  console.log(` True Negatives (TN)             | ${resRule.TN}                     | ${resML.TN}`);
  console.log(` False Positives (FP)            | ${resRule.FP}                      | ${resML.FP}`);
  console.log(` False Negatives (FN)            | ${resRule.FN}                      | ${resML.FN}`);
  console.log(`---------------------------------+-------------------------+-----------------`);
  console.log(` McNemar's Paired 2x2 Matrix     | Strategy B Correct      | Strategy B Wrong`);
  console.log(`   - Strategy A Correct          | ${n_a}                      | ${n_b}`);
  console.log(`   - Strategy A Wrong            | ${n_c}                       | ${n_d}`);
  console.log(` McNemar Chi-Square Statistic    | chi2 = ${mcNemarChi2.toFixed(4)} (alpha = 0.05, critical = 3.841)`);
  console.log(` Statistical Difference         | ${mcNemarChi2 > 3.841 ? 'Statistically Significant (p < 0.05)' : 'No Significant Difference (Both Engines Robust)'}`);
  console.log(`=============================================================================\n`);

} else {
  const res = evaluateSingleStrategy(strategyName);

  console.log(`---------------------------------------------------------------------------------------------------------`);
  console.log(`Trace ID         | Actual  | Predicted | Score | Flags / Notes`);
  console.log(`---------------------------------------------------------------------------------------------------------`);

  res.traceOutcomes.forEach(o => {
    const actualStr = o.actual ? 'SPOOFED' : 'LEGIT';
    const predStr = o.predicted ? 'SPOOFED' : 'LEGIT';
    const flagStr = o.flags.length > 0 ? o.flags.join(', ') : 'OK';
    console.log(`${o.trace_id.padEnd(16)} | ${actualStr.padEnd(7)} | ${predStr.padEnd(9)} | ${String(o.score).padStart(5)} | ${flagStr}`);
  });

  console.log(`---------------------------------------------------------------------------------------------------------\n`);
  console.log(`===============================================================`);
  console.log(`                  EVALUATION METRICS SUMMARY                   `);
  console.log(`===============================================================`);
  console.log(` Total Evaluation Samples : ${res.total}`);
  console.log(` True Positives (TP)      : ${res.TP}`);
  console.log(` False Positives (FP)     : ${res.FP}`);
  console.log(` True Negatives (TN)      : ${res.TN}`);
  console.log(` False Negatives (FN)     : ${res.FN}`);
  console.log(`---------------------------------------------------------------`);
  console.log(` Accuracy                 : ${(res.accuracy * 100).toFixed(2)}%`);
  console.log(` Precision                : ${(res.precision * 100).toFixed(2)}%`);
  console.log(` Recall (Sensitivity)    : ${(res.recall * 100).toFixed(2)}%`);
  console.log(` Specificity (TNR)        : ${(res.specificity * 100).toFixed(2)}%`);
  console.log(` False Positive Rate (FPR): ${(res.fpr * 100).toFixed(2)}%`);
  console.log(` F1 Score                 : ${(res.f1 * 100).toFixed(2)}%`);
  console.log(`===============================================================\n`);
}
