"use client";

//import Navbar from "@/components/NavBar";
import dynamic from "next/dynamic";

const HomeMapWithSidebar = dynamic(
  () => import("@/components/HomeMapWithSidebar"),
  {
    ssr: false,
    loading: () => (
      <div className="h-screen w-full bg-gray-200 flex items-center justify-center">
        Loading map...
      </div>
    ),
  }
);

export default function HomePage() {
  return (
    <div className="h-screen w-full relative">
      {/* Map - Full screen behind navbar */}
      <HomeMapWithSidebar />
    </div>
  );
}
