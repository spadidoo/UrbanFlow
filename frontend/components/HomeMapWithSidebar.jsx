"use client"

import L from 'leaflet'
import React, { useEffect, useState } from 'react'
import { Circle, MapContainer, Marker, Popup, TileLayer } from 'react-leaflet'
import api from '../services/api'

// Fix Leaflet icons
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png",
})

export default function HomeMapWithSidebar() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [disruptions, setDisruptions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Fetch disruptions on component mount
  useEffect(() => {
    fetchDisruptions()
  }, [])

  const fetchDisruptions = async () => {
    try {
      setLoading(true)
      setError(null)
      
      // Call the API
      const response = await api.getPublishedDisruptions()
      
      // Check if the API call was successful
      if (response.success === false) {
        // Backend is down or unreachable
        setError('Unable to connect to server. Showing offline mode.')
        setDisruptions([])
      } else {
        // Extract the disruptions array from the response
        const disruptionsData = response.disruptions || []
        setDisruptions(disruptionsData)
      }
    } catch (err) {
      console.error('Failed to fetch disruptions:', err)
      setError('Failed to load disruptions. Please check your connection.')
      setDisruptions([])
    } finally {
      setLoading(false)
    }
  }

  const getCongestionColor = (level) => {
    switch(level) {
      case 'Heavy': return 'red'
      case 'Moderate': return 'yellow'
      case 'Light': return 'green'
      default: return 'gray'
    }
  }

  const getTypeIcon = (type) => {
    switch(type) {
      case 'roadwork': return '🚧'
      case 'event': return '🎉'
      case 'accident': return '⚠️'
      case 'weather': return '🌧️'
      default: return '📍'
    }
  }

  const handleViewOnMap = (lat, lng) => {
    // TODO: Zoom map to this location
    console.log(`Zooming to: ${lat}, ${lng}`)
    setSidebarOpen(false)
  }

  return (
    <div className="relative h-full w-full">
      {/* Search Bar - Floating Left */}
      <div className="absolute top-20 left-4 z-[1002]">
        <div className="bg-white rounded-lg shadow-lg p-2 w-80">
          <div className="flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search location in Calamba..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 outline-none text-gray-700"
            />
          </div>
        </div>
      </div>

      {/* Sidebar Toggle Button */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className={`fixed top-20 z-[1002] bg-white p-3 rounded-lg shadow-lg hover:bg-gray-50 transition-all duration-300 ${
          sidebarOpen ? 'right-[25rem]' : 'right-4'
        }`}
        title="Toggle disruptions list"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {/* Sidebar */}
      <div 
        className={`fixed right-0 h-full w-96 shadow-2xl z-[999] transition-transform duration-300 overflow-y-auto ${
          sidebarOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
        style={{
          top: '64px', // Start below navbar (navbar height is typically 64px or 4rem)
          height: 'calc(100vh - 64px)', // Full height minus navbar
          backgroundColor: 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(10px)',
        }}
      >
        <div className="p-6">
          {/* Sidebar Header */}
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-800">Active Disruptions</h2>
              {!loading && (
                <p className="text-sm text-gray-600 mt-1">
                  {disruptions.length} active {disruptions.length === 1 ? 'disruption' : 'disruptions'}
                </p>
              )}
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              className="text-gray-500 hover:text-gray-700"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Loading State */}
          {loading && (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading disruptions...</p>
            </div>
          )}

          {/* Error State - Improved messaging */}
          {error && (
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-4">
              <div className="flex items-start gap-3">
                <span className="text-2xl">⚠️</span>
                <div className="flex-1">
                  <p className="text-orange-800 font-semibold mb-1">Server Offline</p>
                  <p className="text-orange-700 text-sm mb-3">{error}</p>
                  <button
                    onClick={fetchDisruptions}
                    className="bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-orange-700 transition"
                  >
                    Try Reconnecting
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Empty State */}
          {!loading && !error && disruptions.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              <div className="text-6xl mb-4">✅</div>
              <p className="text-lg font-semibold">No active disruptions</p>
              <p className="text-sm mt-2">Traffic is flowing normally!</p>
            </div>
          )}

          {/* Disruptions List */}
          {!loading && !error && disruptions.length > 0 && (
            <div className="space-y-4">
              {disruptions.map((disruption) => (
                <div key={disruption.id} className="bg-white border rounded-lg p-4 hover:shadow-md transition">
                  {/* Title */}
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-bold text-lg text-gray-800 flex items-center gap-2">
                      <span>{getTypeIcon(disruption.type)}</span>
                      {disruption.title}
                    </h3>
                  </div>

                  {/* Location */}
                  <p className="text-sm text-gray-600 mb-2">
                    📍 {disruption.location}
                  </p>

                  {/* Type & Status */}
                  <div className="flex gap-2 mb-3">
                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded capitalize">
                      {disruption.type}
                    </span>
                    <span className={`text-xs px-2 py-1 rounded font-semibold ${
                      disruption.congestion_level === 'Heavy' ? 'bg-red-100 text-red-700' :
                      disruption.congestion_level === 'Moderate' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-green-100 text-green-700'
                    }`}>
                      {disruption.congestion_level}
                    </span>
                  </div>

                  {/* Expected Delay */}
                  <div className="bg-gray-50 rounded-lg p-3 mb-3">
                    <p className="text-sm text-gray-700 flex items-center gap-2">
                      <span className="text-lg">⏱️</span>
                      <span>
                        <strong>Expected Delay:</strong> +{disruption.expected_delay} minutes
                      </span>
                    </p>
                  </div>

                  {/* Description */}
                  {disruption.description && (
                    <p className="text-sm text-gray-600 mb-3 italic">
                      "{disruption.description}"
                    </p>
                  )}

                  {/* Dates */}
                  <p className="text-xs text-gray-500 mb-3">
                    📅 {new Date(disruption.start_date).toLocaleDateString()} - {new Date(disruption.end_date).toLocaleDateString()}
                  </p>

                  {/* View on Map Button */}
                  <button
                    onClick={() => handleViewOnMap(disruption.latitude, disruption.longitude)}
                    className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition font-semibold text-sm"
                  >
                    View on Map
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Refresh Button */}
          {!loading && (
            <button
              onClick={fetchDisruptions}
              className="w-full mt-6 bg-gray-100 text-gray-700 py-2 rounded-lg hover:bg-gray-200 transition text-sm font-semibold"
            >
              🔄 Refresh
            </button>
          )}
        </div>
      </div>

      {/* Map */}
      <MapContainer
        center={[14.2096, 121.164]}
        zoom={13}
        style={{ height: '100%', width: '100%' }}
        zoomControl={false}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution="&copy; OpenStreetMap contributors"
        />

        {/* Disruption Markers and Circles */}
        {disruptions.map((d) => (
          <React.Fragment key={d.id}>
            <Marker position={[d.latitude, d.longitude]}>
              <Popup>
                <div className="p-2">
                  <h3 className="font-bold text-lg">{d.title}</h3>
                  <p className="text-sm text-gray-600">{d.location}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    <strong>Delay:</strong> +{d.expected_delay} min
                  </p>
                  <p className="text-xs text-gray-500">
                    <strong>Status:</strong> {d.congestion_level}
                  </p>
                </div>
              </Popup>
            </Marker>

            {/* Congestion Circle (Blob) */}
            <Circle
              center={[d.latitude, d.longitude]}
              radius={500}
              pathOptions={{
                color: getCongestionColor(d.congestion_level),
                fillColor: getCongestionColor(d.congestion_level),
                fillOpacity: 0.3,
                weight: 2
              }}
            />
          </React.Fragment>
        ))}
      </MapContainer>
    </div>
  )
}