"use client";

import LogoHeader from "@/components/LogoHeader";
import { useAuth } from "@/context/AuthContext";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import LoadingScreen from "@/components/LoadingScreen";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login, isAuthenticated, loading: authLoading } = useAuth();

  // MODE STATE: Controls which view to show in the card
  // Possible values: "login" | "forgotPassword" | "resetPassword"
  const [mode, setMode] = useState("login");

  // Login form state
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Forgot password state
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotError, setForgotError] = useState("");
  const [forgotSuccess, setForgotSuccess] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);

  // Reset password state
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [resetError, setResetError] = useState("");
  const [resetSuccess, setResetSuccess] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [resetToken, setResetToken] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Use ref to track if we've already redirected
  const hasRedirected = useRef(false);

  // Disable page scrolling while on login page (restore on unmount)
  useEffect(() => {
    const prev =
      typeof document !== "undefined" ? document.body.style.overflow : null;
    if (typeof document !== "undefined")
      document.body.style.overflow = "hidden";
    return () => {
      if (typeof document !== "undefined")
        document.body.style.overflow = prev || "";
    };
  }, []);

  // Check for token in URL on mount - if present, show reset password view
  useEffect(() => {
    const token = searchParams.get("token");
    if (token) {
      setResetToken(token);
      setMode("resetPassword");
    }
  }, [searchParams]);

  // FIXED: Only redirect if authenticated AND not currently loading
  useEffect(() => {
    if (!authLoading && isAuthenticated && !hasRedirected.current) {
      hasRedirected.current = true;
      router.replace("/dashboard");
    }
  }, [isAuthenticated, authLoading, router]);

  // LOGIN HANDLERS
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

  // FORGOT PASSWORD HANDLERS
  const validateEmail = (value) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  };

  const handleForgotPasswordSubmit = async (e) => {
    e.preventDefault();
    setForgotError("");
    setForgotSuccess("");

    // Client-side validation
    if (!forgotEmail || !validateEmail(forgotEmail)) {
      setForgotError("Please enter a valid email address.");
      return;
    }

    setForgotLoading(true);
    try {
      // Call the forgot password API endpoint
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: forgotEmail }),
      });

      const data = await res.json();

      if (!res.ok) {
        setForgotError(data.error || "Failed to request password reset.");
      } else {
        // Show generic success message (doesn't reveal if email exists)
        setForgotSuccess(
          data.message ||
            "If an account with that email exists, we've sent instructions to reset your password."
        );
      }
    } catch (err) {
      setForgotError("Could not reach the server. Please try again later.");
    } finally {
      setForgotLoading(false);
    }
  };

  // RESET PASSWORD HANDLERS
  const validatePasswordReset = () => {
    if (!newPassword || newPassword.length < 8) {
      setResetError("Password must be at least 8 characters long.");
      return false;
    }
    if (newPassword !== confirmPassword) {
      setResetError("Passwords do not match.");
      return false;
    }
    return true;
  };

  const handleResetPasswordSubmit = async (e) => {
    e.preventDefault();
    setResetError("");
    setResetSuccess("");

    if (!resetToken) {
      setResetError("Invalid reset link (missing token).");
      return;
    }

    if (!validatePasswordReset()) return;

    setResetLoading(true);
    try {
      // Call the reset password API endpoint
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: resetToken, newPassword }),
      });

      const data = await res.json();

      if (!res.ok) {
        setResetError(data.error || data.message || "Failed to reset password");
      } else {
        setResetSuccess(data.message || "Password updated successfully");
        // Redirect to login after 1.5 seconds
        setTimeout(() => {
          setMode("login");
          router.push("/login"); // Clear token from URL
        }, 1500);
      }
    } catch (err) {
      setResetError(
        "Could not reach backend. Please ensure the backend server is running."
      );
    } finally {
      setResetLoading(false);
    }
  };

  // MODE SWITCHERS
  const switchToForgotPassword = (e) => {
    e.preventDefault();
    setMode("forgotPassword");
    // Clear any previous errors/success
    setForgotEmail("");
    setForgotError("");
    setForgotSuccess("");
  };

  const switchToLogin = (e) => {
    e.preventDefault();
    setMode("login");
    // Clear any previous errors
    setError("");
    setForgotError("");
    setForgotSuccess("");
    setResetError("");
    setResetSuccess("");
  };

  // Show loading spinner while checking authentication
  if (authLoading) {
    return <LoadingScreen />;
  }

  // RENDER: Main layout with conditional card content based on mode
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
      <div className="-mb-10">
        <LogoHeader />
      </div>
      <main
        className="container mx-auto px-4 relative z-10"
        style={{
          minHeight: "calc(100vh - 80px)",
          display: "flex",
          alignItems: "center",
          paddingTop: "0",
          paddingBottom: "0",
        }}
      >
      
        <div className="max-w-md mx-auto w-full">
          
          {/* Card Container - content changes based on mode */}
          <div className="bg-white rounded-lg shadow-xl p-9">
            {/* MODE: LOGIN */}
            {mode === "login" && (
              <div className="py-2">
                {/* Header */}
                <div className="text-center mb-6">
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
                  <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
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
                <form onSubmit={handleSubmit} className="space-y-4">
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
                      aria-label={
                        showPassword ? "Hide password" : "Show password"
                      }
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

                  {/* Forgot Password - switches mode instead of navigating */}
                  <div className="text-left">
                    <button
                      type="button"
                      onClick={switchToForgotPassword}
                      className="text-sm text-blue-600 hover:underline font-semibold"
                    >
                      Forgot password?
                    </button>
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
            )}

            {/* MODE: FORGOT PASSWORD */}
            {mode === "forgotPassword" && (
              <>
                <div className="text-center mb-8">
                  <h1 className="text-2xl font-bold text-gray-800">
                    Reset your password
                  </h1>
                  <p className="text-gray-600 mt-2">
                    Enter the email you use for your Urban Planner account and
                    we'll send you a reset link.
                  </p>
                </div>

                {/* Error message display */}
                {forgotError && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded">
                    {forgotError}
                  </div>
                )}

                {/* Success message display */}
                {forgotSuccess && (
                  <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded">
                    {forgotSuccess}
                  </div>
                )}

                <form
                  onSubmit={handleForgotPasswordSubmit}
                  className="space-y-4"
                >
                  <div>
                    <label className="block text-gray-700 font-semibold mb-2">
                      Email
                    </label>
                    <input
                      type="email"
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      placeholder="your.email@example.com"
                      required
                      disabled={forgotLoading}
                      className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 text-gray-600"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={forgotLoading}
                    className={`w-full py-3 rounded-lg font-semibold transition-all duration-300 ${
                      forgotLoading
                        ? "bg-gray-300 text-gray-600"
                        : "bg-[#242424] text-[#FFA611] hover:bg-[#FFA611] hover:text-[#242424]"
                    }`}
                  >
                    {forgotLoading ? "Sending..." : "Send reset link"}
                  </button>
                </form>

                <div className="mt-6 text-center">
                  <p className="text-gray-600">
                    Remembered your password?{" "}
                    <button
                      onClick={switchToLogin}
                      className="text-blue-600 hover:underline font-semibold"
                    >
                      Back to login
                    </button>
                  </p>
                </div>
              </>
            )}

            {/* MODE: RESET PASSWORD */}
            {mode === "resetPassword" && (
              <>
                <div className="text-center mb-8">
                  <h1 className="text-2xl font-bold text-gray-800">
                    Create a new password
                  </h1>
                  <p className="text-gray-600 mt-2">
                    Set a new password for your account.
                  </p>
                </div>

                {/* Error message display */}
                {resetError && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded">
                    {resetError}
                  </div>
                )}

                {/* Success message display */}
                {resetSuccess && (
                  <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded">
                    {resetSuccess}
                  </div>
                )}

                <form
                  onSubmit={handleResetPasswordSubmit}
                  className="space-y-4"
                >
                  <div>
                    <label className="block text-gray-700 font-semibold mb-2">
                      New password
                    </label>
                    <div className="relative">
                      <input
                        type={showNewPassword ? "text" : "password"}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Enter new password"
                        required
                        disabled={resetLoading}
                        className="w-full px-4 py-2 pr-10 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 text-gray-600"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        disabled={resetLoading}
                        className="absolute right-2 top-1/2 -translate-y-1/2 hover:text-gray-700 focus:outline-none disabled:opacity-50 text-gray-600"
                        aria-label={
                          showNewPassword ? "Hide password" : "Show password"
                        }
                      >
                        {showNewPassword ? (
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
                  </div>

                  <div>
                    <label className="block text-gray-700 font-semibold mb-2">
                      Confirm password
                    </label>
                    <div className="relative">
                      <input
                        type={showConfirmPassword ? "text" : "password"}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Repeat new password"
                        required
                        disabled={resetLoading}
                        className="w-full px-4 py-2 pr-10 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 text-gray-600"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setShowConfirmPassword(!showConfirmPassword)
                        }
                        disabled={resetLoading}
                        className="absolute right-2 top-1/2 -translate-y-1/2 hover:text-gray-700 focus:outline-none disabled:opacity-50 text-gray-600"
                        aria-label={
                          showConfirmPassword
                            ? "Hide password"
                            : "Show password"
                        }
                      >
                        {showConfirmPassword ? (
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
                  </div>

                  <button
                    type="submit"
                    disabled={resetLoading}
                    className={`w-full py-3 rounded-lg font-semibold transition-all duration-300 ${
                      resetLoading
                        ? "bg-gray-300 text-gray-600"
                        : "bg-[#242424] text-[#FFA611] hover:bg-[#FFA611] hover:text-[#242424]"
                    }`}
                  >
                    {resetLoading ? "Updating..." : "Update password"}
                  </button>
                </form>

                <div className="mt-4 text-center">
                  <button
                    onClick={switchToLogin}
                    className="text-blue-600 hover:underline"
                  >
                    Back to login
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Info Box - only show in login mode */}
          {mode === "login" && (
            <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
              <p className="text-sm text-blue-800">
                🔒 Only authorized urban planners can access simulation tools
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
