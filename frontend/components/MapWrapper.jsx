"use client";

import dynamic from "next/dynamic";

// Import MapSim only on client (no SSR)
const MapSim = dynamic(() => import("../components/MapSim"), { ssr: false });

export default function MapWrapper() {
  return <MapSim />;
}
