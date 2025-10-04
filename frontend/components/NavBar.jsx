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
          <Link href="/" className="flex items-center space-x-3">
            <img
              src="/URBANFLOW_logo.png"
              alt="UrbanFlow"
              className="h-10 w-auto"
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
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                />
              </svg>
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}
