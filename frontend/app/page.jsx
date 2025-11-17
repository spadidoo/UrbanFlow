"use client";

import HomeMapWithSidebar from '../components/HomeMapWithSidebar';
import Navbar from '../components/Navbar';

export default function HomePage() {
  return (
    <div className="h-screen flex flex-col">
      {/* Navbar at top */}
      <Navbar />
      
      {/* Map fills remaining space */}
      <div className="flex-1">
        <HomeMapWithSidebar />
      </div>
    </div>
  );
}