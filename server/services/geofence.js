/**
 * TapIn Geofencing Engine
 * 
 * Implements:
 * 1. Ray-Casting Point-in-Polygon (PIP) algorithm (Jordan Curve Theorem)
 * 2. Haversine Great-Circle Distance & Centroid calculation
 * 3. Multi-tier Fast Pre-filtering (Axis-Aligned Bounding Box + Haversine Bounding Sphere)
 * 4. Boundary edge & vertex collision handling
 */

const { calculateDistance } = require('./haversine');

/**
 * Standardize coordinate input into [lat, lng] array
 * @param {Array|Object|string} pt - Coordinate point
 * @returns {[number, number]|null} [lat, lng]
 */
function normalizePoint(pt) {
  if (!pt) return null;
  if (Array.isArray(pt) && pt.length >= 2) {
    const lat = parseFloat(pt[0]);
    const lng = parseFloat(pt[1]);
    if (!isNaN(lat) && !isNaN(lng)) return [lat, lng];
  } else if (typeof pt === 'object') {
    const lat = parseFloat(pt.lat !== undefined ? pt.lat : pt.latitude);
    const lng = parseFloat(pt.lng !== undefined ? pt.lng : pt.lon !== undefined ? pt.lon : pt.longitude);
    if (!isNaN(lat) && !isNaN(lng)) return [lat, lng];
  }
  return null;
}

/**
 * Standardize polygon input into array of [lat, lng] vertices
 * @param {Array|string} poly - Polygon coordinates
 * @returns {Array<[number, number]>} Array of [lat, lng]
 */
function normalizePolygon(poly) {
  if (!poly) return [];
  let raw = poly;
  while (typeof raw === 'string') {
    try {
      raw = JSON.parse(raw);
    } catch (e) {
      break;
    }
  }

  // Handle GeoJSON format { type: 'Polygon', coordinates: [[[lng, lat], ...]] }
  if (raw && raw.type === 'Polygon' && Array.isArray(raw.coordinates) && raw.coordinates[0]) {
    return raw.coordinates[0].map(c => [parseFloat(c[1]), parseFloat(c[0])]).filter(c => !isNaN(c[0]) && !isNaN(c[1]));
  }

  if (!Array.isArray(raw)) return [];

  const vertices = [];
  for (const item of raw) {
    const norm = normalizePoint(item);
    if (norm) vertices.push(norm);
  }

  return vertices;
}

/**
 * Calculate Axis-Aligned Bounding Box (AABB) for a polygon
 * @param {Array<[number, number]>} polygon 
 * @returns {{ minLat: number, maxLat: number, minLng: number, maxLng: number }}
 */
function calculateBoundingBox(polygon) {
  const normPoly = normalizePolygon(polygon);
  if (normPoly.length === 0) {
    return { minLat: 0, maxLat: 0, minLng: 0, maxLng: 0 };
  }

  let minLat = normPoly[0][0];
  let maxLat = normPoly[0][0];
  let minLng = normPoly[0][1];
  let maxLng = normPoly[0][1];

  for (let i = 1; i < normPoly.length; i++) {
    const [lat, lng] = normPoly[i];
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
  }

  return { minLat, maxLat, minLng, maxLng };
}

/**
 * Calculate Centroid of a polygon
 * @param {Array<[number, number]>} polygon 
 * @returns {{ lat: number, lng: number }}
 */
function calculateCentroid(polygon) {
  const normPoly = normalizePolygon(polygon);
  if (normPoly.length === 0) return { lat: 0, lng: 0 };

  let sumLat = 0;
  let sumLng = 0;
  for (const [lat, lng] of normPoly) {
    sumLat += lat;
    sumLng += lng;
  }

  return {
    lat: sumLat / normPoly.length,
    lng: sumLng / normPoly.length
  };
}

/**
 * Calculate maximum Haversine distance from centroid to any vertex (bounding radius)
 * @param {Array<[number, number]>} polygon 
 * @param {{ lat: number, lng: number }} [centroid] 
 * @returns {number} Radius in meters
 */
function calculateMaxRadius(polygon, centroid) {
  const normPoly = normalizePolygon(polygon);
  if (normPoly.length === 0) return 0;

  const center = centroid || calculateCentroid(normPoly);
  let maxDist = 0;

  for (const [lat, lng] of normPoly) {
    const d = calculateDistance(center.lat, center.lng, lat, lng);
    if (d > maxDist) maxDist = d;
  }

  return Math.ceil(maxDist);
}

/**
 * Check if a point is on a line segment between p1 and p2 (within epsilon tolerance)
 * @param {[number, number]} point [lat, lng]
 * @param {[number, number]} p1 [lat, lng]
 * @param {[number, number]} p2 [lat, lng]
 * @param {number} [tolerance=1e-7]
 * @returns {boolean}
 */
function isPointOnSegment(point, p1, p2, tolerance = 1e-7) {
  const [lat, lng] = point;
  const [lat1, lng1] = p1;
  const [lat2, lng2] = p2;

  // Check if point is within bounding box of segment
  const minLat = Math.min(lat1, lat2) - tolerance;
  const maxLat = Math.max(lat1, lat2) + tolerance;
  const minLng = Math.min(lng1, lng2) - tolerance;
  const maxLng = Math.max(lng1, lng2) + tolerance;

  if (lat < minLat || lat > maxLat || lng < minLng || lng > maxLng) {
    return false;
  }

  // Cross product to test collinearity: (lat - lat1) * (lng2 - lng1) - (lng - lng1) * (lat2 - lat1)
  const crossProduct = (lat - lat1) * (lng2 - lng1) - (lng - lng1) * (lat2 - lat1);
  return Math.abs(crossProduct) <= tolerance;
}

/**
 * Pure Ray-Casting Point-in-Polygon (PIP) Algorithm
 * Casts a ray eastward from point (lat, lng) to +infinity in longitude.
 * Edge crossings: odd = inside, even = outside.
 * 
 * @param {Array|Object} point - [lat, lng] or {lat, lng}
 * @param {Array<Array|Object>} polygon - Ordered array of vertices
 * @returns {{ inside: boolean, onBoundary: boolean, crossings: number }}
 */
function pointInPolygonRayCast(point, polygon) {
  const pt = normalizePoint(point);
  const poly = normalizePolygon(polygon);

  if (!pt || poly.length < 3) {
    return { inside: false, onBoundary: false, crossings: 0 };
  }

  const [lat, lng] = pt;
  const n = poly.length;
  let inside = false;
  let crossings = 0;

  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const [lat1, lng1] = poly[i];
    const [lat2, lng2] = poly[j];

    // Check if point lies directly on this boundary segment
    if (isPointOnSegment(pt, poly[i], poly[j])) {
      return { inside: true, onBoundary: true, crossings: 0 };
    }

    // Ray-Casting intersection test:
    // Check if horizontal ray at 'lat' crosses segment between (lat1, lng1) and (lat2, lng2)
    const intersectsY = (lat1 > lat) !== (lat2 > lat);
    if (intersectsY) {
      // Longitude where the segment intersects the line latitude = lat
      const intersectLng = lng1 + ((lat - lat1) * (lng2 - lng1)) / (lat2 - lat1);
      if (lng < intersectLng) {
        crossings++;
        inside = !inside;
      }
    }
  }

  return {
    inside,
    onBoundary: false,
    crossings
  };
}

/**
 * Full Geofence Verification with Fast Pre-filtering Optimization:
 * 1. Axis-Aligned Bounding Box (AABB) check (instant discard of far points)
 * 2. Haversine Centroid/Bounding-Sphere pre-filter (fast rough-distance filter)
 * 3. Ray-Casting Point-in-Polygon exact test
 * 
 * @param {Array|Object} point - Student location [lat, lng]
 * @param {Array<Array|Object>} polygon - Venue boundary polygon vertices
 * @param {Object} [options] - Optional pre-computed centroid/radius or tolerance
 * @returns {{
 *   inRange: boolean,
 *   onBoundary: boolean,
 *   crossings: number,
 *   preFiltered: string|null,
 *   distanceToCentroid: number,
 *   centroid: { lat: number, lng: number }
 * }}
 */
function isWithinPolygonGeofence(point, polygon, options = {}) {
  const pt = normalizePoint(point);
  const poly = normalizePolygon(polygon);

  if (!pt) {
    return {
      inRange: false,
      onBoundary: false,
      crossings: 0,
      preFiltered: 'INVALID_POINT',
      distanceToCentroid: Infinity,
      centroid: { lat: 0, lng: 0 }
    };
  }

  // If polygon is not provided or degenerate (< 3 vertices), fallback to circular distance if center provided
  if (poly.length < 3) {
    if (options.centerLat !== undefined && options.centerLng !== undefined) {
      const dist = calculateDistance(pt[0], pt[1], options.centerLat, options.centerLng);
      const radius = options.radiusMeters || 100;
      return {
        inRange: dist <= radius,
        onBoundary: dist === radius,
        crossings: 0,
        preFiltered: null,
        distanceToCentroid: dist,
        centroid: { lat: options.centerLat, lng: options.centerLng }
      };
    }
    return {
      inRange: false,
      onBoundary: false,
      crossings: 0,
      preFiltered: 'DEGENERATE_POLYGON',
      distanceToCentroid: Infinity,
      centroid: { lat: 0, lng: 0 }
    };
  }

  const [lat, lng] = pt;
  const centroid = options.centroid || calculateCentroid(poly);
  const distanceToCentroid = calculateDistance(lat, lng, centroid.lat, centroid.lng);

  // 1. Fast Haversine Rough-Distance / Bounding-Sphere Pre-Filter
  // If student is further from centroid than (maxRadius + margin), they cannot be inside.
  const maxRadius = options.maxRadius || calculateMaxRadius(poly, centroid);
  const filterMarginMeters = options.marginMeters || 15; // 15m tolerance for GPS jitter
  if (distanceToCentroid > (maxRadius + filterMarginMeters)) {
    return {
      inRange: false,
      onBoundary: false,
      crossings: 0,
      preFiltered: 'HAVERSINE_SPHERE',
      distanceToCentroid,
      centroid
    };
  }

  // 2. Fast Axis-Aligned Bounding Box (AABB) Pre-Filter
  const bbox = options.boundingBox || calculateBoundingBox(poly);
  const latMargin = 0.00015; // ~16 meters in degrees
  const lngMargin = 0.00015;
  if (
    lat < bbox.minLat - latMargin ||
    lat > bbox.maxLat + latMargin ||
    lng < bbox.minLng - lngMargin ||
    lng > bbox.maxLng + lngMargin
  ) {
    return {
      inRange: false,
      onBoundary: false,
      crossings: 0,
      preFiltered: 'AABB_BOUNDING_BOX',
      distanceToCentroid,
      centroid
    };
  }

  // 3. Exact Ray-Casting Point-in-Polygon Test
  const rayCastResult = pointInPolygonRayCast(pt, poly);

  return {
    inRange: rayCastResult.inside,
    onBoundary: rayCastResult.onBoundary,
    crossings: rayCastResult.crossings,
    preFiltered: null,
    distanceToCentroid,
    centroid
  };
}

module.exports = {
  normalizePoint,
  normalizePolygon,
  calculateBoundingBox,
  calculateCentroid,
  calculateMaxRadius,
  isPointOnSegment,
  pointInPolygonRayCast,
  isWithinPolygonGeofence,
  calculateDistance // re-exported for convenience
};
