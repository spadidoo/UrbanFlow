"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";

export default function PlannerDashboard() {
  const router = useRouter();
  const [showNotif, setShowNotif] = useState(false);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios
      .get("http://127.0.0.1:5000/api/dashboard")
      .then((res) => setSummary(res.data))
      .catch((err) => {
        console.error(err);
        setSummary({
          saved_scenarios: 0,
          pending_review: 0,
          published: 0,
          recent_activity: [],
        });
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading)
    return <div className="p-10 text-gray-600">Loading dashboard...</div>;

  return (
    <div className="min-h-screen bg-[#F5F6FA] text-gray-800">
      {/* 🧭 Top Navigation */}
      <div className="flex items-center justify-between px-8 py-4 bg-[#1E293B] border-b border-gray-600 text-white relative">
        
        {/* Left Section - Logout + Logo + Nav */}
        <div className="flex items-center gap-6">

          {/* 🏙️ Logo + Navigation */}
          <div className="flex items-center gap-3">
            <img src="/URBANFLOW_logo.PNG" alt="UrbanFlow" className="h-14" />
            <nav className="flex gap-6 text-lg font-medium">
              {[
                { name: "Home", href: "/" },
                { name: "Map", href: "/map" },
                { name: "Data", href: "/data" },
                { name: "Report", href: "/report" },
                { name: "Simulate", href: "/simulate" },
              ].map((item) => (
                <a
                  key={item.name}
                  href={item.href}
                  className="hover:text-orange-400 transition duration-300 transform hover:-translate-y-1 hover:scale-110"
                >
                  {item.name}
                </a>
              ))}
            </nav>
          </div>
        </div>

        {/* 🔔 Notification Button */}
        <div className="relative">
          <button
            onClick={() => setShowNotif(!showNotif)}
            className="bg-orange-500 hover:bg-orange-600 text-white rounded-full w-9 h-9 flex items-center justify-center transition"
          >
            🔔
          </button>

          {showNotif && (
            <div className="absolute right-0 mt-2 w-64 bg-white text-gray-800 shadow-lg rounded-lg p-3 z-10">
              <h3 className="font-semibold border-b pb-1 mb-2">Notifications</h3>
              <p className="text-sm text-gray-500">No new notifications</p>
            </div>
          )}
        </div>
      </div>

      {/* 🧩 Main Content Grid */}
      <div className="grid grid-cols-4 gap-4 p-8 bg-[#F5F6FA] text-gray-900">
        {/* Left Section - 3 cols */}
        <div className="col-span-3 space-y-6">
          {/* Greeting */}
          <h1 className="text-2xl font-bold">
            Hello, <span className="text-orange-600">Planner</span>
          </h1>

          {/* Quick Actions */}
          <section>
            <h2 className="text-lg font-semibold mb-3">Quick Action</h2>
            <div className="flex gap-4">
              {/* New Simulation */}
              <div
                className="flex-1 bg-orange-500 text-white rounded-lg shadow p-4 transform transition duration-300 hover:-translate-y-2 hover:scale-105 hover:shadow-2xl hover:bg-orange-600"
              >
                <h3 className="text-lg font-semibold">+ New Simulation Scenario</h3>
                <p className="text-sm mt-1">
                  Define a disruption, run the Random Forest simulation, review results.
                </p>
                <button
                  onClick={() => router.push("/planner/new")}
                  className="mt-3 px-4 py-2 bg-white text-orange-600 font-medium rounded hover:bg-gray-100 transition"
                >
                  Create
                </button>
              </div>

              {/* Saved Scenarios */}
              <div
                className="flex-1 bg-orange-500 text-white rounded-lg shadow p-4 transform transition duration-300 hover:-translate-y-2 hover:scale-105 hover:shadow-2xl hover:bg-orange-600"
              >
                <h3 className="text-lg font-semibold">💾 Saved Scenarios</h3>
                <p className="text-sm mt-1">
                  Open and edit previously saved simulations or resume drafts.
                </p>
                <button
                  onClick={() => router.push("/planner/saved")}
                  className="mt-3 px-4 py-2 bg-white text-[#334155] font-medium rounded hover:bg-gray-100 transition"
                >
                  Open
                </button>
              </div>

              {/* Published Results */}
              <div
                className="flex-1 bg-orange-500 text-white rounded-lg shadow p-4 transform transition duration-300 hover:-translate-y-2 hover:scale-105 hover:shadow-2xl hover:bg-orange-600"
              >
                <h3 className="text-lg font-semibold">🌍 Published Results</h3>
                <p className="text-sm mt-1">
                  View simulations already published to the public map.
                </p>
                <button
                  onClick={() => router.push("/planner/published")}
                  className="mt-3 px-4 py-2 bg-white text-[#334155] font-medium rounded hover:bg-gray-100 transition"
                >
                  View
                </button>
              </div>
            </div>
          </section>

          {/* 📊 Stats Row */}
          <div className="flex gap-4 mt-6">
            <div className="flex-1 bg-white shadow rounded-lg p-4 text-center">
              <h4 className="text-sm text-gray-500">Saved Scenarios</h4>
              <p className="text-2xl font-bold">{summary.saved_scenarios}</p>
            </div>
            <div className="flex-1 bg-white shadow rounded-lg p-4 text-center">
              <h4 className="text-sm text-gray-500">Published</h4>
              <p className="text-2xl font-bold">{summary.published}</p>
            </div>
            <div className="flex-1 bg-white shadow rounded-lg p-4 text-center">
              <h4 className="text-sm text-gray-500">Pending Review</h4>
              <p className="text-2xl font-bold">{summary.pending_review}</p>
            </div>
            <div className="flex items-center justify-center">
              <button
                onClick={() => router.push("/map")}
                className="px-4 py-2 border border-orange-500 text-orange-600 rounded hover:bg-orange-50"
              >
                Open full map
              </button>
            </div>
          </div>

          {/* 🕓 Recent Activity */}
          <section className="bg-white shadow rounded-lg p-4 mt-6">
            <h2 className="text-lg font-semibold mb-3">Recent Activity</h2>
            {summary.recent_activity.length === 0 ? (
              <div className="text-gray-500">No activity yet.</div>
            ) : (
              <ul className="space-y-3">
                {summary.recent_activity.map((a) => (
                  <li
                    key={a.id}
                    className="flex justify-between items-center border rounded p-3"
                  >
                    <div>
                      <p className="font-semibold">{a.name}</p>
                      <p className="text-sm text-gray-500">
                        {a.type} — {a.status} — 2025-07-16
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => router.push("/planner/moderate")}
                        className="px-3 py-1 border border-orange-500 text-orange-600 rounded hover:bg-orange-50"
                      >
                        Moderate
                      </button>
                      <button
                        onClick={() => router.push("/planner/review")}
                        className="px-3 py-1 bg-orange-500 text-white rounded hover:bg-orange-600"
                      >
                        Review
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        {/* 🧑‍💼 Right Section - Account Info */}
        <div className="col-span-1 space-y-4">
          <div className="bg-white rounded-lg shadow p-4 h-[150px]">
            <h3 className="font-semibold mb-2">Notifications</h3>
            <p className="text-sm text-gray-500">No new notifications</p>
          </div>

          <div className="bg-white rounded-lg shadow p-4 h-[150px]">
            <h3 className="font-semibold mb-2">Published Results</h3>
            <p className="text-sm text-gray-500">None available yet.</p>
          </div>

          <div className="bg-white rounded-lg shadow p-4">
            <h3 className="font-semibold mb-2">Account</h3>
            <p className="text-sm mb-3 text-gray-700">
              planner_calamba@example.gov
            </p>
            <button
              onClick={() => router.push("/planner/account")}
              className="w-full border border-orange-500 text-orange-600 py-2 rounded hover:bg-orange-50"
            >
              Account Settings
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
