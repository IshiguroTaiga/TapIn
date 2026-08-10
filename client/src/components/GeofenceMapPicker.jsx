import React, { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import {
  Navigation,
  MapPin,
  RotateCcw,
  RotateCw,
  Trash2,
  PlusCircle,
  CheckCircle2,
  Maximize2,
  Minimize2,
  Compass,
  Layers,
  ZoomIn,
  ZoomOut,
  Move,
  Sparkles,
  HelpCircle
} from 'lucide-react';

// Ilocos Norte Geographic Bounding Constraints
const ILOCOS_NORTE_CENTER = [18.1960, 120.5927]; // Laoag City, Ilocos Norte
const ILOCOS_NORTE_BOUNDS = [
  [17.70, 120.25], // South-West
  [18.70, 121.10]  // North-East
];

// Campus Venue Presets
const PRESETS = {
  SUNKEN_GARDEN: [
    [18.1960, 120.5920],
    [18.1972, 120.5920],
    [18.1972, 120.5936],
    [18.1960, 120.5936]
  ],
  TEATRO_ILOCANDIA: [
    [18.1955, 120.5915],
    [18.1968, 120.5912],
    [18.1975, 120.5925],
    [18.1970, 120.5940],
    [18.1958, 120.5938],
    [18.1950, 120.5926]
  ]
};

function calculateCentroid(points) {
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

function calculateMaxRadius(points, centroid) {
  if (!points || points.length === 0) return 100;
  const R = 6371000;
  let maxDist = 0;
  points.forEach(([lat, lng]) => {
    const dLat = (lat - centroid.lat) * (Math.PI / 180);
    const dLng = (lng - centroid.lng) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(centroid.lat * (Math.PI / 180)) *
        Math.cos(lat * (Math.PI / 180)) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const d = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    if (d > maxDist) maxDist = d;
  });
  return Math.max(30, Math.ceil(maxDist));
}

// Generate Shape Footprint Templates centered on map
function generateLShapeAround(centerLat, centerLng, spanM = 120) {
  const R = 6371000;
  const rad = spanM / 2;
  const cosLat = Math.cos(centerLat * (Math.PI / 180));
  
  // 6 vertices of an L shape
  const offsets = [
    [-rad, -rad],       // Bottom-left
    [+rad, -rad],       // Bottom-right
    [+rad, 0],          // Right elbow
    [0, 0],             // Inner corner
    [0, +rad],          // Top inner
    [-rad, +rad]        // Top-left
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
  
  // 8 vertices of a U-shape courtyard
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

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [drawingMode, setDrawingMode] = useState(true); // Click to add vertex
  const [showHelp, setShowHelp] = useState(false);

  // Local polygon state for responsive drawing
  const [vertices, setVertices] = useState(() => {
    if (Array.isArray(polygon) && polygon.length >= 3) {
      return polygon.map(p => Array.isArray(p) ? [p[0], p[1]] : [p.lat, p.lng]);
    }
    const cLat = centerLat || ILOCOS_NORTE_CENTER[0];
    const cLng = centerLng || ILOCOS_NORTE_CENTER[1];
    return generateHexagonAround(cLat, cLng, radiusMeters || 120);
  });

  // Sync external prop updates
  useEffect(() => {
    if (Array.isArray(polygon) && polygon.length >= 3) {
      const normalized = polygon.map(p => Array.isArray(p) ? [p[0], p[1]] : [p.lat, p.lng]);
      setVertices(normalized);
    }
  }, [polygon]);

  // Central update notifier
  const updateVertices = useCallback((newVertices) => {
    setVertices(newVertices);
    if (onChangePolygon) {
      const centroid = calculateCentroid(newVertices);
      const maxRadius = calculateMaxRadius(newVertices, centroid);
      onChangePolygon(newVertices, centroid, maxRadius);
    }
  }, [onChangePolygon]);

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const initialCentroid = calculateCentroid(vertices);

      const map = L.map(mapContainerRef.current, {
        center: [initialCentroid.lat, initialCentroid.lng],
        zoom: 16,
        minZoom: 10,
        maxZoom: 19,
        maxBounds: ILOCOS_NORTE_BOUNDS,
        maxBoundsViscosity: 0.8,
        attributionControl: false,
        tap: true,
        touchZoom: true
      });

      // Dark CartoDB Tile Layer
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        subdomains: 'abcd',
        maxZoom: 19
      }).addTo(map);

      // Layers for dynamic shapes
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

      // Click to add vertex when drawing mode is active
      map.on('click', (e) => {
        const { lat, lng } = e.latlng;
        const newPt = [Math.round(lat * 100000) / 100000, Math.round(lng * 100000) / 100000];
        setVertices(prev => {
          const next = [...prev, newPt];
          updateVertices(next);
          return next;
        });
      });
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [updateVertices]);

  // Invalidate map size when fullscreen toggles
  useEffect(() => {
    if (mapInstanceRef.current) {
      setTimeout(() => {
        mapInstanceRef.current.invalidateSize();
      }, 200);
    }
  }, [isFullscreen]);

  // Synchronize Leaflet Layers & Draggable Handles
  useEffect(() => {
    if (!mapInstanceRef.current || !vertexMarkersGroupRef.current) return;

    // Clear previous layers
    vertexMarkersGroupRef.current.clearLayers();
    midpointMarkersGroupRef.current.clearLayers();
    centroidMarkerRef.current.clearLayers();

    const n = vertices.length;

    if (n >= 3) {
      // 1. Draw Closed Polygon
      polygonLayerRef.current.setLatLngs(vertices);
      polylineLayerRef.current.setLatLngs([]);

      // 2. Draw Draggable Centroid Pin (Drags entire shape at once!)
      const centroid = calculateCentroid(vertices);
      const centroidIcon = L.divIcon({
        className: 'centroid-pin',
        html: `<div style="
          width: 32px; 
          height: 32px; 
          background: #4f46e5; 
          border: 2.5px solid #ffffff; 
          border-radius: 50%; 
          box-shadow: 0 0 15px rgba(99, 102, 241, 1);
          cursor: move;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-weight: bold;
          font-size: 13px;
          touch-action: none;
        ">★</div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 16]
      });

      const centerMarker = L.marker([centroid.lat, centroid.lng], {
        draggable: true,
        icon: centroidIcon
      });

      centerMarker.bindPopup(`
        <div style="font-size: 12px; font-family: system-ui;">
          <b style="color: #6366f1;">📍 Venue Centroid</b><br/>
          <span style="color: #64748b;">Drag this star to move the <b>entire building shape</b> at once!</span>
        </div>
      `);

      let dragStartPos = null;
      let initialVerticesOnDrag = null;

      centerMarker.on('dragstart', (e) => {
        dragStartPos = e.target.getLatLng();
        initialVerticesOnDrag = [...vertices];
      });

      centerMarker.on('drag', (e) => {
        if (!dragStartPos || !initialVerticesOnDrag) return;
        const currentPos = e.target.getLatLng();
        const dLat = currentPos.lat - dragStartPos.lat;
        const dLng = currentPos.lng - dragStartPos.lng;

        const shifted = initialVerticesOnDrag.map(([lat, lng]) => [
          Math.round((lat + dLat) * 100000) / 100000,
          Math.round((lng + dLng) * 100000) / 100000
        ]);

        if (polygonLayerRef.current) {
          polygonLayerRef.current.setLatLngs(shifted);
        }
      });

      centerMarker.on('dragend', (e) => {
        if (!dragStartPos || !initialVerticesOnDrag) return;
        const currentPos = e.target.getLatLng();
        const dLat = currentPos.lat - dragStartPos.lat;
        const dLng = currentPos.lng - dragStartPos.lng;

        const shifted = initialVerticesOnDrag.map(([lat, lng]) => [
          Math.round((lat + dLat) * 100000) / 100000,
          Math.round((lng + dLng) * 100000) / 100000
        ]);

        updateVertices(shifted);
        dragStartPos = null;
        initialVerticesOnDrag = null;
      });

      centroidMarkerRef.current.addLayer(centerMarker);

      // 3. Midpoint '+' Handles for splitting edges (1-click create L-shape indent)
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
            touch-action: none;
          ">+</div>`,
          iconSize: [20, 20],
          iconAnchor: [10, 10]
        });

        const midMarker = L.marker([midLat, midLng], {
          draggable: true,
          icon: midIcon
        });

        midMarker.bindPopup(`
          <div style="font-size: 11px;">
            <b>Insert Corner Point</b><br/>
            Drag or click to split this edge and shape building.
          </div>
        `);

        // Click on '+' splits edge
        midMarker.on('click', () => {
          const insertPt = [Math.round(midLat * 100000) / 100000, Math.round(midLng * 100000) / 100000];
          const next = [...vertices];
          next.splice(i + 1, 0, insertPt);
          updateVertices(next);
        });

        // Drag '+' pulls out a new corner in real time
        midMarker.on('dragend', (e) => {
          const newPos = e.target.getLatLng();
          const insertPt = [Math.round(newPos.lat * 100000) / 100000, Math.round(newPos.lng * 100000) / 100000];
          const next = [...vertices];
          next.splice(i + 1, 0, insertPt);
          updateVertices(next);
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

    // 4. Place Touch-Friendly Draggable Vertex Handles (#1, #2, #3...)
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
          touch-action: none;
        ">${idx + 1}</div>`,
        iconSize: [30, 30],
        iconAnchor: [15, 15]
      });

      const marker = L.marker([lat, lng], {
        draggable: true,
        icon: vertexIcon,
        autoPan: true
      });

      const popupContent = document.createElement('div');
      popupContent.style.fontSize = '12px';
      popupContent.innerHTML = `
        <b>Corner #${idx + 1}</b><br/>
        ${lat.toFixed(5)}, ${lng.toFixed(5)}<br/>
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
            updateVertices(next);
          };
        }
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
        const newPos = e.target.getLatLng();
        const updated = [...vertices];
        updated[idx] = [
          Math.round(newPos.lat * 100000) / 100000,
          Math.round(newPos.lng * 100000) / 100000
        ];
        updateVertices(updated);
      });

      vertexMarkersGroupRef.current.addLayer(marker);
    });
  }, [vertices, updateVertices]);

  // Transform Actions: Scale Shape
  const handleScaleShape = (factor) => {
    if (vertices.length < 3) return;
    const centroid = calculateCentroid(vertices);
    const scaled = vertices.map(([lat, lng]) => [
      Math.round((centroid.lat + factor * (lat - centroid.lat)) * 100000) / 100000,
      Math.round((centroid.lng + factor * (lng - centroid.lng)) * 100000) / 100000
    ]);
    updateVertices(scaled);
  };

  // Transform Actions: Rotate Shape (15 degrees)
  const handleRotateShape = (deg) => {
    if (vertices.length < 3) return;
    const centroid = calculateCentroid(vertices);
    const rad = (deg * Math.PI) / 180;
    const cosLat = Math.cos(centroid.lat * (Math.PI / 180));

    const rotated = vertices.map(([lat, lng]) => {
      const dy = lat - centroid.lat;
      const dx = (lng - centroid.lng) * cosLat;
      const dxRot = dx * Math.cos(rad) - dy * Math.sin(rad);
      const dyRot = dx * Math.sin(rad) + dy * Math.cos(rad);
      return [
        Math.round((centroid.lat + dyRot) * 100000) / 100000,
        Math.round((centroid.lng + dxRot / cosLat) * 100000) / 100000
      ];
    });
    updateVertices(rotated);
  };

  // Footprint Builders
  const handleSpawnLShape = () => {
    const center = mapInstanceRef.current ? mapInstanceRef.current.getCenter() : { lat: 18.1960, lng: 120.5927 };
    const lShape = generateLShapeAround(center.lat, center.lng, radiusMeters || 120);
    updateVertices(lShape);
    if (mapInstanceRef.current) {
      mapInstanceRef.current.fitBounds(L.latLngBounds(lShape).pad(0.3));
    }
  };

  const handleSpawnUShape = () => {
    const center = mapInstanceRef.current ? mapInstanceRef.current.getCenter() : { lat: 18.1960, lng: 120.5927 };
    const uShape = generateUShapeAround(center.lat, center.lng, radiusMeters || 120);
    updateVertices(uShape);
    if (mapInstanceRef.current) {
      mapInstanceRef.current.fitBounds(L.latLngBounds(uShape).pad(0.3));
    }
  };

  const handleSpawnBox = () => {
    const center = mapInstanceRef.current ? mapInstanceRef.current.getCenter() : { lat: 18.1960, lng: 120.5927 };
    const box = generateBoxAround(center.lat, center.lng, radiusMeters || 100);
    updateVertices(box);
    if (mapInstanceRef.current) {
      mapInstanceRef.current.fitBounds(L.latLngBounds(box).pad(0.3));
    }
  };

  const handleSpawnHexagon = () => {
    const center = mapInstanceRef.current ? mapInstanceRef.current.getCenter() : { lat: 18.1960, lng: 120.5927 };
    const hex = generateHexagonAround(center.lat, center.lng, radiusMeters || 100);
    updateVertices(hex);
    if (mapInstanceRef.current) {
      mapInstanceRef.current.fitBounds(L.latLngBounds(hex).pad(0.3));
    }
  };

  const handleUndoVertex = () => {
    if (vertices.length === 0) return;
    const next = vertices.slice(0, -1);
    updateVertices(next);
  };

  const handleClearPolygon = () => {
    updateVertices([]);
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

        if (mapInstanceRef.current) {
          mapInstanceRef.current.setView([lat, lng], 17);
        }

        const lShape = generateLShapeAround(lat, lng, radiusMeters || 100);
        updateVertices(lShape);
      },
      (err) => {
        alert('Could not retrieve current location: ' + err.message);
      },
      { enableHighAccuracy: true }
    );
  };

  const centroid = calculateCentroid(vertices);
  const maxRadius = calculateMaxRadius(vertices, centroid);

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
              {vertices.length} {vertices.length === 1 ? 'Corner' : 'Corners'} • Centroid: {centroid.lat.toFixed(4)}, {centroid.lng.toFixed(4)}
            </span>
          </div>
        </div>

        {/* Global Controls */}
        <div className="flex items-center gap-1.5 flex-wrap">
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

      {/* Building Footprint Templates Bar */}
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

        {/* Quick Transform Controls (Scale & Rotate) */}
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
          <button
            type="button"
            onClick={handleClearPolygon}
            disabled={vertices.length === 0}
            className="p-1 rounded-lg bg-rose-600/20 hover:bg-rose-600/30 text-rose-400 border border-rose-500/30 disabled:opacity-40"
            title="Clear all"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Guide Banner */}
      {showHelp && (
        <div className="p-3 rounded-xl bg-indigo-950/40 border border-indigo-500/30 text-[11px] text-slate-300 space-y-1 animate-in fade-in">
          <div className="font-bold text-indigo-300 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" /> Fluid Boundary Customization Guide:
          </div>
          <ul className="list-disc pl-4 space-y-0.5 text-slate-400">
            <li><strong className="text-white">Move Whole Building:</strong> Drag the center purple star (★) to move all corners together.</li>
            <li><strong className="text-white">Carve In-Between Corners:</strong> Click or drag any dashed <strong className="text-indigo-400">(+) midpoint handle</strong> along any edge to split and create new corners (e.g. turning a rectangle into an L-shape).</li>
            <li><strong className="text-white">Drag Corners:</strong> Drag any numbered pin (#1, #2, ...) to adjust building walls.</li>
            <li><strong className="text-white">Delete Corner:</strong> Tap any numbered pin and click "🗑️ Delete Corner" in the popup.</li>
            <li><strong className="text-white">Rotate / Scale:</strong> Use the transform buttons above to align with angled campus buildings.</li>
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

        {/* Floating Quick Action Tip Overlay */}
        <div className="absolute bottom-2 left-2 z-20 glass-panel px-2.5 py-1 rounded-lg border border-slate-700/80 text-[10px] text-slate-300 backdrop-blur-md flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          <span>Click anywhere to add corner • Drag ★ star to move whole shape</span>
        </div>
      </div>

      {/* Statistics Strip */}
      <div className="grid grid-cols-3 gap-2 text-center text-xs bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80">
        <div>
          <span className="text-[10px] text-slate-500 uppercase block font-medium">Boundary Shape</span>
          <span className="font-bold text-white font-mono">{vertices.length} Vertices (Closed)</span>
        </div>
        <div>
          <span className="text-[10px] text-slate-500 uppercase block font-medium">Venue Centroid</span>
          <span className="font-mono text-indigo-300 text-[11px]">{centroid.lat.toFixed(4)}, {centroid.lng.toFixed(4)}</span>
        </div>
        <div>
          <span className="text-[10px] text-slate-500 uppercase block font-medium">Bounding Sphere</span>
          <span className="font-bold text-purple-400 font-mono">~{maxRadius} meters</span>
        </div>
      </div>

    </div>
  );
}
