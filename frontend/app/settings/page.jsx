"use client";

import PlannerNavbar from "@/components/PlannerNavBar";
import { useAuth } from "@/context/AuthContext";
import { useEffect, useState } from "react";

export default function SettingsPage() {
  const { user, updateProfile, changePassword } = useAuth();
  
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });
  
  // Profile form state
  const [profileData, setProfileData] = useState({
    firstName: "",
    lastName: "",
    email: "",
  });
  
  // Password form state
  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  
  // Avatar state
  const [avatarPreview, setAvatarPreview] = useState("/urban_planner_icon.png");
  const [avatarFile, setAvatarFile] = useState(null);

  // Load user data when available
  useEffect(() => {
    if (user) {
      setProfileData({
        firstName: user.firstName || "",
        lastName: user.lastName || "",
        email: user.email || "",
      });
      
      // Load avatar if available
      if (user.avatarUrl) {
        setAvatarPreview(user.avatarUrl);
      }
    }
  }, [user]);

  const handleProfileChange = (e) => {
    setProfileData({
      ...profileData,
      [e.target.name]: e.target.value,
    });
  };

  const handlePasswordChange = (e) => {
    setPasswordData({
      ...passwordData,
      [e.target.name]: e.target.value,
    });
  };

  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        setMessage({
          type: "error",
          text: "File size must be less than 2MB",
        });
        return;
      }

      if (!file.type.startsWith("image/")) {
        setMessage({
          type: "error",
          text: "Please select an image file",
        });
        return;
      }

      setAvatarFile(file);
      
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveProfile = async () => {
    try {
      setLoading(true);
      setMessage({ type: "", text: "" });

      // Upload avatar first if changed
      if (avatarFile) {
        const formData = new FormData();
        formData.append("avatar", avatarFile);
        formData.append("user_id", user.id);

        const uploadResponse = await fetch("http://backend.urbanflowph.com/api/upload-avatar", {
          method: "POST",
          body: formData,
        });

        const uploadData = await uploadResponse.json();

        if (!uploadData.success) {
          throw new Error(uploadData.error || "Failed to upload avatar");
        }
      }

      // Update profile
      const result = await updateProfile(profileData);

      if (result.success) {
        setMessage({
          type: "success",
          text: "Account settings saved successfully!",
        });
        setIsEditing(false);
        setAvatarFile(null);
      } else {
        throw new Error(result.error || "Failed to update profile");
      }
    } catch (error) {
      setMessage({
        type: "error",
        text: error.message || "Failed to save changes",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async () => {
    try {
      if (passwordData.newPassword !== passwordData.confirmPassword) {
        setMessage({
          type: "error",
          text: "New passwords do not match",
        });
        return;
      }

      if (passwordData.newPassword.length < 8) {
        setMessage({
          type: "error",
          text: "Password must be at least 8 characters",
        });
        return;
      }

      setLoading(true);
      setMessage({ type: "", text: "" });

      const result = await changePassword(
        passwordData.currentPassword,
        passwordData.newPassword
      );

      if (result.success) {
        setMessage({
          type: "success",
          text: "Password changed successfully!",
        });
        setPasswordData({
          currentPassword: "",
          newPassword: "",
          confirmPassword: "",
        });
      } else {
        throw new Error(result.error || "Failed to change password");
      }
    } catch (error) {
      setMessage({
        type: "error",
        text: error.message || "Failed to change password",
      });
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ✅ NAVBAR INCLUDED */}
      <PlannerNavbar />

      {/* PAGE CONTENT */}
      <div className="py-6 px-4">
        <div className="max-w-5xl mx-auto">
          {/* Header */}
          <div className="bg-white rounded-lg shadow-sm mb-4 p-6">
            <div className="flex justify-between items-start">
              <div>
                <h1 className="text-2xl font-bold text-gray-900 mb-1">
                  Account Settings
                </h1>
                <p className="text-sm text-gray-600">
                  Change your profile information and password.
                </p>
              </div>
              {!isEditing && (
                <button
                  onClick={() => setIsEditing(true)}
                  className="px-5 py-2.5 bg-orange-500 text-white font-medium rounded-lg hover:bg-orange-600 transition"
                >
                  Edit Profile
                </button>
              )}
            </div>
          </div>

          {/* Success Message */}
          {message.text && message.type === "success" && (
            <div className="mb-4">
              <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg flex items-start gap-2">
                <svg
                  className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
                <span className="text-sm font-medium">{message.text}</span>
              </div>
            </div>
          )}

          {/* Error Message */}
          {message.text && message.type === "error" && (
            <div className="mb-4">
              <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg">
                <span className="text-sm">{message.text}</span>
              </div>
            </div>
          )}

          {/* Profile Section */}
          <div className="bg-white rounded-lg shadow-sm p-6 mb-4">
            <div className="flex gap-8">
              {/* Avatar - Left Side */}
              <div className="flex-shrink-0">
                <div className="w-32 h-32 rounded-full overflow-hidden bg-orange-50 flex items-center justify-center border-4 border-orange-100">
                  {avatarPreview && avatarPreview !== "/urban_planner_icon.png" ? (
                    <img
                      src={avatarPreview}
                      alt="Profile"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <svg
                      className="w-16 h-16 text-orange-500"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z" />
                    </svg>
                  )}
                </div>
                {isEditing && (
                  <div className="mt-3">
                    <label className="block">
                      <span className="sr-only">Choose photo</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleAvatarChange}
                        className="block w-32 text-xs text-gray-500
                          file:mr-2 file:py-1.5 file:px-3
                          file:rounded file:border-0
                          file:text-xs file:font-medium
                          file:bg-orange-50 file:text-orange-700
                          hover:file:bg-orange-100 cursor-pointer"
                      />
                    </label>
                    <p className="mt-1 text-xs text-gray-500">Max 2MB</p>
                  </div>
                )}
              </div>

              {/* Form Fields - Right Side */}
              <div className="flex-1">
                <div className="grid grid-cols-2 gap-4 mb-4">
                  {/* First Name */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      First Name
                    </label>
                    {isEditing ? (
                      <input
                        type="text"
                        name="firstName"
                        value={profileData.firstName}
                        onChange={handleProfileChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                      />
                    ) : (
                      <div className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900">
                        {user.firstName}
                      </div>
                    )}
                  </div>

                  {/* Last Name */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Last Name
                    </label>
                    {isEditing ? (
                      <input
                        type="text"
                        name="lastName"
                        value={profileData.lastName}
                        onChange={handleProfileChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                      />
                    ) : (
                      <div className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900">
                        {user.lastName}
                      </div>
                    )}
                  </div>
                </div>

                {/* Email */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Email
                  </label>
                  {isEditing ? (
                    <input
                      type="email"
                      name="email"
                      value={profileData.email}
                      onChange={handleProfileChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    />
                  ) : (
                    <div className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900">
                      {user.email}
                    </div>
                  )}
                </div>

                {/* Account Information */}
                <div className="pt-4 border-t border-gray-200">
                  <h3 className="text-sm font-semibold text-gray-900 mb-3">
                    Account Information
                  </h3>
                  <div className="space-y-1.5 text-sm text-gray-700">
                    <div>
                      <span className="font-medium">User ID:</span> {user.id}
                    </div>
                    <div>
                      <span className="font-medium">Username:</span> {user.username}
                    </div>
                    <div>
                      <span className="font-medium">Role:</span> {user.role}
                    </div>
                    <div>
                      <span className="font-medium">Full Name:</span> {user.name}
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                {isEditing && (
                  <div className="flex gap-3 pt-6">
                    <button
                      onClick={handleSaveProfile}
                      disabled={loading}
                      className="px-6 py-2 bg-orange-500 text-white font-medium rounded-lg hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition"
                    >
                      {loading ? "Saving..." : "Save Changes"}
                    </button>
                    <button
                      onClick={() => {
                        setIsEditing(false);
                        setAvatarPreview(user.avatarUrl || "/urban_planner_icon.png");
                        setAvatarFile(null);
                        setProfileData({
                          firstName: user.firstName || "",
                          lastName: user.lastName || "",
                          email: user.email || "",
                        });
                        setMessage({ type: "", text: "" });
                      }}
                      disabled={loading}
                      className="px-6 py-2 bg-gray-200 text-gray-700 font-medium rounded-lg hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Password Section */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Change Password
            </h2>

            <div className="space-y-4 max-w-md">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Current Password
                </label>
                <input
                  type="password"
                  name="currentPassword"
                  value={passwordData.currentPassword}
                  onChange={handlePasswordChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  placeholder="Enter current password"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  New Password
                </label>
                <input
                  type="password"
                  name="newPassword"
                  value={passwordData.newPassword}
                  onChange={handlePasswordChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  placeholder="Enter new password"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Confirm New Password
                </label>
                <input
                  type="password"
                  name="confirmPassword"
                  value={passwordData.confirmPassword}
                  onChange={handlePasswordChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  placeholder="Confirm new password"
                />
              </div>

              <button
                onClick={handleChangePassword}
                disabled={
                  loading ||
                  !passwordData.currentPassword ||
                  !passwordData.newPassword ||
                  !passwordData.confirmPassword
                }
                className="px-6 py-2 bg-orange-500 text-white font-medium rounded-lg hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                {loading ? "Changing..." : "Change Password"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}