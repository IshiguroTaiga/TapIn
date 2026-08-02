/**
 * Calculates the great-circle distance between two points on the Earth
 * using the Haversine formula.
 *
 * @param {number} lat1 Latitude of point 1 in degrees
 * @param {number} lon1 Longitude of point 1 in degrees
 * @param {number} lat2 Latitude of point 2 in degrees
 * @param {number} lon2 Longitude of point 2 in degrees
 * @returns {number} Distance in meters
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000; // Earth's radius in meters
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  return Math.round(distance * 100) / 100; // rounded to 2 decimals
}

/**
 * Checks if a point (lat, lon) is within a geofence radius of a center point.
 *
 * @param {number} lat Point latitude
 * @param {number} lon Point longitude
 * @param {number} centerLat Center latitude
 * @param {number} centerLon Center longitude
 * @param {number} radiusMeters Radius in meters
 * @returns {{ inRange: boolean, distance: number }}
 */
function isWithinGeofence(lat, lon, centerLat, centerLon, radiusMeters) {
  const distance = calculateDistance(lat, lon, centerLat, centerLon);
  return {
    inRange: distance <= radiusMeters,
    distance: distance
  };
}

module.exports = {
  calculateDistance,
  isWithinGeofence
};
