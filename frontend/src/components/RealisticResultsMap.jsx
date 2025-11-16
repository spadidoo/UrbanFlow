"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

export default function RealisticResultsMap({ simulationResults, selectedLocation, roadInfo }) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const layersRef = useRef([]);

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const map = L.map(mapRef.current, {
      center: [14.2096, 121.164],
      zoom: 14,
      zoomControl: true,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; OpenStreetMap',
      maxZoom: 19,
    }).addTo(map);

    mapInstanceRef.current = map;

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!mapInstanceRef.current || !simulationResults || !selectedLocation) return;

    const map = mapInstanceRef.current;

    // Clear previous layers
    layersRef.current.forEach(layer => map.removeLayer(layer));
    layersRef.current = [];

    const center = selectedLocation.center;
    const avgSeverity = simulationResults.summary.avg_severity;

    // Color mapping
    const getColor = (severity) => {
      if (severity < 0.5) return '#22c55e';   // Green
      if (severity < 1.5) return '#f59e0b';   // Orange
      return '#ef4444';                       // Red
    };

    const getLabel = (severity) => {
      if (severity < 0.5) return 'Light';
      if (severity < 1.5) return 'Moderate';
      return 'Heavy';
    };

    const mainColor = getColor(avgSeverity);

    // === MAIN AFFECTED ROAD ONLY ===
    if (roadInfo?.coordinates && roadInfo.coordinates.length > 1) {
      const roadCoords = roadInfo.coordinates.map(c => [c.lat, c.lng]);

      // Shadow layer
      const shadow = L.polyline(roadCoords, {
        color: '#1f2937',
        weight: 14,
        opacity: 0.2,
        lineCap: 'round',
        lineJoin: 'round'
      }).addTo(map);
      layersRef.current.push(shadow);

      // Base road (gray)
      const base = L.polyline(roadCoords, {
        color: '#9ca3af',
        weight: 10,
        opacity: 0.5,
        lineCap: 'round',
        lineJoin: 'round'
      }).addTo(map);
      layersRef.current.push(base);

      // Congestion overlay (colored)
      const congestion = L.polyline(roadCoords, {
        color: mainColor,
        weight: 8,
        opacity: 0.95,
        lineCap: 'round',
        lineJoin: 'round'
      }).addTo(map);

      congestion.bindPopup(`
        <div style="font-family: -apple-system, sans-serif; padding: 10px; min-width: 220px;">
          <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px;">
            <div style="
              width: 44px;
              height: 44px;
              background: white;
              border: 3px solid ${mainColor};
              border-radius: 12px;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 22px;
            ">🚧</div>
            <div>
              <h3 style="margin: 0; font-size: 15px; font-weight: 600; color: #1f2937;">
                ${roadInfo.road_name || 'Road'}
              </h3>
              <p style="margin: 2px 0 0 0; font-size: 11px; color: #6b7280;">
                ${roadInfo.road_type} • ${roadInfo.lanes} lane${roadInfo.lanes > 1 ? 's' : ''}
              </p>
            </div>
          </div>
          
          <div style="
            background: ${mainColor}15;
            border-left: 3px solid ${mainColor};
            padding: 8px;
            border-radius: 6px;
            margin-bottom: 10px;
          ">
            <p style="margin: 0; font-size: 13px; font-weight: 600; color: ${mainColor};">
              ${getLabel(avgSeverity)} Congestion
            </p>
            <p style="margin: 4px 0 0 0; font-size: 12px; color: #4b5563;">
              Avg delay: <strong>+${simulationResults.summary.avg_delay_minutes} min</strong>
            </p>
          </div>

          <div style="
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 6px;
            font-size: 11px;
            text-align: center;
          ">
            <div style="background: #f0fdf4; padding: 6px; border-radius: 6px;">
              <div style="color: #22c55e; font-weight: 600; font-size: 14px;">
                ${simulationResults.summary.light_percentage}%
              </div>
              <div style="color: #6b7280; font-size: 10px;">Light</div>
            </div>
            <div style="background: #fffbeb; padding: 6px; border-radius: 6px;">
              <div style="color: #f59e0b; font-weight: 600; font-size: 14px;">
                ${simulationResults.summary.moderate_percentage}%
              </div>
              <div style="color: #6b7280; font-size: 10px;">Moderate</div>
            </div>
            <div style="background: #fef2f2; padding: 6px; border-radius: 6px;">
              <div style="color: #ef4444; font-weight: 600; font-size: 14px;">
                ${simulationResults.summary.heavy_percentage}%
              </div>
              <div style="color: #6b7280; font-size: 10px;">Heavy</div>
            </div>
          </div>
        </div>
      `, {
        maxWidth: 280,
        className: 'custom-popup'
      });

      layersRef.current.push(congestion);

      // === DISRUPTION MARKER ===
      const disruption = L.marker([center.lat, center.lng], {
        icon: L.divIcon({
          className: 'disruption-icon',
          html: `
            <div style="position: relative;">
              <div style="
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                width: 60px;
                height: 60px;
                border: 3px solid ${mainColor};
                border-radius: 50%;
                opacity: 0.4;
                animation: pulse 2s ease-out infinite;
              "></div>
              <div style="
                background: white;
                border: 4px solid ${mainColor};
                border-radius: 50%;
                width: 48px;
                height: 48px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 24px;
                box-shadow: 0 6px 20px rgba(0,0,0,0.25);
                position: relative;
                z-index: 10;
              ">🚧</div>
              <style>
                @keyframes pulse {
                  0% { transform: translate(-50%, -50%) scale(1); opacity: 0.4; }
                  100% { transform: translate(-50%, -50%) scale(2); opacity: 0; }
                }
              </style>
            </div>
          `,
          iconSize: [48, 48],
          iconAnchor: [24, 24],
        })
      }).addTo(map);

      disruption.bindPopup(`
        <div style="font-family: -apple-system, sans-serif; padding: 10px;">
          <h3 style="margin: 0 0 10px 0; font-size: 16px; font-weight: 600; color: #1f2937;">
            Disruption Epicenter
          </h3>
          <div style="background: #f9fafb; padding: 8px; border-radius: 8px; font-size: 12px;">
            <p style="margin: 4px 0;"><strong>Type:</strong> ${simulationResults.input.disruption_type}</p>
            <p style="margin: 4px 0;"><strong>Area:</strong> ${simulationResults.input.area}</p>
            <p style="margin: 4px 0;"><strong>Duration:</strong> ${simulationResults.summary.duration_days} days</p>
            <p style="margin: 4px 0;"><strong>Total:</strong> ${simulationResults.summary.total_hours} hours</p>
          </div>
        </div>
      `);

      layersRef.current.push(disruption);

      // Fit bounds
      map.fitBounds(L.latLngBounds(roadCoords), { padding: [60, 60] });

    } else {
      // Fallback point visualization
      const marker = L.marker([center.lat, center.lng], {
        icon: L.divIcon({
          html: `<div style="background: white; border: 4px solid ${mainColor}; border-radius: 50%; width: 48px; height: 48px; display: flex; align-items: center; justify-content: center; font-size: 24px; box-shadow: 0 4px 12px rgba(0,0,0,0.3);">🚧</div>`,
          iconSize: [48, 48],
          iconAnchor: [24, 24],
        })
      }).addTo(map);

      layersRef.current.push(marker);

      // Simple impact zone
      const zone = L.circle([center.lat, center.lng], {
        radius: 400,
        color: mainColor,
        fillColor: mainColor,
        fillOpacity: 0.15,
        weight: 3,
        dashArray: '8, 4'
      }).addTo(map);

      layersRef.current.push(zone);
      map.setView([center.lat, center.lng], 15);
    }

  }, [simulationResults, selectedLocation, roadInfo]);

  return (
    <div className="relative bg-gray-50 rounded-xl overflow-hidden shadow-lg" style={{ height: '550px' }}>
      <div ref={mapRef} className="w-full h-full" />
      
      {/* Legend */}
      {simulationResults && (
        <div className="absolute bottom-6 right-6 bg-white rounded-xl p-5 shadow-xl z-[1000] border border-gray-100">
          <h4 className="font-bold text-gray-800 mb-3 text-sm flex items-center gap-2">
            <span className="text-lg">🚦</span>
            Traffic Levels
          </h4>
          <div className="space-y-2.5">
            <div className="flex items-center gap-3">
              <div className="w-5 h-1 bg-green-500 rounded-full"></div>
              <span className="text-sm text-gray-700">Light</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-5 h-1 bg-orange-500 rounded-full"></div>
              <span className="text-sm text-gray-700">Moderate</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-5 h-1 bg-red-500 rounded-full"></div>
              <span className="text-sm text-gray-700">Heavy</span>
            </div>
          </div>
        </div>
      )}

      {/* Info */}
      <div className="absolute top-6 left-6 bg-white rounded-xl px-5 py-3 shadow-lg z-[1000] border border-gray-100">
        <p className="text-sm font-semibold text-gray-800 flex items-center gap-2">
          <span className="text-lg">📊</span>
          Predicted Impact
        </p>
        {simulationResults && (
          <p className="text-xs text-gray-600 mt-1">
            {simulationResults.summary.total_hours}h disruption • Avg +{simulationResults.summary.avg_delay_minutes} min delay
          </p>
        )}
      </div>
    </div>
  );
}