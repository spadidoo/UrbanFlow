// frontend/services/osmService.js

/**
 * Service to fetch road network data from OpenStreetMap Overpass API
 */

const OVERPASS_API = "https://overpass-api.de/api/interpreter";

/**
 * Fetch road information from OSM based on coordinates
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @param {number} radius - Search radius in meters (default: 50m)
 * @returns {Promise<Object>} Road information
 */
export async function getRoadInfoFromOSM(lat, lng, radius = 50) {
  try {
    // Overpass QL query to find roads near the point
    const query = `
      [out:json];
      (
        way["highway"](around:${radius},${lat},${lng});
      );
      out body;
      >;
      out skel qt;
    `;

    const response = await fetch(OVERPASS_API, {
      method: "POST",
      body: `data=${encodeURIComponent(query)}`,
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
    });

    if (!response.ok) {
      throw new Error("Failed to fetch from OSM");
    }

    const data = await response.json();

    if (!data.elements || data.elements.length === 0) {
      return {
        success: false,
        message: "No roads found at this location",
      };
    }

    // Find the closest road
    const roads = data.elements.filter((el) => el.type === "way");

    if (roads.length === 0) {
      return {
        success: false,
        message: "No roads found at this location",
      };
    }

    // Get the first road (closest one)
    const road = roads[0];
    const roadInfo = extractRoadInfo(road, data.elements);

    return {
      success: true,
      ...roadInfo,
      coordinates: { lat, lng },
      osm_id: road.id,
    };
  } catch (error) {
    console.error("OSM API Error:", error);
    return {
      success: false,
      message: "Failed to fetch road information",
      error: error.message,
    };
  }
}

/**
 * Extract road information from OSM data
 */
function extractRoadInfo(road, allElements) {
  const tags = road.tags || {};

  // Get road name
  const name = tags.name || tags.ref || "Unnamed Road";

  // Get road type
  const highway_type = tags.highway || "unknown";

  // Estimate number of lanes
  const lanes = parseInt(tags.lanes) || estimateLanes(highway_type);

  // Get road width (if available, otherwise estimate)
  const width = parseFloat(tags.width) || estimateWidth(highway_type, lanes);

  // Calculate road length from nodes
  const nodes = road.nodes
    .map((nodeId) =>
      allElements.find((el) => el.type === "node" && el.id === nodeId)
    )
    .filter(Boolean);

  const length = calculateRoadLength(nodes);

  // Determine area/barangay (you'll need to map this to Calamba areas)
  const area = determineAreaFromCoordinates(nodes);

  return {
    road_name: name,
    road_type: highway_type,
    lanes: lanes,
    width_meters: width,
    length_meters: length,
    length_km: (length / 1000).toFixed(2),
    area: area,
    max_speed: tags.maxspeed || estimateMaxSpeed(highway_type),
    surface: tags.surface || "paved",
    oneway: tags.oneway === "yes",
  };
}

/**
 * Estimate number of lanes based on road type
 */
function estimateLanes(highway_type) {
  const laneMap = {
    motorway: 4,
    trunk: 4,
    primary: 4,
    secondary: 2,
    tertiary: 2,
    residential: 2,
    service: 1,
    unclassified: 2,
  };
  return laneMap[highway_type] || 2;
}

/**
 * Estimate road width based on type and lanes
 */
function estimateWidth(highway_type, lanes) {
  const laneWidth = 3.5; // standard lane width in meters
  const widthMap = {
    motorway: lanes * laneWidth + 2,
    trunk: lanes * laneWidth + 1.5,
    primary: lanes * laneWidth + 1,
    secondary: lanes * laneWidth + 0.5,
    tertiary: lanes * laneWidth,
    residential: lanes * laneWidth,
  };
  return widthMap[highway_type] || lanes * laneWidth;
}

/**
 * Estimate max speed based on road type
 */
function estimateMaxSpeed(highway_type) {
  const speedMap = {
    motorway: 100,
    trunk: 80,
    primary: 60,
    secondary: 50,
    tertiary: 40,
    residential: 30,
    service: 20,
  };
  return speedMap[highway_type] || 40;
}

/**
 * Calculate total road length from node coordinates
 */
function calculateRoadLength(nodes) {
  let totalLength = 0;

  for (let i = 0; i < nodes.length - 1; i++) {
    if (nodes[i] && nodes[i + 1]) {
      const distance = calculateDistance(
        nodes[i].lat,
        nodes[i].lon,
        nodes[i + 1].lat,
        nodes[i + 1].lon
      );
      totalLength += distance;
    }
  }

  return totalLength;
}

/**
 * Calculate distance between two coordinates (Haversine formula)
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
}

/**
 * Determine Calamba area from coordinates
 * You'll need to customize this based on your barangay boundaries
 */
function determineAreaFromCoordinates(nodes) {
  if (!nodes || nodes.length === 0) return "Unknown";

  // Get center point
  const centerLat =
    nodes.reduce((sum, n) => sum + (n?.lat || 0), 0) / nodes.length;
  const centerLon =
    nodes.reduce((sum, n) => sum + (n?.lon || 0), 0) / nodes.length;

  // Define Calamba barangay boundaries (simplified)
  const areas = {
    Bucal: { lat_range: [14.18, 14.2], lon_range: [121.16, 121.18] },
    Parian: { lat_range: [14.21, 14.22], lon_range: [121.14, 121.16] },
    Turbina: { lat_range: [14.18, 14.19], lon_range: [121.13, 121.15] },
    Real: { lat_range: [14.19, 14.21], lon_range: [121.15, 121.17] },
    Crossing: { lat_range: [14.2, 14.21], lon_range: [121.16, 121.17] },
    Halang: { lat_range: [14.17, 14.19], lon_range: [121.17, 121.19] },
    Pansol: { lat_range: [14.16, 14.18], lon_range: [121.18, 121.2] },
    "Bagong Kalsada": {
      lat_range: [14.15, 14.17],
      lon_range: [121.19, 121.21],
    },
  };

  for (const [areaName, bounds] of Object.entries(areas)) {
    const [latMin, latMax] = bounds.lat_range;
    const [lonMin, lonMax] = bounds.lon_range;

    if (
      centerLat >= latMin &&
      centerLat <= latMax &&
      centerLon >= lonMin &&
      centerLon <= lonMax
    ) {
      return areaName;
    }
  }

  return "Calamba City"; // Default
}

/**
 * Fetch road segment information for a line/polygon
 * Used when user draws a shape
 */
export async function getRoadSegmentsInArea(coordinates) {
  try {
    // Calculate bounding box
    const lats = coordinates.map((c) => c.lat);
    const lngs = coordinates.map((c) => c.lng);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);

    // Overpass QL query to find roads in bounding box
    const query = `
      [out:json];
      (
        way["highway"](${minLat},${minLng},${maxLat},${maxLng});
      );
      out body;
      >;
      out skel qt;
    `;

    const response = await fetch(OVERPASS_API, {
      method: "POST",
      body: `data=${encodeURIComponent(query)}`,
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
    });

    const data = await response.json();
    const roads = data.elements.filter((el) => el.type === "way");

    // Process all roads in the area
    const roadSegments = roads.map((road) =>
      extractRoadInfo(road, data.elements)
    );

    return {
      success: true,
      roads: roadSegments,
      bounding_box: { minLat, maxLat, minLng, maxLng },
      total_roads: roadSegments.length,
    };
  } catch (error) {
    console.error("OSM Area Query Error:", error);
    return {
      success: false,
      message: "Failed to fetch road segments",
      error: error.message,
    };
  }
}
