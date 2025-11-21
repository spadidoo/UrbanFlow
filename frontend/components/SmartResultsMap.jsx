// frontend/components/SmartResultsMap.jsx - FIXED VERSION
// Replace your ENTIRE SmartResultsMap.jsx with this

"use client";

import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

export default function SmartResultsMap({ simulationResults, selectedLocation, roadInfo }) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const layersRef = useRef([]);
  const [nearbyRoads, setNearbyRoads] = useState([]);
  const [loading, setLoading] = useState(true);

  // ========================================
  // SECTION 1: FETCH NEARBY ROADS - FIXED
  // ========================================
  useEffect(() => {
    if (!selectedLocation || !simulationResults) return;

    const fetchNearbyRoads = async () => {
      setLoading(true);
      try {
        const center = selectedLocation.center;
        const avgSeverity = simulationResults.summary.avg_severity;

        // ✅ INCREASED RADIUS - Show more roads
        const searchRadius = 600; // Increased from 500m to 600m

        const query = `
          [out:json][timeout:25];
          (
            way["highway"~"^(motorway|trunk|primary|secondary|tertiary|residential|unclassified)$"](around:${searchRadius},${center.lat},${center.lng});
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
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          }
        });

        // ✅ FIXED: Don't throw error, use fallback instead
        if (!response.ok) {
          console.warn('⚠️ OSM API unavailable (status: ' + response.status + '), showing main road only');
          setNearbyRoads([]);
          setLoading(false);
          return;
        }

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

          // ✅ SMARTER FILTERING - Keep more roads
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

          // ✅ KEEP MORE ROADS - Filter less aggressively
          const filtered = roadsWithDistance
            .filter(road => {
              // Keep roads within 600m
              if (road.minDist > searchRadius) return false;
              
              // Exclude if it's the exact same main road
              if (roadInfo && road.name === roadInfo.road_name && road.minDist < 50) {
                return false;
              }
              
              return true;
            })
            .sort((a, b) => a.minDist - b.minDist)
            .slice(0, 20); // Increased from 15 to 20 roads

          console.log('✅ Showing roads:', filtered.map(r => ({
            name: r.name,
            distance: Math.round(r.minDist) + 'm',
            type: r.type
          })));

          setNearbyRoads(filtered);
        } else {
          // No elements returned
          console.log('ℹ️ No road elements in response');
          setNearbyRoads([]);
        }
      } catch (error) {
        console.error('❌ Error fetching roads:', error);
        // ✅ Set empty array on error instead of crashing
        setNearbyRoads([]);
      } finally {
        setLoading(false);
      }
    };

    fetchNearbyRoads();
  }, [selectedLocation, simulationResults, roadInfo]);

  // ========================================
  // SECTION 2: INITIALIZE MAP
  // ========================================
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const map = L.map(mapRef.current, {
      center: [14.2096, 121.164],
      zoom: 14, // Slightly zoomed out to show more area
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
  // SECTION 3: DRAW ROADS - FIXED
  // ========================================
  useEffect(() => {
    if (!mapInstanceRef.current || !simulationResults || !selectedLocation) return;
    if (loading) return; // Wait for roads to load

    const map = mapInstanceRef.current;

    // Clear old layers
    layersRef.current.forEach(layer => map.removeLayer(layer));
    layersRef.current = [];

    const center = selectedLocation.center;
    const avgSeverity = simulationResults.summary.avg_severity;

    // Color function
    const getSeverityColor = (severity) => {
      if (severity < 0.5) return '#22c55e'; // Green
      if (severity < 1.5) return '#fbbf24'; // Yellow/Orange
      return '#ef4444'; // Red
    };

    const mainColor = getSeverityColor(avgSeverity);

    console.log('🎨 Drawing roads on map...');
    console.log('   Main road:', roadInfo?.road_name || 'Unknown');
    console.log('   Nearby roads:', nearbyRoads.length);

    // ========================================
    // DRAW NEARBY ROADS FIRST (underneath)
    // ========================================
    nearbyRoads.forEach((road, index) => {
      const roadCoords = road.coordinates.map(c => [c.lat, c.lng]);
      const dist = road.minDist;

      // ✅ IMPROVED IMPACT CALCULATION
      let impactSeverity;
      let impactColor;
      let roadOpacity;
      let roadWeight;
      let impactLabel;

      // Based on distance from disruption
      if (dist < 150) {
        // Very close - high impact
        impactSeverity = avgSeverity * 0.85;
        impactColor = getSeverityColor(impactSeverity);
        roadOpacity = 0.9;
        roadWeight = 7;
        impactLabel = 'High Impact';
      } else if (dist < 300) {
        // Near - moderate impact
        impactSeverity = avgSeverity * 0.65;
        impactColor = getSeverityColor(impactSeverity);
        roadOpacity = 0.8;
        roadWeight = 6;
        impactLabel = 'Moderate Impact';
      } else if (dist < 450) {
        // Medium distance - some impact
        impactSeverity = avgSeverity * 0.45;
        impactColor = getSeverityColor(impactSeverity);
        roadOpacity = 0.7;
        roadWeight = 5;
        impactLabel = 'Low-Medium Impact';
      } else {
        // Far - minimal impact
        impactSeverity = avgSeverity * 0.25;
        impactColor = getSeverityColor(impactSeverity);
        roadOpacity = 0.6;
        roadWeight = 4;
        impactLabel = 'Low Impact';
      }

      console.log(`   🛣️ ${road.name} (${Math.round(dist)}m) → ${impactLabel}`);

      // Shadow layer
      const shadow = L.polyline(roadCoords, {
        color: '#1f2937',
        weight: roadWeight + 3,
        opacity: 0.2,
        lineCap: 'round',
      }).addTo(map);
      layersRef.current.push(shadow);

      // Base gray layer
      const base = L.polyline(roadCoords, {
        color: '#9ca3af',
        weight: roadWeight + 1,
        opacity: 0.4,
        lineCap: 'round',
      }).addTo(map);
      layersRef.current.push(base);

      // Colored impact layer
      const line = L.polyline(roadCoords, {
        color: impactColor,
        weight: roadWeight,
        opacity: roadOpacity,
        lineCap: 'round',
        lineJoin: 'round',
      }).addTo(map);

      // ✅ IMPROVED POPUP
      line.bindPopup(`
        <div style="font-family: -apple-system, sans-serif; padding: 10px; min-width: 220px;">
          <h4 style="margin: 0 0 8px 0; font-size: 14px; font-weight: 600; color: #1f2937;">
            ${road.name}
          </h4>
          
          <div style="
            background: ${impactColor}15;
            border-left: 3px solid ${impactColor};
            padding: 8px;
            border-radius: 6px;
            margin-bottom: 8px;
          ">
            <p style="margin: 0; font-size: 13px; font-weight: 600; color: ${impactColor};">
              ${impactLabel}
            </p>
          </div>

          <div style="font-size: 12px; color: #4b5563; line-height: 1.5;">
            <p style="margin: 4px 0;">
              <strong>Distance:</strong> ${Math.round(dist)}m from disruption
            </p>
            <p style="margin: 4px 0;">
              <strong>Road type:</strong> ${road.type}
            </p>
            <p style="margin: 4px 0;">
              <strong>Lanes:</strong> ${road.lanes}
            </p>
          </div>
        </div>
      `, {
        maxWidth: 260,
      });

      layersRef.current.push(line);
    });

    // ========================================
    // DRAW MAIN ROAD ON TOP (thickest)
    // ========================================
    if (roadInfo?.coordinates && roadInfo.coordinates.length > 1) {
      const roadCoords = roadInfo.coordinates.map(c => [c.lat, c.lng]);

      console.log('🚧 Drawing MAIN road:', roadInfo.road_name);

      // Main shadow (largest)
      const mainShadow = L.polyline(roadCoords, {
        color: '#000000',
        weight: 16,
        opacity: 0.25,
        lineCap: 'round',
      }).addTo(map);
      layersRef.current.push(mainShadow);

      // Main base (gray)
      const mainBase = L.polyline(roadCoords, {
        color: '#9ca3af',
        weight: 12,
        opacity: 0.6,
        lineCap: 'round',
      }).addTo(map);
      layersRef.current.push(mainBase);

      // Main colored layer (primary disruption)
      const mainRoad = L.polyline(roadCoords, {
        color: mainColor,
        weight: 10,
        opacity: 1,
        lineCap: 'round',
        lineJoin: 'round',
      }).addTo(map);

      mainRoad.bindPopup(`
        <div style="font-family: -apple-system, sans-serif; padding: 12px; min-width: 240px;">
          <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
            <div style="
              width: 44px;
              height: 44px;
              background: white;
              border: 3px solid ${mainColor};
              border-radius: 12px;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 24px;
            ">🚧</div>
            <div>
              <h3 style="margin: 0; font-size: 15px; font-weight: 600; color: #1f2937;">
                ${roadInfo.road_name}
              </h3>
              <p style="margin: 2px 0 0 0; font-size: 11px; color: #6b7280;">
                Main affected road
              </p>
            </div>
          </div>
          
          <div style="
            background: ${mainColor}15;
            border-left: 3px solid ${mainColor};
            padding: 10px;
            border-radius: 6px;
            margin-bottom: 10px;
          ">
            <p style="margin: 0; font-size: 14px; font-weight: 600; color: ${mainColor};">
              ${simulationResults.summary.avg_severity_label} Congestion
            </p>
            <p style="margin: 6px 0 0 0; font-size: 13px; color: #4b5563;">
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
              <div style="color: #fbbf24; font-weight: 600; font-size: 14px;">
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
      });

      layersRef.current.push(mainRoad);
    }

    // ========================================
    // DISRUPTION MARKER
    // ========================================
    const epicenter = L.marker([center.lat, center.lng], {
      icon: L.divIcon({
        className: 'disruption-icon',
        html: `
          <div style="position: relative;">
            <div style="
              position: absolute;
              top: 50%;
              left: 50%;
              transform: translate(-50%, -50%);
              width: 70px;
              height: 70px;
              border: 3px solid ${mainColor};
              border-radius: 50%;
              opacity: 0.4;
              animation: pulse 2s ease-out infinite;
            "></div>
            <div style="
              background: white;
              border: 4px solid ${mainColor};
              border-radius: 50%;
              width: 52px;
              height: 52px;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 28px;
              box-shadow: 0 8px 24px rgba(0,0,0,0.3);
              position: relative;
              z-index: 10;
            ">🚧</div>
            <style>
              @keyframes pulse {
                0% { transform: translate(-50%, -50%) scale(1); opacity: 0.4; }
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
      <div style="font-family: -apple-system, sans-serif; padding: 10px;">
        <h3 style="margin: 0 0 10px 0; font-size: 16px; font-weight: 600; color: #1f2937;">
          🚧 Disruption Center
        </h3>
        <div style="background: #f9fafb; padding: 8px; border-radius: 8px; font-size: 12px;">
          <p style="margin: 4px 0;"><strong>Type:</strong> ${simulationResults.input.disruption_type}</p>
          <p style="margin: 4px 0;"><strong>Area:</strong> ${simulationResults.input.area}</p>
          <p style="margin: 4px 0;"><strong>Affected roads:</strong> ${nearbyRoads.length + 1}</p>
        </div>
      </div>
    `);

    layersRef.current.push(epicenter);

    // ========================================
    // FIT MAP TO SHOW ALL ROADS
    // ========================================
    const allCoords = [];
    if (roadInfo?.coordinates) {
      allCoords.push(...roadInfo.coordinates.map(c => [c.lat, c.lng]));
    }
    nearbyRoads.forEach(road => {
      allCoords.push(...road.coordinates.map(c => [c.lat, c.lng]));
    });

    if (allCoords.length > 0) {
      map.fitBounds(L.latLngBounds(allCoords), { padding: [60, 60] });
    } else {
      map.setView([center.lat, center.lng], 15);
    }

    console.log('✅ Map rendering complete!');

  }, [simulationResults, selectedLocation, roadInfo, nearbyRoads, loading]);

  // ========================================
  // RENDER MAP
  // ========================================
  return (
    <div className="relative bg-gray-50 rounded-xl overflow-hidden shadow-lg" style={{ height: '550px' }}>
      <div ref={mapRef} className="w-full h-full" />
      
      {/* Loading Indicator */}
      {loading && (
        <div className="absolute inset-0 bg-white bg-opacity-90 flex items-center justify-center z-[2000]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
            <p className="text-sm text-gray-600">Analyzing nearby roads...</p>
          </div>
        </div>
      )}
      
      {/* Legend */}
      {simulationResults && !loading && (
        <div className="absolute bottom-6 right-6 bg-white rounded-xl p-5 shadow-xl z-[1000] border border-gray-100">
          <h4 className="font-bold text-gray-800 mb-3 text-sm flex items-center gap-2">
            <span className="text-lg">🎯</span>
            Impact Zones
          </h4>
          <div className="space-y-2">
            <div className="flex items-center gap-3 text-xs">
              <div className="w-8 h-1.5 bg-red-500 rounded-full"></div>
              <span>&lt;150m</span>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <div className="w-7 h-1.5 bg-yellow-500 rounded-full"></div>
              <span>150-300m</span>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <div className="w-6 h-1.5 bg-yellow-400 rounded-full"></div>
              <span>300-450m</span>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <div className="w-5 h-1.5 bg-green-400 rounded-full"></div>
              <span>450m+</span>
            </div>
          </div>
        </div>
      )}

      {/* Info */}
      {!loading && (
        <div className="absolute top-6 left-6 bg-white rounded-xl px-5 py-3 shadow-lg z-[1000] border border-gray-100">
          <p className="text-sm font-semibold text-gray-800 flex items-center gap-2">
            <span className="text-lg">📊</span>
            Impact Prediction
          </p>
          <p className="text-xs text-gray-600 mt-1">
            {nearbyRoads.length + 1} roads affected
          </p>
        </div>
      )}
    </div>
  );
}

// ========================================
// HELPER: Distance calculation
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