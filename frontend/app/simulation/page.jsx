// frontend/app/simulation/page.jsx - COMPLETE VERSION

"use client";

import { useState, useRef } from "react";
import dynamic from "next/dynamic";
import PlannerNavbar from "@/components/PlannerNavbar";
import api from "@/services/api";
import { getRoadInfoFromOSM, getRoadSegmentsInArea } from "@/services/osmService";

// Import map with drawing tools
const SimulationMap = dynamic(() => import("@/components/SimulationMap"), {
  ssr: false,
  loading: () => (
    <div className="h-[400px] bg-gray-200 flex items-center justify-center rounded-lg">
      Loading map...
    </div>
  ),
});

export default function SimulationPage() {
  const [isMapExpanded, setIsMapExpanded] = useState(false);
  const [drawMode, setDrawMode] = useState('point'); // 'point', 'line', 'polygon'
  
  const [formData, setFormData] = useState({
    scenarioName: "",
    disruptionType: "roadwork",
    startDate: "",
    startTime: "06:00",
    endDate: "",
    endTime: "18:00",
    description: "",
  });

  const [selectedLocation, setSelectedLocation] = useState(null);
  const [roadInfo, setRoadInfo] = useState(null);
  const [loadingRoadInfo, setLoadingRoadInfo] = useState(false);
  
  const [results, setResults] = useState(null);
  const [simulating, setSimulating] = useState(false);
  const [error, setError] = useState(null);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
    setError(null);
  };

  // Handle point selection on map
  const handlePointSelect = async (lat, lng) => {
    setLoadingRoadInfo(true);
    setError(null);

    try {
      // Get road info from OSM
      const osmData = await getRoadInfoFromOSM(lat, lng);

      if (!osmData.success) {
        setError(osmData.message);
        setLoadingRoadInfo(false);
        return;
      }

      setSelectedLocation({
        type: 'point',
        coordinates: [{ lat, lng }],
        center: { lat, lng },
      });

      // Process road info through backend
      const response = await fetch('http://localhost:5000/api/process-road-info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(osmData),
      });

      const processedData = await response.json();

      if (processedData.success) {
        setRoadInfo(processedData.road_info);
      } else {
        throw new Error('Failed to process road information');
      }
    } catch (err) {
      console.error('Error fetching road info:', err);
      setError('Failed to get road information. Please try another location.');
    } finally {
      setLoadingRoadInfo(false);
    }
  };

  // Handle line/polygon drawing
  const handleAreaSelect = async (coordinates) => {
    setLoadingRoadInfo(true);
    setError(null);

    try {
      // Get all road segments in the drawn area
      const osmData = await getRoadSegmentsInArea(coordinates);

      if (!osmData.success || osmData.roads.length === 0) {
        setError('No roads found in selected area');
        setLoadingRoadInfo(false);
        return;
      }

      setSelectedLocation({
        type: drawMode,
        coordinates: coordinates,
        center: {
          lat: coordinates.reduce((sum, c) => sum + c.lat, 0) / coordinates.length,
          lng: coordinates.reduce((sum, c) => sum + c.lng, 0) / coordinates.length,
        },
      });

      // Aggregate road information (take primary road or average)
      const mainRoad = osmData.roads[0]; // Primary road in area
      
      const response = await fetch('http://localhost:5000/api/process-road-info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...mainRoad,
          total_roads_affected: osmData.roads.length,
        }),
      });

      const processedData = await response.json();

      if (processedData.success) {
        setRoadInfo({
          ...processedData.road_info,
          affected_roads: osmData.roads.length,
        });
      }
    } catch (err) {
      console.error('Error fetching area road info:', err);
      setError('Failed to analyze selected area. Please try again.');
    } finally {
      setLoadingRoadInfo(false);
    }
  };

  const handleSimulate = async () => {
    if (!selectedLocation || !roadInfo) {
      setError('Please select a location on the map first');
      return;
    }

    if (!formData.startDate || !formData.endDate) {
      setError('Please select start and end dates');
      return;
    }

    setSimulating(true);
    setError(null);

    try {
      const simulationData = {
        area: roadInfo.area,
        road_corridor: roadInfo.road_name,
        disruption_type: formData.disruptionType,
        start_date: formData.startDate,
        start_time: formData.startTime,
        end_date: formData.endDate,
        end_time: formData.endTime,
        description: formData.description,
        road_info: {
          lanes: roadInfo.lanes,
          length_km: roadInfo.length_km,
          width_meters: roadInfo.width_meters,
          max_speed: roadInfo.max_speed,
          total_capacity: roadInfo.total_capacity,
          free_flow_time_minutes: roadInfo.free_flow_time_minutes,
          disruption_factors: roadInfo.disruption_factors,
          road_type: roadInfo.road_type,
        },
        coordinates: selectedLocation.center,
      };

      const response = await fetch('http://localhost:5000/api/simulate-disruption', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(simulationData),
      });

      const data = await response.json();

      if (data.success) {
        setResults(data);
        document.getElementById('results-section')?.scrollIntoView({ behavior: 'smooth' });
      } else {
        throw new Error(data.error || 'Simulation failed');
      }
    } catch (err) {
      console.error('Simulation error:', err);
      setError(err.message || 'Failed to run simulation');
    } finally {
      setSimulating(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <PlannerNavbar />

      <main className="container mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-800">Traffic Disruption Simulation</h1>
          <p className="text-gray-600 mt-2">
            Select disruption area on the map and configure simulation parameters
          </p>
        </div>

        <div className="grid lg:grid-cols-12 gap-6">
          {/* Left Column - Map */}
          <div className={`${isMapExpanded ? 'lg:col-span-12' : 'lg:col-span-7'} space-y-4`}>
            {/* Drawing Mode Selector */}
            <div className="bg-white rounded-lg shadow-md p-4">
              <h3 className="font-semibold text-gray-800 mb-3">Selection Mode</h3>
              <div className="flex gap-2">
                <button
                  onClick={() => setDrawMode('point')}
                  className={`flex-1 px-4 py-2 rounded-lg font-semibold transition ${
                    drawMode === 'point'
                      ? 'bg-orange-500 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  📍 Point
                </button>
                <button
                  onClick={() => setDrawMode('line')}
                  className={`flex-1 px-4 py-2 rounded-lg font-semibold transition ${
                    drawMode === 'line'
                      ? 'bg-orange-500 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  ➖ Line
                </button>
                <button
                  onClick={() => setDrawMode('polygon')}
                  className={`flex-1 px-4 py-2 rounded-lg font-semibold transition ${
                    drawMode === 'polygon'
                      ? 'bg-orange-500 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  ⬟ Area
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                {drawMode === 'point' && '• Click on the map to select a point'}
                {drawMode === 'line' && '• Click multiple points to draw a line (double-click to finish)'}
                {drawMode === 'polygon' && '• Click to draw an area boundary (double-click to close)'}
              </p>
            </div>

            {/* Map */}
            <SimulationMap
              isExpanded={isMapExpanded}
              onExpand={() => setIsMapExpanded(!isMapExpanded)}
              drawMode={drawMode}
              onPointSelect={handlePointSelect}
              onAreaSelect={handleAreaSelect}
              selectedLocation={selectedLocation}
            />

            {/* Road Information Display */}
            {loadingRoadInfo && (
              <div className="bg-blue-50 border-l-4 border-blue-500 rounded-lg p-4">
                <div className="flex items-center gap-3">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                  <p className="text-blue-800 font-semibold">Fetching road information from OpenStreetMap...</p>
                </div>
              </div>
            )}

            {roadInfo && !loadingRoadInfo && (
              <div className="bg-green-50 border-l-4 border-green-500 rounded-lg p-4">
                <h3 className="font-bold text-green-800 mb-2">📍 Road Information</h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-gray-600">Name:</span>
                    <span className="font-semibold text-gray-800 ml-2">{roadInfo.road_name}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Area:</span>
                    <span className="font-semibold text-gray-800 ml-2">{roadInfo.area}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Type:</span>
                    <span className="font-semibold text-gray-800 ml-2">{roadInfo.road_type}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Lanes:</span>
                    <span className="font-semibold text-gray-800 ml-2">{roadInfo.lanes}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Length:</span>
                    <span className="font-semibold text-gray-800 ml-2">{roadInfo.length_km} km</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Capacity:</span>
                    <span className="font-semibold text-gray-800 ml-2">{roadInfo.total_capacity} veh/hr</span>
                  </div>
                  {roadInfo.affected_roads && (
                    <div className="col-span-2">
                      <span className="text-gray-600">Roads affected:</span>
                      <span className="font-semibold text-gray-800 ml-2">{roadInfo.affected_roads}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {error && (
              <div className="bg-red-50 border-l-4 border-red-500 rounded-lg p-4">
                <p className="text-red-700">{error}</p>
              </div>
            )}
          </div>

          {/* Right Column - Form */}
          {!isMapExpanded && (
            <div className="lg:col-span-5">
              <div className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-xl font-bold text-gray-800 mb-6">Simulation Details</h2>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Scenario Name
                    </label>
                    <input
                      type="text"
                      name="scenarioName"
                      value={formData.scenarioName}
                      onChange={handleChange}
                      placeholder="Enter scenario name"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Disruption Type
                    </label>
                    <select
                      name="disruptionType"
                      value={formData.disruptionType}
                      onChange={handleChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                    >
                      <option value="roadwork">🚧 Roadwork</option>
                      <option value="event">🎉 Event</option>
                      <option value="accident">⚠️ Accident</option>
                      <option value="weather">🌧️ Weather</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">
                        Start Date
                      </label>
                      <input
                        type="date"
                        name="startDate"
                        value={formData.startDate}
                        onChange={handleChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">
                        Start Time
                      </label>
                      <input
                        type="time"
                        name="startTime"
                        value={formData.startTime}
                        onChange={handleChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">
                        End Date
                      </label>
                      <input
                        type="date"
                        name="endDate"
                        value={formData.endDate}
                        onChange={handleChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">
                        End Time
                      </label>
                      <input
                        type="time"
                        name="endTime"
                        value={formData.endTime}
                        onChange={handleChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Description (Optional)
                    </label>
                    <textarea
                      name="description"
                      value={formData.description}
                      onChange={handleChange}
                      rows="3"
                      placeholder="Describe the disruption..."
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                    ></textarea>
                  </div>

                  {results && (
                    <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                      <h3 className="font-bold text-gray-800 text-sm">Quick Results</h3>
                      <div className="space-y-2">
                        <div className="flex justify-between text-xs">
                          <span>Light</span>
                          <span className="font-semibold text-green-600">
                            {results.summary.light_percentage}%
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-green-500 h-2 rounded-full"
                            style={{ width: `${results.summary.light_percentage}%` }}
                          ></div>
                        </div>

                        <div className="flex justify-between text-xs">
                          <span>Moderate</span>
                          <span className="font-semibold text-yellow-600">
                            {results.summary.moderate_percentage}%
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-yellow-500 h-2 rounded-full"
                            style={{ width: `${results.summary.moderate_percentage}%` }}
                          ></div>
                        </div>

                        <div className="flex justify-between text-xs">
                          <span>Heavy</span>
                          <span className="font-semibold text-red-600">
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
                    </div>
                  )}

                  <div className="flex gap-3 pt-4">
                    <button
                      onClick={() => {
                        setFormData({
                          scenarioName: "",
                          disruptionType: "roadwork",
                          startDate: "",
                          startTime: "06:00",
                          endDate: "",
                          endTime: "18:00",
                          description: "",
                        });
                        setResults(null);
                        setSelectedLocation(null);
                        setRoadInfo(null);
                      }}
                      className="flex-1 px-4 py-2 bg-white border-2 border-orange-500 text-orange-600 rounded-lg font-semibold hover:bg-orange-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSimulate}
                      disabled={simulating || !roadInfo}
                      className={`flex-1 px-4 py-2 rounded-lg font-semibold text-white ${
                        simulating || !roadInfo ? 'bg-gray-400' : 'bg-orange-500 hover:bg-orange-600'
                      }`}
                    >
                      {simulating ? 'Simulating...' : 'Simulate'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Results Section */}
        {results && !isMapExpanded && (
          <div id="results-section" className="mt-6 bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4">Detailed Results</h2>
            
            <div className="grid md:grid-cols-4 gap-4 mb-6">
              <div className="bg-gray-50 rounded-lg p-4 text-center">
                <p className="text-sm text-gray-600 mb-1">Total Hours</p>
                <p className="text-3xl font-bold text-gray-800">{results.summary.total_hours}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4 text-center">
                <p className="text-sm text-gray-600 mb-1">Avg Severity</p>
                <p className="text-3xl font-bold text-orange-600">{results.summary.avg_severity}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4 text-center">
                <p className="text-sm text-gray-600 mb-1">Avg Delay</p>
                <p className="text-3xl font-bold text-red-600">+{results.summary.avg_delay_minutes} min</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4 text-center">
                <p className="text-sm text-gray-600 mb-1">Assessment</p>
                <p className="text-2xl font-bold text-yellow-600">{results.summary.avg_severity_label}</p>
              </div>
            </div>

            <div className="flex gap-3">
              <button className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700">
                💾 Save Scenario
              </button>
              <button className="flex-1 bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700">
                ✅ Publish Results
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}