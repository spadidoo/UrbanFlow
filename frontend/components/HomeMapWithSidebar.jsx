"use client";

import L from "leaflet";
import { useCallback, useEffect, useRef, useState } from "react";
import api from "../services/api";

// Fix Leaflet icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png",
});

export default function HomeMapWithSidebar() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [disruptions, setDisruptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedDisruption, setSelectedDisruption] = useState(null);
  const [loadingRoads, setLoadingRoads] = useState(false);

  // ============ SEARCH STATE ============
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState(null);
  const [searchMarker, setSearchMarker] = useState(null);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1);
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const layersRef = useRef([]);
  const searchInputRef = useRef(null);
  const debounceTimerRef = useRef(null);
  const searchCacheRef = useRef(new Map());

  // Fetch disruptions on component mount
  useEffect(() => {
    fetchDisruptions();
  }, []);

  // Initialize map
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const map = L.map(mapRef.current, {
      center: [14.2096, 121.164],
      zoom: 13,
      zoomControl: false, // ← Disable default zoom control
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap",
      maxZoom: 19,
    }).addTo(map);

    // ✅ Add zoom control at bottom-left
    L.control
      .zoom({
        position: "bottomleft",
      })
      .addTo(map);

    mapInstanceRef.current = map;

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Draw disruptions on map
  useEffect(() => {
    if (!mapInstanceRef.current || disruptions.length === 0) return;

    drawDisruptionsOnMap();
  }, [disruptions, selectedDisruption]);

  // Handle clicking outside search to close dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        searchInputRef.current &&
        !searchInputRef.current.contains(event.target)
      ) {
        setIsSearchFocused(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const fetchDisruptions = async () => {
    try {
      setLoading(true);
      setError(null);

      console.log("🔄 Fetching disruptions from backend...");
      const response = await api.getPublishedDisruptions();

      console.log("📊 Response received:", response);

      // 🔴 NETWORK ERROR - Server is offline
      if (response.isNetworkError) {
        console.warn("⚠️ Network error - cannot reach server");
        setError(
          "Unable to connect to server. Please check if the backend is running."
        );
        setDisruptions([]);
      }
      // ⚠️ SERVER ERROR - Server responded with error
      else if (response.success === false && !response.isNetworkError) {
        console.warn("⚠️ Server error:", response.error);
        setError(response.error || "Server error occurred");
        setDisruptions([]);
      }
      // ✅ SUCCESS - Server responded successfully
      else if (response.success === true) {
        const disruptionData = response.disruptions || [];
        console.log(`✅ Loaded ${disruptionData.length} disruptions`);
        setDisruptions(disruptionData);
        setError(null); // Clear any previous errors
      }
      // 🤷 UNEXPECTED - Fallback for unexpected response format
      else {
        console.warn("⚠️ Unexpected response format:", response);
        setError("Unexpected server response");
        setDisruptions([]);
      }
    } catch (err) {
      console.error("❌ Exception in fetchDisruptions:", err);
      setError("Failed to load disruptions. Please check your connection.");
      setDisruptions([]);
    } finally {
      setLoading(false);
    }
  };

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

  const getRoadInfoFromOSM = async (lat, lng) => {
    try {
      const query = `
        [out:json][timeout:20];
        way(around:100,${lat},${lng})["highway"];
        out body;
        >;
        out skel qt;
      `;

      const response = await fetch("https://overpass-api.de/api/interpreter", {
        method: "POST",
        body: query,
      });

      if (!response.ok) {
        return { success: false };
      }

      const data = await response.json();

      if (data.elements && data.elements.length > 0) {
        const nodes = data.elements.filter((el) => el.type === "node");
        const way = data.elements.find((el) => el.type === "way");

        if (way) {
          const coords = way.nodes
            .map((nodeId) => nodes.find((n) => n.id === nodeId))
            .filter((n) => n)
            .map((n) => ({ lat: n.lat, lng: n.lon }));

          return {
            success: true,
            road_name: way.tags?.name || "Unnamed Road",
            coordinates: coords,
          };
        }
      }

      return { success: false };
    } catch (error) {
      console.error("Error fetching road info:", error);
      return { success: false };
    }
  };

  const drawDisruptionsOnMap = async () => {
    if (!mapInstanceRef.current) return;

    const map = mapInstanceRef.current;

    layersRef.current.forEach((layer) => map.removeLayer(layer));
    layersRef.current = [];

    for (const disruption of disruptions) {
      await drawDisruption(disruption);
    }

    if (disruptions.length > 0 && !searchMarker) {
      const bounds = disruptions
        .filter((d) => d.latitude && d.longitude)
        .map((d) => [d.latitude, d.longitude]);

      if (bounds.length > 0) {
        map.fitBounds(bounds, { padding: [50, 50] });
      }
    }
  };

  const drawDisruption = async (disruption) => {
    if (!disruption.latitude || !disruption.longitude) return;

    const map = mapInstanceRef.current;
    const lat = disruption.latitude;
    const lng = disruption.longitude;
    const isSelected = selectedDisruption?.id === disruption.id;

    const severityColor = getSeverityColor(disruption.avg_severity || 1.0);

    if (isSelected && !disruption._roadsDrawn) {
      setLoadingRoads(true);

      try {
        const roadInfo = await getRoadInfoFromOSM(lat, lng);

        if (roadInfo.success && roadInfo.coordinates?.length > 1) {
          const roadCoords = roadInfo.coordinates.map((c) => [c.lat, c.lng]);

          const shadow = L.polyline(roadCoords, {
            color: "#000000",
            weight: 14,
            opacity: 0.2,
            lineCap: "round",
          }).addTo(map);
          layersRef.current.push(shadow);

          const base = L.polyline(roadCoords, {
            color: "#9ca3af",
            weight: 10,
            opacity: 0.5,
            lineCap: "round",
          }).addTo(map);
          layersRef.current.push(base);

          const mainRoad = L.polyline(roadCoords, {
            color: severityColor,
            weight: 8,
            opacity: 1,
            lineCap: "round",
            lineJoin: "round",
          }).addTo(map);

          mainRoad.bindPopup(`
            <div style="font-family: -apple-system, sans-serif; padding: 10px; min-width: 200px;">
              <h3 style="margin: 0 0 8px 0; font-size: 14px; font-weight: 600;">
                ${disruption.title}
              </h3>
              <p style="margin: 4px 0; font-size: 12px; color: #6b7280;">
                📍 ${disruption.location}
              </p>
              <p style="margin: 4px 0; font-size: 12px; color: #6b7280;">
                🛣️ ${roadInfo.road_name}
              </p>
              <div style="background: ${severityColor}20; padding: 6px; border-radius: 6px; margin-top: 8px;">
                <p style="margin: 0; font-size: 12px; font-weight: 600; color: ${severityColor};">
                  ${disruption.congestion_level} Congestion
                </p>
                <p style="margin: 4px 0 0 0; font-size: 11px; color: #4b5563;">
                  +${disruption.expected_delay} min delay
                </p>
              </div>
            </div>
          `);

          layersRef.current.push(mainRoad);

          await drawNearbyRoads(
            lat,
            lng,
            severityColor,
            disruption.avg_severity || 1.0
          );

          disruption._roadsDrawn = true;
        }
      } catch (error) {
        console.error("Error drawing roads:", error);
      } finally {
        setLoadingRoads(false);
      }
    }

    const marker = L.marker([lat, lng], {
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
              border: 3px solid ${severityColor};
              border-radius: 50%;
              opacity: 0.3;
              animation: pulse 2s ease-out infinite;
            "></div>
            <div style="
              background: white;
              border: 3px solid ${severityColor};
              border-radius: 50%;
              width: ${isSelected ? "48px" : "36px"};
              height: ${isSelected ? "48px" : "36px"};
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: ${isSelected ? "24px" : "18px"};
              box-shadow: 0 4px 12px rgba(0,0,0,0.2);
              cursor: pointer;
            ">${getTypeIcon(disruption.type)}</div>
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

    marker.on("click", () => {
      handleViewOnMap(disruption);
    });

    marker.bindPopup(`
      <div style="font-family: -apple-system, sans-serif; padding: 10px;">
        <h3 style="margin: 0 0 8px 0; font-size: 15px; font-weight: 600;">
          ${getTypeIcon(disruption.type)} ${disruption.title}
        </h3>
        <p style="margin: 4px 0; font-size: 12px; color: #6b7280;">
          📍 ${disruption.location}
        </p>
        <div style="background: #f9fafb; padding: 6px; border-radius: 6px; margin-top: 6px;">
          <p style="margin: 2px 0; font-size: 11px;">
            <strong>Type:</strong> ${disruption.type}
          </p>
          <p style="margin: 2px 0; font-size: 11px;">
            <strong>Delay:</strong> +${disruption.expected_delay} min
          </p>
          <p style="margin: 2px 0; font-size: 11px;">
            <strong>Level:</strong> ${disruption.congestion_level}
          </p>
        </div>
      </div>
    `);

    layersRef.current.push(marker);

    const circle = L.circle([lat, lng], {
      radius: 500,
      color: severityColor,
      fillColor: severityColor,
      fillOpacity: isSelected ? 0.2 : 0.15,
      weight: isSelected ? 3 : 2,
    }).addTo(map);

    layersRef.current.push(circle);
  };

  const drawNearbyRoads = async (
    centerLat,
    centerLng,
    mainColor,
    avgSeverity
  ) => {
    try {
      const searchRadius = 500;
      const query = `
        [out:json][timeout:20];
        (
          way["highway"~"^(primary|secondary|tertiary|residential)$"](around:${searchRadius},${centerLat},${centerLng});
        );
        out body;
        >;
        out skel qt;
      `;

      const response = await fetch("https://overpass-api.de/api/interpreter", {
        method: "POST",
        body: query,
      });

      if (!response.ok) {
        console.warn("OSM API unavailable for nearby roads");
        return;
      }

      const data = await response.json();

      if (data.elements) {
        const nodes = data.elements.filter((el) => el.type === "node");
        const ways = data.elements
          .filter((el) => el.type === "way" && el.tags?.highway)
          .slice(0, 15);

        const map = mapInstanceRef.current;

        ways.forEach((way) => {
          const coords = way.nodes
            .map((nodeId) => nodes.find((n) => n.id === nodeId))
            .filter((n) => n)
            .map((n) => [n.lat, n.lon]);

          if (coords.length < 2) return;

          const distances = coords.map((coord) =>
            getDistance(centerLat, centerLng, coord[0], coord[1])
          );
          const minDist = Math.min(...distances);

          let impactColor, weight, opacity;
          if (minDist < 150) {
            impactColor = mainColor;
            weight = 6;
            opacity = 0.8;
          } else if (minDist < 300) {
            impactColor = getSeverityColor(avgSeverity * 0.6);
            weight = 5;
            opacity = 0.7;
          } else {
            impactColor = getSeverityColor(avgSeverity * 0.3);
            weight = 4;
            opacity = 0.6;
          }

          const road = L.polyline(coords, {
            color: impactColor,
            weight: weight,
            opacity: opacity,
            lineCap: "round",
          }).addTo(map);

          const roadName = way.tags.name || "Unnamed road";
          road.bindPopup(`
            <div style="padding: 8px;">
              <p style="margin: 0; font-weight: 600; font-size: 12px;">${roadName}</p>
              <p style="margin: 4px 0 0 0; font-size: 11px; color: #6b7280;">
                ${Math.round(minDist)}m from disruption
              </p>
            </div>
          `);

          layersRef.current.push(road);
        });
      }
    } catch (error) {
      console.error("Error fetching nearby roads:", error);
    }
  };

  const handleViewOnMap = (disruption) => {
    if (!disruption.latitude || !disruption.longitude) return;

    setSelectedDisruption(disruption);

    const map = mapInstanceRef.current;
    if (map) {
      map.setView([disruption.latitude, disruption.longitude], 15, {
        animate: true,
        duration: 1,
      });
    }

    drawDisruptionsOnMap();
    setSidebarOpen(false);
  };

  const getCongestionColor = (level) => {
    switch (level) {
      case "Heavy":
        return "#ef4444";
      case "Moderate":
        return "#fbbf24";
      case "Light":
        return "#22c55e";
      default:
        return "#9ca3af";
    }
  };

  const getSeverityColor = (severity) => {
    if (severity < 0.5) return "#22c55e";
    if (severity < 1.5) return "#fbbf24";
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

  return (
    <div className="relative h-full w-full">
      {/* ============ SEARCH BAR WITH TRULY SMOOTH AUTOCOMPLETE ============ */}
      <div className="absolute top-20 left-4 z-[1002]" ref={searchInputRef}>
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
                // Delay blur to allow click events on dropdown to fire
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

          {/* CRITICAL FIX: Autocomplete Dropdown with proper mouse event handling */}
          {shouldShowDropdown && (
            <div
              className="mt-2 bg-white border border-gray-200 rounded-lg shadow-lg max-h-96 overflow-y-auto"
              onMouseDown={(e) => {
                // CRITICAL: Prevent dropdown from stealing focus
                e.preventDefault();
              }}
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

      {/* Sidebar Toggle Button */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className={`fixed top-20 z-[1002] bg-white p-3 rounded-lg shadow-lg hover:bg-gray-50 transition-all duration-300 ${
          sidebarOpen ? "right-[25rem]" : "right-4"
        }`}
        title="Toggle disruptions list"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-6 w-6 text-gray-700"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 6h16M4 12h16M4 18h16"
          />
        </svg>
      </button>

      {/* Loading Roads Indicator */}
      {loadingRoads && (
        <div className="absolute top-32 left-1/2 transform -translate-x-1/2 z-[1002] bg-white rounded-lg shadow-lg px-4 py-2">
          <div className="flex items-center gap-2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-orange-500"></div>
            <span className="text-sm text-gray-700">
              Loading road details...
            </span>
          </div>
        </div>
      )}

      {/* Sidebar */}
      <div
        className={`fixed right-0 h-full w-96 shadow-2xl z-[999] transition-transform duration-300 overflow-y-auto ${
          sidebarOpen ? "translate-x-0" : "translate-x-full"
        }`}
        style={{
          top: "64px",
          height: "calc(100vh - 64px)",
          backgroundColor: "rgba(255, 255, 255, 0.95)",
          backdropFilter: "blur(10px)",
        }}
      >
        <div className="p-6">
          {/* Sidebar Header */}
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-800">
                Active Disruptions
              </h2>
              {!loading && (
                <p className="text-sm text-gray-600 mt-1">
                  {disruptions.length} active{" "}
                  {disruptions.length === 1 ? "disruption" : "disruptions"}
                </p>
              )}
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
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
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {/* Loading State */}
          {loading && (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading disruptions...</p>
            </div>
          )}

          {/* Error State - Only show if there's actually an error */}
          {error && (
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-4">
              <div className="flex items-start gap-3">
                <span className="text-2xl">⚠️</span>
                <div className="flex-1">
                  <p className="text-orange-800 font-semibold mb-1">
                    {error.includes("Unable to connect")
                      ? "Server Offline"
                      : "Error"}
                  </p>
                  <p className="text-red-700 text-sm">{error}</p>
                  <button
                    onClick={fetchDisruptions}
                    className="mt-2 bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-orange-700 transition"
                  >
                    Try again
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Empty State - Only show if no disruptions AND no error */}
          {!loading && !error && disruptions.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              <div className="text-6xl mb-4">✅</div>
              <p className="text-lg font-semibold">No active disruptions</p>
              <p className="text-sm mt-2">Traffic is flowing normally!</p>
            </div>
          )}

          {/* Empty State */}
          {!loading && !error && disruptions.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              <div className="text-6xl mb-4">✅</div>
              <p className="text-lg font-semibold">No active disruptions</p>
              <p className="text-sm mt-2">Traffic is flowing normally!</p>
            </div>
          )}

          {/* Disruptions List */}
          {!loading && !error && disruptions.length > 0 && (
            <div className="space-y-4">
              {disruptions.map((disruption) => (
                <div
                  key={disruption.id}
                  className={`bg-white border rounded-lg p-4 hover:shadow-md transition cursor-pointer ${
                    selectedDisruption?.id === disruption.id
                      ? "ring-2 ring-blue-500"
                      : ""
                  }`}
                  onClick={() => handleViewOnMap(disruption)}
                >
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-bold text-lg text-gray-800 flex items-center gap-2">
                      <span>{getTypeIcon(disruption.type)}</span>
                      {disruption.title}
                    </h3>
                  </div>

                  <p className="text-sm text-gray-600 mb-2">
                    📍 {disruption.location}
                  </p>

                  <div className="flex gap-2 mb-3">
                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded capitalize">
                      {disruption.type}
                    </span>
                    <span
                      className={`text-xs px-2 py-1 rounded font-semibold ${
                        disruption.congestion_level === "Heavy"
                          ? "bg-red-100 text-red-700"
                          : disruption.congestion_level === "Moderate"
                          ? "bg-yellow-100 text-yellow-700"
                          : "bg-green-100 text-green-700"
                      }`}
                    >
                      {disruption.congestion_level}
                    </span>
                  </div>

                  <div className="bg-gray-50 rounded-lg p-3 mb-3">
                    <p className="text-sm text-gray-700 flex items-center gap-2">
                      <span className="text-lg">⏱️</span>
                      <span>
                        <strong>Expected Delay:</strong> +
                        {disruption.expected_delay} minutes
                      </span>
                    </p>
                  </div>

                  {disruption.description && (
                    <p className="text-sm text-gray-600 mb-3 italic">
                      "{disruption.description}"
                    </p>
                  )}

                  <p className="text-xs text-gray-500 mb-3">
                    📅 {new Date(disruption.start_date).toLocaleDateString()} -{" "}
                    {new Date(disruption.end_date).toLocaleDateString()}
                  </p>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleViewOnMap(disruption);
                    }}
                    className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition font-semibold text-sm"
                  >
                    View on Map
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Refresh Button */}
          {!loading && (
            <button
              onClick={fetchDisruptions}
              className="w-full mt-6 bg-gray-100 text-gray-700 py-2 rounded-lg hover:bg-gray-200 transition text-sm font-semibold"
            >
              🔄 Refresh
            </button>
          )}
        </div>
      </div>

      {/* Map */}
      <div ref={mapRef} style={{ height: "100%", width: "100%" }} />
    </div>
  );
}

// Helper function to calculate distance between two coordinates
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

  return R * c;
}
