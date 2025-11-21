"use client"

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Navbar from '@/components/Navbar'
import { useAuth } from '@/context/AuthContext';


export default function LoginPage() {
  const router = useRouter()
  const { login, isAuthenticated, loading: authLoading } = useAuth();
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const hasRedirected = useRef(false)

  useEffect(() => {
    if (!authLoading && isAuthenticated && !hasRedirected.current) {
      hasRedirected.current = true;
      router.replace('/dashboard');
    }
  }, [isAuthenticated, authLoading, router]);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    })
    setError('') // Clear error when user types
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const result = await login(formData.email, formData.password)
    
    if (!result.success) {
      setError(result.error || 'Invalid email or password')
      setLoading(false)
    } 
  }

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div
      className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 relative"
    >
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: "url('map.jpg')",
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          opacity: 0.5, // Adjust the opacity here
        }}
      ></div>
      <Navbar />
      
      <main className="container mx-auto px-4 py-20 relative z-10">
        <div className="max-w-md mx-auto">
          {/* Login Card */}
          <div className="bg-white rounded-lg shadow-xl p-8">
            {/* Header */}
                  <div className="text-center mb-10">
                    <div className="mx-auto w-20 h-20 bg-blue-600 rounded-full flex items-center justify-center mb-4">
                    <img src="urban_planner_icon.png" alt="Urban Planner Icon" className="h-20 w-20" />
                    </div>
                    <h1 className="text-3xl font-bold text-gray-800 mb-2">
                    Urban Planner Login
                    </h1>
                  </div>

                  {/* Error Message */}
            {error && (
              <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                <div className="flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  <span>{error}</span>
                </div>
              </div>
            )}

            {/* Login Form */}
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Username */}
              <div>
                <input
                  type="text"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="Email"
                  required
                  className="w-full px-2 py-1 border border-gray-300 text-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Password */}
              <div>
                <input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="Password"
                  required
                  className="w-full px-2 py-1 border border-gray-300 text-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Forgot Password */}
                <div className="text-left">
                  <a
                      href="/forgot-password"
                      className="text-sm text-blue-600 hover:underline font-semibold"
                    >
                      Forgot password?
                  </a>
                </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className={`w-full bg-[#242424] text-[#FFA611] py-3 rounded-full font-semibold transition ${
                  loading 
                    ? 'opacity-50 cursor-not-allowed' 
                    : 'hover:bg-[#FFA611] hover:text-[#242424] '
                }`}
              >
                {loading ? 'Logging in...' : 'Login'}
              </button>
            </form>

            {/* Test Credentials Notice */}
            <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="text-sm text-yellow-800 font-semibold mb-1">
                🔑 Test Credentials:
              </p>
              <p className="text-sm text-yellow-700">
                Username: <code className="bg-yellow-100 px-2 py-1 rounded">planner_calamba@example.gov</code>
              </p>
              <p className="text-sm text-yellow-700">
                Password: <code className="bg-yellow-100 px-2 py-1 rounded">password123</code>
              </p>
            </div>

            {/* Footer Links */}
            <div className="mt-6 text-center">
              <p className="text-sm text-gray-600">
                Not a planner?{' '}
                <a href="/" className="text-blue-600 hover:underline font-semibold">
                  View public map
                </a>
              </p>
            </div>
          </div>

          {/* Info Box */}
          <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
            <p className="text-sm text-blue-800">
              🔒 Only authorized urban planners can access simulation tools
            </p>
          </div>
        </div>
      </main>
    </div>
  )
}