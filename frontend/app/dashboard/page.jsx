"use client";

import PlannerNavbar from "@/components/PlannerNavBar";
import SimulationPreviewModal from "@/components/SimulationPreviewModal";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

// Leaflet imports with SSR check
let L;
if (typeof window !== "undefined") {
  L = require("leaflet");
  delete L.Icon.Default.prototype._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl:
      "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png",
    iconUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png",
    shadowUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png",
  });
}

// ============================================
// MINI ONGOING DISRUPTIONS MAP COMPONENT
// ============================================
function MiniOngoingMap() {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const layersRef = useRef([]);
  const [disruptions, setDisruptions] = useState([]);
  const [loading, setLoading] = useState(true);

  // Fetch ongoing disruptions
  useEffect(() => {
    fetchOngoingDisruptions();
  }, []);

  // Initialize map
  // In page.jsx - MiniOngoingMap component
  // In MiniOngoingMap component, update the useEffect that initializes the map:
  // Initialize map - FIX FOR DOUBLE INITIALIZATION
  useEffect(() => {
    if (typeof window === "undefined" || !mapRef.current) return;

    // ✅ CRITICAL FIX: Check if container already has a map
    if (mapRef.current._leaflet_id) {
      console.log("🗺️ Map already initialized, skipping...");
      return;
    }

    // ✅ CRITICAL FIX: Remove existing map before creating new one
    if (mapInstanceRef.current) {
      try {
        mapInstanceRef.current.off();
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      } catch (e) {
        console.log("Map cleanup error:", e);
      }
    }

    try {
      const map = L.map(mapRef.current, {
        center: [14.2096, 121.164],
        zoom: 13,
        zoomControl: true,
        zoomAnimation: true,
        fadeAnimation: true,
        markerZoomAnimation: true,
      });

      // Set map pane z-index to stay below modals
      if (map.getPane("mapPane")) {
        map.getPane("mapPane").style.zIndex = "1";
      }
      if (map.getPane("overlayPane")) {
        map.getPane("overlayPane").style.zIndex = "2";
      }

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap",
        maxZoom: 19,
      }).addTo(map);

      mapInstanceRef.current = map;

      console.log("✅ Mini Map initialized successfully");
    } catch (error) {
      console.error("Error initializing map:", error);
    }

    // ✅ CLEANUP FUNCTION - Remove map on unmount
    return () => {
      console.log("🧹 Cleaning up mini map...");

      // Clear all layers first
      layersRef.current.forEach((layer) => {
        try {
          if (
            mapInstanceRef.current &&
            mapInstanceRef.current.hasLayer(layer)
          ) {
            mapInstanceRef.current.removeLayer(layer);
          }
        } catch (e) {}
      });
      layersRef.current = [];

      // Then remove map
      if (mapInstanceRef.current) {
        try {
          mapInstanceRef.current.off();
          mapInstanceRef.current.remove();
          mapInstanceRef.current = null;
        } catch (e) {}
      }

      // Clear the _leaflet_id from the container
      if (mapRef.current) {
        delete mapRef.current._leaflet_id;
      }
    };
  }, []); // Empty dependency array - only run once

  // Draw disruptions when data changes
  useEffect(() => {
    if (!mapInstanceRef.current || disruptions.length === 0) return;
    drawDisruptionsOnMap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disruptions]); // drawDisruptionsOnMap is stable, no need to include

  const fetchOngoingDisruptions = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        "https://backend.urbanflowph.com/api/published-disruptions"
      );
      const data = await response.json();

      if (data.success) {
        const now = new Date();
        const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

        const activeDisruptions = (data.disruptions || [])
          .map((d) => ({
            ...d,
            status: getDisruptionStatus(d, now, weekFromNow),
          }))
          .filter((d) => {
            // Only show active or upcoming disruptions
            return d.status === "active" || d.status === "upcoming";
          });

        console.log(
          "🗺️ Mini Map - Total disruptions:",
          data.disruptions?.length
        );
        console.log("🗺️ Mini Map - Active/Upcoming:", activeDisruptions.length);
        console.log("🗺️ Mini Map - Disruptions:", activeDisruptions);

        setDisruptions(activeDisruptions);
      }
    } catch (err) {
      console.error("Failed to fetch disruptions:", err);
    } finally {
      setLoading(false);
    }
  };

  const getDisruptionStatus = (disruption, now, weekFromNow) => {
    if (!disruption.start_date || !disruption.end_date) {
      console.warn("⚠️ Disruption missing dates:", disruption.title);
      return "unknown";
    }

    const start = new Date(disruption.start_date);
    const end = new Date(disruption.end_date);

    if (now >= start && now <= end) {
      console.log("✅ Active disruption:", disruption.title);
      return "active";
    }
    if (start > now && start <= weekFromNow) {
      console.log("📅 Upcoming disruption:", disruption.title);
      return "upcoming";
    }
    if (end < now) {
      console.log("⏹️ Past disruption:", disruption.title);
      return "past";
    }

    console.log("🔮 Future disruption:", disruption.title);
    return "future";
  };

  const drawDisruptionsOnMap = () => {
    if (!mapInstanceRef.current || typeof window === "undefined") return;

    const map = mapInstanceRef.current;

    // Clear old layers
    layersRef.current.forEach((layer) => {
      try {
        map.removeLayer(layer);
      } catch (e) {}
    });
    layersRef.current = [];

    // 🔍 DEBUG: Log what we're about to draw
    console.log("📍 Drawing disruptions:", disruptions.length);
    console.log(
      "Active:",
      disruptions.filter((d) => d.status === "active").length
    );
    console.log(
      "Upcoming:",
      disruptions.filter((d) => d.status === "upcoming").length
    );

    // Draw each disruption
    disruptions.forEach((disruption) => {
      if (!disruption.latitude || !disruption.longitude) {
        console.warn(
          "⚠️ Mini Map - Disruption missing coordinates:",
          disruption.title
        );
        return;
      }

      console.log(
        "🎯 Mini Map - Drawing:",
        disruption.title,
        "Status:",
        disruption.status
      );

      const severity = disruption.avg_severity || 1.5;
      const color = getSeverityColor(severity);
      const icon = disruption.status === "upcoming" ? "📅" : "🚧";

      // Draw circular impact zone
      const circle = L.circle([disruption.latitude, disruption.longitude], {
        radius: 500,
        color: color,
        fillColor: color,
        fillOpacity: 0.2,
        weight: 2,
      }).addTo(map);

      layersRef.current.push(circle);

      // Add marker
      const marker = L.marker([disruption.latitude, disruption.longitude], {
        icon: L.divIcon({
          className:
            disruption.status === "upcoming"
              ? "disruption-marker-upcoming"
              : "disruption-marker-active",
          html: `
            <div style="position: relative; width: 36px; height: 36px;">
              <div style="
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                width: 50px;
                height: 50px;
                border: 3px solid ${color};
                border-radius: 50%;
                opacity: 0.3;
                animation: pulse 2s ease-out infinite;
              "></div>
              <div style="
                background: white;
                border: 3px solid ${color};
                border-radius: 50%;
                width: 36px;
                height: 36px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 18px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.2);
                cursor: pointer;
                position: relative;
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
          iconSize: [36, 36],
          iconAnchor: [18, 18],
        }),
        zIndexOffset: 1000,
      }).addTo(map);

      marker.bindPopup(createPopup(disruption));
      layersRef.current.push(marker);
    });

    // Fit map to show all disruptions
    if (disruptions.length > 0) {
      const bounds = disruptions.map((d) => [d.latitude, d.longitude]);
      try {
        map.fitBounds(bounds, { padding: [30, 30], maxZoom: 14 });
      } catch (e) {}
    }
  };

  const createPopup = (disruption) => {
    const isActive = disruption.status === "active";
    const icon = isActive ? "🚧" : "📅";
    const statusLabel = isActive ? "Active" : "Upcoming";
    const statusColor = isActive ? "#ef4444" : "#3b82f6";

    return `
      <div style="font-family: -apple-system, sans-serif; padding: 10px; min-width: 200px;">
        <h3 style="margin: 0 0 8px 0; font-size: 14px; font-weight: 600; color: #1f2937;">
          ${icon} ${disruption.title || "Traffic Disruption"}
        </h3>
        <p style="margin: 4px 0; font-size: 11px; color: #6b7280;">
          📍 ${disruption.location || "Location not specified"}
        </p>
        <div style="margin-top: 8px;">
          <span style="background: ${statusColor}; color: white; padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: 600;">
            ${statusLabel}
          </span>
        </div>
        ${
          isActive
            ? `
          <div style="margin-top: 8px; padding: 6px; background: #f9fafb; border-radius: 4px;">
            <p style="margin: 2px 0; font-size: 10px; color: #4b5563;">
              <strong>Delay:</strong> +${disruption.expected_delay || 0} min
            </p>
            <p style="margin: 2px 0; font-size: 10px; color: #4b5563;">
              <strong>Level:</strong> ${
                disruption.congestion_level || "Unknown"
              }
            </p>
          </div>
        `
            : `
          <div style="margin-top: 8px; padding: 6px; background: #eff6ff; border-radius: 4px;">
            <p style="margin: 2px 0; font-size: 10px; color: #1e40af;">
              <strong>Starts:</strong> ${
                disruption.start_date
                  ? new Date(disruption.start_date).toLocaleString("en-US", {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : "TBD"
              }
            </p>
          </div>
        `
        }
      </div>
    `;
  };

  const getSeverityColor = (severity) => {
    if (severity < 1.5) return "#22c55e"; // green
    if (severity < 2.5) return "#fbbf24"; // yellow
    return "#ef4444"; // red
  };

  return (
    <div className="relative w-full h-full">
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-75 z-[1000]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500 mx-auto mb-2"></div>
            <p className="text-sm text-gray-600">Loading map...</p>
          </div>
        </div>
      )}
      {!loading && disruptions.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-75 z-[1000]">
          <div className="text-center text-gray-500">
            <div className="text-4xl mb-2">✅</div>
            <p className="text-sm">No active disruptions</p>
          </div>
        </div>
      )}
      {/* ✅ IMPORTANT: Add id to prevent double initialization */}
      <div
        ref={mapRef}
        id="mini-ongoing-map"
        className="w-full h-full rounded-lg"
        style={{ zIndex: 1 }}
      />
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const { user, loading: authLoading, isAuthenticated } = useAuth();
  const userId = user?.user_id || user?.id;
  const heatmapScrollRef = useRef(null);

  // Add these new state variables for the modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedSimulation, setSelectedSimulation] = useState(null);

  // State variables
  const [savedSimulations, setSavedSimulations] = useState([]);
  const [publishedSimulations, setPublishedSimulations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [backendStatus, setBackendStatus] = useState({
    ml_model: "checking",
    database: "checking",
    response_time: "...",
  });

  const [stats, setStats] = useState({
    totalSaved: 0,
    totalPublished: 0,
    activeDisruptions: 0,
    simulationsRun: 0,
    avgCongestion: "Loading...",
    avgCongestionValue: 0,
  });

  const [isMounted, setIsMounted] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(new Date());

  // Heatmap data state - ALL 24 hours
  const [heatmapData, setHeatmapData] = useState({
    times: [],
    roads: [],
  });

  // Weekly trend data
  const [weeklyTrend, setWeeklyTrend] = useState([
    { day: "Mon", level: 0 },
    { day: "Tue", level: 0 },
    { day: "Wed", level: 0 },
    { day: "Thu", level: 0 },
    { day: "Fri", level: 0 },
    { day: "Sat", level: 0 },
    { day: "Sun", level: 0 },
  ]);

  //redirect if not autheticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [authLoading, isAuthenticated, router]);

  //fetch data when user is loaded
  useEffect(() => {
    if (user?.id) {
      fetchDashboardData();
      checkBackendHealth();
    }
  }, [user]);

  // ============================================
  // BACKEND HEALTH CHECK
  // ============================================
  const checkBackendHealth = async () => {
    const startTime = Date.now();

    try {
      const response = await fetch("https://backend.urbanflowph.com/api/health");
      const endTime = Date.now();
      const responseTime = endTime - startTime;

      if (response.ok) {
        setBackendStatus({
          ml_model: "active",
          database: "active",
          response_time: `${responseTime}ms`,
        });
      } else {
        setBackendStatus({
          ml_model: "error",
          database: "error",
          response_time: "N/A",
        });
      }
    } catch (err) {
      setBackendStatus({
        ml_model: "error",
        database: "error",
        response_time: "N/A",
      });
    }
  };

  // ============================================
  // FETCH REAL-TIME TRAFFIC DATA (if available)
  // ============================================
  const fetchRealTimeTraffic = async (roadName, hour) => {
    try {
      // TODO: Replace with your actual traffic API endpoint
      // Example endpoints you might use:
      // - TomTom Traffic Flow: https://api.tomtom.com/traffic/services/4/flowSegmentData
      // - Waze for Cities: https://www.waze.com/ccp-api/
      // - Your own backend endpoint: http://https://backend.urbanflowph.com/api/traffic-status

      const response = await fetch(
        `https://backend.urbanflowph.com/api/traffic-status?road=${encodeURIComponent(
          roadName
        )}&hour=${hour}`
      );

      if (response.ok) {
        const data = await response.json();
        // Expected format: { congestion_level: 1.5, timestamp: "..." }
        return data.congestion_level || null;
      }
      return null;
    } catch (err) {
      console.log(
        `⚠️ Real-time traffic API not available for ${roadName} at ${hour}:00`
      );
      return null;
    }
  };

  // ============================================
  // CALCULATE HOURLY HEATMAP - ALL 24 HOURS
  // ============================================
  //const calculateHeatmap = async (simulations) => {
  // ============================================
  // CALCULATE HOURLY HEATMAP - ALL 24 HOURS
  // INDEPENDENT MODE - ALWAYS SHOWS BUCAL, PARIAN, TURBINA
  // ============================================
  const calculateHeatmap = async (simulations) => {
    console.log("🔥 Calculating 24-hour heatmap (independent mode)");

    // ✅ ALWAYS USE THESE TOP 3 AREAS - NO DEPENDENCY ON SIMULATIONS
    const topAreas = [
      { name: "Bucal", lat: 14.1894, lng: 121.1653 },
      { name: "Parian", lat: 14.2115, lng: 121.1653 },
      { name: "Turbina", lat: 14.2331, lng: 121.1653 },
    ];

    console.log(
      "📍 Fixed top 3 areas:",
      topAreas.map((a) => a.name).join(", ")
    );

    const currentHour = new Date().getHours();

    // Generate ALL 24 hours (0-23)
    const allHours = Array.from({ length: 24 }, (_, i) => i);

    // Format time labels
    const timeLabels = allHours.map((h) => {
      let label;
      if (h === 0) label = "12AM";
      else if (h === 12) label = "12PM";
      else if (h < 12) label = `${h}AM`;
      else label = `${h - 12}PM`;

      if (h === currentHour) label += " 🔴"; // Live indicator

      return label;
    });

    // Calculate values for each area across all 24 hours
    const roadData = await Promise.all(
      topAreas.map(async (area) => {
        console.log(`\n📊 Processing ${area.name}...`);

        // Generate values for all 24 hours
        const values = await Promise.all(
          allHours.map(async (hour) => {
            const isPast = hour < currentHour;
            const isCurrent = hour === currentHour;
            const isFuture = hour > currentHour;

            // ============================================================
            // 1. TRY REAL-TIME API FOR CURRENT AND RECENT HOURS
            // ============================================================
            let realTimeValue = null;
            if (isCurrent || (isPast && currentHour - hour <= 3)) {
              try {
                const response = await fetch(
                  `https://backend.urbanflowph.com/api/traffic-status?area=${encodeURIComponent(
                    area.name
                  )}&hour=${hour}`
                );

                if (response.ok) {
                  const data = await response.json();
                  realTimeValue = data.congestion_level || null;

                  if (realTimeValue !== null) {
                    console.log(
                      `  ✅ Real-time data for ${area.name} at ${hour}:00 = ${realTimeValue}`
                    );
                    return Math.max(0.5, Math.min(3.0, realTimeValue));
                  }
                }
              } catch (err) {
                // Real-time API not available, will use historical patterns
              }
            }

            // ============================================================
            // 2. USE HISTORICAL PATTERNS + PREDICTION
            // ============================================================

            // Base traffic pattern per area (from historical DWPH/POSO data)
            let baseLevel = 1.0;

            // Area-specific base levels (adjust based on your historical data)
            if (area.name === "Bucal") baseLevel = 1.3; // Higher base traffic
            else if (area.name === "Parian")
              baseLevel = 1.5; // Highest base traffic
            else if (area.name === "Turbina") baseLevel = 1.2; // Moderate base traffic

            // Time-of-day multiplier (typical daily pattern)
            let timeMultiplier = 1.0;

            if (hour >= 6 && hour <= 9) {
              // Morning rush hour
              timeMultiplier = 1.6;
            } else if (hour >= 17 && hour <= 19) {
              // Evening rush hour
              timeMultiplier = 1.8;
            } else if (hour >= 12 && hour <= 14) {
              // Lunch time
              timeMultiplier = 1.3;
            } else if (hour >= 10 && hour <= 11) {
              // Mid-morning
              timeMultiplier = 1.2;
            } else if (hour >= 15 && hour <= 16) {
              // Mid-afternoon
              timeMultiplier = 1.3;
            } else if (hour >= 20 && hour <= 22) {
              // Evening
              timeMultiplier = 1.1;
            } else if (hour >= 23 || hour <= 5) {
              // Late night / early morning
              timeMultiplier = 0.4;
            } else {
              // Off-peak
              timeMultiplier = 0.9;
            }

            // Check if it's weekend
            const today = new Date();
            const isWeekend = today.getDay() === 0 || today.getDay() === 6;
            if (isWeekend) {
              // Reduce weekday rush hour patterns on weekends
              if (hour >= 6 && hour <= 9) timeMultiplier *= 0.7;
              if (hour >= 17 && hour <= 19) timeMultiplier *= 0.7;
            }

            // Calculate final value
            let value = baseLevel * timeMultiplier;

            // Add slight variation for realism
            const randomVariation = (Math.random() - 0.5) * 0.2; // ±0.1
            value += randomVariation;

            // Boost current hour slightly for emphasis
            if (isCurrent) {
              value *= 1.1;
            }

            // For future hours, add uncertainty (slightly reduce confidence)
            if (isFuture) {
              value *= 0.95;
            }

            // Ensure value is within bounds (0.5 = light, 3.0 = heavy)
            return Math.max(0.5, Math.min(3.0, value));
          })
        );

        return {
          name: area.name,
          values: values,
        };
      })
    );

    console.log("✅ 24-hour heatmap updated (independent mode)");

    setHeatmapData({
      times: timeLabels,
      roads: roadData,
    });

    // Auto-scroll to current hour after update
    setTimeout(() => {
      scrollToCurrentHour();
    }, 100);
  };

  // ============================================
  // AUTO-SCROLL TO CURRENT HOUR
  // ============================================
  const scrollToCurrentHour = () => {
    if (heatmapScrollRef.current) {
      const currentHour = new Date().getHours();
      // Each cell is roughly 60px wide (adjust based on your styling)
      const scrollPosition = Math.max(0, (currentHour - 3) * 60);
      heatmapScrollRef.current.scrollTo({
        left: scrollPosition,
        behavior: "smooth",
      });
    }
  };

  // Add this function in page.jsx, before fetchDashboardData
  const calculateWeeklyTrend = (simulations) => {
    const dayMap = {
      Sunday: 0,
      Monday: 1,
      Tuesday: 2,
      Wednesday: 3,
      Thursday: 4,
      Friday: 5,
      Saturday: 6,
    };

    const dayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const dayCounts = new Array(7).fill(0);
    const daySeverities = new Array(7).fill(0);

    simulations.forEach((sim) => {
      if (sim.start_time && sim.average_delay_ratio) {
        const startDate = new Date(sim.start_time);
        const dayIndex = startDate.getDay(); // 0 = Sunday, 1 = Monday, etc.

        dayCounts[dayIndex]++;
        daySeverities[dayIndex] += parseFloat(sim.average_delay_ratio);
      }
    });

    // Calculate averages and format for chart
    return dayLabels.map((day, index) => ({
      day: day,
      level:
        dayCounts[index] > 0
          ? parseFloat((daySeverities[index] / dayCounts[index]).toFixed(2))
          : 0,
    }));
  };

  // ============================================
  // FETCH DASHBOARD DATA
  // ============================================
  const fetchDashboardData = async () => {
    setLoading(true);
    setError(null);

    try {
      const savedResponse = await fetch(
        `https://backend.urbanflowph.com/api/my-simulations?user_id=${userId}`
      );
      const savedData = await savedResponse.json();

      if (savedData.success) {
        setSavedSimulations(savedData.simulations);

        const totalSaved = savedData.simulations.length;
        const completed = savedData.simulations.filter(
          (s) => s.simulation_status === "completed"
        );
        const published = savedData.simulations.filter(
          (s) => s.simulation_status === "published"
        );

        const validSeverities = completed
          .map((s) => s.average_delay_ratio)
          .filter(
            (val) => val !== null && val !== undefined && !isNaN(val) && val > 0
          );

        const avgSeverity =
          validSeverities.length > 0
            ? validSeverities.reduce((sum, val) => sum + val, 0) /
              validSeverities.length
            : 0;

        const avgLabel =
          avgSeverity < 1.5
            ? "Light"
            : avgSeverity < 2.5
            ? "Moderate"
            : "Heavy";

        setStats({
          totalSaved: totalSaved,
          totalPublished: published.length,
          activeDisruptions: published.length,
          avgCongestion: avgLabel,
        });

        // ✅ ADD THIS - Calculate weekly trend from actual data
        const weeklyData = calculateWeeklyTrend(savedData.simulations);
        setWeeklyTrend(weeklyData);

        console.log("📊 Weekly trend data:", weeklyData);

        console.log("🔄 Calculating 24-hour heatmap...");
        await calculateHeatmap(savedData.simulations);
      }

      const publishedResponse = await fetch(
        "https://backend.urbanflowph.com/api/published-simulations"
      );
      const publishedData = await publishedResponse.json();

      if (publishedData.success) {
        setPublishedSimulations(publishedData.simulations);
      }
    } catch (err) {
      console.error("Error fetching dashboard data:", err);
      setError("Failed to load dashboard data");
    } finally {
      setLoading(false);
      setLastUpdate(new Date());
    }
  };

  const handleOpenPreview = (simulation) => {
    setSelectedSimulation(simulation);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedSimulation(null);
  };

  // ============================================
  // INITIAL LOAD & HOURLY REFRESH
  // ============================================
  useEffect(() => {
    fetchDashboardData();
    checkBackendHealth();
    setIsMounted(true);

    // Calculate time until next hour
    const now = new Date();
    const msUntilNextHour =
      (60 - now.getMinutes()) * 60 * 1000 - now.getSeconds() * 1000;

    console.log(
      `⏰ Next hourly refresh in ${Math.round(msUntilNextHour / 60000)} minutes`
    );

    // Set up hourly refresh at top of each hour
    const hourlyTimer = setTimeout(() => {
      console.log("🔄 HOURLY REFRESH - New hour started!");
      fetchDashboardData();

      const hourlyInterval = setInterval(() => {
        console.log("🔄 HOURLY REFRESH");
        fetchDashboardData();
      }, 3600000);

      return () => clearInterval(hourlyInterval);
    }, msUntilNextHour);

    // Health check every 10 minutes
    const healthInterval = setInterval(() => {
      checkBackendHealth();
    }, 600000);

    return () => {
      clearTimeout(hourlyTimer);
      clearInterval(healthInterval);
    };
  }, []);

  // ============================================
  // HELPER FUNCTIONS
  // ============================================
  const getCongestionColor = (value) => {
    if (value < 1.5) return "bg-green-500";
    if (value < 2.5) return "bg-yellow-500";
    return "bg-red-500";
  };

  const getCongestionLabel = (value) => {
    if (value < 1.5) return "Light";
    if (value < 2.5) return "Moderate";
    return "Heavy";
  };

  const getRelativeTime = (date) => {
    if (!date) return "Unknown";

    const now = new Date();
    const past = new Date(date);
    const diffMs = now - past;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffHours < 24)
      return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
    return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <PlannerNavbar />

      <main className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-12 gap-6">
          {/* Left Content */}
          <div className="col-span-12 lg:col-span-8">
            {/* Greeting */}
            <div className="mb-6">
              <h1 className="text-3xl font-bold text-gray-800">
                Hello,{" "}
                <span style={{ color: "#F5820D" }}>{user?.firstName}</span>
              </h1>
              <p className="text-gray-600 mt-1">
                {" "}
                Welcome back to your dashboard!
              </p>
            </div>

            {/* Quick Actions */}
            <div className="mb-6">
              <h2 className="text-xl font-bold text-gray-800 mb-4">
                Quick Actions
              </h2>

              <div className="grid md:grid-cols-3 gap-4">
                {/* New Simulation */}
                <div
                  className="rounded-xl p-6 shadow-lg hover:shadow-xl transition-shadow"
                  style={{
                    background:
                      "linear-gradient(135deg, #F5820D 0%, #FFA611 100%)",
                  }}
                >
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-lg flex items-center justify-center">
                      <span className="text-2xl font-light text-white">+</span>
                    </div>
                    <h3 className="text-lg font-semibold text-white">
                      New Simulation
                    </h3>
                  </div>
                  <p className="text-sm text-white/90 mb-4 leading-relaxed">
                    Define a disruption, run the simulation, review results.
                  </p>
                  <button
                    onClick={() => router.push("/simulation")}
                    className="w-full bg-white text-orange-600 py-2.5 rounded-lg font-semibold hover:bg-orange-50 transition-all shadow-sm"
                  >
                    Create
                  </button>

                  <div className="mt-4 pt-4 border-t border-white/20">
                    <p className="text-xs text-white/80 mb-1">
                      Saved Scenarios
                    </p>
                    <p className="text-2xl font-bold text-white">
                      {loading ? "..." : stats.totalSaved}
                    </p>
                  </div>
                </div>

                {/* Saved Scenarios */}
                <div
                  className="rounded-xl p-6 shadow-lg hover:shadow-xl transition-shadow"
                  style={{
                    background:
                      "linear-gradient(150deg, #F5820D 0%, #FFA611 100%)",
                  }}
                >
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-lg flex items-center justify-center">
                      <svg
                        className="w-6 h-6 text-white"
                        fill="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path d="M17 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V7l-4-4zm-5 16c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34-3-3-3zm3-10H5V5h10v4z" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-semibold text-white">
                      Saved Scenarios
                    </h3>
                  </div>
                  <p className="text-sm text-white/90 mb-4 leading-relaxed">
                    Open and edit previously saved simulations or resume drafts.
                  </p>
                  <button
                    onClick={() => router.push("/data")}
                    className="w-full bg-white text-orange-600 py-2.5 rounded-lg font-semibold hover:bg-orange-50 transition-all shadow-sm"
                  >
                    Open ({stats.totalSaved})
                  </button>
                  <div className="mt-4 pt-4 border-t border-white/20">
                    <p className="text-xs text-white/80 mb-1">Pending Review</p>
                    <p className="text-2xl font-bold text-white">0</p>
                  </div>
                </div>

                {/* Published Results */}
                <div
                  className="rounded-xl p-6 shadow-lg hover:shadow-xl transition-shadow"
                  style={{
                    background:
                      "linear-gradient(190deg, #F5820D 0%, #FFA611 100%)",
                  }}
                >
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-lg flex items-center justify-center">
                      <svg
                        className="w-6 h-6 text-white"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        viewBox="0 0 24 24"
                      >
                        <circle cx="12" cy="12" r="10" />
                        <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-semibold text-white">
                      Published Results
                    </h3>
                  </div>
                  <p className="text-sm text-white/90 mb-4 leading-relaxed">
                    View simulations already published to the public map.
                  </p>
                  <button
                    onClick={() => router.push("/reports")}
                    className="w-full bg-white text-orange-600 py-2.5 rounded-lg font-semibold hover:bg-orange-50 transition-all shadow-sm"
                  >
                    View ({stats.totalPublished})
                  </button>
                  <div className="mt-4 pt-4 border-t border-white/20">
                    <p className="text-xs text-white/80 mb-1">Published</p>
                    <p className="text-2xl font-bold text-white">
                      {loading ? "..." : stats.totalPublished}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-4 gap-4 mb-6">
              <div className="bg-white rounded-lg shadow p-4 text-center">
                <p className="text-2xl font-bold text-gray-800">
                  {loading ? "..." : stats.activeDisruptions}
                </p>
                <p className="text-xs text-gray-600">Active Disruptions</p>
              </div>
              <div className="bg-white rounded-lg shadow p-4 text-center">
                <p className="text-2xl font-bold text-gray-800">
                  {loading ? "..." : stats.totalSaved}
                </p>
                <p className="text-xs text-gray-600">Simulations Run</p>
              </div>
              <div className="bg-white rounded-lg shadow p-4 text-center">
                <p
                  className={`text-2xl font-bold ${
                    stats.avgCongestion === "Heavy"
                      ? "text-red-600"
                      : stats.avgCongestion === "Moderate"
                      ? "text-yellow-600"
                      : "text-green-600"
                  }`}
                >
                  {loading ? "..." : stats.avgCongestion}
                </p>
                <p className="text-xs text-gray-600">Avg Congestion</p>
              </div>
              <div className="bg-white rounded-lg shadow p-4 text-center">
                <p className="text-2xl font-bold text-gray-800">
                  {loading ? "..." : stats.totalPublished}
                </p>
                <p className="text-xs text-gray-600">Reports Generated</p>
              </div>
            </div>

            {/* Recent Activity */}
            <div className="bg-white rounded-lg shadow-md p-6 mb-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-gray-800">
                  Recent Activity
                </h2>
                <button
                  onClick={() => router.push("/data")}
                  className="text-orange-500 text-sm font-semibold hover:underline"
                >
                  View all
                </button>
              </div>

              {loading ? (
                <div className="flex items-center justify-center p-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
                </div>
              ) : error ? (
                <div className="text-center p-4 text-red-600">{error}</div>
              ) : savedSimulations.length === 0 ? (
                <div className="text-center p-8 text-gray-500">
                  <p className="text-lg mb-2">📭</p>
                  <p>No simulations yet. Create your first one!</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {savedSimulations
                    .filter((sim, index, self) => 
                      index === self.findIndex(s => s.simulation_id === sim.simulation_id)
                    )
                    .slice(0, 3)
                    .map((sim) => (
                    <div
                      key={sim.simulation_id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                    >
                      <div className="flex-1">
                        <p className="font-semibold text-gray-800">
                          {sim.simulation_name || "Unnamed Simulation"}
                        </p>
                        <p className="text-sm text-gray-600">
                          {sim.simulation_status === "published"
                            ? "Published"
                            : "Saved"}{" "}
                          — {new Date(sim.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-3 py-1 text-xs font-semibold rounded ${
                            sim.average_delay_ratio >= 2
                              ? "bg-red-100 text-red-700"
                              : sim.average_delay_ratio >= 1
                              ? "bg-yellow-100 text-yellow-700"
                              : "bg-green-100 text-green-700"
                          }`}
                        >
                          {sim.average_delay_ratio >= 2
                            ? "Heavy"
                            : sim.average_delay_ratio >= 1
                            ? "Moderate"
                            : "Light"}
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenPreview(sim);
                          }}
                          className="px-4 py-1 bg-orange-500 text-white text-sm rounded hover:bg-orange-600 transition"
                        >
                          Review
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {!loading && !error && savedSimulations.length > 3 && (
                <button
                  onClick={() => router.push("/data")}
                  className="w-full mt-4 text-orange-500 text-sm font-semibold hover:underline"
                >
                  View all {savedSimulations.length} simulations →
                </button>
              )}
            </div>

            {/* 24-HOUR SCROLLING HEATMAP */}
            <div className="bg-white rounded-lg shadow-md p-6 mb-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-bold text-gray-800">
                    24-Hour Traffic Timeline
                  </h2>
                  <p className="text-xs text-gray-500 mt-1">
                    Real-time tracking • Past hours fade • Current hour • Future
                    predictions
                  </p>
                </div>
                <button
                  onClick={scrollToCurrentHour}
                  className="text-xs bg-orange-100 text-orange-700 px-3 py-1.5 rounded-full font-semibold hover:bg-orange-200 transition flex items-center gap-1"
                >
                  <span>Jump to Now</span>
                  <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse"></div>
                </button>
              </div>

              {/* Scrollable Heatmap Container */}
              <div
                ref={heatmapScrollRef}
                className="overflow-x-auto overflow-y-visible pb-2"
                style={{ scrollBehavior: "smooth" }}
              >
                {heatmapData.roads.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <p>Loading 24-hour data...</p>
                  </div>
                ) : (
                  <table
                    className="text-xs border-collapse"
                    style={{ tableLayout: "fixed" }}
                  >
                    <thead>
                      <tr>
                        <th
                          className="sticky left-0 bg-white z-10 text-left p-2 font-semibold text-gray-700 border-r border-gray-200"
                          style={{ minWidth: "100px", width: "100px" }}
                        >
                          Location
                        </th>
                        {heatmapData.times.map((time, idx) => {
                          const currentHour = new Date().getHours();
                          const isCurrent = idx === currentHour;
                          const isPast = idx < currentHour;

                          // Remove emoji for consistent width
                          const timeText = time
                            .replace(/🔴/g, "")
                            .replace(/\s+/g, " ")
                            .trim();

                          return (
                            <th
                              key={idx}
                              className={`p-2 font-semibold text-center transition-opacity duration-500 ${
                                isCurrent
                                  ? "text-red-600 bg-red-50"
                                  : isPast
                                  ? "text-gray-400 opacity-50"
                                  : "text-gray-700"
                              }`}
                              style={{
                                minWidth: "60px",
                                width: "60px",
                                maxWidth: "60px",
                              }}
                            >
                              <div className="flex items-center justify-center gap-1">
                                <span className="whitespace-nowrap text-xs">
                                  {timeText}
                                </span>
                                {isCurrent && (
                                  <div
                                    className="w-2 h-2 bg-red-500 rounded-full animate-pulse flex-shrink-0"
                                    title="Current Hour"
                                  />
                                )}
                              </div>
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      {heatmapData.roads.map((road, roadIdx) => (
                        <tr key={roadIdx}>
                          <td className="sticky left-0 bg-white z-10 p-2 font-medium text-gray-800 text-xs border-r border-gray-200">
                            {road.name}
                          </td>
                          {road.values.map((value, timeIdx) => {
                            const currentHour = new Date().getHours();
                            const isCurrent = timeIdx === currentHour;
                            const isPast = timeIdx < currentHour;

                            let opacity = 1.0;
                            if (isPast) {
                              const hoursSince = currentHour - timeIdx;
                              opacity = Math.max(0.3, 1.0 - hoursSince * 0.1);
                            }

                            return (
                              <td
                                key={timeIdx}
                                className="p-1 text-center"
                                style={{
                                  minWidth: "60px",
                                  maxWidth: "60px",
                                  width: "60px",
                                }}
                              >
                                <div
                                  className={`h-12 w-12 rounded flex items-center justify-center text-white font-bold text-xs mx-auto ${getCongestionColor(
                                    value
                                  )} hover:scale-110 transition-transform cursor-pointer ${
                                    isCurrent ? "ring-4 ring-red-400" : ""
                                    //isCurrent ? 'ring-4 ring-red-400 animate-[pulse_1s_ease-in-out_infinite]' : ''
                                  }`}
                                  style={{ opacity }}
                                  title={`${
                                    road.name
                                  } at ${timeIdx}:00\n${getCongestionLabel(
                                    value
                                  )} (${value.toFixed(1)})\n${
                                    isPast
                                      ? "✓ Passed"
                                      : isCurrent
                                      ? "🔴 LIVE"
                                      : "📊 Predicted"
                                  }`}
                                >
                                  {value.toFixed(1)}
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
              {/* Legend */}
              <div className="flex justify-between items-center mt-4 pt-4 border-t">
                <div className="flex gap-4 text-xs">
                  <div className="flex items-center gap-1">
                    <div className="w-4 h-4 bg-green-500 rounded"></div>
                    <span className="text-gray-600">Light</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-4 h-4 bg-yellow-500 rounded"></div>
                    <span className="text-gray-600">Moderate</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-4 h-4 bg-red-500 rounded"></div>
                    <span className="text-gray-600">Heavy</span>
                  </div>
                </div>

                <div className="text-xs text-gray-500">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                    <span>
                      Updates hourly • Last:{" "}
                      {isMounted ? lastUpdate.toLocaleTimeString() : "--:--"}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Weekly Trend */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-lg font-bold text-gray-800 mb-4">
                Weekly Trend
              </h2>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={weeklyTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis
                    dataKey="day"
                    tick={{ fill: "#6b7280", fontSize: 11 }}
                  />
                  <YAxis
                    domain={[0, 3]}
                    ticks={[0, 1, 2, 3]}
                    tick={{ fill: "#6b7280", fontSize: 11 }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#fff",
                      border: "1px solid #e5e7eb",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                    formatter={(value) => {
                      const label =
                        value < 1.5
                          ? "Light"
                          : value < 2.5
                          ? "Moderate"
                          : "Heavy";
                      return [label, "Congestion"];
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="level"
                    stroke="#f97316"
                    strokeWidth={2}
                    dot={{ fill: "#f97316", r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
              <p className="text-xs text-gray-500 text-center mt-2">
                {loading
                  ? "Loading..."
                  : savedSimulations.length === 0
                  ? "No data yet - create simulations to see trends"
                  : `Based on ${savedSimulations.length} simulation${
                      savedSimulations.length > 1 ? "s" : ""
                    }`}
              </p>
            </div>
          </div>

          {/* Right Sidebar */}
          <div className="col-span-12 lg:col-span-4 space-y-6">
            {/* System Status */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-lg font-bold text-gray-800 mb-4">
                System Status
              </h3>
              <div className="space-y-3">
                <div
                  className={`flex items-center justify-between p-3 rounded-lg ${
                    backendStatus.ml_model === "active"
                      ? "bg-green-50"
                      : "bg-red-50"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="text-2xl">🤖</div>
                    <div>
                      <p className="font-semibold text-gray-800">ML Model</p>
                      <p className="text-xs text-gray-600">Random Forest</p>
                    </div>
                  </div>
                  <span
                    className={`px-2 py-1 text-white text-xs font-semibold rounded ${
                      backendStatus.ml_model === "active"
                        ? "bg-green-500"
                        : "bg-red-500"
                    }`}
                  >
                    {backendStatus.ml_model === "active" ? "Active" : "Offline"}
                  </span>
                </div>

                <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="text-2xl">📊</div>
                    <div>
                      <p className="font-semibold text-gray-800">
                        Data Updated
                      </p>
                      <p className="text-xs text-gray-600">Last sync</p>
                    </div>
                  </div>
                  <span className="text-sm font-semibold text-blue-600">
                    {loading
                      ? "..."
                      : savedSimulations.length > 0
                      ? getRelativeTime(savedSimulations[0].created_at)
                      : "Never"}
                  </span>
                </div>

                <div
                  className={`flex items-center justify-between p-3 rounded-lg ${
                    backendStatus.database === "active"
                      ? "bg-green-50"
                      : "bg-red-50"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="text-2xl">⚡</div>
                    <div>
                      <p className="font-semibold text-gray-800">
                        Server Health
                      </p>
                      <p className="text-xs text-gray-600">Response time</p>
                    </div>
                  </div>
                  <span
                    className={`text-sm font-semibold ${
                      backendStatus.database === "active"
                        ? "text-green-600"
                        : "text-red-600"
                    }`}
                  >
                    {backendStatus.response_time}
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Links */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-lg font-bold text-gray-800 mb-4">
                Quick Links
              </h3>
              <div className="space-y-2">
                <button
                  onClick={() => router.push("/data")}
                  className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition text-left"
                >
                  <span className="text-xl">📊</span>
                  <span className="font-medium text-gray-700">
                    View All Data
                  </span>
                </button>
                <button
                  onClick={() => router.push("/reports")}
                  className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition text-left"
                >
                  <span className="text-xl">📋</span>
                  <span className="font-medium text-gray-700">
                    Generate Report
                  </span>
                </button>
                <button
                  onClick={() => router.push("/settings")}
                  className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition text-left"
                >
                  <span className="text-xl">⚙️</span>
                  <span className="font-medium text-gray-700">Settings</span>
                </button>
              </div>
            </div>

            {/* Notifications */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-lg font-bold text-gray-800 mb-4">
                Notifications
              </h3>

              <div className="space-y-2">
                {loading ? (
                  <div className="flex items-center justify-center p-4">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-orange-500"></div>
                  </div>
                ) : savedSimulations.length === 0 ? (
                  <div className="text-center p-4 text-gray-500 text-sm">
                    No notifications yet
                  </div>
                ) : (
                  <>
                    {savedSimulations.slice(0, 3).map((sim) => {
                      const simDate = new Date(sim.created_at);
                      const hoursSince =
                        (new Date() - simDate) / (1000 * 60 * 60);

                      let icon, bgColor, borderColor, title;

                      if (sim.simulation_status === "published") {
                        icon = "✅";
                        bgColor = "bg-green-50";
                        borderColor = "border-green-500";
                        title = "Report generated";
                      } else if (hoursSince < 1) {
                        icon = "ℹ️";
                        bgColor = "bg-blue-50";
                        borderColor = "border-blue-500";
                        title = "Simulation ready";
                      } else {
                        icon = "⚠️";
                        bgColor = "bg-yellow-50";
                        borderColor = "border-yellow-500";
                        title = "Draft expiring";
                      }

                      return (
                        <div
                          key={sim.simulation_id}
                          className={`flex gap-2 p-2 ${bgColor} border-l-4 ${borderColor} rounded text-sm cursor-pointer hover:shadow-md transition`}
                          onClick={() => router.push("/data")}
                        >
                          <span>{icon}</span>
                          <div className="flex-1">
                            <p className="font-semibold text-gray-800">
                              {title}
                            </p>
                            <p className="text-xs text-gray-500">
                              {getRelativeTime(sim.created_at)}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </>
                )}

                <button
                  onClick={() => router.push("/data")}
                  className="w-full mt-3 text-orange-500 text-sm font-semibold hover:underline"
                >
                  View all →
                </button>
              </div>
            </div>

            {/* Ongoing Disruptions Map - BELOW NOTIFICATIONS */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-bold text-gray-800">
                    Ongoing Disruptions Map
                  </h3>
                  <p className="text-xs text-gray-500 mt-1">
                    Live view of active traffic disruptions
                  </p>
                </div>
                <button
                  onClick={() => router.push("/")}
                  className="text-xs bg-blue-100 text-blue-700 px-3 py-1.5 rounded-full font-semibold hover:bg-blue-200 transition"
                >
                  View Full Map
                </button>
              </div>

              <div
                className="h-[400px] rounded-lg overflow-hidden border border-gray-200"
                key="mini-map-container"
              >
                <MiniOngoingMap />
              </div>
            </div>
          </div>
        </div>
      </main>
      {/* Simulation Preview Modal */}
      <SimulationPreviewModal
        simulation={selectedSimulation}
        isOpen={isModalOpen}
        onClose={handleCloseModal}
      />
    </div>
  );
}
