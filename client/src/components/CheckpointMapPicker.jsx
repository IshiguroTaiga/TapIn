import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import { MapPin, Plus, Trash2, CheckCircle, AlertTriangle, Crosshair, Sparkles } from 'lucide-react';

function normalizePolygon(poly) {
  if (!poly) return [];
  let raw = poly;
  while (typeof raw === 'string') {
    try { raw = JSON.parse(raw); } catch (e) { break; }
  }
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

// Ray-Casting PIP test for client-side instant click feedback
function isPointInPolygon(point, polygon) {
  if (!polygon || polygon.length < 3) return true;
  const [lat, lng] = point;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    const intersect = ((yi > lng) !== (yj > lng)) && (lat < ((xj - xi) * (lng - yi)) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

export default function CheckpointMapPicker({
  event,
  checkpoints = [],
  selectedCheckpointIndex = 0,
  onSelectCheckpoint,
  onCheckpointsChange,
  maxAllowed = 3
}) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const polygonLayerRef = useRef(null);
  const checkpointLayersGroupRef = useRef(null);

  // Keep latest references for click handlers
  const checkpointsRef = useRef(checkpoints);
  checkpointsRef.current = checkpoints;
  const selectedIndexRef = useRef(selectedCheckpointIndex);
  selectedIndexRef.current = selectedCheckpointIndex;
  const eventRef = useRef(event);
  eventRef.current = event;

  // 1. Initialize Leaflet Map Instance Once
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const defaultLat = parseFloat(event?.center_lat) || 18.1960;
      const defaultLng = parseFloat(event?.center_lng) || 120.5927;

      const map = L.map(mapContainerRef.current, {
        center: [defaultLat, defaultLng],
        zoom: 17,
        zoomControl: true,
        attributionControl: false
      });

      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        subdomains: 'abcd',
        maxZoom: 19
      }).addTo(map);

      polygonLayerRef.current = L.polygon([], {
        color: '#818cf8',
        fillColor: '#6366f1',
        fillOpacity: 0.18,
        weight: 2.5,
        dashArray: '5, 5'
      }).addTo(map);

      checkpointLayersGroupRef.current = L.layerGroup().addTo(map);
      mapInstanceRef.current = map;

      // Click on Map: Add Checkpoint or Reposition Selected Checkpoint
      map.on('click', (e) => {
        const { lat, lng } = e.latlng;
        const clickedPt = [Math.round(lat * 100000) / 100000, Math.round(lng * 100000) / 100000];
        const currentList = checkpointsRef.current || [];
        const polyCoords = normalizePolygon(eventRef.current?.polygon_coordinates);

        // Warning if placed way outside venue polygon
        const isInside = isPointInPolygon(clickedPt, polyCoords);

        if (currentList.length < maxAllowed) {
          // Add new checkpoint at clicked location
          const newCp = {
            id: null,
            name: `Station #${currentList.length + 1}`,
            description: isInside ? 'Checkpoint Station' : 'Warning: Outside Venue Boundary',
            lat: clickedPt[0],
            lng: clickedPt[1],
            radius_m: 20.0,
            tasks: []
          };
          const updated = [...currentList, newCp];
          if (onCheckpointsChange) onCheckpointsChange(updated);
          if (onSelectCheckpoint) onSelectCheckpoint(updated.length - 1);
        } else if (selectedIndexRef.current >= 0 && selectedIndexRef.current < currentList.length) {
          // Reposition currently selected checkpoint
          const updated = [...currentList];
          updated[selectedIndexRef.current] = {
            ...updated[selectedIndexRef.current],
            lat: clickedPt[0],
            lng: clickedPt[1]
          };
          if (onCheckpointsChange) onCheckpointsChange(updated);
        }
      });

      // Fit map bounds to event polygon
      const polyCoords = normalizePolygon(event?.polygon_coordinates);
      if (polyCoords.length >= 3) {
        try {
          const b = L.polygon(polyCoords).getBounds();
          if (b.isValid()) map.fitBounds(b.pad(0.2));
        } catch (err) {}
      }
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // 2. Render Venue Polygon & Checkpoint Station Pins
  useEffect(() => {
    if (!mapInstanceRef.current || !checkpointLayersGroupRef.current) return;
    const map = mapInstanceRef.current;
    const group = checkpointLayersGroupRef.current;
    group.clearLayers();

    // Render Event Polygon Boundary
    const polyCoords = normalizePolygon(event?.polygon_coordinates);
    if (polygonLayerRef.current) {
      if (polyCoords.length >= 3) {
        polygonLayerRef.current.setLatLngs(polyCoords);
      } else if (event?.center_lat && event?.center_lng) {
        polygonLayerRef.current.setLatLngs([]);
      }
    }

    // Render Each Checkpoint Station Pin & Catchment Circle
    checkpoints.forEach((cp, idx) => {
      const isSelected = idx === selectedCheckpointIndex;
      const cpLat = parseFloat(cp.lat);
      const cpLng = parseFloat(cp.lng);
      const radius = parseFloat(cp.radius_m) || 20.0;

      if (isNaN(cpLat) || isNaN(cpLng)) return;

      // 1. Catchment Circle Area
      const circle = L.circle([cpLat, cpLng], {
        radius: radius,
        color: isSelected ? '#06b6d4' : '#0891b2',
        fillColor: isSelected ? '#22d3ee' : '#06b6d4',
        fillOpacity: isSelected ? 0.35 : 0.2,
        weight: isSelected ? 2.5 : 1.5,
        dashArray: '4, 4'
      });
      group.addLayer(circle);

      // 2. Interactive Numbered Station Pin Badge
      const stationIcon = L.divIcon({
        className: `station-pin-${idx}`,
        html: `<div style="
          width: ${isSelected ? '38px' : '32px'};
          height: ${isSelected ? '38px' : '32px'};
          background: ${isSelected ? 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)' : 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)'};
          border: ${isSelected ? '3px solid #ffffff' : '2px solid #06b6d4'};
          border-radius: 50%;
          box-shadow: ${isSelected ? '0 0 16px rgba(6, 182, 212, 1), 0 4px 6px rgba(0,0,0,0.5)' : '0 0 8px rgba(6, 182, 212, 0.5)'};
          display: flex;
          align-items: center;
          justify-content: center;
          color: #ffffff;
          font-weight: 900;
          font-size: ${isSelected ? '14px' : '12px'};
          cursor: pointer;
          transition: all 0.2s ease;
          user-select: none;
        ">
          C${idx + 1}
        </div>`,
        iconSize: [isSelected ? 38 : 32, isSelected ? 38 : 32],
        iconAnchor: [isSelected ? 19 : 16, isSelected ? 19 : 16]
      });

      const marker = L.marker([cpLat, cpLng], {
        draggable: true,
        autoPan: false,
        icon: stationIcon
      });

      marker.bindTooltip(`<b>${cp.name || `Station #${idx + 1}`}</b><br/><span style="font-size: 10px; color: #94a3b8;">${(cp.tasks || []).length} Tasks • Radius: ${radius}m</span>`, {
        direction: 'top',
        offset: [0, -18],
        opacity: 0.95
      });

      // Click to select this node
      marker.on('click', (e) => {
        L.DomEvent.stopPropagation(e);
        if (onSelectCheckpoint) onSelectCheckpoint(idx);
      });

      // Drag station to reposition
      marker.on('dragstart', () => {
        if (mapInstanceRef.current) mapInstanceRef.current.dragging.disable();
      });

      marker.on('drag', (e) => {
        const newPos = e.target.getLatLng();
        circle.setLatLng(newPos);
      });

      marker.on('dragend', (e) => {
        if (mapInstanceRef.current) mapInstanceRef.current.dragging.enable();
        const newPos = e.target.getLatLng();
        const updated = [...checkpointsRef.current];
        updated[idx] = {
          ...updated[idx],
          lat: Math.round(newPos.lat * 100000) / 100000,
          lng: Math.round(newPos.lng * 100000) / 100000
        };
        if (onCheckpointsChange) onCheckpointsChange(updated);
      });

      group.addLayer(marker);
    });

  }, [checkpoints, selectedCheckpointIndex, event]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-1.5 text-cyan-400 font-bold">
          <MapPin className="w-4 h-4" />
          <span>Interactive Checkpoint Station Placement Canvas</span>
        </div>
        <span className="text-[11px] text-slate-400 font-mono">
          {checkpoints.length}/{maxAllowed} Checkpoints Placed
        </span>
      </div>

      <div className="relative">
        <div
          ref={mapContainerRef}
          style={{ height: '260px' }}
          className="w-full rounded-2xl border border-cyan-500/30 shadow-xl overflow-hidden z-10"
        />

        {/* Action helper bar */}
        <div className="absolute bottom-2 left-2 right-2 z-20 glass-panel px-3 py-1.5 rounded-xl border border-cyan-500/40 text-[11px] text-slate-200 backdrop-blur-md flex items-center justify-between flex-wrap gap-1">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>
            <span>
              {checkpoints.length < maxAllowed
                ? '👉 Click anywhere on map to drop a Checkpoint Station Pin'
                : '👉 Click or drag any C1/C2/C3 pin to select & configure its tasks'}
            </span>
          </div>

          <div className="flex items-center gap-1">
            {checkpoints.map((cp, i) => (
              <button
                key={i}
                type="button"
                onClick={() => onSelectCheckpoint && onSelectCheckpoint(i)}
                className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                  selectedCheckpointIndex === i
                    ? 'bg-cyan-500 text-slate-950 shadow'
                    : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-700'
                }`}
              >
                C{i + 1}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
