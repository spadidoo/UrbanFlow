"use client";

import { useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useState } from "react";

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const router = useRouter();

  // ✅ FIXED: Properly construct base URL and auth URL
  const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "https://api.urbanflowph.com";
  const API_BASE_URL = `${BASE_URL}/api/auth`; // Auth endpoints are at /api/auth/*

  useEffect(() => {
    if (!isLoggingOut) {
      checkAuth();
    } else {
      setLoading(false);
    }
  }, []);

  async function checkAuth() {
    console.log("🔍 checkAuth() called");
    
    const justLoggedOut = localStorage.getItem("just_logged_out");
    if (justLoggedOut === "true") {
      console.log("🚫 User just logged out - skipping auth check");
      localStorage.removeItem("just_logged_out");
      setLoading(false);
      return;
    }
    
    const token = localStorage.getItem("token");
    console.log("🔑 Token found:", token ? "YES" : "NO");
    
    if (!token) {
      console.log("❌ No token - setting loading to false");
      setLoading(false);
      return;
    }

    // ✅ NEW: Check if token is expired before making API call
    try {
      const payload = JSON.parse(atob(token.split('.')[1])); // Decode JWT payload
      const expiryTime = payload.exp * 1000; // Convert to milliseconds
      
      if (Date.now() >= expiryTime) {
        console.log("⏰ Token expired - clearing session");
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        setUser(null);
        setLoading(false);
        return;
      }
      
      console.log(`✅ Token valid - expires in ${Math.round((expiryTime - Date.now()) / 1000 / 60)} minutes`);
    } catch (e) {
      console.error("❌ Failed to decode token:", e);
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      setUser(null);
      setLoading(false);
      return;
    }

    try {
      console.log("📡 Fetching user info from:", `${API_BASE_URL}/me`);
      const response = await fetch(`${API_BASE_URL}/me`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        console.log("✅ User authenticated:", data.user);
        
        // ✅ NEW: Include avatarUrl in user object
        const userData = {
          ...data.user,
          // Map profile_photo to avatarUrl for frontend consistency
          avatarUrl: data.user.profile_photo || data.user.avatarUrl || "/urban_planner_icon.png"
        };
        
        setUser(userData);
      } else {
        console.log("❌ Token invalid - clearing");
        localStorage.removeItem("token");
        setUser(null);
      }
    } catch (error) {
      console.error("❌ Auth check failed:", error);
      localStorage.removeItem("token");
      setUser(null);
    } finally {
      setLoading(false);
    }
  }

  async function login(email, password) {
    try {
      console.log("📡 Login request to:", `${API_BASE_URL}/login`);
      const response = await fetch(`${API_BASE_URL}/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Login failed");
      }

      localStorage.setItem("token", data.token);
      
      // ✅ NEW: Include avatarUrl in user object after login
      const userData = {
        ...data.user,
        avatarUrl: data.user.profile_photo || data.user.avatarUrl || "/urban_planner_icon.png"
      };
      
      setUser(userData);

      router.push("/dashboard");
      
      return { success: true };
    } catch (error) {
      console.error("Login error:", error);
      return { success: false, error: error.message };
    }
  }

  async function logout() {
    console.log("🚪 Logout called - clearing auth state");
    
    setIsLoggingOut(true);
    localStorage.setItem("just_logged_out", "true");
    
    console.log("🔑 Token before clear:", localStorage.getItem("token"));
    
    // ✅ Clear ALL auth-related data
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    sessionStorage.clear(); // ✅ Also clear session storage
    
    console.log("🔑 Token after clear:", localStorage.getItem("token"));
    
    setUser(null);
    console.log("👤 User set to null");
    
    // ✅ Optional: Call backend logout endpoint (if you want to blacklist the token)
    try {
      const token = localStorage.getItem("token");
      if (token) {
        await fetch(`${API_BASE_URL}/logout`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
      }
    } catch (e) {
      console.log("⚠️ Backend logout failed (non-critical):", e);
    }
    
    await new Promise(resolve => setTimeout(resolve, 200));
    
    console.log("🔄 Forcing full page reload to /login...");
    window.location.href = "/login";
    
    console.log("✅ Logout complete");
  }

  async function updateProfile(profileData) {
    const token = localStorage.getItem("token");
    
    try {
      const response = await fetch(`${API_BASE_URL}/update-profile`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(profileData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Update failed");
      }

      // ✅ NEW: Reload user data to get updated avatar
      await checkAuth();
      
      return { success: true, message: data.message };
    } catch (error) {
      console.error("Update profile error:", error);
      return { success: false, error: error.message };
    }
  }

  async function changePassword(currentPassword, newPassword) {
    const token = localStorage.getItem("token");
    
    try {
      const response = await fetch(`${API_BASE_URL}/change-password`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Password change failed");
      }
      
      return { success: true, message: data.message };
    } catch (error) {
      console.error("Change password error:", error);
      return { success: false, error: error.message };
    }
  }

  // ✅ NEW: Expose checkAuth so it can be called after avatar upload
  const value = {
    user,
    loading,
    login,
    logout,
    updateProfile,
    changePassword,
    checkAuth,  // NEW: Allow manual refresh of user data
    isAuthenticated: !!user,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}