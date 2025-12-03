"use client";

//import Navbar from "@/components/NavBar";
import dynamic from "next/dynamic";
import { useEffect } from "react";
import LoadingScreen from "@/components/LoadingScreen";

const HomeMapWithSidebar = dynamic(
  () => import("@/components/HomeMapWithSidebar"),
  {
    ssr: false,
    loading: () => <LoadingScreen />,
  }
);

export default function HomePage() {
  // Add map-page class to body for this page only
  useEffect(() => {
    document.body.classList.add("map-page");
    return () => {
      document.body.classList.remove("map-page");
    };
  }, []);

  return (
    <div className="h-screen w-full relative">
      {/* Map - Full screen behind navbar */}
      <HomeMapWithSidebar />
    </div>
  );
}
