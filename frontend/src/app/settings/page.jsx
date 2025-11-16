"use client";

import PlannerNavbar from "@/components/PlannerNavbar";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function AccountPage() {
  const { user, loading: authLoading, isAuthenticated, updateProfile, changePassword } = useAuth();
  const router = useRouter();

  const [editMode, setEditMode] = useState(false);
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
  });

  const [passwords, setPasswords] = useState({
    current: "",
    newPass: "",
    confirm: "",
  });

  const [preview, setPreview] = useState("");
  const [avatarFile, setAvatarFile] = useState(null);
  const [errors, setErrors] = useState({});
  const [successMessage, setSuccessMessage] = useState("");
  const [loading, setLoading] = useState(false);

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [authLoading, isAuthenticated, router]);

  // Populate form when user data loads
  useEffect(() => {
    if (user) {
      setFormData({
        firstName: user.firstName || "",
        lastName: user.lastName || "",
        email: user.email || "",
      });
      setPreview(user.avatarUrl || "/urban_planner_icon.png");
    }
  }, [user]);

  function handleImageChange(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    setAvatarFile(f);
    const reader = new FileReader();
    reader.onload = () => setPreview(reader.result);
    reader.readAsDataURL(f);
  }

  function handleInputChange(e) {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: "" }));
  }

  function handlePasswordChange(e) {
    const { name, value } = e.target;
    setPasswords((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, passwords: "" }));
  }

  function validate() {
    const nextErrors = {};
    
    if (!formData.firstName || formData.firstName.trim().length < 2) {
      nextErrors.firstName = "First name must be at least 2 characters.";
    }
    
    if (!formData.lastName || formData.lastName.trim().length < 2) {
      nextErrors.lastName = "Last name must be at least 2 characters.";
    }
    
    if (!formData.email || !formData.email.includes("@")) {
      nextErrors.email = "Please enter a valid email.";
    }

    // Validate password fields if any are filled
    if (passwords.current || passwords.newPass || passwords.confirm) {
      if (!passwords.current) {
        nextErrors.passwords = "Enter current password to change password.";
      }
      if (!passwords.newPass || passwords.newPass.length < 6) {
        nextErrors.passwords = "New password must be at least 6 characters.";
      }
      if (passwords.newPass !== passwords.confirm) {
        nextErrors.passwords = "New password and confirmation do not match.";
      }
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function handleSave() {
    if (!validate()) return;

    setLoading(true);
    setSuccessMessage("");
    setErrors({});

    try {
      // Update profile
      const profileResult = await updateProfile({
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
      });

      if (!profileResult.success) {
        throw new Error(profileResult.error);
      }

      // Change password if provided
      if (passwords.current && passwords.newPass) {
        const passwordResult = await changePassword(
          passwords.current,
          passwords.newPass
        );

        if (!passwordResult.success) {
          throw new Error(passwordResult.error);
        }
      }

      // TODO: Upload avatar file if changed
      // if (avatarFile) {
      //   await uploadAvatar(avatarFile);
      // }

      setSuccessMessage("Account settings saved successfully!");
      setPasswords({ current: "", newPass: "", confirm: "" });
      setAvatarFile(null);
      setEditMode(false);

      // Auto-hide success message after 3 seconds
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (err) {
      console.error("Save error:", err);
      setErrors({ general: err.message || "Failed to save changes. Please try again." });
    } finally {
      setLoading(false);
    }
  }

  function handleCancel() {
    // Revert to original user data
    if (user) {
      setFormData({
        firstName: user.firstName || "",
        lastName: user.lastName || "",
        email: user.email || "",
      });
      setPreview(user.avatarUrl || "/urban_planner_icon.png");
    }
    setAvatarFile(null);
    setPasswords({ current: "", newPass: "", confirm: "" });
    setErrors({});
    setSuccessMessage("");
    setEditMode(false);
  }

  // Show loading state
  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#F5F6FA] flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-orange-500 border-r-transparent"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-[#F5F6FA] text-gray-800">
      <PlannerNavbar />

      <main className="container mx-auto px-6 py-10">
        <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-lg overflow-hidden">
          <div className="p-6 border-b">
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-bold text-gray-800">Account Settings</h1>

              <div>
                {!editMode ? (
                  <button
                    onClick={() => setEditMode(true)}
                    className="px-4 py-2 bg-orange-500 text-white rounded hover:bg-orange-600 transition"
                  >
                    Edit Profile
                  </button>
                ) : (
                  <div className="flex gap-2">
                    <button
                      onClick={handleSave}
                      disabled={loading}
                      className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition disabled:bg-gray-400"
                    >
                      {loading ? "Saving..." : "Save"}
                    </button>
                    <button
                      onClick={handleCancel}
                      disabled={loading}
                      className="px-4 py-2 border border-gray-300 text-gray-700 rounded hover:bg-gray-100 transition disabled:bg-gray-100"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            </div>
            <p className="text-sm text-gray-500 mt-1">
              Change your profile information and password.
            </p>
          </div>

          {/* Success Message */}
          {successMessage && (
            <div className="mx-6 mt-6 p-4 bg-green-50 border border-green-200 rounded text-green-700">
              ✅ {successMessage}
            </div>
          )}

          {/* Error Message */}
          {errors.general && (
            <div className="mx-6 mt-6 p-4 bg-red-50 border border-red-200 rounded text-red-700">
              ❌ {errors.general}
            </div>
          )}

          <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Left: Avatar */}
            <div className="flex flex-col items-center md:items-start">
              <div className="w-36 h-36 rounded-full overflow-hidden border border-gray-200 shadow-sm">
                {preview && (
                  <img
                    src={preview}
                    alt="avatar"
                    className="w-full h-full object-cover"
                  />
)}
              </div>

              {editMode && (
                <>
                  <label className="mt-4 inline-flex items-center cursor-pointer">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageChange}
                      className="hidden"
                    />
                    <span className="px-3 py-2 bg-gray-100 border rounded text-sm text-gray-700 hover:bg-gray-200">
                      Change Photo
                    </span>
                  </label>
                  <p className="text-xs text-gray-500 mt-2">
                    PNG/JPG, less than 2MB recommended
                  </p>
                </>
              )}
            </div>

            {/* Right: form */}
            <div className="md:col-span-2">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* First Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    First Name
                  </label>
                  <input
                    name="firstName"
                    value={formData.firstName}
                    onChange={handleInputChange}
                    disabled={!editMode}
                    className={`mt-1 block w-full rounded border px-3 py-2 ${
                      !editMode ? "bg-gray-100 cursor-not-allowed" : ""
                    }`}
                  />
                  {errors.firstName && (
                    <p className="text-xs text-red-600 mt-1">{errors.firstName}</p>
                  )}
                </div>

                {/* Last Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Last Name
                  </label>
                  <input
                    name="lastName"
                    value={formData.lastName}
                    onChange={handleInputChange}
                    disabled={!editMode}
                    className={`mt-1 block w-full rounded border px-3 py-2 ${
                      !editMode ? "bg-gray-100 cursor-not-allowed" : ""
                    }`}
                  />
                  {errors.lastName && (
                    <p className="text-xs text-red-600 mt-1">{errors.lastName}</p>
                  )}
                </div>

                {/* Email */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Email
                  </label>
                  <input
                    name="email"
                    type="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    disabled={!editMode}
                    className={`mt-1 block w-full rounded border px-3 py-2 ${
                      !editMode ? "bg-gray-100 cursor-not-allowed" : ""
                    }`}
                  />
                  {errors.email && (
                    <p className="text-xs text-red-600 mt-1">{errors.email}</p>
                  )}
                </div>
              </div>

              {/* Change password section */}
              {editMode && (
                <div className="mt-6">
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">
                    Change password
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <input
                      name="current"
                      type="password"
                      placeholder="Current password"
                      value={passwords.current}
                      onChange={handlePasswordChange}
                      className="mt-1 block w-full rounded border px-3 py-2"
                    />
                    <input
                      name="newPass"
                      type="password"
                      placeholder="New password"
                      value={passwords.newPass}
                      onChange={handlePasswordChange}
                      className="mt-1 block w-full rounded border px-3 py-2"
                    />
                    <input
                      name="confirm"
                      type="password"
                      placeholder="Confirm new password"
                      value={passwords.confirm}
                      onChange={handlePasswordChange}
                      className="mt-1 block w-full rounded border px-3 py-2"
                    />
                  </div>
                  {errors.passwords && (
                    <p className="text-xs text-red-600 mt-2">{errors.passwords}</p>
                  )}
                  <p className="text-xs text-gray-500 mt-2">
                    Leave password fields empty if you do not want to change password.
                  </p>
                </div>
              )}

              {/* User Info Display */}
              <div className="mt-6 p-4 bg-gray-50 rounded">
                <h3 className="text-sm font-semibold text-gray-700 mb-2">
                  Account Information
                </h3>
                <div className="text-sm text-gray-600 space-y-1">
                  <p>
                    <span className="font-medium">User ID:</span> {user.id}
                  </p>
                  <p>
                    <span className="font-medium">Username:</span> {user.username}
                  </p>
                  <p>
                    <span className="font-medium">Role:</span> {user.role}
                  </p>
                  <p>
                    <span className="font-medium">Full Name:</span> {user.name}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}