"use client";

import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

export default function SmartResultsMap({ simulationResults, selectedLocation, roadInfo }) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const layersRef = useRef([]);
  const [nearbyRoads, setNearbyRoads] = useState([]);

  // ========================================
  // SECTION 1: FETCH NEARBY ROADS
  // ========================================
  useEffect(() => {
    if (!selectedLocation || !simulationResults) return;

    const fetchNearbyRoads = async () => {
      try {
        const center = selectedLocation.center;
        const avgSeverity = simulationResults.summary.avg_severity;

        // Simple: Just get ALL roads within 500m
        const searchRadius = 500;

        const query = `
          [out:json][timeout:15];
          (
            way["highway"](around:${searchRadius},${center.lat},${center.lng});
          );
          out body;
          >;
          out skel qt;
        `;

        console.log('🔍 Fetching roads around:', center);
        console.log('📏 Search radius:', searchRadius + 'm');

        const response = await fetch('https://overpass-api.de/api/interpreter', {
          method: 'POST',
          body: query,
        });

        const data = await response.json();

        console.log('📦 OSM returned elements:', data.elements?.length || 0);

        if (data.elements) {
          const nodes = data.elements.filter(el => el.type === 'node');
          const ways = data.elements
            .filter(el => el.type === 'way' && el.tags && el.tags.highway)
            .map(way => {
              const coords = way.nodes
                .map(nodeId => nodes.find(n => n.id === nodeId))
                .filter(n => n)
                .map(n => ({ lat: n.lat, lng: n.lon }));

              return {
                id: way.id,
                name: way.tags.name || `${way.tags.highway} road`,
                type: way.tags.highway,
                lanes: parseInt(way.tags.lanes) || 2,
                coordinates: coords,
              };
            })
            .filter(way => way.coordinates.length > 1);

          console.log('🛣️ Valid roads found:', ways.length);

          // Calculate distance for each road
          const roadsWithDistance = ways.map(road => {
            const distances = road.coordinates.map(coord => 
              getDistance(center.lat, center.lng, coord.lat, coord.lng)
            );
            const minDist = Math.min(...distances);

            return {
              ...road,
              minDist,
            };
          });

          // Keep roads within radius, sorted by distance
          const filtered = roadsWithDistance
            .filter(road => road.minDist <= searchRadius)
            .sort((a, b) => a.minDist - b.minDist)
            .slice(0, 15); // Top 15 closest roads

          console.log('✅ Showing roads:', filtered.map(r => ({
            name: r.name,
            distance: Math.round(r.minDist) + 'm',
            type: r.type
          })));

          setNearbyRoads(filtered);
        }
      } catch (error) {
        console.error('❌ Error fetching roads:', error);
      }
    };

    fetchNearbyRoads();
  }, [selectedLocation, simulationResults]);

  // ========================================
  // SECTION 2: INITIALIZE MAP (runs once)
  // ========================================
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const map = L.map(mapRef.current, {
      center: [14.2096, 121.164],
      zoom: 15,
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

  // ========================================
  // SECTION 3: DRAW ROADS ON MAP
  // ========================================
  useEffect(() => {
    if (!mapInstanceRef.current || !simulationResults || !selectedLocation) return;

    const map = mapInstanceRef.current;

    // Clear old layers
    layersRef.current.forEach(layer => map.removeLayer(layer));
    layersRef.current = [];

    const center = selectedLocation.center;
    const avgSeverity = simulationResults.summary.avg_severity;

    // Color function
    const getSeverityColor = (severity) => {
      if (severity < 0.5) return '#22c55e'; // Green
      if (severity < 1.5) return '#fbbf24'; // Yellow
      return '#ef4444'; // Red
    };

    const mainColor = getSeverityColor(avgSeverity);

    console.log('🎨 Drawing', nearbyRoads.length, 'roads on map');

    // ========================================
    // DRAW ALL NEARBY ROADS FIRST
    // ========================================
    nearbyRoads.forEach((road, index) => {
      // Skip if it's the main road (we'll draw it later on top)
      if (roadInfo && road.name === roadInfo.road_name) {
        console.log('⏭️ Skipping main road:', road.name);
        return;
      }

      const roadCoords = road.coordinates.map(c => [c.lat, c.lng]);
      const dist = road.minDist;

      // Calculate impact based on distance
      let impactSeverity;
      let impactColor;
      let roadOpacity;
      let roadWeight;
      let impactLabel;

      if (dist < 100) {
        impactSeverity = avgSeverity * 0.9;
        impactColor = getSeverityColor(impactSeverity);
        roadOpacity = 0.85;
        roadWeight = 9;
        impactLabel = 'Very High Impact';
      } else if (dist < 200) {
        impactSeverity = avgSeverity * 0.7;
        impactColor = getSeverityColor(impactSeverity);
        roadOpacity = 0.75;
        roadWeight = 7;
        impactLabel = 'High Impact';
      } else if (dist < 350) {
        impactSeverity = avgSeverity * 0.5;
        impactColor = getSeverityColor(impactSeverity);
        roadOpacity = 0.65;
        roadWeight = 6;
        impactLabel = 'Moderate Impact';
      } else {
        impactSeverity = avgSeverity * 0.3;
        impactColor = getSeverityColor(impactSeverity);
        roadOpacity = 0.55;
        roadWeight = 5;
        impactLabel = 'Low Impact';
      }

      console.log('  🛣️', road.name, '→', Math.round(dist) + 'm →', impactLabel);

      // Shadow
      const shadow = L.polyline(roadCoords, {
        color: '#1f2937',
        weight: roadWeight + 4,
        opacity: 0.15,
        lineCap: 'round',
      }).addTo(map);
      layersRef.current.push(shadow);

      // Gray base
      const base = L.polyline(roadCoords, {
        color: '#9ca3af',
        weight: roadWeight + 2,
        opacity: 0.3,
        lineCap: 'round',
      }).addTo(map);
      layersRef.current.push(base);

      // Colored line
      const line = L.polyline(roadCoords, {
        color: impactColor,
        weight: roadWeight,
        opacity: roadOpacity,
        lineCap: 'round',
        lineJoin: 'round',
      }).addTo(map);

      line.bindPopup(`
        <div style="font-family: sans-serif; padding: 8px;">
          <h4 style="margin: 0 0 6px 0; font-size: 13px; font-weight: 600;">
            ${road.name}
          </h4>
          <div style="background: ${impactColor}20; border-left: 3px solid ${impactColor}; padding: 6px; border-radius: 4px;">
            <p style="margin: 0; font-size: 12px; font-weight: 600; color: ${impactColor};">
              ${impactLabel}
            </p>
            <p style="margin: 4px 0 0 0; font-size: 11px; color: #666;">
              ${Math.round(dist)}m from disruption
            </p>
          </div>
        </div>
      `);

      layersRef.current.push(line);
    });

    // ========================================
    // DRAW MAIN ROAD (on top, thickest)
    // ========================================
    if (roadInfo?.coordinates && roadInfo.coordinates.length > 1) {
      const roadCoords = roadInfo.coordinates.map(c => [c.lat, c.lng]);

      console.log('🚧 Drawing main road:', roadInfo.road_name);

      const mainShadow = L.polyline(roadCoords, {
        color: '#000000',
        weight: 18,
        opacity: 0.25,
        lineCap: 'round',
      }).addTo(map);
      layersRef.current.push(mainShadow);

      const mainBase = L.polyline(roadCoords, {
        color: '#9ca3af',
        weight: 14,
        opacity: 0.6,
        lineCap: 'round',
      }).addTo(map);
      layersRef.current.push(mainBase);

      const mainRoad = L.polyline(roadCoords, {
        color: mainColor,
        weight: 12,
        opacity: 1,
        lineCap: 'round',
        lineJoin: 'round',
      }).addTo(map);

      mainRoad.bindPopup(`
        <div style="font-family: sans-serif; padding: 10px;">
          <h3 style="margin: 0 0 8px 0; font-size: 15px; font-weight: 600;">
            🚧 ${roadInfo.road_name}
          </h3>
          <div style="background: ${mainColor}20; border-left: 3px solid ${mainColor}; padding: 8px; border-radius: 4px;">
            <p style="margin: 0; font-size: 13px; font-weight: 600; color: ${mainColor};">
              ${simulationResults.summary.avg_severity_label} Congestion
            </p>
            <p style="margin: 4px 0 0 0; font-size: 12px;">
              Avg delay: +${simulationResults.summary.avg_delay_minutes} min
            </p>
          </div>
        </div>
      `);

      layersRef.current.push(mainRoad);
    }

    // ========================================
    // DRAW DISRUPTION CENTER MARKER
    // ========================================
    const epicenter = L.marker([center.lat, center.lng], {
      icon: L.divIcon({
        html: `
          <div style="position: relative;">
            <div style="
              position: absolute; top: 50%; left: 50%;
              transform: translate(-50%, -50%);
              width: 70px; height: 70px;
              border: 3px solid ${mainColor};
              border-radius: 50%;
              animation: pulse 2s ease-out infinite;
            "></div>
            <div style="
              background: white;
              border: 4px solid ${mainColor};
              border-radius: 50%;
              width: 52px; height: 52px;
              display: flex; align-items: center; justify-content: center;
              font-size: 28px;
              box-shadow: 0 8px 24px rgba(0,0,0,0.35);
              position: relative; z-index: 10;
            ">🚧</div>
            <style>
              @keyframes pulse {
                0% { transform: translate(-50%, -50%) scale(1); opacity: 0.6; }
                100% { transform: translate(-50%, -50%) scale(2.2); opacity: 0; }
              }
            </style>
          </div>
        `,
        iconSize: [52, 52],
        iconAnchor: [26, 26],
      })
    }).addTo(map);

    epicenter.bindPopup(`
      <div style="font-family: sans-serif; padding: 10px;">
        <h3 style="margin: 0 0 8px 0; font-size: 16px; font-weight: 600;">
          Disruption Center
        </h3>
        <p style="margin: 4px 0; font-size: 12px;">
          <strong>Type:</strong> ${simulationResults.input.disruption_type}
        </p>
        <p style="margin: 4px 0; font-size: 12px;">
          <strong>Affected roads:</strong> ${nearbyRoads.length + 1}
        </p>
      </div>
    `);

    layersRef.current.push(epicenter);

    // Fit map to show everything
    const allCoords = [];
    if (roadInfo?.coordinates) {
      allCoords.push(...roadInfo.coordinates.map(c => [c.lat, c.lng]));
    }
    nearbyRoads.forEach(road => {
      allCoords.push(...road.coordinates.map(c => [c.lat, c.lng]));
    });

    if (allCoords.length > 0) {
      map.fitBounds(L.latLngBounds(allCoords), { padding: [50, 50] });
    } else {
      map.setView([center.lat, center.lng], 15);
    }

  }, [simulationResults, selectedLocation, roadInfo, nearbyRoads]);

  // ========================================
  // SECTION 4: RENDER MAP HTML
  // ========================================
  return (
    <div className="relative bg-gray-50 rounded-xl overflow-hidden shadow-lg" style={{ height: '550px' }}>
      <div ref={mapRef} className="w-full h-full" />
      
      {/* Legend */}
      {simulationResults && (
        <div className="absolute bottom-6 right-6 bg-white rounded-xl p-5 shadow-xl z-[1000]">
          <h4 className="font-bold text-gray-800 mb-3 text-sm">Impact Zones</h4>
          <div className="space-y-2">
            <div className="flex items-center gap-3 text-xs">
              <div className="w-8 h-1.5 bg-red-500 rounded-full"></div>
              <span>&lt;100m</span>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <div className="w-7 h-1.5 bg-yellow-500 rounded-full"></div>
              <span>100-200m</span>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <div className="w-6 h-1.5 bg-yellow-400 rounded-full"></div>
              <span>200-350m</span>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <div className="w-5 h-1.5 bg-green-400 rounded-full"></div>
              <span>350m+</span>
            </div>
          </div>
        </div>
      )}

      {/* Info */}
      <div className="absolute top-6 left-6 bg-white rounded-xl px-5 py-3 shadow-lg z-[1000]">
        <p className="text-sm font-semibold text-gray-800">
          📊 Impact Prediction
        </p>
        {nearbyRoads.length > 0 && (
          <p className="text-xs text-gray-600 mt-1">
            {nearbyRoads.length + 1} roads affected
          </p>
        )}
      </div>
    </div>
  );
}

// ========================================
// HELPER FUNCTION: Calculate distance
// ========================================
function getDistance(lat1, lng1, lat2, lng2) {
  const R = 6371e3; // Earth radius in meters
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lng2 - lng1) * Math.PI / 180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
          Math.cos(φ1) * Math.cos(φ2) *
          Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  return R * c; // meters
}

