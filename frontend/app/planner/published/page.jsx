"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function PublishedResultsPage() {
  const router = useRouter();

  const [publishedItems] = useState([
    { id: 1, name: "Road Repair - Real Street", date: "2025-09-25", summary: "Simulation of road repair impact." },
    { id: 2, name: "Flood Risk Simulation", date: "2025-09-22", summary: "Flood prediction model in Calamba City." },
  ]);

  const [selected, setSelected] = useState(null);

  return (
    <div className="p-8 bg-[#F5F6FA] min-h-screen text-gray-800">
      {/* Back Button */}
      <button
        onClick={() => router.push("/planner")}
        className="mb-6 px-4 py-2 bg-orange-500 text-white rounded hover:bg-orange-600"
      >
        ← Back to Dashboard
      </button>

      <h1 className="text-3xl font-bold text-orange-600 mb-6">
        Published Results
      </h1>

      {/* Published List */}
      <div className="grid gap-4">
        {publishedItems.map((item) => (
          <div
            key={item.id}
            className="bg-white shadow rounded-lg p-4 flex justify-between items-center"
          >
            <div>
              <h3 className="font-semibold">{item.name}</h3>
              <p className="text-sm text-gray-500">Published on {item.date}</p>
            </div>
            <button
              onClick={() => setSelected(item)}
              className="px-3 py-1 border border-orange-500 text-orange-600 rounded hover:bg-orange-50"
            >
              View Result
            </button>
          </div>
        ))}
      </div>

      {/* View Modal */}
      {selected && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center">
          <div className="bg-white p-6 rounded-lg shadow-lg max-w-lg w-full">
            <h2 className="text-xl font-bold mb-2">{selected.name}</h2>
            <p className="text-sm text-gray-600 mb-4">{selected.summary}</p>
            <p className="text-sm text-gray-500 mb-6">
              Published on {selected.date}
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => alert(`Opening ${selected.name} map...`)}
                className="px-4 py-2 bg-orange-500 text-white rounded hover:bg-orange-600"
              >
                Open Map
              </button>
              <button
                onClick={() => setSelected(null)}
                className="px-4 py-2 border border-gray-400 text-gray-600 rounded hover:bg-gray-100"
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
