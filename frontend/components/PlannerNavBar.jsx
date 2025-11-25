"use client";

import { useAuth } from "@/context/AuthContext";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

export default function PlannerNavbar() {
  const pathname = usePathname();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const { logout, user } = useAuth();

  const isActive = (path) => pathname === path;

  const handleLogout = async () => {
    setDropdownOpen(false);
    await logout();
  };

  return (
    <nav
      style={{
        backgroundColor: "rgba(251, 146, 60, 0.95)",
        backdropFilter: "blur(8px)",
      }}
      className="text-white shadow-lg"
    >
      <div className="container mx-auto px-2">
        <div className="flex justify-between items-center h-18">
          {/* Logo */}
          <Link href="/dashboard" className="flex items-center space-x-1">
            <img
              src="/DUPURBANFLOW.png"
              alt="UrbanFlow"
              className="h-20 w-auto sm:h-18 md:h-15"
            />
            <span className="text-2xl font-bold">UrbanFlow</span>
          </Link>

          {/* Navigation Links */}
          <div className="flex items-center space-x-8">
            <Link
              href="/dashboard"
              className={`hover:text-orange-200 transition ${
                isActive("/dashboard") ? "border-b-2 border-white pb-1" : ""
              }`}
            >
              Home
            </Link>
            <Link
              href="/planner-map"
              className={`hover:text-orange-200 transition ${
                isActive("/planner-map") ? "border-b-2 border-white pb-1" : ""
              }`}
            >
              Map
            </Link>
            <Link
              href="/data"
              className={`hhover:text-orange-200 transition ${
                isActive("/data") ? "border-b-2 border-white pb-1" : ""
              }`}
            >
              Data
            </Link>
            <Link
              href="/reports"
              className={`hover:text-orange-200 transition ${
                isActive("/reports") ? "border-b-2 border-white pb-1" : ""
              }`}
            >
              Report
            </Link>
            <Link
              href="/simulation"
              className={`hhover:text-orange-200 transition ${
                isActive("/simulation") ? "border-b-2 border-white pb-1" : ""
              }`}
            >
              Simulate
            </Link>

            {/* Profile Dropdown */}
            <div className="relative">
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="bg-white rounded-full hover:bg-orange-50 transition w-12 h-12 flex items-center justify-center overflow-hidden p-0"
              >
                {user?.avatarUrl ? (
                  <img
                    src={user.avatarUrl}
                    alt="Profile"
                    className="w-full h-full object-cover rounded-full"
                  />
                ) : (
                  <img
                    src="/urban_planner_icon.png"
                    alt="Urban Planner"
                    className="w-full h-full object-cover rounded-full"
                  />
                )}
              </button>

              {/* Dropdown Menu */}
              {dropdownOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-xl py-2 z-50">
                  {user && (
                    <>
                      <div className="px-4 py-2 text-gray-800 border-b">
                        <p className="font-semibold">
                          {user.firstName} {user.lastName}
                        </p>
                        <p className="text-xs text-gray-500">{user.email}</p>
                      </div>
                    </>
                  )}

                  <Link
                    href="/settings"
                    className="block px-4 py-2 text-gray-800 hover:bg-gray-100"
                    onClick={() => setDropdownOpen(false)}
                  >
                    Account Settings
                  </Link>

                  <hr className="my-2" />

                  <button
                    onClick={handleLogout}
                    className="block w-full text-left px-4 py-2 text-red-600 hover:bg-gray-100"
                  >
                    Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
