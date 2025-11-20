// frontend/services/osmService.js - FIXED VERSION

// Helper to add delay for retries
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Get road information from OpenStreetMap with retry logic
 */
export async function getRoadInfoFromOSM(lat, lng, radius = 50, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      // Overpass API query to get nearby roads
      const query = `
        [out:json][timeout:10];
        (
          way["highway"]["name"](around:${radius},${lat},${lng});
        );
        out body;
        >;
        out skel qt;
      `;

      const response = await fetch('https://overpass-api.de/api/interpreter', {
        method: 'POST',
        body: query,
        headers: {
          'Content-Type': 'text/plain',
        },
      });

      if (!response.ok) {
        // ✅ FIXED: Use parentheses, not backticks
        if (response.status === 504 || response.status === 429) {
          // Timeout or rate limit - retry
          if (attempt < retries) {
            console.log(`OSM timeout, retrying (${attempt}/${retries})...`);
            await sleep(2000 * attempt); // Exponential backoff
            continue;
          }
        }
        throw new Error(`OSM API error: ${response.status}`);
      }

      const data = await response.json();

      if (!data.elements || data.elements.length === 0) {
        // Return fallback data instead of failing
        return {
          success: true,
          road_name: `Location at ${lat.toFixed(4)}, ${lng.toFixed(4)}`,
          road_type: 'tertiary',
          lanes: 2,
          max_speed: 40,
          surface: 'asphalt',
          width_meters: 7,
          length_km: 1.0,
          area: determineArea(lat, lng),
          coordinates: [{ lat, lng }],
          fallback: true,
          message: 'No roads found, using approximate location'
        };
      }

      // Get the first road (way) with the most tags
      const roads = data.elements.filter(el => el.type === 'way' && el.tags);
      
      if (roads.length === 0) {
        // Return fallback
        return {
          success: true,
          road_name: `Road near ${lat.toFixed(4)}, ${lng.toFixed(4)}`,
          road_type: 'tertiary',
          lanes: 2,
          max_speed: 40,
          surface: 'asphalt',
          width_meters: 7,
          length_km: 1.0,
          area: determineArea(lat, lng),
          coordinates: [{ lat, lng }],
          fallback: true,
          message: 'No named roads found, using approximate data'
        };
      }

      // Sort by highway importance
      const highwayPriority = {
        'motorway': 1,
        'trunk': 2,
        'primary': 3,
        'secondary': 4,
        'tertiary': 5,
        'residential': 6,
        'service': 7,
      };

      roads.sort((a, b) => {
        const priorityA = highwayPriority[a.tags.highway] || 99;
        const priorityB = highwayPriority[b.tags.highway] || 99;
        return priorityA - priorityB;
      });

      const mainRoad = roads[0];
      const tags = mainRoad.tags;

      // Get all nodes to calculate length
      const nodes = data.elements.filter(el => el.type === 'node');
      const roadNodes = mainRoad.nodes
        .map(nodeId => nodes.find(n => n.id === nodeId))
        .filter(n => n);

      // Calculate road length
      let lengthKm = 0;
      for (let i = 0; i < roadNodes.length - 1; i++) {
        const n1 = roadNodes[i];
        const n2 = roadNodes[i + 1];
        if (n1 && n2) {
          lengthKm += haversineDistance(n1.lat, n1.lon, n2.lat, n2.lon);
        }
      }

      // Extract road properties
      const roadInfo = {
        success: true,
        road_name: tags.name || 'Unnamed Road',
        road_type: tags.highway || 'tertiary',
        lanes: parseInt(tags.lanes) || estimateLanes(tags.highway),
        max_speed: parseInt(tags.maxspeed) || estimateMaxSpeed(tags.highway),
        surface: tags.surface || 'asphalt',
        width_meters: parseFloat(tags.width) || estimateWidth(tags.highway, parseInt(tags.lanes) || 2),
        length_km: Math.max(lengthKm, 0.5), // Minimum 0.5km
        area: determineArea(lat, lng),
        coordinates: roadNodes.map(n => ({ lat: n.lat, lng: n.lon })),
        fallback: false
      };

      return roadInfo;

    } catch (error) {
      console.error(`OSM fetch error (attempt ${attempt}):`, error);
      
      // If this was the last retry, return fallback data
      if (attempt === retries) {
        return {
          success: true,
          road_name: `Location at ${lat.toFixed(4)}, ${lng.toFixed(4)}`,
          road_type: 'tertiary',
          lanes: 2,
          max_speed: 40,
          surface: 'asphalt',
          width_meters: 7,
          length_km: 1.0,
          area: determineArea(lat, lng),
          coordinates: [{ lat, lng }],
          fallback: true,
          message: `OSM API unavailable: ${error.message}`
        };
      }
      
      // Wait before retry
      await sleep(2000 * attempt);
    }
  }
}

/**
 * Get multiple road segments in an area
 */
export async function getRoadSegmentsInArea(coordinates) {
  try {
    // Calculate bounding box
    const lats = coordinates.map(c => c.lat);
    const lngs = coordinates.map(c => c.lng);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);

    const query = `
      [out:json][timeout:15];
      (
        way["highway"]["name"](${minLat},${minLng},${maxLat},${maxLng});
      );
      out body;
      >;
      out skel qt;
    `;

    const response = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      body: query,
    });

    if (!response.ok) {
      throw new Error('Failed to fetch road segments');
    }

    const data = await response.json();
    const roads = data.elements
      .filter(el => el.type === 'way' && el.tags)
      .map(road => ({
        id: road.id,
        name: road.tags.name || 'Unnamed',
        type: road.tags.highway,
        lanes: parseInt(road.tags.lanes) || estimateLanes(road.tags.highway),
        max_speed: parseInt(road.tags.maxspeed) || estimateMaxSpeed(road.tags.highway),
      }));

    return {
      success: true,
      roads: roads,
    };

  } catch (error) {
    console.error('Area fetch error:', error);
    return {
      success: false,
      message: error.message,
      roads: [],
    };
  }
}

// Helper functions
function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth radius in km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg) {
  return deg * (Math.PI / 180);
}

function estimateLanes(highway) {
  const defaults = {
    motorway: 4,
    trunk: 3,
    primary: 2,
    secondary: 2,
    tertiary: 2,
    residential: 1,
    service: 1,
  };
  return defaults[highway] || 2;
}

function estimateMaxSpeed(highway) {
  const defaults = {
    motorway: 100,
    trunk: 80,
    primary: 60,
    secondary: 50,
    tertiary: 40,
    residential: 30,
    service: 20,
  };
  return defaults[highway] || 40;
}

function estimateWidth(highway, lanes) {
  const laneWidth = 3.5; // meters per lane
  const shoulder = highway === 'motorway' ? 2 : 1;
  return (lanes * laneWidth) + (shoulder * 2);
}

function determineArea(lat, lng) {
  // Simple area determination for Calamba
  // You can improve this with actual barangay boundaries
  if (lat >= 14.18 && lat <= 14.20 && lng >= 121.16 && lng <= 121.18) {
    return 'Bucal';
  } else if (lat >= 14.21 && lat <= 14.22 && lng >= 121.14 && lng <= 121.16) {
    return 'Parian';
  } else if (lat >= 14.18 && lat <= 14.19 && lng >= 121.13 && lng <= 121.15) {
    return 'Turbina';
  }
  return 'Unknown Area';
}