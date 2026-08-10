import React, { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import {
  Navigation,
  MapPin,
  RotateCcw,
  RotateCw,
  Trash2,
  Maximize2,
  Minimize2,
  Crosshair,
  Sparkles,
  HelpCircle
} from 'lucide-react';

// Ilocos Norte Geographic Bounding Constraints
const ILOCOS_NORTE_CENTER = [18.1960, 120.5927]; // Laoag City, Ilocos Norte
const ILOCOS_NORTE_BOUNDS = [
  [17.70, 120.25], // South-West
  [18.70, 121.10]  // North-East
];

function calculateGeometricCentroid(points) {
  if (!points || points.length === 0) return { lat: 18.1960, lng: 120.5927 };
  let sumLat = 0;
  let sumLng = 0;
  points.forEach(([lat, lng]) => {
    sumLat += lat;
    sumLng += lng;
  });
  return {
    lat: Math.round((sumLat / points.length) * 100000) / 100000,
    lng: Math.round((sumLng / points.length) * 100000) / 100000
  };
}

function calculateMaxRadiusFromCenter(points, center) {
  if (!points || points.length === 0) return 100;
  const R = 6371000;
  let maxDist = 0;
  points.forEach(([lat, lng]) => {
    const dLat = (lat - center.lat) * (Math.PI / 180);
    const dLng = (lng - center.lng) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(center.lat * (Math.PI / 180)) *
        Math.cos(lat * (Math.PI / 180)) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const d = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    if (d > maxDist) maxDist = d;
  });
  return Math.max(30, Math.ceil(maxDist));
}

// Generate Shape Footprint Templates centered on given coordinate
function generateLShapeAround(centerLat, centerLng, spanM = 120) {
  const R = 6371000;
  const rad = spanM / 2;
  const cosLat = Math.cos(centerLat * (Math.PI / 180));
  
  const offsets = [
    [-rad, -rad],
    [+rad, -rad],
    [+rad, 0],
    [0, 0],
    [0, +rad],
    [-rad, +rad]
  ];

  return offsets.map(([dy, dx]) => {
    const lat = centerLat + (dy / R) * (180 / Math.PI);
    const lng = centerLng + (dx / (R * cosLat)) * (180 / Math.PI);
    return [Math.round(lat * 100000) / 100000, Math.round(lng * 100000) / 100000];
  });
}

function generateUShapeAround(centerLat, centerLng, spanM = 120) {
  const R = 6371000;
  const rad = spanM / 2;
  const cosLat = Math.cos(centerLat * (Math.PI / 180));
  
  const offsets = [
    [-rad, -rad],
    [+rad, -rad],
    [+rad, +rad],
    [+rad * 0.4, +rad],
    [+rad * 0.4, -rad * 0.2],
    [-rad * 0.4, -rad * 0.2],
    [-rad * 0.4, +rad],
    [-rad, +rad]
  ];

  return offsets.map(([dy, dx]) => {
    const lat = centerLat + (dy / R) * (180 / Math.PI);
    const lng = centerLng + (dx / (R * cosLat)) * (180 / Math.PI);
    return [Math.round(lat * 100000) / 100000, Math.round(lng * 100000) / 100000];
  });
}

function generateBoxAround(centerLat, centerLng, spanM = 100) {
  const R = 6371000;
  const rad = spanM / 2;
  const cosLat = Math.cos(centerLat * (Math.PI / 180));
  const offsets = [
    [-rad, -rad],
    [+rad, -rad],
    [+rad, +rad],
    [-rad, +rad]
  ];
  return offsets.map(([dy, dx]) => {
    const lat = centerLat + (dy / R) * (180 / Math.PI);
    const lng = centerLng + (dx / (R * cosLat)) * (180 / Math.PI);
    return [Math.round(lat * 100000) / 100000, Math.round(lng * 100000) / 100000];
  });
}

function generateHexagonAround(centerLat, centerLng, radiusM = 100) {
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

export default function GeofenceMapPicker({
  polygon = [],
  centerLat,
  centerLng,
  radiusMeters,
  onChangePolygon
}) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const polygonLayerRef = useRef(null);
  const polylineLayerRef = useRef(null);
  const vertexMarkersGroupRef = useRef(null);
  const midpointMarkersGroupRef = useRef(null);
  const centroidMarkerRef = useRef(null);

  // Track if updates originated locally to prevent prop reflection loops
  const lastEmittedHashRef = useRef('');

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [dragMode, setDragMode] = useState('entire_shape'); // Default: moving center moves entire border together
  const [isCustomCenter, setIsCustomCenter] = useState(Boolean(centerLat && centerLng));

  // Local polygon state
  const [vertices, setVertices] = useState(() => {
    if (Array.isArray(polygon) && polygon.length >= 3) {
      return polygon.map(p => Array.isArray(p) ? [parseFloat(p[0]), parseFloat(p[1])] : [parseFloat(p.lat), parseFloat(p.lng)]);
    }
    const cLat = centerLat ? parseFloat(centerLat) : ILOCOS_NORTE_CENTER[0];
    const cLng = centerLng ? parseFloat(centerLng) : ILOCOS_NORTE_CENTER[1];
    return generateHexagonAround(cLat, cLng, radiusMeters || 120);
  });

  // Local center point state
  const [centerPoint, setCenterPoint] = useState(() => {
    if (centerLat && centerLng) {
      return { lat: parseFloat(centerLat), lng: parseFloat(centerLng) };
    }
    if (Array.isArray(polygon) && polygon.length >= 3) {
      const normalized = polygon.map(p => Array.isArray(p) ? [parseFloat(p[0]), parseFloat(p[1])] : [parseFloat(p.lat), parseFloat(p.lng)]);
      return calculateGeometricCentroid(normalized);
    }
    return { lat: ILOCOS_NORTE_CENTER[0], lng: ILOCOS_NORTE_CENTER[1] };
  });

  // Keep internal center in sync if prop changes externally (e.g. initial edit load)
  useEffect(() => {
    if (centerLat && centerLng) {
      const c = { lat: parseFloat(centerLat), lng: parseFloat(centerLng) };
      const hash = JSON.stringify({ c });
      if (lastEmittedHashRef.current !== hash) {
        setCenterPoint(c);
      }
    }
  }, [centerLat, centerLng]);

  // Sync external polygon prop updates ONLY if external
  useEffect(() => {
    if (Array.isArray(polygon) && polygon.length >= 3) {
      const normalized = polygon.map(p => Array.isArray(p) ? [parseFloat(p[0]), parseFloat(p[1])] : [parseFloat(p.lat), parseFloat(p.lng)]);
      const hash = JSON.stringify(normalized);
      if (lastEmittedHashRef.current !== hash) {
        setVertices(normalized);
      }
    }
  }, [polygon]);

  // Emit changes to parent safely with hash recording
  const emitChanges = useCallback((newVertices, newCenter) => {
    setVertices(newVertices);
    setCenterPoint(newCenter);
    lastEmittedHashRef.current = JSON.stringify(newVertices);

    if (onChangePolygon) {
      const maxRadius = calculateMaxRadiusFromCenter(newVertices, newCenter);
      onChangePolygon(newVertices, newCenter, maxRadius);
    }
  }, [onChangePolygon]);

  // Update vertices while preserving custom center point
  const updateVerticesOnly = useCallback((newVertices) => {
    setVertices(newVertices);
    lastEmittedHashRef.current = JSON.stringify(newVertices);

    let effectiveCenter = centerPoint;
    if (!isCustomCenter) {
      effectiveCenter = calculateGeometricCentroid(newVertices);
      setCenterPoint(effectiveCenter);
    }

    if (onChangePolygon) {
      const maxRadius = calculateMaxRadiusFromCenter(newVertices, effectiveCenter);
      onChangePolygon(newVertices, effectiveCenter, maxRadius);
    }
  }, [centerPoint, isCustomCenter, onChangePolygon]);

  // Mutable refs for click handlers so map never re-attaches
  const onMapClickRef = useRef(null);
  onMapClickRef.current = (newPt) => {
    setVertices(prev => {
      const next = [...prev, newPt];
      updateVerticesOnly(next);
      return next;
    });
  };

  // 1. Initialize Leaflet Map ONCE on component mount
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const initialLat = centerPoint.lat || ILOCOS_NORTE_CENTER[0];
      const initialLng = centerPoint.lng || ILOCOS_NORTE_CENTER[1];

      const map = L.map(mapContainerRef.current, {
        center: [initialLat, initialLng],
        zoom: 16,
        minZoom: 10,
        maxZoom: 19,
        maxBounds: ILOCOS_NORTE_BOUNDS,
        maxBoundsViscosity: 0.8,
        attributionControl: false,
        tap: true,
        touchZoom: true
      });

      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        subdomains: 'abcd',
        maxZoom: 19
      }).addTo(map);

      polygonLayerRef.current = L.polygon([], {
        color: '#818cf8',
        fillColor: '#6366f1',
        fillOpacity: 0.28,
        weight: 3,
        dashArray: '6, 6'
      }).addTo(map);

      polylineLayerRef.current = L.polyline([], {
        color: '#818cf8',
        weight: 2.5,
        dashArray: '4, 4'
      }).addTo(map);

      midpointMarkersGroupRef.current = L.layerGroup().addTo(map);
      vertexMarkersGroupRef.current = L.layerGroup().addTo(map);
      centroidMarkerRef.current = L.layerGroup().addTo(map);

      mapInstanceRef.current = map;

      // Click to add vertex (preserves map viewport completely)
      map.on('click', (e) => {
        const { lat, lng } = e.latlng;
        const newPt = [Math.round(lat * 100000) / 100000, Math.round(lng * 100000) / 100000];
        if (onMapClickRef.current) {
          onMapClickRef.current(newPt);
        }
      });
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []); // Strictly empty dependency array

  // 2. Invalidate Map Size without moving camera
  useEffect(() => {
    if (mapInstanceRef.current) {
      setTimeout(() => {
        mapInstanceRef.current.invalidateSize({ pan: false });
      }, 150);
    }
  }, [isFullscreen]);

  // 3. Render and Update Layers & Markers (Zero camera manipulation)
  useEffect(() => {
    if (!mapInstanceRef.current || !vertexMarkersGroupRef.current) return;

    vertexMarkersGroupRef.current.clearLayers();
    midpointMarkersGroupRef.current.clearLayers();
    centroidMarkerRef.current.clearLayers();

    const n = vertices.length;

    if (n >= 3) {
      polygonLayerRef.current.setLatLngs(vertices);
      polylineLayerRef.current.setLatLngs([]);

      // Dedicated Draggable Center Pin (Gold Star)
      const centroidIcon = L.divIcon({
        className: 'centroid-pin',
        html: `<div style="
          width: 34px; 
          height: 34px; 
          background: ${dragMode === 'center_only' ? '#f59e0b' : '#6366f1'}; 
          border: 3px solid #ffffff; 
          border-radius: 50%; 
          box-shadow: 0 0 16px ${dragMode === 'center_only' ? 'rgba(245, 158, 11, 0.9)' : 'rgba(99, 102, 241, 0.9)'};
          cursor: grab;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-weight: bold;
          font-size: 14px;
          user-select: none;
          touch-action: none;
        ">★</div>`,
        iconSize: [34, 34],
        iconAnchor: [17, 17]
      });

      const centerMarker = L.marker([centerPoint.lat, centerPoint.lng], {
        draggable: true,
        autoPan: false, // Prevents map viewport from jumping while dragging!
        icon: centroidIcon
      });

      centerMarker.bindPopup(`
        <div style="font-size: 12px; font-family: system-ui; min-width: 170px;">
          <b style="color: ${dragMode === 'center_only' ? '#f59e0b' : '#6366f1'}; font-size: 13px;">📍 Venue Center Pin</b><br/>
          <span style="font-family: monospace; font-size: 11px; color: #cbd5e1;">${centerPoint.lat.toFixed(5)}, ${centerPoint.lng.toFixed(5)}</span><br/>
          <div style="margin-top: 4px; color: #94a3b8; font-size: 11px;">
            ${dragMode === 'center_only' 
              ? '✨ <b>Mode:</b> Moves <u>center point only</u> (stage/entrance).'
              : '📦 <b>Mode:</b> Moves <u>entire building footprint</u>.'}
          </div>
        </div>
      `);

      let dragStartCenter = null;
      let initialVerticesOnDrag = null;

      centerMarker.on('dragstart', (e) => {
        // Freeze map dragging so mobile finger drag doesn't move the map
        if (mapInstanceRef.current) mapInstanceRef.current.dragging.disable();
        dragStartCenter = e.target.getLatLng();
        initialVerticesOnDrag = [...vertices];
      });

      centerMarker.on('drag', (e) => {
        if (!dragStartCenter) return;
        const currentPos = e.target.getLatLng();

        if (dragMode === 'entire_shape' && initialVerticesOnDrag) {
          const dLat = currentPos.lat - dragStartCenter.lat;
          const dLng = currentPos.lng - dragStartCenter.lng;
          const shifted = initialVerticesOnDrag.map(([lat, lng]) => [
            Math.round((lat + dLat) * 100000) / 100000,
            Math.round((lng + dLng) * 100000) / 100000
          ]);

          if (polygonLayerRef.current) {
            polygonLayerRef.current.setLatLngs(shifted);
          }

          // Live update all corner pins with the moving center
          const cornerLayers = vertexMarkersGroupRef.current ? vertexMarkersGroupRef.current.getLayers() : [];
          shifted.forEach((coord, i) => {
            if (cornerLayers[i]) {
              cornerLayers[i].setLatLng(coord);
            }
          });

          // Live update all midpoint handles with the moving center
          const midLayers = midpointMarkersGroupRef.current ? midpointMarkersGroupRef.current.getLayers() : [];
          for (let i = 0; i < shifted.length; i++) {
            const j = (i + 1) % shifted.length;
            const mid = [(shifted[i][0] + shifted[j][0]) / 2, (shifted[i][1] + shifted[j][1]) / 2];
            if (midLayers[i]) {
              midLayers[i].setLatLng(mid);
            }
          }
        }
      });

      centerMarker.on('dragend', (e) => {
        // Re-enable map dragging
        if (mapInstanceRef.current) mapInstanceRef.current.dragging.enable();

        const newPos = e.target.getLatLng();
        const newCenter = {
          lat: Math.round(newPos.lat * 100000) / 100000,
          lng: Math.round(newPos.lng * 100000) / 100000
        };

        setIsCustomCenter(true);

        if (dragMode === 'entire_shape' && dragStartCenter && initialVerticesOnDrag) {
          const dLat = newPos.lat - dragStartCenter.lat;
          const dLng = newPos.lng - dragStartCenter.lng;
          const shifted = initialVerticesOnDrag.map(([lat, lng]) => [
            Math.round((lat + dLat) * 100000) / 100000,
            Math.round((lng + dLng) * 100000) / 100000
          ]);
          emitChanges(shifted, newCenter);
        } else {
          emitChanges(vertices, newCenter);
        }

        dragStartCenter = null;
        initialVerticesOnDrag = null;
      });

      centroidMarkerRef.current.addLayer(centerMarker);

      // Midpoint '+' Handles (Click or drag to split walls)
      for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        const [lat1, lng1] = vertices[i];
        const [lat2, lng2] = vertices[j];
        const midLat = (lat1 + lat2) / 2;
        const midLng = (lng1 + lng2) / 2;

        const midIcon = L.divIcon({
          className: 'midpoint-handle',
          html: `<div style="
            width: 20px; 
            height: 20px; 
            background: rgba(99, 102, 241, 0.85); 
            border: 2px dashed #ffffff; 
            border-radius: 50%; 
            box-shadow: 0 0 8px rgba(99, 102, 241, 0.6);
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-weight: bold;
            font-size: 11px;
            user-select: none;
            touch-action: none;
          ">+</div>`,
          iconSize: [20, 20],
          iconAnchor: [10, 10]
        });

        const midMarker = L.marker([midLat, midLng], {
          draggable: true,
          autoPan: false,
          icon: midIcon
        });

        midMarker.on('dragstart', () => {
          if (mapInstanceRef.current) mapInstanceRef.current.dragging.disable();
        });

        midMarker.on('click', () => {
          const insertPt = [Math.round(midLat * 100000) / 100000, Math.round(midLng * 100000) / 100000];
          const next = [...vertices];
          next.splice(i + 1, 0, insertPt);
          updateVerticesOnly(next);
        });

        midMarker.on('dragend', (e) => {
          if (mapInstanceRef.current) mapInstanceRef.current.dragging.enable();
          const newPos = e.target.getLatLng();
          const insertPt = [Math.round(newPos.lat * 100000) / 100000, Math.round(newPos.lng * 100000) / 100000];
          const next = [...vertices];
          next.splice(i + 1, 0, insertPt);
          updateVerticesOnly(next);
        });

        midpointMarkersGroupRef.current.addLayer(midMarker);
      }

    } else if (n > 0) {
      polygonLayerRef.current.setLatLngs([]);
      polylineLayerRef.current.setLatLngs(vertices);
    } else {
      polygonLayerRef.current.setLatLngs([]);
      polylineLayerRef.current.setLatLngs([]);
    }

    // Touch-Friendly Corner Handles (#1, #2, #3...)
    vertices.forEach(([lat, lng], idx) => {
      const vertexIcon = L.divIcon({
        className: 'vertex-handle',
        html: `<div style="
          width: 30px; 
          height: 30px; 
          background: ${idx === 0 ? '#10b981' : '#6366f1'}; 
          border: 2.5px solid #ffffff; 
          border-radius: 50%; 
          box-shadow: 0 0 14px rgba(99, 102, 241, 0.95);
          cursor: grab;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-weight: bold;
          font-size: 12px;
          user-select: none;
          touch-action: none;
        ">${idx + 1}</div>`,
        iconSize: [30, 30],
        iconAnchor: [15, 15]
      });

      const marker = L.marker([lat, lng], {
        draggable: true,
        autoPan: false, // Prevents camera jumps while dragging near edges
        icon: vertexIcon
      });

      const popupContent = document.createElement('div');
      popupContent.style.fontSize = '12px';
      popupContent.innerHTML = `
        <b>Corner #${idx + 1}</b><br/>
        <span style="font-family: monospace; font-size: 11px; color: #cbd5e1;">${lat.toFixed(5)}, ${lng.toFixed(5)}</span><br/>
        <button id="del-btn-${idx}" style="
          margin-top: 6px; 
          padding: 4px 8px; 
          background: #ef4444; 
          color: white; 
          border: none; 
          border-radius: 6px; 
          font-size: 11px; 
          font-weight: bold; 
          cursor: pointer;
        ">🗑️ Delete Corner</button>
      `;

      marker.bindPopup(popupContent);

      marker.on('popupopen', () => {
        const btn = document.getElementById(`del-btn-${idx}`);
        if (btn) {
          btn.onclick = () => {
            if (vertices.length <= 3) {
              alert('A polygon boundary requires at least 3 vertices.');
              return;
            }
            const next = vertices.filter((_, i) => i !== idx);
            updateVerticesOnly(next);
          };
        }
      });

      marker.on('dragstart', () => {
        if (mapInstanceRef.current) mapInstanceRef.current.dragging.disable();
      });

      marker.on('drag', (e) => {
        const newPos = e.target.getLatLng();
        const updated = [...vertices];
        updated[idx] = [
          Math.round(newPos.lat * 100000) / 100000,
          Math.round(newPos.lng * 100000) / 100000
        ];
        if (polygonLayerRef.current && updated.length >= 3) {
          polygonLayerRef.current.setLatLngs(updated);
        }
      });

      marker.on('dragend', (e) => {
        if (mapInstanceRef.current) mapInstanceRef.current.dragging.enable();

        const newPos = e.target.getLatLng();
        const updated = [...vertices];
        updated[idx] = [
          Math.round(newPos.lat * 100000) / 100000,
          Math.round(newPos.lng * 100000) / 100000
        ];
        updateVerticesOnly(updated);
      });

      vertexMarkersGroupRef.current.addLayer(marker);
    });
  }, [vertices, centerPoint, dragMode, isCustomCenter, emitChanges, updateVerticesOnly]);

  // Snap Center Pin back to exact geometric middle
  const handleSnapToGeometricCentroid = () => {
    if (vertices.length < 3) return;
    const geomCenter = calculateGeometricCentroid(vertices);
    setIsCustomCenter(false);
    emitChanges(vertices, geomCenter);
  };

  // Transform Actions: Scale
  const handleScaleShape = (factor) => {
    if (vertices.length < 3) return;
    const center = centerPoint;
    const scaled = vertices.map(([lat, lng]) => [
      Math.round((center.lat + factor * (lat - center.lat)) * 100000) / 100000,
      Math.round((center.lng + factor * (lng - center.lng)) * 100000) / 100000
    ]);
    emitChanges(scaled, center);
  };

  // Transform Actions: Rotate (15 degrees)
  const handleRotateShape = (deg) => {
    if (vertices.length < 3) return;
    const center = centerPoint;
    const rad = (deg * Math.PI) / 180;
    const cosLat = Math.cos(center.lat * (Math.PI / 180));

    const rotated = vertices.map(([lat, lng]) => {
      const dy = lat - center.lat;
      const dx = (lng - center.lng) * cosLat;
      const dxRot = dx * Math.cos(rad) - dy * Math.sin(rad);
      const dyRot = dx * Math.sin(rad) + dy * Math.cos(rad);
      return [
        Math.round((center.lat + dyRot) * 100000) / 100000,
        Math.round((center.lng + dxRot / cosLat) * 100000) / 100000
      ];
    });
    emitChanges(rotated, center);
  };

  // Footprint Builders (Centers smoothly without breaking camera)
  const handleSpawnLShape = () => {
    const center = centerPoint;
    const lShape = generateLShapeAround(center.lat, center.lng, radiusMeters || 120);
    emitChanges(lShape, center);
  };

  const handleSpawnUShape = () => {
    const center = centerPoint;
    const uShape = generateUShapeAround(center.lat, center.lng, radiusMeters || 120);
    emitChanges(uShape, center);
  };

  const handleSpawnBox = () => {
    const center = centerPoint;
    const box = generateBoxAround(center.lat, center.lng, radiusMeters || 100);
    emitChanges(box, center);
  };

  const handleSpawnHexagon = () => {
    const center = centerPoint;
    const hex = generateHexagonAround(center.lat, center.lng, radiusMeters || 100);
    emitChanges(hex, center);
  };

  const handleClearPolygon = () => {
    emitChanges([], centerPoint);
  };

  const handlePickCurrentLocation = () => {
    if (!('geolocation' in navigator)) {
      alert('Geolocation is not supported by your browser.');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const newCenter = { lat, lng };

        if (mapInstanceRef.current) {
          mapInstanceRef.current.flyTo([lat, lng], 17);
        }

        const lShape = generateLShapeAround(lat, lng, radiusMeters || 100);
        setIsCustomCenter(true);
        emitChanges(lShape, newCenter);
      },
      (err) => {
        alert('Could not retrieve current location: ' + err.message);
      },
      { enableHighAccuracy: true }
    );
  };

  const maxRadius = calculateMaxRadiusFromCenter(vertices, centerPoint);

  return (
    <div className="space-y-3">
      
      {/* Primary Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-indigo-500/20 text-indigo-400">
            <MapPin className="w-4 h-4" />
          </div>
          <div>
            <span className="text-xs font-bold text-white block">Interactive Geofence Canvas</span>
            <span className="text-[10px] text-slate-400 font-mono">
              {vertices.length} Corners • Center: {centerPoint.lat.toFixed(4)}, {centerPoint.lng.toFixed(4)}
              {isCustomCenter ? <span className="text-amber-400 font-bold ml-1.5">(Custom Pin 📍)</span> : <span className="text-indigo-400 ml-1.5">(Auto Centroid)</span>}
            </span>
          </div>
        </div>

        {/* Global Controls */}
        <div className="flex items-center gap-1.5 flex-wrap">
          
          <button
            type="button"
            onClick={handleSnapToGeometricCentroid}
            className="px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-indigo-300 border border-slate-700 text-[11px] font-semibold flex items-center gap-1 transition-colors cursor-pointer"
            title="Snap the Center Pin to the exact geometric middle of the polygon"
          >
            <Crosshair className="w-3.5 h-3.5 text-indigo-400" />
            <span>Auto-Center</span>
          </button>

          <button
            type="button"
            onClick={handlePickCurrentLocation}
            className="px-2.5 py-1.5 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 text-[11px] font-semibold flex items-center gap-1 transition-colors cursor-pointer"
            title="Snap to device GPS"
          >
            <Navigation className="w-3.5 h-3.5" />
            <span>My GPS</span>
          </button>

          <button
            type="button"
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 text-[11px] font-semibold flex items-center gap-1 transition-colors cursor-pointer"
            title={isFullscreen ? 'Collapse Canvas' : 'Expand Fullscreen Canvas'}
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5 text-indigo-400" />}
            <span>{isFullscreen ? 'Collapse' : 'Expand'}</span>
          </button>

          <button
            type="button"
            onClick={() => setShowHelp(!showHelp)}
            className="p-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 transition-colors"
            title="Toggle Guide"
          >
            <HelpCircle className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Building Footprint Templates & Center Drag Mode Switcher */}
      <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 flex items-center justify-between flex-wrap gap-2 text-xs">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-indigo-400" />
            Templates:
          </span>
          <button
            type="button"
            onClick={handleSpawnLShape}
            className="px-2.5 py-1 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 font-bold text-[11px] cursor-pointer"
            title="Spawn 6-point L-Shaped Building footprint"
          >
            🏛️ L-Shape (6 pts)
          </button>
          <button
            type="button"
            onClick={handleSpawnUShape}
            className="px-2.5 py-1 rounded-lg bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30 font-bold text-[11px] cursor-pointer"
            title="Spawn 8-point U-Shaped Courtyard footprint"
          >
            🏛️ U-Shape (8 pts)
          </button>
          <button
            type="button"
            onClick={handleSpawnBox}
            className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 font-bold text-[11px] cursor-pointer"
          >
            Square Box (4 pts)
          </button>
          <button
            type="button"
            onClick={handleSpawnHexagon}
            className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 font-bold text-[11px] cursor-pointer"
          >
            Hexagon (6 pts)
          </button>
        </div>

        {/* Center Star Pin Drag Mode Switcher */}
        <div className="flex items-center gap-1.5 bg-slate-950/80 p-1 rounded-xl border border-slate-800">
          <span className="text-[10px] text-slate-400 font-bold px-1 uppercase">Star (★) Drag:</span>
          <button
            type="button"
            onClick={() => setDragMode('center_only')}
            className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition-colors cursor-pointer ${
              dragMode === 'center_only'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                : 'text-slate-400 hover:text-white'
            }`}
            title="Dragging the star moves ONLY the center pin without moving building corners"
          >
            📍 Move Center Only
          </button>
          <button
            type="button"
            onClick={() => setDragMode('entire_shape')}
            className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition-colors cursor-pointer ${
              dragMode === 'entire_shape'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'text-slate-400 hover:text-white'
            }`}
            title="Dragging the star moves all building corners together across the map"
          >
            📦 Move Whole Building
          </button>
        </div>
      </div>

      {/* Transform Bar (Scale & Rotate) */}
      <div className="px-3 py-1.5 rounded-xl bg-slate-900/60 border border-slate-800/80 flex items-center justify-between text-xs flex-wrap gap-2">
        <div className="flex items-center gap-1 flex-wrap">
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Transform:</span>
          <button
            type="button"
            onClick={() => handleScaleShape(1.1)}
            disabled={vertices.length < 3}
            className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-[10px] font-bold disabled:opacity-40"
            title="Scale larger (+10%)"
          >
            Scale +10%
          </button>
          <button
            type="button"
            onClick={() => handleScaleShape(0.9)}
            disabled={vertices.length < 3}
            className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-[10px] font-bold disabled:opacity-40"
            title="Scale smaller (-10%)"
          >
            Scale -10%
          </button>
          <button
            type="button"
            onClick={() => handleRotateShape(-15)}
            disabled={vertices.length < 3}
            className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 disabled:opacity-40"
            title="Rotate 15° Left"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => handleRotateShape(15)}
            disabled={vertices.length < 3}
            className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 disabled:opacity-40"
            title="Rotate 15° Right"
          >
            <RotateCw className="w-3.5 h-3.5" />
          </button>
        </div>

        <button
          type="button"
          onClick={handleClearPolygon}
          disabled={vertices.length === 0}
          className="px-2 py-1 rounded-lg bg-rose-600/20 hover:bg-rose-600/30 text-rose-400 border border-rose-500/30 text-[10px] font-bold disabled:opacity-40 flex items-center gap-1 cursor-pointer"
          title="Clear all corners"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>Clear Canvas</span>
        </button>
      </div>

      {/* Guide Banner */}
      {showHelp && (
        <div className="p-3 rounded-xl bg-indigo-950/40 border border-indigo-500/30 text-[11px] text-slate-300 space-y-1 animate-in fade-in">
          <div className="font-bold text-indigo-300 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" /> Venue Center & Boundary Guide:
          </div>
          <ul className="list-disc pl-4 space-y-0.5 text-slate-400">
            <li><strong className="text-amber-400">Move Center Pin (★):</strong> Drag the Gold Star to place the venue center exactly over the stage, podium, or main entrance gate. Your custom center stays locked even when reshaping corners!</li>
            <li><strong className="text-indigo-300">Auto-Center Button:</strong> Click "Auto-Center" to snap the center star back to the exact geometric center of the shape.</li>
            <li><strong className="text-white">Carve In-Between Corners:</strong> Click or drag any dashed <strong className="text-indigo-400">(+) midpoint handle</strong> to split any wall into an L-shape.</li>
            <li><strong className="text-white">Delete Corner:</strong> Tap any corner pin and click "🗑️ Delete Corner".</li>
          </ul>
        </div>
      )}

      {/* Leaflet Map Canvas */}
      <div className="relative">
        <div
          ref={mapContainerRef}
          style={{ height: isFullscreen ? '500px' : '300px' }}
          className="w-full rounded-2xl border border-slate-800 shadow-2xl z-10 overflow-hidden transition-all duration-300"
        />

        {/* Floating Tip Overlay */}
        <div className="absolute bottom-2 left-2 z-20 glass-panel px-2.5 py-1 rounded-lg border border-slate-700/80 text-[10px] text-slate-300 backdrop-blur-md flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
          <span>Gold Star (★) is Center Pin • Drag corners to reshape</span>
        </div>
      </div>

      {/* Statistics Strip */}
      <div className="grid grid-cols-3 gap-2 text-center text-xs bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80">
        <div>
          <span className="text-[10px] text-slate-500 uppercase block font-medium">Boundary Shape</span>
          <span className="font-bold text-white font-mono">{vertices.length} Corners</span>
        </div>
        <div>
          <span className="text-[10px] text-slate-500 uppercase block font-medium">Venue Center Pin</span>
          <span className="font-mono text-amber-300 text-[11px]">
            {centerPoint.lat.toFixed(4)}, {centerPoint.lng.toFixed(4)}
          </span>
        </div>
        <div>
          <span className="text-[10px] text-slate-500 uppercase block font-medium">Bounding Sphere</span>
          <span className="font-bold text-purple-400 font-mono">~{maxRadius}m</span>
        </div>
      </div>

    </div>
  );
}
