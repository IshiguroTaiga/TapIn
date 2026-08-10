import React, { useEffect, useRef } from 'react';
import L from 'leaflet';

function normalizePolygon(poly) {
  if (!poly) return [];
  let raw = poly;
  if (typeof poly === 'string') {
    try {
      raw = JSON.parse(poly);
    } catch (e) {
      return [];
    }
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

export default function LiveGeofenceMap({
  event,
  studentCoords,
  studentAccuracy,
  inRange,
  studentsList = [],
  height = '240px'
}) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const eventPolygonRef = useRef(null);
  const eventCircleRef = useRef(null);
  const centerMarkerRef = useRef(null);
  const studentMarkerRef = useRef(null);
  const studentAccuracyCircleRef = useRef(null);
  const studentMarkersGroupRef = useRef(null);

  // Initialize Map Once
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const defaultLat = event?.center_lat || 18.1960;
      const defaultLng = event?.center_lng || 120.5927;

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

      studentMarkersGroupRef.current = L.layerGroup().addTo(map);
      mapInstanceRef.current = map;
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        eventPolygonRef.current = null;
        eventCircleRef.current = null;
        centerMarkerRef.current = null;
        studentMarkerRef.current = null;
        studentAccuracyCircleRef.current = null;
      }
    };
  }, []);

  // Update Event Polygon & Centroid on Event changes
  useEffect(() => {
    if (!mapInstanceRef.current || !event) return;
    const map = mapInstanceRef.current;

    const polygonCoords = normalizePolygon(event.polygon_coordinates);
    const centerLat = parseFloat(event.center_lat) || 18.1960;
    const centerLng = parseFloat(event.center_lng) || 120.5927;

    // Centroid Star Pin
    const centerIcon = L.divIcon({
      className: 'center-pin',
      html: `<div style="
        width: 24px; 
        height: 24px; 
        background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 50%, #d97706 100%); 
        border: 2px solid #ffffff; 
        border-radius: 50%; 
        box-shadow: 0 0 14px rgba(245, 158, 11, 0.95);
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-weight: 900;
        font-size: 12px;
        text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
      ">★</div>`,
      iconSize: [24, 24],
      iconAnchor: [12, 12]
    });

    if (!centerMarkerRef.current) {
      centerMarkerRef.current = L.marker([centerLat, centerLng], { icon: centerIcon })
        .addTo(map)
        .bindPopup(`<b>${event.name}</b><br/>Centroid: ${centerLat.toFixed(4)}, ${centerLng.toFixed(4)}<br/>Grace Period: ${event.grace_minutes}m`);
    } else {
      centerMarkerRef.current.setLatLng([centerLat, centerLng]);
    }

    // Render exact Polygon Boundary
    if (polygonCoords.length >= 3) {
      // Remove fallback circle if previously rendered
      if (eventCircleRef.current) {
        map.removeLayer(eventCircleRef.current);
        eventCircleRef.current = null;
      }

      if (!eventPolygonRef.current) {
        eventPolygonRef.current = L.polygon(polygonCoords, {
          color: '#818cf8',
          fillColor: '#6366f1',
          fillOpacity: 0.25,
          weight: 2.5,
          dashArray: '6, 6'
        }).addTo(map);
      } else {
        eventPolygonRef.current.setLatLngs(polygonCoords);
      }

      if (!studentCoords) {
        map.fitBounds(eventPolygonRef.current.getBounds().pad(0.3));
      }
    } else {
      // Fallback Circle if no polygon vertices
      if (eventPolygonRef.current) {
        map.removeLayer(eventPolygonRef.current);
        eventPolygonRef.current = null;
      }

      if (!eventCircleRef.current) {
        eventCircleRef.current = L.circle([centerLat, centerLng], {
          color: '#818cf8',
          fillColor: '#6366f1',
          fillOpacity: 0.20,
          weight: 2,
          dashArray: '6, 6',
          radius: event.radius_m || 100
        }).addTo(map);
      } else {
        eventCircleRef.current.setLatLng([centerLat, centerLng]);
        eventCircleRef.current.setRadius(event.radius_m || 100);
      }

      if (!studentCoords) {
        map.setView([centerLat, centerLng], 16);
      }
    }
  }, [event?.id, event?.center_lat, event?.center_lng, JSON.stringify(event?.polygon_coordinates)]);

  // Update Student Location & Accuracy Circle on Map
  useEffect(() => {
    if (!mapInstanceRef.current || !studentCoords) return;

    const { lat, lng } = studentCoords;
    const isInside = inRange;

    const studentIconHtml = `<div style="
      width: 20px; 
      height: 20px; 
      background: ${isInside ? '#10b981' : '#f59e0b'}; 
      border: 3px solid #ffffff; 
      border-radius: 50%; 
      box-shadow: 0 0 12px ${isInside ? 'rgba(16, 185, 129, 0.9)' : 'rgba(245, 158, 11, 0.9)'};
      animation: pulse-ring 2s infinite cubic-bezier(0.66, 0, 0, 1);
    "></div>`;

    const studentIcon = L.divIcon({
      className: 'student-pin',
      html: studentIconHtml,
      iconSize: [20, 20],
      iconAnchor: [10, 10]
    });

    if (!studentMarkerRef.current) {
      const marker = L.marker([lat, lng], { icon: studentIcon }).addTo(mapInstanceRef.current);
      marker.bindPopup(`<b>Your Location</b><br/>Status: ${isInside ? 'Inside Polygon Geofence' : 'Outside Polygon Boundary'}`);
      studentMarkerRef.current = marker;
    } else {
      studentMarkerRef.current.setLatLng([lat, lng]);
      studentMarkerRef.current.setIcon(studentIcon);
    }

    // Student GPS Accuracy Circle
    if (studentAccuracy) {
      if (!studentAccuracyCircleRef.current) {
        studentAccuracyCircleRef.current = L.circle([lat, lng], {
          color: isInside ? '#10b981' : '#f59e0b',
          fillColor: isInside ? '#10b981' : '#f59e0b',
          fillOpacity: 0.1,
          weight: 1,
          radius: studentAccuracy
        }).addTo(mapInstanceRef.current);
      } else {
        studentAccuracyCircleRef.current.setLatLng([lat, lng]);
        studentAccuracyCircleRef.current.setRadius(studentAccuracy);
      }
    }

    // Adjust Map view to encompass both Venue Polygon / Center and Student Location
    if (event) {
      const polygonCoords = normalizePolygon(event.polygon_coordinates);
      if (polygonCoords.length >= 3) {
        const bounds = L.latLngBounds([...polygonCoords, [lat, lng]]);
        mapInstanceRef.current.fitBounds(bounds.pad(0.3));
      } else {
        const bounds = L.latLngBounds(
          [event.center_lat, event.center_lng],
          [lat, lng]
        );
        mapInstanceRef.current.fitBounds(bounds.pad(0.3));
      }
    }
  }, [studentCoords, studentAccuracy, inRange, event]);

  // Update Live Admin Students List Markers on Admin Dashboard
  useEffect(() => {
    if (!mapInstanceRef.current || !studentMarkersGroupRef.current || !studentsList.length) return;

    studentMarkersGroupRef.current.clearLayers();

    studentsList.forEach(student => {
      if (student.lat && student.lng) {
        const isOk = student.in_range === 1 && student.is_spoofed === 0;
        const isSpoof = student.is_spoofed === 1;

        const pinColor = isSpoof ? '#ef4444' : isOk ? '#10b981' : '#f59e0b';

        const icon = L.divIcon({
          className: 'admin-student-pin',
          html: `<div style="
            width: 16px; 
            height: 16px; 
            background: ${pinColor}; 
            border: 2px solid #ffffff; 
            border-radius: 50%; 
            box-shadow: 0 0 8px ${pinColor};
          "></div>`,
          iconSize: [16, 16],
          iconAnchor: [8, 8]
        });

        const marker = L.marker([student.lat, student.lng], { icon });
        marker.bindPopup(`
          <div style="font-size: 11px;">
            <b>${student.name}</b> (${student.student_id})<br/>
            Action: ${student.action.toUpperCase()}<br/>
            Status: ${isSpoof ? 'SPOOF DETECTED' : isOk ? 'Inside Polygon' : 'Outside Polygon (Grace)'}
          </div>
        `);
        studentMarkersGroupRef.current.addLayer(marker);
      }
    });
  }, [studentsList]);

  const polygonVerticesCount = normalizePolygon(event?.polygon_coordinates).length;

  return (
    <div className="relative w-full overflow-hidden rounded-xl border border-slate-800 shadow-lg">
      
      {/* Map Legend Overlay */}
      <div className="absolute top-2 right-2 z-20 glass-panel px-3 py-1.5 rounded-lg border border-slate-700/80 text-[10px] text-slate-300 space-y-1 backdrop-blur-md">
        <div className="flex items-center gap-1.5 font-semibold">
          <span className="w-2.5 h-2.5 rounded-sm bg-indigo-500 border border-white"></span>
          <span>Venue Polygon ({polygonVerticesCount > 0 ? `${polygonVerticesCount} Vertices` : `${event?.radius_m}m Radius`})</span>
        </div>
        {studentCoords && (
          <div className="flex items-center gap-1.5">
            <span className={`w-2.5 h-2.5 rounded-full border border-white ${inRange ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
            <span>Your Position ({inRange ? 'Inside Polygon' : 'Outside Boundary'})</span>
          </div>
        )}
      </div>

      <div ref={mapContainerRef} style={{ height }} className="w-full z-10" />
    </div>
  );
}
