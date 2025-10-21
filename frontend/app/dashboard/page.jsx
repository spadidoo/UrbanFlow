"use client";

import PlannerNavbar from "@/components/PlannerNavbar";
import { useRouter } from "next/navigation";
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

  // Weekly trend data
  const weeklyTrend = [
    { day: "Mon", level: 1.5 },
    { day: "Tue", level: 2.0 },
    { day: "Wed", level: 2.3 },
    { day: "Thu", level: 1.8 },
    { day: "Fri", level: 2.5 },
    { day: "Sat", level: 1.2 },
    { day: "Sun", level: 1.0 },
  ];

  // Heatmap data: roads x time slots
  const heatmapData = {
    times: ["6AM", "9AM", "12PM", "3PM", "6PM", "9PM"],
    roads: [
      { name: "Bagong Kalsada", values: [1.2, 2.8, 1.8, 2.0, 2.9, 1.5] },
      { name: "Parian Road", values: [1.0, 2.5, 1.6, 1.9, 2.7, 1.3] },
      { name: "Makiling Road", values: [1.1, 2.2, 1.4, 1.7, 2.4, 1.2] },
      { name: "Real Street", values: [1.3, 2.6, 1.7, 2.1, 2.8, 1.4] },
    ],
  };

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
                Hello, <span className="text-orange-500">John</span>
              </h1>
            </div>

            {/* Quick Actions */}
            <div className="mb-6">
              <h2 className="text-xl font-bold text-gray-800 mb-4">
                Quick Actions
              </h2>

              <div className="grid md:grid-cols-3 gap-4">
                <div className="bg-orange-500 rounded-lg p-6 text-white">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="text-2xl">➕</div>
                    <h3 className="text-lg font-bold">New Simulation</h3>
                  </div>
                  <p className="text-sm text-orange-100 mb-4">
                    Define a disruption, run the Random Forest simulation,
                    review results.
                  </p>
                  <button
                    onClick={() => router.push("/simulation")}
                    className="w-full bg-white text-orange-500 py-2 rounded-lg font-semibold hover:bg-orange-50 transition"
                  >
                    Create
                  </button>
                  <div className="mt-4 pt-4 border-t border-orange-400">
                    <p className="text-xs text-orange-100">Saved Scenarios</p>
                    <p className="text-2xl font-bold">0</p>
                  </div>
                </div>

                <div className="bg-orange-500 rounded-lg p-6 text-white">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="text-2xl">💾</div>
                    <h3 className="text-lg font-bold">Saved Scenarios</h3>
                  </div>
                  <p className="text-sm text-orange-100 mb-4">
                    Open and edit previously saved simulations or resume drafts.
                  </p>
                  <button className="w-full bg-white text-orange-500 py-2 rounded-lg font-semibold hover:bg-orange-50 transition">
                    Open
                  </button>
                  <div className="mt-4 pt-4 border-t border-orange-400">
                    <p className="text-xs text-orange-100">Pending Review</p>
                    <p className="text-2xl font-bold">0</p>
                  </div>
                </div>

                <div className="bg-orange-500 rounded-lg p-6 text-white">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="text-2xl">🌐</div>
                    <h3 className="text-lg font-bold">Published Results</h3>
                  </div>
                  <p className="text-sm text-orange-100 mb-4">
                    View simulations already published to the public map.
                  </p>
                  <button className="w-full bg-white text-orange-500 py-2 rounded-lg font-semibold hover:bg-orange-50 transition">
                    View
                  </button>
                  <div className="mt-4 pt-4 border-t border-orange-400">
                    <p className="text-xs text-orange-100">Published</p>
                    <p className="text-2xl font-bold">0</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-4 gap-4 mb-6">
              <div className="bg-white rounded-lg shadow p-4 text-center">
                <p className="text-2xl font-bold text-gray-800">2</p>
                <p className="text-xs text-gray-600">Active Disruptions</p>
              </div>
              <div className="bg-white rounded-lg shadow p-4 text-center">
                <p className="text-2xl font-bold text-gray-800">15</p>
                <p className="text-xs text-gray-600">Simulations Run</p>
              </div>
              <div className="bg-white rounded-lg shadow p-4 text-center">
                <p className="text-2xl font-bold text-yellow-600">Moderate</p>
                <p className="text-xs text-gray-600">Avg Congestion</p>
              </div>
              <div className="bg-white rounded-lg shadow p-4 text-center">
                <p className="text-2xl font-bold text-gray-800">8</p>
                <p className="text-xs text-gray-600">Reports Generated</p>
              </div>
            </div>

            {/* Recent Activity */}
            <div className="bg-white rounded-lg shadow-md p-6 mb-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-gray-800">
                  Recent Activity
                </h2>
                <button className="text-orange-500 text-sm font-semibold hover:underline">
                  View all
                </button>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition">
                  <div className="flex-1">
                    <p className="font-semibold text-gray-800">
                      Bagong Kalsada — Roadworks
                    </p>
                    <p className="text-sm text-gray-600">
                      Published — 2025-10-15
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-3 py-1 bg-yellow-100 text-yellow-700 text-xs font-semibold rounded">
                      Moderate
                    </span>
                    <button className="px-4 py-1 bg-orange-500 text-white text-sm rounded hover:bg-orange-600 transition">
                      Review
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition">
                  <div className="flex-1">
                    <p className="font-semibold text-gray-800">
                      Parian Festival — Event
                    </p>
                    <p className="text-sm text-gray-600">
                      Saved to drafts — 2025-10-08
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-3 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded">
                      Light
                    </span>
                    <button className="px-4 py-1 bg-orange-500 text-white text-sm rounded hover:bg-orange-600 transition">
                      Review
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition">
                  <div className="flex-1">
                    <p className="font-semibold text-gray-800">
                      Real Street — Accident
                    </p>
                    <p className="text-sm text-gray-600">
                      For review — 2025-10-05
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-3 py-1 bg-red-100 text-red-700 text-xs font-semibold rounded">
                      Heavy
                    </span>
                    <button className="px-4 py-1 bg-orange-500 text-white text-sm rounded hover:bg-orange-600 transition">
                      Review
                    </button>
                  </div>
                </div>
              </div>
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
