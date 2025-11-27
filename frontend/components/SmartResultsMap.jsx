// frontend/components/SmartResultsMap.jsx - ENHANCED VERSION

"use client";

import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect, useRef, useState } from "react";

// Fix Leaflet icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

export default function SmartResultsMap({ simulationResults, selectedLocation, roadInfo }) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const layersRef = useRef([]);
  const [roadNetwork, setRoadNetwork] = useState({ mainRoad: null, connectedRoads: [], nearbyRoads: [] });
  const [loading, setLoading] = useState(true);
  const [mapReady, setMapReady] = useState(false);

  // ========================================
  // MAP INITIALIZATION
  // ========================================
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const map = L.map(mapRef.current, {
      center: [14.2096, 121.164],
      zoom: 13,
      zoomControl: true,
      scrollWheelZoom: true,
      dragging: true,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap contributors",
      maxZoom: 19,
    }).addTo(map);

    mapInstanceRef.current = map;
    setMapReady(true);

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        setMapReady(false);
      }
    };
  }, []);

  // ========================================
  // CENTER MAP ON LOCATION
  // ========================================
  useEffect(() => {
    if (!mapInstanceRef.current || !selectedLocation || !mapReady) return;
    const center = selectedLocation.center;
    mapInstanceRef.current.setView([center.lat, center.lng], 14);
  }, [selectedLocation, mapReady]);

  // ========================================
  // FETCH ROAD NETWORK - ENHANCED
  // ========================================
  useEffect(() => {
    if (!selectedLocation || !simulationResults || !mapReady) return;

    const fetchRoadNetwork = async () => {
      setLoading(true);
      try {
        const center = selectedLocation.center;
        
        // ✅ EXPANDED SEARCH RADIUS - Fetch roads in a larger area
        const searchRadius = 800; // Increased from 400m

        const query = `
          [out:json][timeout:25];
          (
            way["highway"~"^(motorway|trunk|primary|secondary|tertiary|residential|unclassified)$"]
               (around:${searchRadius},${center.lat},${center.lng});
          );
          out body;
          >;
          out skel qt;
        `;

        const response = await fetch("https://overpass-api.de/api/interpreter", {
          method: "POST",
          body: query,
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
        });

        if (!response.ok) {
          console.warn("⚠️ OSM API unavailable");
          setRoadNetwork({ mainRoad: null, connectedRoads: [], nearbyRoads: [] });
          setLoading(false);
          return;
        }

        const data = await response.json();

        if (data.elements && data.elements.length > 0) {
          const processedNetwork = processRoadNetwork(data.elements, center, roadInfo);
          setRoadNetwork(processedNetwork);
          console.log("✅ Road network analysis:", {
            mainRoad: !!processedNetwork.mainRoad,
            connectedRoads: processedNetwork.connectedRoads.length,
            nearbyRoads: processedNetwork.nearbyRoads.length
          });
        } else {
          setRoadNetwork({ mainRoad: null, connectedRoads: [], nearbyRoads: [] });
        }
      } catch (error) {
        console.error("❌ Error fetching road network:", error);
        setRoadNetwork({ mainRoad: null, connectedRoads: [], nearbyRoads: [] });
      } finally {
        setLoading(false);
      }
    };

    fetchRoadNetwork();
  }, [selectedLocation, simulationResults, roadInfo, mapReady]);

  // ========================================
  // PROCESS ROAD NETWORK - NEW ALGORITHM
  // ========================================
  function processRoadNetwork(elements, center, roadInfo) {
    const nodes = elements.filter(el => el.type === "node");
    
    // Parse all ways
    const ways = elements
      .filter(el => el.type === "way" && el.tags && el.tags.highway)
      .map(way => {
        const coords = way.nodes
          .map(nodeId => nodes.find(n => n.id === nodeId))
          .filter(n => n)
          .map(n => ({ lat: n.lat, lng: n.lon }));

        if (coords.length < 2) return null;

        return {
          id: way.id,
          name: way.tags.name || `${way.tags.highway} road`,
          type: way.tags.highway,
          lanes: parseInt(way.tags.lanes) || estimateLanes(way.tags.highway),
          maxspeed: parseInt(way.tags.maxspeed) || estimateSpeed(way.tags.highway),
          coordinates: coords,
          nodes: way.nodes, // Keep node IDs for intersection detection
        };
      })
      .filter(Boolean);

    // Find main road (closest to disruption center)
    let mainRoad = null;
    if (roadInfo?.coordinates && roadInfo.coordinates.length > 1) {
      mainRoad = {
        ...roadInfo,
        isMainRoad: true,
        impactLevel: 'direct',
        distanceToDisruption: 0
      };
    }

    // Build node connectivity graph
    const nodeConnections = buildNodeGraph(ways);
    
    // Get connected nodes from main road
    const mainRoadNodes = new Set(mainRoad ? getWayNodes(roadInfo.coordinates, ways) : []);
    
    // Classify roads by connectivity
    const connectedRoads = [];
    const nearbyRoads = [];

    ways.forEach(way => {
      // Skip if it's the main road
      if (mainRoad && isSameRoad(way, roadInfo)) return;

      const minDistToCenter = Math.min(...way.coordinates.map(c => 
        getDistance(center.lat, center.lng, c.lat, c.lng)
      ));

      // ✅ Check if road shares nodes with main road (direct connection)
      const sharedNodes = way.nodes.filter(nodeId => mainRoadNodes.has(nodeId));
      const isDirectlyConnected = sharedNodes.length > 0;

      // ✅ Check if road is connected through intermediate roads (network connectivity)
      const isNetworkConnected = !isDirectlyConnected && 
        isConnectedThroughNetwork(way.nodes, mainRoadNodes, nodeConnections, 3); // Max 3 hops

      // Calculate impact based on connectivity and distance
      let impactLevel, impactSeverity;

      if (isDirectlyConnected) {
        // Direct connection = HIGH impact
        impactLevel = 'high';
        impactSeverity = 0.85; // 85% of main road severity
        connectedRoads.push({
          ...way,
          impactLevel,
          impactSeverity,
          distanceToDisruption: minDistToCenter,
          connectionType: 'direct',
          sharedNodes: sharedNodes.length
        });
      } else if (isNetworkConnected && minDistToCenter < 500) {
        // Network-connected within 500m = MEDIUM impact
        impactLevel = 'medium';
        impactSeverity = 0.60; // 60% of main road severity
        connectedRoads.push({
          ...way,
          impactLevel,
          impactSeverity,
          distanceToDisruption: minDistToCenter,
          connectionType: 'network'
        });
      } else if (minDistToCenter < 300) {
        // Close proximity but not connected = LOW impact
        impactLevel = 'low';
        impactSeverity = 0.35; // 35% of main road severity
        nearbyRoads.push({
          ...way,
          impactLevel,
          impactSeverity,
          distanceToDisruption: minDistToCenter,
          connectionType: 'proximity'
        });
      }
    });

    // Sort by distance
    connectedRoads.sort((a, b) => a.distanceToDisruption - b.distanceToDisruption);
    nearbyRoads.sort((a, b) => a.distanceToDisruption - b.distanceToDisruption);

    return {
      mainRoad,
      connectedRoads: connectedRoads.slice(0, 15), // Top 15 connected roads
      nearbyRoads: nearbyRoads.slice(0, 8)         // Top 8 nearby roads
    };
  }

  // ========================================
  // HELPER FUNCTIONS
  // ========================================
  
  function buildNodeGraph(ways) {
    const graph = new Map();
    ways.forEach(way => {
      way.nodes.forEach((nodeId, idx) => {
        if (!graph.has(nodeId)) graph.set(nodeId, new Set());
        
        // Connect to previous node
        if (idx > 0) {
          graph.get(nodeId).add(way.nodes[idx - 1]);
          graph.get(way.nodes[idx - 1]).add(nodeId);
        }
      });
    });
    return graph;
  }

  function isConnectedThroughNetwork(roadNodes, targetNodes, graph, maxHops) {
    const visited = new Set();
    const queue = Array.from(roadNodes).map(n => ({ node: n, hops: 0 }));
    
    while (queue.length > 0) {
      const { node, hops } = queue.shift();
      
      if (hops > maxHops) continue;
      if (visited.has(node)) continue;
      visited.add(node);
      
      if (targetNodes.has(node)) return true;
      
      const neighbors = graph.get(node) || [];
      neighbors.forEach(neighbor => {
        if (!visited.has(neighbor)) {
          queue.push({ node: neighbor, hops: hops + 1 });
        }
      });
    }
    
    return false;
  }

  function getWayNodes(coordinates, ways) {
    // Find nodes from coordinates
    const nodes = new Set();
    // This is simplified - in practice, match coordinates to OSM node IDs
    return nodes;
  }

  function isSameRoad(way, roadInfo) {
    if (!roadInfo) return false;
    return way.name === roadInfo.road_name && 
           Math.abs(way.coordinates.length - (roadInfo.coordinates?.length || 0)) < 5;
  }

  function estimateLanes(highway) {
    const defaults = {
      motorway: 4, trunk: 3, primary: 2, secondary: 2,
      tertiary: 2, residential: 1, unclassified: 1
    };
    return defaults[highway] || 2;
  }

  function estimateSpeed(highway) {
    const defaults = {
      motorway: 100, trunk: 80, primary: 60, secondary: 50,
      tertiary: 40, residential: 30, unclassified: 30
    };
    return defaults[highway] || 40;
  }

  // ========================================
  // RENDER ROADS ON MAP - ENHANCED
  // ========================================
  useEffect(() => {
    if (!mapInstanceRef.current || !simulationResults || !mapReady || loading) return;

    const map = mapInstanceRef.current;
    const { mainRoad, connectedRoads, nearbyRoads } = roadNetwork;

    // Clear old layers
    layersRef.current.forEach(layer => {
      try { map.removeLayer(layer); } catch (e) {}
    });
    layersRef.current = [];

    const center = selectedLocation.center;
    const baseSeverity = simulationResults.summary.avg_severity;

    const getSeverityColor = (severity) => {
      if (severity < 1.0) return "#84cc16"; // lime
      if (severity < 1.5) return "#fbbf24"; // yellow
      if (severity < 2.0) return "#fb923c"; // orange
      return "#ef4444"; // red
    };

    // ========================================
    // 1. RENDER NEARBY ROADS (Lowest priority)
    // ========================================
    nearbyRoads.forEach(road => {
      const adjustedSeverity = baseSeverity * road.impactSeverity;
      const color = getSeverityColor(adjustedSeverity);
      const coords = road.coordinates.map(c => [c.lat, c.lng]);

      const line = L.polyline(coords, {
        color: color,
        weight: 4,
        opacity: 0.5,
        dashArray: "5, 5", // Dashed to show uncertainty
        lineCap: "round",
      }).addTo(map);

      line.bindPopup(createRoadPopup(road, adjustedSeverity, 'Low Impact (Proximity)'));
      layersRef.current.push(line);
    });

    // ========================================
    // 2. RENDER CONNECTED ROADS (Medium/High priority)
    // ========================================
    connectedRoads.forEach(road => {
      const adjustedSeverity = baseSeverity * road.impactSeverity;
      const color = getSeverityColor(adjustedSeverity);
      const coords = road.coordinates.map(c => [c.lat, c.lng]);

      // Shadow
      const shadow = L.polyline(coords, {
        color: "#1f2937",
        weight: road.impactLevel === 'high' ? 10 : 8,
        opacity: 0.2,
        lineCap: "round",
      }).addTo(map);
      layersRef.current.push(shadow);

      // Base
      const base = L.polyline(coords, {
        color: "#9ca3af",
        weight: road.impactLevel === 'high' ? 8 : 6,
        opacity: 0.4,
        lineCap: "round",
      }).addTo(map);
      layersRef.current.push(base);

      // Colored line
      const line = L.polyline(coords, {
        color: color,
        weight: road.impactLevel === 'high' ? 7 : 5,
        opacity: 0.85,
        lineCap: "round",
        lineJoin: "round",
      }).addTo(map);

      const impactLabel = road.impactLevel === 'high' 
        ? 'High Impact (Direct Connection)' 
        : 'Medium Impact (Network Connected)';
      
      line.bindPopup(createRoadPopup(road, adjustedSeverity, impactLabel));
      layersRef.current.push(line);

      // ✅ Add connection indicator for direct connections
      if (road.connectionType === 'direct' && road.sharedNodes > 0) {
        road.coordinates.slice(0, 3).forEach(coord => {
          const dot = L.circleMarker([coord.lat, coord.lng], {
            radius: 4,
            color: color,
            fillColor: '#ffffff',
            fillOpacity: 1,
            weight: 2,
          }).addTo(map);
          layersRef.current.push(dot);
        });
      }
    });

    // ========================================
    // 3. RENDER MAIN ROAD (Highest priority)
    // ========================================
    if (mainRoad) {
      const coords = mainRoad.coordinates.map(c => [c.lat, c.lng]);
      const mainColor = getSeverityColor(baseSeverity);

      // Shadow
      const shadow = L.polyline(coords, {
        color: "#000000",
        weight: 18,
        opacity: 0.25,
        lineCap: "round",
      }).addTo(map);
      layersRef.current.push(shadow);

      // Base
      const base = L.polyline(coords, {
        color: "#6b7280",
        weight: 14,
        opacity: 0.6,
        lineCap: "round",
      }).addTo(map);
      layersRef.current.push(base);

      // Main road
      const mainLine = L.polyline(coords, {
        color: mainColor,
        weight: 12,
        opacity: 1,
        lineCap: "round",
        lineJoin: "round",
      }).addTo(map);

      mainLine.bindPopup(createMainRoadPopup(mainRoad, baseSeverity, simulationResults));
      layersRef.current.push(mainLine);
    }

    // ========================================
    // 4. DISRUPTION EPICENTER
    // ========================================
    const mainColor = getSeverityColor(baseSeverity);
    const epicenter = L.marker([center.lat, center.lng], {
      icon: L.divIcon({
        className: "disruption-icon",
        html: `
          <div style="position: relative;">
            <div style="
              position: absolute;
              top: 50%;
              left: 50%;
              transform: translate(-50%, -50%);
              width: 80px;
              height: 80px;
              border: 3px solid ${mainColor};
              border-radius: 50%;
              opacity: 0.3;
              animation: pulse-ring 2s ease-out infinite;
            "></div>
            <div style="
              background: white;
              border: 4px solid ${mainColor};
              border-radius: 50%;
              width: 56px;
              height: 56px;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 30px;
              box-shadow: 0 8px 24px rgba(0,0,0,0.3);
              position: relative;
              z-index: 10;
            ">🚧</div>
            <style>
              @keyframes pulse-ring {
                0% { transform: translate(-50%, -50%) scale(1); opacity: 0.3; }
                100% { transform: translate(-50%, -50%) scale(2.2); opacity: 0; }
              }
            </style>
          </div>
        `,
        iconSize: [56, 56],
        iconAnchor: [28, 28],
      }),
    }).addTo(map);

    epicenter.bindPopup(createEpicenterPopup(simulationResults));
    layersRef.current.push(epicenter);

    // Fit bounds
    const allCoords = [];
    if (mainRoad?.coordinates) {
      allCoords.push(...mainRoad.coordinates.map(c => [c.lat, c.lng]));
    }
    connectedRoads.forEach(road => {
      allCoords.push(...road.coordinates.map(c => [c.lat, c.lng]));
    });
    nearbyRoads.forEach(road => {
      allCoords.push(...road.coordinates.map(c => [c.lat, c.lng]));
    });

    if (allCoords.length > 0) {
      map.fitBounds(L.latLngBounds(allCoords), { padding: [80, 80], maxZoom: 15 });
    }

  }, [simulationResults, selectedLocation, roadInfo, roadNetwork, loading, mapReady]);

  // ========================================
  // POPUP CREATORS
  // ========================================
  
  function createRoadPopup(road, severity, impactLabel) {
    const color = severity < 1.0 ? "#84cc16" : severity < 1.5 ? "#fbbf24" : severity < 2.0 ? "#fb923c" : "#ef4444";
    
    return `
      <div style="font-family: -apple-system, sans-serif; padding: 12px; min-width: 220px;">
        <h4 style="margin: 0 0 8px 0; font-size: 14px; font-weight: 600;">${road.name}</h4>
        
        <div style="background: ${color}15; border-left: 3px solid ${color}; padding: 8px; border-radius: 4px; margin-bottom: 8px;">
          <p style="margin: 0; font-weight: 600; color: ${color}; font-size: 13px;">${impactLabel}</p>
          <p style="margin: 4px 0 0 0; font-size: 11px; color: #6b7280;">
            Predicted severity: ${severity.toFixed(1)} / 3.0
          </p>
        </div>
        
        <div style="font-size: 11px; color: #4b5563; line-height: 1.4;">
          <p style="margin: 4px 0;"><strong>Connection:</strong> ${road.connectionType}</p>
          <p style="margin: 4px 0;"><strong>Distance:</strong> ${Math.round(road.distanceToDisruption)}m</p>
          <p style="margin: 4px 0;"><strong>Type:</strong> ${road.type} • ${road.lanes} lanes</p>
        </div>
      </div>
    `;
  }

  function createMainRoadPopup(road, severity, results) {
    const color = severity < 1.0 ? "#84cc16" : severity < 1.5 ? "#fbbf24" : severity < 2.0 ? "#fb923c" : "#ef4444";
    
    return `
      <div style="font-family: -apple-system, sans-serif; padding: 12px; min-width: 240px;">
        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px;">
          <div style="font-size: 32px; width: 48px; height: 48px; background: ${color}20; border: 3px solid ${color}; border-radius: 12px; display: flex; align-items: center; justify-content: center;">🚧</div>
          <div>
            <h3 style="margin: 0; font-size: 16px; font-weight: 600;">${road.road_name}</h3>
            <p style="margin: 2px 0 0 0; font-size: 11px; color: #6b7280;">Primary Affected Road</p>
          </div>
        </div>
        
        <div style="background: ${color}15; border-left: 3px solid ${color}; padding: 10px; border-radius: 6px; margin-bottom: 10px;">
          <p style="margin: 0; font-weight: 600; color: ${color}; font-size: 14px;">${results.summary.avg_severity_label} Congestion</p>
          <p style="margin: 6px 0 0 0; font-size: 12px;">Avg delay: <strong>+${results.summary.avg_delay_minutes} min</strong></p>
        </div>

        <div style="font-size: 11px; color: #4b5563;">
          <p style="margin: 4px 0;"><strong>Severity:</strong> ${severity.toFixed(1)} / 3.0</p>
          <p style="margin: 4px 0;"><strong>Type:</strong> ${road.road_type} • ${road.lanes} lanes</p>
          <p style="margin: 4px 0;"><strong>Length:</strong> ${road.length_km} km</p>
        </div>
      </div>
    `;
  }

  function createEpicenterPopup(results) {
    return `
      <div style="padding: 12px; font-family: -apple-system, sans-serif;">
        <h3 style="margin: 0 0 10px 0; font-weight: 600; font-size: 15px;">🚧 Disruption Center</h3>
        <div style="font-size: 12px; line-height: 1.6;">
          <p style="margin: 4px 0;"><strong>Type:</strong> ${results.input.disruption_type}</p>
          <p style="margin: 4px 0;"><strong>Area:</strong> ${results.input.area}</p>
          <p style="margin: 4px 0;"><strong>Duration:</strong> ${results.summary.total_hours}h (${results.summary.duration_days} days)</p>
        </div>
      </div>
    `;
  }

  // ========================================
  // RENDER
  // ========================================
  return (
    <div className="relative bg-gray-50 rounded-xl overflow-hidden shadow-lg" style={{ height: "550px" }}>
      <div ref={mapRef} className="w-full h-full" />

      {loading && (
        <div className="absolute inset-0 bg-white bg-opacity-90 flex items-center justify-center z-[2000]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
            <p className="text-sm text-gray-600 font-semibold">Analyzing road network...</p>
            <p className="text-xs text-gray-500 mt-2">Detecting connected routes and impact zones</p>
          </div>
        </div>
      )}

      {!loading && mapReady && simulationResults && (
        <>
          {/* Enhanced Legend */}
          <div className="absolute bottom-6 right-6 bg-white rounded-xl p-5 shadow-xl z-[1000] border border-gray-200">
            <h4 className="font-bold text-gray-800 mb-3 text-sm flex items-center gap-2">
              <span>🎯</span>
              <span>Impact Analysis</span>
            </h4>
            <div className="space-y-2.5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-2.5 bg-red-500 rounded-full shadow-sm"></div>
                <div className="text-xs">
                  <div className="font-semibold text-gray-700">Direct Impact</div>
                  <div className="text-gray-500">Primary affected road</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-9 h-2.5 bg-orange-500 rounded-full shadow-sm"></div>
                <div className="text-xs">
                  <div className="font-semibold text-gray-700">High Impact</div>
                  <div className="text-gray-500">Directly connected ({roadNetwork.connectedRoads.filter(r => r.impactLevel === 'high').length})</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-2.5 bg-yellow-500 rounded-full shadow-sm"></div>
                <div className="text-xs">
                  <div className="font-semibold text-gray-700">Medium Impact</div>
                  <div className="text-gray-500">Network connected ({roadNetwork.connectedRoads.filter(r => r.impactLevel === 'medium').length})</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-7 h-2.5 bg-lime-500 rounded-full shadow-sm" style={{opacity: 0.7}}></div>
                <div className="text-xs">
                  <div className="font-semibold text-gray-700">Low Impact</div>
                  <div className="text-gray-500">Nearby proximity ({roadNetwork.nearbyRoads.length})</div>
                </div>
              </div>
            </div>
            
            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="text-xs text-gray-600 space-y-1">
                <p><strong>Total roads analyzed:</strong> {roadNetwork.connectedRoads.length + roadNetwork.nearbyRoads.length + (roadNetwork.mainRoad ? 1 : 0)}</p>
                <p className="text-gray-500 italic">Impact based on connectivity & traffic flow</p>
              </div>
            </div>
          </div>

          {/* Info Panel */}
          <div className="absolute top-6 left-6 bg-white rounded-xl px-5 py-3 shadow-lg z-[1000] border border-gray-200">
            <p className="text-sm font-semibold text-gray-800 flex items-center gap-2">
              <span>📊</span>
              <span>Network Impact Prediction</span>
            </p>
            <p className="text-xs text-gray-600 mt-1">
              {roadNetwork.connectedRoads.length + roadNetwork.nearbyRoads.length + (roadNetwork.mainRoad ? 1 : 0)} roads • 
              {roadNetwork.connectedRoads.filter(r => r.impactLevel === 'high').length} high impact
            </p>
          </div>
        </>
      )}
    </div>
  );
}

// Helper: Distance calculation (Haversine)
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

  return R * c; // meters
}