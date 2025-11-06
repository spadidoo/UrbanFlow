// frontend/components/SimulationMap.jsx

"use client";

import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet-draw/dist/leaflet.draw.css";
import "leaflet-draw";

// Fix Leaflet icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png",
});

export default function SimulationMap({
  isExpanded,
  onExpand,
  drawMode,
  onPointSelect,
  onAreaSelect,
  selectedLocation,
}) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const drawnItemsRef = useRef(null);
  const drawControlRef = useRef(null);

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    // Initialize map
    const map = L.map(mapRef.current, {
      center: [14.2096, 121.164], // Calamba City
      zoom: 13,
      zoomControl: true,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);

    // Feature group to store drawn items
    const drawnItems = new L.FeatureGroup();
    map.addLayer(drawnItems);

    mapInstanceRef.current = map;
    drawnItemsRef.current = drawnItems;

    // Cleanup
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Update drawing controls when drawMode changes
  useEffect(() => {
    if (!mapInstanceRef.current || !drawnItemsRef.current) return;

    const map = mapInstanceRef.current;
    const drawnItems = drawnItemsRef.current;

    // Remove old draw control
    if (drawControlRef.current) {
      map.removeControl(drawControlRef.current);
    }

    // Clear previous drawings
    drawnItems.clearLayers();

    if (drawMode === 'point') {
      // Point mode - simple click handler
      const clickHandler = (e) => {
        drawnItems.clearLayers();
        
        const marker = L.marker([e.latlng.lat, e.latlng.lng])
          .addTo(drawnItems)
          .bindPopup('Selected location')
          .openPopup();

        onPointSelect(e.latlng.lat, e.latlng.lng);
      };

      map.on('click', clickHandler);

      // Store handler for cleanup
      map._clickHandler = clickHandler;

    } else {
      // Remove point click handler if exists
      if (map._clickHandler) {
        map.off('click', map._clickHandler);
        delete map._clickHandler;
      }

      // Line or Polygon mode - use Leaflet Draw
      const drawControl = new L.Control.Draw({
        draw: {
          polyline: drawMode === 'line',
          polygon: drawMode === 'polygon',
          rectangle: false,
          circle: false,
          marker: false,
          circlemarker: false,
        },
        edit: {
          featureGroup: drawnItems,
          remove: true,
        },
      });

      map.addControl(drawControl);
      drawControlRef.current = drawControl;

      // Handle draw events
      map.on(L.Draw.Event.CREATED, (e) => {
        const layer = e.layer;
        drawnItems.clearLayers();
        drawnItems.addLayer(layer);

        // Extract coordinates
        let coordinates;
        if (drawMode === 'line') {
          coordinates = layer.getLatLngs().map(latlng => ({
            lat: latlng.lat,
            lng: latlng.lng,
          }));
        } else if (drawMode === 'polygon') {
          coordinates = layer.getLatLngs()[0].map(latlng => ({
            lat: latlng.lat,
            lng: latlng.lng,
          }));
        }

        onAreaSelect(coordinates);
      });
    }

    // Cleanup
    return () => {
      if (map._clickHandler) {
        map.off('click', map._clickHandler);
        delete map._clickHandler;
      }
    };
  }, [drawMode, onPointSelect, onAreaSelect]);

  // Display selected location
  useEffect(() => {
    if (!mapInstanceRef.current || !drawnItemsRef.current || !selectedLocation) return;

    const map = mapInstanceRef.current;
    const drawnItems = drawnItemsRef.current;

    drawnItems.clearLayers();

    if (selectedLocation.type === 'point') {
      const { lat, lng } = selectedLocation.center;
      L.marker([lat, lng])
        .addTo(drawnItems)
        .bindPopup('Selected disruption location')
        .openPopup();
      
      // Add circle to show affected area
      L.circle([lat, lng], {
        radius: 500,
        color: 'orange',
        fillColor: '#f97316',
        fillOpacity: 0.2,
      }).addTo(drawnItems);

    } else if (selectedLocation.type === 'line') {
      const latlngs = selectedLocation.coordinates.map(c => [c.lat, c.lng]);
      L.polyline(latlngs, {
        color: 'orange',
        weight: 5,
      }).addTo(drawnItems);

      // Add buffer zone
      const buffered = L.polyline(latlngs, {
        color: '#f97316',
        weight: 20,
        opacity: 0.2,
      }).addTo(drawnItems);

    } else if (selectedLocation.type === 'polygon') {
      const latlngs = selectedLocation.coordinates.map(c => [c.lat, c.lng]);
      L.polygon(latlngs, {
        color: 'orange',
        fillColor: '#f97316',
        fillOpacity: 0.3,
      }).addTo(drawnItems);
    }

    // Fit map to show the selection
    if (drawnItems.getLayers().length > 0) {
      map.fitBounds(drawnItems.getBounds(), { padding: [50, 50] });
    }
  }, [selectedLocation]);

  return (
    <div className="relative bg-gray-200 rounded-lg overflow-hidden" style={{ height: isExpanded ? '70vh' : '400px' }}>
      <div ref={mapRef} className="w-full h-full" />
      
      {/* Expand/Collapse Button */}
      <button
        onClick={onExpand}
        className="absolute top-4 right-4 bg-white p-2 rounded-lg shadow-lg hover:bg-gray-50 transition z-[1000]"
        title={isExpanded ? "Collapse map" : "Expand map"}
      >
        {isExpanded ? (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M5 10a1 1 0 011-1h8a1 1 0 110 2H6a1 1 0 01-1-1z" clipRule="evenodd" />
          </svg>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M3 4a1 1 0 011-1h4a1 1 0 010 2H6.414l2.293 2.293a1 1 0 11-1.414 1.414L5 6.414V8a1 1 0 01-2 0V4zm9 1a1 1 0 110-2h4a1 1 0 011 1v4a1 1 0 11-2 0V6.414l-2.293 2.293a1 1 0 11-1.414-1.414L13.586 5H12zm-9 7a1 1 0 112 0v1.586l2.293-2.293a1 1 0 111.414 1.414L6.414 15H8a1 1 0 110 2H4a1 1 0 01-1-1v-4zm13-1a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 110-2h1.586l-2.293-2.293a1 1 0 111.414-1.414L15 13.586V12a1 1 0 011-1z" clipRule="evenodd" />
          </svg>
        )}
      </button>

      {/* Instructions Overlay */}
      <div className="absolute bottom-4 left-4 bg-white bg-opacity-90 rounded-lg p-3 shadow-lg text-xs max-w-xs">
        <p className="font-semibold text-gray-800 mb-1">
          {drawMode === 'point' && '📍 Click anywhere on the map'}
          {drawMode === 'line' && '➖ Click points to draw a line (double-click to finish)'}
          {drawMode === 'polygon' && '⬟ Click to draw area boundary (double-click to close)'}
        </p>
        <p className="text-gray-600">
          Road information will be fetched from OpenStreetMap
        </p>
      </div>
    </div>
  );
}