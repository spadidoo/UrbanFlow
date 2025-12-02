"use client";
import PlannerNavbar from "@/components/PlannerNavBar";
import api from "@/services/api";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";

export default function ReportsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const userId = user?.user_id || user?.id;
  
  // Filters
  const [filterType, setFilterType] = useState("all");
  const [filterDate, setFilterDate] = useState("");
  const [search, setSearch] = useState("");
  
  // Data
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Fetch reports on mount
  useEffect(() => {
    if (userId) {
      fetchReports();
    }
  }, [userId]);
  
  const fetchReports = async () => {
    setLoading(true);
    setError(null);
    
    try {
      console.log("📄 Fetching reports for userId:", userId);
      
      // Use the new reports API endpoint that queries v_reports view
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/reports/list?user_id=${userId}`
      );
      
      const data = await response.json();
      
      console.log("📦 Reports API Response:", data);
      
      if (data.success) {
        console.log("✅ Found reports:", data.count);
        
        const transformedReports = data.reports.map(r => ({
          id: r.simulation_id,
          title: r.simulation_name,
          location: r.disruption_location,
          type: r.disruption_type,
          severity_level: r.severity_level,
          status: r.is_published ? 'Published' : 'Completed',
          date: r.end_time ? new Date(r.end_time).toLocaleDateString() : 'N/A',
          start_date: r.start_time ? new Date(r.start_time).toISOString().split('T')[0] : '',
          end_date: r.end_time ? new Date(r.end_time).toISOString().split('T')[0] : '',
          has_report: r.has_report,
          report_generated_at: r.report_generated_at,
          total_affected_segments: r.total_affected_segments || 0,
          average_delay_ratio: r.average_delay_ratio || 0
        }));
        
        setReports(transformedReports);
      } else {
        setError(data.error || "Failed to load reports");
      }
    } catch (err) {
      console.error("❌ Error:", err);
      setError("Failed to connect to server");
    } finally {
      setLoading(false);
    }
  };
  
  // Apply filters client-side
  const filteredReports = reports.filter((r) => {
    const matchesType =
      filterType === "all" || r.type.toLowerCase() === filterType.toLowerCase();
    const matchesDate = !filterDate || r.start_date === filterDate || r.end_date === filterDate;
    const matchesSearch =
      r.title.toLowerCase().includes(search.toLowerCase()) ||
      r.location.toLowerCase().includes(search.toLowerCase());
    return matchesType && matchesDate && matchesSearch;
  });
  
  // Handle View Details
  const handleViewDetails = (reportId) => {
    // Keep existing behavior - navigate to the static details page
    router.push(`/reports/${reportId}`);
  };
  
  // Handle Export
  const handleExport = async (reportId, format) => {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/reports/${reportId}/export?format=${format}`,
        {
          method: 'GET',
        }
      );
      
      if (!response.ok) {
        throw new Error(`Export failed: ${response.status}`);
      }
      
      // Get filename from Content-Disposition header or use default
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = `report_${reportId}.${format}`;
      
      if (contentDisposition) {
        const matches = /filename="(.+)"/.exec(contentDisposition);
        if (matches && matches[1]) {
          filename = matches[1];
        }
      }
      
      // Download the file
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
    } catch (err) {
      console.error(`Error exporting as ${format}:`, err);
      alert(`Failed to export as ${format.toUpperCase()}`);
    }
  };
  
  // Get severity badge color
  const getSeverityColor = (severity) => {
    if (!severity) return "bg-gray-100 text-gray-700";
    
    const level = severity.toLowerCase();
    if (level === "light") return "bg-green-100 text-green-700";
    if (level === "moderate") return "bg-yellow-100 text-yellow-700";
    if (level === "heavy" || level === "severe") return "bg-red-100 text-red-700";
    return "bg-gray-100 text-gray-700";
  };

  return (
    <div className="min-h-screen bg-[#F5F6FA] text-gray-800">
      <PlannerNavbar />

      <main className="container mx-auto px-8 py-10">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-black-600">
            Completed Published Simulation Reports
          </h1>
          
          <button
            onClick={fetchReports}
            className="bg-orange-400 text-white px-4 py-2 rounded hover:bg-orange-600 transition flex items-center gap-2"
          >
            <span>↻</span>
            Refresh
          </button>
        </div>

        {/* Filters */}
        <div className="bg-white shadow rounded-lg p-6 mb-8">
          <div className="grid md:grid-cols-3 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-gray-600 block mb-1"> Search</label>
              <input
                type="text"
                placeholder="Search by title or location..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full px-4 py-2 border rounded-lg focus:ring-1 focus:ring-orange-500 focus:border-transparent"
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
                className="w-full px-4 py-2 border rounded-lg focus:ring-1 focus:ring-orange-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="text-sm text-gray-600 block mb-1">
                Filter by Type
              </label>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="w-full px-4 py-3 border rounded-lg focus:ring-1 focus:ring-gray-500 focus:border-transparent"
              >
                <option value="all">All</option>
                <option value="roadwork">Roadwork</option>
                <option value="flood">Flood</option>
                <option value="traffic">Traffic</option>
                <option value="infrastructure">Infrastructure</option>
                <option value="event">Event</option>
              </select>
            </div>
          </div>
          
          {/* Active Filters Summary */}
          {(search || filterDate || filterType !== 'all') && (
            <div className="mt-4 flex gap-2 items-center flex-wrap">
              <span className="text-sm text-gray-600">Active filters:</span>
              {search && (
                <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs">
                  Search: "{search}"
                </span>
              )}
              {filterDate && (
                <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs">
                  Date: {filterDate}
                </span>
              )}
              {filterType !== 'all' && (
                <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs">
                  Type: {filterType}
                </span>
              )}
              <button
                onClick={() => {
                  setSearch('');
                  setFilterDate('');
                  setFilterType('all');
                }}
                className="text-xs text-red-600 hover:underline ml-2"
              >
                Clear all
              </button>
            </div>
          )}
        </div>

        {/* Reports List */}
        <div className="bg-white shadow rounded-lg p-6">
          {/* Loading State */}
          {loading && (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading reports...</p>
            </div>
          )}
          
          {/* Error State */}
          {error && !loading && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
              <p className="text-red-700 mb-2">{error}</p>
              <button
                onClick={fetchReports}
                className="text-red-600 hover:underline text-sm"
              >
                Try again
              </button>
            </div>
          )}
          
          {/* Empty State */}
          {!loading && !error && filteredReports.length === 0 && reports.length > 0 && (
            <p className="text-gray-500 text-center py-10">
              No reports found for your selected filters.
            </p>
          )}
          
          {!loading && !error && reports.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-500 text-lg mb-4">
                No completed simulations yet.
              </p>
              <p className="text-gray-400 text-sm mb-6">
                Completed simulations will appear here automatically.
              </p>
              <button
                onClick={() => router.push('/simulation')}
                className="bg-orange-500 text-white px-6 py-2 rounded hover:bg-orange-600 transition"
              >
                Create New Simulation
              </button>
            </div>
          )}
          
          {/* Reports Cards */}
          {!loading && !error && filteredReports.length > 0 && (
            <>
              <div className="mb-4 text-sm text-gray-600">
                Showing {filteredReports.length} of {reports.length} reports
              </div>
              
              <div className="space-y-4">
                {filteredReports.map((r) => (
                  <div
                    key={r.id}
                    className="border rounded-lg p-4 hover:shadow-md transition transform hover:scale-[1.01] bg-white"
                  >
                    <div className="flex justify-between items-start">
                      {/* Report Info */}
                      <div className="flex-1">
                        <div className="flex items-start gap-3">
                          <div>
                            <h3 className="font-semibold text-lg text-orange-600">
                              {r.title}
                            </h3>
                            <p className="text-sm text-gray-600 mt-1">
                             {r.location} | 🗓 {r.date}
                            </p>
                            <div className="flex gap-2 mt-2">
                              <span className={`px-2 py-1 rounded text-xs font-semibold ${getSeverityColor(r.severity_level)}`}>
                                {r.severity_level ? r.severity_level.toUpperCase() : 'N/A'}
                              </span>
                              <span className="px-2 py-1 rounded text-xs font-semibold bg-blue-100 text-blue-700">
                                {r.type}
                              </span>
                              <span className="px-2 py-1 rounded text-xs font-semibold bg-gray-100 text-gray-700">
                                {r.status}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex gap-2 ml-4">
                        <button 
                          onClick={() => handleViewDetails(r.id)}
                          className="border border-blue-500 text-blue-600 px-3 py-1 text-sm rounded hover:bg-blue-500 hover:text-white transition-all duration-300"
                          title="View Details"
                        >
                          Simulation Details
                        </button>
                        <button 
                          onClick={() => handleExport(r.id, 'pdf')}
                          className="border border-red-500 text-red-600 px-3 py-1 text-sm rounded hover:bg-red-500 hover:text-white transition-all duration-300"
                          title="Download as PDF"
                        >
                          PDF
                        </button>
                        <button 
                          onClick={() => handleExport(r.id, 'csv')}
                          className="border border-green-500 text-green-600 px-3 py-1 text-sm rounded hover:bg-green-500 hover:text-white transition-all duration-300"
                          title="Download as CSV"
                        >
                          CSV
                        </button>
                        <button 
                          onClick={() => handleExport(r.id, 'excel')}
                          className="border border-yellow-500 text-yellow-600 px-3 py-1 text-sm rounded hover:bg-yellow-500 hover:text-white transition-all duration-300"
                          title="Download as Excel"
                        >
                          Excel
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}