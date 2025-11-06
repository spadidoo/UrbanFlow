"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import PlannerNavbar from "@/components/PlannerNavbar";
import api from "@/services/api";

// Import map component dynamically (Leaflet needs client-side)
const MapWrapper = dynamic(() => import("@/components/MapWrapper"), {
  ssr: false,
  loading: () => (
    <div className="h-[500px] bg-gray-200 flex items-center justify-center rounded-lg">
      Loading map...
    </div>
  ),
});

export default function SimulationPage() {
  // Form state
  const [formData, setFormData] = useState({
    area: "Bucal",
    road_corridor: "Calamba_Pagsanjan",
    disruption_type: "roadwork",
    start_date: "",
    start_time: "06:00",
    end_date: "",
    end_time: "18:00",
    description: "",
  });

  // Map state
  const [selectedLocation, setSelectedLocation] = useState(null);

  // Simulation state
  const [simulating, setSimulating] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);

  // Handle form input changes
  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
    setError(null);
  };

  // Handle map click
  const handleMapClick = async (lat, lng) => {
    try {
      // Get road info from backend
      const response = await api.getRoadInfo(lat, lng);

      if (response.success) {
        setSelectedLocation({
          lat,
          lng,
          ...response,
        });

        // Update form with road info
        setFormData({
          ...formData,
          area: response.area,
          road_corridor: response.road_corridor,
        });

        setError(null);
      } else {
        setError("Location not in covered area. Please select a different location.");
        setSelectedLocation(null);
      }
    } catch (err) {
      console.error("Failed to get road info:", err);
      setError("Failed to identify road. Please try again.");
    }
  };

  // Handle simulation submission
  const handleSimulate = async (e) => {
    e.preventDefault();
    setSimulating(true);
    setError(null);
    setResults(null);

    try {
      // Validate dates
      if (!formData.start_date || !formData.end_date) {
        throw new Error("Please select start and end dates");
      }

      const startDateTime = new Date(`${formData.start_date}T${formData.start_time}`);
      const endDateTime = new Date(`${formData.end_date}T${formData.end_time}`);

      if (endDateTime <= startDateTime) {
        throw new Error("End date/time must be after start date/time");
      }

      // Prepare simulation data
      const simulationData = {
        area: formData.area,
        road_corridor: formData.road_corridor,
        disruption_type: formData.disruption_type,
        start_date: formData.start_date,
        start_time: formData.start_time,
        end_date: formData.end_date,
        end_time: formData.end_time,
        description: formData.description,
        coordinates: selectedLocation
          ? { lat: selectedLocation.lat, lon: selectedLocation.lng }
          : null,
      };

      // Call API
      const response = await api.simulateDisruption(simulationData);

      if (response.success) {
        setResults(response);

        // Scroll to results
        document.getElementById("results-section")?.scrollIntoView({
          behavior: "smooth",
        });
      } else {
        throw new Error(response.error || "Simulation failed");
      }
    } catch (err) {
      console.error("Simulation error:", err);
      setError(err.message || "Failed to run simulation. Please try again.");
    } finally {
      setSimulating(false);
    }
  };

  // Get recommendations
  const getRecommendations = async () => {
    if (!results) return;

    try {
      const recResponse = await api.getRecommendations({
        disruption_type: formData.disruption_type,
        avg_severity: results.summary.avg_severity,
        heavy_percentage: results.summary.heavy_percentage,
        peak_hours_affected: true,
      });

      if (recResponse.success) {
        setResults({
          ...results,
          recommendations: recResponse.recommendations,
        });
      }
    } catch (err) {
      console.error("Failed to get recommendations:", err);
    }
  };

  // Auto-fetch recommendations when results available
  useState(() => {
    if (results && !results.recommendations) {
      getRecommendations();
    }
  }, [results]);

  return (
    <div className="min-h-screen bg-gray-50">
      <PlannerNavbar />

      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            Traffic Disruption Simulation
          </h1>
          <p className="text-gray-600">
            Predict traffic impact of planned disruptions using Random Forest ML model
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Left Column: Form */}
          <div className="space-y-6">
            {/* Map Selection */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-bold text-gray-800 mb-4">
                📍 Step 1: Select Location
              </h2>
              <p className="text-sm text-gray-600 mb-4">
                Click on the map to select the disruption location
              </p>

              <MapWrapper onMapClick={handleMapClick} selectedLocation={selectedLocation} />

              {selectedLocation && (
                <div className="mt-4 bg-green-50 border border-green-200 rounded-lg p-3">
                  <p className="text-sm text-green-800 font-semibold">
                    ✓ Location Selected
                  </p>
                  <p className="text-xs text-green-700 mt-1">
                    {selectedLocation.road_name} - {selectedLocation.area}
                  </p>
                  <p className="text-xs text-gray-600 mt-1">
                    Coordinates: {selectedLocation.lat.toFixed(4)}, {selectedLocation.lng.toFixed(4)}
                  </p>
                </div>
              )}
            </div>

            {/* Form */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-bold text-gray-800 mb-4">
                📝 Step 2: Disruption Details
              </h2>

              <form onSubmit={handleSimulate} className="space-y-4">
                {/* Disruption Type */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Disruption Type *
                  </label>
                  <select
                    name="disruption_type"
                    value={formData.disruption_type}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                  >
                    <option value="roadwork">🚧 Roadwork</option>
                    <option value="event">🎉 Event</option>
                    <option value="accident">⚠️ Accident</option>
                    <option value="weather">🌧️ Weather</option>
                    <option value="incident">🚨 Incident</option>
                  </select>
                </div>

                {/* Start Date & Time */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Start Date *
                    </label>
                    <input
                      type="date"
                      name="start_date"
                      value={formData.start_date}
                      onChange={handleChange}
                      required
                      min={new Date().toISOString().split("T")[0]}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Start Time *
                    </label>
                    <input
                      type="time"
                      name="start_time"
                      value={formData.start_time}
                      onChange={handleChange}
                      required
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                  </div>
                </div>

                {/* End Date & Time */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      End Date *
                    </label>
                    <input
                      type="date"
                      name="end_date"
                      value={formData.end_date}
                      onChange={handleChange}
                      required
                      min={formData.start_date || new Date().toISOString().split("T")[0]}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      End Time *
                    </label>
                    <input
                      type="time"
                      name="end_time"
                      value={formData.end_time}
                      onChange={handleChange}
                      required
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Description (Optional)
                  </label>
                  <textarea
                    name="description"
                    value={formData.description}
                    onChange={handleChange}
                    rows="3"
                    placeholder="e.g., Road repair, Festival celebration, etc."
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                  ></textarea>
                </div>

                {/* Error Message */}
                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <p className="text-sm text-red-700">{error}</p>
                  </div>
                )}

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={simulating || !selectedLocation}
                  className={`w-full py-3 rounded-lg font-semibold text-white transition ${
                    simulating || !selectedLocation
                      ? "bg-gray-400 cursor-not-allowed"
                      : "bg-orange-500 hover:bg-orange-600"
                  }`}
                >
                  {simulating ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg
                        className="animate-spin h-5 w-5"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        ></circle>
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        ></path>
                      </svg>
                      Running Simulation...
                    </span>
                  ) : (
                    "🚀 Run Simulation"
                  )}
                </button>

                {!selectedLocation && (
                  <p className="text-xs text-center text-gray-500">
                    Please select a location on the map first
                  </p>
                )}
              </form>
            </div>
          </div>

          {/* Right Column: Results */}
          <div id="results-section" className="space-y-6">
            {!results && !simulating && (
              <div className="bg-white rounded-lg shadow-md p-12 text-center">
                <div className="text-6xl mb-4">📊</div>
                <h3 className="text-xl font-bold text-gray-800 mb-2">
                  No Simulation Yet
                </h3>
                <p className="text-gray-600">
                  Select a location and fill in the form to run your first simulation
                </p>
              </div>
            )}

            {simulating && (
              <div className="bg-white rounded-lg shadow-md p-12 text-center">
                <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-orange-500 mx-auto mb-4"></div>
                <h3 className="text-xl font-bold text-gray-800 mb-2">
                  Running Simulation...
                </h3>
                <p className="text-gray-600">
                  Analyzing traffic patterns with Random Forest model
                </p>
              </div>
            )}

            {results && (
              <>
                {/* Summary Card */}
                <div className="bg-white rounded-lg shadow-md p-6">
                  <h2 className="text-xl font-bold text-gray-800 mb-4">
                    📊 Simulation Results
                  </h2>

                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="bg-gray-50 rounded-lg p-4 text-center">
                      <p className="text-sm text-gray-600 mb-1">Total Hours</p>
                      <p className="text-2xl font-bold text-gray-800">
                        {results.summary.total_hours}
                      </p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4 text-center">
                      <p className="text-sm text-gray-600 mb-1">Duration</p>
                      <p className="text-2xl font-bold text-gray-800">
                        {results.summary.duration_days} days
                      </p>
                    </div>
                  </div>

                  {/* Traffic Distribution */}
                  <div className="space-y-2 mb-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-gray-700">Light Traffic</span>
                      <span className="text-sm font-bold text-green-600">
                        {results.summary.light_percentage}%
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-green-500 h-2 rounded-full"
                        style={{ width: `${results.summary.light_percentage}%` }}
                      ></div>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-gray-700">Moderate Traffic</span>
                      <span className="text-sm font-bold text-yellow-600">
                        {results.summary.moderate_percentage}%
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-yellow-500 h-2 rounded-full"
                        style={{ width: `${results.summary.moderate_percentage}%` }}
                      ></div>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-gray-700">Heavy Traffic</span>
                      <span className="text-sm font-bold text-red-600">
                        {results.summary.heavy_percentage}%
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-red-500 h-2 rounded-full"
                        style={{ width: `${results.summary.heavy_percentage}%` }}
                      ></div>
                    </div>
                  </div>

                  {/* Average Severity */}
                  <div className="bg-gradient-to-r from-orange-50 to-orange-100 rounded-lg p-4 border border-orange-200">
                    <p className="text-sm text-gray-700 mb-1">Overall Assessment</p>
                    <p className={`text-2xl font-bold ${
                      results.summary.avg_severity_label === 'Heavy' ? 'text-red-600' :
                      results.summary.avg_severity_label === 'Moderate' ? 'text-yellow-600' :
                      'text-green-600'
                    }`}>
                      {results.summary.avg_severity_label} Congestion
                    </p>
                    <p className="text-xs text-gray-600 mt-1">
                      Average severity: {results.summary.avg_severity.toFixed(2)}
                    </p>
                  </div>
                </div>

                {/* Delay Statistics */}
                {results.hourly_predictions && results.hourly_predictions[0].delay_info && (
                  <div className="bg-white rounded-lg shadow-md p-6">
                    <h3 className="text-lg font-bold text-gray-800 mb-4">⏱️ Delay Estimates</h3>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-blue-50 rounded-lg p-4">
                        <p className="text-xs text-gray-600 mb-1">Average Delay</p>
                        <p className="text-xl font-bold text-blue-600">
                          +{(
                            results.hourly_predictions.reduce(
                              (sum, p) => sum + p.delay_info.additional_delay_min,
                              0
                            ) / results.hourly_predictions.length
                          ).toFixed(1)}{" "}
                          min
                        </p>
                      </div>

                      <div className="bg-red-50 rounded-lg p-4">
                        <p className="text-xs text-gray-600 mb-1">Maximum Delay</p>
                        <p className="text-xl font-bold text-red-600">
                          +{Math.max(
                            ...results.hourly_predictions.map((p) => p.delay_info.additional_delay_min)
                          ).toFixed(1)}{" "}
                          min
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Hourly Breakdown */}
                <div className="bg-white rounded-lg shadow-md p-6">
                  <h3 className="text-lg font-bold text-gray-800 mb-4">
                    🕐 Hourly Predictions
                  </h3>

                  <div className="max-h-96 overflow-y-auto space-y-2">
                    {results.hourly_predictions.slice(0, 24).map((pred, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition"
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-mono text-gray-700">
                            {pred.datetime}
                          </span>
                          <span
                            className={`text-xs px-2 py-1 rounded font-semibold ${
                              pred.severity_label === "Heavy"
                                ? "bg-red-100 text-red-700"
                                : pred.severity_label === "Moderate"
                                ? "bg-yellow-100 text-yellow-700"
                                : "bg-green-100 text-green-700"
                            }`}
                          >
                            {pred.severity_label}
                          </span>
                        </div>
                        {pred.delay_info && (
                          <span className="text-sm text-gray-600">
                            +{pred.delay_info.additional_delay_min} min
                          </span>
                        )}
                      </div>
                    ))}
                  </div>

                  {results.hourly_predictions.length > 24 && (
                    <p className="text-xs text-center text-gray-500 mt-3">
                      Showing first 24 hours of {results.hourly_predictions.length} total hours
                    </p>
                  )}
                </div>

                {/* Recommendations */}
                {results.recommendations && (
                  <div className="bg-white rounded-lg shadow-md p-6">
                    <h3 className="text-lg font-bold text-gray-800 mb-4">
                      💡 Mitigation Recommendations
                    </h3>

                    <div className="space-y-3">
                      {results.recommendations.map((rec, idx) => (
                        <div
                          key={idx}
                          className={`border-l-4 rounded-lg p-4 ${
                            rec.priority === "high"
                              ? "bg-red-50 border-red-500"
                              : rec.priority === "medium"
                              ? "bg-yellow-50 border-yellow-500"
                              : "bg-blue-50 border-blue-500"
                          }`}
                        >
                          <div className="flex items-start justify-between mb-2">
                            <span
                              className={`text-xs font-bold px-2 py-1 rounded uppercase ${
                                rec.priority === "high"
                                  ? "bg-red-100 text-red-700"
                                  : rec.priority === "medium"
                                  ? "bg-yellow-100 text-yellow-700"
                                  : "bg-blue-100 text-blue-700"
                              }`}
                            >
                              {rec.priority}
                            </span>
                            <span className="text-xs bg-white px-2 py-1 rounded text-gray-600">
                              {rec.category}
                            </span>
                          </div>
                          <p className="font-semibold text-gray-800 mb-1">
                            {rec.recommendation}
                          </p>
                          <p className="text-sm text-gray-600">{rec.reason}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex gap-4">
                  <button
                    onClick={() => {
                      setResults(null);
                      setSelectedLocation(null);
                      setFormData({
                        ...formData,
                        description: "",
                      });
                    }}
                    className="flex-1 bg-gray-500 text-white py-3 rounded-lg hover:bg-gray-600 transition font-semibold"
                  >
                    🔄 New Simulation
                  </button>
                  <button
                    onClick={() => alert("Save functionality coming soon!")}
                    className="flex-1 bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition font-semibold"
                  >
                    💾 Save Draft
                  </button>
                  <button
                    onClick={() => alert("Publish functionality coming soon!")}
                    className="flex-1 bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 transition font-semibold"
                  >
                    ✅ Publish
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}