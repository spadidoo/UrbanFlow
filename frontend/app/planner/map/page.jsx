"use client";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import "leaflet/dist/leaflet.css";

// Dynamically import Leaflet so it works in Next.js
const MapContainer = dynamic(
  () => import("react-leaflet").then(mod => mod.MapContainer),
  { ssr: false }
);
const TileLayer = dynamic(
  () => import("react-leaflet").then(mod => mod.TileLayer),
  { ssr: false }
);

export default function MapPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-[#0F172A] text-gray-800 dark:text-gray-200">
      {/* Header */}
      <div className="flex items-center justify-between px-8 py-4 bg-[#1E293B] text-white">
        <h1 className="text-2xl font-bold">UrbanFlow Map</h1>
        <button
          onClick={() => router.push("/planner")}
          className="px-4 py-2 bg-orange-500 text-white rounded hover:bg-orange-600"
        >
          ← Back to Dashboard
        </button>
      </div>

      {/* Map Container */}
      <div className="relative w-full h-[calc(100vh-80px)]">
        <MapContainer
          center={[14.211, 121.165]} // Calamba coordinates
          zoom={13}
          style={{
            height: "100%",
            width: "100%",
            backgroundColor: "transparent",
            zIndex: 1,
          }}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors'
          />
        </MapContainer>
      </div>
    </div>
  );
}
