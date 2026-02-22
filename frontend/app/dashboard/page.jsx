"use client";

import PlannerNavbar from "@/components/PlannerNavBar";
import SimulationPreviewModal from "@/components/SimulationPreviewModal";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import PublishReportModal from '@/components/PublishReportModal';
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
        `https://api.urbanflowph.com/api/published-disruptions`
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
      console.log("Active disruption:", disruption.title);
      return "active";
    }
    if (start > now && start <= weekFromNow) {
      console.log("Upcoming disruption:", disruption.title);
      return "upcoming";
    }
    if (end < now) {
      console.log("Past disruption:", disruption.title);
      return "past";
    }

    console.log("Future disruption:", disruption.title);
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
    console.log("Drawing disruptions:", disruptions.length);
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
          "Mini Map - Disruption missing coordinates:",
          disruption.title
        );
        return;
      }

      console.log(
        "Mini Map - Drawing:",
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

// ✅ ADD THESE HELPER FUNCTIONS HERE (before "export default function DashboardPage()")

  // Parse UTC timestamps (now they should have 'Z' from backend)
  const parseUTCDate = (dateString) => {
    if (!dateString) return new Date();
    return new Date(dateString);
  };

  const formatManilaTime = (dateString) => {
    const date = parseUTCDate(dateString);
    return date.toLocaleString('en-PH', {
      timeZone: 'Asia/Manila',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });
  };

  const getRelativeTimeFromUTC = (dateString) => {
    const reportDate = parseUTCDate(dateString);
    const now = new Date();
    
    const minutesOld = Math.floor((now - reportDate) / (1000 * 60));
    const hoursOld = Math.floor(minutesOld / 60);
    const daysOld = Math.floor(hoursOld / 24);
    
    if (minutesOld < 1) return '🔴 Just now';
    if (minutesOld < 5) return `${minutesOld} min ago 🔴`;
    if (minutesOld < 60) return `${minutesOld} min ago`;
    if (hoursOld < 24) return `${hoursOld}h ago`;
    return `${daysOld}d ago`;
  };

export default function DashboardPage() {
  const router = useRouter();
  const { user, loading: authLoading, isAuthenticated } = useAuth();
  const userId = user?.user_id || user?.id;
  const heatmapScrollRef = useRef(null);
  const [activeTab, setActiveTab] = useState("overview");

  // Add these new state variables for the modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedSimulation, setSelectedSimulation] = useState(null);

  const [notifications, setNotifications] = useState([]);
  const [publicReports, setPublicReports] = useState([]);
  const [activePopup, setActivePopup] = useState(null);
  const [viewedReports, setViewedReports] = useState(new Set());
  const [publishingReport, setPublishingReport] = useState(null);
  const [selectedReport, setSelectedReport] = useState(null);
 
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

// Daily trend data (24 hours)
const [dailyTrend, setDailyTrend] = useState(
  Array.from({ length: 24 }, (_, hour) => ({
    hour: hour < 12 ? `${hour === 0 ? 12 : hour}AM` : `${hour === 12 ? 12 : hour - 12}PM`,
    level: 0,
  }))
);

const [weeklyTrend, setWeeklyTrend] = useState([
  { day: 'Sun', level: 0, value: 0 },
  { day: 'Mon', level: 0, value: 0 },
  { day: 'Tue', level: 0, value: 0 },
  { day: 'Wed', level: 0, value: 0 },
  { day: 'Thu', level: 0, value: 0 },
  { day: 'Fri', level: 0, value: 0 },
  { day: 'Sat', level: 0, value: 0 },
]);

const [trendView, setTrendView] = useState("weekly"); // 'weekly' or 'daily'

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
      const response = await fetch( `https://api.urbanflowph.com/api/health`);
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
      // - Your own backend endpoint: http://  `${process.env.next_public_api_url}/api/traffic-status

      const response = await fetch(
        `https://api.urbanflowph.com/api/traffic-status?road=${encodeURIComponent(
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
      "Fixed top 3 areas:",
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
                    `https://api.urbanflowph.com/api/traffic-status?area=${encodeURIComponent(
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

// Calculate Weekly Trend (day-by-day aggregation)
const calculateWeeklyTrend = () => {
  if (!savedSimulations || savedSimulations.length === 0) {
    // Return structure with 0s instead of nulls so line curves through all days
    return [
      { day: 'Sun', level: 0, value: 0 },
      { day: 'Mon', level: 0, value: 0 },
      { day: 'Tue', level: 0, value: 0 },
      { day: 'Wed', level: 0, value: 0 },
      { day: 'Thu', level: 0, value: 0 },
      { day: 'Fri', level: 0, value: 0 },
      { day: 'Sat', level: 0, value: 0 },
    ];
  }

  // Group simulations by day of week
  const dayGroups = {
    0: [], // Sunday
    1: [], // Monday
    2: [], // Tuesday
    3: [], // Wednesday
    4: [], // Thursday
    5: [], // Friday
    6: [], // Saturday
  };

  savedSimulations.forEach((sim) => {
    if (!sim || !sim.created_at) return;
    const val = Number(sim.average_delay_ratio);
    if (!Number.isFinite(val)) return; // skip invalid values
    const date = new Date(sim.created_at);
    const dayOfWeek = date.getDay();
    dayGroups[dayOfWeek].push(val);
  });

  // Calculate average for each day
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const result = dayNames.map((day, index) => {
    const values = dayGroups[index];
    if (!values || values.length === 0) {
      // Use 0 instead of null so the line curves through all days
      return { day, level: 0, value: 0 };
    }
    const avg = values.reduce((sum, val) => sum + val, 0) / values.length;
    const rounded = parseFloat(avg.toFixed(2));
    return { day, level: rounded, value: rounded };
  });

  // Debugging aid: log weekly computation
  // eslint-disable-next-line no-console
  console.log("Weekly trend computed:", { totalSimulations: savedSimulations.length, result });

  return result;
};

  // Add this function in page.jsx, before fetchDashboardData
  // Calculate Daily (Hourly) Trend from heatmap data
  const calculateDailyTrend = () => {
    // Reuse heatmap data which already has hourly predictions
    if (!heatmapData || !heatmapData.roads || heatmapData.roads.length === 0) {
      // Return empty 24-hour structure if no data
      return Array.from({ length: 24 }, (_, hour) => ({
        hour: hour < 12 ? `${hour === 0 ? 12 : hour}AM` : `${hour === 12 ? 12 : hour - 12}PM`,
        level: 0,
      }));
    }

    // Average all roads' hourly values to get overall daily trend
    const hourlyAverages = Array.from({ length: 24 }, (_, hourIndex) => {
      const values = heatmapData.roads
        .map((road) => road.values[hourIndex])
        .filter((val) => val !== undefined && val !== null);

      const avg = values.length > 0 ? values.reduce((sum, val) => sum + val, 0) / values.length : 0;

      return {
        hour: hourIndex < 12 ? `${hourIndex === 0 ? 12 : hourIndex}AM` : `${hourIndex === 12 ? 12 : hourIndex - 12}PM`,
        level: parseFloat(avg.toFixed(2)),
      };
    });

    return hourlyAverages;
  };

// Update both daily and weekly trends when data changes
useEffect(() => {
  if (heatmapData && heatmapData.roads && heatmapData.roads.length > 0) {
    const dailyData = calculateDailyTrend();
    setDailyTrend(dailyData);
    console.log("Daily trend updated:", dailyData);
  }
  
  if (savedSimulations && savedSimulations.length > 0) {
    const weeklyData = calculateWeeklyTrend();
    setWeeklyTrend(weeklyData);
    console.log("Weekly trend updated:", weeklyData);
  }
}, [heatmapData, savedSimulations]);


  // Fetch public reports
  const fetchPublicReports = async () => {
    try {
      console.log('Fetching reports from:', `https://api.urbanflowph.com/api/public-reports`);
      
      const response = await fetch(`https://api.urbanflowph.com/api/public-reports`);
      console.log('Response status:', response.status);
      
      const data = await response.json();
      console.log('Full response data:', data);
      
      if (data.success) {
        console.log('Total reports from API:', data.data.length);
        
        // ✅ STEP 1: Filter by status (exclude dismissed and resolved)
        let activeReports = data.data.filter(r => 
          r.status !== 'dismissed' && r.status !== 'resolved'
        );
        
        console.log(`After status filter: ${activeReports.length} reports`);
        
        // ✅ STEP 2: Filter out reports older than 2 days
        const now = new Date();
        const twoDaysAgo = new Date(now.getTime() - (2 * 24 * 60 * 60 * 1000));
        
        activeReports = activeReports.filter(r => {
          const reportDate = new Date(r.reported_at);
          const isRecent = reportDate > twoDaysAgo;
          
          if (!isRecent) {
            console.log(`Filtering out expired report (>2 days): ${r.id}`);
          }
          
          return isRecent;
        });
      
      console.log(`After date filter: ${activeReports.length} reports (removed reports older than 2 days)`);
      
      console.log(`After status filter: ${activeReports.length} reports`);
      
      // ✅ STEP 2: Also filter out any reports we've marked as resolved locally
      // (in case backend hasn't propagated yet)
      activeReports = activeReports.filter(r => {
        // If we've marked this report as resolved, exclude it
        const wasResolved = viewedReports.has(`resolved_${r.id}`);
        if (wasResolved) {
          console.log(`Filtering out locally-resolved report: ${r.id}`);
        }
        return !wasResolved;
      });
      
      console.log(`✅ Final active reports: ${activeReports.length}`);
        // Only check for new reports if we already have reports loaded
        if (publicReports.length > 0) {
          const oldReportIds = publicReports.map(r => r.id);
          const trulyNewReports = activeReports.filter(r => 
            r.status === 'pending' && 
            !oldReportIds.includes(r.id) && 
            !viewedReports.has(r.id)
          );
          
          if (trulyNewReports.length > 0) {
            trulyNewReports.forEach(report => {
              showNotification(`New ${report.report_type} report: ${report.description.substring(0, 40)}...`);
              setViewedReports(prev => new Set([...prev, report.id]));
            });
          }
        }
        
        setPublicReports(activeReports);
      }
    } catch (error) {
      console.error('Error fetching reports:', error);
    }
  };

  // Handle report actions
  const handlePublishReport = async (reportId, durationHours) => {
    try {
      console.log('Publishing report:', reportId, 'Duration:', durationHours);
      
      // ✅ FIX: Remove extra closing brace in URL
      const response = await fetch(`https://api.urbanflowph.com/api/public-reports/${reportId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'publish',
          duration_hours: durationHours
        })
      });
      
      console.log('Response status:', response.status);
      
      const data = await response.json();
      console.log('Response data:', data);
      
      if (response.ok && data.success) {
        // ✅ Immediately update local state with correct expiry time
        const expiresAt = new Date(Date.now() + durationHours * 60 * 60 * 1000).toISOString();
        
        setPublicReports(prev => prev.map(r => 
          r.id === reportId 
            ? {
                ...r, 
                status: 'published', 
                published_at: new Date().toISOString(), 
                expires_at: expiresAt
              } 
            : r
        ));
        
        // ✅ Mark as viewed so it doesn't trigger notification again
        setViewedReports(prev => new Set([...prev, reportId]));
        
        // ✅ Fetch fresh data after a brief delay
        setTimeout(() => fetchPublicReports(), 500);
        
        // ✅ Show success notification
        setActivePopup({ 
          type: 'success', 
          message: `Report published! Will expire in ${durationHours} hour${durationHours > 1 ? 's' : ''}.` 
        });
        
        // ✅ Auto-hide popup after 5 seconds
        setTimeout(() => {
          setActivePopup(null);
        }, 5000);
        
      } else {
        console.error('Publish failed:', data);
        
        // ✅ Better error notification
        setActivePopup({
          type: 'error',
          message: `Failed to publish: ${data.error || 'Unknown error'}`
        });
        
        setTimeout(() => {
          setActivePopup(null);
        }, 5000);
      }
      
    } catch (error) {
      console.error('Error publishing report:', error);
      
      // ✅ Better error notification instead of alert
      setActivePopup({
        type: 'error',
        message: 'Network error - Failed to publish report'
      });
      
      setTimeout(() => {
        setActivePopup(null);
      }, 5000);
    }
  };

  const handleResolveReport = async (reportId) => {
    try {
      console.log(`🔧 Resolving report ${reportId}...`);
      
      const response = await fetch(`https://api.urbanflowph.com/api/public-reports/${reportId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'resolve' })
      });
      
      const data = await response.json();
      console.log('Backend response:', data);
      
      if (response.ok && data.success) {
        console.log(`Backend confirmed resolution of report ${reportId}`);
        
        // ✅ STEP 1: Immediately remove from local state
        setPublicReports(prev => {
          const filtered = prev.filter(r => r.id !== reportId);
          console.log(`Reports after filter: ${filtered.length} (removed ID ${reportId})`);
          return filtered;
        });
        
        // ✅ STEP 2: Mark as viewed so it doesn't reappear
        setViewedReports(prev => {
          const updated = new Set([...prev, reportId]);
          console.log(`Marked report ${reportId} as viewed`);
          return updated;
        });
        
        // ✅ STEP 3: Wait 1 second, then re-fetch to confirm
        setTimeout(async () => {
          console.log('Re-fetching to verify removal...');
          await fetchPublicReports();
        }, 1000);
        
        // Show success message
        setActivePopup({ 
          type: 'success', 
          message: 'Report resolved and removed' 
        });
        setTimeout(() => setActivePopup(null), 3000);
        
      } else {
        console.error('Backend failed to resolve:', data);
        setActivePopup({ 
          type: 'error', 
          message: `Failed to resolve: ${data.error || 'Unknown error'}` 
        });
        setTimeout(() => setActivePopup(null), 3000);
      }
    } catch (error) {
      console.error('Error resolving report:', error);
      setActivePopup({ 
        type: 'error', 
        message: 'Network error - Failed to resolve report' 
      });
      setTimeout(() => setActivePopup(null), 3000);
    }
  };
    
  const showNotification = (message) => {
    console.log('Showing notification:', message);
    
    // ✅ Create and play audio BEFORE setting popup state
    try {
      const audio = new Audio('/notification.mp3');
      audio.volume = 0.5; // ✅ Set volume to 50%
      
      // ✅ Add user interaction check
      audio.play()
        .then(() => console.log('✅ Notification sound played'))
        .catch(e => {
          console.warn('Audio play blocked by browser - requires user interaction first');
          // ✅ Fallback: Browser beep (if supported)
          if (navigator.vibrate) {
            navigator.vibrate(200);
          }
        });
    } catch (e) {
      console.error('Notification sound error:', e);
    }
    
    // ✅ Show popup notification
    setActivePopup({ type: 'info', message });
    
    // ✅ Auto-hide after 5 seconds
    setTimeout(() => {
      setActivePopup(null);
    }, 5000);
  };

  // ============================================
  // FETCH DASHBOARD DATA
  // ============================================
  const fetchDashboardData = async () => {
    setLoading(true);
    setError(null);

    try {
      const savedResponse = await fetch(
        `https://api.urbanflowph.com/api/my-simulations?user_id=${userId}`
      );
      const savedData = await savedResponse.json();

      if (savedData.success) {
        setSavedSimulations(savedData.simulations);
        // Debug: show lightweight simulation summary to help diagnose weekly aggregation
        // eslint-disable-next-line no-console
        console.log('Loaded saved simulations (summary):', savedData.simulations.map(s => ({ simulation_id: s.simulation_id, created_at: s.created_at, avg: s.average_delay_ratio })));

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

        // Calculate heatmap (24-hour) which will update `heatmapData`
        await calculateHeatmap(savedData.simulations);
        console.log("24-hour heatmap calculated");
      }

      const publishedResponse = await fetch(
        `https://api.urbanflowph.com/api/published-simulations`
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

  useEffect(() => {
    fetchPublicReports();
    
    // Poll for new reports every 30 seconds
    const interval = setInterval(fetchPublicReports, 30000);
    return () => clearInterval(interval);
  }, []);

  // ✅ Auto-cleanup expired reports (older than 2 days)
  useEffect(() => {
    const cleanupExpiredReports = () => {
      const now = new Date();
      const twoDaysAgo = new Date(now.getTime() - (2 * 24 * 60 * 60 * 1000));
      
      setPublicReports(prev => 
        prev.filter(report => {
          const reportDate = new Date(report.reported_at);
          return reportDate > twoDaysAgo;
        })
      );
    };
    
    // Run cleanup every hour
    const interval = setInterval(cleanupExpiredReports, 60 * 60 * 1000);
    
    // Run once on mount
    cleanupExpiredReports();
    
    return () => clearInterval(interval);
  }, []);

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
                Welcome back to your dashboard.
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

            {/* Weekly/Daily Trend Toggle */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-bold text-gray-800">
                  {trendView === 'weekly' ? 'Weekly Trend' : 'Daily Trend'}
                </h2>
                
                {/* Toggle Switch */}
                <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-1">
                  <button
                    onClick={() => setTrendView('weekly')}
                    className={`px-4 py-2 rounded-md text-sm font-semibold transition-all ${
                      trendView === 'weekly'
                        ? 'bg-orange-500 text-white shadow-sm'
                        : 'text-gray-600 hover:text-gray-800'
                    }`}
                  >
                    Weekly
                  </button>
                  <button
                    onClick={() => setTrendView('daily')}
                    className={`px-4 py-2 rounded-md text-sm font-semibold transition-all ${
                      trendView === 'daily'
                        ? 'bg-orange-500 text-white shadow-sm'
                        : 'text-gray-600 hover:text-gray-800'
                    }`}
                  >
                    Daily
                  </button>
                </div>
              </div>

              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={trendView === 'weekly' ? weeklyTrend : dailyTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis
                    dataKey={trendView === 'weekly' ? 'day' : 'hour'}
                    interval={trendView === 'weekly' ? 0 : 2}
                    height={50}
                    tick={(props) => {
                      const { x, y, payload } = props;
                      // Force "Saturday" to display as "Sat"
                      const displayValue = payload.value === 'Sa' ? 'Sat' : payload.value;
                      return (
                        <text
                          x={x}
                          y={y + 15}
                          textAnchor="middle"
                          fill="#6b7280"
                          fontSize={11}
                        >
                          {displayValue}
                        </text>
                      );
                    }}
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
                    labelFormatter={(label) => 
                      trendView === 'weekly' ? `Day: ${label}` : `Time: ${label}`
                    }
                  />
                  <Line
                    type="monotone"
                    dataKey={trendView === 'weekly' ? 'value' : 'level'}
                    stroke="#f97316"
                    strokeWidth={2}
                    dot={{ fill: "#f97316", r: 4 }}
                    connectNulls={false}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
              
              <p className="text-xs text-gray-500 text-center mt-2">
                {loading ? (
                  "Loading..."
                ) : trendView === 'weekly' ? (
                  `Based on ${savedSimulations.length} simulation${savedSimulations.length !== 1 ? 's' : ''}`
                ) : (
                  heatmapData.roads.length === 0
                    ? "No data yet - hourly predictions will appear here"
                    : "24-hour traffic pattern based on current predictions"
                )}
              </p>
            </div>
          </div>

          {/* Right Sidebar */}
          <div className="col-span-12 lg:col-span-4 space-y-6">
            
          {/* ============================================================ */}
          {/* PUBLIC REPORTS PREVIEW - FIXED VERSION */}
          {/* ============================================================ */}
          <div className="bg-white rounded-lg shadow p-6">
           <div className="flex justify-between items-center mb-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-800">Public Reports</h2>
              <p className="text-xs text-gray-500 mt-1">
                {publicReports.length === 0 
                  ? 'No active reports' 
                  : `${publicReports.length} active report${publicReports.length !== 1 ? 's' : ''} • Auto-expire after 2 days`
                }
              </p>
            </div>
            <div className="flex gap-2">
              {(() => {
                const pendingCount = publicReports.filter(r => r.status === 'pending').length;
                const publishedCount = publicReports.filter(r => r.status === 'published').length;
                
                return (
                  <>
                    {pendingCount > 0 && (
                      <span className="bg-red-100 text-red-600 text-xs px-2 py-1 rounded-full font-semibold animate-pulse">
                        {pendingCount} New
                      </span>
                    )}
                    {publishedCount > 0 && (
                      <span className="bg-green-100 text-green-600 text-xs px-2 py-1 rounded-full font-semibold">
                        {publishedCount} Published
                      </span>
                    )}
                  </>
                );
              })()}
            </div>
          </div>
               
            
            <div className="space-y-3 max-h-[500px] overflow-y-auto">
              {publicReports.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-sm text-gray-500">No public reports</p>
                  <p className="text-xs text-gray-400 mt-1">Reports will appear here when submitted</p>
                </div>
              ) : (
                publicReports.map((report) => {
                  // ✅ Calculate report age
                  // ✅ Convert both dates to Manila time for accurate comparison
                  const reportDate = new Date(report.reported_at);
                  const now = new Date();

                  // Calculate hours old using UTC timestamps (accurate regardless of timezone)
                  const hoursOld = Math.floor((now.getTime() - reportDate.getTime()) / (1000 * 60 * 60));
                  const daysOld = Math.floor(hoursOld / 24);

                  // ✅ For "just now" detection, use minutes
                  const minutesOld = Math.floor((now.getTime() - reportDate.getTime()) / (1000 * 60));
                  
                  // ✅ Hide if older than 2 days
                  if (daysOld >= 2) return null;
                  
                  const timeRemaining = 48 - hoursOld; // Hours until expiry
                  
                  return (
                    <div 
                      key={report.id} 
                      className="bg-gray-50 border border-gray-200 rounded-lg p-3 hover:bg-gray-100 transition"
                    >
                      <div className="flex items-start gap-3 mb-3 text-gray-700">
                        <span className="text-xl">
                          {report.report_type === 'accident' ? '⛐' :
                          report.report_type === 'flooding' ? '⛈' :
                          report.report_type === 'roadwork' ? '🛠' : '⚠︎'}
                        </span>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className="text-sm font-semibold capitalize">
                              {report.report_type}
                            </span>
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                              report.severity === 'severe' ? 'bg-red-100 text-red-700' :
                              report.severity === 'moderate' ? 'bg-yellow-100 text-yellow-700' :
                              'bg-blue-100 text-blue-700'
                            }`}>
                              {report.severity}
                            </span>
                            {report.status === 'published' && (
                              <span className="px-2 py-0.5 rounded text-xs font-bold bg-green-100 text-green-700">
                                ✓ Published
                              </span>
                            )}
                            {report.status === 'resolved' && (
                              <span className="px-2 py-0.5 rounded text-xs font-bold bg-gray-100 text-gray-600">
                                ✓ Resolved
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-600 line-clamp-2">
                            {report.description}
                          </p>
                          <p className="text-xs text-gray-400 mt-1">
                            {/* ✅ Show "Just now" if less than 5 minutes old */}
                            {minutesOld < 5 ? (
                              <span className="text-green-600 font-semibold">Just now 🔴</span>
                            ) : minutesOld < 60 ? (
                              <span>{minutesOld} min ago</span>
                            ) : hoursOld < 24 ? (
                              <span>{hoursOld}h ago</span>
                            ) : (
                              new Date(report.reported_at).toLocaleString('en-PH', {
                                timeZone: 'Asia/Manila',
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                                hour12: true
                              })
                            )}
                            {timeRemaining > 0 && timeRemaining <= 48 && (
                              <span className="ml-2 text-orange-600 font-medium">
                                • Expires in {timeRemaining}h
                              </span>
                            )}
                          </p>
                        </div>
                      </div>
                      
                     {/* ✅ SIMPLIFIED: Action Buttons - Resolve Only */}
                      <div className="flex gap-2">
                        {/* Pending Status Buttons */}
                        {report.status === 'pending' && (
                          <>
                            <button
                              onClick={() => {
                                setSelectedReport(report);
                                setViewedReports(prev => new Set([...prev, report.id]));
                              }}
                              className="flex-1 border border-gray-300 text-gray-700 hover:bg-gray-300 text-xs py-2 rounded hover:bg-gray-50 transition font-medium"
                            >
                              Review
                            </button>
                            <button
                              onClick={() => {
                                handlePublishReport(report.id, 12);
                                setViewedReports(prev => new Set([...prev, report.id]));
                              }}
                              className="flex-1 bg-orange-500 text-white text-xs py-2 rounded hover:bg-orange-700 transition font-medium"
                            >
                              Publish
                            </button>
                          </>
                        )}
                        
                        {/* Published Status Button */}
                        {report.status === 'published' && (
                          <button
                            onClick={() => {
                              setSelectedReport(report);
                              setViewedReports(prev => new Set([...prev, report.id]));
                            }}
                            className="flex-1 border border-gray-300 text-gray-700 hover:bg-gray-300 text-xs py-2 rounded transition font-medium"
                          >
                            View Details
                          </button>
                        )}
                        
                        {/* ✅ SINGLE RESOLVE BUTTON - Removes completely */}
                        {(report.status === 'pending' || report.status === 'published') && (
                          <button
                            onClick={() => {
                              if (confirm('Mark as resolved? This will remove the report from dashboard and map.')) {
                                handleResolveReport(report.id);
                                setViewedReports(prev => new Set([...prev, report.id]));
                              }
                            }}
                            className="border border-[#4285F4] text-gray-700 hover:bg-[#4285F4] hover:text-[#ffffff] text-xs px-4 py-2 rounded transition font-medium"
                            title="Mark as resolved and remove"
                          >
                            ✓ Resolve
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
               
              {publicReports.length > 3 && (
                <button
                  onClick={() => setShowReportsModal(true)}
                  className="w-full mt-3 bg-gray-100 text-gray-700 text-sm py-2 rounded hover:bg-gray-200 transition font-semibold"
                >
                  View All {publicReports.length} Reports →
                </button>
              )}
            </div>
           

            {/* Notifications */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h3 className="text-lg font-bold text-gray-800">Notifications</h3>
                  <p className="text-xs text-gray-500 mt-1">
                    Important alerts and updates
                  </p>
                </div>
                
                {/* Clear All Button */}
                {(() => {
                  const hasNotifications = (
                    publicReports.filter(r => r.status === 'pending' && !viewedReports.has(r.id)).length > 0 ||
                    savedSimulations.some(sim => {
                      const endDate = new Date(sim.end_time);
                      const hoursUntilEnd = (endDate - new Date()) / (1000 * 60 * 60);
                      return hoursUntilEnd > 0 && hoursUntilEnd <= 24 && sim.simulation_status === 'published';
                    }) ||
                    savedSimulations.some(sim => {
                      const endDate = new Date(sim.end_time);
                      const hoursUntilEnd = (endDate - new Date()) / (1000 * 60 * 60);
                      return hoursUntilEnd > 0 && hoursUntilEnd <= 12 && sim.simulation_status === 'completed';
                    })
                  );
                  
                  return hasNotifications ? (
                    <button
                      onClick={() => {
                        const allReportIds = publicReports.map(r => r.id);
                        const allSimIds = savedSimulations.map(s => `sim_${s.simulation_id}`);
                        setViewedReports(prev => new Set([...prev, ...allReportIds, ...allSimIds]));
                        
                        setActivePopup({ 
                          type: 'success', 
                          message: 'All notifications cleared' 
                        });
                        setTimeout(() => setActivePopup(null), 2000);
                      }}
                      className="text-xs text-gray-500 hover:text-gray-700 font-medium transition flex items-center gap-1.5"
                      title="Clear all notifications"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      <span>Clear All</span>
                    </button>
                  ) : null;
                })()}
              </div>

              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {loading ? (
                  <div className="flex items-center justify-center p-4">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-orange-500"></div>
                  </div>
                ) : (
                  <>
                    {(() => {
                      const notifications = [];
                      
                      // ============================================
                      // 1. NEW PUBLIC REPORTS (Highest Priority)
                      // ============================================
                      publicReports
                        .filter(r => r.status === 'pending' && !viewedReports.has(r.id))
                        .slice(0, 3)
                        .forEach((report) => {
                          const reportDate = new Date(report.reported_at);
                          const minutesOld = Math.floor((new Date() - reportDate) / (1000 * 60));
                          
                          notifications.push({
                            id: `report-${report.id}`,
                            priority: 1,
                            type: 'alert',
                            color: 'red',
                            title: `New Public Report: ${report.report_type}`,
                            subtitle: minutesOld < 5 ? 'Just now' : `${minutesOld < 60 ? minutesOld + ' min' : Math.floor(minutesOld/60) + 'h'} ago`,
                            time: reportDate,
                            isUrgent: minutesOld < 5,
                            onClick: () => setSelectedReport(report)
                          });
                        });
                      
                      // ============================================
                      // 2. ACTIVE DISRUPTIONS ENDING SOON (< 24h)
                      // ============================================
                      savedSimulations
                        .filter(sim => {
                          if (sim.simulation_status !== 'published') return false;
                          if (viewedReports.has(`sim_${sim.simulation_id}`)) return false;
                          
                          const endDate = new Date(sim.end_time);
                          const hoursUntilEnd = (endDate - new Date()) / (1000 * 60 * 60);
                          
                          return hoursUntilEnd > 0 && hoursUntilEnd <= 24;
                        })
                        .forEach((sim) => {
                          const endDate = new Date(sim.end_time);
                          const hoursUntilEnd = Math.floor((endDate - new Date()) / (1000 * 60 * 60));
                          
                          notifications.push({
                            id: `ending-${sim.simulation_id}`,
                            priority: 2,
                            type: 'clock',
                            color: 'orange',
                            title: 'Published disruption ending soon',
                            subtitle: `${sim.simulation_name || 'Unnamed'} • Ends in ${hoursUntilEnd}h`,
                            time: endDate,
                            isUrgent: hoursUntilEnd <= 6,
                            onClick: () => handleOpenPreview(sim)
                          });
                        });
                      
                      // ============================================
                      // 3. UNPUBLISHED SIMULATIONS ENDING SOON (< 12h)
                      // ============================================
                      savedSimulations
                        .filter(sim => {
                          if (sim.simulation_status !== 'completed') return false;
                          if (viewedReports.has(`sim_unpub_${sim.simulation_id}`)) return false;
                          
                          const endDate = new Date(sim.end_time);
                          const hoursUntilEnd = (endDate - new Date()) / (1000 * 60 * 60);
                          
                          return hoursUntilEnd > 0 && hoursUntilEnd <= 12;
                        })
                        .forEach((sim) => {
                          const endDate = new Date(sim.end_time);
                          const hoursUntilEnd = Math.floor((endDate - new Date()) / (1000 * 60 * 60));
                          
                          notifications.push({
                            id: `unpublished-${sim.simulation_id}`,
                            priority: 3,
                            type: 'warning',
                            color: 'yellow',
                            title: 'Simulation ending soon - not published',
                            subtitle: `${sim.simulation_name || 'Unnamed'} • Ends in ${hoursUntilEnd}h`,
                            time: endDate,
                            isUrgent: hoursUntilEnd <= 3,
                            onClick: () => handleOpenPreview(sim)
                          });
                        });
                      
                      // ============================================
                      // 4. HIGH TRAFFIC ALERT (Current hour)
                      // ============================================
                      if (heatmapData.roads.length > 0) {
                        const currentHour = new Date().getHours();
                        const heavyRoads = heatmapData.roads.filter(road => {
                          const currentValue = road.values[currentHour];
                          return currentValue >= 2.5; // Heavy congestion threshold
                        });
                        
                        if (heavyRoads.length > 0 && !viewedReports.has(`traffic_${currentHour}`)) {
                          notifications.push({
                            id: `traffic-${currentHour}`,
                            priority: 2,
                            type: 'traffic',
                            color: 'red',
                            title: 'Heavy traffic detected now',
                            subtitle: `${heavyRoads.length} road${heavyRoads.length > 1 ? 's' : ''}: ${heavyRoads.map(r => r.name).join(', ')}`,
                            time: new Date(),
                            isUrgent: true,
                            onClick: () => scrollToCurrentHour()
                          });
                        }
                      }
                      
                      // ============================================
                      // 5. RECENTLY PUBLISHED SUCCESS (< 1 hour)
                      // ============================================
                      savedSimulations
                        .filter(sim => {
                          if (sim.simulation_status !== 'published') return false;
                          if (viewedReports.has(`published_${sim.simulation_id}`)) return false;
                          
                          const publishedDate = new Date(sim.updated_at || sim.created_at);
                          const hoursAgo = (new Date() - publishedDate) / (1000 * 60 * 60);
                          
                          return hoursAgo <= 1;
                        })
                        .slice(0, 2)
                        .forEach((sim) => {
                          const publishedDate = new Date(sim.updated_at || sim.created_at);
                          const minutesAgo = Math.floor((new Date() - publishedDate) / (1000 * 60));
                          
                          notifications.push({
                            id: `published-${sim.simulation_id}`,
                            priority: 4,
                            type: 'success',
                            color: 'green',
                            title: 'Simulation published successfully',
                            subtitle: `${sim.simulation_name || 'Unnamed'} • ${minutesAgo}m ago`,
                            time: publishedDate,
                            isUrgent: false,
                            onClick: () => handleOpenPreview(sim)
                          });
                        });
                      
                      // ============================================
                      // SORT BY PRIORITY & RENDER
                      // ============================================
                      notifications.sort((a, b) => {
                        if (a.priority !== b.priority) return a.priority - b.priority;
                        return b.time - a.time;
                      });
                      
                      if (notifications.length === 0) {
                        return (
                          <div className="text-center py-8">
                            <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-green-100 flex items-center justify-center">
                              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                            </div>
                            <p className="text-sm text-gray-600 font-medium">All clear!</p>
                            <p className="text-xs text-gray-400 mt-1">No urgent notifications</p>
                          </div>
                        );
                      }
                      
                      return notifications.map((notif) => {
                        // Icon components based on type
                        const icons = {
                          alert: (
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                          ),
                          clock: (
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          ),
                          warning: (
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                          ),
                          traffic: (
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                          ),
                          success: (
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          )
                        };
                        
                        // Color schemes
                        const colorSchemes = {
                          red: {
                            bg: 'bg-red-50',
                            iconBg: 'bg-red-100',
                            iconColor: 'text-red-600',
                            border: 'border-red-200',
                            hoverBg: 'hover:bg-red-100'
                          },
                          orange: {
                            bg: 'bg-orange-50',
                            iconBg: 'bg-orange-100',
                            iconColor: 'text-orange-600',
                            border: 'border-orange-200',
                            hoverBg: 'hover:bg-orange-100'
                          },
                          yellow: {
                            bg: 'bg-yellow-50',
                            iconBg: 'bg-yellow-100',
                            iconColor: 'text-yellow-600',
                            border: 'border-yellow-200',
                            hoverBg: 'hover:bg-yellow-100'
                          },
                          green: {
                            bg: 'bg-green-50',
                            iconBg: 'bg-green-100',
                            iconColor: 'text-green-600',
                            border: 'border-green-200',
                            hoverBg: 'hover:bg-green-100'
                          }
                        };
                        
                        const scheme = colorSchemes[notif.color];
                        
                        return (
                          <div
                            key={notif.id}
                            className={`flex gap-3 p-3 ${scheme.bg} border ${scheme.border} rounded-lg cursor-pointer ${scheme.hoverBg} transition-all duration-200 group relative`}
                            onClick={notif.onClick}
                          >
                            {/* Icon Badge */}
                            <div className={`flex-shrink-0 w-10 h-10 ${scheme.iconBg} rounded-lg flex items-center justify-center ${scheme.iconColor}`}>
                              {icons[notif.type]}
                            </div>
                            
                            {/* Content */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-2">
                                <p className="font-semibold text-gray-800 text-sm leading-tight">
                                  {notif.title}
                                </p>
                                {notif.isUrgent && (
                                  <span className="flex-shrink-0 w-2 h-2 bg-red-500 rounded-full animate-pulse" title="Urgent"></span>
                                )}
                              </div>
                              <p className="text-xs text-gray-600 mt-1 truncate">
                                {notif.subtitle}
                              </p>
                            </div>
                            
                            {/* Dismiss Button */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setViewedReports(prev => new Set([...prev, notif.id]));
                              }}
                              className="flex-shrink-0 w-6 h-6 rounded-full hover:bg-white/50 flex items-center justify-center text-gray-400 hover:text-gray-600 opacity-0 group-hover:opacity-100 transition-all"
                              title="Dismiss"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                        );
                      });
                    })()}
                  </>
                )}
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


       {/* ✅ MINIMAL PROFESSIONAL MODAL */}
        {selectedReport && (
          <div className="fixed inset-0 z-[10001] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div 
              className="absolute inset-0 bg-black/20 backdrop-blur-sm"
              onClick={() => setSelectedReport(null)}
            ></div>
            
            {/* Modal Content */}
            <div className="relative bg-white rounded-lg w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col shadow-xl border border-gray-200">
              
              {/* ✅ Minimal Header */}
              <div className="border-b border-gray-200 p-4 flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">
                    {selectedReport.report_type === 'accident' ? '⛐' :
                        selectedReport.report_type === 'flooding' ? '⛈' :
                        selectedReport.report_type === 'roadwork' ? '🛠' : '⚠︎'}
                  </span>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 capitalize">
                      {selectedReport.report_type}
                    </h3>
                  <p className="text-sm text-gray-500">
                    {(() => {
                      const reportDate = new Date(selectedReport.reported_at);
                      const now = new Date();
                      const minutesOld = Math.floor((now - reportDate) / (1000 * 60));
                      
                      if (minutesOld < 5) {
                        return '🔴 Just reported';
                      }
                      
                      return new Date(selectedReport.reported_at).toLocaleString('en-PH', {
                        timeZone: 'Asia/Manila',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: true
                      });
                    })()}
                  </p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedReport(null)}
                  className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
                >
                  ✕
                </button>
              </div>

              {/* ✅ Content - Scrollable */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                
                {/* Severity Badge */}
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-600">Severity:</span>
                  <span className={`px-3 py-1 rounded text-sm font-medium ${
                    selectedReport.severity === 'severe' ? 'bg-red-100 text-red-700' :
                    selectedReport.severity === 'moderate' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-blue-100 text-blue-700'
                  }`}>
                    {selectedReport.severity}
                  </span>
                </div>

                {/* Description */}
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 mb-2">Description</h4>
                  <p className="text-gray-800 leading-relaxed">
                    {selectedReport.description}
                  </p>
                </div>

                {/* Location */}
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 mb-2">📍 Location</h4>
                  <div className="bg-gray-50 rounded p-3 border border-gray-200">
                    <p className="font-mono text-sm text-gray-700">
                      {selectedReport.latitude.toFixed(6)}, {selectedReport.longitude.toFixed(6)}
                    </p>
                  </div>
                </div>

                {/* ✅ Minimal Map */}
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 mb-2">Map View</h4>
                  <iframe
                    width="100%"
                    height="200"
                    frameBorder="0"
                    src={`https://www.openstreetmap.org/export/embed.html?bbox=${selectedReport.longitude-0.005},${selectedReport.latitude-0.005},${selectedReport.longitude+0.005},${selectedReport.latitude+0.005}&layer=mapnik&marker=${selectedReport.latitude},${selectedReport.longitude}`}
                    className="rounded border border-gray-200"
                  ></iframe>
                </div>

                {/* Image */}
                {selectedReport.image_url && (
                  <div>
                    <h4 className="text-sm font-semibold text-gray-700 mb-2">📷 Photo Evidence</h4>
                      Debug URL: {selectedReport.image_url}

                    <img 
                      src={`https://api.urbanflowph.com${selectedReport.image_url}`}
                      alt="Report evidence"
                      className="w-full h-64 object-cover rounded border border-gray-200"
                    />
                  </div>
                )}

                {/* Reporter Info */}
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 mb-2">Reporter Information</h4>
                  <div className="bg-gray-50 rounded p-3 border border-gray-200 grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Name</p>
                      <p className="font-medium text-gray-900">
                        {selectedReport.reporter_name || 'Anonymous'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Reported At</p>
                      <p className="font-medium text-gray-900 text-sm">
                        {new Date(selectedReport.reported_at).toLocaleString('en-PH', {
                          timeZone: 'Asia/Manila',
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                          hour12: true
                        })}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* ✅ Minimal Footer Actions */}
              <div className="border-t border-gray-200 p-4 flex gap-3">
                {selectedReport.status === 'pending' && (
                  <button
                    onClick={() => {
                      handlePublishReport(selectedReport.id, 12);
                      setSelectedReport(null);
                    }}
                    className="flex-1 bg-blue-600 text-white px-4 py-2.5 rounded hover:bg-blue-700 transition font-medium"
                  >
                    📤 Publish (12h)
                  </button>
                )}
                <button
                  onClick={() => {
                    if (confirm('Mark as resolved? This will remove the report completely.')) {
                      handleResolveReport(selectedReport.id);
                      setSelectedReport(null);
                    }
                  }}
                  className="flex-1 border border-green-300 text-green-700 px-4 py-2.5 rounded hover:bg-green-50 transition font-medium"
                >
                  ✓ Resolve
                </button>
                <button
                  onClick={() => setSelectedReport(null)}
                  className="border border-gray-300 text-gray-700 px-4 py-2.5 rounded hover:bg-gray-50 transition font-medium"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
    </div>
  );
}
