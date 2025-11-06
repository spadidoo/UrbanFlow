"use client";
import PlannerNavbar from "@/components/PlannerNavbar";
import { useState } from "react";

export default function ReportsPage() {
  const [filterType, setFilterType] = useState("all");
  const [filterLocation, setFilterLocation] = useState("");
  const [filterDate, setFilterDate] = useState("");
  const [search, setSearch] = useState("");

  const reports = [
    {
      id: 1,
      title: "Flood Simulation - Real",
      location: "Barangay Real",
      type: "Flood",
      date: "2025-10-05",
      status: "Published",
    },
    {
      id: 2,
      title: "Traffic Flow Simulation - Crossing",
      location: "Crossing",
      type: "Traffic",
      date: "2025-09-20",
      status: "Published",
    },
    {
      id: 3,
      title: "Infrastructure Repair Impact",
      location: "Barangay Bucal",
      type: "Infrastructure",
      date: "2025-08-10",
      status: "Published",
    },
    {
      id: 4,
      title: "Festival Road Closure - Parian",
      location: "Barangay Parian",
      type: "Event",
      date: "2025-08-28",
      status: "Publsihed",
    },
  ];

  // 🧮 Filter logic
  const filteredReports = reports.filter((r) => {
    const matchesType =
      filterType === "all" || r.type.toLowerCase() === filterType.toLowerCase();
    const matchesLocation =
      !filterLocation ||
      r.location.toLowerCase().includes(filterLocation.toLowerCase());
    const matchesDate = !filterDate || r.date === filterDate;
    const matchesSearch =
      r.title.toLowerCase().includes(search.toLowerCase()) ||
      r.location.toLowerCase().includes(search.toLowerCase());
    return matchesType && matchesLocation && matchesDate && matchesSearch;
  });

  return (
    <div className="min-h-screen bg-[#F5F6FA] text-gray-800">
      <PlannerNavbar />

      <main className="container mx-auto px-8 py-10">
        <h1 className="text-3xl font-bold text-black-600 mb-8">
          Published Simulation Reports
        </h1>

        <div className="bg-white shadow rounded-lg p-6 mb-8">
          <div className="grid md:grid-cols-4 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-gray-600 block mb-1">Search</label>
              <input
                type="text"
                placeholder="Search by title or location..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="border border-gray-300 rounded px-3 py-1 w-full text-sm"
              />
            </div>

            <div>
              <label className="text-sm text-gray-600 block mb-1">
                Filter by Date
              </label>
              <input
                type="date"
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
                className="border border-gray-300 rounded px-3 py-1 w-full text-sm"
              />
            </div>

            <div>
              <label className="text-sm text-gray-600 block mb-1">
                Filter by Location
              </label>
              <input
                type="text"
                placeholder="Enter location..."
                value={filterLocation}
                onChange={(e) => setFilterLocation(e.target.value)}
                className="border border-gray-300 rounded px-3 py-1 w-full text-sm"
              />
            </div>

            <div>
              <label className="text-sm text-gray-600 block mb-1">
                Filter by Type
              </label>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="border border-gray-300 rounded px-3 py-1 w-full text-sm"
              >
                <option value="all">All</option>
                <option value="Flood">Flood</option>
                <option value="Traffic">Traffic</option>
                <option value="Infrastructure">Infrastructure</option>
                <option value="Event">Event</option>
              </select>
            </div>
          </div>
        </div>

        <div className="bg-white shadow rounded-lg p-6">
          {filteredReports.length === 0 ? (
            <p className="text-gray-500 text-center py-10">
              No reports found for your selected filters.
            </p>
          ) : (
            <div className="space-y-4">
              {filteredReports.map((r) => (
                <div
                  key={r.id}
                  className="border rounded-lg p-4 flex justify-between items-center hover:shadow-md transition transform hover:scale-[1.01]"
                >
                  <div>
                    <h3 className="font-semibold text-lg text-orange-600">
                      {r.title}
                    </h3>
                    <p className="text-sm text-gray-600 mt-1">
                      📍 {r.location} | 🗓 {r.date} | 🧩 {r.type}
                    </p>
                  </div>

                  {/* ⚙️ Actions */}
                  <div className="flex gap-2">
                    <button className="border border-blue-500 text-blue-600 px-3 py-1 text-sm rounded hover:bg-blue-500 hover:text-white transition-all duration-300">
                      View Details
                    </button>
                    <button className="border border-red-500 text-red-600 px-3 py-1 text-sm rounded hover:bg-red-500 hover:text-white transition-all duration-300">
                      PDF
                    </button>
                    <button className="border border-green-500 text-green-600 px-3 py-1 text-sm rounded hover:bg-green-500 hover:text-white transition-all duration-300">
                      CSV
                    </button>
                    <button className="border border-yellow-500 text-yellow-600 px-3 py-1 text-sm rounded hover:bg-yellow-500 hover:text-white transition-all duration-300">
                      Excel
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
