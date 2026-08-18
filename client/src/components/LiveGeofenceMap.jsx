import React, { useEffect, useRef } from 'react';
import L from 'leaflet';

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

  return raw.map(p => {
    if (Array.isArray(p) && p.length >= 2) return [parseFloat(p[0]), parseFloat(p[1])];
    if (typeof p === 'object' && p !== null) {
      const lat = parseFloat(p.lat !== undefined ? p.lat : p.latitude);
      const lng = parseFloat(p.lng !== undefined ? p.lng : p.lon !== undefined ? p.lon : p.longitude);
      if (!isNaN(lat) && !isNaN(lng)) return [lat, lng];
    }
    return null;
  }).filter(Boolean);
}

function generateDefaultHexagon(centerLat, centerLng, radiusM = 100) {
  const points = [];
  const R = 6371000;
  for (let i = 0; i < 6; i++) {
    const angle = (i * 2 * Math.PI) / 6;
    const dLat = (radiusM * Math.cos(angle)) / R;
    const dLng = (radiusM * Math.sin(angle)) / (R * Math.cos(centerLat * (Math.PI / 180)));
    const lat = centerLat + dLat * (180 / Math.PI);
    const lng = centerLng + dLng * (180 / Math.PI);
    points.push([Math.round(lat * 100000) / 100000, Math.round(lng * 100000) / 100000]);
  }
  return points;
}

export default function LiveGeofenceMap({
  event,
  studentCoords,
  studentAccuracy: _studentAccuracy,
  inRange,
  studentsList = [],
  activeCheckpoint = null,
  height = '240px'
}) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const eventPolygonRef = useRef(null);
  const vertexMarkersGroupRef = useRef(null);
  const checkpointLayersGroupRef = useRef(null);
  const centerMarkerRef = useRef(null);
  const studentMarkerRef = useRef(null);
  const studentMarkersGroupRef = useRef(null);

  // 1. Initialize Leaflet Map Instance Once
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const defaultLat = parseFloat(event?.center_lat) || 18.1960;
      const defaultLng = parseFloat(event?.center_lng) || 120.5927;

      const map = L.map(mapContainerRef.current, {
        center: [defaultLat, defaultLng],
        zoom: 16,
        zoomControl: true,
        attributionControl: false
      });

      // Dark CartoDB Map Tiles
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        subdomains: 'abcd',
        maxZoom: 19
      }).addTo(map);

      vertexMarkersGroupRef.current = L.layerGroup().addTo(map);
      checkpointLayersGroupRef.current = L.layerGroup().addTo(map);
      studentMarkersGroupRef.current = L.layerGroup().addTo(map);
      mapInstanceRef.current = map;
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        eventPolygonRef.current = null;
        vertexMarkersGroupRef.current = null;
        checkpointLayersGroupRef.current = null;
        centerMarkerRef.current = null;
        studentMarkerRef.current = null;
      }
    };
  }, []);

  // 2. Render and Synchronize Event Polygon, Checkpoint Zones, and Centroid Star
  useEffect(() => {
    if (!mapInstanceRef.current || !event) return;
    const map = mapInstanceRef.current;

    const centerLat = parseFloat(event.center_lat) || 18.1960;
    const centerLng = parseFloat(event.center_lng) || 120.5927;
    let polygonCoords = normalizePolygon(event.polygon_coordinates);

    // If less than 3 vertices, generate regular polygon so a real polygon is always rendered
    if (polygonCoords.length < 3) {
      polygonCoords = generateDefaultHexagon(centerLat, centerLng, event.radius_m || 100);
    }

    // Centroid Radiant Gold Star Pin
    const centerIcon = L.divIcon({
      className: 'center-pin',
      html: `<div style="
        width: 26px; 
        height: 26px; 
        background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 50%, #d97706 100%); 
        border: 2.5px solid #ffffff; 
        border-radius: 50%; 
        box-shadow: 0 0 16px rgba(245, 158, 11, 0.95);
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-weight: 900;
        font-size: 13px;
        text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
      ">★</div>`,
      iconSize: [26, 26],
      iconAnchor: [13, 13]
    });

    if (!centerMarkerRef.current) {
      centerMarkerRef.current = L.marker([centerLat, centerLng], { icon: centerIcon })
        .addTo(map)
        .bindPopup(`<b>${event.name}</b><br/>Centroid: ${centerLat.toFixed(4)}, ${centerLng.toFixed(4)}<br/>Grace Window: ${event.grace_minutes}m`);
    } else {
      centerMarkerRef.current.setLatLng([centerLat, centerLng]);
      centerMarkerRef.current.setPopupContent(`<b>${event.name}</b><br/>Centroid: ${centerLat.toFixed(4)}, ${centerLng.toFixed(4)}<br/>Grace Window: ${event.grace_minutes}m`);
    }

    if (vertexMarkersGroupRef.current) {
      vertexMarkersGroupRef.current.clearLayers();
    }

    // Render Exact Polygon Geofence Shape
    if (!eventPolygonRef.current) {
      eventPolygonRef.current = L.polygon(polygonCoords, {
        color: '#818cf8',
        fillColor: '#6366f1',
        fillOpacity: 0.22,
        weight: 3,
        dashArray: '6, 6'
      }).addTo(map);
    } else {
      eventPolygonRef.current.setLatLngs(polygonCoords);
    }

    // Draw distinct corner node dots on every vertex of the polygon
    if (vertexMarkersGroupRef.current) {
      polygonCoords.forEach((pt, idx) => {
        const cornerDotIcon = L.divIcon({
          className: 'corner-node',
          html: `<div style="
            width: 14px; 
            height: 14px; 
            background: #818cf8; 
            border: 2px solid #ffffff; 
            border-radius: 50%; 
            box-shadow: 0 0 8px rgba(99, 102, 241, 0.9);
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-size: 8px;
            font-weight: bold;
          ">${idx + 1}</div>`,
          iconSize: [14, 14],
          iconAnchor: [7, 7]
        });
        L.marker(pt, { icon: cornerDotIcon }).addTo(vertexMarkersGroupRef.current);
      });
    }

    // 2b. Render Checkpoints Nested Inside Polygon
    if (checkpointLayersGroupRef.current) {
      checkpointLayersGroupRef.current.clearLayers();

      const checkpoints = event.checkpoints || [];
      checkpoints.forEach((cp, idx) => {
        const cpLat = parseFloat(cp.lat);
        const cpLng = parseFloat(cp.lng);
        const cpRadius = parseFloat(cp.radius_m) || 20;
        const isMatched = activeCheckpoint && (activeCheckpoint.id === cp.id || activeCheckpoint.name === cp.name);

        const circleColor = isMatched ? '#10b981' : '#06b6d4';
        const circleFill = isMatched ? '#10b981' : '#06b6d4';

        // Checkpoint radius circle
        L.circle([cpLat, cpLng], {
          radius: cpRadius,
          color: circleColor,
          fillColor: circleFill,
          fillOpacity: isMatched ? 0.35 : 0.2,
          weight: 2,
          dashArray: '4, 4'
        }).addTo(checkpointLayersGroupRef.current);

        // Checkpoint numbered badge marker
        const cpIcon = L.divIcon({
          className: 'checkpoint-pin',
          html: `<div style="
            width: 24px; 
            height: 24px; 
            background: ${isMatched ? 'linear-gradient(135deg, #10b981, #059669)' : 'linear-gradient(135deg, #06b6d4, #0891b2)'}; 
            border: 2px solid #ffffff; 
            border-radius: 50%; 
            box-shadow: 0 0 12px ${isMatched ? 'rgba(16, 185, 129, 0.9)' : 'rgba(6, 182, 212, 0.9)'};
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-size: 10px;
            font-weight: 900;
          ">C${cp.checkpoint_order || (idx + 1)}</div>`,
          iconSize: [24, 24],
          iconAnchor: [12, 12]
        });

        L.marker([cpLat, cpLng], { icon: cpIcon })
          .addTo(checkpointLayersGroupRef.current)
          .bindPopup(`<b>${cp.name || 'Checkpoint #' + (idx + 1)}</b><br/>Zone Radius: ${cpRadius}m<br/>Tasks in Pool: ${(cp.tasks || []).length}`);
      });
    }

    if (!studentCoords && eventPolygonRef.current) {
      try {
        const polyBounds = eventPolygonRef.current.getBounds();
        if (polyBounds.isValid()) {
          map.fitBounds(polyBounds.pad(0.35));
        }
      } catch (e) {}
    }
  }, [event?.id, event?.center_lat, event?.center_lng, JSON.stringify(event?.polygon_coordinates), JSON.stringify(event?.checkpoints), activeCheckpoint?.id]);

  // 3. Update Student Location Marker on Map
  useEffect(() => {
    if (!mapInstanceRef.current || !studentCoords) return;

    const { lat, lng } = studentCoords;
    const isInside = inRange;

    const studentIconHtml = `<div style="
      width: 22px; 
      height: 22px; 
      background: ${isInside ? '#10b981' : '#f59e0b'}; 
      border: 3px solid #ffffff; 
      border-radius: 50%; 
      box-shadow: 0 0 16px ${isInside ? 'rgba(16, 185, 129, 0.95)' : 'rgba(245, 158, 11, 0.95)'};
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-size: 10px;
      font-weight: bold;
    ">👤</div>`;

    const studentIcon = L.divIcon({
      className: 'student-pin',
      html: studentIconHtml,
      iconSize: [22, 22],
      iconAnchor: [11, 11]
    });

    if (!studentMarkerRef.current) {
      const marker = L.marker([lat, lng], { icon: studentIcon }).addTo(mapInstanceRef.current);
      marker.bindPopup(`<b>Your Live Position</b><br/>Status: ${isInside ? 'Inside Polygon Perimeter ✅' : 'Outside Venue Boundary ⚠️'}`);
      studentMarkerRef.current = marker;
    } else {
      studentMarkerRef.current.setLatLng([lat, lng]);
      studentMarkerRef.current.setIcon(studentIcon);
    }

    // Adjust Map view to encompass Venue Polygon and Student Location
    if (event) {
      const polygonCoords = normalizePolygon(event.polygon_coordinates);
      if (polygonCoords.length >= 3) {
        const bounds = L.latLngBounds([...polygonCoords, [lat, lng]]);
        mapInstanceRef.current.fitBounds(bounds.pad(0.3));
      } else {
        const bounds = L.latLngBounds(
          [parseFloat(event.center_lat) || 18.1960, parseFloat(event.center_lng) || 120.5927],
          [lat, lng]
        );
        mapInstanceRef.current.fitBounds(bounds.pad(0.3));
      }
    }
  }, [studentCoords?.lat, studentCoords?.lng, inRange, event?.id]);

  // 4. Render Live Students Batch for Admin Telemetry
  useEffect(() => {
    if (!mapInstanceRef.current || !studentMarkersGroupRef.current) return;
    studentMarkersGroupRef.current.clearLayers();

    if (!Array.isArray(studentsList) || studentsList.length === 0) return;

    studentsList.forEach(st => {
      if (!st.lat || !st.lng) return;
      const isSpoofed = st.is_spoofed === 1;
      const isIn = st.in_range === 1;

      const pinColor = isSpoofed ? '#f43f5e' : isIn ? '#10b981' : '#f59e0b';

      const icon = L.divIcon({
        className: 'admin-student-pin',
        html: `<div style="
          width: 14px;
          height: 14px;
          background: ${pinColor};
          border: 1.5px solid #ffffff;
          border-radius: 50%;
          box-shadow: 0 0 8px ${pinColor};
        "></div>`,
        iconSize: [14, 14],
        iconAnchor: [7, 7]
      });

      L.marker([st.lat, st.lng], { icon })
        .addTo(studentMarkersGroupRef.current)
        .bindPopup(`<b>${st.name || st.student_id}</b><br/>Status: ${st.status}<br/>Trust Score: ${st.trust_score || 100}/100`);
    });
  }, [studentsList]);

  return (
    <div
      ref={mapContainerRef}
      style={{ height, width: '100%' }}
      className="rounded-xl overflow-hidden border border-slate-800 relative z-0 shadow-inner"
    />
  );
}
