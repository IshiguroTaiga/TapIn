import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import { Navigation, MapPin } from 'lucide-react';

// Ilocos Norte Geographic Bounding Constraints
const ILOCOS_NORTE_CENTER = [18.1960, 120.5927]; // Laoag City, Ilocos Norte
const ILOCOS_NORTE_BOUNDS = [
  [17.70, 120.25], // South-West
  [18.70, 121.10]  // North-East
];

export default function GeofenceMapPicker({ centerLat, centerLng, radiusMeters, onChangeCenter }) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerRef = useRef(null);
  const circleRef = useRef(null);

  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Initialize Leaflet Map if not created
    if (!mapInstanceRef.current) {
      const initialLat = centerLat || ILOCOS_NORTE_CENTER[0];
      const initialLng = centerLng || ILOCOS_NORTE_CENTER[1];

      const map = L.map(mapContainerRef.current, {
        center: [initialLat, initialLng],
        zoom: 14,
        minZoom: 9,
        maxZoom: 19,
        maxBounds: ILOCOS_NORTE_BOUNDS,
        maxBoundsViscosity: 0.8
      });

      // Dark CartoDB Tile Layer for sleek dark mode matching TapIn design
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://carto.com/">CARTO</a> &copy; <a href="https://openstreetmap.org">OpenStreetMap</a>',
        subdomains: 'abcd',
        maxZoom: 19
      }).addTo(map);

      // Custom Glowing Map Icon
      const customIcon = L.divIcon({
        className: 'custom-pin',
        html: `<div style="
          width: 22px; 
          height: 22px; 
          background: #6366f1; 
          border: 3px solid #ffffff; 
          border-radius: 50%; 
          box-shadow: 0 0 15px rgba(99, 102, 241, 0.8);
          cursor: pointer;
        "></div>`,
        iconSize: [22, 22],
        iconAnchor: [11, 11]
      });

      // Marker
      const marker = L.marker([initialLat, initialLng], {
        draggable: true,
        icon: customIcon
      }).addTo(map);

      // Geofence Circle Overlay
      const circle = L.circle([initialLat, initialLng], {
        color: '#818cf8',
        fillColor: '#6366f1',
        fillOpacity: 0.25,
        weight: 2,
        radius: radiusMeters || 100
      }).addTo(map);

      markerRef.current = marker;
      circleRef.current = circle;
      mapInstanceRef.current = map;

      // Event: Drag marker
      marker.on('drag', (e) => {
        const { lat, lng } = e.target.getLatLng();
        circle.setLatLng([lat, lng]);
        onChangeCenter(lat, lng);
      });

      // Event: Click map to place marker
      map.on('click', (e) => {
        const { lat, lng } = e.latlng;
        marker.setLatLng([lat, lng]);
        circle.setLatLng([lat, lng]);
        onChangeCenter(lat, lng);
      });
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Update marker & circle when props change
  useEffect(() => {
    if (mapInstanceRef.current && markerRef.current && circleRef.current) {
      const lat = parseFloat(centerLat) || ILOCOS_NORTE_CENTER[0];
      const lng = parseFloat(centerLng) || ILOCOS_NORTE_CENTER[1];

      markerRef.current.setLatLng([lat, lng]);
      circleRef.current.setLatLng([lat, lng]);
      circleRef.current.setRadius(parseFloat(radiusMeters) || 100);

      // Smoothly pan map if center moves significantly
      const currentMapCenter = mapInstanceRef.current.getCenter();
      const dist = Math.hypot(currentMapCenter.lat - lat, currentMapCenter.lng - lng);
      if (dist > 0.005) {
        mapInstanceRef.current.panTo([lat, lng], { animate: true });
      }
    }
  }, [centerLat, centerLng, radiusMeters]);

  // Handle "Pick My Location" button click
  const handlePickCurrentLocation = () => {
    if (!('geolocation' in navigator)) {
      alert('Geolocation is not supported by your browser.');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;

        // Check if inside Ilocos Norte bounds, else alert
        if (lat < 17.70 || lat > 18.70 || lng < 120.25 || lng > 121.10) {
          alert(`Your detected location (${lat.toFixed(4)}, ${lng.toFixed(4)}) is outside Ilocos Norte bounds. Centering anyway for testing.`);
        }

        onChangeCenter(lat, lng);
        if (mapInstanceRef.current) {
          mapInstanceRef.current.setView([lat, lng], 15);
        }
      },
      (err) => {
        alert('Could not retrieve current location: ' + err.message);
      },
      { enableHighAccuracy: true }
    );
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-300">
          <MapPin className="w-4 h-4 text-indigo-400" />
          <span>Interactive Geofence Map Picker (Ilocos Norte Region)</span>
        </div>

        <button
          type="button"
          onClick={handlePickCurrentLocation}
          className="px-3 py-1.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 text-xs font-medium flex items-center gap-1.5 transition-colors"
        >
          <Navigation className="w-3.5 h-3.5" />
          <span>Pick My Location</span>
        </button>
      </div>

      <p className="text-[11px] text-slate-400">
        Click anywhere on the map or drag the pin to place the event center. Map is focused & bounded to <strong className="text-slate-300">Ilocos Norte</strong>.
      </p>

      {/* Leaflet Map Container */}
      <div
        ref={mapContainerRef}
        className="w-full h-64 rounded-xl border border-slate-800 shadow-inner z-10 overflow-hidden"
      />
    </div>
  );
}
