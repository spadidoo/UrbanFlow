"use client";

import L from "leaflet";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import ReportIssueForm from './ReportIssueForm';
import { 
  FaRoute, 
  FaTimes, 
  FaSpinner, 
  FaMobileAlt, 
  FaEnvelope, 
  FaLink,
  FaRoad,
  FaClock,
  FaExclamationTriangle,
  FaMap
} from 'react-icons/fa';

// Fix Leaflet icons
if (typeof window !== "undefined") {
  delete L.Icon.Default.prototype._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl:
      "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png",
    iconUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png",
    shadowUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png",
  });
}

// Helper: Calculate distance between two points in meters
function getDistanceMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function fetchRoadsFromOSM(lat, lng, radius = 350, cacheRef) {
  // ✅ Create cache key based on rounded coordinates (500m grid)
  const cacheKey = `${Math.round(lat * 200) / 200},${Math.round(lng * 200) / 200}`;
  
  // ✅ Check cache first (includes both successful and failed requests)
  if (cacheRef && cacheRef.current.has(cacheKey)) {
    console.log(`✓ Using cached OSM data for ${cacheKey}`);
    return cacheRef.current.get(cacheKey);
  }

  // ✅ Check error cache (don't retry failed requests for 5 minutes)
  const errorKey = `error_${cacheKey}`;
  if (cacheRef && cacheRef.current.has(errorKey)) {
    const errorTime = cacheRef.current.get(errorKey);
    if (Date.now() - errorTime < 5 * 60 * 1000) {
      console.log(`⏳ Skipping OSM retry for ${cacheKey} (recent error)`);
      return null;
    }
    cacheRef.current.delete(errorKey);
  }

  const query = `
    [out:json][timeout:30];
    (
      way["highway"~"^(primary|secondary|tertiary|trunk)$"](around:${radius},${lat},${lng});
    );
    out geom;
  `;

  try {
    console.log(`🌐 Fetching OSM data for ${cacheKey}...`);
    
    const response = await fetch("https://overpass.kumi.systems/api/interpreter", {
      method: "POST",
      body: `data=${encodeURIComponent(query)}`,
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });

    if (!response.ok) {
      console.warn(`❌ OSM API error ${response.status} for ${cacheKey}`);
      // ✅ Cache error to prevent retry
      if (cacheRef) {
        cacheRef.current.set(errorKey, Date.now());
      }
      return null;
    }

    const data = await response.json();

    const roads = data.elements
      .filter((el) => el.type === "way" && el.tags?.highway && el.geometry)
      .map((way) => {
        const coords = way.geometry.map((point) => [point.lat, point.lon]);

        if (coords.length < 2) return null;

        return {
          id: way.id,
          name: way.tags.name || way.tags.highway || "Road",
          type: way.tags.highway,
          coordinates: coords,
        };
      })
      .filter(Boolean);

    // ✅ Save successful result to cache
    if (cacheRef) {
      cacheRef.current.set(cacheKey, roads);
      console.log(`✓ Cached OSM data for ${cacheKey} (${roads.length} roads)`);
    }

    return roads;
  } catch (err) {
    console.warn(`❌ OSM fetch exception for ${cacheKey}:`, err.message);
    // ✅ Cache error to prevent retry
    if (cacheRef) {
      cacheRef.current.set(errorKey, Date.now());
    }
    return null;
  }
}

// Helper: Sleep function for API rate limiting
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Calculate road length
function calculateRoadLength(coords) {
  let length = 0;
  for (let i = 0; i < coords.length - 1; i++) {
    length += getDistanceMeters(
      coords[i].lat,
      coords[i].lng,
      coords[i + 1].lat,
      coords[i + 1].lng
    );
  }
  return (length / 1000).toFixed(2);
}

// Get color based on severity (0-2.5 scale)
function getImpactColor(severity) {
  if (severity < 0.5) return "#22c55e"; // Green
  if (severity < 1.0) return "#84cc16"; // Yellow-green
  if (severity < 1.5) return "#f59e0b"; // Orange
  if (severity < 2.0) return "#ea580c"; // Dark orange
  return "#dc2626"; // Red
}

// Add this helper at the top with other utilities
function decodePolyline(encoded) {
  if (!encoded || typeof encoded !== "string") return [];
  let index = 0, lat = 0, lng = 0, coordinates = [];

  while (index < encoded.length) {
    let b, shift = 0, result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const deltaLat = result & 1 ? ~(result >> 1) : result >> 1;
    lat += deltaLat;

    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const deltaLng = result & 1 ? ~(result >> 1) : result >> 1;
    lng += deltaLng;

    coordinates.push([lat / 1e5, lng / 1e5]);
  }

  return coordinates;
}

// Filter roads by importance (only major roads)
function shouldIncludeRoad(road, distToCenter) {
  const roadName = road.name?.toLowerCase() || "";
  const roadType = road.type;
  
  // ✅ Always include major highways/named roads
  const isMajorRoad = 
    roadName.includes("national") ||
    roadName.includes("maharlika") ||
    roadName.includes("highway") ||
    roadName.includes("chipeco") ||
    roadName.includes("turbina") ||
    roadName.includes("bucal") ||
    roadName.includes("ipil") ||
    ["trunk", "trunk_link", "primary", "primary_link"].includes(roadType);
  
  if (isMajorRoad) return true;
  
  // ✅ Include secondary roads only if very close
  if (["secondary", "secondary_link"].includes(roadType) && distToCenter < 200) {
    return true;
  }
  
  // ✅ Include tertiary only if extremely close
  if (roadType === "tertiary" && distToCenter < 100) {
    return true;
  }
  
  // ❌ Exclude everything else (residential, service, unnamed)
  return false;
}

export default function HomeMapWithSidebar() {
  // ============ STATE ============
  const [menuOpen, setMenuOpen] = useState(false);
  const [bottomSheetOpen, setBottomSheetOpen] = useState(false);
  const [bottomSheetHeight, setBottomSheetHeight] = useState("80px"); // collapsed, mid, expanded

  const [showReports, setShowReports] = useState(true); // Toggle for published simulations
  const [showCongestion, setShowCongestion] = useState(true); // Toggle for drawn lines

  const [searchQuery, setSearchQuery] = useState("");
  const [disruptions, setDisruptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedDisruption, setSelectedDisruption] = useState(null);
  const [loadingRoads, setLoadingRoads] = useState(false);

  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const layersRef = useRef([]);
  const osmCacheRef = useRef(new Map()); 

  // Search state
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState(null);
  const [searchMarker, setSearchMarker] = useState(null);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1);
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  const searchInputRef = useRef(null);
  const debounceTimerRef = useRef(null);
  const searchCacheRef = useRef(new Map());
  const [expandedDisruptionId, setExpandedDisruptionId] = useState(null);

  const [touchStart, setTouchStart] = useState(0);
  const [touchEnd, setTouchEnd] = useState(0);
  const bottomSheetRef = useRef(null);

  const [currentHour, setCurrentHour] = useState(new Date().getHours());

  const [liveTraffic, setLiveTraffic] = useState([]);
  const [showLiveTraffic, setShowLiveTraffic] = useState(true);
  const [lastTrafficUpdate, setLastTrafficUpdate] = useState(null);

  const reportMarkersRef = useRef([]); // ADD THIS LINE HERE
  const [publishedReports, setPublishedReports] = useState([]);
  const [showReportForm, setShowReportForm] = useState(false);
  const [reportPosition, setReportPosition] = useState(null);
  const [reportMode, setReportMode] = useState(false);
  const reportModeRef = useRef(false);
  const pendingReportMarkerRef = useRef(false);

  const [showRoutesModal, setShowRoutesModal] = useState(false);
  const [alternateRoutes, setAlternateRoutes] = useState([]);
  const [loadingRoutes, setLoadingRoutes] = useState(false);
  const [selectedRoute, setSelectedRoute] = useState(null);
  // ============ BOTTOM SHEET HANDLERS ============

  const toggleBottomSheet = () => {
    // Close menu when opening bottom sheet
    if (!bottomSheetOpen) {
      setMenuOpen(false);
    }

    if (!bottomSheetOpen) {
      setBottomSheetOpen(true);
      setBottomSheetHeight("50vh");
    } else if (bottomSheetHeight === "120px") {
      setBottomSheetHeight("50vh");
    } else if (bottomSheetHeight === "50vh") {
      setBottomSheetHeight("85vh");
    } else {
      setBottomSheetHeight("120px");
    }
  };

  const closeBottomSheet = () => {
    setBottomSheetHeight("120px");
    setBottomSheetOpen(false);
  };

  const handleTouchStart = (e) => {
    const y = e.targetTouches[0].clientY;
    setTouchStart(y);
    setTouchEnd(y);
  };

  const handleTouchMove = (e) => {
    setTouchEnd(e.targetTouches[0].clientY);
    
    const swipeDistance = touchStart - e.targetTouches[0].clientY;
    
    // Prevent pull-to-refresh when swiping down on bottom sheet
    if (swipeDistance < 0 && bottomSheetHeight !== "120px") {
      e.preventDefault();
    }
    
    // Always prevent when swiping up
    if (swipeDistance > 0) {
      e.preventDefault();
    }
  };

  const handleTouchEnd = () => {
    const swipeDistance = touchStart - touchEnd;
    const upThreshold = 1;   // Very sensitive for swiping UP
    const downThreshold = 30;  // Less sensitive for swiping DOWN (prevent accidental close)
    
    const resetTouch = () => {
      setTouchStart(0);
      setTouchEnd(0);
    };

    if (swipeDistance > upThreshold) {
      // Swiped UP (easy to trigger)
      if (bottomSheetHeight === "120px" || bottomSheetHeight === "80px") {
        setBottomSheetHeight("50vh");
        setBottomSheetOpen(true);
      } else if (bottomSheetHeight === "50vh") {
        setBottomSheetHeight("70vh");
      }
      resetTouch();
      return;
    }

    if (swipeDistance < -downThreshold) {
      // Swiped DOWN (harder to trigger)
      if (bottomSheetHeight === "85vh") {
        setBottomSheetHeight("50vh");
      } else if (bottomSheetHeight === "50vh") {
        setBottomSheetHeight("120px");
      } else {
        setBottomSheetHeight("120px");
        setBottomSheetOpen(false);
      }
      resetTouch();
      return;
    }
    
    resetTouch();
  };

  const handleMouseDown = (e) => {
    console.log('🖱️ MOUSE DOWN at Y:', e.clientY, 'Current height:', bottomSheetHeight);
    e.preventDefault();
    e.stopPropagation();
    setTouchStart(e.clientY);
    setTouchEnd(e.clientY);
  };

  const handleMouseMove = (e) => {
    if (touchStart !== 0) {
      console.log('🖱️ MOUSE MOVE at Y:', e.clientY, 'Distance:', touchStart - e.clientY);
      e.preventDefault();
      e.stopPropagation();
      setTouchEnd(e.clientY);
    }
  };

  const handleMouseUp = () => {
    console.log('🖱️ MOUSE UP - Start:', touchStart, 'End:', touchEnd);
    
    if (touchStart === 0) {
      console.log('❌ No touchStart, ignoring');
      return;
    }
    
    const swipeDistance = touchStart - touchEnd;
    console.log('📏 Distance:', swipeDistance, 'Threshold: 20', 'Current height:', bottomSheetHeight);
    
    const upThreshold = 1;
    const downThreshold = 30;

    const resetMouse = () => {
      setTouchStart(0);
      setTouchEnd(0);
    };

    if (swipeDistance > upThreshold) {
      console.log('✅ DRAGGED UP - Opening!');
      if (bottomSheetHeight === "120px" || bottomSheetHeight === "80px") {
        setBottomSheetHeight("50vh");
        setBottomSheetOpen(true);
      } else if (bottomSheetHeight === "50vh") {
        setBottomSheetHeight("85vh");
      }
      resetMouse();
      return;
    }

    if (swipeDistance < -downThreshold) {
      console.log('✅ DRAGGED DOWN - Closing!');
      if (bottomSheetHeight === "85vh") {
        setBottomSheetHeight("50vh");
      } else if (bottomSheetHeight === "50vh") {
        setBottomSheetHeight("120px");
      } else {
        setBottomSheetHeight("120px");
        setBottomSheetOpen(false);
      }
      resetMouse();
      return;
    }

    console.log('⚠️ Distance too small, ignoring');
    resetMouse();
  };

  const RouteCard = ({ route, onSelect, isSelected }) => {
    return (
      <div
        className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${
          isSelected
            ? 'border-blue-500 bg-blue-50 shadow-md'
            : 'border-gray-200 hover:border-blue-300 hover:shadow-sm'
        }`}
        onClick={onSelect}
      >
        {/* Route Badge */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center space-x-2">
            <div
              className="w-5 h-5 rounded-full border-2 border-white shadow"
              style={{ backgroundColor: route.color }}
            />
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">{route.direction_indicator}</span>
                <h4 className="font-bold text-gray-900">{route.scenario_name || route.name}</h4>
              </div>
              {route.scenario_description && (
                <p className="text-xs text-gray-500 italic">{route.scenario_description}</p>
              )}
            </div>
          </div>
          
          {!route.passes_through_disruption && (
            <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full">
              ✓ Clear
            </span>
          )}
        </div>
        
        {/* Stats Grid */}
        <div className="space-y-2 text-sm mb-3">
          <div className="flex items-center justify-between">
            <span className="text-gray-600 flex items-center">
              <FaRoad className="mr-1" /> Distance
            </span>
            <span className="font-semibold">{route.distance_text}</span>
          </div>
          
          <div className="flex items-center justify-between">
            <span className="text-gray-600 flex items-center">
              <FaClock className="mr-1" /> Time
            </span>
            <span className="font-semibold">{route.duration_text}</span>
          </div>
          
          {route.passes_through_disruption && (
            <div className="flex items-center justify-between text-orange-600">
              <span className="flex items-center">
                <FaExclamationTriangle className="mr-1" /> Delay
              </span>
              <span className="font-semibold">+{route.estimated_delay_minutes} min</span>
            </div>
          )}
        </div>
        
        {/* Description */}
        <p className="text-xs text-gray-500 leading-relaxed">
          {route.description}
        </p>
        
        {/* Action Button */}
        {isSelected && (
          <button className="mt-3 w-full btn btn-primary text-sm py-2">
            View Turn-by-Turn Directions →
          </button>
        )}
      </div>
    );
  };

  // ============================================================
  // Global handler for "Show Alternate Routes" button in popup
  // ============================================================
  useEffect(() => {
    // Make function globally accessible so popup button can call it
    window.showAlternateRoutes = (disruptionId) => {
      const disruption = disruptions.find(d => d.id === disruptionId);
      if (disruption) {
        setSelectedDisruption(disruption);
        setShowRoutesModal(true);
        fetchAlternateRoutes(disruption);
      }
    };
    
    // Cleanup
    return () => {
      delete window.showAlternateRoutes;
    };
  }, [disruptions]); // Re-run when disruptions change

  // handler for menu
  const toggleMenu = () => {
    // Close bottom sheet when opening menu
    if (!menuOpen) {
      setBottomSheetHeight("120px");
      setBottomSheetOpen(false);
    }
    setMenuOpen(!menuOpen);
  };

  useEffect(() => {
    fetchDisruptions();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentHour(new Date().getHours());
    }, 60000); // Update every minute to catch hour changes

    return () => clearInterval(interval);
  }, []);

  // Fetch published reports
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const map = L.map(mapRef.current, {
      center: [14.2096, 121.164],
      zoom: 13,
      zoomControl: false,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap",
      maxZoom: 19,
    }).addTo(map);

    L.control.zoom({ position: "bottomleft" }).addTo(map);

    let lastTap = 0;

    const handleConfirm = (latlng, marker) => {
      setReportPosition(latlng);
      setShowReportForm(true);
      // Don't remove the marker - keep it visible
    };

    const handleCancel = (marker) => {
      marker.remove();
      pendingReportMarkerRef.current = null;
    };

    // For desktop - double click
    map.on('dblclick', (e) => {
      if (!reportModeRef.current) return;
      
      L.DomEvent.stopPropagation(e);
      L.DomEvent.preventDefault(e);
      
      // Remove any existing pending marker
      if (pendingReportMarkerRef.current) {
        pendingReportMarkerRef.current.remove();
      }
      
      // Create custom pin icon
      const pinIcon = L.divIcon({
        className: 'custom-pin-marker',
        html: `
          <div style="
            position: relative;
            width: 40px;
            height: 50px;
          ">
            <div style="
              background-color: #fb923c;
              width: 40px;
              height: 40px;
              border-radius: 50% 50% 50% 0;
              transform: rotate(-45deg);
              border: 3px solid white;
              box-shadow: 0 4px 12px rgba(0,0,0,0.4);
              display: flex;
              align-items: center;
              justify-content: center;
            ">
              <span style="
                transform: rotate(45deg);
                font-size: 20px;
              ">📍</span>
            </div>
          </div>
        `,
        iconSize: [40, 50],
        iconAnchor: [20, 50],
        popupAnchor: [0, -50]
      });
      
      // Create marker
      const marker = L.marker([e.latlng.lat, e.latlng.lng], {
        icon: pinIcon
      }).addTo(map);
      
      // Create popup with buttons
      const popupDiv = document.createElement('div');
      popupDiv.style.cssText = 'min-width: 200px; text-align: center;';
      popupDiv.innerHTML = `
        <h3 style="font-weight: bold; margin-bottom: 12px; font-size: 16px;">
          Report Issue Here?
        </h3>
        <p style="font-size: 12px; color: #666; margin-bottom: 16px;">
          Location: ${e.latlng.lat.toFixed(5)}, ${e.latlng.lng.toFixed(5)}
        </p>
      `;
      
      const confirmBtn = document.createElement('button');
      confirmBtn.textContent = 'Yes, Report Here';
      confirmBtn.style.cssText = `
        background-color: #fb923c;
        color: white;
        border: none;
        padding: 10px 20px;
        border-radius: 8px;
        font-weight: bold;
        cursor: pointer;
        width: 100%;
        font-size: 14px;
        margin-bottom: 8px;
      `;
      confirmBtn.onclick = () => handleConfirm(e.latlng, marker);
      
      const cancelBtn = document.createElement('button');
      cancelBtn.textContent = 'Cancel';
      cancelBtn.style.cssText = `
        background-color: #e5e7eb;
        color: #374151;
        border: none;
        padding: 8px 16px;
        border-radius: 8px;
        cursor: pointer;
        width: 100%;
        font-size: 13px;
      `;
      cancelBtn.onclick = () => handleCancel(marker);
      
      popupDiv.appendChild(confirmBtn);
      popupDiv.appendChild(cancelBtn);
      
      marker.bindPopup(popupDiv, {
        closeButton: false,
        className: 'report-confirmation-popup'
      }).openPopup();
      
      pendingReportMarkerRef.current = marker;
    });

    // For mobile - double tap
    map.on('click', (e) => {
      if (!reportModeRef.current) return;
      
      const now = Date.now();
      const timeSinceLastTap = now - lastTap;
      
      if (timeSinceLastTap < 300 && timeSinceLastTap > 0) {
        L.DomEvent.stopPropagation(e);
        L.DomEvent.preventDefault(e);
        
        // Remove any existing pending marker
        if (pendingReportMarkerRef.current) {
          pendingReportMarkerRef.current.remove();
        }
        
        // Create custom pin icon
        const pinIcon = L.divIcon({
          className: 'custom-pin-marker',
          html: `
            <div style="
              position: relative;
              width: 40px;
              height: 50px;
            ">
              <div style="
                background-color: #fb923c;
                width: 40px;
                height: 40px;
                border-radius: 50% 50% 50% 0;
                transform: rotate(-45deg);
                border: 3px solid white;
                box-shadow: 0 4px 12px rgba(0,0,0,0.4);
                display: flex;
                align-items: center;
                justify-content: center;
              ">
                <span style="
                  transform: rotate(45deg);
                  font-size: 20px;
                ">📍</span>
              </div>
            </div>
          `,
          iconSize: [40, 50],
          iconAnchor: [20, 50],
          popupAnchor: [0, -50]
        });
        
        // Create marker
        const marker = L.marker([e.latlng.lat, e.latlng.lng], {
          icon: pinIcon
        }).addTo(map);
        
        // Create popup with buttons
        const popupDiv = document.createElement('div');
        popupDiv.style.cssText = 'min-width: 200px; text-align: center;';
        popupDiv.innerHTML = `
          <h3 style="font-weight: bold; margin-bottom: 12px; font-size: 16px;">
            📍 Report Issue Here?
          </h3>
          <p style="font-size: 12px; color: #666; margin-bottom: 16px;">
            Location: ${e.latlng.lat.toFixed(5)}, ${e.latlng.lng.toFixed(5)}
          </p>
        `;
        
        const confirmBtn = document.createElement('button');
        confirmBtn.textContent = 'Yes, Report Here';
        confirmBtn.style.cssText = `
          background-color: #fb923c;
          color: white;
          border: none;
          padding: 10px 20px;
          border-radius: 8px;
          font-weight: bold;
          cursor: pointer;
          width: 100%;
          font-size: 14px;
          margin-bottom: 8px;
        `;
        confirmBtn.onclick = () => handleConfirm(e.latlng, marker);
        
        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = 'Cancel';
        cancelBtn.style.cssText = `
          background-color: #e5e7eb;
          color: #374151;
          border: none;
          padding: 8px 16px;
          border-radius: 8px;
          cursor: pointer;
          width: 100%;
          font-size: 13px;
        `;
        cancelBtn.onclick = () => handleCancel(marker);
        
        popupDiv.appendChild(confirmBtn);
        popupDiv.appendChild(cancelBtn);
        
        marker.bindPopup(popupDiv, {
          closeButton: false,
          className: 'report-confirmation-popup'
        }).openPopup();
        
        pendingReportMarkerRef.current = marker;
        
        lastTap = 0;
      } else {
        lastTap = now;
      }
    });

    mapInstanceRef.current = map;

    return () => {
      reportMarkersRef.current.forEach(marker => marker.remove());
      reportMarkersRef.current = [];
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const fetchPublishedReports = async () => {
      try {
        const response = await fetch(`https://backend.urbanflowph.com/api/public-reports/published`);
        const data = await response.json();
        if (data.success) {
          setPublishedReports(data.data);
        }
      } catch (error) {
        console.error('Error fetching published reports:', error);
      }
    };

    fetchPublishedReports();
    const interval = setInterval(fetchPublishedReports, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    console.log('Published reports changed:', publishedReports.length);
    if (!mapInstanceRef.current || publishedReports.length === 0) return;
    drawReportMarkers();
  }, [publishedReports]);

  useEffect(() => {
    if (!mapInstanceRef.current || disruptions.length === 0) return;
    drawDisruptionsOnMap();
  }, [
    disruptions,
    showReports,
    showCongestion,
    currentHour,
  ]);

  const fetchDisruptions = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(
        `https://backend.urbanflowph.com/api/published-disruptions`
      );
      const data = await response.json();

      if (!response.ok || data.success === false) {
        setError("Unable to load disruptions");
        setDisruptions([]);
      } else {
        const disruptionData = data.disruptions || [];

        // Categorize disruptions
        const now = new Date();
        const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

        const categorized = disruptionData.map((d) => ({
          ...d,
          status: getDisruptionStatus(d, now, weekFromNow),
        }));
                // First set disruptions WITHOUT real-time data
        setDisruptions(categorized);

        // Then fetch real-time data for active disruptions (WAIT for completion)
        const activeDisruptions = categorized.filter(
          (d) => d.status === "active" && d.latitude && d.longitude
        );

        if (activeDisruptions.length > 0) {
          console.log(`🔄 Fetching real-time data for ${activeDisruptions.length} active disruption(s)...`);
          
          // Fetch all real-time data in parallel
          const realtimePromises = activeDisruptions.map(async (d) => {
            const success = await fetchRealtimeForDisruption(d);
            return { id: d.id, title: d.title, success };
          });

          // Wait for ALL to complete
          const results = await Promise.allSettled(realtimePromises);
          
          // Log results
          results.forEach((result, i) => {
            if (result.status === 'fulfilled' && result.value.success) {
              console.log(`✅ Real-time loaded: ${result.value.title}`);
            } else {
              console.log(`⚠️ Real-time failed: ${activeDisruptions[i].title}`);
            }
          });
          
          console.log("✅ Real-time data fetch completed!");
          
          // CRITICAL: Wait for React state to update
          await new Promise(resolve => setTimeout(resolve, 500));
          
          // Now update disruptions state with the real-time data that was fetched
          setDisruptions(prev => [...prev]); // Force re-render
        }
      }
    } catch (err) {
      setError("Failed to load disruptions");
      setDisruptions([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchLiveTraffic = useCallback(async () => {
    if (!mapInstanceRef.current) return;

    try {
      const bounds = mapInstanceRef.current.getBounds();
      const boundsString = `${bounds.getSouth()},${bounds.getWest()},${bounds.getNorth()},${bounds.getEast()}`;

      const response = await fetch(
        `http://localhost:5000/api/traffic/live-flow?bounds=${boundsString}`
      );
      const data = await response.json();

      if (data.success && data.segments) {
        setLiveTraffic(data.segments);
        setLastTrafficUpdate(new Date(data.timestamp));
        
        // Draw traffic on map
        drawLiveTrafficOnMap(data.segments);
      }
    } catch (error) {
      console.error('Error fetching live traffic:', error);
    }
  }, []);

  const drawLiveTrafficOnMap = (segments) => {
    if (!mapInstanceRef.current || !showLiveTraffic) return;
    
    const map = mapInstanceRef.current;
    
    // Remove old traffic layers
    layersRef.current = layersRef.current.filter(layer => {
      if (layer._trafficLayer) {
        map.removeLayer(layer);
        return false;
      }
      return true;
    });
    
    // Draw new traffic segments
    segments.forEach((segment, index) => {
      if (!segment.coordinates || segment.coordinates.length === 0) return;
      
      const positions = segment.coordinates.map(coord => [coord.latitude, coord.longitude]);
      
      const severityColors = {
        low: '#22c55e',
        moderate: '#eab308',
        high: '#f97316',
        severe: '#ef4444'
      };
      
      const color = severityColors[segment.severity] || '#6b7280';
      
      const polyline = L.polyline(positions, {
        color: color,
        weight: 6,
        opacity: 0.7,
        lineCap: 'round'
      }).addTo(map);
      
      polyline._trafficLayer = true; // Mark as traffic layer
      
      polyline.bindPopup(`
        <div style="padding: 8px;">
          <h3 style="margin: 0 0 6px 0; font-weight: bold;">Live Traffic</h3>
          <p style="margin: 2px 0; font-size: 12px;">Current: ${Math.round(segment.currentSpeed)} km/h</p>
          <p style="margin: 2px 0; font-size: 12px;">Free Flow: ${Math.round(segment.freeFlowSpeed)} km/h</p>
          <p style="margin: 2px 0; font-size: 12px;">Status: <strong>${segment.severity.toUpperCase()}</strong></p>
        </div>
      `);
      
      layersRef.current.push(polyline);
    });
  };

    // Auto-refresh live traffic
  useEffect(() => {
    if (mapInstanceRef.current && showLiveTraffic) {
      fetchLiveTraffic();
      
      const interval = setInterval(() => {
        fetchLiveTraffic();
      }, 60000);

      return () => clearInterval(interval);
    }
  }, [showLiveTraffic, fetchLiveTraffic]);

  // ============ AUTOCOMPLETE SEARCH FUNCTIONALITY ============

  const debouncedSearch = useCallback((query) => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    if (query.trim().length < 2) {
      setSearchResults([]);
      setSearchError(null);
      setSearchLoading(false);
      return;
    }

    setSearchLoading(true);
    setSearchError(null);

    debounceTimerRef.current = setTimeout(() => {
      performAutocompleteSearch(query);
    }, 300);
  }, []);

  const performAutocompleteSearch = async (query) => {
    if (!query.trim()) {
      setSearchLoading(false);
      return;
    }

    const cacheKey = query.toLowerCase().trim();
    if (searchCacheRef.current.has(cacheKey)) {
      const cachedResults = searchCacheRef.current.get(cacheKey);
      setSearchResults(cachedResults);
      setSearchLoading(false);
      setSelectedSuggestionIndex(-1);
      return;
    }

    try {
      const searchQueryFormatted = `${query}, Philippines`;

      const params = new URLSearchParams({
        q: searchQueryFormatted,
        format: "json",
        countrycodes: "ph",
        limit: "8",
        addressdetails: "1",
        bounded: "1",
        viewbox: "120.0,15.0,122.0,13.0",
      });

      const url = `https://nominatim.openstreetmap.org/search?${params.toString()}`;

      const response = await fetch(url, {
        method: "GET",
        headers: {
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`Search failed: ${response.status}`);
      }

      const results = await response.json();

      searchCacheRef.current.set(cacheKey, results);

      if (searchCacheRef.current.size > 50) {
        const firstKey = searchCacheRef.current.keys().next().value;
        searchCacheRef.current.delete(firstKey);
      }

      if (!results || results.length === 0) {
        setSearchError(`No results found for "${query}"`);
        setSearchResults([]);
      } else {
        setSearchResults(results);
        setSearchError(null);
      }

      setSelectedSuggestionIndex(-1);
    } catch (err) {
      console.error("Autocomplete search error:", err);
      setSearchError("Search temporarily unavailable. Try again in a moment.");
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  };

  const handleSearchInputChange = (e) => {
    const value = e.target.value;
    setSearchQuery(value);
    debouncedSearch(value);
  };

  const handleSearchKeyDown = (e) => {
    const hasVisibleDropdown =
      isSearchFocused &&
      (searchResults.length > 0 || searchLoading || searchError);

    if (!hasVisibleDropdown) {
      if (e.key === "Enter" && searchQuery.trim().length >= 2) {
        e.preventDefault();
        performAutocompleteSearch(searchQuery);
      }
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedSuggestionIndex((prev) =>
          prev < searchResults.length - 1 ? prev + 1 : prev
        );
        break;

      case "ArrowUp":
        e.preventDefault();
        setSelectedSuggestionIndex((prev) => (prev > 0 ? prev - 1 : -1));
        break;

      case "Enter":
        e.preventDefault();
        if (
          selectedSuggestionIndex >= 0 &&
          searchResults[selectedSuggestionIndex]
        ) {
          selectSearchResult(searchResults[selectedSuggestionIndex]);
        } else if (searchResults.length > 0) {
          selectSearchResult(searchResults[0]);
        }
        break;

      case "Escape":
        e.preventDefault();
        setIsSearchFocused(false);
        setSelectedSuggestionIndex(-1);
        searchInputRef.current?.blur();
        break;

      default:
        break;
    }
  };

  /**
   * CRITICAL FIX: Handle suggestion click without losing input focus
   */
  const handleSuggestionClick = (result, e) => {
    // Prevent the mousedown from stealing focus from input
    e.preventDefault();
    e.stopPropagation();

    selectSearchResult(result);
  };

  const selectSearchResult = (result) => {
    if (!mapInstanceRef.current) return;

    const map = mapInstanceRef.current;
    const lat = parseFloat(result.lat);
    const lon = parseFloat(result.lon);

    if (searchMarker) {
      map.removeLayer(searchMarker);
    }

    const searchIcon = L.divIcon({
      className: "search-marker",
      html: `
        <div style="position: relative;">
          <div style="
            background: #3b82f6;
            border: 3px solid white;
            border-radius: 50% 50% 50% 0;
            width: 40px;
            height: 40px;
            transform: rotate(-45deg);
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
          ">
            <span style="transform: rotate(45deg); font-size: 20px;">📍</span>
          </div>
        </div>
      `,
      iconSize: [40, 40],
      iconAnchor: [20, 40],
    });

    const marker = L.marker([lat, lon], {
      icon: searchIcon,
    }).addTo(map);

    const displayName = result.display_name || "Selected Location";
    marker
      .bindPopup(
        `
      <div style="font-family: -apple-system, sans-serif; padding: 10px; min-width: 200px;">
        <h3 style="margin: 0 0 8px 0; font-size: 14px; font-weight: 600; color: #3b82f6;">
          📍 Search Result
        </h3>
        <p style="margin: 0; font-size: 12px; color: #4b5563;">
          ${displayName}
        </p>
        <p style="margin: 4px 0 0 0; font-size: 11px; color: #9ca3af;">
          ${lat.toFixed(6)}, ${lon.toFixed(6)}
        </p>
      </div>
    `
      )
      .openPopup();

    setSearchMarker(marker);

    map.setView([lat, lon], 16, {
      animate: true,
      duration: 1,
    });

    setSearchQuery(result.display_name);
    setIsSearchFocused(false);
    setSelectedSuggestionIndex(-1);
    searchInputRef.current?.blur();
  };

  // ============ END SEARCH FUNCTIONALITY ============

  const shouldShowDropdown =
    isSearchFocused &&
    (searchResults.length > 0 ||
      searchLoading ||
      (searchError && searchQuery.trim().length >= 2));

  const getDisruptionStatus = (disruption, now, weekFromNow) => {
    if (!disruption.start_date || !disruption.end_date) return "unknown";

    const start = new Date(disruption.start_date);
    const end = new Date(disruption.end_date);

    if (now >= start && now <= end) return "active";
    if (start > now && start <= weekFromNow) return "upcoming";
    if (end < now) return "past";
    return "future";
  };

  const fetchRealtimeForDisruption = async (disruption) => {
    try {
      const response = await fetch(
          `http://localhost:5000/api/realtime-traffic`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            lat: disruption.latitude,
            lng: disruption.longitude,
          }),
        }
      );

      const data = await response.json();

      if (data.success && response.ok) {
        console.log(`🔴 Real-time data for "${disruption.title}":`, {
          congestion_ratio: data.congestion_ratio,
          delay_minutes: data.delay_minutes,
          current_speed: data.current_speed,
          free_flow_speed: data.free_flow_speed
        });
        
        // Update disruption with real-time data
        return new Promise((resolve) => {
          setDisruptions((prev) => {
            const updated = prev.map((d) =>
              d.id === disruption.id ? { ...d, realtime: data } : d
            );
            resolve(true);
            return updated;
          });
        });
      } else {
        console.warn(`❌ No real-time data for "${disruption.title}"`);
        return false;
      }
    } catch (err) {
      console.warn(`❌ Failed to fetch real-time data for "${disruption.title}":`, err.message);
      return false;
    }
  };

  const drawDisruptionsOnMap = async () => {
    if (!mapInstanceRef.current || !mapInstanceRef.current._loaded) return;

    const map = mapInstanceRef.current;

    // ✅ Clear old layers - with force clear
    const oldLayers = [...layersRef.current];
    layersRef.current = [];
    
    oldLayers.forEach((layer) => {
      try {
        if (layer && map.hasLayer(layer)) {
          map.removeLayer(layer);
        }
      } catch (e) {
        console.warn('Layer removal failed:', e);
      }
    });

    layersRef.current = [];

    if (!showReports) return;

    // Draw disruptions based on status with rate limiting
    for (let i = 0; i < disruptions.length; i++) {
      const disruption = disruptions[i];
      
      if (disruption.status === "active") {
        await drawActiveDisruption(disruption);
        if (i < disruptions.length - 1) {
          await sleep(3000); // 1s delay between each disruption
        }
      } else if (disruption.status === "upcoming") {
        drawUpcomingDisruption(disruption);
      }
    }

    // Fit map to show all disruptions
    const validDisruptions = disruptions.filter(
      (d) =>
        d.latitude &&
        d.longitude &&
        (d.status === "active" || d.status === "upcoming")
    );
    if (validDisruptions.length > 0) {
      const bounds = validDisruptions.map((d) => [d.latitude, d.longitude]);
      try {
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
      } catch (e) {}
    }
  };

  // FIND drawActiveDisruption function (around line 160):
  const drawActiveDisruption = async (disruption) => {
    if (!disruption.latitude || !disruption.longitude) return;

    const map = mapInstanceRef.current;
    if (!map || !map._loaded) return;

    // Clear existing layers for THIS specific disruption before redrawing
    layersRef.current = layersRef.current.filter((layer) => {
      if (layer._disruptionId === disruption.id) {
        try {
          if (map.hasLayer(layer)) {
            map.removeLayer(layer);
          }
        } catch (e) {
          console.warn('Layer removal failed:', e);
        }
        return false; // Remove from array
      }
      return true; // Keep other disruptions
    });
    
    const isSelected = selectedDisruption?.id === disruption.id;
    const center = { lat: disruption.latitude, lng: disruption.longitude };

    // ✅ Get severity for CURRENT HOUR (not average)
    // ✅ Get severity for CURRENT HOUR (not average)
   // ✅ BLEND REAL-TIME WITH PREDICTIONS
    let severity, delayMin, color, isUsingRealTime = false;

    // Get current hour in Philippines timezone (UTC+8)
    const now = new Date();
    const currentHour = (now.getUTCHours() + 8) % 24;

    // 1. Try to get real-time data first (most accurate)
      // 1. Try to get real-time data first (most accurate)
    if (disruption.realtime && typeof disruption.realtime.congestion_ratio === 'number') {
      severity = disruption.realtime.congestion_ratio;
      delayMin = disruption.realtime.delay_minutes || disruption.expected_delay || 0;
      isUsingRealTime = true;
      console.log(`🔴 LIVE: ${disruption.title} - Severity: ${severity.toFixed(2)} (Real-time)`, disruption.realtime);
    } 
    // 2. Fall back to current hour prediction
    else {
      const hourPrediction = disruption.hourly_predictions?.find(
        (h) => h.hour === currentHour
      );
      severity = hourPrediction?.severity || disruption.avg_severity || 1.5;
      delayMin = hourPrediction?.delay_info?.additional_delay_min || disruption.expected_delay || 0;
      console.log(`📊 PREDICTED: ${disruption.title} - Hour ${currentHour} Severity: ${severity.toFixed(2)}`);
    }

    color = getImpactColor(severity);

    // ✅ Log all 24 hours for comparison
    if (disruption.hourly_predictions) {
      console.table(
        disruption.hourly_predictions.map(h => ({
          Hour: h.hour,
          Severity: h.severity?.toFixed(2),
          Delay: h.delay_info?.additional_delay_min,
          Label: h.severity_label
        }))
      );
    }

    // Draw marker
    const marker = L.marker([disruption.latitude, disruption.longitude], {
      icon: L.divIcon({
        className: "disruption-marker-active",
       html: `
        <div style="position: relative; width: 40px; height: 40px; pointer-events: none;">
          ${isUsingRealTime ? `
          <div style="
            position: absolute;
            top: -8px;
            right: -8px;
            width: 20px;
            height: 20px;
            background: linear-gradient(135deg, #ef4444, #dc2626);
            border: 2px solid white;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 10px;
            box-shadow: 0 2px 8px rgba(239, 68, 68, 0.5);
            animation: live-pulse 1.5s ease-in-out infinite;
            z-index: 20;
          ">🔴</div>
          <style>
            @keyframes live-pulse {
              0%, 100% { transform: scale(1); opacity: 1; }
              50% { transform: scale(1.15); opacity: 0.8; }
            }
          </style>
          ` : ''}
          <div style="
            position: absolute; top: 50%; left: 50%;
            transform: translate(-50%, -50%);
            width: 48px; height: 48px;
            border: 2px solid ${color}; border-radius: 50%;
            opacity: ${isSelected ? "0.5" : "0.3"};
            animation: pulse-active 2s ease-out infinite;
            pointer-events: none;
          "></div>
          <div style="
            background: white;
            border: ${isSelected ? "4px" : "3px"} solid ${color};
            border-radius: 50%;
            width: 40px; height: 40px;
            display: flex; align-items: center; justify-content: center;
            font-size: 20px;
            box-shadow: ${isSelected ? "0 6px 20px rgba(0,0,0,0.5)" : "0 4px 12px rgba(0,0,0,0.3)"};
            cursor: pointer;
            pointer-events: all;
            position: relative;
            z-index: 10;
          ">🚧</div>
        </div>
      `,
        iconSize: [40, 40],
        iconAnchor: [20, 20],
      }),
      zIndexOffset: isSelected ? 2000 : 1000,
    }).addTo(map);

  // ✅ Bind popup first
    marker.bindPopup(createActivePopup(disruption));
    
    // ✅ Then add click handler
    marker.on("click", (e) => {
      L.DomEvent.stopPropagation(e);
      setSelectedDisruption(disruption);
      
      // Close menu/bottom sheet
      setMenuOpen(false);
      setBottomSheetHeight("120px");
      
      // Popup opens automatically via Leaflet
    });
    marker._disruptionId = disruption.id;
    layersRef.current.push(marker);


    if (!showCongestion) return;

    // ✅ CRITICAL: Verify coordinates
    console.log(`📍 Fetching roads for disruption at: ${center.lat}, ${center.lng}`);

    // Clear ALL cache to prevent stale data
    osmCacheRef.current.clear();

    const roads = await fetchRoadsFromOSM(center.lat, center.lng, 200, osmCacheRef);
    console.log(`🗺️ Fetched ${roads?.length || 0} roads near disruption`);
    if (!roads || roads.length === 0) {
          // ✅ Only create fallback circle if roads genuinely failed (not just cached error)
          // Don't create circle if OSM is timing out - this prevents piling up
          if (roads === null) {
            // OSM failed - just show marker without congestion visualization
            console.log('⚠️ Skipping congestion lines due to OSM error');
            return;
          }
          
          // Only create circle if roads array is empty (no roads found, but request succeeded)
         // ✅ Only show fallback if roads request succeeded but returned empty
          // Don't show anything if OSM failed (null) - this prevents circles from piling up
          if (!roads) {
            // OSM failed or rate limited - just show marker without congestion
            console.log(`⚠️ No congestion visualization for ${disruption.title} (OSM unavailable)`);
            return;
          }
          
          if (roads.length === 0) {
            // OSM succeeded but no roads found - show generic circle
            const circle = L.circle([center.lat, center.lng], {
              radius: 300,
              color: color,
              fillColor: color,
              fillOpacity: 0.2,
              weight: 2,
            }).addTo(map);
            circle._disruptionId = disruption.id;
            layersRef.current.push(circle);
            return;
          }
    }

    // ✅ Draw roads with CURRENT HOUR severity
    console.log(`✓ Drawing congestion lines for ${disruption.title} on ${roads.length} roads`);

  // ✅ VALIDATE: Check if roads are actually near the disruption
  const nearbyRoads = roads.filter((road) => {
    const coords = road.coordinates;
    if (coords.length < 2) return false;
    
    // Calculate min distance to disruption center
    const minDistToCenter = Math.min(
      ...coords.map(c => getDistanceMeters(center.lat, center.lng, c[0], c[1]))
    );
    
    // Only include roads within 500m of disruption
    return minDistToCenter <= 500;
  });

  console.log(`✓ Found ${nearbyRoads.length} roads near disruption (filtered from ${roads.length})`);

  if (nearbyRoads.length === 0) {
    console.warn(`⚠️ No roads found near disruption at ${center.lat}, ${center.lng}`);
    return;
  }

  // ✅ Draw roads with CURRENT HOUR severity (filtered)
  nearbyRoads.forEach((road) => {
    const coords = road.coordinates;
    if (coords.length < 2) return;

    // Calculate min distance to disruption center
    const minDistToCenter = Math.min(
      ...coords.map(c => getDistanceMeters(center.lat, center.lng, c[0], c[1]))
    );

    // ✅ FILTER: Skip unimportant roads
    if (!shouldIncludeRoad(road, minDistToCenter)) {
      return; // Skip this road
    }

      for (let i = 0; i < coords.length - 1; i++) {
        const startCoord = coords[i];
        const endCoord = coords[i + 1];

        const midLat = (startCoord[0] + endCoord[0]) / 2;
        const midLng = (startCoord[1] + endCoord[1]) / 2;
        const distToCenter = getDistanceMeters(center.lat, center.lng, midLat, midLng);

        // ✅ Severity affects max render distance
        const maxDist = severity >= 1.5 ? 600 : severity >= 1.0 ? 450 : 350;
        if (distToCenter > maxDist) continue;

        let segmentColor, weight, opacity;

        // ✅ Apply distance-based severity gradient (closer = more severe)
        const distanceFactor = Math.max(0, 1 - (distToCenter / maxDist));
        const adjustedSeverity = severity * (0.4 + distanceFactor * 0.6); // 40%-100% severity based on distance

        if (distToCenter < 80) {
          segmentColor = getImpactColor(adjustedSeverity);
          weight = isUsingRealTime ? 10 : 9; // Thicker if real-time
          opacity = isUsingRealTime ? 0.95 : 0.9;
        } else if (distToCenter < 150) {
          segmentColor = getImpactColor(adjustedSeverity * 0.9);
          weight = isUsingRealTime ? 8 : 7;
          opacity = isUsingRealTime ? 0.85 : 0.8;
        } else if (distToCenter < 250) {
          segmentColor = getImpactColor(adjustedSeverity * 0.8);
          weight = 6;
          opacity = 0.7;
        } else {
          segmentColor = getImpactColor(adjustedSeverity * 0.6);
          weight = 5;
          opacity = 0.5;
        }

       // ✅ Safety check before adding layers
        if (!map || !map._loaded) continue;

        try {
          // Shadow
          const shadow = L.polyline(
            [[startCoord[0], startCoord[1]], [endCoord[0], endCoord[1]]],
            { color: "#1f2937", weight: weight + 3, opacity: 0.12, lineCap: "round" }
          ).addTo(map);
          shadow._disruptionId = disruption.id;
          layersRef.current.push(shadow);

          // Segment
          const segment = L.polyline(
            [[startCoord[0], startCoord[1]], [endCoord[0], endCoord[1]]],
            {
              color: segmentColor,
              weight: weight,
              opacity: opacity,
              lineCap: "round",
              lineJoin: "round",
            }
          ).addTo(map);
          segment._disruptionId = disruption.id; 
          layersRef.current.push(segment);
        } catch (e) {
          console.warn('Failed to add road segment:', e);
        }
      }
    });
  };

  const drawUpcomingDisruption = (disruption) => {
    if (!disruption.latitude || !disruption.longitude) return;

    const map = mapInstanceRef.current;
    const isSelected = selectedDisruption?.id === disruption.id;

    // Use gray/blue for upcoming
    const color = "#3B82F6";

    // ✅ Draw circular impact zone if showCongestion is enabled
    if (showCongestion) {
      const circle = L.circle([disruption.latitude, disruption.longitude], {
        radius: 400,
        color: color,
        fillColor: color,
        fillOpacity: isSelected ? 0.15 : 0.1,
        weight: isSelected ? 2 : 1,
        dashArray: "5, 5", // Dashed line for upcoming
      }).addTo(map);

      layersRef.current.push(circle);
    }

    // Draw marker for upcoming 
    const marker = L.marker([disruption.latitude, disruption.longitude], {
      icon: L.divIcon({
        className: "disruption-marker-upcoming",
        html: `
          <div style="position: relative; width: 36px; height: 36px; pointer-events: none;">
            <div style="
              position: absolute;
              top: 50%;
              left: 50%;
              transform: translate(-50%, -50%);
              width: 44px; height: 44px;
              border: 2px solid ${color};
              border-radius: 50%;
              opacity: ${isSelected ? "0.5" : "0.4"};
              animation: pulse-upcoming 2s ease-out infinite;
              pointer-events: none;
            "></div>
            <div style="
              background: white;
              border: ${isSelected ? "3px" : "2px"} solid ${color};
              border-radius: 50%;
              width: 36px; height: 36px;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 18px;
              box-shadow: ${isSelected ? "0 6px 20px rgba(59, 130, 246, 0.5)" : "0 4px 12px rgba(59, 130, 246, 0.3)"};
              cursor: pointer;
              pointer-events: all;
              position: relative;
              z-index: 10;
            ">📅</div>
          </div>
        `,
        iconSize: [36, 36],
        iconAnchor: [18, 18],
      }),
      zIndexOffset: isSelected ? 2000 : 1000,
    }).addTo(map);

    // ✅ Bind popup first
    marker.bindPopup(createUpcomingPopup(disruption));
    
    // ✅ Then add click handler
    marker.on("click", (e) => {
      L.DomEvent.stopPropagation(e);
      setSelectedDisruption(disruption);
      
      // Close menu/bottom sheet
      setMenuOpen(false);
      setBottomSheetHeight("120px");
      
      // Popup opens automatically via Leaflet
    });
    marker._disruptionId = disruption.id;
    layersRef.current.push(marker);
  };

  // ============================================================
  // ALTERNATE ROUTES FUNCTIONS
  // ============================================================

  const fetchAlternateRoutes = async (disruption) => {
    setLoadingRoutes(true);
    setAlternateRoutes([]);
    
    try {
      const disruption_center = {
        lat: disruption.latitude,
        lng: disruption.longitude
      };
      
      // ✅ Get ALL active disruptions to avoid them all
      const allDisruptionCenters = disruptions
        .filter(d => d.status === 'active')
        .map(d => ({
          lat: d.latitude,
          lng: d.longitude,
          radius: 500 // 500m avoidance radius
        }));
      
      console.log(`🚫 Avoiding ${allDisruptionCenters.length} active disruptions`);
      
      // ✅ Helper function to check if a route avoids all disruptions
      const routeAvoidsAllDisruptions = (route) => {
        const routeCoords = decodePolyline(route.polyline);
        
        // Check if route passes through ANY active disruption
        const passesAnyDisruption = allDisruptionCenters.some(disruptionPoint => {
          return routeCoords.some(coord => {
            const distance = getDistanceMeters(
              coord[0], coord[1], 
              disruptionPoint.lat, disruptionPoint.lng
            );
            return distance < disruptionPoint.radius;
          });
        });
        
        return !passesAnyDisruption;
      };
      
      // ✅ Determine main road orientation by analyzing road name
      const roadName = disruption.title?.toLowerCase() || '';
      const isNorthSouthRoad = roadName.includes('highway') || 
                               roadName.includes('national') ||
                               roadName.includes('maharlika');
      const isEastWestRoad = roadName.includes('rizal') || 
                             roadName.includes('cuervo') ||
                             roadName.includes('real');
      
      // ✅ Generate only 2-3 practical route scenarios based on road type
      let routeScenarios = [];
      
      if (isNorthSouthRoad) {
        // For North-South highways, provide:
        // 1. Route going through parallel eastern roads
        // 2. Route going through parallel western roads
        routeScenarios = [
          {
            name: 'Eastern Bypass',
            description: 'Via eastern parallel roads (e.g., Real St, Chipeco)',
            origin: { lat: disruption.latitude + 0.025, lng: disruption.longitude + 0.008 },     // NE
            destination: { lat: disruption.latitude - 0.025, lng: disruption.longitude + 0.008 }, // SE
            color: '#3B82F6' // Blue
          },
          {
            name: 'Western Bypass',
            description: 'Via western parallel roads (e.g., Turbina, Bucal)',
            origin: { lat: disruption.latitude + 0.025, lng: disruption.longitude - 0.008 },     // NW
            destination: { lat: disruption.latitude - 0.025, lng: disruption.longitude - 0.008 }, // SW
            color: '#10B981' // Green
          }
        ];
      } else if (isEastWestRoad) {
        // For East-West roads, provide:
        // 1. Route via northern parallel roads
        // 2. Route via southern parallel roads
        routeScenarios = [
          {
            name: 'Northern Detour',
            description: 'Via northern roads',
            origin: { lat: disruption.latitude + 0.008, lng: disruption.longitude - 0.025 },     // NW
            destination: { lat: disruption.latitude + 0.008, lng: disruption.longitude + 0.025 }, // NE
            color: '#3B82F6' // Blue
          },
          {
            name: 'Southern Detour',
            description: 'Via southern roads',
            origin: { lat: disruption.latitude - 0.008, lng: disruption.longitude - 0.025 },     // SW
            destination: { lat: disruption.latitude - 0.008, lng: disruption.longitude + 0.025 }, // SE
            color: '#10B981' // Green
          }
        ];
      } else {
        // For other roads, provide 2 diagonal routes
        routeScenarios = [
          {
            name: 'Route Option 1',
            description: 'Primary alternate route',
            origin: { lat: disruption.latitude + 0.02, lng: disruption.longitude - 0.015 },
            destination: { lat: disruption.latitude - 0.02, lng: disruption.longitude + 0.015 },
            color: '#3B82F6' // Blue
          },
          {
            name: 'Route Option 2',
            description: 'Secondary alternate route',
            origin: { lat: disruption.latitude + 0.02, lng: disruption.longitude + 0.015 },
            destination: { lat: disruption.latitude - 0.02, lng: disruption.longitude - 0.015 },
            color: '#10B981' // Green
          }
        ];
      }
      
      console.log(`🗺️ Calculating ${routeScenarios.length} practical alternate routes...`);
      
      // Fetch routes for each scenario
      const routePromises = routeScenarios.map(async (scenario, index) => {
        try {
          const response = await fetch('http://localhost:5000/api/calculate-alternate-routes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              origin: scenario.origin,
              destination: scenario.destination,
              disruption_center,
              disruption_radius_m: 800, // Larger avoidance radius
              avoid_tolls: false,
              all_disruptions: allDisruptionCenters, // ✅ Pass ALL disruptions
              scenario_name: scenario.name
            })
          });
          
          const data = await response.json();
          
          if (data.success && data.routes && data.routes.length > 0) {
            // Get the route that best avoids disruptions (trust backend first)
            let bestRoute = data.routes.find(r => !r.passes_through_disruption);
            
            // If no route marked as avoiding disruption, do client-side check
            if (!bestRoute) {
              bestRoute = data.routes.find(r => routeAvoidsAllDisruptions(r));
            }
            
            // Fallback to first route if nothing avoids disruption
            if (!bestRoute) {
              bestRoute = data.routes[0];
            }
            
            return {
              ...bestRoute,
              name: scenario.name,
              description: scenario.description,
              color: scenario.color, // Use scenario color
              unique_id: `route_${index}_${Date.now()}`,
              display_index: index + 1,
              avoids_all_disruptions: routeAvoidsAllDisruptions(bestRoute) // ✅ Client-verified
            };
          }
          return null;
        } catch (err) {
          console.error(`❌ Failed to fetch ${scenario.name}:`, err);
          return null;
        }
      });
      
      // Wait for all route calculations
      const allRoutes = await Promise.all(routePromises);
      
      // Filter out failed requests and prioritize routes that avoid all disruptions
      const validRoutes = allRoutes
        .filter(route => route !== null)
        .sort((a, b) => {
          // Prioritize routes that avoid all disruptions
          if (a.avoids_all_disruptions && !b.avoids_all_disruptions) return -1;
          if (!a.avoids_all_disruptions && b.avoids_all_disruptions) return 1;
          return 0;
        });
      
      if (validRoutes.length > 0) {
        setAlternateRoutes(validRoutes);
        console.log(`✅ Found ${validRoutes.length} alternate routes (${validRoutes.filter(r => r.avoids_all_disruptions).length} avoid all disruptions)`);
        
        // ✅ Automatically draw all routes on map
        setTimeout(() => {
          drawAllRoutesOnMap(validRoutes);
        }, 500);
      } else {
        console.warn('⚠️ No valid alternate routes found');
        alert('Unable to calculate alternate routes. The area may have limited road options or too many active disruptions.');
      }
      
    } catch (error) {
      console.error('❌ Error fetching alternate routes:', error);
      alert('Error calculating alternate routes. Please try again.');
    } finally {
      setLoadingRoutes(false);
    }
  };

  // ✅ NEW: Draw all alternate routes on map automatically
  const drawAllRoutesOnMap = (routes) => {
    if (!mapInstanceRef.current || !routes || routes.length === 0) return;
    
    const map = mapInstanceRef.current;
    
    console.log(`🗺️ Drawing ${routes.length} alternate routes on public map`);
    
    // Remove existing route layers
    layersRef.current = layersRef.current.filter(layer => {
      if (layer._routeLayer) {
        map.removeLayer(layer);
        return false;
      }
      return true;
    });
    
    // Draw each route
    routes.forEach((route, index) => {
      const coordinates = decodePolyline(route.polyline);
      
      if (coordinates.length === 0) {
        console.error(`Failed to decode polyline for route ${index}`);
        return;
      }
      
      // Draw route line
      const routeLine = L.polyline(coordinates, {
        color: route.color,
        weight: 5,
        opacity: 0.75,
        lineCap: 'round',
        lineJoin: 'round'
      }).addTo(map);
      
      routeLine._routeLayer = true;
      routeLine._routeId = route.unique_id; 
      
      // Add popup
      const popupContent = `
        <div style="padding: 12px; min-width: 220px;">
          <h3 style="margin: 0 0 6px 0; font-weight: bold; color: ${route.color}; font-size: 15px;">
            ${route.name}
          </h3>
          <p style="margin: 0 0 10px 0; font-size: 11px; color: #6b7280; font-style: italic; line-height: 1.4;">
            ${route.description}
          </p>
          <div style="padding-top: 8px; border-top: 1px solid #e5e7eb;">
            <p style="margin: 4px 0; font-size: 12px;">
              <strong>Distance:</strong> ${route.distance_text}
            </p>
            <p style="margin: 4px 0; font-size: 12px;">
              <strong>Time:</strong> ${route.duration_text}
            </p>
            <p style="margin: 8px 0 0 0; padding: 6px 8px; background: #d1fae5; border-radius: 6px; font-size: 11px; color: #065f46; font-weight: 600;">
              ✓ Avoids all disruptions
            </p>
          </div>
        </div>
      `;
      
      routeLine.bindPopup(popupContent);
      
      // Highlight on hover
      routeLine.on('mouseover', function() {
        this.setStyle({ weight: 7, opacity: 1 });
      });
      
      routeLine.on('mouseout', function() {
        this.setStyle({ weight: 5, opacity: 0.75 });
      });
      
      layersRef.current.push(routeLine);
    });
    
    console.log('✅ All alternate routes drawn on map');
  };

  const viewRouteDirections = (route) => {
    setSelectedRoute(route);
    
    // ✅ Draw the route on map
    drawRouteOnMap(route);
    
    console.log('✅ Route drawn on map:', route.scenario_name || route.name);
  };

  const shareRoute = (method) => {
    if (!selectedRoute) return;
    
    const routeText = `
  🗺️ UrbanFlow Alternate Route

  Route: ${selectedRoute.name}
  Distance: ${selectedRoute.distance_text}
  Time: ${selectedRoute.duration_text}
  ${selectedRoute.passes_through_disruption ? `⚠️ Expected delay: +${selectedRoute.estimated_delay_minutes} min` : '✓ Avoids disruption'}

  View on Google Maps: https://www.google.com/maps/dir/?api=1
    `.trim();
    
    if (method === 'sms') {
      // Open SMS app (mobile only)
      window.location.href = `sms:?body=${encodeURIComponent(routeText)}`;
    } else if (method === 'email') {
      // Open email client
      window.location.href = `mailto:?subject=UrbanFlow Alternate Route&body=${encodeURIComponent(routeText)}`;
    }
  };

  const copyRouteLink = () => {
    if (!selectedRoute) return;
    
    // Simple text copy (you can enhance this with a proper Google Maps link)
    const routeInfo = `${selectedRoute.name}: ${selectedRoute.distance_text}, ${selectedRoute.duration_text}`;
    
    navigator.clipboard.writeText(routeInfo).then(() => {
      alert('✅ Route info copied to clipboard!');
    }).catch(() => {
      alert('❌ Failed to copy. Please try manually.');
    });
  };

  // Add this function with your other drawing functions
  const drawRouteOnMap = (selectedRoute) => {
    if (!mapInstanceRef.current || !selectedRoute.polyline) return;
    
    const map = mapInstanceRef.current;
    
    // Don't remove all routes, just update their styles
    layersRef.current.forEach(layer => {
      if (layer._routeLayer) {
        // Reset all routes to normal style
        layer.setStyle({
          weight: 5,
          opacity: 0.75
        });
      }
    });
    
    // Decode the selected route's polyline
    const coordinates = decodePolyline(selectedRoute.polyline);
    
    if (coordinates.length === 0) {
      console.error('Failed to decode polyline');
      return;
    }
    
    // Find and highlight the selected route layer
    layersRef.current.forEach(layer => {
      if (layer._routeLayer && layer._routeId === selectedRoute.unique_id) {
        layer.setStyle({
          weight: 8,
          opacity: 1
        });
        layer.bringToFront();
      }
    });
    
    // Fit map to show the selected route
    const bounds = L.latLngBounds(coordinates);
    map.fitBounds(bounds, { 
      padding: [50, 50],
      maxZoom: 15
    });
    
    console.log('✅ Route highlighted on map:', selectedRoute.scenario_name || selectedRoute.name);
  };

  const drawCongestionSegments = (disruption, hourlyData, color) => {
    const map = mapInstanceRef.current;

    // Create polyline segments based on severity
    const coordinates = disruption.road_coordinates || [
      [disruption.latitude, disruption.longitude],
      [disruption.latitude + 0.005, disruption.longitude + 0.005],
    ];

    const avgSeverity =
      hourlyData.reduce((sum, h) => sum + (h.severity || 0), 0) /
      hourlyData.length;

    const polyline = L.polyline(coordinates, {
      color: getSeverityColor(avgSeverity),
      weight: 8,
      opacity: 0.8,
      smoothFactor: 1,
    }).addTo(map);

    layersRef.current.push(polyline);
  };

  const createMarker = (disruption, color, isSelected, icon) => {
    const map = mapInstanceRef.current;

    const marker = L.marker([disruption.latitude, disruption.longitude], {
      icon: L.divIcon({
        className: "disruption-marker",
        html: `
          <div style="position: relative;">
            <div style="
              position: absolute;
              top: 50%;
              left: 50%;
              transform: translate(-50%, -50%);
              width: ${isSelected ? "70px" : "50px"};
              height: ${isSelected ? "70px" : "50px"};
              border: 3px solid ${color};
              border-radius: 50%;
              opacity: 0.3;
              animation: pulse 2s ease-out infinite;
            "></div>
            <div style="
              background: white;
              border: 3px solid ${color};
              border-radius: 50%;
              width: ${isSelected ? "48px" : "36px"};
              height: ${isSelected ? "48px" : "36px"};
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: ${isSelected ? "24px" : "18px"};
              box-shadow: 0 4px 12px rgba(0,0,0,0.2);
              cursor: pointer;
              z-index: 1000;
            ">${icon}</div>
            <style>
              @keyframes pulse {
                0% { transform: translate(-50%, -50%) scale(1); opacity: 0.3; }
                100% { transform: translate(-50%, -50%) scale(2); opacity: 0; }
              }
            </style>
          </div>
        `,
        iconSize: [isSelected ? 48 : 36, isSelected ? 48 : 36],
        iconAnchor: [isSelected ? 24 : 18, isSelected ? 24 : 18],
      }),
    }).addTo(map);

    marker.on("click", () => handleViewOnMap(disruption));
    marker.bindPopup(createActivePopup(disruption));

    return marker;
  };

  const createActivePopup = (disruption) => {
    // Get current hour in Philippines timezone (UTC+8)
    const now = new Date();
    const currentHour = (now.getUTCHours() + 8) % 24;
    
    // Check if using real-time data
    // Check if using real-time data
    const isUsingRealTime = disruption.realtime && typeof disruption.realtime.congestion_ratio === 'number';
    const currentSeverity = isUsingRealTime 
      ? disruption.realtime.congestion_ratio 
      : disruption.hourly_predictions?.find(h => h.hour === currentHour)?.severity || disruption.avg_severity;
    
    const severityLabel = currentSeverity >= 1.5 ? 'Heavy' : currentSeverity >= 1.0 ? 'Moderate' : 'Light';
    const severityColor = currentSeverity >= 1.5 ? '#dc2626' : currentSeverity >= 1.0 ? '#f59e0b' : '#22c55e';
    
    const realtimeTag = isUsingRealTime
      ? '<span style="background: linear-gradient(135deg, #ef4444, #dc2626); color: white; padding: 3px 8px; border-radius: 4px; font-size: 10px; font-weight: 700; box-shadow: 0 2px 4px rgba(239,68,68,0.3); display: inline-flex; align-items: center; gap: 4px;"><span style="font-size: 8px;">🔴</span>LIVE</span>'
      : '<span style="background: #3b82f6; color: white; padding: 3px 8px; border-radius: 4px; font-size: 10px; font-weight: 600;">PREDICTED</span>';

    return `
      <div style="font-family: -apple-system, sans-serif; padding: 10px; min-width: 220px;">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
          <h3 style="margin: 0; font-size: 15px; font-weight: 600;">
            🚧 ${disruption.title}
          </h3>
          ${realtimeTag}
        </div>
        
        <p style="margin: 4px 0; font-size: 12px; color: #6b7280;">
          📍 ${disruption.location}
        </p>
        
        <div style="background: ${severityColor}15; border-left: 3px solid ${severityColor}; padding: 8px; border-radius: 6px; margin: 8px 0;">
          <p style="margin: 0; font-weight: 600; color: ${severityColor}; font-size: 13px;">
            ${severityLabel} Congestion
          </p>
          <p style="margin: 4px 0 0 0; font-size: 11px; color: #4b5563;">
            ${isUsingRealTime ? 'Current' : `Hour ${currentHour}`} Severity: ${currentSeverity.toFixed(2)}
          </p>
        </div>
        
        <div style="background: #f9fafb; padding: 6px; border-radius: 6px; margin-top: 6px;">
          <p style="margin: 2px 0; font-size: 11px;">
            <strong>Type:</strong> ${disruption.type}
          </p>
          <p style="margin: 2px 0; font-size: 11px;">
            <strong>Est. Delay:</strong> +${isUsingRealTime 
              ? (disruption.realtime.delay_minutes || disruption.expected_delay)
              : (disruption.hourly_predictions?.find(h => h.hour === currentHour)?.delay_info?.additional_delay_min || disruption.expected_delay)
            } min
          </p>
          ${isUsingRealTime ? `
          <p style="margin: 2px 0; font-size: 11px;">
            <strong>Current Speed:</strong> ${Math.round(disruption.realtime.current_speed)} km/h
          </p>
          ` : ''}
          ${disruption.start_date ? `
          <p style="margin: 2px 0; font-size: 11px;">
            <strong>Started:</strong> ${new Date(disruption.start_date).toLocaleString("en-US", {
              month: "short", day: "numeric", hour: "2-digit", minute: "2-digit"
            })}
          </p>
          ` : ''}
        </div>
        
        ${!isUsingRealTime ? `
        <p style="margin: 6px 0 0 0; font-size: 10px; color: #6b7280; font-style: italic;">
          ℹ️ Showing predicted data for hour ${currentHour}
        </p>
        ` : ''}
        
        <!-- ✅ ADD THIS: Alternate Routes Button -->
        <button 
          onclick="window.showAlternateRoutes(${disruption.id})"
          style="
            width: 100%;
            margin-top: 10px;
            padding: 8px;
            background: linear-gradient(135deg, #3b82f6, #2563eb);
            color: white;
            border: none;
            border-radius: 6px;
            font-size: 12px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s;
          "
          onmouseover="this.style.transform='scale(1.02)'"
          onmouseout="this.style.transform='scale(1)'"
        >
          🗺️ Show Alternate Routes
        </button>
      </div>
    `;
  };

  const createUpcomingPopup = (disruption) => {
    const startDate = new Date(disruption.start_date);
    const daysUntil = Math.ceil(
      (startDate - new Date()) / (1000 * 60 * 60 * 24)
    );

    return `
        <div style="font-family: -apple-system, sans-serif; padding: 10px; min-width: 200px;">
          <h3 style="margin: 0 0 8px 0; font-size: 15px; font-weight: 600;">
            📅 ${disruption.title}
          </h3>
          <p style="margin: 4px 0; font-size: 12px; color: #6b7280;">
            📍 ${disruption.location}
          </p>
          <div style="background: #EFF6FF; padding: 6px; border-radius: 6px; margin-top: 6px;">
            <p style="margin: 2px 0; font-size: 11px;">
              <strong>Starts in:</strong> ${daysUntil} day${
      daysUntil !== 1 ? "s" : ""
    }
            </p>
            <p style="margin: 2px 0; font-size: 11px;">
              <strong>Start Date:</strong> ${startDate.toLocaleDateString()}
            </p>
            <p style="margin: 2px 0; font-size: 11px;">
              <strong>Expected Delay:</strong> +${disruption.expected_delay} min
            </p>
          </div>
        </div>
      `;
  };

  const handleViewOnMap = (disruption) => {
    if (!disruption.latitude || !disruption.longitude) return;

    setSelectedDisruption(disruption);

    const map = mapInstanceRef.current;
    if (map) {
      const currentCenter = map.getCenter();
      const currentZoom = map.getZoom();
      const disruptionLatLng = L.latLng(disruption.latitude, disruption.longitude);
      
      // ✅ Only pan if disruption is not in view OR if zoom is too far out
      const bounds = map.getBounds();
      const isInView = bounds.contains(disruptionLatLng);
      
      // If already in view and zoomed in enough, don't move
      if (isInView && currentZoom >= 14) {
        // Just update selection, don't move map
        return;
      }
      
      // Otherwise, center on disruption
      const targetZoom = currentZoom < 14 ? 15 : currentZoom;
      map.setView([disruption.latitude, disruption.longitude], targetZoom, {
        animate: true,
        duration: 0.5,
      });
    }

    setMenuOpen(false);
    setBottomSheetHeight("120px");
  };

  // ✅ ADD: Update marker appearance without full redraw
  const updateMarkerSelection = (disruption) => {
    if (!mapInstanceRef.current) return;
    
    // Just update the selected state - markers will update on next natural redraw
    setSelectedDisruption(disruption);
  };

  const getSeverityColor = (severity) => {
    if (severity < 1.0) return "#22c55e";
    if (severity < 2.0) return "#fbbf24";
    return "#ef4444";
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case "roadwork":
        return "🚧";
      case "event":
        return "🎉";
      case "accident":
        return "⚠️";
      case "weather":
        return "🌧️";
      default:
        return "📍";
    }
  };

  const drawReportMarkers = () => {
    if (!mapInstanceRef.current) return;

    // Clear existing report markers
    reportMarkersRef.current.forEach(marker => marker.remove());
    reportMarkersRef.current = [];

    // Add new report markers
    publishedReports.forEach(report => {
      // Custom icon based on severity
      const colors = {
        severe: '#dc2626',
        moderate: '#ea580c', 
        minor: '#3b82f6'
      };
      
      const emoji = 
        report.report_type === 'accident' ? '🚗' :
        report.report_type === 'flooding' ? '🌊' :
        report.report_type === 'roadwork' ? '🚧' : '⚠️';
      
      const reportIcon = L.divIcon({
        className: 'custom-report-marker',
        html: `
          <div style="
            background-color: ${colors[report.severity]};
            width: 35px;
            height: 35px;
            border-radius: 50%;
            border: 3px solid white;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 18px;
            cursor: pointer;
          ">
            ${emoji}
          </div>
        `,
        iconSize: [35, 35],
        iconAnchor: [17, 17],
      });

      const marker = L.marker([report.latitude, report.longitude], {
        icon: reportIcon
      }).addTo(mapInstanceRef.current);

      // Calculate time remaining
      const expiresAt = new Date(report.expires_at);
      const now = new Date();
      const hoursRemaining = Math.max(0, Math.round((expiresAt - now) / (1000 * 60 * 60)));
      const minutesRemaining = Math.max(0, Math.round((expiresAt - now) / (1000 * 60)) % 60);

      const popupContent = `
        <div style="min-width: 250px; max-width: 350px;">
          <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 12px;">
            <span style="font-size: 28px;">${emoji}</span>
            <div>
              <h3 style="font-weight: bold; text-transform: capitalize; margin: 0; font-size: 16px;">
                ${report.report_type}
              </h3>
              <span style="
                display: inline-block;
                padding: 2px 8px;
                border-radius: 12px;
                font-size: 11px;
                font-weight: bold;
                margin-top: 4px;
                ${report.severity === 'severe' ? 'background: #fee2e2; color: #991b1b;' :
                  report.severity === 'moderate' ? 'background: #fef3c7; color: #92400e;' :
                  'background: #dbeafe; color: #1e40af;'}
              ">
                ${report.severity.toUpperCase()}
              </span>
            </div>
          </div>
          
          <p style="font-size: 14px; margin-bottom: 12px; color: #374151; line-height: 1.5;">
            ${report.description}
          </p>
          
          ${report.image_url ? `
            <img 
              src="https://backend.urbanflowph.com${report.image_url}"
              style="width: 100%; height: 150px; object-fit: cover; border-radius: 8px; margin-bottom: 12px;"
              alt="Report evidence"
            />
          ` : ''}
          
          <div style="font-size: 12px; color: #6b7280; border-top: 1px solid #e5e7eb; padding-top: 8px;">
            <div style="margin-bottom: 4px;">
              <strong>Reported by:</strong> ${report.reporter_name || 'Anonymous'}
            </div>
            <div style="margin-bottom: 4px;">
              <strong>Reported:</strong> ${new Date(report.reported_at).toLocaleString()}
            </div>
            <div style="color: #dc2626; font-weight: bold;">
              ⏱️ Expires in: ${hoursRemaining}h ${minutesRemaining}m
            </div>
          </div>
        </div>
      `;

      marker.bindPopup(popupContent, {
        maxWidth: 350,
        className: 'custom-report-popup'
      });

      reportMarkersRef.current.push(marker);
    });
  };

  // NEW: Toggle expanded details for a disruption
  const toggleDisruptionDetails = (disruptionId, e) => {
    e.stopPropagation(); // Prevent triggering the card click
    setExpandedDisruptionId((prev) =>
      prev === disruptionId ? null : disruptionId
    );
  };

  // NEW: Format date and time nicely
  const formatDateTime = (dateString) => {
    if (!dateString) return "N/A";
    try {
      return new Date(dateString).toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch (e) {
      return "Invalid date";
    }
  };

  return (
    <div className="relative h-screen w-full bg-gray-100">
      <style>{`
        .traffic-flow-line {
          z-index: 400;
          filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));
        }
        
        .traffic-pulse-line {
          animation: traffic-pulse 2.5s ease-in-out infinite;
          z-index: 399;
        }
        
        @keyframes traffic-pulse {
          0%, 100% {
            opacity: 0.2;
            stroke-width: 10;
          }
          50% {
            opacity: 0.05;
            stroke-width: 14;
          }
        }
      `}</style>

      {/* ============ HAMBURGER MENU BUTTON ============ */}
      <button
        onClick={toggleMenu}
        className="fixed md:top-20 top-[100px] left-4 z-[1003] bg-white p-2 md:p-3 rounded-lg shadow-lg hover:bg-gray-50 transition"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-5 w-5 md:h-6 md:w-6 text-gray-700"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          {menuOpen ? (
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          ) : (
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 6h16M4 12h16M4 18h16"
            />
          )}
        </svg>
      </button>

      {/* ============ SLIDE-IN MENU ============ */}
        <div
          className={`pl-2 pr-4 py-3 fixed left-0 top-0 w-[85vw] md:w-90 max-w-md bg-white shadow-2xl z-[1003] transition-transform duration-300 overflow-y-auto ${
            menuOpen ? "translate-x-0" : "-translate-x-full"
          }`}
          style={{ top: "0px", height: "100vh" }}
        >
        <div className="p-6 space-y-4">
          <h2 className="text-2xl font-bold text-gray-800 mb-6">UrbanFlow</h2>

          {/* Toggle: Show Reports */}
          <div className="flex items-center p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition">
            <div className="w-12 flex items-center justify-center flex-shrink-0">
              <img
                src="reports_map_toggle.svg"
                alt="Reports"
                className="w-6 h-6"
              />
            </div>
            <div className="flex-1 flex flex-col leading-tight ml-3">
              <span className="font-semibold text-gray-700">Show Reports</span>
              <p className="text-xs text-gray-500">
                {showReports ? "Markers visible" : "Markers hidden"}
              </p>
            </div>
            <div className="w-11 flex items-center justify-center flex-shrink-0 ml-3">
              <button
                onClick={() => setShowReports(!showReports)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
                  showReports ? "bg-orange-500" : "bg-gray-300"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                    showReports ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Toggle: Show Congestion */}
          <div className="flex items-center p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition">
            <div className="w-12 flex items-center justify-center flex-shrink-0">
              <img
                src="traffic_icon_toggle.svg"
                alt="Congestion"
                className="w-10 h-10"
              />
            </div>
            <div className="flex-1 flex flex-col leading-tight ml-3">
              <span className="font-semibold text-gray-700">
                Show Congestion
              </span>
              <p className="text-xs text-gray-500">
                {showCongestion
                  ? "Impact zones visible"
                  : "Impact zones hidden"}
              </p>
            </div>
            <div className="w-11 flex items-center justify-center flex-shrink-0 ml-3">
              <button
                onClick={() => setShowCongestion(!showCongestion)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
                  showCongestion ? "bg-orange-500" : "bg-gray-300"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                    showCongestion ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Toggle: Live Traffic */}
          <div className="flex items-center p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition">
            <div className="w-12 flex items-center justify-center flex-shrink-0">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div className="flex-1 flex flex-col leading-tight ml-3">
              <span className="font-semibold text-gray-700">
                Live Traffic
              </span>
              <p className="text-xs text-gray-500">
                {showLiveTraffic
                  ? "Real-time flow visible"
                  : "Real-time flow hidden"}
              </p>
            </div>
            <div className="w-11 flex items-center justify-center flex-shrink-0 ml-3">
              <button
                onClick={() => setShowLiveTraffic(!showLiveTraffic)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
                  showLiveTraffic ? "bg-blue-600" : "bg-gray-300"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                    showLiveTraffic ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>
          </div>

          <hr className="my-4" />

          {/* Navigation Links */}
          <Link
            href="/about"
            className="mt-5 px-0 flex items-center p-4 pl-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition"
          >
            <div className="w-12 flex items-center justify-center flex-shrink-0">
              <img src="info_icon.svg" alt="Info" className="w-6 h-6" />
            </div>
            <span className="font-semibold text-gray-700 ml-3">About</span>
          </Link>

          <Link
            href="/contact"
            className="flex items-center p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition"
          >
            <div className="w-12 flex items-center justify-center flex-shrink-0">
              <img src="contact_icon.svg" alt="Support" className="w-6 h-6" />
            </div>
            <span className="font-semibold text-gray-700 ml-3">Support</span>
          </Link>
                      {/* DPWH Acknowledgment */}
          <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center flex-shrink-0 shadow-sm">
                <span className="text-xl">🏛️</span>
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-sm text-gray-800 mb-1">Acknowledgment</h3>
                <p className="text-xs text-gray-600 mb-2">Traffic data provided by DPWH Regional Office IV-A</p>
                <div className="flex flex-col gap-1.5">
                  <a href="https://www.dpwh.gov.ph/dpwh/" target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1">
                    <span>Visit DPWH Website</span>
                  </a>
                  <a href="https://dpwh.maps.arcgis.com/apps/webappviewer/index.html?id=e2cf12e43f1247b2a436c87033f8fbc9" target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1">
                    <span>DPWH GIS Traffic Map</span>
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

       {/* ============ SEARCH BAR WITH AUTOCOMPLETE ============ */}
        <div
          className={`absolute md:top-5 top-12 transition-all duration-300 z-[1001] ${
            menuOpen
              ? "md:left-[400px] left-4" // On mobile stay left, desktop move right when menu open
              : "left-4" // Back to left when menu is closed
          }`}
          ref={searchInputRef}
        >
        <div className="bg-white rounded-lg shadow-lg p-3 w-96">
          <div className="flex items-center gap-2">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5 text-gray-400 flex-shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              type="text"
              placeholder="Search location in Calamba..."
              value={searchQuery}
              onChange={handleSearchInputChange}
              onKeyDown={handleSearchKeyDown}
              onFocus={() => setIsSearchFocused(true)}
              onBlur={() => {
                setTimeout(() => {
                  if (document.activeElement !== searchInputRef.current) {
                    setIsSearchFocused(false);
                  }
                }, 200);
              }}
              className="flex-1 outline-none text-gray-700"
            />
            {searchLoading && (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-orange-500"></div>
            )}
          </div>

          {/* Search Error Message */}
          {searchError && !searchLoading && shouldShowDropdown && (
            <div className="mt-2 text-xs text-orange-600 bg-orange-50 p-2 rounded flex items-center gap-2">
              <span>⚠️</span>
              <span>{searchError}</span>
            </div>
          )}

          {/* Autocomplete Dropdown */}
          {shouldShowDropdown && (
            <div
              className="mt-2 bg-white border border-gray-200 rounded-lg shadow-lg max-h-96 overflow-y-auto"
              onMouseDown={(e) => e.preventDefault()}
            >
              {searchLoading ? (
                <div className="p-4 text-center text-gray-500 text-sm">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500 mx-auto mb-2"></div>
                  <p>Searching...</p>
                </div>
              ) : searchResults.length === 0 ? (
                <div className="p-4 text-center text-gray-500 text-sm">
                  <div className="text-3xl mb-2">🔍</div>
                  <p>No places found</p>
                  <p className="text-xs mt-1">Try a different search term</p>
                </div>
              ) : (
                searchResults.map((result, index) => (
                  <div
                    key={index}
                    onMouseDown={(e) => handleSuggestionClick(result, e)}
                    onMouseEnter={() => setSelectedSuggestionIndex(index)}
                    className={`p-3 cursor-pointer border-b last:border-b-0 transition-colors ${
                      selectedSuggestionIndex === index
                        ? "bg-blue-50"
                        : "hover:bg-gray-50"
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <span className="text-lg mt-0.5">📍</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-800 truncate">
                          {result.name || result.display_name.split(",")[0]}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">
                          {result.display_name}
                        </p>
                        {result.type && (
                          <span className="inline-block mt-1 text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                            {result.type}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}

              {/* Keyboard navigation hint */}
              {searchResults.length > 0 && (
                <div className="px-3 py-2 text-xs text-gray-400 border-t bg-gray-50">
                  <span className="mr-2">💡 Tip:</span>
                  Use{" "}
                  <kbd className="px-1 py-0.5 bg-white border rounded">↑</kbd>
                  <kbd className="px-1 py-0.5 bg-white border rounded ml-1">
                    ↓
                  </kbd>{" "}
                  to navigate,
                  <kbd className="px-1 py-0.5 bg-white border rounded ml-1">
                    Enter
                  </kbd>{" "}
                  to select
                </div>
              )}
            </div>
          )}
        </div>
      </div>

     {/* Logo - Top center on desktop */}
      <div className="absolute top-4 left-1/2 transform -translate-x-1/2 md:block hidden z-[1002]">
        <Link href="/" className="flex items-center space-x-1">
          <img
            src="/DupURBANFLOW.png"
            alt="UrbanFlow"
            className="h-20 w-auto sm:h-15 md:h-12 scale-90"
          />
          <span className="text-xl font-bold" style={{ color: "#757575" }}>
            UrbanFlow
          </span>
        </Link>
      </div>
      {/* Logo - Mobile only version (centered, above search bar) */}
      <div className="absolute top-1 left-1/2 transform -translate-x-1/2 md:hidden z-[1002]">
        <Link href="/" className="flex items-center space-x-1">
          <img
            src="/DupURBANFLOW.png"
            alt="UrbanFlow"
            className="h-8 w-auto"
          />
          <span className="text-xs font-bold whitespace-nowrap" style={{ color: "#757575" }}>
            UrbanFlow
          </span>
        </Link>
      </div>
      
     {/* Login Button - Desktop: Top Right, Mobile: Aligned with hamburger button on the right */}
      <Link
        href="/login"
        className="absolute md:top-5 md:right-4 top-[100px] right-4 z-[1002] bg-white w-10 h-10 md:w-12 md:h-12 rounded-full shadow-lg hover:bg-blue-50 transition flex items-center justify-center overflow-hidden"
        title="Urban Planner Login"
      >
        <img
          src="/urban_planner_icon.png"
          alt="Login"
          className="w-full h-full object-cover"
        />
      </Link>

      {/* Real-Time Data Indicator */}
      {disruptions.some(d => d.status === 'active' && d.realtime?.congestion_ratio) && (
        <div className="absolute bottom-24 right-4 bg-white rounded-lg shadow-lg px-4 py-3 z-[1001] border-2 border-red-400">
          <div className="flex items-center gap-2">
            <div className="relative">
              <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
              <div className="absolute inset-0 w-3 h-3 bg-red-500 rounded-full animate-ping"></div>
            </div>
            <div>
              <p className="text-xs font-bold text-gray-800">Live Traffic Data</p>
              <p className="text-[10px] text-gray-600">
                {disruptions.filter(d => d.realtime?.congestion_ratio).length} location(s) updating
              </p>
            </div>
          </div>
        </div>
      )}

      {/*----backdrop menu-----*/}
      {menuOpen && (
        <div
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[1002] transition-opacity duration-300"
          onClick={toggleMenu}
        />
      )}

      {/* ============ MAP CONTAINER ============ */}
      <div ref={mapRef} className="h-full w-full" style={{ zIndex: 1 }}>
        <div className="flex items-center justify-center h-full text-gray-400"></div>
      </div>

      {/* Backdrop bottom sheet - only visible when bottom sheet is expanded */}
      {bottomSheetHeight !== "80px" &&
        bottomSheetHeight !== "120px" &&
        !menuOpen && (
          <div
            className="fixed inset-0 bg-white/10 backdrop-blur-sm z-[998] transition-opacity duration-300"
            onClick={closeBottomSheet}
          />
        )}

       {/* Report Issue Toggle Button */}
        <button
          onClick={() => {
            const newMode = !reportMode;
            setReportMode(newMode);
            reportModeRef.current = newMode;
            
            if (!newMode) {
              // Exiting report mode - clean up
              if (pendingReportMarkerRef.current) {
                pendingReportMarkerRef.current.remove();
                pendingReportMarkerRef.current = null;
              }
              setShowReportForm(false);
            }
          }}
          className={`fixed left-4 rounded-full shadow-lg transition-all z-[1002] ${
            reportMode ? 'bg-red-400 hover:bg-red-500' : 'bg-orange-400 hover:bg-orange-500'
          } flex items-center justify-center`}
          style={{
            width: '48px',
            height: '48px',
            top: '140px' 
            
          }}
          title={reportMode ? "Cancel reporting" : "Report an issue"}
        >
          <span className="text-2xl">{reportMode ? '✕' : (<img src='comment-icon.svg' alt="note icon" className="w-10 h-8" />)}</span>
        </button>

       {/* Report Mode Instruction Tooltip */}
        {reportMode && !showReportForm && (
          <div
            className="fixed left-20 bg-orange-400 text-white px-4 py-2 rounded-lg shadow-lg z-[1002] text-sm font-medium whitespace-nowrap"
            style={{
              top: '146px'
            }}
          >
            📍 Double-tap/click on map to report
          </div>
        )}
      {/* ============ BOTTOM SHEET WITH IMPROVED DESIGN ============ */}
     <div
        className="fixed bottom-0 left-0 right-0 bg-white rounded-t-3xl shadow-2xl z-[999] transition-all duration-300"
        style={{
          height: menuOpen ? "120px" : bottomSheetHeight,
          maxHeight: "100vh",
          transform: menuOpen ? "translateY(100%)" : "translateY(0)",
          opacity: menuOpen ? 0 : 1,
          overscrollBehavior: 'contain', // Prevent pull-to-refresh
          touchAction: 'pan-y', // Allow vertical scrolling only
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
      {/* Drag Handle - Bigger touch area */}
      <div
        onClick={toggleBottomSheet}
        className="w-full py-6 cursor-grab active:cursor-grabbing flex justify-center select-none"
        style={{ touchAction: 'none' }}
      >
        <div className="w-16 h-2 bg-gray-400 rounded-full hover:bg-gray-500 transition-all" />
      </div>

        {/* Content */}
        <div className="px-6 pb-6 h-full overflow-y-auto">
          {/* Header */}
          <div className="flex justify-between items-center py-4 mb-4">
            <div>
              <h2 className="text-xl font-bold text-gray-800">
                Active Road Disruptions
              </h2>
              {!loading && (
                <p className="text-sm text-gray-600 mt-1">
                  {
                    disruptions.filter(
                      (d) => d.status === "active" || d.status === "upcoming"
                    ).length
                  }{" "}
                  found
                </p>
              )}
            </div>
            <button
              onClick={closeBottomSheet}
              className="text-gray-500 hover:text-gray-700"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </button>
          </div>

          {/* Loading/Error States */}
          {loading && (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading disruptions...</p>
            </div>
          )}

          {error && (
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-4">
              <p className="text-orange-800">{error}</p>
              <button
                onClick={fetchDisruptions}
                className="mt-2 bg-orange-600 text-white px-4 py-2 rounded-lg text-sm"
              >
                Try again
              </button>
            </div>
          )}

          {/* Disruption List - NEW LAYOUT */}
          {!loading && !error && disruptions.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              <div className="text-6xl mb-4">✅</div>
              <p className="text-lg font-semibold">No active disruptions</p>
            </div>
          )}

          {!loading && !error && disruptions.length > 0 && (
            <div className="space-y-3">
              {disruptions
                .filter((d) => {
                  if (!showReports) return false;
                  return d.status === "active" || d.status === "upcoming";
                })
                .map((disruption) => {
                  const isExpanded = expandedDisruptionId === disruption.id;

                  return (
                    <div
                      key={disruption.id}
                      className={`bg-gray-50 border-2 rounded-xl overflow-hidden transition-all ${
                        selectedDisruption?.id === disruption.id
                          ? "border-orange-500 shadow-lg"
                          : "border-gray-200"
                      }`}
                    >
                      {/* Main Card - Always Visible */}
                      <div
                        className="p-4 cursor-pointer hover:bg-gray-100 transition text-left"
                        onClick={() => handleViewOnMap(disruption)}
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xl">
                                {getTypeIcon(disruption.type)}
                              </span>
                              <h3 className="font-bold text-sm text-gray-800">
                                {disruption.title}
                              </h3>
                            </div>
                            <p className="text-xs text-gray-600 ml-7">
                              {disruption.location}
                            </p>
                          </div>
                          <button
                            onClick={(e) =>
                              toggleDisruptionDetails(disruption.id, e)
                            }
                            className="ml-2 px-3 py-1.5 bg-orange-500 text-white text-xs font-semibold rounded-lg hover:bg-orange-600 transition whitespace-nowrap"
                          >
                            {isExpanded ? "Hide Details" : "Full Details"}
                          </button>
                        </div>

                        {/* Quick Info - Always Visible */}
                        <div className="space-y-1.5 text-xs text-left">
                          <div className="flex items-center gap-2">
                            <span className="text-gray-600">Period:</span>
                            <span className="font-semibold text-gray-800">
                              {disruption.start_date
                                ? new Date(
                                    disruption.start_date
                                  ).toLocaleDateString("en-US", {
                                    month: "short",
                                    day: "numeric",
                                  })
                                : "N/A"}{" "}
                              -{" "}
                              {disruption.end_date
                                ? new Date(
                                    disruption.end_date
                                  ).toLocaleDateString("en-US", {
                                    month: "short",
                                    day: "numeric",
                                    year: "numeric",
                                  })
                                : "N/A"}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-gray-600">Type:</span>
                            <span className="font-semibold text-gray-800 capitalize">
                              {disruption.type === "roadwork"
                                ? "Road Repair"
                                : disruption.type}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-gray-600">
                              Expected Delay:
                            </span>
                            <span className="font-semibold text-orange-600">
                              {disruption.expected_delay} mins
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Expanded Details - Blue Panel */}
                      {isExpanded && (
                        <div className="bg-blue-50 border-t-2 border-gray-200 p-4">
                          <h4 className="font-bold text-sm text-gray-800 mb-3 flex items-center gap-2">
                            Full Details
                          </h4>

                          <div className="space-y-2 text-xs">
                            <div className="flex gap-x-2">
                              <span className="text-gray-600">Period:</span>
                              <span className="font-semibold text-gray-800">
                                {disruption.start_date && disruption.end_date
                                  ? `${new Date(
                                      disruption.start_date
                                    ).toLocaleDateString("en-US", {
                                      month: "short",
                                      day: "numeric",
                                    })} - ${new Date(
                                      disruption.end_date
                                    ).toLocaleDateString("en-US", {
                                      month: "short",
                                      day: "numeric",
                                      year: "numeric",
                                    })}`
                                  : "N/A"}
                              </span>
                            </div>

                            <div className="flex gap-x-2">
                              <span className="text-gray-600">Type:</span>
                              <span className="font-semibold text-gray-800 capitalize">
                                {disruption.type === "roadwork"
                                  ? "Road Repair"
                                  : disruption.type}
                              </span>
                            </div>

                            <div className="flex gap-x-2">
                              <span className="text-gray-600">
                                Additional Delay:
                              </span>
                              <span className="font-semibold text-orange-600">
                                {disruption.expected_delay || 0} mins
                              </span>
                            </div>

                            <div className="flex gap-x-2">
                              <span className="text-gray-600">
                                Peak Hours Delay:
                              </span>
                              <span className="font-semibold text-gray-800">
                                {disruption.expected_delay
                                  ? `${Math.round(
                                      disruption.expected_delay * 1.5
                                    )}-${disruption.expected_delay * 2} mins`
                                  : "N/A"}
                              </span>
                            </div>

                            {disruption.status === "active" &&
                              disruption.realtime && (
                                <>
                                  <div className="my-2 border-t border-gray-300"></div>
                                  <h5 className="font-bold text-xs text-blue-700 mb-1.5">
                                    🔴 Real-Time Info
                                  </h5>
                                  <div className="flex gap-x-2">
                                    <span className="text-gray-600">
                                      Current Speed:
                                    </span>
                                    <span className="font-semibold text-gray-800">
                                      {Math.round(
                                        disruption.realtime.current_speed
                                      )}{" "}
                                      km/h
                                    </span>
                                  </div>
                                  <div className="flex gap-x-2">
                                    <span className="text-gray-600">
                                      Congestion Ratio:
                                    </span>
                                    <span className="font-semibold text-gray-800">
                                      {disruption.realtime.congestion_ratio?.toFixed(
                                        2
                                      ) || "N/A"}
                                    </span>
                                  </div>
                                </>
                              )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          )}

          {!loading && (
            <button
              onClick={fetchDisruptions}
              className="w-full mt-6 bg-gray-100 text-gray-700 py-2 rounded-lg hover:bg-gray-200 transition text-sm font-semibold"
            >
              ↻
            </button>
          )}
        </div>
      </div>
    {showReportForm && reportPosition && (
      <ReportIssueForm
        position={reportPosition}
        marker={pendingReportMarkerRef.current}
        onClose={() => {
          setShowReportForm(false);
          setReportMode(false);
          if (pendingReportMarkerRef.current) {
            pendingReportMarkerRef.current.remove();
            pendingReportMarkerRef.current = null;
          }
        }}
        onSubmit={() => {
          setShowReportForm(false);
          setReportMode(false);
          if (pendingReportMarkerRef.current) {
            pendingReportMarkerRef.current.remove();
            pendingReportMarkerRef.current = null;
          }
          alert('✅ Thank you! Your report has been submitted to city planners.');
        }}
      />
    )}

    {/* ✅ NEW: Alternate Routes Modal */}
    {selectedDisruption && showRoutesModal && (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold mb-1">Alternate Routes</h2>
                <p className="text-blue-100 text-sm">
                  {selectedDisruption.title}
                </p>
              </div>
              <button
                onClick={() => setShowRoutesModal(false)}
                className="text-white hover:bg-white hover:bg-opacity-20 p-2 rounded-lg transition"
              >
                <FaTimes size={24} />
              </button>
            </div>
          </div>
          
          {/* Content */}
          <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
            {loadingRoutes ? (
              <div className="text-center py-12">
                <FaSpinner className="animate-spin text-4xl text-blue-600 mx-auto mb-4" />
                <p className="text-gray-600">Calculating best routes...</p>
              </div>
            ) : alternateRoutes.length > 0 ? (
              <>
                <p className="text-gray-600 mb-6">
                  📍 Routes calculated to avoid the disruption zone. Choose the route that best fits your needs.
                </p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {alternateRoutes.map((route) => (
                    <RouteCard
                      key={route.unique_id}
                      route={route}
                      onSelect={() => viewRouteDirections(route)}
                      isSelected={selectedRoute?.unique_id === route.unique_id}
                    />
                  ))}
                </div>
                
                {/* Share/Export Options */}
                {selectedRoute && (
                  <div className="mt-6 border-t pt-6">
                    <h3 className="font-semibold text-gray-900 mb-3">Share this route:</h3>
                    <div className="flex flex-wrap gap-3">
                      <button
                        onClick={() => shareRoute('sms')}
                        className="btn btn-secondary flex items-center space-x-2"
                      >
                        <FaMobileAlt />
                        <span>Text Message</span>
                      </button>
                      
                      <button
                        onClick={() => shareRoute('email')}
                        className="btn btn-secondary flex items-center space-x-2"
                      >
                        <FaEnvelope />
                        <span>Email</span>
                      </button>
                      
                      <button
                        onClick={() => copyRouteLink()}
                        className="btn btn-secondary flex items-center space-x-2"
                      >
                        <FaLink />
                        <span>Copy Link</span>
                      </button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-12">
                <FaRoute className="text-5xl text-gray-300 mx-auto mb-4" />
                <p className="text-gray-600">No alternate routes available</p>
              </div>
            )}
          </div>
        </div>
      </div>
    )}
    </div>
  );
}
