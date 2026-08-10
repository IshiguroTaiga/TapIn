/**
 * Standalone Test Suite for Ray-Casting Point-in-Polygon (PIP) Geofencing Engine
 * 
 * Usage:
 *   node server/scripts/testGeofence.js
 */

const assert = require('assert');
const {
  pointInPolygonRayCast,
  isWithinPolygonGeofence,
  calculateBoundingBox,
  calculateCentroid,
  calculateMaxRadius,
  isPointOnSegment,
  calculateDistance
} = require('../services/geofence');

console.log(`\n===============================================================`);
console.log(`  TAPIN RAY-CASTING POINT-IN-POLYGON (PIP) ALGORITHM TEST SUITE `);
console.log(`===============================================================\n`);

let passed = 0;
let failed = 0;

function runTest(description, testFn) {
  try {
    testFn();
    console.log(`  ✅ PASS: ${description}`);
    passed++;
  } catch (err) {
    console.error(`  ❌ FAIL: ${description}`);
    console.error(`     Error: ${err.message}`);
    failed++;
  }
}

// 1. Define Test Geometries

// MMSU Sunken Garden (Batac / Laoag, Ilocos Norte Quadrangle Polygon)
const campusVenuePolygon = [
  [18.1960, 120.5920], // SW
  [18.1970, 120.5920], // NW
  [18.1970, 120.5935], // NE
  [18.1960, 120.5935]  // SE
];

// Concave L-shaped polygon
// (0,0) -> (0,4) -> (2,4) -> (2,2) -> (4,2) -> (4,0)
const concaveLPolygon = [
  [0, 0],
  [4, 0],
  [4, 2],
  [2, 2],
  [2, 4],
  [0, 4]
];

// --- TEST 1: Basic Convex Polygon Inside/Outside ---
runTest('Convex Polygon: Point strictly inside should return inside=true', () => {
  const result = pointInPolygonRayCast([18.1965, 120.5925], campusVenuePolygon);
  assert.strictEqual(result.inside, true);
  assert.strictEqual(result.crossings % 2, 1);
});

runTest('Convex Polygon: Point strictly outside (West) should return inside=false', () => {
  const result = pointInPolygonRayCast([18.1965, 120.5910], campusVenuePolygon);
  assert.strictEqual(result.inside, false);
});

runTest('Convex Polygon: Point strictly outside (East) should return inside=false', () => {
  const result = pointInPolygonRayCast([18.1965, 120.5950], campusVenuePolygon);
  assert.strictEqual(result.inside, false);
});

runTest('Convex Polygon: Point strictly outside (North) should return inside=false', () => {
  const result = pointInPolygonRayCast([18.1980, 120.5925], campusVenuePolygon);
  assert.strictEqual(result.inside, false);
});

// --- TEST 2: Concave L-Shaped Polygon ---
runTest('Concave Polygon: Point inside lower wing (1, 1) should return inside=true', () => {
  const result = pointInPolygonRayCast([1, 1], concaveLPolygon);
  assert.strictEqual(result.inside, true);
});

runTest('Concave Polygon: Point inside vertical wing (1, 3) should return inside=true', () => {
  const result = pointInPolygonRayCast([1, 3], concaveLPolygon);
  assert.strictEqual(result.inside, true);
});

runTest('Concave Polygon: Point in cutout pocket (3, 3) should return inside=false', () => {
  const result = pointInPolygonRayCast([3, 3], concaveLPolygon);
  assert.strictEqual(result.inside, false);
});

// --- TEST 3: Edge Cases (Boundary Edges & Vertices) ---
runTest('Boundary Edge Case: Point lying directly on a polygon vertex is inside/boundary', () => {
  const result = pointInPolygonRayCast([18.1960, 120.5920], campusVenuePolygon);
  assert.strictEqual(result.inside, true);
});

runTest('Boundary Edge Case: Point lying midway along an edge is inside/boundary', () => {
  const result = pointInPolygonRayCast([18.1965, 120.5920], campusVenuePolygon);
  assert.strictEqual(result.inside, true);
});

// --- TEST 4: Multi-tier Fast Pre-filtering Optimization ---
runTest('Fast Pre-filter: Far coordinates (~50km away) are rejected by Haversine Sphere pre-filter', () => {
  const farPoint = [18.6000, 120.5925]; // ~45km North
  const result = isWithinPolygonGeofence(farPoint, campusVenuePolygon);
  assert.strictEqual(result.inRange, false);
  assert.strictEqual(result.preFiltered, 'HAVERSINE_SPHERE');
});

runTest('Fast Pre-filter: Nearby outside point (~300m away) is rejected by AABB or Ray-Cast without false positives', () => {
  const nearOutsidePoint = [18.1980, 120.5925]; // ~110m North
  const result = isWithinPolygonGeofence(nearOutsidePoint, campusVenuePolygon);
  assert.strictEqual(result.inRange, false);
});

runTest('Fast Pre-filter: Inside point passes pre-filters and is confirmed by Ray-Casting', () => {
  const insidePoint = [18.1965, 120.5925];
  const result = isWithinPolygonGeofence(insidePoint, campusVenuePolygon);
  assert.strictEqual(result.inRange, true);
  assert.strictEqual(result.preFiltered, null);
});

// --- TEST 5: Flexible Coordinate Representation Normalization ---
runTest('Format Support: Handles array of {lat, lng} objects', () => {
  const objectPolygon = [
    { lat: 18.1960, lng: 120.5920 },
    { lat: 18.1970, lng: 120.5920 },
    { lat: 18.1970, lng: 120.5935 },
    { lat: 18.1960, lng: 120.5935 }
  ];
  const result = pointInPolygonRayCast({ lat: 18.1965, lng: 120.5925 }, objectPolygon);
  assert.strictEqual(result.inside, true);
});

runTest('Format Support: Handles JSON stringified polygon coordinates', () => {
  const jsonPolygon = JSON.stringify(campusVenuePolygon);
  const result = pointInPolygonRayCast([18.1965, 120.5925], jsonPolygon);
  assert.strictEqual(result.inside, true);
});

// --- TEST 6: Bounding Box & Centroid Calculations ---
runTest('Geometry Helpers: Accurately computes AABB and Centroid', () => {
  const bbox = calculateBoundingBox(campusVenuePolygon);
  assert.strictEqual(bbox.minLat, 18.1960);
  assert.strictEqual(bbox.maxLat, 18.1970);
  assert.strictEqual(bbox.minLng, 120.5920);
  assert.strictEqual(bbox.maxLng, 120.5935);

  const centroid = calculateCentroid(campusVenuePolygon);
  assert.strictEqual(Math.round(centroid.lat * 10000) / 10000, 18.1965);
  assert.strictEqual(Math.round(centroid.lng * 10000) / 10000, 120.5928);
});

console.log(`\n---------------------------------------------------------------`);
console.log(` Test Results: ${passed} passed, ${failed} failed (${passed + failed} total)`);
console.log(`===============================================================\n`);

if (failed > 0) {
  process.exit(1);
}
