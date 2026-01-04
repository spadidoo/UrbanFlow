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

export default function RawMap({
  // Public data props
  publicDisruptions,
  setPublicDisruptions,
  publishedReports,
  setPublishedReports,
  showPublicDisruptions,
  setShowPublicDisruptions,
  showPublicReports,
  setShowPublicReports,
  
  // Search props
  searchQuery,
  setSearchQuery,
  searchResults,
  setSearchResults,
  searchLoading,
  setSearchLoading,
  searchError,
  setSearchError,
  searchMarker,
  setSearchMarker,
  selectedSuggestionIndex,
  setSelectedSuggestionIndex,
  isSearchFocused,
  setIsSearchFocused,
  
  // Refs
  searchInputRef,
  debounceTimerRef,
  searchCacheRef,
  reportMarkersRef
}) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const disruptionLayersRef = useRef([]);

  // ============ MAP INITIALIZATION ============
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const map = L.map(mapRef.current, {
      center: [14.2096, 121.164], // Calamba, Laguna
      zoom: 13,
      zoomControl: false,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap",
      maxZoom: 19,
    }).addTo(map);

    L.control.zoom({ position: "bottomleft" }).addTo(map);

    mapInstanceRef.current = map;

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // ============ FETCH PUBLIC DISRUPTIONS ============
  useEffect(() => {
    const fetchPublicDisruptions = async () => {
      try {
        const response = await fetch('https://backend.urbanflowph.com/api/published-disruptions');
        const data = await response.json();
        
        if (data.success) {
          setPublicDisruptions(data.disruptions || []);
          console.log(`✅ Loaded ${data.disruptions.length} public disruptions`);
        }
      } catch (error) {
        console.error('Error fetching public disruptions:', error);
      }
    };

    fetchPublicDisruptions();
    const interval = setInterval(fetchPublicDisruptions, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [setPublicDisruptions]);

  // ============ FETCH PUBLISHED REPORTS ============
  useEffect(() => {
    const fetchPublishedReports = async () => {
      try {
        const response = await fetch('https://backend.urbanflowph.com/api/public-reports/published');
        const data = await response.json();
        if (data.success) {
          setPublishedReports(data.data);
        }
      } catch (error) {
        console.error('Error fetching published reports:', error);
      }
    };

    fetchPublishedReports();
    const interval = setInterval(fetchPublishedReports, 60000);
    return () => clearInterval(interval);
  }, [setPublishedReports]);

  // ============ DRAW DISRUPTION MARKERS ============
  useEffect(() => {
    if (!mapInstanceRef.current || !showPublicDisruptions) {
      // Clear layers if toggle is off
      disruptionLayersRef.current.forEach(layer => {
        if (mapInstanceRef.current?.hasLayer(layer)) {
          mapInstanceRef.current.removeLayer(layer);
        }
      });
      disruptionLayersRef.current = [];
      return;
    }

    drawDisruptionMarkers();
  }, [publicDisruptions, showPublicDisruptions]);

  // ============ DRAW REPORT MARKERS ============
  useEffect(() => {
    if (!mapInstanceRef.current || !showPublicReports) {
      reportMarkersRef.current.forEach(marker => marker.remove());
      reportMarkersRef.current = [];
      return;
    }

    drawReportMarkers();
  }, [publishedReports, showPublicReports, reportMarkersRef]);

  // ============ DRAW DISRUPTIONS FUNCTION ============
  const drawDisruptionMarkers = () => {
    if (!mapInstanceRef.current) return;

    const map = mapInstanceRef.current;

    // Clear old layers
    disruptionLayersRef.current.forEach(layer => {
      if (map.hasLayer(layer)) {
        map.removeLayer(layer);
      }
    });
    disruptionLayersRef.current = [];

    publicDisruptions.forEach((disruption) => {
      if (!disruption.latitude || !disruption.longitude) return;

      const color = getDisruptionColor(disruption.congestion_level);
      const icon = getDisruptionIcon(disruption.type);

      const marker = L.marker([disruption.latitude, disruption.longitude], {
        icon: L.divIcon({
          className: "disruption-marker-active",
          html: `
            <div style="position: relative; width: 40px; height: 40px;">
              <div style="
                position: absolute; top: 50%; left: 50%;
                transform: translate(-50%, -50%);
                width: 48px; height: 48px;
                border: 2px solid ${color}; border-radius: 50%;
                opacity: 0.3;
                animation: pulse-active 2s ease-out infinite;
              "></div>
              <div style="
                background: white;
                border: 3px solid ${color};
                border-radius: 50%;
                width: 40px; height: 40px;
                display: flex; align-items: center; justify-content: center;
                font-size: 20px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                cursor: pointer;
              ">${icon}</div>
            </div>
          `,
          iconSize: [40, 40],
          iconAnchor: [20, 20],
        }),
        zIndexOffset: 1000,
      }).addTo(map);

      marker.bindPopup(createDisruptionPopup(disruption));
      disruptionLayersRef.current.push(marker);
    });
  };

  // ============ DRAW REPORTS FUNCTION ============
  const drawReportMarkers = () => {
    if (!mapInstanceRef.current) return;

    reportMarkersRef.current.forEach(marker => marker.remove());
    reportMarkersRef.current = [];

    publishedReports.forEach(report => {
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

      marker.bindPopup(createReportPopup(report), {
        maxWidth: 350,
        className: 'custom-report-popup'
      });

      reportMarkersRef.current.push(marker);
    });
  };

  // ============ HELPER FUNCTIONS ============
  const getDisruptionColor = (level) => {
    switch (level?.toLowerCase()) {
      case 'heavy': return '#ef4444';
      case 'moderate': return '#f59e0b';
      case 'light': return '#10b981';
      default: return '#6b7280';
    }
  };

  const getDisruptionIcon = (type) => {
    switch (type) {
      case 'roadwork': return '🚧';
      case 'event': return '🎉';
      case 'accident': return '⚠️';
      case 'weather': return '🌧️';
      default: return '📍';
    }
  };

  const createDisruptionPopup = (disruption) => {
    return `
      <div style="font-family: -apple-system, sans-serif; padding: 10px; min-width: 200px;">
        <h3 style="margin: 0 0 8px 0; font-size: 15px; font-weight: 600;">
          🚧 ${disruption.title}
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
    `;
  };

  const createReportPopup = (report) => {
    const expiresAt = new Date(report.expires_at);
    const now = new Date();
    const hoursRemaining = Math.max(0, Math.round((expiresAt - now) / (1000 * 60 * 60)));
    const minutesRemaining = Math.max(0, Math.round((expiresAt - now) / (1000 * 60)) % 60);

    const emoji = 
      report.report_type === 'accident' ? '🚗' :
      report.report_type === 'flooding' ? '🌊' :
      report.report_type === 'roadwork' ? '🚧' : '⚠️';

    return `
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
  };

  // ============ SEARCH FUNCTIONS ============
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
  }, [debounceTimerRef, setSearchResults, setSearchError, setSearchLoading]);

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
        headers: { Accept: "application/json" },
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
      setSearchError("Search temporarily unavailable.");
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
        if (selectedSuggestionIndex >= 0 && searchResults[selectedSuggestionIndex]) {
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

  const handleSuggestionClick = (result, e) => {
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

    const marker = L.marker([lat, lon], { icon: searchIcon }).addTo(map);
    const displayName = result.display_name || "Selected Location";
    
    marker.bindPopup(`
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
    `).openPopup();

    setSearchMarker(marker);
    map.setView([lat, lon], 16, { animate: true, duration: 1 });
    setSearchQuery(result.display_name);
    setIsSearchFocused(false);
    setSelectedSuggestionIndex(-1);
    searchInputRef.current?.blur();
  };

  const shouldShowDropdown =
    isSearchFocused &&
    (searchResults.length > 0 ||
      searchLoading ||
      (searchError && searchQuery.trim().length >= 2));

  // ============ RENDER ============
  return (
    <div className="relative h-full w-full">
      <style>{`
        @keyframes pulse-active {
          0% { transform: translate(-50%, -50%) scale(1); opacity: 0.3; }
          100% { transform: translate(-50%, -50%) scale(2); opacity: 0; }
        }
      `}</style>

      {/* ============ SEARCH BAR ============ */}
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

          {searchError && !searchLoading && shouldShowDropdown && (
            <div className="mt-2 text-xs text-orange-600 bg-orange-50 p-2 rounded flex items-center gap-2">
              <span>⚠️</span>
              <span>{searchError}</span>
            </div>
          )}

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
                </div>
              ) : (
                searchResults.map((result, index) => (
                  <div
                    key={index}
                    onMouseDown={(e) => handleSuggestionClick(result, e)}
                    onMouseEnter={() => setSelectedSuggestionIndex(index)}
                    className={`p-3 cursor-pointer border-b last:border-b-0 transition-colors ${
                      selectedSuggestionIndex === index ? "bg-blue-50" : "hover:bg-gray-50"
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
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* ============ MAP CONTAINER ============ */}
      <div ref={mapRef} style={{ height: "100%", width: "100%" }} />
    </div>
  );
}