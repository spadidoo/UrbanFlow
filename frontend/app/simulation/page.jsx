// frontend/app/simulation/page.jsx - COMPLETE VERSION

"use client";

import PlannerNavbar from "@/components/PlannerNavbar";
import { getRoadInfoFromOSM, getRoadSegmentsInArea } from "@/services/osmService";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";



const SmartResultsMap = dynamic(() => import("@/components/SmartResultsMap"), {
  ssr: false,
  loading: () => <div className="h-[550px] bg-gray-200 flex items-center justify-center rounded-lg">Loading...</div>,
});

// Import map with drawing tools
const SimulationMap = dynamic(() => import("@/components/SimulationMap"), {
  ssr: false,
  loading: () => (
    <div className="h-[400px] bg-gray-200 flex items-center justify-center rounded-lg">
      Loading map...
    </div>
  ),
});

const AggregatedResultsMaps = dynamic(() => import("@/components/AggregatedResultsMaps"), {
  ssr: false,
  loading: () => <div>Loading maps...</div>,
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

  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [savedSimulationId, setSavedSimulationId] = useState(null);
  const [publishing, setPublishing] = useState(false);
  const [publishSuccess, setPublishSuccess] = useState(false);

//=======================================
// Load simulation data if editing
//=======================================
  useEffect(() => {
    const editData = sessionStorage.getItem('editSimulation');
    if (editData) {
      try {
        const simulation = JSON.parse(editData);
        
        // Pre-fill form
        setFormData({
          scenarioName: simulation.simulation_name || "",
          disruptionType: simulation.disruption_type || "roadwork",
          startDate: simulation.start_time ? simulation.start_time.split('T')[0] : "",
          startTime: simulation.start_time ? simulation.start_time.split('T')[1].substring(0, 5) : "06:00",
          endDate: simulation.end_time ? simulation.end_time.split('T')[0] : "",
          endTime: simulation.end_time ? simulation.end_time.split('T')[1].substring(0, 5) : "18:00",
          description: simulation.description || "",
        });

        // Pre-fill location if available
        if (simulation.disruption_geometry) {
          // Extract coordinates from WKT geometry
          const wkt = simulation.disruption_geometry;
          const match = wkt.match(/POINT\(([^ ]+) ([^)]+)\)/);
          if (match) {
            const lng = parseFloat(match[1]);
            const lat = parseFloat(match[2]);
            
            setSelectedLocation({
              type: 'point',
              coordinates: [{ lat, lng }],
              center: { lat, lng },
            });

            // Optionally fetch road info for this location
            handlePointSelect(lat, lng);
          }
        }

        // Clear from session storage after loading
        sessionStorage.removeItem('editSimulation');
        
        alert("📝 Simulation loaded for editing");
      } catch (error) {
        console.error("Error loading edit data:", error);
      }
    }
  }, []);

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

     setSelectedLocation({
      type: 'point',
      coordinates: [{ lat, lng }],
      center: { lat, lng },
    });

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

    // ✅ ADD DATE VALIDATION
    const startDateTime = new Date(`${formData.startDate}T${formData.startTime}`);
    const endDateTime = new Date(`${formData.endDate}T${formData.endTime}`);

    if (endDateTime <= startDateTime) {
        setError('End date/time must be after start date/time');
        return;
      }

      const durationHours = (endDateTime - startDateTime) / (1000 * 60 * 60);

      if (durationHours > 720) {
        setError('Disruption duration cannot exceed 30 days');
        return;
      }

      if (durationHours < 1) {
        setError('Disruption duration must be at least 1 hour');
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

      console.log('🚀 Sending simulation request:', simulationData);

      const response = await fetch('http://localhost:5000/api/simulate-disruption-realtime', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(simulationData),
      });

      const data = await response.json();

      console.log('📦 Received response:', data);

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

  const handleSaveSimulation = async () => {
    setSaving(true);
    setError(null);
    setSaveSuccess(false);

    try {
      const savePayload = {
        user_id: 2, // Default planner user - you'll replace this with actual auth later
        simulation_data: {
          scenario_name: formData.scenarioName || `Simulation ${new Date().toLocaleString()}`,
          description: formData.description || 'No description provided',
          disruption_type: formData.disruptionType,
          area: roadInfo?.area || 'Unknown Area',
          road_corridor: roadInfo?.road_name || 'Unknown Road',
          start_datetime: `${formData.startDate}T${formData.startTime}:00`,
          end_datetime: `${formData.endDate}T${formData.endTime}:00`,
          disruption_location: `${roadInfo?.area || 'Unknown'} - ${roadInfo?.road_name || 'Unknown'}`,
          coordinates: selectedLocation?.center || null,
          severity_level: results.summary.avg_severity < 0.5 ? 'light' : 
                        results.summary.avg_severity < 1.5 ? 'moderate' : 'severe'
        },
        results_data: {
          summary: results.summary,
          hourly_predictions: results.hourly_predictions,
          aggregated_view: results.aggregated_view || null,
          time_segments: results.time_segments
        }
      };

      const response = await fetch('http://localhost:5000/api/save-simulation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(savePayload),
      });

      const data = await response.json();

      if (data.success) {
        setSaveSuccess(true);
        setSavedSimulationId(data.simulation_id);
        alert(`✅ Simulation saved successfully!\nSimulation ID: ${data.simulation_id}`);
      } else {
        throw new Error(data.error || 'Failed to save simulation');
      }
    } catch (err) {
      console.error('Error saving simulation:', err);
      setError(`Failed to save simulation: ${err.message}`);
      alert(`❌ Error: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handlePublishSimulation = async () => {
    // Check if simulation is saved first
    if (!savedSimulationId) {
      alert('⚠️ Please save the simulation first before publishing!');
      return;
    }

    setPublishing(true);
    setError(null);
    setPublishSuccess(false);

    try {
      const publishPayload = {
        simulation_id: savedSimulationId,
        user_id: 2, // Default planner user - will use auth later
        title: formData.scenarioName || `Traffic Disruption - ${new Date().toLocaleDateString()}`,
        public_description: formData.description || 
          `${formData.disruptionType} disruption affecting ${roadInfo?.area || 'the area'}. ` +
          `Expected ${results.summary.avg_severity_label} congestion with average delays of ` +
          `${results.summary.avg_delay_minutes} minutes.`
      };

      const response = await fetch('http://localhost:5000/api/publish-simulation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(publishPayload),
      });

      const data = await response.json();

      if (data.success) {
        setPublishSuccess(true);
        alert(
          `✅ Simulation published successfully!\n\n` +
          `Public URL: ${data.public_url}\n` +
          `Slug: ${data.slug}\n\n` +
          `This simulation is now visible on the public map.`
        );
      } else {
        throw new Error(data.error || 'Failed to publish simulation');
      }
    } catch (err) {
      console.error('Error publishing simulation:', err);
      setError(`Failed to publish simulation: ${err.message}`);
      alert(`❌ Error: ${err.message}`);
    } finally {
      setPublishing(false);
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
            <div className="bg-white rounded-lg shadow-md p-6">
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
              key="selection-map" // ← ADD THIS - prevents recreation
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
      

        {/* Real-Time Integration Badge */}
        {/* Smart Real-Time Integration Status */}
        {results && results.realtime_integration && (
          <div className={`border-l-4 rounded-lg p-4 ${
            results.realtime_integration.enabled 
              ? 'bg-blue-50 border-blue-500' 
              : 'bg-gray-50 border-gray-400'
          }`}>
            <div className="flex items-start gap-3">
              <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
                results.realtime_integration.enabled ? 'bg-blue-500' : 'bg-gray-400'
              }`}>
                {results.realtime_integration.enabled ? (
                  <div className="w-3 h-3 bg-white rounded-full animate-pulse"></div>
                ) : (
                  <span className="text-white text-lg">📅</span>
                )}
              </div>
              
              <div className="flex-1">
                <h4 className={`font-bold mb-1 ${
                  results.realtime_integration.enabled ? 'text-blue-900' : 'text-gray-700'
                }`}>
                  {results.realtime_integration.enabled ? '🌐 Live Traffic Integration Active' : '📊 Historical Pattern Analysis'}
                </h4>
                
                <p className={`text-sm mb-2 ${
                  results.realtime_integration.enabled ? 'text-blue-700' : 'text-gray-600'
                }`}>
                  {results.realtime_integration.reason}
                </p>
                
                {results.realtime_integration.enabled ? (
                  <div className="grid grid-cols-2 gap-3 mt-3">
                    <div className="bg-white rounded p-2">
                      <p className="text-xs text-gray-600">Current Speed</p>
                      <p className="font-bold text-blue-900">
                        {results.realtime_integration.current_speed} km/h
                      </p>
                    </div>
                    <div className="bg-white rounded p-2">
                      <p className="text-xs text-gray-600">Normal Speed</p>
                      <p className="font-bold text-blue-900">
                        {results.realtime_integration.free_flow_speed} km/h
                      </p>
                    </div>
                    <div className="bg-white rounded p-2">
                      <p className="text-xs text-gray-600">Traffic Status</p>
                      <p className={`font-bold ${
                        results.realtime_integration.current_congestion === 0 ? 'text-green-600' :
                        results.realtime_integration.current_congestion === 1 ? 'text-yellow-600' :
                        'text-red-600'
                      }`}>
                        {results.realtime_integration.current_congestion === 0 ? 'Light' :
                        results.realtime_integration.current_congestion === 1 ? 'Moderate' : 'Heavy'}
                      </p>
                    </div>
                    <div className="bg-white rounded p-2">
                      <p className="text-xs text-gray-600">Hours Adjusted</p>
                      <p className="font-bold text-blue-900">
                        {results.realtime_integration.hours_adjusted} / {results.summary.total_hours}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="bg-white rounded p-3 mt-2">
                    <p className="text-xs text-gray-700">
                      <strong>ℹ️ Why not using real-time?</strong><br/>
                      Real-time traffic data reflects current conditions, which won't accurately 
                      represent traffic patterns on {new Date(results.input.start).toLocaleDateString()}. 
                      Using historical data for this date/time provides more accurate predictions.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Results Section - IMPROVED VERSION */}
        {results && !isMapExpanded && (
          <div id="results-section" className="mt-8 space-y-6">
            {/* Header */}
            <div className="bg-gradient-to-r from-orange-500 to-orange-600 rounded-lg shadow-md p-6 text-white">
              <h2 className="text-2xl font-bold mb-2">🎯 Simulation Results</h2>
              <p className="text-orange-100">
                Simulation ID: {results.simulation_id}
              </p>
              <p className="text-sm text-orange-100 mt-1">
                Analysis completed for {results.input.area} - {results.input.disruption_type}
              </p>
            </div>

             {/* Results Map - Smart Multi-Map Display */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                  <span>🗺️</span>
                  <span>Predicted Congestion Map</span>
                </h3>
                
                {results.has_multiple_days && (
                  <span className="text-sm bg-blue-100 text-blue-700 px-3 py-1 rounded-full font-semibold">
                    {results.aggregated_view?.granularity === 'daily' ? 'Day-by-Day' :
                    results.aggregated_view?.granularity === 'weekly' ? 'Week-by-Week' :
                    'Hour-by-Hour'}
                  </span>
                )}
              </div>

              {results.aggregated_view ? (
                <AggregatedResultsMaps
                  aggregatedView={results.aggregated_view}
                  selectedLocation={selectedLocation}
                  roadInfo={roadInfo}
                  simulationResults={results}
                />
              ) : (
                <SmartResultsMap
                  simulationResults={results}
                  selectedLocation={selectedLocation}
                  roadInfo={roadInfo}
                />
              )}
            </div>

            {/* Key Metrics Cards */}
            <div className="grid md:grid-cols-4 gap-4">
              {/* Total Duration */}
              <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-blue-500">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-gray-600">Total Duration</span>
                  <span className="text-2xl">🕐</span>
                </div>
                <p className="text-3xl font-bold text-gray-800">{results.summary.total_hours}h</p>
                <p className="text-xs text-gray-500 mt-1">
                  {results.summary.duration_days} days
                </p>
                <p className="text-xs text-gray-600 mt-2">
                  How long the disruption will last
                </p>
              </div>

              {/* Average Severity */}
              <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-orange-500">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-gray-600">Avg Severity</span>
                  <span className="text-2xl">📊</span>
                </div>
                <p className="text-3xl font-bold text-orange-600">
                  {results.summary.avg_severity.toFixed(1)}
                </p>
                <p className={`text-sm font-semibold mt-1 ${
                  results.summary.avg_severity_label === 'Heavy' ? 'text-red-600' :
                  results.summary.avg_severity_label === 'Moderate' ? 'text-yellow-600' :
                  'text-green-600'
                }`}>
                  {results.summary.avg_severity_label}
                </p>
                <p className="text-xs text-gray-600 mt-2">
                  Overall congestion level
                </p>
              </div>

              {/* Average Delay */}
              <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-red-500">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-gray-600">Avg Delay</span>
                  <span className="text-2xl">⏱️</span>
                </div>
                <p className="text-3xl font-bold text-red-600">
                  +{results.summary.avg_delay_minutes} min
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Per trip through this area
                </p>
                <p className="text-xs text-gray-600 mt-2">
                  Extra time drivers will spend
                </p>
              </div>

              {/* Peak Hours - REPLACED PEAK IMPACT */}
              <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-purple-500">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-gray-600">Worst Hours</span>
                  <span className="text-2xl">🚨</span>
                </div>
                <p className="text-lg font-bold text-purple-600">
                  {(() => {
                    // Find hours with Heavy congestion
                    const heavyHours = results.hourly_predictions
                      .filter(p => p.severity_label === 'Heavy')
                      .map(p => p.hour);
                    
                    if (heavyHours.length === 0) return 'None';
                    
                    // Group consecutive hours
                    const ranges = [];
                    let start = heavyHours[0];
                    let prev = heavyHours[0];
                    
                    for (let i = 1; i <= heavyHours.length; i++) {
                      if (i === heavyHours.length || heavyHours[i] !== prev + 1) {
                        if (start === prev) {
                          ranges.push(`${start}:00`);
                        } else {
                          ranges.push(`${start}:00-${prev}:00`);
                        }
                        if (i < heavyHours.length) {
                          start = heavyHours[i];
                        }
                      }
                      prev = heavyHours[i];
                    }
                    
                    return ranges.slice(0, 2).join(', ');
                  })()}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {results.summary.heavy_hours} hours with heavy traffic
                </p>
                <p className="text-xs text-gray-600 mt-2">
                  Avoid these times if possible
                </p>
              </div>
            </div>

            {/* Time of Day Section - CLARIFIED */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-lg font-bold text-gray-800 mb-2 flex items-center gap-2">
                <span>⏰</span>
                <span>When is Traffic Worst?</span>
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                This shows how many hours of <strong>Light</strong>, <strong>Moderate</strong>, 
                and <strong>Heavy</strong> traffic occur during different times of day.
              </p>
              
              <div className="grid md:grid-cols-3 gap-4">
                {/* Morning */}
                <div className="border-2 rounded-lg p-4 bg-gradient-to-br from-yellow-50 to-orange-50">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-2xl">🌅</span>
                    <div>
                      <h4 className="font-bold text-gray-800">Morning</h4>
                      <p className="text-xs text-gray-600">6 AM - 12 PM</p>
                    </div>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">🟢 Light:</span>
                      <span className="font-semibold text-green-600">
                        {results.time_segments.morning.light} hours
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">🟡 Moderate:</span>
                      <span className="font-semibold text-yellow-600">
                        {results.time_segments.morning.moderate} hours
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">🔴 Heavy:</span>
                      <span className="font-semibold text-red-600">
                        {results.time_segments.morning.heavy} hours
                      </span>
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t border-gray-200">
                    <p className="text-xs text-gray-700">
                      {results.time_segments.morning.heavy > 2 ? (
                        <span className="text-red-600 font-semibold">⚠️ Expect delays during morning rush (7-9 AM)</span>
                      ) : results.time_segments.morning.moderate > 2 ? (
                        <span className="text-yellow-600 font-semibold">⚠️ Some slowdowns expected</span>
                      ) : (
                        <span className="text-green-600 font-semibold">✓ Generally clear mornings</span>
                      )}
                    </p>
                  </div>
                </div>

                {/* Afternoon */}
                <div className="border-2 rounded-lg p-4 bg-gradient-to-br from-blue-50 to-indigo-50">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-2xl">☀️</span>
                    <div>
                      <h4 className="font-bold text-gray-800">Afternoon</h4>
                      <p className="text-xs text-gray-600">12 PM - 6 PM</p>
                    </div>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">🟢 Light:</span>
                      <span className="font-semibold text-green-600">
                        {results.time_segments.afternoon.light} hours
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">🟡 Moderate:</span>
                      <span className="font-semibold text-yellow-600">
                        {results.time_segments.afternoon.moderate} hours
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">🔴 Heavy:</span>
                      <span className="font-semibold text-red-600">
                        {results.time_segments.afternoon.heavy} hours
                      </span>
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t border-gray-200">
                    <p className="text-xs text-gray-700">
                      {results.time_segments.afternoon.heavy > 2 ? (
                        <span className="text-red-600 font-semibold">⚠️ Expect delays during evening rush (5-7 PM)</span>
                      ) : results.time_segments.afternoon.moderate > 2 ? (
                        <span className="text-yellow-600 font-semibold">⚠️ Some slowdowns expected</span>
                      ) : (
                        <span className="text-green-600 font-semibold">✓ Generally clear afternoons</span>
                      )}
                    </p>
                  </div>
                </div>

                {/* Night */}
                <div className="border-2 rounded-lg p-4 bg-gradient-to-br from-indigo-50 to-purple-50">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-2xl">🌙</span>
                    <div>
                      <h4 className="font-bold text-gray-800">Night</h4>
                      <p className="text-xs text-gray-600">6 PM - 6 AM</p>
                    </div>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">🟢 Light:</span>
                      <span className="font-semibold text-green-600">
                        {results.time_segments.night.light} hours
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">🟡 Moderate:</span>
                      <span className="font-semibold text-yellow-600">
                        {results.time_segments.night.moderate} hours
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">🔴 Heavy:</span>
                      <span className="font-semibold text-red-600">
                        {results.time_segments.night.heavy} hours
                      </span>
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t border-gray-200">
                    <p className="text-xs text-gray-700">
                      {results.time_segments.night.heavy > 2 ? (
                        <span className="text-red-600 font-semibold">⚠️ Delays even at night</span>
                      ) : results.time_segments.night.moderate > 2 ? (
                        <span className="text-yellow-600 font-semibold">⚠️ Some slowdowns</span>
                      ) : (
                        <span className="text-green-600 font-semibold">✓ Clear at night - best time to travel</span>
                      )}
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="mt-4 bg-blue-50 rounded-lg p-4">
                <p className="text-sm text-gray-700">
                  <strong>💡 What this means:</strong> Schedule your trip during times with more 
                  <span className="text-green-600 font-semibold"> Green (Light)</span> hours to avoid delays.
                </p>
              </div>
            </div>

            {/* Hourly Breakdown (Collapsible) */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <details className="group">
                <summary className="cursor-pointer list-none">
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                      <span>📅</span>
                      <span>Hour-by-Hour Breakdown</span>
                    </h3>
                    <svg 
                      className="w-5 h-5 text-gray-600 transition-transform group-open:rotate-180" 
                      fill="none" 
                      viewBox="0 0 24 24" 
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </summary>

                <div className="mt-4 max-h-96 overflow-y-auto">
                  <div className="space-y-2">
                    {results.hourly_predictions.map((pred, idx) => (
                      <div
                        key={idx}
                        className={`flex items-center justify-between p-3 rounded-lg transition hover:shadow-md ${
                          pred.severity_label === 'Heavy' ? 'bg-red-50 border-l-4 border-red-500' :
                          pred.severity_label === 'Moderate' ? 'bg-yellow-50 border-l-4 border-yellow-500' :
                          'bg-green-50 border-l-4 border-green-500'
                        }`}
                      >
                        <div className="flex items-center gap-4">
                          <div className="text-sm font-mono text-gray-700">
                            {pred.datetime}
                          </div>
                          <div className="text-xs text-gray-600">
                            {pred.day_of_week}
                          </div>
                          <span className={`text-xs px-3 py-1 rounded-full font-semibold ${
                            pred.severity_label === 'Heavy' ? 'bg-red-100 text-red-700' :
                            pred.severity_label === 'Moderate' ? 'bg-yellow-100 text-yellow-700' :
                            'bg-green-100 text-green-700'
                          }`}>
                            {pred.severity_label}
                          </span>
                                {/* ✅ Show if this specific hour was adjusted with real-time */}
                          {pred.realtime_adjusted && (
                            <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded-full font-semibold flex items-center gap-1">
                              <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                              Live
                            </span>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-4">
                          {pred.delay_info && (
                            <div className="text-right">
                              <p className="text-sm font-semibold text-gray-800">
                                +{pred.delay_info.additional_delay_min} min
                              </p>
                              <p className="text-xs text-gray-500">
                                {pred.delay_info.reduced_speed_kmh} km/h
                              </p>
                            </div>
                          )}
                          <div className="text-xs text-gray-600">
                            {(pred.confidence * 100).toFixed(0)}% confident
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </details>
            </div>
            

            {/* Save and Publish Buttons */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                <span>💾</span>
                <span>Save & Publish</span>
              </h3>

            <div className="flex gap-4 mt-6">
              <button
                onClick={handleSaveSimulation}
                disabled={saving || !results}
                className={`flex-1 py-3 rounded-lg font-semibold transition flex items-center justify-center gap-2 ${
                  saveSuccess 
                    ? 'bg-green-600 text-white hover:bg-green-700' 
                    : saving
                    ? 'bg-gray-400 text-white cursor-not-allowed'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                {saving ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Saving...
                  </>
                ) : saveSuccess ? (
                  <>
                    ✅ Saved (ID: {savedSimulationId})
                  </>
                ) : (
                  <>
                    💾 Save Simulation
                  </>
                )}
              </button>
            

              <button
                onClick={handlePublishSimulation}
                disabled={publishing || !savedSimulationId || !results}
                className={`flex-1 py-3 rounded-lg font-semibold transition flex items-center justify-center gap-2 ${
                  publishSuccess
                    ? 'bg-green-700 text-white'
                    : publishing
                    ? 'bg-gray-400 text-white cursor-not-allowed'
                    : !savedSimulationId
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-green-600 text-white hover:bg-green-700'
                }`}
              >
                {publishing ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Publishing...
                  </>
                ) : publishSuccess ? (
                  <>
                    ✅ Published to Public Map
                  </>
                ) : !savedSimulationId ? (
                  <>
                    🔒 Save First to Publish
                  </>
                ) : (
                  <>
                    📢 Publish to Public Map
                  </>
                )}
              </button>
            </div>

              {/* Help Text */}
                <div className="mt-4 text-sm text-gray-600 bg-gray-50 rounded-lg p-3">
                  <p className="flex items-start gap-2">
                    <span className="text-blue-600 font-bold">ℹ️</span>
                    <span>
                      <strong>First save</strong> your simulation to the database, 
                      then <strong>publish</strong> it to make it visible on the public map.
                    </span>
                  </p>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}