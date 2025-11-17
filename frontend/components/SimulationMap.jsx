// frontend/components/SimulationMap.jsx - FIXED VERSION

"use client";

import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";

// Fix Leaflet icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png",
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

  // Use refs instead of state to avoid infinite loops
  const drawingCoordsRef = useRef([]);
  const isDrawingRef = useRef(false);
  const tempMarkersRef = useRef([]);
  const tempLineRef = useRef(null);

  // Initialize map (runs once)
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const map = L.map(mapRef.current, {
      center: [14.2096, 121.164],
      zoom: 13,
      zoomControl: true,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors",
      maxZoom: 19,
    }).addTo(map);

    const drawnItems = new L.FeatureGroup();
    map.addLayer(drawnItems);

    mapInstanceRef.current = map;
    drawnItemsRef.current = drawnItems;

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []); // Empty dependency - runs once

  // Handle drawing mode changes
  useEffect(() => {
    if (!mapInstanceRef.current || !drawnItemsRef.current) return;

    const map = mapInstanceRef.current;
    const drawnItems = drawnItemsRef.current;

    // Clear all event handlers
    map.off("click");
    map.off("dblclick");

    // Clear drawn items
    // ✅ ONLY clear if we're changing modes (not on first load with existing selection)
    // Check if we have a selectedLocation that we should keep
    if (!selectedLocation || drawMode !== selectedLocation.type) {
      drawnItems.clearLayers(); // Clear when changing modes
    }

    // Reset drawing state using refs
    drawingCoordsRef.current = [];
    isDrawingRef.current = false;
    tempMarkersRef.current = [];
    tempLineRef.current = null;

    // === POINT MODE ===
    if (drawMode === "point") {
      const handleClick = (e) => {
        drawnItems.clearLayers();

        // IMPORTANT: Add visible marker with custom icon
        const marker = L.marker([e.latlng.lat, e.latlng.lng], {
          icon: L.divIcon({
            className: "custom-pin",
            html: `
              <div style="
                background: #f97316;
                border: 3px solid white;
                border-radius: 50%;
                width: 30px;
                height: 30px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 18px;
                box-shadow: 0 3px 10px rgba(0,0,0,0.4);
                cursor: pointer;
              ">📍</div>
            `,
            iconSize: [30, 30],
            iconAnchor: [15, 15],
          }),
        }).addTo(drawnItems);

        marker
          .bindPopup(
            `
          <div style="font-family: sans-serif; padding: 4px;">
            <strong>Selected Location</strong><br/>
            <small>Lat: ${e.latlng.lat.toFixed(5)}<br/>
            Lng: ${e.latlng.lng.toFixed(5)}</small>
          </div>
        `
          )
          .openPopup();

        // Add pulsing circle animation
        L.circle([e.latlng.lat, e.latlng.lng], {
          radius: 300,
          color: "#f97316",
          fillColor: "#f97316",
          fillOpacity: 0.15,
          weight: 2,
          className: "pulse-circle",
        }).addTo(drawnItems);

        onPointSelect(e.latlng.lat, e.latlng.lng);
      };

      map.on("click", handleClick);
    }

    // === LINE OR POLYGON MODE ===
    else if (drawMode === "line" || drawMode === "polygon") {
      const handleClick = (e) => {
        const coords = drawingCoordsRef.current;

        // Add point
        coords.push(e.latlng);
        drawingCoordsRef.current = coords;
        isDrawingRef.current = true;

        // Add visual marker
        const marker = L.circleMarker([e.latlng.lat, e.latlng.lng], {
          radius: 5,
          color: "#f97316",
          fillColor: "#fff",
          fillOpacity: 1,
          weight: 2,
        }).addTo(drawnItems);

        tempMarkersRef.current.push(marker);

        // Remove old temporary line
        if (tempLineRef.current) {
          drawnItems.removeLayer(tempLineRef.current);
        }

        // Draw temporary line/polygon
        if (coords.length > 1) {
          if (drawMode === "line") {
            tempLineRef.current = L.polyline(coords, {
              color: "#f97316",
              weight: 4,
              opacity: 0.7,
              dashArray: "10, 10",
            }).addTo(drawnItems);
          } else {
            tempLineRef.current = L.polygon(coords, {
              color: "#f97316",
              fillColor: "#f97316",
              fillOpacity: 0.2,
              weight: 3,
              dashArray: "10, 10",
            }).addTo(drawnItems);
          }
        }
      };

      const handleDoubleClick = (e) => {
        L.DomEvent.stopPropagation(e);
        L.DomEvent.preventDefault(e);

        const coords = drawingCoordsRef.current;

        if (coords.length >= 2) {
          // Remove temporary elements
          tempMarkersRef.current.forEach((m) => drawnItems.removeLayer(m));
          if (tempLineRef.current) {
            drawnItems.removeLayer(tempLineRef.current);
          }

          // Draw final shape
          let finalLayer;
          if (drawMode === "line") {
            finalLayer = L.polyline(coords, {
              color: "#f97316",
              weight: 6,
              opacity: 1,
            }).addTo(drawnItems);

            // Add buffer zone
            L.polyline(coords, {
              color: "#f97316",
              weight: 20,
              opacity: 0.15,
            }).addTo(drawnItems);
          } else {
            finalLayer = L.polygon(coords, {
              color: "#f97316",
              fillColor: "#f97316",
              fillOpacity: 0.3,
              weight: 3,
            }).addTo(drawnItems);
          }

          // Fit bounds
          map.fitBounds(finalLayer.getBounds(), { padding: [50, 50] });

          // Convert to array of {lat, lng}
          const coordinates = coords.map((ll) => ({
            lat: ll.lat,
            lng: ll.lng,
          }));

          onAreaSelect(coordinates);

          // Reset
          drawingCoordsRef.current = [];
          isDrawingRef.current = false;
          tempMarkersRef.current = [];
          tempLineRef.current = null;
        }
      };

      map.on("click", handleClick);
      map.on("dblclick", handleDoubleClick);
    }

    // Cleanup function
    return () => {
      map.off("click");
      map.off("dblclick");
    };
  }, [drawMode, onPointSelect, onAreaSelect]); // Only depend on these props

  // Display selected location (separate effect)
  useEffect(() => {
    if (!mapInstanceRef.current || !drawnItemsRef.current || !selectedLocation)
      return;

    const map = mapInstanceRef.current;
    const drawnItems = drawnItemsRef.current;

    // DON'T clear if we're actively drawing
    if (isDrawingRef.current) return;

    const currentLayers = drawnItems.getLayers();
    const hasMarker = currentLayers.some((layer) => layer instanceof L.Marker);

    // If we already have a marker at this location, don't redraw
    if (hasMarker && selectedLocation.type === "point") {
      return; // ← PREVENTS CLEARING WHEN ROAD INFO LOADS
    }

    // Clear and redraw only for new selections
    drawnItems.clearLayers();

    if (selectedLocation.type === "point") {
      const { lat, lng } = selectedLocation.center;

      // Add PERSISTENT marker
      const marker = L.marker([lat, lng], {
        icon: L.divIcon({
          className: "custom-pin-marker",
          html: `
            <div style="
              background: linear-gradient(135deg, #f97316 0%, #ea580c 100%);
              border: 4px solid white;
              border-radius: 50%;
              width: 36px;
              height: 36px;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 20px;
              box-shadow: 0 4px 12px rgba(0,0,0,0.3);
              animation: bounce 0.5s ease;
            ">📍</div>
            <style>
              @keyframes bounce {
                0%, 100% { transform: translateY(0); }
                50% { transform: translateY(-10px); }
              }
            </style>
          `,
          iconSize: [36, 36],
          iconAnchor: [18, 18],
        }),
      }).addTo(drawnItems);

      marker
        .bindPopup(
          `
        <div style="font-family: sans-serif; min-width: 150px;">
          <h4 style="margin: 0 0 8px 0; color: #f97316; font-size: 14px; font-weight: bold;">
            📍 Selected Location
          </h4>
          <p style="margin: 4px 0; font-size: 12px; color: #666;">
            <strong>Lat:</strong> ${lat.toFixed(5)}<br/>
            <strong>Lng:</strong> ${lng.toFixed(5)}
          </p>
        </div>
      `
        )
        .openPopup();

      // Add highlight circle (smaller)
      L.circle([lat, lng], {
        radius: 200,
        color: "#f97316",
        fillColor: "#f97316",
        fillOpacity: 0.1,
        weight: 2,
        dashArray: "5, 5",
      }).addTo(drawnItems);
    } else if (selectedLocation.type === "line") {
      const latlngs = selectedLocation.coordinates.map((c) => [c.lat, c.lng]);

      // Base line
      L.polyline(latlngs, {
        color: "#94a3b8",
        weight: 10,
        opacity: 0.3,
      }).addTo(drawnItems);

      // Highlighted line
      L.polyline(latlngs, {
        color: "#f97316",
        weight: 6,
        opacity: 0.9,
      }).addTo(drawnItems);
    } else if (selectedLocation.type === "polygon") {
      const latlngs = selectedLocation.coordinates.map((c) => [c.lat, c.lng]);
      L.polygon(latlngs, {
        color: "#f97316",
        fillColor: "#f97316",
        fillOpacity: 0.2,
        weight: 3,
      }).addTo(drawnItems);
    }

    // Fit bounds to show selection
    if (drawnItems.getLayers().length > 0) {
      map.fitBounds(drawnItems.getBounds(), { padding: [80, 80] });
    }
  }, [selectedLocation]); // Only re-run when selectedLocation changes

  return (
    <div
      className="relative bg-gray-200 rounded-lg overflow-hidden shadow-lg"
      style={{ height: isExpanded ? "70vh" : "450px" }}
    >
      <div ref={mapRef} className="w-full h-full" />

      {/* Expand/Collapse Button */}
      <button
        onClick={onExpand}
        className="absolute top-4 right-4 bg-white p-3 rounded-lg shadow-lg hover:bg-gray-50 transition z-[1000]"
        title={isExpanded ? "Collapse map" : "Expand map"}
      >
        {isExpanded ? (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-6 w-6"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M5 10a1 1 0 011-1h8a1 1 0 110 2H6a1 1 0 01-1-1z"
              clipRule="evenodd"
            />
          </svg>
        ) : (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-6 w-6"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M3 4a1 1 0 011-1h4a1 1 0 010 2H6.414l2.293 2.293a1 1 0 11-1.414 1.414L5 6.414V8a1 1 0 01-2 0V4zm9 1a1 1 0 110-2h4a1 1 0 011 1v4a1 1 0 11-2 0V6.414l-2.293 2.293a1 1 0 11-1.414-1.414L13.586 5H12zm-9 7a1 1 0 112 0v1.586l2.293-2.293a1 1 0 111.414 1.414L6.414 15H8a1 1 0 110 2H4a1 1 0 01-1-1v-4zm13-1a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 110-2h1.586l-2.293-2.293a1 1 0 111.414-1.414L15 13.586V12a1 1 0 011-1z"
              clipRule="evenodd"
            />
          </svg>
        )}
      </button>

      {/* Instructions Overlay */}
      <div className="absolute bottom-4 left-4 bg-white rounded-lg p-4 shadow-lg max-w-xs z-[1000]">
        <p className="font-bold text-gray-800 mb-2">
          {drawMode === "point" && "📍 Point Mode"}
          {drawMode === "line" && "➖ Line Mode"}
          {drawMode === "polygon" && "⬟ Area Mode"}
        </p>
        <p className="text-sm text-gray-600 mb-1">
          {drawMode === "point" &&
            "Click anywhere on the map to select a point"}
          {drawMode === "line" &&
            "Click to add points along a road. Double-click to finish."}
          {drawMode === "polygon" &&
            "Click to draw area boundary. Double-click to close the shape."}
        </p>
        {isDrawingRef.current && (
          <p className="text-xs text-orange-600 font-semibold mt-2">
            🎨 Drawing... ({drawingCoordsRef.current.length} points)
          </p>
        )}
      </div>
    </div>
  );
}
