"use client";
import { useRouter } from "next/navigation";

export default function DataPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-[#F5F6FA] text-gray-800 p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-orange-600">Data Management</h1>
        <button
          onClick={() => router.push("/planner")}
          className="px-4 py-2 bg-orange-500 text-white rounded hover:bg-orange-600"
        >
          ← Back to Planner Dashboard
        </button>
      </div>

      <div className="bg-white shadow rounded-lg p-6">
        <p className="text-gray-600">
          This section will handle uploading, viewing, and managing datasets used in simulations.
        </p>

        <div className="mt-6 flex gap-3">
          <button className="px-4 py-2 bg-orange-500 text-white rounded hover:bg-orange-600">
            📤 Upload Data
          </button>
          <button className="px-4 py-2 border border-orange-500 text-orange-600 rounded hover:bg-orange-50">
            📊 View Datasets
          </button>
        </div>
      </div>
    </div>
  );
}
