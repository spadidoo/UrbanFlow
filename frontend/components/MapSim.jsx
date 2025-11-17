"use client";

import L from "leaflet";
import { useState } from "react";
import {
  MapContainer,
  Marker,
  Popup,
  TileLayer,
  useMapEvents,
} from "react-leaflet";

// Fix marker icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png",
});

function ClickHandler({ onClick }) {
  useMapEvents({
    click(e) {
      onClick(e);
    },
  });
  return null;
}

export default function MapSim() {
  const [marker, setMarker] = useState(null);

  const handleMapClick = (e) => {
    const { lat, lng } = e.latlng;
    // Only allow one marker at a time
    setMarker({ lat, lng });
  };

  const resetMarker = () => {
    setMarker(null);
  };

  return (
    <MapContainer
      center={[14.2096, 121.164]} // Calamba
      zoom={13}
      style={{ height: "500px", width: "100%" }}
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution="&copy; OpenStreetMap contributors"
      />
      <ClickHandler onClick={handleMapClick} />

      {marker && (
        <Marker position={[marker.lat, marker.lng]}>
          <Popup>
            <div>
              <p>
                Location: {marker.lat.toFixed(4)}, {marker.lng.toFixed(4)}
              </p>
              <p>Is this the correct location?</p>
              <button
                style={{
                  marginRight: "8px",
                  background: "#4CAF50",
                  color: "white",
                  border: "none",
                  padding: "4px 8px",
                  cursor: "pointer",
                }}
                onClick={() =>
                  alert(
                    "Location confirmed ✅ (later this will connect to form)"
                  )
                }
              >
                Yes
              </button>
              <button
                style={{
                  background: "#f44336",
                  color: "white",
                  border: "none",
                  padding: "4px 8px",
                  cursor: "pointer",
                }}
                onClick={resetMarker}
              >
                Reset
              </button>
            </div>
          </Popup>
        </Marker>
      )}
    </MapContainer>
  );
}
