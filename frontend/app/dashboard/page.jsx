"use client";

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import PlannerNavbar from '../../components/PlannerNavbar';
import { useAuth } from '../../src/contexts/AuthContext';

export default function DashboardPage() {
  const router = useRouter();
  const { user, loading: authLoading, isAuthenticated } = useAuth();
  const heatmapScrollRef = useRef(null);

  // State variables
  const [savedSimulations, setSavedSimulations] = useState([]);
  const [publishedSimulations, setPublishedSimulations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(new Date());

  // Backend status
  const [backendStatus, setBackendStatus] = useState({
    ml_model: 'checking',
    database: 'checking',
    response_time: 'N/A'
  });

  // Stats from database
  const [stats, setStats] = useState({
    totalSaved: 0,
    totalPublished: 0,
    activeDisruptions: 0,
    simulationsRun: 0,
    avgCongestion: "Loading...",
    avgCongestionValue: 0,
  });

  const [weeklyTrend, setWeeklyTrend] = useState([
    { day: "Mon", level: 0 },
    { day: "Tue", level: 0 },
    { day: "Wed", level: 0 },
    { day: "Thu", level: 0 },
    { day: "Fri", level: 0 },
    { day: "Sat", level: 0 },
    { day: "Sun", level: 0 },
  ]);

  // Heatmap data state - ALL 24 hours
  const [heatmapData, setHeatmapData] = useState({
    times: [],
    roads: []
  });

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [authLoading, isAuthenticated, router]);

  // Fetch data when user is loaded
  useEffect(() => {
    if (user?.id) {
      fetchDashboardData();
      checkBackendHealth();
    }
  }, [user]);

  // Backend health check
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

  // Fetch real-time traffic (placeholder)
  const fetchRealTimeTraffic = async (roadName, hour) => {
    try {
      const response = await fetch(
        `http://localhost:5000/api/traffic-status?road=${encodeURIComponent(roadName)}&hour=${hour}`
      );
      
      if (response.ok) {
        const data = await response.json();
        return data.congestion_level || null;
      }
      return null;
    } catch (err) {
      return null;
    }
  };

  // Calculate 24-hour heatmap
  const calculateHeatmap = async (simulations) => {
    if (!simulations || simulations.length === 0) {
      setHeatmapData({
        times: Array.from({ length: 24 }, (_, i) => `${i}:00`),
        roads: [{ name: "No data yet", values: Array(24).fill(0) }]
      });
      return;
    }

    // Count road frequency
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

    const defaultRoads = ['Bagong Kalsada', 'Parian Road', 'Makiling Road'];
    while (topRoads.length < 3) {
      const nextDefault = defaultRoads.find(road => !topRoads.includes(road));
      if (nextDefault) topRoads.push(nextDefault);
      else break;
    }

    const currentHour = new Date().getHours();
    const allHours = Array.from({ length: 24 }, (_, i) => i);
    
    // Format time labels
    const timeLabels = allHours.map(h => {
      const isCurrent = h === currentHour;
      let label;
      if (h === 0) label = "12AM";
      else if (h === 12) label = "12PM";
      else if (h < 12) label = `${h}AM`;
      else label = `${h - 12}PM`;
      if (isCurrent) label += " 🔴";
      return label;
    });

    // Calculate road data
    const roadData = await Promise.all(topRoads.map(async roadName => {
      const roadSims = simulations.filter(sim => 
        sim.disruption_location?.includes(roadName)
      );

      const validSeverities = roadSims
        .map(sim => sim.average_delay_ratio)
        .filter(val => val !== null && val !== undefined && !isNaN(val) && val > 0);
      
      const avgSeverity = validSeverities.length > 0
        ? validSeverities.reduce((sum, val) => sum + val, 0) / validSeverities.length
        : 1.5;

      const values = await Promise.all(allHours.map(async hour => {
        const isCurrent = hour === currentHour;
        const isPast = hour < currentHour;

        let realTimeValue = null;
        if (isCurrent || (isPast && currentHour - hour <= 2)) {
          realTimeValue = await fetchRealTimeTraffic(roadName, hour);
        }

        if (realTimeValue !== null) {
          return Math.max(0.5, Math.min(3.0, realTimeValue));
        }

        // Time-based multiplier
        let multiplier = 1.0;
        if (hour >= 7 && hour <= 9) multiplier = 1.5;
        else if (hour >= 17 && hour <= 19) multiplier = 1.6;
        else if (hour >= 12 && hour <= 14) multiplier = 1.2;
        else if (hour >= 22 || hour <= 5) multiplier = 0.5;
        else if (hour >= 10 && hour <= 11) multiplier = 1.1;
        else if (hour >= 15 && hour <= 16) multiplier = 1.2;
        else multiplier = 0.9;
        
        let value = avgSeverity * multiplier;
        if (isCurrent) value *= 1.15;
        
        return Math.max(0.5, Math.min(3.0, value));
      }));

      return { name: roadName, values };
    }));

    setHeatmapData({ times: timeLabels, roads: roadData });
    setTimeout(() => scrollToCurrentHour(), 100);
  };

  const scrollToCurrentHour = () => {
    if (heatmapScrollRef.current) {
      const currentHour = new Date().getHours();
      const scrollPosition = Math.max(0, (currentHour - 3) * 60);
      heatmapScrollRef.current.scrollTo({
        left: scrollPosition,
        behavior: 'smooth'
      });
    }
  };

  const fetchDashboardData = async () => {
    if (!user?.id) return;
    
    setLoading(true);
    setError(null);

    try {
      const savedResponse = await fetch(
        `http://localhost:5000/api/my-simulations?user_id=${user.id}`
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

        const avgLabel = avgSeverity < 1.5 ? "Light" : avgSeverity < 2.5 ? "Moderate" : "Heavy";

        setStats({
          totalSaved,
          totalPublished: published.length,
          activeDisruptions: published.length,
          avgCongestion: avgLabel,
        });

        await calculateHeatmap(savedData.simulations);
      }

      const publishedResponse = await fetch("http://localhost:5000/api/published-disruptions");
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

  // Show loading while checking auth
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-orange-500 border-r-transparent"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return null;
  }

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
                Hello, <span style={{ color: "#F5820D" }}>{user.firstName}</span>! 👋
              </h1>
              <p className="text-gray-600 mt-1">Welcome back to your dashboard</p>
            </div>

            {/* Quick Actions */}
            <div className="mb-6">
              <h2 className="text-xl font-bold text-gray-800 mb-4">Quick Actions</h2>
              <div className="grid md:grid-cols-3 gap-4">
                {/* New Simulation Card */}
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
                  <button onClick={() => router.push("/simulation")} className="w-full bg-white text-orange-600 py-2.5 rounded-lg font-semibold hover:bg-orange-50 transition-all shadow-sm">
                    Create
                  </button>
                  <div className="mt-4 pt-4 border-t border-white/20">
                    <p className="text-xs text-white/80 mb-1">Saved Scenarios</p>
                    <p className="text-2xl font-bold text-white">{loading ? "..." : stats.totalSaved}</p>
                  </div>
                </div>

                {/* Saved Scenarios Card */}
                <div className="rounded-xl p-6 shadow-lg hover:shadow-xl transition-shadow" style={{ background: 'linear-gradient(150deg, #F5820D 0%, #FFA611 100%)' }}>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-lg flex items-center justify-center">
                      <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M17 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V7l-4-4zm-5 16c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm3-10H5V5h10v4z"/>
                      </svg>
                    </div>
                    <h3 className="text-lg font-semibold text-white">Saved Scenarios</h3>
                  </div>
                  <p className="text-sm text-white/90 mb-4 leading-relaxed">
                    Open and edit previously saved simulations or resume drafts.
                  </p>
                  <button onClick={() => router.push("/data")} className="w-full bg-white text-orange-600 py-2.5 rounded-lg font-semibold hover:bg-orange-50 transition-all shadow-sm">
                    Open ({stats.totalSaved})
                  </button>
                  <div className="mt-4 pt-4 border-t border-white/20">
                    <p className="text-xs text-white/80 mb-1">Pending Review</p>
                    <p className="text-2xl font-bold text-white">0</p>
                  </div>
                </div>

                {/* Published Results Card */}
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
                  <button onClick={() => router.push("/reports")} className="w-full bg-white text-orange-600 py-2.5 rounded-lg font-semibold hover:bg-orange-50 transition-all shadow-sm">
                    View ({stats.totalPublished})
                  </button>
                  <div className="mt-4 pt-4 border-t border-white/20">
                    <p className="text-xs text-white/80 mb-1">Published</p>
                    <p className="text-2xl font-bold text-white">{loading ? "..." : stats.totalPublished}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-4 gap-4 mb-6">
              <div className="bg-white rounded-lg shadow p-4 text-center">
                <p className="text-2xl font-bold text-gray-800">{loading ? "..." : stats.activeDisruptions}</p>
                <p className="text-xs text-gray-600">Active Disruptions</p>
              </div>
              <div className="bg-white rounded-lg shadow p-4 text-center">
                <p className="text-2xl font-bold text-gray-800">{loading ? "..." : stats.totalSaved}</p>
                <p className="text-xs text-gray-600">Simulations Run</p>
              </div>
              <div className="bg-white rounded-lg shadow p-4 text-center">
                <p className={`text-2xl font-bold ${stats.avgCongestion === "Heavy" ? "text-red-600" : stats.avgCongestion === "Moderate" ? "text-yellow-600" : "text-green-600"}`}>
                  {loading ? "..." : stats.avgCongestion}
                </p>
                <p className="text-xs text-gray-600">Avg Congestion</p>
              </div>
              <div className="bg-white rounded-lg shadow p-4 text-center">
                <p className="text-2xl font-bold text-gray-800">{loading ? "..." : stats.totalPublished}</p>
                <p className="text-xs text-gray-600">Reports Generated</p>
              </div>
            </div>

            {/* Recent Activity */}
            <div className="bg-white rounded-lg shadow-md p-6 mb-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-gray-800">Recent Activity</h2>
                <button onClick={() => router.push("/data")} className="text-orange-500 text-sm font-semibold hover:underline">
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
                    <div key={sim.simulation_id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition cursor-pointer" onClick={() => router.push(`/data`)}>
                      <div className="flex-1">
                        <p className="font-semibold text-gray-800">{sim.simulation_name || "Unnamed Simulation"}</p>
                        <p className="text-sm text-gray-600">{sim.simulation_status === "published" ? "Published" : "Saved"} — {new Date(sim.created_at).toLocaleDateString()}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`px-3 py-1 text-xs font-semibold rounded ${sim.average_delay_ratio >= 2 ? "bg-red-100 text-red-700" : sim.average_delay_ratio >= 1 ? "bg-yellow-100 text-yellow-700" : "bg-green-100 text-green-700"}`}>
                          {sim.average_delay_ratio >= 2 ? "Heavy" : sim.average_delay_ratio >= 1 ? "Moderate" : "Light"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 24-Hour Heatmap */}
            <div className="bg-white rounded-lg shadow-md p-6 mb-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-bold text-gray-800">24-Hour Traffic Timeline</h2>
                  <p className="text-xs text-gray-500 mt-1">Real-time tracking • Current hour 🔴 • Future predictions</p>
                </div>
                <button onClick={scrollToCurrentHour} className="text-xs bg-orange-100 text-orange-700 px-3 py-1.5 rounded-full font-semibold hover:bg-orange-200 transition">
                  Jump to Now
                </button>
              </div>

              <div ref={heatmapScrollRef} className="overflow-x-auto overflow-y-visible pb-2" style={{ scrollBehavior: 'smooth' }}>
                {heatmapData.roads.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <p>Loading 24-hour data...</p>
                  </div>
                ) : (
                  <table className="text-xs w-max">
                    <thead>
                      <tr>
                        <th className="sticky left-0 bg-white z-10 text-left p-2 font-semibold text-gray-700 border-r border-gray-200">Location</th>
                        {heatmapData.times.map((time, idx) => {
                          const isCurrent = time.includes('🔴');
                          const currentHour = new Date().getHours();
                          const isPast = idx < currentHour;
                          return (
                            <th key={idx} className={`p-2 font-semibold text-center min-w-[60px] transition-opacity duration-500 ${isCurrent ? 'text-red-600 bg-red-50' : isPast ? 'text-gray-400 opacity-50' : 'text-gray-700'}`}>
                              {time}
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      {heatmapData.roads.map((road, roadIdx) => (
                        <tr key={roadIdx}>
                          <td className="sticky left-0 bg-white z-10 p-2 font-medium text-gray-800 text-xs border-r border-gray-200">{road.name}</td>
                          {road.values.map((value, timeIdx) => {
                            const currentHour = new Date().getHours();
                            const isCurrent = timeIdx === currentHour;
                            const isPast = timeIdx < currentHour;
                            let opacity = 1.0;
                            if (isPast) {
                              const hoursSince = currentHour - timeIdx;
                              opacity = Math.max(0.3, 1.0 - (hoursSince * 0.1));
                            }
                            return (
                              <td key={timeIdx} className="p-1">
                                <div className={`h-12 w-12 rounded flex items-center justify-center text-white font-bold text-xs ${getCongestionColor(value)} hover:scale-110 transition-all cursor-pointer ${isCurrent ? 'ring-4 ring-red-400 animate-pulse' : ''}`} style={{ opacity }} title={`${road.name} at ${timeIdx}:00\n${getCongestionLabel(value)} (${value.toFixed(1)})\n${isPast ? '✓ Passed' : isCurrent ? '🔴 LIVE' : '📊 Predicted'}`}>
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
                    <span>Last: {lastUpdate.toLocaleTimeString()}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Weekly Trend */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-lg font-bold text-gray-800 mb-4">Weekly Trend</h2>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={weeklyTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="day" tick={{ fill: "#6b7280", fontSize: 11 }} />
                  <YAxis domain={[0, 3]} ticks={[0, 1, 2, 3]} tick={{ fill: "#6b7280", fontSize: 11 }} />
                  <Tooltip contentStyle={{ backgroundColor: "#fff", border: "1px solid #e5e7eb", borderRadius: "8px", fontSize: "12px" }} formatter={(value) => { const label = value < 1.5 ? "Light" : value < 2.5 ? "Moderate" : "Heavy"; return [label, "Congestion"]; }} />
                  <Line type="monotone" dataKey="level" stroke="#f97316" strokeWidth={2} dot={{ fill: "#f97316", r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
              <p className="text-xs text-gray-500 text-center mt-2">
                {loading ? 'Loading...' : savedSimulations.length === 0 ? 'No data yet' : `Based on ${savedSimulations.length} simulation${savedSimulations.length > 1 ? 's' : ''}`}
              </p>
            </div>
          </div>

          {/* Right Sidebar */}
          <div className="col-span-12 lg:col-span-4">
            {/* System Status */}
            <div className="bg-white rounded-lg shadow-md p-6 mb-6">
              <h2 className="text-lg font-bold text-gray-800 mb-4">System Status</h2>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">ML Model</span>
                  <span className={`px-2 py-1 text-xs font-semibold rounded ${backendStatus.ml_model === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {backendStatus.ml_model === 'active' ? '● Active' : '● Error'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Database</span>
                  <span className={`px-2 py-1 text-xs font-semibold rounded ${backendStatus.database === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {backendStatus.database === 'active' ? '● Active' : '● Error'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Response Time</span>
                  <span className="text-sm font-semibold text-gray-800">{backendStatus.response_time}</span>
                </div>
              </div>
            </div>

            {/* Quick Stats */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-lg font-bold text-gray-800 mb-4">Quick Info</h2>
              <div className="space-y-4">
                <div>
                  <p className="text-xs text-gray-500 mb-1">Last Updated</p>
                  <p className="text-sm font-semibold text-gray-800">{lastUpdate.toLocaleTimeString()}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">User Account</p>
                  <p className="text-sm font-semibold text-gray-800">{user.email}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Total Simulations</p>
                  <p className="text-sm font-semibold text-gray-800">{stats.totalSaved} saved</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}