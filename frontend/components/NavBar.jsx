"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Navbar() {
  const pathname = usePathname(); // Get the current path from Next.js router
  const isActive = (path) => pathname === path; // Helper function to check if a link is active

  return (
    <nav
      style={{ backgroundColor: "rgba(243, 112, 33, 0.6)" }} // Inline style for background color
      className="fixed top-0 left-0 w-full text-white shadow-lg backdrop-blur-sm z-[1001]" // Tailwind classes for styling
    >
      <div className="px-4">
        <div className="flex justify-between items-center h-16">
          {/* Logo Section */}
          <Link href="/" className="flex items-center space-x-3">
            <img
              src="/URBANFLOW_logo.png" // Logo image source
              alt="UrbanFlow" // Alternative text for accessibility
              className="h-10 w-auto" // Tailwind classes for image size
            />
            <span className="text-xl font-bold">UrbanFlow</span> {/* Brand name */}
          </Link>

          {/* Navigation Links */}
          <div className="flex items-center space-x-6">
            {/* Home Link */}
            <Link
              href="/"
              className={`hover:text-blue-200 transition ${
                isActive("/") ? "border-b-2 border-white pb-1" : "" // Highlight active link
              }`}
            >
              Home
            </Link>
            {/* Map Link */}
            <Link
              href="/map"
              className={`hover:text-blue-200 transition ${
                isActive("/map") ? "border-b-2 border-white pb-1" : "" // Highlight active link
              }`}
            >
              Map
            </Link>
            {/* About Link */}
            <Link
              href="/about"
              className={`hover:text-blue-200 transition ${
                isActive("/about") ? "border-b-2 border-white pb-1" : "" // Highlight active link
              }`}
            >
              About
            </Link>
            {/* Contact Link */}
            <Link
              href="/contact"
              className={`hover:text-blue-200 transition ${
                isActive("/contact") ? "border-b-2 border-white pb-1" : "" // Highlight active link
              }`}
            >
              Contact
            </Link>

            {/* Login Icon */}
            <Link
              href="/login"
              className="ml-4 bg-white rounded-full transition flex items-center justify-center" // Styling for the login icon container
              title="Urban Planner Login" // Tooltip for the login icon
            >
              <img
                src="/urban_planner_icon.png" // Login icon image source
                alt="Urban Planner Login" // Alternative text for accessibility
                className="h-10 w-10 rounded-full" // Tailwind classes for image size and shape
              />
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}
