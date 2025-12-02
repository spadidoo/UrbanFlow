"use client";
import PlannerNavbar from "@/components/PlannerNavBar";
import api from "@/services/apiDatabase";
import { useRouter, useParams } from "next/navigation";
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";

// Helper to convert WKT to GeoJSON
const wktToGeoJSON = (wkt) => {
  if (!wkt || typeof wkt !== 'string') return null;
  
  try {
    // Remove "POINT(", "LINESTRING(", etc. and closing ")"
    const cleanWkt = wkt.replace(/^[A-Z]+\(/, '').replace(/\)$/, '');
    
    if (wkt.startsWith('POINT')) {
      const [lon, lat] = cleanWkt.split(' ').map(Number);
      return {
        type: "Point",
        coordinates: [lon, lat]
      };
    }
    
    if (wkt.startsWith('LINESTRING')) {
      const coords = cleanWkt.split(',').map(pair => {
        const [lon, lat] = pair.trim().split(' ').map(Number);
        return [lon, lat];
      });
      return {
        type: "LineString",
        coordinates: coords
      };
    }
    
    if (wkt.startsWith('POLYGON')) {
      // Handle nested parentheses
      const coordsStr = cleanWkt.replace(/^\(/, '').replace(/\)$/, '');
      const coords = coordsStr.split(',').map(pair => {
        const [lon, lat] = pair.trim().split(' ').map(Number);
        return [lon, lat];
      });
      return {
        type: "Polygon",
        coordinates: [coords]
      };
    }
    
    return null;
  } catch (err) {
    console.error("WKT conversion error:", err);
    return null;
  }
};

// Dynamically import Leaflet to avoid SSR issues
const MapContainer = dynamic(
  () => import("react-leaflet").then((mod) => mod.MapContainer),
  { ssr: false }
);
const TileLayer = dynamic(
  () => import("react-leaflet").then((mod) => mod.TileLayer),
  { ssr: false }
);
const GeoJSON = dynamic(
  () => import("react-leaflet").then((mod) => mod.GeoJSON),
  { ssr: false }
);

export default function ReportDetailsPage() {
  const router = useRouter();
  const params = useParams();
  const simulationId = params.id;

  const [simulation, setSimulation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (simulationId) {
      fetchSimulationDetails();
    }
  }, [simulationId]);

  const fetchSimulationDetails = async () => {
    try {
      setLoading(true);
      const response = await api.getSimulationDetails(simulationId);

      if (response.success) {
        setSimulation(response.simulation);
      } else {
        setError("Failed to load simulation details");
      }
    } catch (err) {
      console.error("Error fetching simulation:", err);
      setError("Failed to connect to server");
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (format) => {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'https://backend.urbanflowph.com'}/api/reports/${simulationId}/export?format=${format}`,
        { method: 'GET' }
      );

      if (!response.ok) throw new Error(`Export failed: ${response.status}`);

      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = `report_${simulationId}.${format}`;

      if (contentDisposition) {
        const matches = /filename="(.+)"/.exec(contentDisposition);
        if (matches && matches[1]) filename = matches[1];
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      alert(`✅ Downloaded ${format.toUpperCase()} successfully!`);
    } catch (err) {
      console.error(`Error exporting as ${format}:`, err);
      alert(`❌ Failed to export as ${format.toUpperCase()}`);
    }
  };

  const getSeverityColor = (severity) => {
    if (!severity) return "bg-gray-100 text-gray-700";
    const level = severity.toLowerCase();
    if (level === "light") return "bg-green-100 text-green-700 border-green-300";
    if (level === "moderate") return "bg-yellow-100 text-yellow-700 border-yellow-300";
    if (level === "heavy") return "bg-red-100 text-red-700 border-red-300";
    return "bg-gray-100 text-gray-700 border-gray-300";
  };

  const getTrafficColor = (severity) => {
    if (!severity) return "#808080";
    const level = severity.toLowerCase();
    if (level === "light") return "#22c55e";
    if (level === "moderate") return "#eab308";
    if (level === "heavy") return "#ef4444";
    return "#808080";
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F5F6FA]">
        <PlannerNavbar />
        <div className="container mx-auto px-8 py-10 text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-orange-500 mx-auto mb-4"></div>
          <p className="text-gray-600 text-lg">Loading simulation details...</p>
        </div>
      </div>
    );
  }

  if (error || !simulation) {
    return (
      <div className="min-h-screen bg-[#F5F6FA]">
        <PlannerNavbar />
        <div className="container mx-auto px-8 py-10">
          <div className="bg-red-50 border-2 border-red-200 rounded-lg p-6 text-center">
            <p className="text-red-700 text-lg mb-4">{error || "Simulation not found"}</p>
            <button
              onClick={() => router.push('/dashboard/reports')}
              className="bg-orange-500 text-white px-6 py-2 rounded-lg hover:bg-orange-600 transition"
            >
              ← Back to Reports
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F6FA] text-gray-800">
      <PlannerNavbar />

      <main className="container mx-auto px-8 py-10">
        {/* Header */}
        <div className="flex justify-between items-start mb-8">
          <div className="flex-1">
            <h1 className="text-4xl font-bold text-gray-800 mb-2">
              {simulation.simulation_name || "Untitled Simulation"}
            </h1>
            <p className="text-gray-600">
              📍 {simulation.disruption_location || "Unknown Location"}
            </p>
          </div>

          {/* Export Buttons */}
          <div className="flex gap-2">
            <button
              onClick={() => handleExport('pdf')}
              className="bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 transition font-semibold"
            >
              📄 PDF
            </button>
            <button
              onClick={() => handleExport('csv')}
              className="bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 transition font-semibold"
            >
              📊 CSV
            </button>
            <button
              onClick={() => handleExport('excel')}
              className="bg-yellow-500 text-white px-4 py-2 rounded-lg hover:bg-yellow-600 transition font-semibold"
            >
              📈 Excel
            </button>
          </div>
        </div>

        {/* Info Cards */}
        <div className="grid md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-sm text-gray-600 mb-1">Disruption Type</p>
            <p className="text-2xl font-bold text-orange-600">
              {simulation.disruption_type || "N/A"}
            </p>
          </div>
          
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-sm text-gray-600 mb-1">Severity Level</p>
            <span className={`inline-block px-4 py-2 rounded-lg text-xl font-bold border-2 ${getSeverityColor(simulation.severity_level)}`}>
              {simulation.severity_level || "N/A"}
            </span>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-sm text-gray-600 mb-1">Period</p>
            <p className="text-lg font-semibold text-gray-800">
              {simulation.start_time ? new Date(simulation.start_time).toLocaleDateString() : "N/A"}
            </p>
            <p className="text-sm text-gray-500">to</p>
            <p className="text-lg font-semibold text-gray-800">
              {simulation.end_time ? new Date(simulation.end_time).toLocaleDateString() : "N/A"}
            </p>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-sm text-gray-600 mb-1">Status</p>
            <p className="text-2xl font-bold text-gray-700">
              {simulation.simulation_status === 'published' ? '✓ Published' : 'Completed'}
            </p>
          </div>
        </div>

        {/* Statistics */}
        {(simulation.total_affected_segments || simulation.average_delay_ratio) && (
          <div className="bg-white rounded-lg shadow p-6 mb-8">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">📊 Impact Statistics</h2>
            <div className="grid md:grid-cols-3 gap-6">
              {simulation.total_affected_segments && (
                <div>
                  <p className="text-sm text-gray-600">Affected Road Segments</p>
                  <p className="text-3xl font-bold text-orange-600">
                    {simulation.total_affected_segments}
                  </p>
                </div>
              )}
              {simulation.average_delay_ratio != null && (
                <div>
                  <p className="text-sm text-gray-600">Average Delay Ratio</p>
                  <p className="text-3xl font-bold text-yellow-600">
                    {Number(simulation.average_delay_ratio).toFixed(2)}
                  </p>
                </div>
              )}
              {simulation.max_delay_ratio != null && (
                <div>
                  <p className="text-sm text-gray-600">Max Delay Ratio</p>
                  <p className="text-3xl font-bold text-red-600">
                    {Number(simulation.max_delay_ratio).toFixed(2)}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Description */}
        {simulation.description && (
          <div className="bg-white rounded-lg shadow p-6 mb-8">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">📝 Description</h2>
            <p className="text-gray-700 leading-relaxed">{simulation.description}</p>
          </div>
        )}

        {/* Map */}
        {simulation.disruption_geometry && (() => {
        try {
            // Convert WKT to GeoJSON
            const geoData = wktToGeoJSON(simulation.disruption_geometry);
            
            if (!geoData) {
            console.warn("Could not convert geometry:", simulation.disruption_geometry);
            return (
                <div className="bg-yellow-50 border-2 border-yellow-200 rounded-lg p-6">
                <p className="text-yellow-700">⚠️ Map data format not supported</p>
                </div>
            );
            }

            // Get center coordinates for map
            let center = [14.0995, 121.1650]; // Default Calamba
            if (geoData.type === 'Point') {
            center = [geoData.coordinates[1], geoData.coordinates[0]];
            } else if (geoData.type === 'LineString' && geoData.coordinates.length > 0) {
            const firstCoord = geoData.coordinates[0];
            center = [firstCoord[1], firstCoord[0]];
            }

            return (
            <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-2xl font-bold text-gray-800 mb-4">🗺️ Disruption Location</h2>
                <div className="h-96 rounded-lg overflow-hidden">
                <MapContainer
                    center={center}
                    zoom={15}
                    style={{ height: "100%", width: "100%" }}
                >
                    <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                    />
                    <GeoJSON
                    key={simulation.simulation_id}
                    data={geoData}
                    style={{
                        color: getTrafficColor(simulation.severity_level),
                        weight: 6,
                        opacity: 0.8
                    }}
                    pointToLayer={(feature, latlng) => {
                        const L = require('leaflet');
                        return L.circleMarker(latlng, {
                        radius: 10,
                        fillColor: getTrafficColor(simulation.severity_level),
                        color: '#fff',
                        weight: 2,
                        opacity: 1,
                        fillOpacity: 0.8
                        });
                    }}
                    />
                </MapContainer>
                </div>
            </div>
            );
        } catch (err) {
            console.error("Error rendering map:", err);
            return (
            <div className="bg-yellow-50 border-2 border-yellow-200 rounded-lg p-6">
                <p className="text-yellow-700">⚠️ Could not display map</p>
            </div>
            );
        }
        })()}

        {/* Metadata */}
        <div className="bg-gray-50 rounded-lg p-6 mt-8 text-sm text-gray-600">
          <div className="grid md:grid-cols-2 gap-4">
            <p><strong>Created:</strong> {simulation.created_at ? new Date(simulation.created_at).toLocaleString() : "N/A"}</p>
            <p><strong>Last Updated:</strong> {simulation.updated_at ? new Date(simulation.updated_at).toLocaleString() : "N/A"}</p>
            <p><strong>Simulation ID:</strong> {simulation.simulation_id}</p>
            {simulation.username && <p><strong>Created By:</strong> {simulation.username}</p>}
          </div>
        </div>
      </main>
    </div>
  );
}