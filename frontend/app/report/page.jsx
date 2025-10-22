"use client";
import { useRouter } from "next/navigation";

export default function ReportPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-[#F5F6FA] text-gray-800 p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-orange-600">Simulation Reports</h1>
        <button
          onClick={() => router.push("/planner")}
          className="px-4 py-2 bg-orange-500 text-white rounded hover:bg-orange-600"
        >
          ← Back to Planner Dashboard
        </button>
      </div>

      <div className="bg-white shadow rounded-lg p-6">
        <p className="text-gray-600 mb-4">
          Review and download reports generated from previous simulations.
        </p>

        <ul className="space-y-3">
          <li className="border p-3 rounded flex justify-between items-center">
            <span>📄 Flood Risk Simulation Report - Sept 2025</span>
            <button className="px-3 py-1 bg-orange-500 text-white rounded hover:bg-orange-600">
              Download
            </button>
          </li>
          <li className="border p-3 rounded flex justify-between items-center">
            <span>📄 Traffic Impact Study - July 2025</span>
            <button className="px-3 py-1 bg-orange-500 text-white rounded hover:bg-orange-600">
              Download
            </button>
          </li>
        </ul>
      </div>
    </div>
  );
}
