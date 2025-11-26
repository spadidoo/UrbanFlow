"use client";

import { useRouter } from "next/navigation";
import { X, Calendar, MapPin, AlertTriangle, Clock, TrendingUp, Edit, FileText } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

export default function SimulationPreviewModal({ simulation, isOpen, onClose }) {
  const router = useRouter();

  if (!isOpen || !simulation) return null;

  // Format date
  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  // Get severity color
  const getSeverityColor = (severity) => {
    if (severity === "heavy" || severity >= 2) return "text-red-600 bg-red-100";
    if (severity === "moderate" || (severity >= 1 && severity < 2))
      return "text-yellow-600 bg-yellow-100";
    return "text-green-600 bg-green-100";
  };

  // Get status color
  const getStatusColor = (status) => {
    if (status === "published") return "bg-blue-500";
    if (status === "completed") return "bg-green-500";
    return "bg-gray-500";
  };

  // Prepare chart data (first 12 hours or all if less)
  const chartData =
    simulation.results?.slice(0, 12).map((result, idx) => ({
      hour: `H${idx}`,
      severity: result.severity || result.delay_ratio || 0,
    })) || [];

  // Calculate metrics with proper type checking
  const avgSeverity = parseFloat(simulation.average_delay_ratio) || 0;
  const totalHours = parseInt(simulation.total_affected_segments) || 0;
  const severityLabel =
    avgSeverity >= 2 ? "Heavy" : avgSeverity >= 1 ? "Moderate" : "Light";

  // Handle Edit
  const handleEdit = () => {
    onClose();
    router.push(`/data?edit=${simulation.simulation_id}`);
  };

  // Handle View Full Report
  const handleViewReport = () => {
    onClose();
    router.push(`/simulation/${simulation.simulation_id}`);
  };

  return (
    <>
       {/* Backdrop - increase z-index */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Modal - increase z-index to be above backdrop */}
      <div className="fixed inset-0 z-[101] flex items-center justify-center p-4 pointer-events-none">
        <div
          className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto pointer-events-auto animate-in zoom-in-95 duration-200"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="sticky top-0 bg-gradient-to-r from-orange-500 to-orange-600 text-white p-6 rounded-t-2xl">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h2 className="text-2xl font-bold mb-1">
                  {simulation.simulation_name || "Unnamed Simulation"}
                </h2>
                <p className="text-orange-100 text-sm">
                  {simulation.description || "No description provided"}
                </p>
              </div>
              <button
                onClick={onClose}
                className="ml-4 p-2 hover:bg-white/20 rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Status Badge */}
            <div className="mt-4 flex items-center gap-2">
              <span
                className={`${getStatusColor(
                  simulation.simulation_status
                )} text-white px-3 py-1 rounded-full text-xs font-semibold capitalize`}
              >
                {simulation.simulation_status || "draft"}
              </span>
              <span className="text-orange-100 text-xs">
                • Created {formatDate(simulation.created_at)}
              </span>
            </div>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6">
            {/* Quick Info Grid */}
            <div className="grid grid-cols-2 gap-4">
              {/* Location */}
              <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-lg">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <MapPin className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500 font-medium">Location</p>
                  <p className="text-sm font-semibold text-gray-800 mt-1">
                    {simulation.disruption_location || "Unknown"}
                  </p>
                </div>
              </div>

              {/* Type */}
              <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-lg">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <AlertTriangle className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500 font-medium">Type</p>
                  <p className="text-sm font-semibold text-gray-800 mt-1 capitalize">
                    {simulation.disruption_type || "General"}
                  </p>
                </div>
              </div>

              {/* Duration */}
              <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-lg">
                <div className="p-2 bg-green-100 rounded-lg">
                  <Clock className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500 font-medium">Duration</p>
                  <p className="text-sm font-semibold text-gray-800 mt-1">
                    {totalHours > 0 ? `${totalHours} hours` : "N/A"}
                  </p>
                </div>
              </div>

              {/* Severity */}
              <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-lg">
                <div className="p-2 bg-orange-100 rounded-lg">
                  <TrendingUp className="w-5 h-5 text-orange-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500 font-medium">Avg Severity</p>
                  <p
                    className={`text-sm font-semibold mt-1 ${
                      avgSeverity >= 2
                        ? "text-red-600"
                        : avgSeverity >= 1
                        ? "text-yellow-600"
                        : "text-green-600"
                    }`}
                  >
                    {severityLabel} ({avgSeverity.toFixed(1)})
                  </p>
                </div>
              </div>
            </div>

            {/* Mini Chart */}
            {chartData.length > 0 && (
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-gray-800 mb-3">
                  Severity Over Time (First 12 Hours)
                </h3>
                <ResponsiveContainer width="100%" height={180}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis
                      dataKey="hour"
                      tick={{ fill: "#6b7280", fontSize: 11 }}
                    />
                    <YAxis
                      domain={[0, 3]}
                      ticks={[0, 1, 2, 3]}
                      tick={{ fill: "#6b7280", fontSize: 11 }}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#fff",
                        border: "1px solid #e5e7eb",
                        borderRadius: "8px",
                        fontSize: "12px",
                      }}
                      formatter={(value) => {
                        const label =
                          value < 1 ? "Light" : value < 2 ? "Moderate" : "Heavy";
                        return [label, "Severity"];
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="severity"
                      stroke="#f97316"
                      strokeWidth={2}
                      dot={{ fill: "#f97316", r: 3 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Date Range */}
            {simulation.start_time && simulation.end_time && (
              <div className="flex items-center gap-2 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <Calendar className="w-5 h-5 text-blue-600" />
                <div className="text-sm">
                  <span className="font-semibold text-gray-800">
                    {formatDate(simulation.start_time)}
                  </span>
                  <span className="text-gray-500 mx-2">→</span>
                  <span className="font-semibold text-gray-800">
                    {formatDate(simulation.end_time)}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 p-6 rounded-b-2xl">
            <div className="flex gap-3">
              <button
                onClick={handleEdit}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-white border-2 border-orange-500 text-orange-500 rounded-lg font-semibold hover:bg-orange-50 transition"
              >
                <Edit className="w-4 h-4" />
                Edit Simulation
              </button>
              <button
                onClick={handleViewReport}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-orange-500 text-white rounded-lg font-semibold hover:bg-orange-600 transition shadow-lg"
              >
                <FileText className="w-4 h-4" />
                View Full Report
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}