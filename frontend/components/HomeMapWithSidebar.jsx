"use client"

import { useState, useEffect, useRef } from 'react'
import L from 'leaflet'

// Fix Leaflet icons
if (typeof window !== 'undefined') {
  delete L.Icon.Default.prototype._getIconUrl
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png",
    iconUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png",
    shadowUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png",
  })
}

export default function HomeMapWithSidebar() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [disruptions, setDisruptions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedDisruption, setSelectedDisruption] = useState(null)
  
  const mapRef = useRef(null)
  const mapInstanceRef = useRef(null)
  const layersRef = useRef([])

  useEffect(() => {
    fetchDisruptions()
  }, [])

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return

    const map = L.map(mapRef.current, {
      center: [14.2096, 121.164],
      zoom: 13,
      zoomControl: true,
    })

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; OpenStreetMap',
      maxZoom: 19,
    }).addTo(map)

    mapInstanceRef.current = map

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove()
        mapInstanceRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    if (!mapInstanceRef.current || disruptions.length === 0) return
    drawDisruptionsOnMap()
  }, [disruptions, selectedDisruption])

  const fetchDisruptions = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const response = await fetch('http://localhost:5000/api/published-disruptions')
      const data = await response.json()

      if (!response.ok || data.success === false) {
        setError('Unable to load disruptions')
        setDisruptions([])
      } else {
        const disruptionData = data.disruptions || []
        
        // Categorize disruptions
        const now = new Date()
        const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
        
        const categorized = disruptionData.map(d => ({
          ...d,
          status: getDisruptionStatus(d, now, weekFromNow)
        }))
        
        setDisruptions(categorized)
        
        // Fetch real-time data for active disruptions
        categorized.forEach(d => {
          if (d.status === 'active' && d.latitude && d.longitude) {
            fetchRealtimeForDisruption(d)
          }
        })
      }
    } catch (err) {
      setError('Failed to load disruptions')
      setDisruptions([])
    } finally {
      setLoading(false)
    }
  }

  const getDisruptionStatus = (disruption, now, weekFromNow) => {
    if (!disruption.start_date || !disruption.end_date) return 'unknown'
    
    const start = new Date(disruption.start_date)
    const end = new Date(disruption.end_date)
    
    if (now >= start && now <= end) return 'active'
    if (start > now && start <= weekFromNow) return 'upcoming'
    if (end < now) return 'past'
    return 'future'
  }

  const fetchRealtimeForDisruption = async (disruption) => {
    try {
      const response = await fetch('http://localhost:5000/api/realtime-traffic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lat: disruption.latitude,
          lng: disruption.longitude
        })
      })
      
      const data = await response.json()
      
      if (data.success) {
        // Update disruption with real-time data
        setDisruptions(prev => prev.map(d => 
          d.id === disruption.id 
            ? { ...d, realtime: data }
            : d
        ))
      }
    } catch (err) {
      console.warn(`Failed to fetch real-time data for ${disruption.title}`)
    }
  }

  const drawDisruptionsOnMap = () => {
    if (!mapInstanceRef.current) return

    const map = mapInstanceRef.current

    // Clear old layers
    layersRef.current.forEach(layer => {
      try {
        map.removeLayer(layer)
      } catch (e) {}
    })
    layersRef.current = []

    // Draw disruptions based on status
    disruptions.forEach(disruption => {
      if (disruption.status === 'active') {
        drawActiveDisruption(disruption)
      } else if (disruption.status === 'upcoming') {
        drawUpcomingDisruption(disruption)
      }
    })

    // Fit map to show all disruptions
    const validDisruptions = disruptions.filter(d => d.latitude && d.longitude && (d.status === 'active' || d.status === 'upcoming'))
    if (validDisruptions.length > 0) {
      const bounds = validDisruptions.map(d => [d.latitude, d.longitude])
      try {
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 })
      } catch (e) {}
    }
  }

  // FIND drawActiveDisruption function (around line 160):
  const drawActiveDisruption = (disruption) => {
  if (!disruption.latitude || !disruption.longitude) return

  const map = mapInstanceRef.current
  const isSelected = selectedDisruption?.id === disruption.id

  // Use real-time severity if available
  const severity = disruption.realtime?.congestion_ratio || disruption.avg_severity || 1.0
  const color = getSeverityColor(severity)

  // Draw circular impact zone (NO LINES)
  const circle = L.circle([disruption.latitude, disruption.longitude], {
    radius: 500,
    color: color,
    fillColor: color,
    fillOpacity: isSelected ? 0.3 : 0.2,
    weight: isSelected ? 3 : 2,
  }).addTo(map)

  layersRef.current.push(circle)

  // Add marker
  const marker = createMarker(disruption, color, isSelected, '🚧')
  layersRef.current.push(marker)
}
 
  const drawUpcomingDisruption = (disruption) => {
    if (!disruption.latitude || !disruption.longitude) return

    const map = mapInstanceRef.current
    const isSelected = selectedDisruption?.id === disruption.id

    // Use gray/blue for upcoming
    const color = '#3B82F6'

    // Draw as pulsing blob
    const marker = L.marker([disruption.latitude, disruption.longitude], {
      icon: L.divIcon({
        className: 'upcoming-marker',
        html: `
          <div style="position: relative;">
            <div style="
              position: absolute;
              top: 50%;
              left: 50%;
              transform: translate(-50%, -50%);
              width: ${isSelected ? '60px' : '45px'};
              height: ${isSelected ? '60px' : '45px'};
              border: 2px solid ${color};
              border-radius: 50%;
              opacity: 0.4;
              animation: pulse-upcoming 2s ease-out infinite;
            "></div>
            <div style="
              background: white;
              border: 2px solid ${color};
              border-radius: 50%;
              width: ${isSelected ? '40px' : '32px'};
              height: ${isSelected ? '40px' : '32px'};
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: ${isSelected ? '20px' : '16px'};
              box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
              cursor: pointer;
              z-index: 1000;
            ">📅</div>
            <style>
              @keyframes pulse-upcoming {
                0% { transform: translate(-50%, -50%) scale(1); opacity: 0.4; }
                100% { transform: translate(-50%, -50%) scale(1.8); opacity: 0; }
              }
            </style>
          </div>
        `,
        iconSize: [isSelected ? 40 : 32, isSelected ? 40 : 32],
        iconAnchor: [isSelected ? 20 : 16, isSelected ? 20 : 16],
      })
    }).addTo(map)

    marker.on('click', () => handleViewOnMap(disruption))
    marker.bindPopup(createUpcomingPopup(disruption))

    layersRef.current.push(marker)
  }

  const drawCongestionSegments = (disruption, hourlyData, color) => {
    const map = mapInstanceRef.current
    
    // Create polyline segments based on severity
    const coordinates = disruption.road_coordinates || [
      [disruption.latitude, disruption.longitude],
      [disruption.latitude + 0.005, disruption.longitude + 0.005]
    ]

    const avgSeverity = hourlyData.reduce((sum, h) => sum + (h.severity || 0), 0) / hourlyData.length

    const polyline = L.polyline(coordinates, {
      color: getSeverityColor(avgSeverity),
      weight: 8,
      opacity: 0.8,
      smoothFactor: 1
    }).addTo(map)

    layersRef.current.push(polyline)
  }

  const createMarker = (disruption, color, isSelected, icon) => {
    const map = mapInstanceRef.current

    const marker = L.marker([disruption.latitude, disruption.longitude], {
      icon: L.divIcon({
        className: 'disruption-marker',
        html: `
          <div style="position: relative;">
            <div style="
              position: absolute;
              top: 50%;
              left: 50%;
              transform: translate(-50%, -50%);
              width: ${isSelected ? '70px' : '50px'};
              height: ${isSelected ? '70px' : '50px'};
              border: 3px solid ${color};
              border-radius: 50%;
              opacity: 0.3;
              animation: pulse 2s ease-out infinite;
            "></div>
            <div style="
              background: white;
              border: 3px solid ${color};
              border-radius: 50%;
              width: ${isSelected ? '48px' : '36px'};
              height: ${isSelected ? '48px' : '36px'};
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: ${isSelected ? '24px' : '18px'};
              box-shadow: 0 4px 12px rgba(0,0,0,0.2);
              cursor: pointer;
              z-index: 1000;
            ">${icon}</div>
            <style>
              @keyframes pulse {
                0% { transform: translate(-50%, -50%) scale(1); opacity: 0.3; }
                100% { transform: translate(-50%, -50%) scale(2); opacity: 0; }
              }
            </style>
          </div>
        `,
        iconSize: [isSelected ? 48 : 36, isSelected ? 48 : 36],
        iconAnchor: [isSelected ? 24 : 18, isSelected ? 24 : 18],
      })
    }).addTo(map)

    marker.on('click', () => handleViewOnMap(disruption))
    marker.bindPopup(createActivePopup(disruption))

    return marker
  }

  const createActivePopup = (disruption) => {
    const realtimeTag = disruption.realtime ? 
      '<span style="background: #10B981; color: white; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: 600;">LIVE</span>' : 
      ''
    
     return `
      <div style="font-family: -apple-system, sans-serif; padding: 10px; min-width: 200px;">
        <h3 style="margin: 0 0 8px 0; font-size: 15px; font-weight: 600;">
          🚧 ${disruption.title} ${realtimeTag}
        </h3>
        <p style="margin: 4px 0; font-size: 12px; color: #6b7280;">
          📍 ${disruption.location}
        </p>
        <div style="background: #f9fafb; padding: 6px; border-radius: 6px; margin-top: 6px;">
          <p style="margin: 2px 0; font-size: 11px;">
            <strong>Type:</strong> ${disruption.type}
          </p>
          <p style="margin: 2px 0; font-size: 11px;">
            <strong>Delay:</strong> +${disruption.expected_delay} min
          </p>
          <p style="margin: 2px 0; font-size: 11px;">
            <strong>Level:</strong> ${disruption.congestion_level}
          </p>
          ${disruption.start_date ? `
            <p style="margin: 2px 0; font-size: 11px;">
              <strong>Started:</strong> ${new Date(disruption.start_date).toLocaleString('en-US', {
                month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
              })}
            </p>
          ` : ''}
          ${disruption.end_date ? `
            <p style="margin: 2px 0; font-size: 11px;">
              <strong>Ends:</strong> ${new Date(disruption.end_date).toLocaleString('en-US', {
                month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
              })}
            </p>
          ` : ''}
          ${disruption.realtime ? `
            <p style="margin: 2px 0; font-size: 11px;">
              <strong>Current Speed:</strong> ${Math.round(disruption.realtime.current_speed)} km/h
            </p>
          ` : ''}
        </div>
      </div>
    `
  }

    const createUpcomingPopup = (disruption) => {
      const startDate = new Date(disruption.start_date)
      const daysUntil = Math.ceil((startDate - new Date()) / (1000 * 60 * 60 * 24))
      
      return `
        <div style="font-family: -apple-system, sans-serif; padding: 10px; min-width: 200px;">
          <h3 style="margin: 0 0 8px 0; font-size: 15px; font-weight: 600;">
            📅 ${disruption.title}
          </h3>
          <p style="margin: 4px 0; font-size: 12px; color: #6b7280;">
            📍 ${disruption.location}
          </p>
          <div style="background: #EFF6FF; padding: 6px; border-radius: 6px; margin-top: 6px;">
            <p style="margin: 2px 0; font-size: 11px;">
              <strong>Starts in:</strong> ${daysUntil} day${daysUntil !== 1 ? 's' : ''}
            </p>
            <p style="margin: 2px 0; font-size: 11px;">
              <strong>Start Date:</strong> ${startDate.toLocaleDateString()}
            </p>
            <p style="margin: 2px 0; font-size: 11px;">
              <strong>Expected Delay:</strong> +${disruption.expected_delay} min
            </p>
          </div>
        </div>
      `
    }

  const handleViewOnMap = (disruption) => {
    if (!disruption.latitude || !disruption.longitude) return

    setSelectedDisruption(disruption)
    
    const map = mapInstanceRef.current
    if (map) {
      map.setView([disruption.latitude, disruption.longitude], 15, {
        animate: true,
        duration: 1
      })
    }
    
    setSidebarOpen(false)
  }

  const getSeverityColor = (severity) => {
    if (severity < 1.0) return '#22c55e'
    if (severity < 2.0) return '#fbbf24'
    return '#ef4444'
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

  return (
    <div className="relative h-full w-full">
      {/* Search Bar */}
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

      {/* Sidebar Toggle */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className={`fixed top-20 z-[1002] bg-white p-3 rounded-lg shadow-lg hover:bg-gray-50 transition-all duration-300 ${
          sidebarOpen ? 'right-[25rem]' : 'right-4'
        }`}
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
          top: '64px',
          height: 'calc(100vh - 64px)',
          backgroundColor: 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(10px)',
        }}
      >
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-800">Disruptions</h2>
              {!loading && (
                <p className="text-sm text-gray-600 mt-1">
                  {disruptions.filter(d => d.status === 'active' || d.status === 'upcoming').length} active
                </p>
              )}
            </div>
            <button onClick={() => setSidebarOpen(false)} className="text-gray-500 hover:text-gray-700">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {loading && (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading disruptions...</p>
            </div>
          )}

          {error && (
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-4">
              <p className="text-orange-800">{error}</p>
              <button onClick={fetchDisruptions} className="mt-2 bg-orange-600 text-white px-4 py-2 rounded-lg text-sm">
                Try again
              </button>
            </div>
          )}

          {!loading && !error && disruptions.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              <div className="text-6xl mb-4">✅</div>
              <p className="text-lg font-semibold">No active disruptions</p>
            </div>
          )}

          {!loading && !error && disruptions.length > 0 && (
            <div className="space-y-4">
              {disruptions
                .filter(d => d.status === 'active' || d.status === 'upcoming')
                .map((disruption) => (
                <div 
                  key={disruption.id} 
                  className={`bg-white border rounded-lg p-4 hover:shadow-md transition cursor-pointer ${
                    selectedDisruption?.id === disruption.id ? 'ring-2 ring-blue-500' : ''
                  }`}
                  onClick={() => handleViewOnMap(disruption)}
                >
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-bold text-lg text-gray-800 flex items-center gap-2">
                      <span>{disruption.status === 'upcoming' ? '📅' : getTypeIcon(disruption.type)}</span>
                      {disruption.title}
                    </h3>
                    {disruption.realtime && (
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded font-semibold">LIVE</span>
                    )}
                  </div>

                  <p className="text-sm text-gray-600 mb-2">📍 {disruption.location}</p>

                  <div className="flex gap-2 mb-3">
                    <span className={`text-xs px-2 py-1 rounded font-semibold ${
                      disruption.status === 'upcoming' ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {disruption.status === 'upcoming' ? 'Upcoming' : 'Active'}
                    </span>
                    {disruption.status === 'active' && (
                      <span className={`text-xs px-2 py-1 rounded font-semibold ${
                        disruption.congestion_level === 'Heavy' ? 'bg-red-100 text-red-700' :
                        disruption.congestion_level === 'Moderate' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-green-100 text-green-700'
                      }`}>
                        {disruption.congestion_level}
                      </span>
                    )}
                  </div>

                  <div className="bg-gray-50 rounded-lg p-3 mb-3">
                    <p className="text-sm text-gray-700">
                      ⏱️ <strong>Delay:</strong> +{disruption.expected_delay} min
                    </p>
                    {disruption.status === 'active' && disruption.start_date && disruption.end_date && (
                      <>
                        <p className="text-sm text-gray-700 mt-1">
                          📅 <strong>Started:</strong> {new Date(disruption.start_date).toLocaleString('en-US', {
                            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                          })}
                        </p>
                        <p className="text-sm text-gray-700 mt-1">
                          🏁 <strong>Ends:</strong> {new Date(disruption.end_date).toLocaleString('en-US', {
                            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                          })}
                        </p>
                      </>
                    )}
                    {disruption.status === 'upcoming' && disruption.start_date && (
                      <p className="text-sm text-gray-700 mt-1">
                        📅 <strong>Starts:</strong> {new Date(disruption.start_date).toLocaleString('en-US', {
                          month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                        })}
                      </p>
                    )}
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleViewOnMap(disruption)
                    }}
                    className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition font-semibold text-sm"
                  >
                    View on Map
                  </button>
                </div>
              ))}
            </div>
          )}

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
      
      <div ref={mapRef} style={{ height: '100%', width: '100%', zIndex: 1 }} />
      <style>{`
        .traffic-flow-line {
          z-index: 400;
          filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));
        }
        
        .traffic-pulse-line {
          animation: traffic-pulse 2.5s ease-in-out infinite;
          z-index: 399;
        }
        
        @keyframes traffic-pulse {
          0%, 100% {
            opacity: 0.2;
            stroke-width: 10;
          }
          50% {
            opacity: 0.05;
            stroke-width: 14;
          }
        }
      `}</style>
    </div>
  )
}