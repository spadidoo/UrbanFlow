"use client";

import PlannerNavbar from "@/components/PlannerNavbar";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
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

  // ✅ ADD THESE STATE VARIABLES
  const [savedSimulations, setSavedSimulations] = useState([]);
  const [publishedSimulations, setPublishedSimulations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [backendStatus, setBackendStatus] = useState({
    ml_model: "checking",
    database: "checking",
    response_time: "...",
  });

  //stats from database
  const [stats, setStats] = useState({
    totalSaved: 0,
    totalPublished: 0,
    activeDisruptions: 0,
    simulationsRun: 0,
    avgCongestion: "Loading...",
    avgCongestionValue: 0,
  });

  // ✅ ADD THIS useEffect - Fetch data when page loads
  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    setError(null);

    try {
      // Fetch user's saved simulations
      const savedResponse = await fetch(
        "http://localhost:5000/api/my-simulations?user_id=2"
      );
      const savedData = await savedResponse.json();

      if (savedData.success) {
        setSavedSimulations(savedData.simulations);

        // Calculate stats
        const totalSaved = savedData.simulations.length;
        const completed = savedData.simulations.filter(
          (s) => s.simulation_status === "completed"
        );
        const published = savedData.simulations.filter(
          (s) => s.simulation_status === "published"
        );

        // Calculate average congestion from recent simulations
        const avgSeverity =
          completed.length > 0
            ? completed.reduce(
                (sum, s) => sum + (s.average_delay_ratio || 0),
                0
              ) / completed.length
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
      }

      // Fetch published simulations
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
    }
  };

  // ✅ STATE: Weekly trend data (calculated from simulations)
  const [weeklyTrend, setWeeklyTrend] = useState([
    { day: "Mon", level: 0 },
    { day: "Tue", level: 0 },
    { day: "Wed", level: 0 },
    { day: "Thu", level: 0 },
    { day: "Fri", level: 0 },
    { day: "Sat", level: 0 },
    { day: "Sun", level: 0 },
  ]);

  // ✅ STATE: Heatmap data (calculated from recent simulations)
  const [heatmapData, setHeatmapData] = useState({
    times: ["6AM", "9AM", "12PM", "3PM", "6PM", "9PM"],
    roads: [],
  });

  // Get color based on congestion level
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
                    onClick={() => router.push("/planner/saved-scenarios")}
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
                    onClick={() => router.push("/planner/published-results")}
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

            {/* Graphs */}
            <div className="grid md:grid-cols-2 gap-6">
              {/* HEATMAP - Location x Time */}
              <div className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-lg font-bold text-gray-800 mb-4">
                  Congestion by Location & Time (Today)
                </h2>

                {/* Heatmap Grid */}
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr>
                        <th className="text-left p-2 font-semibold text-gray-700">
                          Location
                        </th>
                        {heatmapData.times.map((time) => (
                          <th
                            key={time}
                            className="p-2 font-semibold text-gray-700 text-center"
                          >
                            {time}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {heatmapData.roads.map((road, roadIdx) => (
                        <tr key={roadIdx}>
                          <td className="p-2 font-medium text-gray-800 text-xs">
                            {road.name}
                          </td>
                          {road.values.map((value, timeIdx) => (
                            <td key={timeIdx} className="p-1">
                              <div
                                className={`h-10 rounded flex items-center justify-center text-white font-bold text-xs ${getCongestionColor(
                                  value
                                )} hover:scale-110 transition cursor-pointer`}
                                title={`${road.name} at ${
                                  heatmapData.times[timeIdx]
                                }: ${getCongestionLabel(
                                  value
                                )} (${value.toFixed(1)})`}
                              >
                                {value.toFixed(1)}
                              </div>
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Legend */}
                <div className="flex justify-center gap-4 mt-4 text-xs">
                  <div className="flex items-center gap-1">
                    <div className="w-4 h-4 bg-green-500 rounded"></div>
                    <span className="text-gray-600">Light (&lt;1.5)</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-4 h-4 bg-yellow-500 rounded"></div>
                    <span className="text-gray-600">Moderate (1.5-2.5)</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-4 h-4 bg-red-500 rounded"></div>
                    <span className="text-gray-600">Heavy (&gt;2.5)</span>
                  </div>
                </div>
              </div>

              {/* Weekly Trend */}
              <div className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-lg font-bold text-gray-800 mb-4">
                  Weekly Congestion Trend
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
                  Peak congestion on Friday
                </p>
              </div>
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
                <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="text-2xl">🤖</div>
                    <div>
                      <p className="font-semibold text-gray-800">ML Model</p>
                      <p className="text-xs text-gray-600">Random Forest</p>
                    </div>
                  </div>
                  <span className="px-2 py-1 bg-green-500 text-white text-xs font-semibold rounded">
                    Active
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
                    5 min ago
                  </span>
                </div>

                <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="text-2xl">⚡</div>
                    <div>
                      <p className="font-semibold text-gray-800">
                        Server Health
                      </p>
                      <p className="text-xs text-gray-600">Response time</p>
                    </div>
                  </div>
                  <span className="text-sm font-semibold text-green-600">
                    45ms
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
                <div className="flex gap-2 p-2 bg-blue-50 border-l-4 border-blue-500 rounded text-sm">
                  <span>ℹ️</span>
                  <div className="flex-1">
                    <p className="font-semibold text-gray-800">
                      Simulation ready
                    </p>
                    <p className="text-xs text-gray-500">5 min ago</p>
                  </div>
                </div>

                <div className="flex gap-2 p-2 bg-green-50 border-l-4 border-green-500 rounded text-sm">
                  <span>✅</span>
                  <div className="flex-1">
                    <p className="font-semibold text-gray-800">
                      Report generated
                    </p>
                    <p className="text-xs text-gray-500">2 hours ago</p>
                  </div>
                </div>

                <div className="flex gap-2 p-2 bg-yellow-50 border-l-4 border-yellow-500 rounded text-sm">
                  <span>⚠️</span>
                  <div className="flex-1">
                    <p className="font-semibold text-gray-800">
                      Draft expiring
                    </p>
                    <p className="text-xs text-gray-500">1 day ago</p>
                  </div>
                </div>

                <button className="w-full mt-3 text-orange-500 text-sm font-semibold hover:underline">
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
