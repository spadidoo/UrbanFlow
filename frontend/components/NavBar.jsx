"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Navbar() {
  const pathname = usePathname();
  const isActive = (path) => pathname === path;

  return (
    <nav
      style={{ backgroundColor: "rgba(251, 146, 60, 0.6)" }}
      className="fixed top-0 left-0 w-full text-white shadow-lg backdrop-blur-sm z-[1001]"
    >
      <div className="px-4">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center space-x-1">
            <img
              src="/DupURBANFLOW.png"
              alt="UrbanFlow"
              className="h-20 w-auto sm:h-15 md:h-12"
            />
            <span className="text-xl font-bold">UrbanFlow</span>
          </Link>

          {/* Navigation Links */}
          <div className="flex items-center space-x-6">
            <Link
              href="/"
              className={`hover:text-blue-200 transition ${
                isActive("/") ? "border-b-2 border-white pb-1" : ""
              }`}
            >
              Home
            </Link>
            <Link
              href="/map"
              className={`hover:text-blue-200 transition ${
                isActive("/map") ? "border-b-2 border-white pb-1" : ""
              }`}
            >
              Map
            </Link>
            <Link
              href="/about"
              className={`hover:text-blue-200 transition ${
                isActive("/about") ? "border-b-2 border-white pb-1" : ""
              }`}
            >
              About
            </Link>
            <Link
              href="/contact"
              className={`hover:text-blue-200 transition ${
                isActive("/contact") ? "border-b-2 border-white pb-1" : ""
              }`}
            >
              Contact
            </Link>

            {/* Login Icon */}
            <Link
              href="/login"
              className="ml-4 bg-white text-blue-600 p-2 rounded-full hover:bg-blue-50 transition"
              title="Urban Planner Login"
            >
              <img
                src="urban_planner_icon.png"
                className="h-7 w-7"
                fill="none"
                viewBox="1 1 24 24"
              />
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}
