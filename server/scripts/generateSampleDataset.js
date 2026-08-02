/**
 * Script to generate a labeled CSV dataset of location traces for testing the evaluation harness.
 * Includes legitimate student walks and various spoofing attack vectors.
 */

const fs = require('fs');
const path = require('path');

const outputDir = path.join(__dirname, '../data');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

const csvFilePath = path.join(outputDir, 'sample_traces.csv');

const rows = [
  'trace_id,student_id,lat,lng,accuracy,timestamp,accel_x,accel_y,accel_z,is_spoofed,ground_truth_label'
];

// Base university location (e.g. Campus Quad: 14.5995, 120.9842)
const baseLat = 14.5995;
const baseLng = 120.9842;
let now = Date.now() - 3600000; // 1 hour ago

// 1. Legitimate Student A: Walking around campus (3-5m accuracy, speed ~ 1.2 m/s, natural jitter)
let currentLat = baseLat;
let currentLng = baseLng;
for (let i = 1; i <= 20; i++) {
  currentLat += 0.00002 + (Math.random() * 0.00001 - 0.000005);
  currentLng += 0.00002 + (Math.random() * 0.00001 - 0.000005);
  const accuracy = 4.0 + Math.random() * 3.5;
  now += 10000 + Math.floor(Math.random() * 2000);
  const ax = (Math.random() * 0.4 - 0.2).toFixed(2);
  const ay = (Math.random() * 0.4 - 0.2).toFixed(2);
  const az = (9.81 + (Math.random() * 0.6 - 0.3)).toFixed(2);
  rows.push(`trace_legit_${i},STUDENT_LEGIT_1,${currentLat.toFixed(6)},${currentLng.toFixed(6)},${accuracy.toFixed(2)},${new Date(now).toISOString()},${ax},${ay},${az},false,LEGITIMATE_WALK`);
}

// 2. Spoofed Student B: Implausible Teleportation (Jump 2 km in 5 seconds)
let spoofTime = Date.now() - 3000000;
rows.push(`trace_spoof_1,STUDENT_SPOOF_1,${baseLat.toFixed(6)},${baseLng.toFixed(6)},5.00,${new Date(spoofTime).toISOString()},0.1,0.1,9.81,false,LEGITIMATE_START`);
spoofTime += 5000; // 5 sec later
rows.push(`trace_spoof_2,STUDENT_SPOOF_1,${(baseLat + 0.05).toFixed(6)},${(baseLng + 0.05).toFixed(6)},5.00,${new Date(spoofTime).toISOString()},0.0,0.0,9.81,true,TELEPORT_ATTACK`);

// 3. Spoofed Student C: Static Fake GPS App (Exact same accuracy 0.000000m repeatedly & 0 accel)
let staticTime = Date.now() - 2000000;
for (let i = 1; i <= 10; i++) {
  staticTime += 5000;
  rows.push(`trace_static_${i},STUDENT_SPOOF_2,${(baseLat + 0.001).toFixed(6)},${(baseLng + 0.001).toFixed(6)},0.10,${new Date(staticTime).toISOString()},0.00,0.00,9.81,true,STATIC_MOCK_LOCATION`);
}

// 4. Spoofed Student D: Automated Script (Out-of-order timestamp & perfect 1000ms cadence with sensor zeroed)
let scriptTime = Date.now() - 1000000;
rows.push(`trace_script_1,STUDENT_SPOOF_3,${baseLat.toFixed(6)},${baseLng.toFixed(6)},1.00,${new Date(scriptTime).toISOString()},0.00,0.00,9.81,false,INITIAL`);
rows.push(`trace_script_2,STUDENT_SPOOF_3,${(baseLat + 0.002).toFixed(6)},${(baseLng + 0.002).toFixed(6)},1.00,${new Date(scriptTime - 10000).toISOString()},0.00,0.00,9.81,true,OUT_OF_ORDER_TIMESTAMP`);

// Write CSV
fs.writeFileSync(csvFilePath, rows.join('\n'), 'utf8');
console.log(`[SampleDataset] Created sample dataset at: ${csvFilePath} with ${rows.length - 1} records.`);
