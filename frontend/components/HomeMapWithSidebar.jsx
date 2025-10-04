"use client"

import { useState } from 'react'
import L from 'leaflet'
import { MapContainer, TileLayer, Marker, Popup, Circle } from 'react-leaflet'

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

  // Mock disruptions data (replace with API call later)
  const disruptions = [
    {
      id: 1,
      title: 'Bagong Kalsada Roadwork',
      location: 'Bagong Kalsada',
      latitude: 14.2108,
      longitude: 121.1644,
      type: 'roadwork',
      status: 'Active',
      expected_delay: '15-20 minutes',
      start_date: '2025-10-01',
      end_date: '2025-10-15',
      congestion_level: 'Heavy'
    },
    {
      id: 2,
      title: 'Parian Festival Event',
      location: 'Parian Road',
      latitude: 14.2150,
      longitude: 121.1600,
      type: 'event',
      status: 'Active',
      expected_delay: '10 minutes',
      start_date: '2025-10-08',
      end_date: '2025-10-08',
      congestion_level: 'Moderate'
    }
  ]

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
      default: return '📍'
    }
  }

  const handleViewOnMap = (lat, lng) => {
    // TODO: Zoom map to this location
    alert(`Zooming to: ${lat}, ${lng}`)
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

      {/* Sidebar Toggle Button - Floating Right */}
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

      {/* Sidebar - Slides from right */}
      <div 
        className={`fixed top-0 right-0 h-full w-96 shadow-2xl z-[999] transition-transform duration-300 overflow-y-auto ${
            sidebarOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
        style={{
            backgroundColor: 'rgba(255, 255, 255, 0.7)',
            backdropFilter: 'blur(5px)',
            WebkitBackdropFilter: 'blur(5px)'
        }}
      >
        <div className="p-6">
          {/* Sidebar Header */}
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-800">Active Disruptions</h2>
            <button
              onClick={() => setSidebarOpen(false)}
              className="text-gray-500 hover:text-gray-700"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Disruptions List */}
          {disruptions.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <p className="text-lg">No active disruptions</p>
              <p className="text-sm mt-2">Traffic is flowing normally!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {disruptions.map((disruption) => (
                <div key={disruption.id} className="border rounded-lg p-4 hover:shadow-md transition">
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
                  <div className="flex gap-2 mb-2">
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
                  <p className="text-sm text-gray-700 mb-2">
                    ⏱️ <strong>Expected Delay:</strong> {disruption.expected_delay}
                  </p>

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

        {/* Disruption Markers */}
        {disruptions.map((d) => (
          <div key={d.id}>
            <Marker position={[d.latitude, d.longitude]}>
              <Popup>
                <div className="p-2">
                  <h3 className="font-bold">{d.title}</h3>
                  <p className="text-sm">{d.location}</p>
                  <p className="text-xs text-gray-600">Delay: {d.expected_delay}</p>
                </div>
              </Popup>
            </Marker>

            {/* Congestion Circle */}
            <Circle
              center={[d.latitude, d.longitude]}
              radius={300}
              pathOptions={{
                color: getCongestionColor(d.congestion_level),
                fillColor: getCongestionColor(d.congestion_level),
                fillOpacity: 0.2
              }}
            />
          </div>
        ))}
      </MapContainer>
    </div>
  )
}