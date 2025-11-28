"use client";

import Navbar from "@/components/Navbar";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export default function LoginPage() {
  const router = useRouter();
  const { login, isAuthenticated, loading: authLoading } = useAuth();

  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Use ref to track if we've already redirected
  const hasRedirected = useRef(false);

  // FIXED: Only redirect if authenticated AND not currently loading
  useEffect(() => {
    if (!authLoading && isAuthenticated && !hasRedirected.current) {
      hasRedirected.current = true;
      router.replace("/dashboard");
    }
  }, [isAuthenticated, authLoading, router]);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
    setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const result = await login(formData.email, formData.password);

    if (!result.success) {
      setError(result.error || "Invalid email or password");
      setLoading(false);
    }
    // If success, the AuthContext will handle the redirect to dashboard
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  // Show loading spinner while checking authentication
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 relative">
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: "url('map.jpg')",
          backgroundSize: "cover",
          backgroundPosition: "center",
          opacity: 0.5,
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
                <img
                  src="urban_planner_icon.png"
                  alt="Urban Planner Icon"
                  className="h-20 w-20"
                />
              </div>
              <h1 className="text-3xl font-bold text-gray-800 mb-2">
                Urban Planner Login
              </h1>
            </div>

            {/* Error Message */}
            {error && (
              <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                <div className="flex items-center gap-2">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span>{error}</span>
                </div>
              </div>
            )}

            {/* Login Form */}
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Email */}
              <div>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="Email"
                  required
                  disabled={loading}
                  className="w-full px-2 py-1 border border-gray-300 text-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
                />
              </div>

              {/* Password */}
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="Password"
                  required
                  disabled={loading}
                  className="w-full px-2 py-1 pr-10 border border-gray-300 text-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
                />
                <button
                  type="button"
                  onClick={togglePasswordVisibility}
                  disabled={loading}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 focus:outline-none disabled:opacity-50"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={1.5}
                      stroke="currentColor"
                      className="w-5 h-5"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88"
                      />
                    </svg>
                  ) : (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={1.5}
                      stroke="currentColor"
                      className="w-5 h-5"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                    </svg>
                  )}
                </button>
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
                    ? "opacity-50 cursor-not-allowed"
                    : "hover:bg-[#FFA611] hover:text-[#242424]"
                }`}
              >
                {loading ? "Logging in..." : "Login"}
              </button>
            </form>

            {/* Test Credentials Notice */}
            <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="text-sm text-yellow-800 font-semibold mb-1">
                🔑 Test Credentials:
              </p>
              <p className="text-sm text-yellow-700">
                Email:{" "}
                <code className="bg-yellow-100 px-2 py-1 rounded">
                  planner_calamba@example.gov
                </code>
              </p>
              <p className="text-sm text-yellow-700">
                Password:{" "}
                <code className="bg-yellow-100 px-2 py-1 rounded">
                  password123
                </code>
              </p>
            </div>

            {/* Footer Links */}
            <div className="mt-6 text-center">
              <p className="text-sm text-gray-600">
                Not a planner?{" "}
                <a
                  href="/"
                  className="text-blue-600 hover:underline font-semibold"
                >
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
  );
}