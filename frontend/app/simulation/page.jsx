"use client";
import { useRouter } from "@/components/PlannerNavbar";

export default function SimulatePage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-[#F5F6FA] text-gray-800 p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-orange-600">Run Simulation</h1>
        <button
          onClick={() => router.push("/planner")}
          className="px-4 py-2 bg-orange-500 text-white rounded hover:bg-orange-600"
        >
          ← Back to Planner Dashboard
        </button>
      </div>

      <div className="bg-white shadow rounded-lg p-6">
        <p className="text-gray-600 mb-4">
          Choose simulation type, input parameters, and run model (frontend
          mock-up).
        </p>

        <div className="space-y-3">
          <div>
            <label className="block text-sm font-semibold mb-1">
              Simulation Type
            </label>
            <select className="w-full border border-gray-300 rounded p-2">
              <option>Flood Simulation</option>
              <option>Traffic Simulation</option>
              <option>Infrastructure Resilience</option>
            </select>
          </div>

          <button className="mt-4 px-4 py-2 bg-orange-500 text-white rounded hover:bg-orange-600">
            ▶️ Run Simulation
          </button>
        </div>
      </div>
    </div>
  );
}
