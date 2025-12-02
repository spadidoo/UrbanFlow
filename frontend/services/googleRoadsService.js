// frontend/services/googleRoadsService.js
// Google Maps Directions API service - calls backend to avoid CORS

// ✅ Feature flag to enable/disable Google API
const USE_GOOGLE_API = false; // Set to false to disable Google API

// Backend URL
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'https://backend.urbanflowph.com';

/**
 * Check if Google API is enabled
 */
export function isGoogleApiEnabled() {
  return USE_GOOGLE_API;
}

/**
 * Get road geometry using Google Directions API (via backend proxy)
 */
export async function getConnectedRoads(centerLat, centerLng, radiusMeters = 800) {
  if (!USE_GOOGLE_API) {
    console.log('⚠️ Google API disabled');
    return null;
  }

  try {
    const directions = generateDirectionPoints(centerLat, centerLng, radiusMeters);
    const roadSegments = [];
    
    for (const direction of directions) {
      const segment = await getDirectionRoad(
        centerLat, 
        centerLng, 
        direction.lat, 
        direction.lng,
        direction.name
      );
      
      if (segment) {
        roadSegments.push(segment);
      }
      
      await sleep(50);
    }
    
    console.log(`✅ Google API returned ${roadSegments.length} road segments`);
    return roadSegments;
    
  } catch (error) {
    console.error('❌ Google Roads API error:', error);
    return null;
  }
}

/**
 * Generate points in N, S, E, W directions from center
 */
function generateDirectionPoints(centerLat, centerLng, radiusMeters) {
  const latOffset = radiusMeters / 111320;
  const lngOffset = radiusMeters / (111320 * Math.cos(centerLat * Math.PI / 180));
  
  return [
    { lat: centerLat + latOffset, lng: centerLng, name: 'North' },
    { lat: centerLat - latOffset, lng: centerLng, name: 'South' },
    { lat: centerLat, lng: centerLng + lngOffset, name: 'East' },
    { lat: centerLat, lng: centerLng - lngOffset, name: 'West' },
  ];
}

/**
 * Get road between two points using backend proxy
 */
async function getDirectionRoad(startLat, startLng, endLat, endLng, directionName) {
  try {
    // ✅ Call backend proxy instead of Google directly
    const response = await fetch(`${BACKEND_URL}/api/google-directions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        origin: `${startLat},${startLng}`,
        destination: `${endLat},${endLng}`
      })
    });
    
    if (!response.ok) {
      console.warn(`⚠️ Backend proxy error for ${directionName}: ${response.status}`);
      return null;
    }
    
    const data = await response.json();
    
    if (data.status !== 'OK' || !data.routes || data.routes.length === 0) {
      console.warn(`⚠️ No route found for ${directionName}:`, data.status);
      return null;
    }
    
    const route = data.routes[0];
    const leg = route.legs[0];
    
    const coordinates = decodePolyline(route.overview_polyline.points);
    
    return {
      id: `google-${directionName.toLowerCase()}-${Date.now()}`,
      name: extractRoadName(leg.steps) || `${directionName} Road`,
      direction: directionName,
      coordinates: coordinates,
      distance_meters: leg.distance.value,
      duration_seconds: leg.duration.value,
      road_type: detectRoadType(leg.steps),
      lanes: estimateLanesFromType(detectRoadType(leg.steps)),
      isGoogleData: true,
    };
    
  } catch (error) {
    console.error(`❌ Direction API error for ${directionName}:`, error);
    return null;
  }
}

/**
 * Decode Google's encoded polyline format
 */
function decodePolyline(encoded) {
  const points = [];
  let index = 0, lat = 0, lng = 0;
  
  while (index < encoded.length) {
    let b, shift = 0, result = 0;
    
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    
    const dlat = ((result & 1) ? ~(result >> 1) : (result >> 1));
    lat += dlat;
    
    shift = 0;
    result = 0;
    
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    
    const dlng = ((result & 1) ? ~(result >> 1) : (result >> 1));
    lng += dlng;
    
    points.push({
      lat: lat / 1e5,
      lng: lng / 1e5
    });
  }
  
  return points;
}

/**
 * Extract main road name from route steps
 */
function extractRoadName(steps) {
  if (!steps || steps.length === 0) return null;
  
  for (const step of steps) {
    const instruction = step.html_instructions || '';
    
    const patterns = [
      /on\s+<b>(.+?)<\/b>/i,
      /onto\s+<b>(.+?)<\/b>/i,
      /along\s+<b>(.+?)<\/b>/i,
      /on\s+(.+?)(?:<|$)/i,
      /onto\s+(.+?)(?:<|$)/i,
    ];
    
    for (const pattern of patterns) {
      const match = instruction.match(pattern);
      if (match && match[1]) {
        const name = match[1].replace(/<[^>]*>/g, '').trim();
        if (!name.match(/^(north|south|east|west|left|right)$/i) && name.length > 2) {
          return name;
        }
      }
    }
  }
  
  return null;
}

/**
 * Detect road type from route steps
 */
function detectRoadType(steps) {
  if (!steps) return 'secondary';
  
  const allInstructions = steps.map(s => s.html_instructions || '').join(' ').toLowerCase();
  
  if (allInstructions.includes('highway') || allInstructions.includes('national')) {
    return 'primary';
  }
  if (allInstructions.includes('avenue') || allInstructions.includes('boulevard')) {
    return 'secondary';
  }
  
  return 'tertiary';
}

/**
 * Estimate lanes based on road type
 */
function estimateLanesFromType(roadType) {
  const lanes = { 'primary': 4, 'secondary': 2, 'tertiary': 2 };
  return lanes[roadType] || 2;
}

/**
 * Helper: Sleep function
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Calculate distance between two points (Haversine)
 */
export function getDistance(lat1, lng1, lat2, lng2) {
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
