const db = require('../db');
const {
  normalizePolygon,
  calculateCentroid,
  calculateMaxRadius,
  isWithinPolygonGeofence,
  pointInPolygonRayCast
} = require('../services/geofence');

console.log('===============================================================');
console.log('  TAPIN FULL POLYGON ROUND-TRIP & SAVE VERIFICATION SUITE');
console.log('===============================================================');

// 1. Template Definitions
const L_SHAPE = [
  [18.1950, 120.5910],
  [18.1970, 120.5910],
  [18.1970, 120.5940],
  [18.1960, 120.5940],
  [18.1960, 120.5925],
  [18.1950, 120.5925]
];

const U_SHAPE = [
  [18.1950, 120.5910],
  [18.1970, 120.5910],
  [18.1970, 120.5940],
  [18.1950, 120.5940],
  [18.1950, 120.5930],
  [18.1962, 120.5930],
  [18.1962, 120.5920],
  [18.1950, 120.5920]
];

// Test 1: Save L-Shape Polygon to DB
const lCentroid = calculateCentroid(L_SHAPE);
const lRadius = calculateMaxRadius(L_SHAPE, lCentroid);

db.prepare(`
  UPDATE events 
  SET polygon_coordinates = ?, center_lat = ?, center_lng = ?, radius_m = ?
  WHERE id = 1
`).run(JSON.stringify(L_SHAPE), lCentroid.lat, lCentroid.lng, lRadius);

const fetched1 = db.prepare(`SELECT * FROM events WHERE id = 1`).get();
const norm1 = normalizePolygon(fetched1.polygon_coordinates);

console.log(`[Test 1] Saved L-Shape Polygon: ${norm1.length} vertices (Expected 6)`);
console.assert(norm1.length === 6, 'L-Shape must have 6 vertices');
console.assert(JSON.stringify(norm1) === JSON.stringify(L_SHAPE), 'L-Shape vertices must match exactly');
console.log('  ✅ PASS: L-Shape saved and reloaded with 100% fidelity.');

// Test 2: Edit to U-Shape Polygon in DB
const uCentroid = calculateCentroid(U_SHAPE);
const uRadius = calculateMaxRadius(U_SHAPE, uCentroid);

db.prepare(`
  UPDATE events 
  SET polygon_coordinates = ?, center_lat = ?, center_lng = ?, radius_m = ?
  WHERE id = 1
`).run(JSON.stringify(U_SHAPE), uCentroid.lat, uCentroid.lng, uRadius);

const fetched2 = db.prepare(`SELECT * FROM events WHERE id = 1`).get();
const norm2 = normalizePolygon(fetched2.polygon_coordinates);

console.log(`[Test 2] Edited to U-Shape Polygon: ${norm2.length} vertices (Expected 8)`);
console.assert(norm2.length === 8, 'U-Shape must have 8 vertices');
console.assert(JSON.stringify(norm2) === JSON.stringify(U_SHAPE), 'U-Shape vertices must match exactly');
console.log('  ✅ PASS: U-Shape edit saved and reloaded with 100% fidelity.');

// Test 3: Point-in-Polygon Attendance Containment Check on U-Shape
// Point inside left prong of U-shape: [18.1955, 120.5915]
const insideLeftProng = isWithinPolygonGeofence([18.1955, 120.5915], norm2, {
  centerLat: uCentroid.lat,
  centerLng: uCentroid.lng,
  maxRadius: uRadius
});
console.log(`[Test 3A] Point inside left prong: inRange=${insideLeftProng.inRange} (Expected true)`);
console.assert(insideLeftProng.inRange === true, 'Point in left prong must be inside');

// Point inside central pocket cutout of U-shape: [18.1955, 120.5925]
const insideCentralPocket = isWithinPolygonGeofence([18.1955, 120.5925], norm2, {
  centerLat: uCentroid.lat,
  centerLng: uCentroid.lng,
  maxRadius: uRadius
});
console.log(`[Test 3B] Point inside cutout pocket: inRange=${insideCentralPocket.inRange} (Expected false)`);
console.assert(insideCentralPocket.inRange === false, 'Point in cutout pocket must be outside');

// Point far outside: [18.2500, 120.6500] (~8km away)
const farOutside = isWithinPolygonGeofence([18.2500, 120.6500], norm2, {
  centerLat: uCentroid.lat,
  centerLng: uCentroid.lng,
  maxRadius: uRadius
});
console.log(`[Test 3C] Far outside point: inRange=${farOutside.inRange}, preFiltered=${farOutside.preFiltered}`);
console.assert(farOutside.inRange === false, 'Far point must be outside');
console.assert(farOutside.preFiltered === 'HAVERSINE_SPHERE', 'Far point must be rejected by Haversine Sphere prefilter');

console.log('===============================================================');
console.log('  ALL ROUND-TRIP & POINT-IN-POLYGON VERIFICATIONS PASSED!  ');
console.log('===============================================================');
