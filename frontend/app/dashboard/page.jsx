"use client";

import PlannerNavbar from "@/components/PlannerNavbar";
import { useRouter } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export default function DashboardPage() {
  const router = useRouter();
  const heatmapScrollRef = useRef(null);

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
    roads: []
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

  // ============================================
  // BACKEND HEALTH CHECK
  // ============================================
  const checkBackendHealth = async () => {
    const startTime = Date.now();
    
    try {
      const response = await fetch('http://localhost:5000/api/health');
      const endTime = Date.now();
      const responseTime = endTime - startTime;
      
      if (response.ok) {
        setBackendStatus({
          ml_model: 'active',
          database: 'active',
          response_time: `${responseTime}ms`
        });
      } else {
        setBackendStatus({
          ml_model: 'error',
          database: 'error',
          response_time: 'N/A'
        });
      }
    } catch (err) {
      setBackendStatus({
        ml_model: 'error',
        database: 'error',
        response_time: 'N/A'
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
      // - Your own backend endpoint: http://localhost:5000/api/traffic-status
      
      const response = await fetch(
        `http://localhost:5000/api/traffic-status?road=${encodeURIComponent(roadName)}&hour=${hour}`
      );
      
      if (response.ok) {
        const data = await response.json();
        // Expected format: { congestion_level: 1.5, timestamp: "..." }
        return data.congestion_level || null;
      }
      return null;
    } catch (err) {
      console.log(`⚠️ Real-time traffic API not available for ${roadName} at ${hour}:00`);
      return null;
    }
  };

  // ============================================
  // CALCULATE HOURLY HEATMAP - ALL 24 HOURS
  // ============================================
  const calculateHeatmap = async (simulations) => {
    console.log("🔥 Calculating 24-hour heatmap from", simulations.length, "simulations");
    
    if (!simulations || simulations.length === 0) {
      console.log("⚠️ No simulations available");
      setHeatmapData({
        times: Array.from({ length: 24 }, (_, i) => `${i}:00`),
        roads: [
          { name: "No data yet", values: Array(24).fill(0) }
        ]
      });
      return;
    }

    // Count frequency of each road
    const roadFrequency = new Map();
    
    simulations.forEach(sim => {
      let roadName = sim.disruption_location;
      if (roadName) {
        roadName = roadName.split(' - ')[0].trim();
        roadName = roadName.split(',')[0].trim();
        roadFrequency.set(roadName, (roadFrequency.get(roadName) || 0) + 1);
      }
    });

    // Get top 3 roads
    let topRoads = Array.from(roadFrequency.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([name]) => name);

    console.log("📍 Top 3 roads:", topRoads);

    // Fallback to defaults if needed
    const defaultRoads = ['Bagong Kalsada', 'Parian Road', 'Makiling Road'];
    while (topRoads.length < 3) {
      const nextDefault = defaultRoads.find(road => !topRoads.includes(road));
      if (nextDefault) {
        topRoads.push(nextDefault);
      } else {
        break;
      }
    }

    const currentHour = new Date().getHours();
    
    // Generate ALL 24 hours (0-23)
    const allHours = Array.from({ length: 24 }, (_, i) => i);
    
    // Format time labels
    const timeLabels = allHours.map(h => {
      const isPast = h < currentHour;
      const isCurrent = h === currentHour;
      const isFuture = h > currentHour;
      
      let label;
      if (h === 0) label = "12AM";
      else if (h === 12) label = "12PM";
      else if (h < 12) label = `${h}AM`;
      else label = `${h - 12}PM`;
      
      if (isCurrent) label += " 🔴"; // Live indicator
      
      return label;
    });

    // Calculate values for each road across all 24 hours
    const roadData = await Promise.all(topRoads.map(async roadName => {
      const roadSims = simulations.filter(sim => 
        sim.disruption_location?.includes(roadName)
      );

      // Calculate base severity from simulations
      const validSeverities = roadSims
        .map(sim => sim.average_delay_ratio)
        .filter(val => val !== null && val !== undefined && !isNaN(val) && val > 0);
      
      const avgSeverity = validSeverities.length > 0
        ? validSeverities.reduce((sum, val) => sum + val, 0) / validSeverities.length
        : 1.5;

      console.log(`📊 ${roadName}: ${roadSims.length} sims, ${validSeverities.length} valid, avg: ${avgSeverity.toFixed(2)}`);

      // Generate values for all 24 hours
      const values = await Promise.all(allHours.map(async hour => {
        const isPast = hour < currentHour;
        const isCurrent = hour === currentHour;
        const isFuture = hour > currentHour;

        // Try to get real-time data for current and recent past hours
        let realTimeValue = null;
        if (isCurrent || (isPast && currentHour - hour <= 2)) {
          realTimeValue = await fetchRealTimeTraffic(roadName, hour);
        }

        // If we have real-time data, use it!
        if (realTimeValue !== null) {
          console.log(`✅ Real-time data for ${roadName} at ${hour}:00 = ${realTimeValue}`);
          return Math.max(0.5, Math.min(3.0, realTimeValue));
        }

        // Otherwise, calculate based on patterns
        let multiplier = 1.0;
        
        // Time-of-day patterns
        if (hour >= 7 && hour <= 9) multiplier = 1.5; // Morning rush
        else if (hour >= 17 && hour <= 19) multiplier = 1.6; // Evening rush
        else if (hour >= 12 && hour <= 14) multiplier = 1.2; // Lunch
        else if (hour >= 22 || hour <= 5) multiplier = 0.5; // Night
        else if (hour >= 10 && hour <= 11) multiplier = 1.1; // Mid-morning
        else if (hour >= 15 && hour <= 16) multiplier = 1.2; // Mid-afternoon
        else multiplier = 0.9; // Off-peak
        
        let value = avgSeverity * multiplier;
        
        // Boost current hour slightly
        if (isCurrent) {
          value *= 1.15;
        }
        
        return Math.max(0.5, Math.min(3.0, value));
      }));

      return {
        name: roadName,
        values: values
      };
    }));

    console.log("✅ 24-hour heatmap updated");

    setHeatmapData({
      times: timeLabels,
      roads: roadData
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
        behavior: 'smooth'
      });
    }
  };

  // ============================================
  // FETCH DASHBOARD DATA
  // ============================================
  const fetchDashboardData = async () => {
    setLoading(true);
    setError(null);

    try {
      const savedResponse = await fetch(
        "http://localhost:5000/api/my-simulations?user_id=2"
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
          .map(s => s.average_delay_ratio)
          .filter(val => val !== null && val !== undefined && !isNaN(val) && val > 0);
        
        const avgSeverity = validSeverities.length > 0
          ? validSeverities.reduce((sum, val) => sum + val, 0) / validSeverities.length
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

        console.log("🔄 Calculating 24-hour heatmap...");
        await calculateHeatmap(savedData.simulations);
      }

      const publishedResponse = await fetch(
        "http://localhost:5000/api/published-simulations"
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

  // ============================================
  // INITIAL LOAD & HOURLY REFRESH
  // ============================================
  useEffect(() => {
    fetchDashboardData();
    checkBackendHealth();
    setIsMounted(true);
    
    // Calculate time until next hour
    const now = new Date();
    const msUntilNextHour = (60 - now.getMinutes()) * 60 * 1000 - now.getSeconds() * 1000;
    
    console.log(`⏰ Next hourly refresh in ${Math.round(msUntilNextHour / 60000)} minutes`);
    
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
    if (!date) return 'Unknown';
    
    const now = new Date();
    const past = new Date(date);
    const diffMs = now - past;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
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
                Hello, <span style={{ color: "#F5820D" }}>John</span>
              </h1>
            </div>

            {/* Quick Actions */}
            <div className="mb-6">
              <h2 className="text-xl font-bold text-gray-800 mb-4">
                Quick Actions
              </h2>

              <div className="grid md:grid-cols-3 gap-4">
                {/* New Simulation */}
                <div className="rounded-xl p-6 shadow-lg hover:shadow-xl transition-shadow" style={{ background: 'linear-gradient(135deg, #F5820D 0%, #FFA611 100%)' }}>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-lg flex items-center justify-center">
                      <span className="text-2xl font-light text-white">+</span>
                    </div>
                    <h3 className="text-lg font-semibold text-white">New Simulation</h3>
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
                    <p className="text-xs text-white/80 mb-1">Saved Scenarios</p>
                    <p className="text-2xl font-bold text-white">
                      {loading ? "..." : stats.totalSaved}
                    </p>
                  </div>
                </div>

                {/* Saved Scenarios */}
                <div className="rounded-xl p-6 shadow-lg hover:shadow-xl transition-shadow" style={{ background: 'linear-gradient(150deg, #F5820D 0%, #FFA611 100%)' }}>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-lg flex items-center justify-center">
                      <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M17 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V7l-4-4zm-5 16c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34-3-3-3zm3-10H5V5h10v4z"/>
                      </svg>
                    </div>
                    <h3 className="text-lg font-semibold text-white">Saved Scenarios</h3>
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
                <div className="rounded-xl p-6 shadow-lg hover:shadow-xl transition-shadow" style={{ background: 'linear-gradient(190deg, #F5820D 0%, #FFA611 100%)' }}>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-lg flex items-center justify-center">
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <circle cx="12" cy="12" r="10"/>
                        <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
                      </svg>
                    </div>
                    <h3 className="text-lg font-semibold text-white">Published Results</h3>
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
                  onClick={() => router.push("/planner/saved-scenarios")}
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
                  {savedSimulations.slice(0, 3).map((sim) => (
                    <div
                      key={sim.simulation_id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition cursor-pointer"
                      onClick={() =>
                        router.push(`/planner/simulation/${sim.simulation_id}`)
                      }
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
                            router.push(
                              `/planner/simulation/${sim.simulation_id}`
                            );
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
                  onClick={() => router.push("/planner/saved-scenarios")}
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
                    Real-time tracking • Past hours fade • Current hour 🔴 • Future predictions
                  </p>
                </div>
                <button
                  onClick={scrollToCurrentHour}
                  className="text-xs bg-orange-100 text-orange-700 px-3 py-1.5 rounded-full font-semibold hover:bg-orange-200 transition"
                >
                  Jump to Now
                </button>
              </div>

              {/* Scrollable Heatmap Container */}
              <div 
                ref={heatmapScrollRef}
                className="overflow-x-auto overflow-y-visible pb-2"
                style={{ scrollBehavior: 'smooth' }}
              >
                {heatmapData.roads.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <p>Loading 24-hour data...</p>
                  </div>
                ) : (
                  <table className="text-xs w-max">
                    <thead>
                      <tr>
                        <th className="sticky left-0 bg-white z-10 text-left p-2 font-semibold text-gray-700 border-r border-gray-200">
                          Location
                        </th>
                        {heatmapData.times.map((time, idx) => {
                          const currentHour = new Date().getHours();
                          const isCurrent = time.includes('🔴');
                          const isPast = idx < currentHour;
                          const isFuture = idx > currentHour;
                          
                          return (
                            <th
                              key={idx}
                              className={`p-2 font-semibold text-center min-w-[60px] transition-opacity duration-500 ${
                                isCurrent 
                                  ? 'text-red-600 bg-red-50' 
                                  : isPast 
                                  ? 'text-gray-400 opacity-50' 
                                  : 'text-gray-700'
                              }`}
                            >
                              {time}
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
                            const isFuture = timeIdx > currentHour;
                            
                            // Calculate opacity based on how far in the past
                            let opacity = 1.0;
                            if (isPast) {
                              const hoursSince = currentHour - timeIdx;
                              opacity = Math.max(0.3, 1.0 - (hoursSince * 0.1));
                            }
                            
                            return (
                              <td key={timeIdx} className="p-1">
                                <div
                                  className={`h-12 w-12 rounded flex items-center justify-center text-white font-bold text-xs ${getCongestionColor(
                                    value
                                  )} hover:scale-110 transition-all cursor-pointer ${
                                    isCurrent ? 'ring-4 ring-red-400 animate-pulse' : ''
                                  }`}
                                  style={{ opacity }}
                                  title={`${road.name} at ${timeIdx}:00\n${getCongestionLabel(
                                    value
                                  )} (${value.toFixed(1)})\n${
                                    isPast ? '✓ Passed' : isCurrent ? '🔴 LIVE' : '📊 Predicted'
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
                    <span>Updates hourly • Last: {isMounted ? lastUpdate.toLocaleTimeString() : '--:--'}</span>
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
                {loading ? 'Loading...' : 
                 savedSimulations.length === 0 ? 'No data yet - create simulations to see trends' :
                 `Based on ${savedSimulations.length} simulation${savedSimulations.length > 1 ? 's' : ''}`
                }
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
                <div className={`flex items-center justify-between p-3 rounded-lg ${
                  backendStatus.ml_model === 'active' ? 'bg-green-50' : 'bg-red-50'
                }`}>
                  <div className="flex items-center gap-3">
                    <div className="text-2xl">🤖</div>
                    <div>
                      <p className="font-semibold text-gray-800">ML Model</p>
                      <p className="text-xs text-gray-600">Random Forest</p>
                    </div>
                  </div>
                  <span className={`px-2 py-1 text-white text-xs font-semibold rounded ${
                    backendStatus.ml_model === 'active' ? 'bg-green-500' : 'bg-red-500'
                  }`}>
                    {backendStatus.ml_model === 'active' ? 'Active' : 'Offline'}
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
                    {loading ? '...' : savedSimulations.length > 0 ? getRelativeTime(savedSimulations[0].created_at) : 'Never'}
                  </span>
                </div>

                <div className={`flex items-center justify-between p-3 rounded-lg ${
                  backendStatus.database === 'active' ? 'bg-green-50' : 'bg-red-50'
                }`}>
                  <div className="flex items-center gap-3">
                    <div className="text-2xl">⚡</div>
                    <div>
                      <p className="font-semibold text-gray-800">
                        Server Health
                      </p>
                      <p className="text-xs text-gray-600">Response time</p>
                    </div>
                  </div>
                  <span className={`text-sm font-semibold ${
                    backendStatus.database === 'active' ? 'text-green-600' : 'text-red-600'
                  }`}>
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
                <button className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition text-left">
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
                      const hoursSince = (new Date() - simDate) / (1000 * 60 * 60);
                      
                      let icon, bgColor, borderColor, title;
                      
                      if (sim.simulation_status === 'published') {
                        icon = '✅';
                        bgColor = 'bg-green-50';
                        borderColor = 'border-green-500';
                        title = 'Report generated';
                      } else if (hoursSince < 1) {
                        icon = 'ℹ️';
                        bgColor = 'bg-blue-50';
                        borderColor = 'border-blue-500';
                        title = 'Simulation ready';
                      } else {
                        icon = '⚠️';
                        bgColor = 'bg-yellow-50';
                        borderColor = 'border-yellow-500';
                        title = 'Draft expiring';
                      }

                      return (
                        <div 
                          key={sim.simulation_id}
                          className={`flex gap-2 p-2 ${bgColor} border-l-4 ${borderColor} rounded text-sm cursor-pointer hover:shadow-md transition`}
                          onClick={() => router.push('/data')}
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
                  onClick={() => router.push('/data')}
                  className="w-full mt-3 text-orange-500 text-sm font-semibold hover:underline"
                >
                  View all →
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}