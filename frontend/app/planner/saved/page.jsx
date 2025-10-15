"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function SavedScenariosPage() {
  const router = useRouter();

  // mock data (you can later fetch this from backend)
  const [savedScenarios, setSavedScenarios] = useState([
    { id: 1, name: "Flood Simulation - Crossing", date: "2025-09-28", status: "draft" },
    { id: 2, name: "Traffic Repair - Real Road", date: "2025-09-30", status: "paused" },
  ]);

  // delete function
  const handleDelete = (id) => {
    if (confirm("Are you sure you want to delete this scenario?")) {
      setSavedScenarios(savedScenarios.filter((s) => s.id !== id));
      alert("Scenario deleted (frontend only)");
    }
  };

  // open function (simulate opening editor)
  const handleOpen = (id) => {
    const scenario = savedScenarios.find((s) => s.id === id);
    alert(`Opening ${scenario.name} for editing...`);
    router.push("/planner/new"); // redirect to new page for editing
  };

  return (
    <div className="p-8 bg-[#F5F6FA] min-h-screen text-gray-800">
      <button
        onClick={() => router.push("/planner")}
        className="mb-6 px-4 py-2 bg-orange-500 text-white rounded hover:bg-orange-600"
      >
        ← Back to Dashboard
      </button>

      <h1 className="text-3xl font-bold text-orange-600 mb-6">Saved Scenarios</h1>

      {savedScenarios.length === 0 ? (
        <p className="text-gray-500">No saved simulations yet.</p>
      ) : (
        <ul className="space-y-3">
          {savedScenarios.map((s) => (
            <li
              key={s.id}
              className="flex justify-between items-center bg-white shadow rounded p-4"
            >
              <div>
                <p className="font-semibold">{s.name}</p>
                <p className="text-sm text-gray-500">
                  Saved on {s.date} — Status: {s.status}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleOpen(s.id)}
                  className="px-3 py-1 bg-orange-500 text-white rounded hover:bg-orange-600"
                >
                  Open
                </button>
                <button
                  onClick={() => handleDelete(s.id)}
                  className="px-3 py-1 border border-red-500 text-red-600 rounded hover:bg-red-50"
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
