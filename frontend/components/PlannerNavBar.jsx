"use client"

import { useAuth } from '@/contexts/AuthContext'; // ADDED: Import useAuth
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

export default function PlannerNavbar() {
  const pathname = usePathname()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const { logout, user } = useAuth()  // ADDED: Get logout function and user
  
  const isActive = (path) => pathname === path

  // ADDED: Handle logout properly
  const handleLogout = async () => {
    setDropdownOpen(false)  // Close dropdown
    await logout()  // Call the AuthContext logout function
  }

  return (
    <nav 
      style={{ 
        backgroundColor: 'rgba(251, 146, 60, 0.95)',
        backdropFilter: 'blur(8px)'
      }} 
      className="text-white shadow-lg"
    >
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link href="/dashboard" className="flex items-center space-x-3">
            <img src="/URBANFLOW_logo.png" alt="UrbanFlow" className="h-10 w-auto" />
            <span className="text-xl font-bold">UrbanFlow</span>
          </Link>

          {/* Navigation Links */}
          <div className="flex items-center space-x-6">
            <Link 
              href="/dashboard" 
              className={`hover:text-orange-100 transition font-medium ${isActive('/dashboard') ? 'border-b-2 border-white pb-1' : ''}`}
            >
              Home
            </Link>
            <Link 
              href="/planner-map" 
              className={`hover:text-orange-100 transition font-medium ${isActive('/planner-map') ? 'border-b-2 border-white pb-1' : ''}`}
            >
              Map
            </Link>
            <Link 
              href="/data" 
              className={`hover:text-orange-100 transition font-medium ${isActive('/data') ? 'border-b-2 border-white pb-1' : ''}`}
            >
              Data
            </Link>
            <Link 
              href="/reports" 
              className={`hover:text-orange-100 transition font-medium ${isActive('/reports') ? 'border-b-2 border-white pb-1' : ''}`}
            >
              Report
            </Link>
            <Link 
              href="/simulation" 
              className={`hover:text-orange-100 transition font-medium ${isActive('/simulation') ? 'border-b-2 border-white pb-1' : ''}`}
            >
              Simulate
            </Link>

            {/* Profile Dropdown */}
            <div className="relative">
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="bg-white text-orange-500 p-2 rounded-full hover:bg-orange-50 transition"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </button>

              {/* Dropdown Menu */}
              {dropdownOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-xl py-2 z-50">
                  {/* ADDED: Show user name if available */}
                  {user && (
                    <>
                      <div className="px-4 py-2 text-gray-800 border-b">
                        <p className="font-semibold">{user.firstName} {user.lastName}</p>
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
                  
                  {/* FIXED: Now calls the proper logout function */}
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
  )
}
