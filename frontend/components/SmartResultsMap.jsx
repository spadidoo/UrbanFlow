// frontend/components/SmartResultsMap.jsx - COMPLETE FIXED VERSION
"use client";

import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect, useRef, useState } from "react";

export default function SmartResultsMap({ simulationResults, selectedLocation, roadInfo }) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const layersRef = useRef([]);
  const [nearbyRoads, setNearbyRoads] = useState([]);
  const [loading, setLoading] = useState(true);

  // ========================================
  // FETCH NEARBY ROADS - FIXED
  // ========================================
  useEffect(() => {
    if (!selectedLocation || !simulationResults) return;

    const fetchNearbyRoads = async () => {
      setLoading(true);
      try {
        const center = selectedLocation.center;
        const searchRadius = 600; // meters

        const query = `
          [out:json][timeout:25];
          (
            way["highway"~"^(motorway|trunk|primary|secondary|tertiary|residential)$"](around:${searchRadius},${center.lat},${center.lng});
          );
          out body;
          >;
          out skel qt;
        `;

        console.log('🔍 Fetching roads around:', center);

        const response = await fetch('https://overpass-api.de/api/interpreter', {
          method: 'POST',
          body: query,
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          }
        });

        if (!response.ok) {
          console.warn('OSM API failed, using fallback');
          setNearbyRoads(getFallbackRoads());
          return;
        }

        const data = await response.json();
        console.log('📦 OSM returned elements:', data.elements?.length || 0);

        if (data.elements && data.elements.length > 0) {
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

          // Calculate distances
          const roadsWithDistance = ways.map(road => {
            const distances = road.coordinates.map(coord => 
              getDistance(center.lat, center.lng, coord.lat, coord.lng)
            );
            const minDist = Math.min(...distances);

            return { ...road, minDist };
          });

          // Filter and sort
          const filtered = roadsWithDistance
            .filter(road => {
              if (road.minDist > searchRadius) return false;
              if (roadInfo && road.name === roadInfo.road_name && road.minDist < 50) {
                return false;
              }
              return true;
            })
            .sort((a, b) => a.minDist - b.minDist)
            .slice(0, 20);

          console.log('✅ Showing roads:', filtered.length);
          setNearbyRoads(filtered);
        } else {
          console.warn('No roads found, using fallback');
          setNearbyRoads(getFallbackRoads());
        }
      } catch (error) {
        console.error('❌ Error fetching roads:', error);
        setNearbyRoads(getFallbackRoads());
      } finally {
        setLoading(false);
      }
    };

    fetchNearbyRoads();
  }, [selectedLocation, simulationResults, roadInfo]);

  // ========================================
  // INITIALIZE MAP
  // ========================================
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

  // ========================================
  // DRAW ROADS
  // ========================================
  useEffect(() => {
    if (!mapInstanceRef.current || !simulationResults || !selectedLocation) return;
    if (loading) return;

    const map = mapInstanceRef.current;

    // Clear old layers
    layersRef.current.forEach(layer => map.removeLayer(layer));
    layersRef.current = [];

    const center = selectedLocation.center;
    const avgSeverity = simulationResults.summary.avg_severity;

    const getSeverityColor = (severity) => {
      if (severity < 0.5) return '#22c55e';
      if (severity < 1.5) return '#fbbf24';
      return '#ef4444';
    };

    const mainColor = getSeverityColor(avgSeverity);

    // Draw nearby roads
    nearbyRoads.forEach((road) => {
      const roadCoords = road.coordinates.map(c => [c.lat, c.lng]);
      const dist = road.minDist;

      let impactColor, roadOpacity, roadWeight, impactLabel;

      if (dist < 150) {
        impactColor = getSeverityColor(avgSeverity * 0.85);
        roadOpacity = 0.9;
        roadWeight = 7;
        impactLabel = 'High Impact';
      } else if (dist < 300) {
        impactColor = getSeverityColor(avgSeverity * 0.65);
        roadOpacity = 0.8;
        roadWeight = 6;
        impactLabel = 'Moderate Impact';
      } else if (dist < 450) {
        impactColor = getSeverityColor(avgSeverity * 0.45);
        roadOpacity = 0.7;
        roadWeight = 5;
        impactLabel = 'Low-Medium Impact';
      } else {
        impactColor = getSeverityColor(avgSeverity * 0.25);
        roadOpacity = 0.6;
        roadWeight = 4;
        impactLabel = 'Low Impact';
      }

      // Shadow
      const shadow = L.polyline(roadCoords, {
        color: '#1f2937',
        weight: roadWeight + 3,
        opacity: 0.2,
        lineCap: 'round',
      }).addTo(map);
      layersRef.current.push(shadow);

      // Base
      const base = L.polyline(roadCoords, {
        color: '#9ca3af',
        weight: roadWeight + 1,
        opacity: 0.4,
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
        <div style="font-family: sans-serif; padding: 10px;">
          <h4 style="margin: 0 0 8px 0; font-size: 14px; font-weight: 600;">
            ${road.name}
          </h4>
          <div style="background: ${impactColor}15; border-left: 3px solid ${impactColor}; padding: 8px; margin-bottom: 8px;">
            <p style="margin: 0; font-weight: 600; color: ${impactColor};">
              ${impactLabel}
            </p>
          </div>
          <p style="margin: 4px 0; font-size: 12px;">
            <strong>Distance:</strong> ${Math.round(dist)}m
          </p>
          <p style="margin: 4px 0; font-size: 12px;">
            <strong>Type:</strong> ${road.type}
          </p>
        </div>
      `);

      layersRef.current.push(line);
    });

    // Draw main road
    if (roadInfo?.coordinates && roadInfo.coordinates.length > 1) {
      const roadCoords = roadInfo.coordinates.map(c => [c.lat, c.lng]);

      const mainShadow = L.polyline(roadCoords, {
        color: '#000000',
        weight: 16,
        opacity: 0.25,
        lineCap: 'round',
      }).addTo(map);
      layersRef.current.push(mainShadow);

      const mainBase = L.polyline(roadCoords, {
        color: '#9ca3af',
        weight: 12,
        opacity: 0.6,
        lineCap: 'round',
      }).addTo(map);
      layersRef.current.push(mainBase);

      const mainRoad = L.polyline(roadCoords, {
        color: mainColor,
        weight: 10,
        opacity: 1,
        lineCap: 'round',
        lineJoin: 'round',
      }).addTo(map);

      mainRoad.bindPopup(`
        <div style="font-family: sans-serif; padding: 12px;">
          <h3 style="margin: 0 0 10px 0; font-size: 15px; font-weight: 600;">
            🚧 ${roadInfo.road_name}
          </h3>
          <div style="background: ${mainColor}15; border-left: 3px solid ${mainColor}; padding: 10px; margin-bottom: 10px;">
            <p style="margin: 0; font-weight: 600; color: ${mainColor};">
              ${simulationResults.summary.avg_severity_label} Congestion
            </p>
            <p style="margin: 6px 0 0 0;">
              Avg delay: <strong>+${simulationResults.summary.avg_delay_minutes} min</strong>
            </p>
          </div>
        </div>
      `);

      layersRef.current.push(mainRoad);
    }

    // Disruption marker
    const epicenter = L.marker([center.lat, center.lng], {
      icon: L.divIcon({
        className: 'disruption-icon',
        html: `
          <div style="position: relative;">
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
            ">🚧</div>
          </div>
        `,
        iconSize: [52, 52],
        iconAnchor: [26, 26],
      })
    }).addTo(map);

    epicenter.bindPopup(`
      <div style="padding: 10px;">
        <h3 style="margin: 0 0 10px 0; font-weight: 600;">🚧 Disruption Center</h3>
        <p><strong>Type:</strong> ${simulationResults.input.disruption_type}</p>
        <p><strong>Area:</strong> ${simulationResults.input.area}</p>
      </div>
    `);

    layersRef.current.push(epicenter);

    // Fit bounds
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

  }, [simulationResults, selectedLocation, roadInfo, nearbyRoads, loading]);

  return (
    <div className="relative bg-gray-50 rounded-xl overflow-hidden shadow-lg" style={{ height: '550px' }}>
      <div ref={mapRef} className="w-full h-full" />
      
      {loading && (
        <div className="absolute inset-0 bg-white bg-opacity-90 flex items-center justify-center z-[2000]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
            <p className="text-sm text-gray-600">Analyzing nearby roads...</p>
          </div>
        </div>
      )}
      
      {simulationResults && !loading && (
        <div className="absolute bottom-6 right-6 bg-white rounded-xl p-5 shadow-xl z-[1000]">
          <h4 className="font-bold text-gray-800 mb-3 text-sm">🎯 Impact Zones</h4>
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

      {!loading && (
        <div className="absolute top-6 left-6 bg-white rounded-xl px-5 py-3 shadow-lg z-[1000]">
          <p className="text-sm font-semibold text-gray-800">📊 Impact Prediction</p>
          <p className="text-xs text-gray-600 mt-1">
            {nearbyRoads.length + 1} roads affected
          </p>
        </div>
      )}
    </div>
  );
}

// Helper: Distance calculation
function getDistance(lat1, lng1, lat2, lng2) {
  const R = 6371e3;
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lng2 - lng1) * Math.PI / 180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
          Math.cos(φ1) * Math.cos(φ2) *
          Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  return R * c;
}

// Fallback roads when OSM fails
function getFallbackRoads() {
  return [
    {
      id: 'fallback-1',
      name: 'Maharlika Highway',
      type: 'primary',
      lanes: 4,
      coordinates: [
        { lat: 14.2096, lng: 121.164 },
        { lat: 14.2106, lng: 121.165 },
        { lat: 14.2116, lng: 121.166 }
      ],
      minDist: 200
    },
    {
      id: 'fallback-2',
      name: 'Calamba-Pagsanjan Road',
      type: 'secondary',
      lanes: 2,
      coordinates: [
        { lat: 14.2086, lng: 121.163 },
        { lat: 14.2096, lng: 121.164 },
        { lat: 14.2106, lng: 121.165 }
      ],
      minDist: 300
    }
  ];
}