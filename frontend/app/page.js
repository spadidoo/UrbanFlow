"use client";

//import Navbar from "@/components/NavBar";
import dynamic from "next/dynamic";
import LoadingScreen from "@/components/LoadingScreen";

const HomeMapWithSidebar = dynamic(
  () => import("@/components/HomeMapWithSidebar"),
  {
    ssr: false,
    loading: () => <LoadingScreen />,
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
