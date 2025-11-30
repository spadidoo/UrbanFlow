// frontend/components/SmartResultsMap.jsx - FULLY OPTIMIZED VERSION
// All improvements implemented: color scaling, performance, OSM retry, anti-flicker, bug fixes

"use client";

import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect, useMemo, useRef, useState } from "react";
import calambaContext from "../../backend/models/data/calamba_context.json";
import {
  getConnectedRoads,
  isGoogleApiEnabled,
} from "../../frontend/services/googleRoadsService";

// Fix Leaflet icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

// ✅ Canvas renderer for better performance
const canvasRenderer = L.canvas({ padding: 0.5 });

export default function SmartResultsMap({
  simulationResults,
  selectedLocation,
  roadInfo,
}) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const layersRef = useRef([]);
  const lastRenderedHourRef = useRef(-1); // ✅ Track last rendered hour
  const segmentLayersRef = useRef(new Map()); // ✅ Store segments for fast updates
  const roadNetworkCacheRef = useRef(new Map()); // ✅ Cache road network data

  // ✅ Layer groups for better performance
  const layerGroupsRef = useRef({
    shadows: null,
    mainRoads: null,
    connectedRoads: null,
    nearbyRoads: null,
    markers: null,
  });

  const [roadNetwork, setRoadNetwork] = useState({
    mainRoad: null,
    connectedRoads: [],
    nearbyRoads: [],
  });
  const [loading, setLoading] = useState(true);
  const [mapReady, setMapReady] = useState(false);
  const [currentHourIndex, setCurrentHourIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [apiStatus, setApiStatus] = useState({ status: "idle", message: "" }); // ✅ API status tracking
  const [useGoogleApi, setUseGoogleApi] = useState(true); // Toggle for Google API
  const [googleRoadsData, setGoogleRoadsData] = useState(null);

  // Get severity for current hour - memoized to prevent recalculation
  const currentHourSeverity = useMemo(() => {
    if (
      !simulationResults?.hourly_predictions ||
      simulationResults.hourly_predictions.length === 0
    ) {
      return simulationResults?.summary?.avg_severity || 1.0;
    }
    const hourData = simulationResults.hourly_predictions[currentHourIndex];
    return hourData?.severity ?? simulationResults.summary.avg_severity;
  }, [simulationResults, currentHourIndex]);

  const getCurrentHourSeverity = () => currentHourSeverity;

  // ✅ FIXED: Animation without glitching
  useEffect(() => {
    if (!isAnimating || !simulationResults?.hourly_predictions) return;

    const interval = setInterval(() => {
      setCurrentHourIndex((prev) => {
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

  // ✅ Keyboard controls
  useEffect(() => {
    if (!simulationResults?.hourly_predictions) return;

    const handleKeyPress = (e) => {
      if (e.target.tagName === "INPUT") return; // Ignore if typing in input

      if (e.key === " ") {
        e.preventDefault();
        setIsAnimating((prev) => !prev);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        setCurrentHourIndex((prev) => Math.max(0, prev - 1));
        setIsAnimating(false);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        setCurrentHourIndex((prev) =>
          Math.min(simulationResults.hourly_predictions.length - 1, prev + 1)
        );
        setIsAnimating(false);
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, [simulationResults]);

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
      preferCanvas: true, // ✅ Use canvas for better performance
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap contributors",
      maxZoom: 19,
    }).addTo(map);

    mapInstanceRef.current = map;

    // ✅ Create layer groups
    layerGroupsRef.current.shadows = L.layerGroup().addTo(map);
    layerGroupsRef.current.nearbyRoads = L.layerGroup().addTo(map);
    layerGroupsRef.current.connectedRoads = L.layerGroup().addTo(map);
    layerGroupsRef.current.mainRoads = L.layerGroup().addTo(map);
    layerGroupsRef.current.markers = L.layerGroup().addTo(map);

    // ✅ Set z-indices for proper layering
    layerGroupsRef.current.shadows.setZIndex(100);
    layerGroupsRef.current.nearbyRoads.setZIndex(200);
    layerGroupsRef.current.connectedRoads.setZIndex(300);
    layerGroupsRef.current.mainRoads.setZIndex(400);
    layerGroupsRef.current.markers.setZIndex(500);

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
  // FETCH ROAD NETWORK WITH RETRY & CACHE
  // ========================================
  useEffect(() => {
    if (!selectedLocation || !simulationResults || !mapReady) return;

    // ✅ NEW: Fetch roads using Google API
    const fetchGoogleRoads = async () => {
      if (!useGoogleApi || !isGoogleApiEnabled()) {
        console.log("⚠️ Google API disabled, skipping...");
        return null;
      }

      try {
        setApiStatus({
          status: "loading",
          message: "Fetching roads from Google Maps...",
        });

        const center = selectedLocation.center;

        // Get severity to determine radius
        const avgSeverity = simulationResults?.summary?.avg_severity || 1.0;
        const baseRadius =
          avgSeverity >= 1.5 ? 1000 : avgSeverity >= 1.0 ? 700 : 500;

        const googleRoads = await getConnectedRoads(
          center.lat,
          center.lng,
          baseRadius
        );

        if (googleRoads && googleRoads.length > 0) {
          console.log(
            "✅ Google Roads loaded:",
            googleRoads.map((r) => r.name)
          );
          setGoogleRoadsData(googleRoads);
          return googleRoads;
        }

        return null;
      } catch (error) {
        console.error("❌ Google API failed:", error);
        return null;
      }
    };

    const fetchRoadNetworkWithRetry = async (retries = 3, delay = 1000) => {
      const cacheKey = `${selectedLocation.center.lat.toFixed(
        4
      )}_${selectedLocation.center.lng.toFixed(4)}`;

      // ✅ Check cache first
      if (roadNetworkCacheRef.current.has(cacheKey)) {
        console.log("📦 Using cached road network");
        setRoadNetwork(roadNetworkCacheRef.current.get(cacheKey));
        setApiStatus({ status: "success", message: "" });
        setLoading(false);
        return;
      }

      setLoading(true);
      setApiStatus({ status: "loading", message: "Fetching road network..." });

      // ✅ TRY GOOGLE API FIRST (if enabled)
      if (useGoogleApi && isGoogleApiEnabled()) {
        const googleRoads = await fetchGoogleRoads();
        if (googleRoads && googleRoads.length >= 2) {
          // Process Google roads into our format
          const processedNetwork = processGoogleRoads(
            googleRoads,
            selectedLocation.center,
            roadInfo
          );

          roadNetworkCacheRef.current.set(cacheKey, processedNetwork);
          setRoadNetwork(processedNetwork);
          setApiStatus({ status: "success", message: "Google Maps data" });
          setLoading(false);
          return;
        }
        console.log(
          "⚠️ Google API returned insufficient data, falling back to OSM..."
        );
      }

      for (let attempt = 0; attempt < retries; attempt++) {
        try {
          const center = selectedLocation.center;
          const searchRadius = 900;

          const query = `
            [out:json][timeout:30];
            (
              way["highway"~"^(trunk|trunk_link|primary|primary_link|secondary|secondary_link|tertiary)$"]
                ["name"]
                (around:${searchRadius},${center.lat},${center.lng});
              way["highway"]["name"~"Ipil|National|Manila|Maharlika|Chipeco",i]
                (around:${searchRadius},${center.lat},${center.lng});
            );
            out body;
            >;
            out skel qt;
          `;

          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 25000);

          setApiStatus({
            status: "retrying",
            message: `Loading... (attempt ${attempt + 1}/${retries})`,
          });

          const response = await fetch(
            "https://overpass-api.de/api/interpreter",
            {
              method: "POST",
              body: query,
              headers: { "Content-Type": "application/x-www-form-urlencoded" },
              signal: controller.signal,
            }
          );

          clearTimeout(timeoutId);

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
          }

          const data = await response.json();

          // ✅ DEBUG: Log all roads returned by OSM
          const debugWays = data.elements
            .filter((el) => el.type === "way" && el.tags?.name)
            .map((el) => ({ name: el.tags.name, type: el.tags.highway }));
          console.log("🛣️ OSM returned these roads:", debugWays);

          if (data.elements && data.elements.length > 0) {
            const processedNetwork = processRoadNetwork(
              data.elements,
              center,
              roadInfo,
              calambaContext // ✅ Use the imported constant  // ✅ Pass context
            );

            // ✅ Cache the result
            roadNetworkCacheRef.current.set(cacheKey, processedNetwork);

            // ✅ Limit cache size to 10 locations
            if (roadNetworkCacheRef.current.size > 10) {
              const firstKey = roadNetworkCacheRef.current.keys().next().value;
              roadNetworkCacheRef.current.delete(firstKey);
            }

            setRoadNetwork(processedNetwork);
            setApiStatus({ status: "success", message: "" });
            console.log(`✅ Road network fetched (attempt ${attempt + 1}):`, {
              mainRoad: processedNetwork.mainRoad?.name,
              connected: processedNetwork.connectedRoads.length,
              nearby: processedNetwork.nearbyRoads.length,
            });
            setLoading(false);
            return;
          } else {
            throw new Error("No road data returned");
          }
        } catch (error) {
          console.warn(
            `⚠️ OSM API attempt ${attempt + 1} failed:`,
            error.message
          );

          if (attempt === retries - 1) {
            // ✅ Final fallback: Use main road data from simulation if available
            if (roadInfo?.coordinates?.length > 1) {
              const fallbackNetwork = {
                mainRoad: {
                  id: "fallback-main",
                  name: roadInfo.road_name || "Main Road",
                  road_name: roadInfo.road_name,
                  road_type: roadInfo.road_type || "primary",
                  type: roadInfo.road_type || "primary",
                  lanes: roadInfo.lanes || 2,
                  maxspeed: 40,
                  coordinates: roadInfo.coordinates,
                  isMainRoad: true,
                  impactLevel: "direct",
                  distanceToDisruption: 0,
                  length_km:
                    roadInfo.length_km ||
                    calculateRoadLength(roadInfo.coordinates),
                  isFallback: true,
                },
                connectedRoads: [],
                nearbyRoads: [],
              };
              setRoadNetwork(fallbackNetwork);
              setApiStatus({
                status: "fallback",
                message: "Using limited road data",
              });
              console.log("📍 Using fallback road data from simulation");
            } else {
              setRoadNetwork({
                mainRoad: null,
                connectedRoads: [],
                nearbyRoads: [],
              });
              setApiStatus({
                status: "failed",
                message: "No road data available",
              });
              console.error(
                "❌ All OSM API attempts failed, no fallback data available"
              );
            }
            setLoading(false);
            return;
          }

          // Wait before retry with exponential backoff
          await new Promise((resolve) =>
            setTimeout(resolve, delay * Math.pow(2, attempt))
          );
        }
      }
    };

    fetchRoadNetworkWithRetry();
  }, [selectedLocation, simulationResults, roadInfo, mapReady]);

  // âœ… ADD THIS HELPER: Check if road segment is actually connected to main disruption area
  function isSegmentConnectedToDisruption(coords, center, maxAllowedGap = 100) {
    // Check if ANY point in this segment is within reasonable distance to disruption
    const hasNearbyPoint = coords.some((coord) => {
      const dist = getDistance(center.lat, center.lng, coord.lat, coord.lng);
      return dist < maxAllowedGap;
    });

    return hasNearbyPoint;
  }
  // ========================================
  // PROCESS ROAD NETWORK
  // ========================================
  function processRoadNetwork(elements, center, roadInfo, context) {
    const nodes = elements.filter((el) => el.type === "node");
    const nodeMap = new Map(nodes.map((n) => [n.id, n]));

    const ways = elements
      .filter((el) => el.type === "way" && el.tags && el.tags.highway)
      .map((way) => {
        const coords = way.nodes
          .map((nodeId) => nodeMap.get(nodeId))
          .filter((n) => n)
          .map((n) => ({ lat: n.lat, lng: n.lon, nodeId: n.id }));

        if (coords.length < 2) return null;

        // âœ… NEW: Check if this segment is actually near the disruption
        if (!isSegmentConnectedToDisruption(coords, center, 600)) {
          console.log(
            `âŒ Filtering disconnected segment: ${way.tags.name || "unnamed"}`
          );
          return null; // Skip disconnected segments
        }

        const distances = coords.map((c) =>
          getDistance(center.lat, center.lng, c.lat, c.lng)
        );
        const minDist = Math.min(...distances);

        return {
          id: way.id,
          name: way.tags.name || `${way.tags.highway} road`,
          type: way.tags.highway,
          lanes: parseInt(way.tags.lanes) || estimateLanes(way.tags.highway),
          maxspeed:
            parseInt(way.tags.maxspeed) || estimateSpeed(way.tags.highway),
          coordinates: coords,
          nodeIds: new Set(way.nodes),
          minDistToCenter: minDist,
        };
      })
      .filter(Boolean);

    // ============================================
    // ✅ CONTEXT-AWARE ROAD INCLUSION HELPER
    // ============================================
    function shouldForceIncludeRoad(way, center, context) {
      if (!context?.traffic_corridors) return null;

      // Check if disruption is near any corridor trigger point
      for (const corridor of context.traffic_corridors) {
        for (const trigger of corridor.disruption_triggers) {
          const distToTrigger = getDistance(
            center.lat,
            center.lng,
            trigger.lat,
            trigger.lng
          );

          if (distToTrigger <= trigger.radius_m) {
            // ✅ Disruption matches this corridor
            console.log(`🎯 Corridor matched: ${corridor.name}`);

            // Check if this road is in the critical list
            for (const criticalRoad of corridor.critical_roads) {
              const nameMatch = criticalRoad.name_patterns.some((pattern) =>
                way.name.toLowerCase().includes(pattern.toLowerCase())
              );

              const typeMatch = criticalRoad.road_types.includes(way.type);

              if ((nameMatch || typeMatch) && criticalRoad.force_include) {
                console.log(
                  `✅ Force-including: ${way.name} (${criticalRoad.reason})`
                );
                return {
                  force: true,
                  impactLevel: criticalRoad.impact_level || "high",
                  reason: criticalRoad.reason,
                };
              }
            }
          }
        }
      }

      return null;
    }

    function checkIfShouldExclude(way, context) {
      // ✅ 1. Exclude roads with no name (unnamed alleys, etc.)
      if (!way.name || way.name.toLowerCase().includes("unnamed")) {
        return "No name";
      }

      // ✅ 2. Check if this is a critical road BEFORE excluding by type
      const isCriticalRoad =
        way.name.toLowerCase().includes("ipil") ||
        way.name.toLowerCase().includes("bucal") ||
        way.name.toLowerCase().includes("national") ||
        way.name.toLowerCase().includes("maharlika") ||
        way.name.toLowerCase().includes("chipeco");

      // ✅ 3. Exclude service roads, parking areas, driveways - BUT NOT critical roads
      const excludedTypes = [
        "service",
        "footway",
        "path",
        "cycleway",
        "living_street",
        "pedestrian",
      ];
      if (excludedTypes.includes(way.type)) {
        return `Type: ${way.type}`;
      }
      // ✅ 4. Exclude very short disconnected segments (< 50m total length)
      const roadLength = way.coordinates.reduce((sum, coord, i) => {
        if (i === 0) return 0;
        const prev = way.coordinates[i - 1];
        return sum + getDistance(prev.lat, prev.lng, coord.lat, coord.lng);
      }, 0);

      if (roadLength < 50 && !isCriticalRoad) {
        return "Too short (< 50m)";
      }
      // ✅ 4. Exclude unclassified/residential UNLESS it's a critical road
      if (
        (way.type === "unclassified" || way.type === "residential") &&
        !isCriticalRoad
      ) {
        return `Type: ${way.type} (not critical)`;
      }

      // ✅ 4. Context-based exclusions - BUT skip if critical road
      if (context?.traffic_corridors && !isCriticalRoad) {
        for (const corridor of context.traffic_corridors) {
          const excludeRules = corridor.exclude_roads || [];

          for (const rule of excludeRules) {
            const nameMatch = rule.name_patterns.some((pattern) =>
              way.name.toLowerCase().includes(pattern.toLowerCase())
            );

            const typeMatch = rule.road_types.includes(way.type);

            if (nameMatch || typeMatch) {
              return rule.reason;
            }
          }
        }
      }

      return null; // Don't exclude
    }

    // Find main road
    let mainRoad = null;
    let mainRoadWay = null;

    if (roadInfo?.road_name) {
      mainRoadWay = ways.find(
        (w) =>
          w.name.toLowerCase().includes(roadInfo.road_name.toLowerCase()) ||
          roadInfo.road_name.toLowerCase().includes(w.name.toLowerCase())
      );
    }

    if (!mainRoadWay) {
      mainRoadWay = ways.reduce(
        (closest, way) =>
          !closest || way.minDistToCenter < closest.minDistToCenter
            ? way
            : closest,
        null
      );
    }

    if (mainRoadWay) {
      mainRoad = {
        ...mainRoadWay,
        road_name: mainRoadWay.name,
        road_type: mainRoadWay.type,
        isMainRoad: true,
        impactLevel: "direct",
        distanceToDisruption: 0,
        coordinates:
          roadInfo?.coordinates?.length > 1
            ? roadInfo.coordinates
            : mainRoadWay.coordinates,
        length_km:
          roadInfo?.length_km || calculateRoadLength(mainRoadWay.coordinates),
      };
    }

    const mainRoadNodeIds = mainRoadWay?.nodeIds || new Set();

    // Classify other roads
    const connectedRoads = [];
    const nearbyRoads = [];

    ways.forEach((way) => {
      if (mainRoadWay && way.id === mainRoadWay.id) return;

      // ✅ NEW: EXCLUDE UNWANTED ROADS FIRST
      const shouldExclude = checkIfShouldExclude(way, context);
      if (shouldExclude) {
        console.log(`❌ Excluding: ${way.name} (${shouldExclude})`);
        return; // Skip this road
      }

      // ✅ CHECK CONTEXT FIRST
      const forceInclude = shouldForceIncludeRoad(way, center, context);

      if (forceInclude?.force) {
        const roadData = {
          ...way,
          road_name: way.name,
          road_type: way.type,
          impactLevel: forceInclude.impactLevel,
          impactMultiplier: 0.95, // Always high impact
          distanceToDisruption: way.minDistToCenter,
          connectionType: "critical_corridor",
          reason: forceInclude.reason,
          isCriticalPath: true,
          sharedNodeCount: 0, // Not intersection-based
          passesNearCenter: false,
          isLetranExitRoute: false,
        };

        connectedRoads.push(roadData);
        console.log(`✅ Added critical road: ${way.name}`);
        return; // Skip normal classification
      }

      const sharedNodes = [...way.nodeIds].filter((nodeId) =>
        mainRoadNodeIds.has(nodeId)
      );
      const isDirectlyConnected = sharedNodes.length > 0;

      // ✅ NEW: Check if road passes near disruption center (catches all intersection directions)
      const passesNearCenter = way.coordinates.some(
        (coord) =>
          getDistance(center.lat, center.lng, coord.lat, coord.lng) < 180
      );

      // ✅ NEW: Check if this is Ipil-Ipil Street  (Letran exit routes)
      const isLetranExitRoute =
        way.name.toLowerCase().includes("ipil-ipil") ||
        way.name.toLowerCase().includes("ipil ipil");

      // ✅ SMART: Major highways get special treatment
      const isMajorHighway =
        way.name.toLowerCase().includes("national") ||
        way.name.toLowerCase().includes("maharlika") ||
        way.name.toLowerCase().includes("highway") ||
        ["trunk", "primary"].includes(way.type);

      const hasProximity = way.minDistToCenter < (isMajorHighway ? 800 : 300); // ✅ Highways can be farther
      const hasPhysicalLink =
        isLetranExitRoute || passesNearCenter || isDirectlyConnected;

      // ✅ NEW: Highways don't need node connection, just proximity
      const hasNetworkPath =
        isMajorHighway ||
        hasPhysicalLink ||
        (sharedNodes.length > 0 &&
          way.coordinates.some(
            (coord) =>
              getDistance(center.lat, center.lng, coord.lat, coord.lng) < 250
          ));

      const isAccessibleFromMainRoad = hasProximity && hasNetworkPath;

      // ✅ DEBUG
      if (way.name.includes("National")) {
        console.log(
          `🛣️ National Highway check: proximity=${hasProximity}, network=${hasNetworkPath}, dist=${way.minDistToCenter.toFixed(
            0
          )}m`
        );
      }

      if (
        !isAccessibleFromMainRoad &&
        way.minDistToCenter > 100 &&
        !isMajorHighway
      ) {
        console.log(
          `⚠️ Skipping disconnected road: ${
            way.name
          } (${way.minDistToCenter.toFixed(0)}m away)`
        );
        return;
      }

      if (isMajorHighway && way.minDistToCenter < 800) {
        console.log(
          `✅ Including major highway: ${
            way.name
          } (${way.minDistToCenter.toFixed(0)}m)`
        );
      }

      let impactLevel, impactMultiplier;

      // ✅ PRIORITY BOOST for Letran exit routes
      if (isLetranExitRoute) {
        impactLevel = "high";
        impactMultiplier = 0.95; // Treat as critical
        console.log(`✅ Letran exit route detected: ${way.name}`);
      }

      // Roads passing directly through disruption area
      else if (passesNearCenter) {
        impactLevel = "high";
        impactMultiplier = 0.95;
      } else if (isDirectlyConnected) {
        impactLevel = "high";
        impactMultiplier = 0.85;
      } else if (way.minDistToCenter < 160) {
        // ✅ Only include if it's a major road type
        if (
          ![
            "trunk",
            "trunk_link",
            "primary",
            "primary_link",
            "secondary",
            "secondary_link",
          ].includes(way.type)
        ) {
          return; // Skip minor roads that are just nearby
        }
        impactLevel = "medium-high";
        impactMultiplier = 0.7;
      } else if (way.minDistToCenter < 300) {
        // ✅ Only trunk/primary roads at this distance
        if (
          !["trunk", "trunk_link", "primary", "primary_link"].includes(way.type)
        ) {
          return;
        }
        impactLevel = "medium";
        impactMultiplier = 0.5;
      } else if (way.minDistToCenter < 500) {
        // ✅ Only trunk roads (highways) at far distances
        if (!["trunk", "trunk_link"].includes(way.type)) {
          return;
        }
        impactLevel = "low";
        impactMultiplier = 0.35;
      } else {
        return; // Too far, skip
      }

      const roadData = {
        ...way,
        impactLevel,
        impactMultiplier,
        distanceToDisruption: way.minDistToCenter,
        connectionType: isLetranExitRoute
          ? "letran_exit"
          : passesNearCenter
          ? "intersection"
          : isDirectlyConnected
          ? "intersection"
          : "proximity",
        sharedNodeCount: sharedNodes.length,
        passesNearCenter: passesNearCenter,
        isLetranExitRoute: isLetranExitRoute, // ✅ Flag for later use
      };

      // ✅ Letran exit routes ALWAYS go to connectedRoads (high priority)
      // ✅ Only include roads that are CONNECTED or pass through the intersection
      // NOT roads that are just nearby by distance
      const isActuallyConnected =
        isLetranExitRoute || passesNearCenter || isDirectlyConnected;

      // ✅ STRICT: Only include roads that are ACTUALLY CONNECTED
      if (isAccessibleFromMainRoad) {
        // ✅ EXTRA CHECK: Verify the road physically connects to main road or passes through disruption
        const hasPhysicalConnection =
          isDirectlyConnected || passesNearCenter || isLetranExitRoute;

        if (hasPhysicalConnection) {
          connectedRoads.push(roadData);
        } else {
          console.log(
            `⚠️ Blocked disconnected road: ${way.name} (no physical connection)`
          );
        }
      } else if (
        ["trunk", "trunk_link", "primary", "primary_link"].includes(way.type) &&
        way.minDistToCenter < 150
      ) {
        // ✅ Reduced from 200m to 150m for nearby roads
        // Must also share nodes with main road or be a parallel highway
        if (sharedNodes.length > 0 || way.type.includes("trunk")) {
          nearbyRoads.push(roadData);
        }
      }
      // ✅ Everything else is rejected (no more stray lines)
      // Skip roads that are just within radius but not connected
    });

    connectedRoads.sort(
      (a, b) => a.distanceToDisruption - b.distanceToDisruption
    );
    nearbyRoads.sort((a, b) => a.distanceToDisruption - b.distanceToDisruption);

    return {
      mainRoad,
      connectedRoads: connectedRoads.slice(0, 15),
      nearbyRoads: nearbyRoads.slice(0, 8),
    };
  }

  // ========================================
  // PROCESS GOOGLE ROADS DATA
  // ========================================
  function processGoogleRoads(googleRoads, center, roadInfo) {
    if (!googleRoads || googleRoads.length === 0) {
      return { mainRoad: null, connectedRoads: [], nearbyRoads: [] };
    }

    // Find the main road (longest or primary type)
    let mainRoad = null;
    const connectedRoads = [];

    // Sort by distance (roads passing closest to center first)
    const sortedRoads = [...googleRoads].sort((a, b) => {
      const aMinDist = Math.min(
        ...a.coordinates.map((c) =>
          getDistance(center.lat, center.lng, c.lat, c.lng)
        )
      );
      const bMinDist = Math.min(
        ...b.coordinates.map((c) =>
          getDistance(center.lat, center.lng, c.lat, c.lng)
        )
      );
      return aMinDist - bMinDist;
    });

    sortedRoads.forEach((road, index) => {
      // Calculate min distance to center
      const distances = road.coordinates.map((c) =>
        getDistance(center.lat, center.lng, c.lat, c.lng)
      );
      const minDist = Math.min(...distances);

      // Determine impact level based on distance
      let impactLevel, impactMultiplier;
      if (minDist < 100) {
        impactLevel = "direct";
        impactMultiplier = 1.0;
      } else if (minDist < 200) {
        impactLevel = "high";
        impactMultiplier = 0.9;
      } else if (minDist < 400) {
        impactLevel = "medium-high";
        impactMultiplier = 0.75;
      } else {
        impactLevel = "medium";
        impactMultiplier = 0.6;
      }

      const roadData = {
        id: road.id,
        name: road.name,
        road_name: road.name,
        road_type: road.road_type,
        type: road.road_type,
        lanes: road.lanes,
        maxspeed: road.road_type === "primary" ? 60 : 40,
        coordinates: road.coordinates,
        direction: road.direction,
        distance_meters: road.distance_meters,
        minDistToCenter: minDist,
        impactLevel: impactLevel,
        impactMultiplier: impactMultiplier,
        distanceToDisruption: minDist,
        connectionType: "google_directions",
        isGoogleData: true,
        passesNearCenter: minDist < 150,
      };

      // First road closest to center is main road
      if (index === 0 || (road.road_type === "primary" && !mainRoad)) {
        mainRoad = {
          ...roadData,
          isMainRoad: true,
          impactLevel: "direct",
          length_km: (road.distance_meters / 1000).toFixed(2),
        };
      } else {
        connectedRoads.push(roadData);
      }
    });

    console.log("✅ Processed Google roads:", {
      mainRoad: mainRoad?.name,
      connected: connectedRoads.map((r) => r.name),
    });

    return {
      mainRoad,
      connectedRoads: connectedRoads.slice(0, 5), // Limit to top 5
      nearbyRoads: [], // Google API gives us direct connections, no "nearby"
    };
  }

  // ========================================
  // HELPER FUNCTIONS
  // ========================================

  function calculateRoadLength(coords) {
    let length = 0;
    for (let i = 0; i < coords.length - 1; i++) {
      length += getDistance(
        coords[i].lat,
        coords[i].lng,
        coords[i + 1].lat,
        coords[i + 1].lng
      );
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

  // ✅ IMPROVED: Continuous color scaling with smooth transitions
  const getImpactColor = (impactLevel, severity) => {
    const colors = {
      light: { start: "#16a34a", mid: "#22c55e", end: "#84cc16" }, // Green shades
      moderate: { start: "#f59e0b", mid: "#fb923c", end: "#fb923c" }, // Orange shades
      heavy: { start: "#ef4444", mid: "#dc2626", end: "#b91c1c" }, // RED shades (more intense)
    };

    let tier, position;
    if (severity < 0.5) {
      tier = "light";
      position = severity / 0.5;
    } else if (severity < 1.2) {
      tier = "moderate";
      position = (severity - 0.5) / 0.7;
    } else {
      tier = "heavy";
      position = Math.min((severity - 1.2) / 1.3, 1.0);
    }

    const interpolateColor = (color1, color2, factor) => {
      const c1 = parseInt(color1.slice(1), 16);
      const c2 = parseInt(color2.slice(1), 16);
      const r1 = (c1 >> 16) & 0xff,
        g1 = (c1 >> 8) & 0xff,
        b1 = c1 & 0xff;
      const r2 = (c2 >> 16) & 0xff,
        g2 = (c2 >> 8) & 0xff,
        b2 = c2 & 0xff;
      const r = Math.round(r1 + factor * (r2 - r1));
      const g = Math.round(g1 + factor * (g2 - g1));
      const b = Math.round(b1 + factor * (b2 - b1));
      return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
    };

    let baseColor;
    if (position < 0.5) {
      baseColor = interpolateColor(
        colors[tier].start,
        colors[tier].mid,
        position * 2
      );
    } else {
      baseColor = interpolateColor(
        colors[tier].mid,
        colors[tier].end,
        (position - 0.5) * 2
      );
    }

    const impactMultipliers = {
      direct: 1.0,
      high: 0.9,
      "medium-high": 0.75,
      medium: 0.6,
      low: 0.4,
    };

    const multiplier = impactMultipliers[impactLevel] || 0.5;

    if (multiplier < 0.85) {
      return interpolateColor(baseColor, "#fb923c", 1 - multiplier * 0.8); // Blend to orange instead of green
    }

    return baseColor;
  };

  // ✅ FIXED: Fast color update function with batching
  const updateSegmentColors = (baseSeverity) => {
    // Batch all style updates together
    const updates = [];

    segmentLayersRef.current.forEach((segmentData, segmentId) => {
      const { layer, impactLevel, impactIntensity } = segmentData;

      const adjustedSeverity = baseSeverity * impactIntensity;
      const segmentColor = getImpactColor(impactLevel, adjustedSeverity);

      updates.push({ layer, color: segmentColor });
    });

    // Apply all updates in one batch to prevent layout thrashing
    updates.forEach(({ layer, color }) => {
      layer.setStyle({ color });
    });
  };

  // ========================================
  // RENDER ROADS WITH OPTIMIZATIONS
  // ========================================
  useEffect(() => {
    if (!mapInstanceRef.current || !simulationResults || !mapReady || loading)
      return;

    const map = mapInstanceRef.current;
    const { mainRoad, connectedRoads, nearbyRoads } = roadNetwork;

    const center = selectedLocation.center;

    const currentHourData =
      simulationResults.hourly_predictions?.[currentHourIndex];
    const baseSeverity =
      currentHourData?.severity ?? simulationResults.summary.avg_severity;

    // ✅ OPTIMIZATION: Only update colors if hour changed, not full re-render
    // ✅ OPTIMIZATION: Only update colors if hour changed, not full re-render
    // ✅ Always do full re-render when hour changes (needed for length updates)
    const hourChanged = lastRenderedHourRef.current !== currentHourIndex;

    if (hourChanged) {
      lastRenderedHourRef.current = currentHourIndex;
    }

    // ✅ IMPROVED: Proper cleanup with event listener removal
    layersRef.current.forEach((layer) => {
      try {
        if (layer && map.hasLayer(layer)) {
          if (layer.unbindPopup) layer.unbindPopup();
          if (layer.unbindTooltip) layer.unbindTooltip();
          if (layer.off) layer.off();
          map.removeLayer(layer);
        }
      } catch (e) {
        console.error("Error removing layer:", e);
      }
    });
    layersRef.current = [];
    segmentLayersRef.current.clear();

    // Clear layer groups
    Object.values(layerGroupsRef.current).forEach((group) => {
      if (group) group.clearLayers();
    });

    // ✅ IMPROVED: Road capacity-based gradient drawing
    const drawRoadWithGradient = (
      road,
      isMainRoad = false,
      groupType = "nearbyRoads"
    ) => {
      const coords = road.coordinates;
      if (coords.length < 2) return;

      // ✅ Severity-based radius expansion
      // ✅ FIXED: Smaller radius so gradient shows properly
      const severityExpansion =
        baseSeverity >= 1.5 ? 1.5 : baseSeverity >= 1.0 ? 1.2 : 1.0;
      const capacityFactor = ((road.lanes || 2) * (road.maxspeed || 40)) / 100;
      const baseImpactRadius = isMainRoad ? 180 : 80;
      const adjustedImpactRadius =
        baseImpactRadius * (1 / Math.sqrt(capacityFactor));
      const effectiveRadius = adjustedImpactRadius * severityExpansion;

      for (let i = 0; i < coords.length - 1; i++) {
        const startCoord = coords[i];
        const endCoord = coords[i + 1];

        const midLat = (startCoord.lat + endCoord.lat) / 2;
        const midLng = (startCoord.lng + endCoord.lng) / 2;
        const distToCenter = getDistance(
          center.lat,
          center.lng,
          midLat,
          midLng
        );

        let segmentImpact, impactIntensity;

        if (distToCenter < 80) {
          segmentImpact = "direct";
          impactIntensity = 1.0;
        } else if (distToCenter < 200) {
          segmentImpact = "high";
          impactIntensity = 0.95 - ((distToCenter - 80) / 120) * 0.2; // Slower falloff
        } else if (distToCenter < 400) {
          segmentImpact = "medium-high";
          impactIntensity = 0.75 - ((distToCenter - 200) / 200) * 0.2;
        } else if (distToCenter < 700) {
          segmentImpact = "medium";
          impactIntensity = 0.55 - ((distToCenter - 400) / 300) * 0.2;
        } else if (distToCenter < 1000) {
          segmentImpact = "low";
          impactIntensity = 0.35 - ((distToCenter - 700) / 300) * 0.15;
        } else {
          segmentImpact = "low";
          impactIntensity = Math.max(
            0.15,
            0.2 - ((distToCenter - 1000) / 500) * 0.05
          );
        }

        const adjustedSeverity = baseSeverity * impactIntensity;
        const segmentColor = getImpactColor(segmentImpact, adjustedSeverity);

        // ✅ DEBUG: Log first few segments to verify gradient
        if (i < 3) {
          console.log(
            `Segment ${i}: dist=${distToCenter.toFixed(
              0
            )}m, impact=${segmentImpact}, color=${segmentColor}`
          );
        }

        const maxDistance = 1200;
        const normalizedDist = Math.min(distToCenter / maxDistance, 1);
        const opacity = Math.max(
          0.4,
          (1 - Math.pow(normalizedDist, 1.3)) * 0.95
        );

        const baseWeight = isMainRoad
          ? 10
          : road.impactLevel === "high"
          ? 7
          : 5;
        const weight = baseWeight * (1 - normalizedDist * 0.3);

        const shadow = L.polyline(
          [
            [startCoord.lat, startCoord.lng],
            [endCoord.lat, endCoord.lng],
          ],
          {
            color: "#1f2937",
            weight: weight + 3,
            opacity: 0.12,
            lineCap: "round",
            renderer: canvasRenderer,
          }
        );
        layerGroupsRef.current.shadows.addLayer(shadow);
        layersRef.current.push(shadow);

        const segment = L.polyline(
          [
            [startCoord.lat, startCoord.lng],
            [endCoord.lat, endCoord.lng],
          ],
          {
            color: segmentColor,
            weight: weight,
            opacity: opacity,
            lineCap: "round",
            lineJoin: "round",
            renderer: canvasRenderer,
            className:
              adjustedSeverity >= 1.5
                ? "critical-severity-road"
                : adjustedSeverity >= 1.0
                ? "high-severity-road"
                : "",
          }
        );

        const targetGroup = isMainRoad ? "mainRoads" : groupType;
        layerGroupsRef.current[targetGroup].addLayer(segment);
        layersRef.current.push(segment);

        // ✅ Store segment reference for fast updates
        const segmentId = `${road.id}-${i}`;
        segmentLayersRef.current.set(segmentId, {
          layer: segment,
          impactLevel: segmentImpact,
          impactIntensity: impactIntensity,
        });
      }

      const fullLine = L.polyline(
        coords.map((c) => [c.lat, c.lng]),
        {
          opacity: 0,
          weight: 25,
          interactive: true,
          bubblingMouseEvents: false,
          renderer: canvasRenderer,
        }
      );

      const targetGroup = isMainRoad ? "mainRoads" : groupType;
      layerGroupsRef.current[targetGroup].addLayer(fullLine);

      if (isMainRoad) {
        fullLine.bindPopup(
          createMainRoadPopup(
            road,
            baseSeverity,
            simulationResults,
            currentHourData
          )
        );
      } else {
        fullLine.bindPopup(createRoadPopup(road, baseSeverity));
      }
      layersRef.current.push(fullLine);
    };

    // ✅ IMPROVED: Coordinate filtering to prevent gaps
    // ✅ IMPROVED: Direction-aware trimming - only extends toward disruption
    // ✅ IMPROVED: Direction-aware trimming - extends toward major roads/highways
    const trimCoordinates = (coords, maxDist, roadName = "", roadType = "") => {
      if (coords.length < 2) return coords;

      // ✅ Check if this road should extend toward National Highway
      const isFeederRoad =
        roadName.toLowerCase().includes("bucal") ||
        roadName.toLowerCase().includes("chipeco") ||
        roadName.toLowerCase().includes("turbina") ||
        roadType === "secondary" ||
        roadType === "tertiary";

      const isMainHighway =
        roadName.toLowerCase().includes("national") ||
        roadName.toLowerCase().includes("maharlika") ||
        roadName.toLowerCase().includes("highway") ||
        roadType === "trunk" ||
        roadType === "primary";

      const isChipeco = roadName.toLowerCase().includes("chipeco");
      const isIpilIpil = roadName.toLowerCase().includes("ipil");

      let closestIndex = -1;
      let minDistToCenter = Infinity;

      // Find point closest to disruption
      coords.forEach((coord, index) => {
        const dist = getDistance(center.lat, center.lng, coord.lat, coord.lng);
        if (dist < minDistToCenter) {
          minDistToCenter = dist;
          closestIndex = index;
        }
      });

      if (closestIndex === -1) return coords;

      const trimmed = [];

      // ✅ SMART DIRECTION LOGIC
      if (isMainHighway) {
        // Highways: Extend BOTH directions equally (bidirectional traffic)
        const extendPoints = 40; // Extend 25 points in each direction
        const startIndex = Math.max(0, closestIndex - extendPoints); //- 15
        const endIndex = Math.min(
          coords.length - 1,
          closestIndex + extendPoints
        );

        for (let i = startIndex; i <= endIndex; i++) {
          const coord = coords[i];
          const dist = getDistance(
            center.lat,
            center.lng,
            coord.lat,
            coord.lng
          );

          if (dist < maxDist * 2.5) {
            // Extra buffer for highways
            trimmed.push(coord);
          }
        }
      } else if (isIpilIpil) {
        // ✅ Ipil-Ipil: Very short extension (local street)
        // NOTE: previous code used a fractional extendPoints (0.2) which
        // produced non-integer indices and prevented trimming from working.
        // Use small integer counts and a small but sensible meter cap.
        const extendPoints = 1; // 1 point on each side (very short)
        const startIndex = Math.max(0, Math.floor(closestIndex - extendPoints));
        const endIndex = Math.min(
          coords.length - 1,
          Math.ceil(closestIndex + extendPoints)
        );

        for (let i = startIndex; i <= endIndex; i++) {
          const coord = coords[i];
          if (!coord) continue;
          const dist = getDistance(
            center.lat,
            center.lng,
            coord.lat,
            coord.lng
          );

          // Use a small, sensible cap (meters). Tweak 15 -> smaller/larger as desired.
          if (dist < Math.min(maxDist * 0.15, 15)) {
            trimmed.push(coord);
          }
        }
      } else if (isChipeco) {
        // Chipeco: Extend MORE in both directions for visibility
        const extendPoints = 20;
        const startIndex = Math.max(0, closestIndex - extendPoints);
        const endIndex = Math.min(
          coords.length - 1,
          closestIndex + extendPoints
        );

        for (let i = startIndex; i <= endIndex; i++) {
          const coord = coords[i];
          const dist = getDistance(
            center.lat,
            center.lng,
            coord.lat,
            coord.lng
          );

          if (dist < maxDist * 1.2) {
            trimmed.push(coord);
          }
        }
      } else if (isFeederRoad) {
        // ✅ Feeder roads: Extend MORE toward the direction AWAY from disruption
        // (traffic backs up in the direction people are trying to GO)

        // Determine which end is farther from disruption (that's the highway direction)
        const distToStart = getDistance(
          center.lat,
          center.lng,
          coords[0].lat,
          coords[0].lng
        );
        const distToEnd = getDistance(
          center.lat,
          center.lng,
          coords[coords.length - 1].lat,
          coords[coords.length - 1].lng
        );

        let startIndex, endIndex;

        if (distToEnd > distToStart) {
          // Highway is at the END - extend more in that direction
          startIndex = Math.max(0, closestIndex - 5);
          endIndex = Math.min(coords.length - 1, closestIndex + 20); // ✅ 4x more toward highway
        } else {
          // Highway is at the START - extend more in that direction
          startIndex = Math.max(0, closestIndex - 20); // ✅ 4x more toward highway
          endIndex = Math.min(coords.length - 1, closestIndex + 5);
        }

        for (let i = startIndex; i <= endIndex; i++) {
          const coord = coords[i];
          const dist = getDistance(
            center.lat,
            center.lng,
            coord.lat,
            coord.lng
          );

          if (dist < maxDist * 1.2) {
            trimmed.push(coord);
          }
        }
      } else {
        // Other roads: Balanced extension
        const extendPoints = 15;
        const startIndex = Math.max(0, closestIndex - extendPoints);
        const endIndex = Math.min(
          coords.length - 1,
          closestIndex + extendPoints
        );

        for (let i = startIndex; i <= endIndex; i++) {
          const coord = coords[i];
          const dist = getDistance(
            center.lat,
            center.lng,
            coord.lat,
            coord.lng
          );

          if (dist < maxDist * 1.3) {
            trimmed.push(coord);
          }
        }
      }

      // ✅ Add gradient fade points at the end
      const lastIncludedDist =
        trimmed.length > 0
          ? getDistance(
              center.lat,
              center.lng,
              trimmed[trimmed.length - 1].lat,
              trimmed[trimmed.length - 1].lng
            )
          : 0;

      if (lastIncludedDist < maxDist * 1.4 && trimmed.length > 0) {
        // Find next 3-5 points for fade
        const lastIndex = coords.indexOf(trimmed[trimmed.length - 1]);
        for (
          let i = lastIndex + 1;
          i < Math.min(coords.length, lastIndex + 6);
          i++
        ) {
          const coord = coords[i];
          const dist = getDistance(
            center.lat,
            center.lng,
            coord.lat,
            coord.lng
          );
          if (dist < maxDist * 1.5) {
            trimmed.push(coord);
          }
        }
      }

      return trimmed.length >= 2 ? trimmed : coords;
    };

    // Render nearby roads
    nearbyRoads.forEach((road) => {
      const currentDelay =
        currentHourData?.delay_info?.additional_delay_min ??
        simulationResults.summary.avg_delay_minutes ??
        5;
      const severityMultiplier = Math.min(
        Math.max(0.8, 0.8 + currentDelay / 25),
        2.5
      );
      const maxDist = 500 * severityMultiplier;

      const trimmedCoords = trimCoordinates(
        road.coordinates,
        maxDist,
        road.name,
        road.type
      );
      if (trimmedCoords.length >= 2) {
        drawRoadWithGradient(
          { ...road, coordinates: trimmedCoords },
          false,
          "nearbyRoads"
        );
      }
    });

    // Render connected roads with extended inner lane coverage
    // Render connected roads with extended inner lane coverage
    // Render connected roads with extended inner lane coverage
    connectedRoads.forEach((road) => {
      const hour =
        currentHourData?.hour ??
        simulationResults.hourly_predictions?.[currentHourIndex]?.hour ??
        12;
      const currentDelay =
        currentHourData?.delay_info?.additional_delay_min ??
        simulationResults.summary.avg_delay_minutes ??
        5;

      // ✅ USE CURRENT HOUR'S SEVERITY (not average!)
      const currentSeverity = currentHourData?.severity ?? baseSeverity;

      const isPeakHour = (hour >= 6 && hour <= 9) || (hour >= 17 && hour <= 20);
      const isSuperPeak = hour === 7 || hour === 8 || hour === 18;

      // ✅ SEVERITY-BASED LENGTH - recalculated every hour!
      let severityFactor;
      if (currentSeverity >= 2.0) {
        severityFactor = 3.5; // Extreme - very long
      } else if (currentSeverity >= 1.5) {
        severityFactor = 2.8; // Heavy - long
      } else if (currentSeverity >= 1.0) {
        severityFactor = 1.8; // Moderate - medium
      } else if (currentSeverity >= 0.5) {
        severityFactor = 1.2; // Light-Moderate - short-medium
      } else {
        severityFactor = 0.8; // Light - very short
      }

      // Peak hour bonus
      if (isSuperPeak && currentSeverity >= 1.5) {
        severityFactor *= 1.2; // ✅ Reduced from 1.3
      } else if (isPeakHour && currentSeverity >= 1.0) {
        severityFactor *= 1.1; // ✅ Reduced from 1.15
      }

      // ✅ Delay factor (more conservative)
      const delayFactor = Math.min(1.0 + currentDelay / 40, 1.3); // ✅ Reduced impact
      const finalMultiplier = severityFactor * delayFactor;

      // Road-specific base distances
      const isIpilIpil = road.name?.toLowerCase().includes("ipil");
      const isChipeco = road.name?.toLowerCase().includes("chipeco");
      const isMainHighway =
        road.name?.toLowerCase().includes("national") ||
        road.name?.toLowerCase().includes("maharlika") ||
        road.name?.toLowerCase().includes("highway");

      let baseMaxDist;
      if (isIpilIpil) {
        baseMaxDist = 12; // Short local road (use small sensible meters instead of 2)
      } else if (isChipeco) {
        baseMaxDist = 220; // Limit Chipeco
      } else if (isMainHighway) {
        baseMaxDist = 550; // Highways
      } else if (
        road.passesNearCenter ||
        road.connectionType === "intersection"
      ) {
        baseMaxDist = 350;
      } else {
        baseMaxDist = 250;
      }

      // ✅ FINAL DISTANCE - changes every hour!
      const maxDist = baseMaxDist * finalMultiplier;

      console.log(
        `🛣️ ${road.name}: severity=${currentSeverity.toFixed(
          2
        )}, length=${maxDist.toFixed(0)}m`
      );

      const trimmedCoords = trimCoordinates(
        road.coordinates,
        maxDist,
        road.name,
        road.type
      );
      // Debug: log trimming results so we can verify length changes
      console.log(
        `Trim result for ${road.name}: ${trimmedCoords.length}/${
          road.coordinates.length
        } points (maxDist=${Math.round(maxDist)}m)`
      );
      if (trimmedCoords.length >= 2) {
        drawRoadWithGradient(
          { ...road, coordinates: trimmedCoords },
          false,
          "connectedRoads"
        );
      }
    });

    // Render main road with extended coverage during heavy traffic
    if (mainRoad) {
      const hour =
        currentHourData?.hour ??
        simulationResults.hourly_predictions?.[currentHourIndex]?.hour ??
        12;
      const currentDelay =
        currentHourData?.delay_info?.additional_delay_min ??
        simulationResults.summary.avg_delay_minutes ??
        5;

      // ✅ USE CURRENT HOUR'S SEVERITY
      const currentSeverity = currentHourData?.severity ?? baseSeverity;

      const isPeakHour = (hour >= 6 && hour <= 9) || (hour >= 17 && hour <= 20);
      const isSuperPeak = hour === 7 || hour === 8 || hour === 18;

      // ✅ SEVERITY-BASED
      let severityFactor;
      if (currentSeverity >= 2.0) {
        severityFactor = 4.0;
      } else if (currentSeverity >= 1.5) {
        severityFactor = 3.2;
      } else if (currentSeverity >= 1.0) {
        severityFactor = 2.0;
      } else if (currentSeverity >= 0.5) {
        severityFactor = 1.3;
      } else {
        severityFactor = 1.0;
      }

      // Peak bonus
      if (isSuperPeak && currentSeverity >= 1.5) {
        severityFactor *= 1.2;
      } else if (isPeakHour && currentSeverity >= 1.0) {
        severityFactor *= 1.1;
      }

      // Delay factor
      const delayFactor = Math.min(1.0 + currentDelay / 35, 1.4);
      const finalMultiplier = severityFactor * delayFactor;

      const maxMainDist = 900 * finalMultiplier; // ✅ Reduced base

      console.log(
        `🚧 Main road: severity=${currentSeverity.toFixed(
          2
        )}, length=${maxMainDist.toFixed(0)}m`
      );

      const trimmedMainCoords = trimCoordinates(
        mainRoad.coordinates,
        maxMainDist
      );
      console.log(
        `Trim result for MAIN road ${mainRoad.name || mainRoad.road_name}: ${
          trimmedMainCoords.length
        }/${mainRoad.coordinates.length} points (maxMainDist=${Math.round(
          maxMainDist
        )}m)`
      );
      if (trimmedMainCoords.length >= 2) {
        drawRoadWithGradient(
          { ...mainRoad, coordinates: trimmedMainCoords },
          true
        );
      }
    }

    // Disruption epicenter marker
    const epicenterColor = getImpactColor("direct", baseSeverity);
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
              @keyframes severity-pulse {
                0%, 100% { opacity: 0.8; }
                50% { opacity: 1.0; }
              }
              .high-severity-road {
                animation: severity-pulse 2s ease-in-out infinite;
              }
              .critical-severity-road {
                animation: severity-pulse 1s ease-in-out infinite;
              }
            </style>
          </div>
        `,
        iconSize: [56, 56],
        iconAnchor: [28, 28],
      }),
    });

    epicenter.bindPopup(createEpicenterPopup(simulationResults));
    layerGroupsRef.current.markers.addLayer(epicenter);
    layersRef.current.push(epicenter);

    // Fit bounds
    const allCoords = [];
    if (mainRoad?.coordinates) {
      allCoords.push(...mainRoad.coordinates.map((c) => [c.lat, c.lng]));
    }
    connectedRoads.forEach((road) => {
      allCoords.push(...road.coordinates.map((c) => [c.lat, c.lng]));
    });

    if (allCoords.length > 0) {
      map.fitBounds(L.latLngBounds(allCoords), {
        padding: [60, 60],
        maxZoom: 17,
      });
    }
  }, [
    simulationResults,
    selectedLocation,
    roadInfo,
    roadNetwork,
    loading,
    mapReady,
    currentHourIndex,
  ]);

  // ========================================
  // POPUP CREATORS
  // ========================================

  function createRoadPopup(road, baseSeverity) {
    const adjustedSeverity = baseSeverity * road.impactMultiplier;
    const color =
      adjustedSeverity >= 1.5
        ? "#ea580c"
        : adjustedSeverity >= 1.0
        ? "#eab308"
        : "#22c55e";
    const severityLabel =
      adjustedSeverity >= 1.5
        ? "Heavy"
        : adjustedSeverity >= 1.0
        ? "Moderate"
        : "Light";

    const connectionLabel =
      road.connectionType === "intersection"
        ? `🔗 Direct intersection (${road.sharedNodeCount} shared points)`
        : `📍 ${Math.round(road.distanceToDisruption)}m from disruption`;

    return `
      <div style="font-family: -apple-system, sans-serif; padding: 12px; min-width: 220px;">
        <h4 style="margin: 0 0 8px 0; font-size: 14px; font-weight: 600;">${
          road.name
        }</h4>
        
        <div style="background: ${color}15; border-left: 3px solid ${color}; padding: 8px; border-radius: 4px; margin-bottom: 8px;">
          <p style="margin: 0; font-weight: 600; color: ${color}; font-size: 13px;">
            ${
              road.impactLevel.charAt(0).toUpperCase() +
              road.impactLevel.slice(1)
            } Impact
          </p>
          <p style="margin: 4px 0 0 0; font-size: 11px; color: #666;">
            Expected: ${severityLabel} congestion
          </p>
        </div>
        
        <div style="font-size: 11px; color: #4b5563; line-height: 1.5;">
          <p style="margin: 4px 0;">${connectionLabel}</p>
          <p style="margin: 4px 0;"><strong>Type:</strong> ${road.type} • ${
      road.lanes
    } lanes</p>
        </div>
      </div>
    `;
  }

  function createMainRoadPopup(road, severity, results, currentHourInfo) {
    const color =
      severity >= 1.5 ? "#dc2626" : severity >= 1.0 ? "#ea580c" : "#f59e0b";
    const severityLabel =
      currentHourInfo?.severity_label ?? results.summary.avg_severity_label;
    const delayMin =
      currentHourInfo?.delay_info?.additional_delay_min ??
      results.summary.avg_delay_minutes;
    const timeInfo = currentHourInfo?.datetime
      ? `<p style="margin: 4px 0 0 0; font-size: 10px; color: #888;">📅 ${currentHourInfo.datetime}</p>`
      : "";

    return `
      <div style="font-family: -apple-system, sans-serif; padding: 12px; min-width: 240px;">
        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px;">
          <div style="font-size: 28px; width: 44px; height: 44px; background: ${color}20; border: 3px solid ${color}; border-radius: 10px; display: flex; align-items: center; justify-content: center;">🚧</div>
          <div>
            <h3 style="margin: 0; font-size: 15px; font-weight: 600;">${
              road.road_name || road.name
            }</h3>
            <p style="margin: 2px 0 0 0; font-size: 11px; color: #6b7280;">Primary Affected Road</p>
          </div>
        </div>
        
        <div style="background: ${color}15; border-left: 3px solid ${color}; padding: 10px; border-radius: 6px; margin-bottom: 10px;">
          <p style="margin: 0; font-weight: 600; color: ${color}; font-size: 14px;">${severityLabel} Congestion</p>
          <p style="margin: 6px 0 0 0; font-size: 12px;">Est. delay: <strong>+${delayMin} min</strong></p>
          ${timeInfo}
        </div>

        <div style="font-size: 11px; color: #4b5563;">
          <p style="margin: 4px 0;"><strong>Type:</strong> ${
            road.road_type || road.type
          } • ${road.lanes} lanes</p>
          <p style="margin: 4px 0;"><strong>Length:</strong> ${
            road.length_km
          } km</p>
        </div>
      </div>
    `;
  }

  function createEpicenterPopup(results) {
    return `
      <div style="padding: 12px; font-family: -apple-system, sans-serif;">
        <h3 style="margin: 0 0 10px 0; font-weight: 600; font-size: 15px;">🚧 Disruption Center</h3>
        <div style="font-size: 12px; line-height: 1.6;">
          <p style="margin: 4px 0;"><strong>Type:</strong> ${
            results.input?.disruption_type || "N/A"
          }</p>
          <p style="margin: 4px 0;"><strong>Area:</strong> ${
            results.input?.area || "N/A"
          }</p>
          <p style="margin: 4px 0;"><strong>Duration:</strong> ${
            results.summary?.total_hours || 0
          }h</p>
        </div>
      </div>
    `;
  }

  // ========================================
  // RENDER
  // ========================================
  return (
    <div
      className="relative bg-gray-50 rounded-xl overflow-hidden shadow-lg"
      style={{ height: "550px" }}
    >
      <div ref={mapRef} className="w-full h-full" />

      {loading && (
        <div className="absolute inset-0 bg-white bg-opacity-90 flex items-center justify-center z-[2000]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
            <p className="text-sm text-gray-600 font-semibold">
              Analyzing road network...
            </p>
            {apiStatus.message && (
              <p className="text-xs text-gray-500 mt-2">{apiStatus.message}</p>
            )}
          </div>
        </div>
      )}

      {/* API Status Indicators */}
      {!loading &&
        apiStatus.status === "fallback" &&
        roadNetwork.mainRoad?.isFallback && (
          <div className="absolute top-6 right-6 bg-orange-50 border border-orange-200 rounded-lg px-3 py-2 shadow-md z-[1000]">
            <p className="text-xs text-orange-800 font-medium">
              ⚠️ Limited road network data available
            </p>
          </div>
        )}

      {!loading && mapReady && simulationResults && (
        <>
          {/* Enhanced Legend with Severity Indicator */}
          <div
            className="absolute bottom-6 right-6 bg-white rounded-xl p-4 shadow-xl z-[1000] border border-gray-200"
            style={{ width: "200px" }}
          >
            <h4 className="font-bold text-gray-800 mb-3 text-sm flex items-center justify-between w-full">
              Impact Zones
              <span
                className={`ml-auto text-xs px-2 py-0.5 rounded-full ${
                  getCurrentHourSeverity() >= 1.5
                    ? "bg-red-100 text-red-700"
                    : getCurrentHourSeverity() >= 0.5
                    ? "bg-yellow-100 text-yellow-700"
                    : "bg-green-100 text-green-700"
                }`}
              >
                {simulationResults.hourly_predictions?.[currentHourIndex]
                  ?.severity_label || "N/A"}
              </span>
            </h4>

            {/* Gradient Bar with Position Indicator */}
            <div className="mb-3 relative">
              <div
                className="h-3 rounded-full"
                style={{
                  background:
                    "linear-gradient(to right, #22c55e, #84cc16, #eab308, #f59e0b, #ea580c, #dc2626)",
                }}
              ></div>
              <div
                className="absolute top-0 w-1 h-3 bg-white border-2 border-gray-800 rounded-full transition-all duration-300"
                style={{
                  left: `${Math.min(
                    (getCurrentHourSeverity() / 2) * 100,
                    100
                  )}%`,
                  transform: "translateX(-50%)",
                }}
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>Light (0)</span>
                <span>Heavy (2.0)</span>
              </div>
            </div>

            <div className="space-y-1.5 text-xs">
              <div className="flex items-center gap-2">
                <div
                  className="w-4 h-2 rounded"
                  style={{ background: "#dc2626" }}
                ></div>{" "}
                {/* ✅ Changed to red */}
                <span>Direct Impact</span>
              </div>
              <div className="flex items-center gap-2">
                <div
                  className="w-4 h-2 rounded"
                  style={{ background: "#ef4444" }}
                ></div>{" "}
                {/* ✅ Changed to lighter red */}
                <span>
                  High (
                  {
                    roadNetwork.connectedRoads.filter(
                      (r) => r.impactLevel === "high"
                    ).length
                  }
                  )
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div
                  className="w-4 h-2 rounded"
                  style={{ background: "#fb923c" }}
                ></div>{" "}
                {/* ✅ Changed to orange */}
                <span>Medium-High</span>
              </div>
              <div className="flex items-center gap-2">
                <div
                  className="w-4 h-2 rounded"
                  style={{ background: "#f59e0b" }}
                ></div>{" "}
                {/* ✅ Kept orange */}
                <span>Medium</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-2 rounded bg-green-500"></div>
                <span>Low ({roadNetwork.nearbyRoads.length})</span>
              </div>
            </div>

            <div className="mt-3 pt-3 border-t border-gray-200 text-xs text-gray-600">
              <p>
                <strong>Total:</strong>{" "}
                {roadNetwork.connectedRoads.length +
                  roadNetwork.nearbyRoads.length +
                  (roadNetwork.mainRoad ? 1 : 0)}{" "}
                roads
              </p>
            </div>
          </div>

          {/* Info Panel */}
          <div className="absolute top-6 left-6 bg-white rounded-xl px-4 py-3 shadow-lg z-[1000] border border-gray-200">
            <p className="text-sm font-semibold text-gray-800 flex items-center gap-2">
              📊 Network Impact
            </p>
            <p className="text-xs text-gray-600 mt-1">
              {roadNetwork.connectedRoads.length +
                roadNetwork.nearbyRoads.length +
                (roadNetwork.mainRoad ? 1 : 0)}{" "}
              roads •
              {
                roadNetwork.connectedRoads.filter(
                  (r) => r.connectionType === "intersection" || r.isGoogleData
                ).length
              }{" "}
              intersections
            </p>
            <p className="text-xs text-gray-500 mt-1">
              ⌨️ Use arrow keys or spacebar
            </p>
            {/* Google API Toggle */}
            <div className="mt-2 pt-2 border-t border-gray-200">
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={useGoogleApi}
                  onChange={(e) => {
                    setUseGoogleApi(e.target.checked);
                    // Clear cache to refetch
                    roadNetworkCacheRef.current.clear();
                  }}
                  className="w-3 h-3"
                />
                <span
                  className={useGoogleApi ? "text-green-600" : "text-gray-500"}
                >
                  {useGoogleApi ? "🟢 Google API" : "⚪ OSM Only"}
                </span>
              </label>
              {roadNetwork.mainRoad?.isGoogleData && (
                <p className="text-xs text-green-600 mt-1">
                  ✓ Using Google Maps
                </p>
              )}
            </div>
          </div>
        </>
      )}

      {/* Time Playback Control */}
      {!loading && simulationResults?.hourly_predictions?.length > 1 && (
        <div
          className="absolute bottom-6 left-6 bg-white rounded-xl px-4 py-3 shadow-lg z-[1000]"
          style={{ maxWidth: "320px" }}
        >
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsAnimating(!isAnimating)}
              className={`px-3 py-1.5 rounded-lg font-semibold text-xs transition ${
                isAnimating
                  ? "bg-red-500 text-white hover:bg-red-600"
                  : "bg-orange-500 text-white hover:bg-orange-600"
              }`}
            >
              {isAnimating ? "⏹ Stop" : "▶ Play"}
            </button>
            <div className="flex-1">
              <input
                type="range"
                min="0"
                max={simulationResults.hourly_predictions.length - 1}
                value={currentHourIndex}
                onChange={(e) => {
                  setCurrentHourIndex(parseInt(e.target.value));
                  setIsAnimating(false);
                }}
                className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              />
              <p className="text-xs text-gray-600 mt-1">
                {simulationResults.hourly_predictions[currentHourIndex]
                  ?.datetime || "N/A"}
              </p>
            </div>
            <span
              className={`text-xs font-bold px-2 py-1 rounded text-center ${
                getCurrentHourSeverity() < 0.5
                  ? "bg-green-100 text-green-700"
                  : getCurrentHourSeverity() < 1.5
                  ? "bg-yellow-100 text-yellow-700"
                  : "bg-red-100 text-red-700"
              }`}
              style={{ minWidth: "65px" }}
            >
              {simulationResults.hourly_predictions[currentHourIndex]
                ?.severity_label || "N/A"}
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
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lng2 - lng1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // meters
}
