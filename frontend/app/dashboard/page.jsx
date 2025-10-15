"use client";

import Navbar from "@/components/Navbar";
import { useRouter } from "next/navigation";

export default function DashboardPage() {
  const router = useRouter();

  // TODO: Check if user is actually logged in
  // For now, anyone can access this page

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="container mx-auto px-4 py-8">
        {/* Welcome Header */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            Welcome, Urban Planner! 👋
          </h1>
          <p className="text-gray-600">
            Access your simulation tools and manage traffic disruptions
          </p>
        </div>

        {/* Quick Stats */}
        <div className="grid md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm">Active Disruptions</p>
                <p className="text-3xl font-bold text-gray-800">2</p>
              </div>
              <div className="text-4xl">🚧</div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm">Simulations Run</p>
                <p className="text-3xl font-bold text-gray-800">15</p>
              </div>
              <div className="text-4xl">🎯</div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm">Avg Congestion</p>
                <p className="text-3xl font-bold text-gray-800">Moderate</p>
              </div>
              <div className="text-4xl">📊</div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm">Reports Generated</p>
                <p className="text-3xl font-bold text-gray-800">8</p>
              </div>
              <div className="text-4xl">📄</div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <button
            onClick={() => router.push("/simulation")}
            className="bg-blue-600 text-white p-8 rounded-lg shadow-md hover:bg-blue-700 transition text-left"
          >
            <div className="text-4xl mb-4">🎯</div>
            <h3 className="text-xl font-bold mb-2">Run Simulation</h3>
            <p className="text-blue-100">
              Test disruption scenarios and predict traffic impact
            </p>
          </button>

          <button className="bg-green-600 text-white p-8 rounded-lg shadow-md hover:bg-green-700 transition text-left">
            <div className="text-4xl mb-4">📋</div>
            <h3 className="text-xl font-bold mb-2">View Reports</h3>
            <p className="text-green-100">
              Access historical simulation reports and analytics
            </p>
          </button>

          <button className="bg-purple-600 text-white p-8 rounded-lg shadow-md hover:bg-purple-700 transition text-left">
            <div className="text-4xl mb-4">⚙️</div>
            <h3 className="text-xl font-bold mb-2">Manage Data</h3>
            <p className="text-purple-100">
              Upload datasets and configure system settings
            </p>
          </button>
        </div>

        {/* Recent Activity */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">
            Recent Activity
          </h2>

          <div className="space-y-4">
            <div className="flex items-start gap-4 pb-4 border-b">
              <div className="text-2xl">🎯</div>
              <div className="flex-1">
                <p className="font-semibold text-gray-800">
                  Simulation completed
                </p>
                <p className="text-sm text-gray-600">
                  Bagong Kalsada roadwork impact - Heavy congestion predicted
                </p>
                <p className="text-xs text-gray-500 mt-1">2 hours ago</p>
              </div>
            </div>

            <div className="flex items-start gap-4 pb-4 border-b">
              <div className="text-2xl">📄</div>
              <div className="flex-1">
                <p className="font-semibold text-gray-800">Report generated</p>
                <p className="text-sm text-gray-600">
                  Weekly traffic analysis - October 2025
                </p>
                <p className="text-xs text-gray-500 mt-1">1 day ago</p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="text-2xl">🚧</div>
              <div className="flex-1">
                <p className="font-semibold text-gray-800">
                  Disruption published
                </p>
                <p className="text-sm text-gray-600">
                  Parian Festival event added to public map
                </p>
                <p className="text-xs text-gray-500 mt-1">3 days ago</p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
