"use client";

import L from "leaflet";
import { useCallback, useEffect, useRef, useState } from "react";

// Fix Leaflet icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png",
});

export default function RawMap() {
  // ============ SEARCH STATE (copied from HomeMapWithSidebar) ============
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState(null);
  const [searchMarker, setSearchMarker] = useState(null);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1);
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const searchInputRef = useRef(null);
  const debounceTimerRef = useRef(null);
  const searchCacheRef = useRef(new Map());

  // ============ MAP INITIALIZATION (copied from HomeMapWithSidebar) ============
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const map = L.map(mapRef.current, {
      center: [14.2096, 121.164], // Calamba, Laguna
      zoom: 13,
      zoomControl: false, // Disable default zoom control
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap",
      maxZoom: 19,
    }).addTo(map);

    // Add zoom control at bottom-left (same as HomeMapWithSidebar)
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

  // ============ CLICK OUTSIDE HANDLER (copied from HomeMapWithSidebar) ============
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

  // ============ AUTOCOMPLETE SEARCH LOGIC (copied from HomeMapWithSidebar) ============

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
   * Handle suggestion click without losing input focus
   */
  const handleSuggestionClick = (result, e) => {
    e.preventDefault();
    e.stopPropagation();
    selectSearchResult(result);
  };

  /**
   * Select a search result and center map with marker
   */
  const selectSearchResult = (result) => {
    if (!mapInstanceRef.current) return;

    const map = mapInstanceRef.current;
    const lat = parseFloat(result.lat);
    const lon = parseFloat(result.lon);

    // Remove previous search marker if exists
    if (searchMarker) {
      map.removeLayer(searchMarker);
    }

    // Create custom search marker icon (same as HomeMapWithSidebar)
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

    // Center and zoom map to the selected location
    map.setView([lat, lon], 16, {
      animate: true,
      duration: 1,
    });

    setSearchQuery(result.display_name);
    setIsSearchFocused(false);
    setSelectedSuggestionIndex(-1);
    searchInputRef.current?.blur();
  };

  // ============ DERIVED STATE FOR DROPDOWN VISIBILITY ============
  const shouldShowDropdown =
    isSearchFocused &&
    (searchResults.length > 0 ||
      searchLoading ||
      (searchError && searchQuery.trim().length >= 2));

  // ============ RENDER ============
  return (
    <div className="relative h-full w-full">
      {/* ============ SEARCH BAR (copied from HomeMapWithSidebar) ============ */}
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

          {/* Autocomplete Suggestions Dropdown */}
          {shouldShowDropdown && (
            <div
              className="mt-2 bg-white border border-gray-200 rounded-lg shadow-lg max-h-96 overflow-y-auto"
              onMouseDown={(e) => {
                // Prevent dropdown from stealing focus
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

      {/* ============ MAP CONTAINER ============ */}
      {/* Zoom controls are automatically added to bottom-left via Leaflet */}
      <div ref={mapRef} style={{ height: "100%", width: "100%" }} />
    </div>
  );
}
