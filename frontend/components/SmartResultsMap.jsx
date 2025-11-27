// frontend/components/SmartResultsMap.jsx - FIXED VERSION WITH GRADIENTS

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
  const [currentHourIndex, setCurrentHourIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);

  // Get severity for current hour
  const getCurrentHourSeverity = () => {
    if (!simulationResults?.hourly_predictions || simulationResults.hourly_predictions.length === 0) {
      return simulationResults?.summary?.avg_severity || 1.0;
    }
    const hourData = simulationResults.hourly_predictions[currentHourIndex];
    return hourData?.severity ?? simulationResults.summary.avg_severity;
  };

  // Animation effect for hourly playback
  useEffect(() => {
    if (!isAnimating || !simulationResults?.hourly_predictions) return;
    
    const interval = setInterval(() => {
      setCurrentHourIndex(prev => {
        const next = prev + 1;
        if (next >= simulationResults.hourly_predictions.length) {
          setIsAnimating(false);
          return 0;
        }
        return next;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isAnimating, simulationResults]);

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
    mapInstanceRef.current.setView([center.lat, center.lng], 16);
  }, [selectedLocation, mapReady]);

  // ========================================
  // FETCH ROAD NETWORK
  // ========================================
  useEffect(() => {
    if (!selectedLocation || !simulationResults || !mapReady) return;

    const fetchRoadNetwork = async () => {
      setLoading(true);
      try {
        const center = selectedLocation.center;
        const searchRadius = 500; // Focused search radius

        // Only fetch important road types with names
        const query = `
          [out:json][timeout:25];
          (
            way["highway"~"^(trunk|primary|secondary|tertiary)$"]
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
          console.log("✅ Road network:", {
            mainRoad: processedNetwork.mainRoad?.name,
            connected: processedNetwork.connectedRoads.length,
            nearby: processedNetwork.nearbyRoads.length
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
  // PROCESS ROAD NETWORK - FIXED ALGORITHM
  // ========================================
  function processRoadNetwork(elements, center, roadInfo) {
    const nodes = elements.filter(el => el.type === "node");
    const nodeMap = new Map(nodes.map(n => [n.id, n]));
    
    // Parse all ways with their node IDs
    const ways = elements
      .filter(el => el.type === "way" && el.tags && el.tags.highway)
      .map(way => {
        const coords = way.nodes
          .map(nodeId => nodeMap.get(nodeId))
          .filter(n => n)
          .map(n => ({ lat: n.lat, lng: n.lon, nodeId: n.id }));

        if (coords.length < 2) return null;

        // Calculate distance to center for each point
        const distances = coords.map(c => getDistance(center.lat, center.lng, c.lat, c.lng));
        const minDist = Math.min(...distances);

        return {
          id: way.id,
          name: way.tags.name || `${way.tags.highway} road`,
          type: way.tags.highway,
          lanes: parseInt(way.tags.lanes) || estimateLanes(way.tags.highway),
          maxspeed: parseInt(way.tags.maxspeed) || estimateSpeed(way.tags.highway),
          coordinates: coords,
          nodeIds: new Set(way.nodes), // Store node IDs for intersection detection
          minDistToCenter: minDist,
        };
      })
      .filter(Boolean);

    // Find main road - closest to center OR matching roadInfo name
    let mainRoad = null;
    let mainRoadWay = null;
    
    if (roadInfo?.road_name) {
      // Try to find by name first
      mainRoadWay = ways.find(w => 
        w.name.toLowerCase().includes(roadInfo.road_name.toLowerCase()) ||
        roadInfo.road_name.toLowerCase().includes(w.name.toLowerCase())
      );
    }
    
    if (!mainRoadWay) {
      // Fall back to closest road
      mainRoadWay = ways.reduce((closest, way) => 
        !closest || way.minDistToCenter < closest.minDistToCenter ? way : closest
      , null);
    }

    if (mainRoadWay) {
      mainRoad = {
        ...mainRoadWay,
        road_name: mainRoadWay.name,
        road_type: mainRoadWay.type,
        isMainRoad: true,
        impactLevel: 'direct',
        distanceToDisruption: 0,
        coordinates: roadInfo?.coordinates?.length > 1 ? roadInfo.coordinates : mainRoadWay.coordinates,
        length_km: roadInfo?.length_km || calculateRoadLength(mainRoadWay.coordinates),
      };
    }

    // Get main road node IDs for intersection detection
    const mainRoadNodeIds = mainRoadWay?.nodeIds || new Set();

    // Classify other roads
    const connectedRoads = [];
    const nearbyRoads = [];

    ways.forEach(way => {
      // Skip main road
      if (mainRoadWay && way.id === mainRoadWay.id) return;

      // ✅ FIXED: Check for shared nodes (intersection detection)
      const sharedNodes = [...way.nodeIds].filter(nodeId => mainRoadNodeIds.has(nodeId));
      const isDirectlyConnected = sharedNodes.length > 0;

      // Determine impact level
      let impactLevel, impactMultiplier;

      if (isDirectlyConnected) {
        impactLevel = 'high';
        impactMultiplier = 0.80;
      } else if (way.minDistToCenter < 150) {
        impactLevel = 'medium-high';
        impactMultiplier = 0.60;
      } else if (way.minDistToCenter < 300) {
        impactLevel = 'medium';
        impactMultiplier = 0.40;
      } else if (way.minDistToCenter < 450) {
        impactLevel = 'low';
        impactMultiplier = 0.25;
      } else {
        return; // Skip roads too far away
      }

      const roadData = {
        ...way,
        impactLevel,
        impactMultiplier,
        distanceToDisruption: way.minDistToCenter,
        connectionType: isDirectlyConnected ? 'intersection' : 'proximity',
        sharedNodeCount: sharedNodes.length,
      };

      if (isDirectlyConnected || way.minDistToCenter < 200) {
        connectedRoads.push(roadData);
      } else {
        nearbyRoads.push(roadData);
      }
    });

    // Sort by distance
    connectedRoads.sort((a, b) => a.distanceToDisruption - b.distanceToDisruption);
    nearbyRoads.sort((a, b) => a.distanceToDisruption - b.distanceToDisruption);

    return {
      mainRoad,
      connectedRoads: connectedRoads.slice(0, 6),
      nearbyRoads: nearbyRoads.slice(0, 4)
    };
  }

  // ========================================
  // HELPER FUNCTIONS
  // ========================================
  
  function calculateRoadLength(coords) {
    let length = 0;
    for (let i = 0; i < coords.length - 1; i++) {
      length += getDistance(coords[i].lat, coords[i].lng, coords[i+1].lat, coords[i+1].lng);
    }
    return (length / 1000).toFixed(2);
  }

  function estimateLanes(highway) {
    const defaults = { trunk: 4, primary: 3, secondary: 2, tertiary: 2 };
    return defaults[highway] || 2;
  }

  function estimateSpeed(highway) {
    const defaults = { trunk: 60, primary: 50, secondary: 40, tertiary: 30 };
    return defaults[highway] || 40;
  }

  // ========================================
  // RENDER ROADS WITH GRADIENT EFFECT
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
    
    // Use current hour severity for time-based updates
    const currentHourData = simulationResults.hourly_predictions?.[currentHourIndex];
    const baseSeverity = currentHourData?.severity ?? simulationResults.summary.avg_severity;

    // ✅ Color function based on impact level AND severity
    // ✅ Color function - aligned with severity labels
    const getImpactColor = (impactLevel, severity) => {
      // Light severity (< 0.5) = Greens
      // Moderate severity (0.5 - 1.5) = Yellow/Orange
      // Heavy severity (>= 1.5) = Red/Orange

      if (impactLevel === 'direct') {
        if (severity >= 1.5) return '#dc2626'; // Red - Heavy
        if (severity >= 0.5) return '#f59e0b'; // Amber - Moderate
        return '#22c55e'; // Green - Light ✅ FIXED
      }
      if (impactLevel === 'high') {
        if (severity >= 1.5) return '#ea580c'; // Orange
        if (severity >= 0.5) return '#eab308'; // Yellow
        return '#84cc16'; // Lime - Light ✅ FIXED
      }
      if (impactLevel === 'medium-high') {
        if (severity >= 1.5) return '#f59e0b'; // Amber
        if (severity >= 0.5) return '#84cc16'; // Lime
        return '#22c55e'; // Green - Light ✅ FIXED
      }
      if (impactLevel === 'medium') {
        if (severity >= 1.5) return '#eab308'; // Yellow
        if (severity >= 0.5) return '#22c55e'; // Green
        return '#16a34a'; // Dark Green - Light ✅ FIXED
      }
      // Low impact
      if (severity >= 1.5) return '#84cc16'; // Lime
      if (severity >= 0.5) return '#22c55e'; // Green
      return '#16a34a'; // Dark Green - Light
    };

    // ========================================
    // DRAW GRADIENT SEGMENTS FOR EACH ROAD
    // ========================================
    
    const drawRoadWithGradient = (road, isMainRoad = false) => {
      const coords = road.coordinates;
      if (coords.length < 2) return;

      // For each segment of the road, calculate its distance and color
      for (let i = 0; i < coords.length - 1; i++) {
        const startCoord = coords[i];
        const endCoord = coords[i + 1];
        
        // Calculate midpoint distance to center
        const midLat = (startCoord.lat + endCoord.lat) / 2;
        const midLng = (startCoord.lng + endCoord.lng) / 2;
        const distToCenter = getDistance(center.lat, center.lng, midLat, midLng);

        // Determine segment impact level based on distance
        let segmentImpact;
        if (isMainRoad && distToCenter < 100) {
          segmentImpact = 'direct';
        } else if (distToCenter < 100) {
          segmentImpact = 'high';
        } else if (distToCenter < 200) {
          segmentImpact = 'medium-high';
        } else if (distToCenter < 350) {
          segmentImpact = 'medium';
        } else {
          segmentImpact = 'low';
        }

        const segmentColor = getImpactColor(segmentImpact, baseSeverity);
        
        // Calculate opacity based on distance (closer = more opaque)
        const opacity = Math.max(0.4, 1 - (distToCenter / 500));
        
        // Line weight based on road importance
        const weight = isMainRoad ? 10 : (road.impactLevel === 'high' ? 7 : 5);

        // Draw segment shadow
        const shadow = L.polyline(
          [[startCoord.lat, startCoord.lng], [endCoord.lat, endCoord.lng]],
          {
            color: '#1f2937',
            weight: weight + 4,
            opacity: 0.15,
            lineCap: 'round',
          }
        ).addTo(map);
        layersRef.current.push(shadow);

        // Draw colored segment
        const segment = L.polyline(
          [[startCoord.lat, startCoord.lng], [endCoord.lat, endCoord.lng]],
          {
            color: segmentColor,
            weight: weight,
            opacity: opacity,
            lineCap: 'round',
            lineJoin: 'round',
          }
        ).addTo(map);
        layersRef.current.push(segment);
      }

      // Add popup to the full road (invisible polyline for click detection)
      const fullLine = L.polyline(
        coords.map(c => [c.lat, c.lng]),
        { opacity: 0, weight: 20 }
      ).addTo(map);
      
      if (isMainRoad) {
        fullLine.bindPopup(createMainRoadPopup(road, baseSeverity, simulationResults, currentHourData));
      } else {
        fullLine.bindPopup(createRoadPopup(road, baseSeverity));
      }
      layersRef.current.push(fullLine);
    };

    // ========================================
    // 1. RENDER NEARBY ROADS (Lowest priority - furthest)
    // ========================================
    nearbyRoads.forEach(road => {
      // ✅ Dynamic distance - nearby roads only show during moderate/heavy congestion
      // ✅ Delay-based calculation: 1 minute delay = ~20m spread
      const currentDelay = currentHourData?.delay_info?.additional_delay_min ?? simulationResults.summary.avg_delay_minutes ?? 5;
      const severityMultiplier = Math.min(Math.max(0.6, 0.6 + (currentDelay / 25)), 2.0);
      // Example: 5 min delay = 0.8x, 10 min = 1.0x, 20 min = 1.4x, 30 min = 1.8x
      const maxDist = 280 * severityMultiplier;
      
      const trimmedCoords = road.coordinates.filter(c => {
        const dist = getDistance(center.lat, center.lng, c.lat, c.lng);
        return dist < maxDist;
      });
      if (trimmedCoords.length >= 2) {
        drawRoadWithGradient({ ...road, coordinates: trimmedCoords });
      }
    });

    // ========================================
    // 2. RENDER CONNECTED ROADS (Medium priority)
    // ========================================
    connectedRoads.forEach(road => {
      // ✅ Dynamic distance based on severity - congestion spreads further during heavy traffic
      // ✅ Delay-based calculation: 1 minute delay = ~20m spread
      const currentDelay = currentHourData?.delay_info?.additional_delay_min ?? simulationResults.summary.avg_delay_minutes ?? 5;
      const severityMultiplier = Math.min(Math.max(0.6, 0.6 + (currentDelay / 25)), 2.0);
      // Example: 5 min delay = 0.8x, 10 min = 1.0x, 20 min = 1.4x, 30 min = 1.8x
      const baseMaxDist = road.impactLevel === 'high' ? 250 : 180;
      const maxDist = baseMaxDist * severityMultiplier;
      
      const trimmedCoords = road.coordinates.filter(c => {
        const dist = getDistance(center.lat, center.lng, c.lat, c.lng);
        return dist < maxDist;
      });
      if (trimmedCoords.length >= 2) {
        drawRoadWithGradient({ ...road, coordinates: trimmedCoords });
      }
    });

    // ========================================
    // 3. RENDER MAIN ROAD (Highest priority)
    // ========================================
    if (mainRoad) {
      // ✅ Trim main road based on severity - congestion extends further during heavy traffic
      // ✅ Delay-based calculation: 1 minute delay = ~20m spread
      const currentDelay = currentHourData?.delay_info?.additional_delay_min ?? simulationResults.summary.avg_delay_minutes ?? 5;
      const severityMultiplier = Math.min(Math.max(0.6, 0.6 + (currentDelay / 25)), 2.0);
      // Example: 5 min delay = 0.8x, 10 min = 1.0x, 20 min = 1.4x, 30 min = 1.8x
      const maxMainDist = 300 * severityMultiplier;
      
      const trimmedMainCoords = mainRoad.coordinates.filter(c => {
        const dist = getDistance(center.lat, center.lng, c.lat, c.lng);
        return dist < maxMainDist;
      });
      
      if (trimmedMainCoords.length >= 2) {
        drawRoadWithGradient({ ...mainRoad, coordinates: trimmedMainCoords }, true);
      }
    }

    // ========================================
    // 4. DISRUPTION EPICENTER MARKER
    // ========================================
    const epicenterColor = getImpactColor('direct', baseSeverity);
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
              border: 3px solid ${epicenterColor};
              border-radius: 50%;
              opacity: 0.3;
              animation: pulse-ring 2s ease-out infinite;
            "></div>
            <div style="
              background: white;
              border: 4px solid ${epicenterColor};
              border-radius: 50%;
              width: 56px;
              height: 56px;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 28px;
              box-shadow: 0 8px 24px rgba(0,0,0,0.3);
              position: relative;
              z-index: 10;
            ">🚧</div>
            <style>
              @keyframes pulse-ring {
                0% { transform: translate(-50%, -50%) scale(1); opacity: 0.3; }
                100% { transform: translate(-50%, -50%) scale(2); opacity: 0; }
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

    if (allCoords.length > 0) {
      map.fitBounds(L.latLngBounds(allCoords), { padding: [60, 60], maxZoom: 17 });
    }

  }, [simulationResults, selectedLocation, roadInfo, roadNetwork, loading, mapReady, currentHourIndex]);

  // ========================================
  // POPUP CREATORS
  // ========================================
  
  function createRoadPopup(road, baseSeverity) {
    const adjustedSeverity = baseSeverity * road.impactMultiplier;
    const color = adjustedSeverity >= 1.5 ? '#ea580c' : adjustedSeverity >= 1.0 ? '#eab308' : '#22c55e';
    const severityLabel = adjustedSeverity >= 1.5 ? 'Heavy' : adjustedSeverity >= 1.0 ? 'Moderate' : 'Light';
    
    const connectionLabel = road.connectionType === 'intersection' 
      ? `🔗 Direct intersection (${road.sharedNodeCount} shared points)`
      : `📍 ${Math.round(road.distanceToDisruption)}m from disruption`;
    
    return `
      <div style="font-family: -apple-system, sans-serif; padding: 12px; min-width: 220px;">
        <h4 style="margin: 0 0 8px 0; font-size: 14px; font-weight: 600;">${road.name}</h4>
        
        <div style="background: ${color}15; border-left: 3px solid ${color}; padding: 8px; border-radius: 4px; margin-bottom: 8px;">
          <p style="margin: 0; font-weight: 600; color: ${color}; font-size: 13px;">
            ${road.impactLevel.charAt(0).toUpperCase() + road.impactLevel.slice(1)} Impact
          </p>
          <p style="margin: 4px 0 0 0; font-size: 11px; color: #666;">
            Expected: ${severityLabel} congestion
          </p>
        </div>
        
        <div style="font-size: 11px; color: #4b5563; line-height: 1.5;">
          <p style="margin: 4px 0;">${connectionLabel}</p>
          <p style="margin: 4px 0;"><strong>Type:</strong> ${road.type} • ${road.lanes} lanes</p>
        </div>
      </div>
    `;
  }

  function createMainRoadPopup(road, severity, results, currentHourInfo) {
    const color = severity >= 1.5 ? '#dc2626' : severity >= 1.0 ? '#ea580c' : '#f59e0b';
    const severityLabel = currentHourInfo?.severity_label ?? results.summary.avg_severity_label;
    const delayMin = currentHourInfo?.delay_info?.additional_delay_min ?? results.summary.avg_delay_minutes;
    const timeInfo = currentHourInfo?.datetime ? `<p style="margin: 4px 0 0 0; font-size: 10px; color: #888;">📅 ${currentHourInfo.datetime}</p>` : '';
    
    return `
      <div style="font-family: -apple-system, sans-serif; padding: 12px; min-width: 240px;">
        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px;">
          <div style="font-size: 28px; width: 44px; height: 44px; background: ${color}20; border: 3px solid ${color}; border-radius: 10px; display: flex; align-items: center; justify-content: center;">🚧</div>
          <div>
            <h3 style="margin: 0; font-size: 15px; font-weight: 600;">${road.road_name || road.name}</h3>
            <p style="margin: 2px 0 0 0; font-size: 11px; color: #6b7280;">Primary Affected Road</p>
          </div>
        </div>
        
        <div style="background: ${color}15; border-left: 3px solid ${color}; padding: 10px; border-radius: 6px; margin-bottom: 10px;">
          <p style="margin: 0; font-weight: 600; color: ${color}; font-size: 14px;">${severityLabel} Congestion</p>
          <p style="margin: 6px 0 0 0; font-size: 12px;">Est. delay: <strong>+${delayMin} min</strong></p>
          ${timeInfo}
        </div>

        <div style="font-size: 11px; color: #4b5563;">
          <p style="margin: 4px 0;"><strong>Type:</strong> ${road.road_type || road.type} • ${road.lanes} lanes</p>
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
          <p style="margin: 4px 0;"><strong>Type:</strong> ${results.input?.disruption_type || 'N/A'}</p>
          <p style="margin: 4px 0;"><strong>Area:</strong> ${results.input?.area || 'N/A'}</p>
          <p style="margin: 4px 0;"><strong>Duration:</strong> ${results.summary?.total_hours || 0}h</p>
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
          </div>
        </div>
      )}

      {!loading && mapReady && simulationResults && (
        <>
          {/* Legend with Gradient */}
          <div className="absolute bottom-6 right-6 bg-white rounded-xl p-4 shadow-xl z-[1000] border border-gray-200" style={{maxWidth: '200px'}}>
            <h4 className="font-bold text-gray-800 mb-3 text-sm flex items-center gap-2">
              🎯 Impact Zones
            </h4>
            
            {/* Gradient Bar */}
            <div className="mb-3">
              <div className="h-3 rounded-full" style={{
                background: 'linear-gradient(to right, #dc2626, #ea580c, #f59e0b, #eab308, #84cc16, #22c55e)'
              }}></div>
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>Direct</span>
                <span>Low</span>
              </div>
            </div>

            <div className="space-y-1.5 text-xs">
              <div className="flex items-center gap-2">
                <div className="w-4 h-2 rounded bg-red-600"></div>
                <span>Direct Impact</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-2 rounded bg-orange-500"></div>
                <span>High ({roadNetwork.connectedRoads.filter(r => r.impactLevel === 'high').length})</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-2 rounded bg-amber-500"></div>
                <span>Medium-High</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-2 rounded bg-yellow-500"></div>
                <span>Medium</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-2 rounded bg-green-500"></div>
                <span>Low ({roadNetwork.nearbyRoads.length})</span>
              </div>
            </div>
            
            <div className="mt-3 pt-3 border-t border-gray-200 text-xs text-gray-600">
              <p><strong>Total:</strong> {roadNetwork.connectedRoads.length + roadNetwork.nearbyRoads.length + (roadNetwork.mainRoad ? 1 : 0)} roads</p>
            </div>
          </div>

          {/* Info Panel */}
          <div className="absolute top-6 left-6 bg-white rounded-xl px-4 py-3 shadow-lg z-[1000] border border-gray-200">
            <p className="text-sm font-semibold text-gray-800 flex items-center gap-2">
              📊 Network Impact
            </p>
            <p className="text-xs text-gray-600 mt-1">
              {roadNetwork.connectedRoads.length + roadNetwork.nearbyRoads.length + (roadNetwork.mainRoad ? 1 : 0)} roads • 
              {roadNetwork.connectedRoads.filter(r => r.connectionType === 'intersection').length} intersections
            </p>
          </div>
        </>
      )}

      {/* Time Playback Control */}
      {!loading && simulationResults?.hourly_predictions?.length > 1 && (
        <div className="absolute bottom-6 left-6 bg-white rounded-xl px-4 py-3 shadow-lg z-[1000]" style={{maxWidth: '320px'}}>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsAnimating(!isAnimating)}
              className={`px-3 py-1.5 rounded-lg font-semibold text-xs transition ${
                isAnimating 
                  ? 'bg-red-500 text-white hover:bg-red-600' 
                  : 'bg-orange-500 text-white hover:bg-orange-600'
              }`}
            >
              {isAnimating ? '⏹ Stop' : '▶ Play'}
            </button>
            <div className="flex-1">
              <input
                type="range"
                min="0"
                max={simulationResults.hourly_predictions.length - 1}
                value={currentHourIndex}
                onChange={(e) => setCurrentHourIndex(parseInt(e.target.value))}
                className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              />
              <p className="text-xs text-gray-600 mt-1">
                {simulationResults.hourly_predictions[currentHourIndex]?.datetime || 'N/A'}
              </p>
            </div>
            <span className={`text-xs font-bold px-2 py-1 rounded ${
              getCurrentHourSeverity() < 0.5 ? 'bg-green-100 text-green-700' :
              getCurrentHourSeverity() < 1.5 ? 'bg-yellow-100 text-yellow-700' :
              'bg-red-100 text-red-700'
            }`}>
              {simulationResults.hourly_predictions[currentHourIndex]?.severity_label || 'N/A'}
            </span>
          </div>
        </div>
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