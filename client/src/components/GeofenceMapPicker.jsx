import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import {
  Navigation,
  MapPin,
  RotateCcw,
  Trash2,
  PlusCircle,
  CheckCircle2,
  Maximize2,
  Compass,
  Layers
} from 'lucide-react';

// Ilocos Norte Geographic Bounding Constraints
const ILOCOS_NORTE_CENTER = [18.1960, 120.5927]; // Laoag City, Ilocos Norte
const ILOCOS_NORTE_BOUNDS = [
  [17.70, 120.25], // South-West
  [18.70, 121.10]  // North-East
];

// Campus Venue Presets for fast setup
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
  const centroidMarkerRef = useRef(null);

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

  // Notify parent of updates
  const updateVertices = (newVertices) => {
    setVertices(newVertices);
    if (onChangePolygon) {
      const centroid = calculateCentroid(newVertices);
      const maxRadius = calculateMaxRadius(newVertices, centroid);
      onChangePolygon(newVertices, centroid, maxRadius);
    }
  };

  // Initialize Map
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
        attributionControl: false
      });

      // Dark CartoDB Tile Layer for sleek dark mode
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        subdomains: 'abcd',
        maxZoom: 19
      }).addTo(map);

      // Layer groups for dynamic redraws
      polygonLayerRef.current = L.polygon([], {
        color: '#818cf8',
        fillColor: '#6366f1',
        fillOpacity: 0.25,
        weight: 2.5,
        dashArray: '6, 6'
      }).addTo(map);

      polylineLayerRef.current = L.polyline([], {
        color: '#818cf8',
        weight: 2,
        dashArray: '4, 4'
      }).addTo(map);

      vertexMarkersGroupRef.current = L.layerGroup().addTo(map);
      centroidMarkerRef.current = L.layerGroup().addTo(map);

      mapInstanceRef.current = map;

      // Click to add vertex
      map.on('click', (e) => {
        const { lat, lng } = e.latlng;
        const newPt = [Math.round(lat * 100000) / 100000, Math.round(lng * 100000) / 100000];
        setVertices(prev => {
          const next = [...prev, newPt];
          if (onChangePolygon) {
            const centroid = calculateCentroid(next);
            const maxRadius = calculateMaxRadius(next, centroid);
            onChangePolygon(next, centroid, maxRadius);
          }
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
  }, []);

  // Synchronize Leaflet layers when `vertices` changes
  useEffect(() => {
    if (!mapInstanceRef.current || !vertexMarkersGroupRef.current) return;

    // Clear previous handles
    vertexMarkersGroupRef.current.clearLayers();
    centroidMarkerRef.current.clearLayers();

    if (vertices.length >= 3) {
      // Draw closed Polygon
      polygonLayerRef.current.setLatLngs(vertices);
      polylineLayerRef.current.setLatLngs([]);

      // Draw Centroid Pin
      const centroid = calculateCentroid(vertices);
      const centroidIcon = L.divIcon({
        className: 'centroid-pin',
        html: `<div style="
          width: 16px; 
          height: 16px; 
          background: #4f46e5; 
          border: 2px solid #ffffff; 
          border-radius: 50%; 
          box-shadow: 0 0 10px rgba(99, 102, 241, 0.9);
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-weight: bold;
          font-size: 9px;
        ">★</div>`,
        iconSize: [16, 16],
        iconAnchor: [8, 8]
      });
      L.marker([centroid.lat, centroid.lng], { icon: centroidIcon })
        .bindPopup(`<b>Centroid</b><br/>${centroid.lat.toFixed(5)}, ${centroid.lng.toFixed(5)}`)
        .addTo(centroidMarkerRef.current);

    } else if (vertices.length > 0) {
      // Draw open polyline for in-progress drawing
      polygonLayerRef.current.setLatLngs([]);
      polylineLayerRef.current.setLatLngs(vertices);
    } else {
      polygonLayerRef.current.setLatLngs([]);
      polylineLayerRef.current.setLatLngs([]);
    }

    // Place draggable vertex handles
    vertices.forEach(([lat, lng], idx) => {
      const vertexIcon = L.divIcon({
        className: 'vertex-handle',
        html: `<div style="
          width: 24px; 
          height: 24px; 
          background: ${idx === 0 ? '#10b981' : '#6366f1'}; 
          border: 2px solid #ffffff; 
          border-radius: 50%; 
          box-shadow: 0 0 12px rgba(99, 102, 241, 0.9);
          cursor: grab;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-weight: bold;
          font-size: 11px;
        ">${idx + 1}</div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12]
      });

      const marker = L.marker([lat, lng], {
        draggable: true,
        icon: vertexIcon
      });

      marker.bindPopup(`
        <div style="font-size: 11px;">
          <b>Vertex #${idx + 1}</b><br/>
          ${lat.toFixed(5)}, ${lng.toFixed(5)}<br/>
          <span style="color: #94a3b8;">Drag to reshape geofence</span>
        </div>
      `);

      marker.on('drag', (e) => {
        const newPos = e.target.getLatLng();
        setVertices(prev => {
          const updated = [...prev];
          updated[idx] = [
            Math.round(newPos.lat * 100000) / 100000,
            Math.round(newPos.lng * 100000) / 100000
          ];
          if (polygonLayerRef.current && updated.length >= 3) {
            polygonLayerRef.current.setLatLngs(updated);
          }
          return updated;
        });
      });

      marker.on('dragend', (e) => {
        const newPos = e.target.getLatLng();
        setVertices(prev => {
          const updated = [...prev];
          updated[idx] = [
            Math.round(newPos.lat * 100000) / 100000,
            Math.round(newPos.lng * 100000) / 100000
          ];
          updateVertices(updated);
          return updated;
        });
      });

      vertexMarkersGroupRef.current.addLayer(marker);
    });
  }, [vertices]);

  // Handlers
  const handleUndoVertex = () => {
    if (vertices.length === 0) return;
    const next = vertices.slice(0, -1);
    updateVertices(next);
  };

  const handleClearPolygon = () => {
    updateVertices([]);
  };

  const handleApplyPreset = (presetKey) => {
    if (PRESETS[presetKey]) {
      const shape = PRESETS[presetKey];
      updateVertices(shape);
      if (mapInstanceRef.current) {
        const bounds = L.latLngBounds(shape);
        mapInstanceRef.current.fitBounds(bounds.pad(0.3));
      }
    }
  };

  const handleGenerateHexagon = () => {
    if (!mapInstanceRef.current) return;
    const center = mapInstanceRef.current.getCenter();
    const hex = generateHexagonAround(center.lat, center.lng, radiusMeters || 120);
    updateVertices(hex);
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

        const hex = generateHexagonAround(lat, lng, radiusMeters || 100);
        updateVertices(hex);
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
      {/* Top Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-200">
          <MapPin className="w-4 h-4 text-indigo-400" />
          <span>Interactive Polygon Geofence Editor</span>
          <span className="px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-mono text-[10px]">
            {vertices.length} {vertices.length === 1 ? 'Vertex' : 'Vertices'}
          </span>
        </div>

        {/* Toolbar Buttons */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={handlePickCurrentLocation}
            className="px-2.5 py-1.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 text-[11px] font-medium flex items-center gap-1 transition-colors cursor-pointer"
            title="Place shape around your device GPS"
          >
            <Navigation className="w-3.5 h-3.5" />
            <span>My Location</span>
          </button>

          <button
            type="button"
            onClick={handleGenerateHexagon}
            className="px-2.5 py-1.5 rounded-lg bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30 text-[11px] font-medium flex items-center gap-1 transition-colors cursor-pointer"
            title="Generate regular hexagon centered on map"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Hexagon</span>
          </button>

          <button
            type="button"
            onClick={handleUndoVertex}
            disabled={vertices.length === 0}
            className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 disabled:opacity-40 text-[11px] font-medium flex items-center gap-1 transition-colors cursor-pointer"
            title="Undo last vertex"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Undo</span>
          </button>

          <button
            type="button"
            onClick={handleClearPolygon}
            disabled={vertices.length === 0}
            className="px-2.5 py-1.5 rounded-lg bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 disabled:opacity-40 text-[11px] font-medium flex items-center gap-1 transition-colors cursor-pointer"
            title="Clear all vertices"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear</span>
          </button>
        </div>
      </div>

      {/* Instructions & Preset Badges */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between text-[11px] text-slate-400 gap-2 bg-slate-900/40 p-2 rounded-xl border border-slate-800">
        <div>
          💡 <strong className="text-slate-300">Click map</strong> to place boundary vertices. <strong className="text-slate-300">Drag numbered pins</strong> to reshape venue.
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-slate-500 text-[10px] uppercase font-bold">Presets:</span>
          <button
            type="button"
            onClick={() => handleApplyPreset('SUNKEN_GARDEN')}
            className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-indigo-300 text-[10px] border border-slate-700 cursor-pointer"
          >
            MMSU Quad
          </button>
          <button
            type="button"
            onClick={() => handleApplyPreset('TEATRO_ILOCANDIA')}
            className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-purple-300 text-[10px] border border-slate-700 cursor-pointer"
          >
            Teatro Oval
          </button>
        </div>
      </div>

      {/* Leaflet Map Container */}
      <div
        ref={mapContainerRef}
        className="w-full h-72 rounded-xl border border-slate-800 shadow-inner z-10 overflow-hidden"
      />

      {/* Calculated Polygon Geometry Statistics */}
      <div className="grid grid-cols-3 gap-2 text-center text-xs bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80">
        <div>
          <span className="text-[10px] text-slate-500 uppercase block font-medium">Vertices</span>
          <span className="font-bold text-white font-mono">{vertices.length} points</span>
        </div>
        <div>
          <span className="text-[10px] text-slate-500 uppercase block font-medium">Centroid Coords</span>
          <span className="font-mono text-indigo-300 text-[11px]">{centroid.lat.toFixed(4)}, {centroid.lng.toFixed(4)}</span>
        </div>
        <div>
          <span className="text-[10px] text-slate-500 uppercase block font-medium">Bounding Radius</span>
          <span className="font-bold text-purple-400 font-mono">~{maxRadius}m</span>
        </div>
      </div>
    </div>
  );
}
