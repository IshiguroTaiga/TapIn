import React, { useEffect, useRef } from 'react';
import L from 'leaflet';

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
  const eventCircleRef = useRef(null);
  const studentMarkerRef = useRef(null);
  const studentAccuracyCircleRef = useRef(null);
  const studentMarkersGroupRef = useRef(null);

  useEffect(() => {
    if (!mapContainerRef.current || !event) return;

    // Initialize Map centered at Event Center
    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [event.center_lat, event.center_lng],
        zoom: 16,
        zoomControl: true,
        attributionControl: false
      });

      // Dark CartoDB Map Tiles
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        subdomains: 'abcd',
        maxZoom: 19
      }).addTo(map);

      // Event Center Pin Icon
      const centerIcon = L.divIcon({
        className: 'center-pin',
        html: `<div style="
          width: 26px; 
          height: 26px; 
          background: #4f46e5; 
          border: 3px solid #ffffff; 
          border-radius: 50%; 
          box-shadow: 0 0 15px rgba(79, 70, 229, 0.9);
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-weight: bold;
          font-size: 11px;
        ">★</div>`,
        iconSize: [26, 26],
        iconAnchor: [13, 13]
      });

      L.marker([event.center_lat, event.center_lng], { icon: centerIcon })
        .addTo(map)
        .bindPopup(`<b>${event.name}</b><br/>Perimeter Radius: ${event.radius_m}m`);

      // Event Radius Preview Circle
      const radiusCircle = L.circle([event.center_lat, event.center_lng], {
        color: '#818cf8',
        fillColor: '#6366f1',
        fillOpacity: 0.20,
        weight: 2,
        dashArray: '6, 6',
        radius: event.radius_m || 100
      }).addTo(map);

      eventCircleRef.current = radiusCircle;
      studentMarkersGroupRef.current = L.layerGroup().addTo(map);
      mapInstanceRef.current = map;
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [event?.id]);

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
      marker.bindPopup(`<b>Your Location</b><br/>Status: ${isInside ? 'Inside Geofence' : 'Outside Radius'}`);
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

    // Adjust Map view to fit both Event Center and Student Location
    if (event) {
      const bounds = L.latLngBounds(
        [event.center_lat, event.center_lng],
        [lat, lng]
      );
      mapInstanceRef.current.fitBounds(bounds.pad(0.4));
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
            Status: ${isSpoof ? 'SPOOF DETECTED' : isOk ? 'In-Range' : 'Out-of-Range (Grace)'}
          </div>
        `);
        studentMarkersGroupRef.current.addLayer(marker);
      }
    });
  }, [studentsList]);

  return (
    <div className="relative w-full overflow-hidden rounded-xl border border-slate-800 shadow-lg">
      
      {/* Map Legend Overlay */}
      <div className="absolute top-2 right-2 z-20 glass-panel px-3 py-1.5 rounded-lg border border-slate-700/80 text-[10px] text-slate-300 space-y-1 backdrop-blur-md">
        <div className="flex items-center gap-1.5 font-semibold">
          <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 border border-white"></span>
          <span>Event Center ({event?.radius_m}m Radius)</span>
        </div>
        {studentCoords && (
          <div className="flex items-center gap-1.5">
            <span className={`w-2.5 h-2.5 rounded-full border border-white ${inRange ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
            <span>Your Position ({inRange ? 'Inside' : 'Out of Radius'})</span>
          </div>
        )}
      </div>

      <div ref={mapContainerRef} style={{ height }} className="w-full z-10" />
    </div>
  );
}
