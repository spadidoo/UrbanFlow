"use client";
import { useState } from "react";
import PlannerNavbar from "@/components/PlannerNavbar";

export default function DataPage() {
const [activeTab, setActiveTab] = useState("disruptions");
const [filter, setFilter] = useState("all");
const [search, setSearch] = useState("");
const [selectedDisruptions, setSelectedDisruptions] = useState([]);

const disruptions = [
{
id: 1,
title: "Flood near Barangay Real",
type: "Flood",
status: "Published",
date: "2025-10-10",
congestion: "Severe",
},
{
id: 2,
title: "Road Repair at Crossing",
type: "Infrastructure",
status: "Draft",
date: "2025-10-15",
congestion: "Moderate",
},
];

const datasets = [
{ id: 1, name: "TrafficData_2025.csv", rows: 1023, cols: 12, updated: "2025-10-20" },
{ id: 2, name: "FloodImpact_July.xlsx", rows: 480, cols: 8, updated: "2025-07-25" },
];

const toggleSelect = (id) => {
setSelectedDisruptions((prev) =>
prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
);
};

const filteredDisruptions = disruptions.filter(
(d) =>
(filter === "all" || d.status.toLowerCase() === filter.toLowerCase()) &&
d.title.toLowerCase().includes(search.toLowerCase())
);

const completedProjects = disruptions.filter(
(d) => d.status.toLowerCase() === "published"
);

return ( <div className="min-h-screen bg-[#F5F6FA] text-gray-800"> <PlannerNavbar />

  <main className="container mx-auto px-8 py-10">
    <h1 className="text-3xl font-bold text-orange-600 mb-8">
      Data Management
    </h1>

    {/* Tabs */}
    <div className="flex gap-4 mb-6">
      {["disruptions", "datasets", "completed"].map((tab) => (
        <button
          key={tab}
          onClick={() => setActiveTab(tab)}
          className={`px-4 py-2 rounded transition ${
            activeTab === tab
              ? "bg-orange-500 text-white shadow-md scale-105"
              : "bg-gray-200 hover:bg-gray-300"
          }`}
        >
          {tab.charAt(0).toUpperCase() + tab.slice(1)}
        </button>
      ))}
    </div>

    {/* Disruptions Tab */}
    {activeTab === "disruptions" && (
      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex justify-between items-center mb-4">
          <div className="flex gap-2">
            {["all", "published", "draft"].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1 rounded ${
                  filter === f
                    ? "bg-orange-500 text-white"
                    : "bg-gray-200 hover:bg-gray-300"
                }`}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Search disruption..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="border border-gray-300 rounded px-3 py-1 text-sm"
            />
            <button className="bg-orange-500 text-white px-4 py-1 rounded hover:bg-orange-600 transition">
              + New
            </button>
            {selectedDisruptions.length > 0 && (
              <button className="bg-red-500 text-white px-4 py-1 rounded hover:bg-red-600 transition">
                Delete ({selectedDisruptions.length})
              </button>
            )}
          </div>
        </div>

        {/* Disruption Cards */}
        <div className="grid md:grid-cols-2 gap-4">
          {filteredDisruptions.length === 0 ? (
            <p className="text-gray-500">No disruptions found.</p>
          ) : (
            filteredDisruptions.map((d) => (
              <div
                key={d.id}
                className="border rounded-lg p-4 hover:shadow-lg transition transform hover:scale-[1.02] bg-gray-50"
              >
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={selectedDisruptions.includes(d.id)}
                      onChange={() => toggleSelect(d.id)}
                    />
                    <h3 className="font-bold text-lg text-orange-600">
                      {d.title}
                    </h3>
                  </div>
                  <span
                    className={`px-2 py-1 text-xs rounded ${
                      d.status === "Published"
                        ? "bg-green-100 text-green-700"
                        : "bg-yellow-100 text-yellow-700"
                    }`}
                  >
                    {d.status}
                  </span>
                </div>
                <p className="text-sm text-gray-600 mt-2">
                  Type: {d.type} | Date: {d.date}
                </p>
                <p className="text-sm mt-1">
                  Congestion: {d.congestion}
                </p>

                {/* Filled action buttons */}
                <div className="flex justify-end gap-2 mt-3">
                  <button className="px-3 py-1 text-sm bg-orange-500 text-white rounded hover:bg-orange-600 transition">
                    Edit
                  </button>
                  <button className="px-3 py-1 text-sm bg-red-500 text-white rounded hover:bg-red-600 transition">
                    Delete
                  </button>
                  <button
                    className={`px-3 py-1 text-sm text-white rounded transition ${
                      d.status === "Published"
                        ? "bg-gray-500 hover:bg-gray-600"
                        : "bg-green-500 hover:bg-green-600"
                    }`}
                  >
                    {d.status === "Published" ? "Unpublish" : "Publish"}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    )}

    {/* Datasets Tab */}
    {activeTab === "datasets" && (
      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-orange-600">
            Uploaded Datasets
          </h2>
          <div className="flex gap-2">
            <button className="bg-orange-500 text-white px-4 py-1 rounded hover:bg-orange-600 transition">
              ⬆ Upload
            </button>
            <button className="bg-blue-500 text-white px-4 py-1 rounded hover:bg-blue-600 transition">
              ⬇ Download
            </button>
          </div>
        </div>

        <div className="space-y-3">
          {datasets.map((d) => (
            <div
              key={d.id}
              className="border rounded-lg p-4 flex justify-between items-center hover:shadow-md transition transform hover:scale-[1.01]"
            >
              <div>
                <h3 className="font-semibold text-gray-800">{d.name}</h3>
                <p className="text-sm text-gray-600">
                  Rows: {d.rows} | Columns: {d.cols} | Last updated: {d.updated}
                </p>
              </div>
              <button className="px-3 py-1 text-sm bg-green-500 text-white rounded hover:bg-green-600 transition">
                Download
              </button>
            </div>
          ))}
        </div>
      </div>
    )}

    {/* Completed Tab */}
    {activeTab === "completed" && (
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-xl font-semibold text-orange-600 mb-4">
          Completed Projects
        </h2>
        {completedProjects.length === 0 ? (
          <p className="text-gray-500">No completed projects yet.</p>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {completedProjects.map((d) => (
              <div
                key={d.id}
                className="border rounded-lg p-4 bg-green-50 hover:shadow-lg transition transform hover:scale-[1.02]"
              >
                <h3 className="font-bold text-lg text-green-700">
                  {d.title}
                </h3>
                <p className="text-sm text-gray-600 mt-1">
                  Type: {d.type} | Date Completed: {d.date}
                </p>
                <p className="text-sm text-gray-600 mt-1">
                  Congestion Level: {d.congestion}
                </p>
                <div className="flex justify-end mt-3">
                  <button className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 transition">
                    View Details
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    )}
  </main>
</div>

);
}
