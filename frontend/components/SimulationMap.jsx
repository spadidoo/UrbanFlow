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

    // Clear drawn items only if changing modes
    if (!selectedLocation || drawMode !== selectedLocation.type) {
      drawnItems.clearLayers();
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

        // Add visible marker with custom icon
        const marker = L.marker([e.latlng.lat, e.latlng.lng], {
          icon: L.divIcon({
            className: "custom-pin",
            html: `
              <div style="
                background: linear-gradient(135deg, #f97316 0%, #ea580c 100%);
                border: 3px solid white;
                border-radius: 50%;
                width: 32px;
                height: 32px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 20px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.4);
                cursor: pointer;
              ">📍</div>
            `,
            iconSize: [32, 32],
            iconAnchor: [16, 16],
          }),
        }).addTo(drawnItems);

        marker
          .bindPopup(
            `
          <div style="font-family: sans-serif; padding: 4px;">
            <strong style="color: #f97316;">Selected Location</strong><br/>
            <small style="color: #666;">
              Lat: ${e.latlng.lat.toFixed(5)}<br/>
              Lng: ${e.latlng.lng.toFixed(5)}
            </small>
          </div>
        `
          )
          .openPopup();

        // Add pulsing circle animation
        L.circle([e.latlng.lat, e.latlng.lng], {
          radius: 250,
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

    // === LINE MODE (POINT TO POINT) ===
    else if (drawMode === "line") {
      const handleClick = (e) => {
        const coords = drawingCoordsRef.current;

        // ✅ LIMIT TO 2 POINTS MAXIMUM
        if (coords.length >= 2) {
          return; // Ignore clicks after 2 points
        }

        // Add point
        coords.push(e.latlng);
        drawingCoordsRef.current = coords;
        isDrawingRef.current = true;

        // Add visual marker
        const marker = L.circleMarker([e.latlng.lat, e.latlng.lng], {
          radius: 6,
          color: "#f97316",
          fillColor: "#fff",
          fillOpacity: 1,
          weight: 3,
        }).addTo(drawnItems);

        tempMarkersRef.current.push(marker);

        // Remove old temporary line
        if (tempLineRef.current) {
          drawnItems.removeLayer(tempLineRef.current);
        }

        // Draw temporary line if we have 2 points
        if (coords.length === 2) {
          tempLineRef.current = L.polyline(coords, {
            color: "#f97316",
            weight: 4,
            opacity: 0.7,
            dashArray: "10, 10",
          }).addTo(drawnItems);
        }

        // ✅ AUTO-FINALIZE AFTER 2ND POINT (no double-click needed)
        if (coords.length === 2) {
          // Small delay to show the line before finalizing
          setTimeout(() => {
            // Remove temporary elements
            tempMarkersRef.current.forEach((m) => drawnItems.removeLayer(m));
            if (tempLineRef.current) {
              drawnItems.removeLayer(tempLineRef.current);
            }

            // Draw final line
            // Base line (wider, lighter)
            L.polyline(coords, {
              color: "#94a3b8",
              weight: 10,
              opacity: 0.3,
            }).addTo(drawnItems);

            // Main line (narrower, brighter)
            const finalLayer = L.polyline(coords, {
              color: "#f97316",
              weight: 6,
              opacity: 0.9,
            }).addTo(drawnItems);

            // Add buffer zone visualization
            L.polyline(coords, {
              color: "#f97316",
              weight: 20,
              opacity: 0.1,
            }).addTo(drawnItems);

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
          }, 200); // 200ms delay to show the dashed line briefly
        }
      };

      // Only need click handler now (auto-finalize at 2 points)
      map.on("click", handleClick);
    }

    // Cleanup function
    return () => {
      map.off("click");
      //map.off("dblclick");
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

    // ✅ FIX: Check if we already have the SAME location displayed
    if (hasMarker && selectedLocation.type === "point") {
      // Get the current marker position
      const marker = currentLayers.find(layer => layer instanceof L.Marker);
      if (marker) {
        const markerPos = marker.getLatLng();
        const { lat, lng } = selectedLocation.center;
        
        // If same location (within 0.0001 degrees ~11 meters), don't redraw
        if (Math.abs(markerPos.lat - lat) < 0.0001 && 
            Math.abs(markerPos.lng - lng) < 0.0001) {
          return; // ← PREVENTS CLEARING WHEN ROAD INFO LOADS
        }
      }
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

      // Add highlight circle
      L.circle([lat, lng], {
        radius: 250,
        color: "#f97316",
        fillColor: "#f97316",
        fillOpacity: 0.1,
        weight: 2,
        dashArray: "5, 5",
      }).addTo(drawnItems);

      // Center map on the point
      map.setView([lat, lng], 15);
    } else if (selectedLocation.type === "line") {
      const latlngs = selectedLocation.coordinates.map((c) => [c.lat, c.lng]);

      // Base line (wider, lighter)
      L.polyline(latlngs, {
        color: "#94a3b8",
        weight: 10,
        opacity: 0.3,
      }).addTo(drawnItems);

      // Highlighted line
      const mainLine = L.polyline(latlngs, {
        color: "#f97316",
        weight: 6,
        opacity: 0.9,
      }).addTo(drawnItems);

      // Buffer zone
      L.polyline(latlngs, {
        color: "#f97316",
        weight: 20,
        opacity: 0.1,
      }).addTo(drawnItems);

      // Fit bounds to show the line
      map.fitBounds(mainLine.getBounds(), { padding: [80, 80] });
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
      <div className="absolute bottom-4 left-4 bg-white rounded-lg p-4 shadow-lg max-w-sm z-[1000]">
        <p className="font-bold text-gray-800 mb-2">
          {drawMode === "point" && "📍 Point Selection Mode"}
          {drawMode === "line" && "➖ Point to Point Mode"}
        </p>
        <p className="text-sm text-gray-600 mb-1">
          {drawMode === "point" &&
            "Click anywhere on the map to select a disruption point"}
          {drawMode === "line" &&
            "Click to add points along the road segment. Double-click to finish selecting the line."}
        </p>
        {isDrawingRef.current && (
          <p className="text-xs text-orange-600 font-semibold mt-2">
            🎨 Drawing... ({drawingCoordsRef.current.length} points added)
          </p>
        )}
      </div>
    </div>
  );
}
