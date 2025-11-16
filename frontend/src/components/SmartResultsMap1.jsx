"use client";

import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

export default function SmartResultsMap({ simulationResults, selectedLocation, roadInfo }) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const layersRef = useRef([]);
  const [affectedRoads, setAffectedRoads] = useState([]);

  // Fetch and filter ONLY connected/affected roads
  useEffect(() => {
    if (!selectedLocation || !simulationResults) return;

    const fetchSmartRoads = async () => {
      try {
        const center = selectedLocation.center;
        const avgSeverity = simulationResults.summary.avg_severity;

        // Calculate smart search radius based on severity
        // Heavy congestion = larger impact radius
        let searchRadius;
        if (avgSeverity >= 1.5) {
          searchRadius = 400; // Heavy: 400m radius
        } else if (avgSeverity >= 0.5) {
          searchRadius = 250; // Moderate: 250m radius
        } else {
          searchRadius = 150; // Light: 150m radius
        }

        const query = `
          [out:json][timeout:15];
          (
            way["highway"]["name"](around:${searchRadius},${center.lat},${center.lng});
          );
          out body;
          >;
          out skel qt;
        `;

        const response = await fetch('https://overpass-api.de/api/interpreter', {
          method: 'POST',
          body: query,
        });

        const data = await response.json();

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
                name: way.tags.name || 'Unnamed Road',
                type: way.tags.highway,
                lanes: parseInt(way.tags.lanes) || 2,
                coordinates: coords,
              };
            })
            .filter(way => way.coordinates.length > 1);

              // ✅ ADD DEBUG LOGS
                console.log('🔍 Total roads found from OSM:', ways.length);
                console.log('📍 Disruption center:', center);
                console.log('🎯 Average severity:', avgSeverity);
                console.log('📏 Search radius:', searchRadius);

                

          // ✅ SMART FILTERING - Only include roads that make sense
          const smartFiltered = ways.filter(way => {
            // Calculate closest point to disruption
            let minDist = Infinity;
            way.coordinates.forEach(coord => {
              const dist = getDistance(center.lat, center.lng, coord.lat, coord.lng);
              if (dist < minDist) minDist = dist;
            });

            // Filter based on severity and distance
            if (avgSeverity >= 1.5) {
              // Heavy: Show roads within 400m
              return minDist <= 400;
            } else if (avgSeverity >= 0.5) {
              // Moderate: Show roads within 250m
              return minDist <= 250;
            } else {
              // Light: Show roads within 150m
              return minDist <= 150;
            }
          });

          // ✅ PRIORITIZE - Sort by distance from disruption
          smartFiltered.sort((a, b) => {
            const distA = Math.min(...a.coordinates.map(c => 
              getDistance(center.lat, center.lng, c.lat, c.lng)
            ));
            const distB = Math.min(...b.coordinates.map(c => 
              getDistance(center.lat, center.lng, c.lat, c.lng)
            ));
            return distA - distB;
          });

          // ✅ LIMIT - Show max 8 most affected roads (including main road)
          setAffectedRoads(smartFiltered.slice(0, 8));
        }
      } catch (error) {
        console.error('Failed to fetch roads:', error);
      }
    };

    fetchSmartRoads();
  }, [selectedLocation, simulationResults]);

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

  useEffect(() => {
    if (!mapInstanceRef.current || !simulationResults || !selectedLocation) return;

    const map = mapInstanceRef.current;

    // Clear previous layers
    layersRef.current.forEach(layer => map.removeLayer(layer));
    layersRef.current = [];

    const center = selectedLocation.center;
    const avgSeverity = simulationResults.summary.avg_severity;

    // Get color by severity
    const getColorBySeverity = (severity) => {
      if (severity < 0.5) return '#22c55e';
      if (severity < 1.5) return '#fbbf24';
      return '#ef4444';
    };

    const mainColor = getColorBySeverity(avgSeverity);

    // ✅ DRAW MAIN DISRUPTED ROAD FIRST (Thickest, most prominent)
    if (roadInfo?.coordinates && roadInfo.coordinates.length > 1) {
      const roadCoords = roadInfo.coordinates.map(c => [c.lat, c.lng]);

      // Main road shadow
      const mainShadow = L.polyline(roadCoords, {
        color: '#000000',
        weight: 16,
        opacity: 0.3,
        lineCap: 'round',
      }).addTo(map);
      layersRef.current.push(mainShadow);

      // Main road base (gray)
      const mainBase = L.polyline(roadCoords, {
        color: '#9ca3af',
        weight: 12,
        opacity: 0.6,
        lineCap: 'round',
      }).addTo(map);
      layersRef.current.push(mainBase);

      // Main road congestion overlay
      const mainRoad = L.polyline(roadCoords, {
        color: mainColor,
        weight: 10,
        opacity: 1,
        lineCap: 'round',
        lineJoin: 'round',
      }).addTo(map);

      mainRoad.bindPopup(`
        <div style="font-family: -apple-system, sans-serif; padding: 10px; min-width: 200px;">
          <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px;">
            <div style="
              width: 40px; height: 40px;
              background: white;
              border: 3px solid ${mainColor};
              border-radius: 10px;
              display: flex; align-items: center; justify-content: center;
              font-size: 20px;
            ">🚧</div>
            <div>
              <h3 style="margin: 0; font-size: 14px; font-weight: 600;">
                ${roadInfo.road_name}
              </h3>
              <p style="margin: 2px 0 0 0; font-size: 11px; color: #6b7280;">
                Primary affected road
              </p>
            </div>
          </div>
          <div style="background: ${mainColor}20; border-left: 3px solid ${mainColor}; padding: 8px; border-radius: 6px; margin-bottom: 8px;">
            <p style="margin: 0; font-size: 13px; font-weight: 600; color: ${mainColor};">
              ${simulationResults.summary.avg_severity_label} Congestion
            </p>
            <p style="margin: 4px 0 0 0; font-size: 12px; color: #4b5563;">
              Avg delay: <strong>+${simulationResults.summary.avg_delay_minutes} min</strong>
            </p>
          </div>
          <div style="display: flex; gap: 8px; font-size: 11px;">
            <div style="flex: 1; text-align: center; background: #f0fdf4; padding: 4px; border-radius: 4px;">
              <div style="color: #22c55e; font-weight: 600;">${simulationResults.summary.light_percentage}%</div>
              <div style="color: #6b7280; font-size: 9px;">Light</div>
            </div>
            <div style="flex: 1; text-align: center; background: #fffbeb; padding: 4px; border-radius: 4px;">
              <div style="color: #fbbf24; font-weight: 600;">${simulationResults.summary.moderate_percentage}%</div>
              <div style="color: #6b7280; font-size: 9px;">Moderate</div>
            </div>
            <div style="flex: 1; text-align: center; background: #fef2f2; padding: 4px; border-radius: 4px;">
              <div style="color: #ef4444; font-weight: 600;">${simulationResults.summary.heavy_percentage}%</div>
              <div style="color: #6b7280; font-size: 9px;">Heavy</div>
            </div>
          </div>
        </div>
      `);

      layersRef.current.push(mainRoad);
    }

    // ✅ DRAW AFFECTED NEARBY ROADS (Google Maps style - gets lighter with distance)
    affectedRoads.forEach((road, index) => {
      // Skip if it's the same as the main road
      if (roadInfo && road.name === roadInfo.road_name) return;

      const roadCoords = road.coordinates.map(c => [c.lat, c.lng]);

      // Calculate closest distance to disruption
      const closestDist = Math.min(...road.coordinates.map(c => 
        getDistance(center.lat, center.lng, c.lat, c.lng)
      ));

      // ✅ SMART IMPACT CALCULATION
      let impactSeverity;
      let impactColor;
      let roadOpacity;
      let roadWeight;
      let impactLabel;

      if (closestDist < 100) {
        // Very close - high impact
        impactSeverity = Math.max(0, avgSeverity - 0.3);
        impactColor = getColorBySeverity(impactSeverity);
        roadOpacity = 0.9;
        roadWeight = 8;
        impactLabel = 'High Impact';
      } else if (closestDist < 200) {
        // Nearby - moderate impact
        impactSeverity = Math.max(0, avgSeverity - 0.7);
        impactColor = getColorBySeverity(impactSeverity);
        roadOpacity = 0.75;
        roadWeight = 6;
        impactLabel = 'Moderate Impact';
      } else {
        // Further away - low impact
        impactSeverity = Math.max(0, avgSeverity - 1.2);
        impactColor = getColorBySeverity(impactSeverity);
        roadOpacity = 0.6;
        roadWeight = 5;
        impactLabel = 'Low Impact';
      }

      // Shadow
      const shadow = L.polyline(roadCoords, {
        color: '#1f2937',
        weight: roadWeight + 4,
        opacity: 0.15,
        lineCap: 'round',
      }).addTo(map);
      layersRef.current.push(shadow);

      // Colored road
      const affectedRoad = L.polyline(roadCoords, {
        color: impactColor,
        weight: roadWeight,
        opacity: roadOpacity,
        lineCap: 'round',
        lineJoin: 'round',
      }).addTo(map);

      affectedRoad.bindPopup(`
        <div style="font-family: -apple-system, sans-serif; padding: 8px;">
          <h4 style="margin: 0 0 6px 0; font-size: 13px; font-weight: 600;">
            ${road.name}
          </h4>
          <div style="background: ${impactColor}20; border-left: 3px solid ${impactColor}; padding: 6px; border-radius: 4px; margin-bottom: 6px;">
            <p style="margin: 0; font-size: 12px; font-weight: 600; color: ${impactColor};">
              ${impactLabel}
            </p>
          </div>
          <p style="margin: 4px 0; font-size: 11px; color: #6b7280;">
            <strong>Distance:</strong> ${closestDist.toFixed(0)}m from disruption
          </p>
          <p style="margin: 4px 0; font-size: 11px; color: #6b7280;">
            <strong>Type:</strong> ${road.type}
          </p>
        </div>
      `);

      layersRef.current.push(affectedRoad);
    });

    // ✅ DISRUPTION EPICENTER with pulsing animation
    const epicenter = L.marker([center.lat, center.lng], {
      icon: L.divIcon({
        className: 'disruption-epicenter',
        html: `
          <div style="position: relative;">
            <div class="pulse-ring" style="
              position: absolute;
              top: 50%; left: 50%;
              transform: translate(-50%, -50%);
              width: 60px; height: 60px;
              border: 3px solid ${mainColor};
              border-radius: 50%;
              animation: pulse 2s ease-out infinite;
            "></div>
            <div style="
              background: white;
              border: 4px solid ${mainColor};
              border-radius: 50%;
              width: 50px; height: 50px;
              display: flex; align-items: center; justify-content: center;
              font-size: 26px;
              box-shadow: 0 6px 20px rgba(0,0,0,0.3);
              position: relative; z-index: 10;
            ">🚧</div>
            <style>
              @keyframes pulse {
                0% { transform: translate(-50%, -50%) scale(1); opacity: 0.5; }
                100% { transform: translate(-50%, -50%) scale(2); opacity: 0; }
              }
            </style>
          </div>
        `,
        iconSize: [50, 50],
        iconAnchor: [25, 25],
      })
    }).addTo(map);

    epicenter.bindPopup(`
      <div style="font-family: -apple-system, sans-serif; padding: 10px;">
        <h3 style="margin: 0 0 10px 0; font-size: 15px; font-weight: 600;">
          🚧 Disruption Center
        </h3>
        <p style="margin: 4px 0; font-size: 12px;">
          <strong>Type:</strong> ${simulationResults.input.disruption_type}
        </p>
        <p style="margin: 4px 0; font-size: 12px;">
          <strong>Area:</strong> ${simulationResults.input.area}
        </p>
        <p style="margin: 4px 0; font-size: 12px;">
          <strong>Duration:</strong> ${simulationResults.summary.total_hours}h (${simulationResults.summary.duration_days} days)
        </p>
      </div>
    `);

    layersRef.current.push(epicenter);

    // Fit map to show all affected roads
    const allCoords = [];
    if (roadInfo?.coordinates) {
      allCoords.push(...roadInfo.coordinates.map(c => [c.lat, c.lng]));
    }
    affectedRoads.forEach(road => {
      allCoords.push(...road.coordinates.map(c => [c.lat, c.lng]));
    });

    if (allCoords.length > 0) {
      map.fitBounds(L.latLngBounds(allCoords), { padding: [60, 60] });
    } else {
      map.setView([center.lat, center.lng], 15);
    }

  }, [simulationResults, selectedLocation, roadInfo, affectedRoads]);

  return (
    <div className="relative bg-gray-50 rounded-xl overflow-hidden shadow-lg" style={{ height: '550px' }}>
      <div ref={mapRef} className="w-full h-full" />
      
      {/* Smart Legend */}
      {simulationResults && (
        <div className="absolute bottom-6 right-6 bg-white rounded-xl p-5 shadow-xl z-[1000] border border-gray-100">
          <h4 className="font-bold text-gray-800 mb-3 text-sm flex items-center gap-2">
            <span className="text-lg">🎯</span>
            Impact Zones
          </h4>
          <div className="space-y-2.5">
            <div className="flex items-center gap-3 text-sm">
              <div className="flex items-center">
                <div className="w-8 h-1.5 bg-red-500 rounded-l-full"></div>
                <div className="w-6 h-1.5 bg-red-400 opacity-70"></div>
                <div className="w-4 h-1.5 bg-yellow-400 opacity-50 rounded-r-full"></div>
              </div>
              <span className="text-gray-700">Spreading congestion</span>
            </div>
            <div className="text-xs text-gray-600 bg-gray-50 p-2 rounded">
              <strong>Thicker lines</strong> = closer to disruption
            </div>
          </div>
        </div>
      )}

      {/* Info Banner */}
      <div className="absolute top-6 left-6 bg-white rounded-xl px-5 py-3 shadow-lg z-[1000] border border-gray-100">
        <p className="text-sm font-semibold text-gray-800 flex items-center gap-2">
          <span className="text-lg">📊</span>
          Smart Impact Analysis
        </p>
        {affectedRoads.length > 0 && (
          <p className="text-xs text-gray-600 mt-1">
            Showing {affectedRoads.length + 1} affected road{affectedRoads.length > 0 ? 's' : ''}
          </p>
        )}
      </div>
    </div>
  );
}

// Helper function
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

  return R * c; // Distance in meters
}



