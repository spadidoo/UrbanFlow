"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function AccountPage() {
  const router = useRouter();

  const [user, setUser] = useState({
    name: "Planner Calamba",
    email: "planner_calamba@example.gov",
    position: "Urban Planner",
  });

  const [editMode, setEditMode] = useState(false);

  const handleSave = () => {
    setEditMode(false);
    alert("Account details saved successfully (frontend only)");
  };

  return (
    <div className="p-8 bg-[#F5F6FA] min-h-screen text-gray-800">
      {/* Back Button */}
      <button
        onClick={() => router.push("/planner")}
        className="mb-6 px-4 py-2 bg-orange-500 text-white rounded hover:bg-orange-600"
      >
        ← Back to Dashboard
      </button>

      <h1 className="text-3xl font-bold text-orange-600 mb-6">
        Account Settings
      </h1>

      <div className="bg-white shadow-lg rounded-lg p-6 max-w-2xl">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Full Name
            </label>
            <input
              type="text"
              value={user.name}
              disabled={!editMode}
              onChange={(e) => setUser({ ...user, name: e.target.value })}
              className={`w-full border border-gray-300 rounded p-2 ${
                !editMode ? "bg-gray-100 cursor-not-allowed" : ""
              }`}
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Email Address
            </label>
            <input
              type="email"
              value={user.email}
              disabled={!editMode}
              onChange={(e) => setUser({ ...user, email: e.target.value })}
              className={`w-full border border-gray-300 rounded p-2 ${
                !editMode ? "bg-gray-100 cursor-not-allowed" : ""
              }`}
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Position
            </label>
            <input
              type="text"
              value={user.position}
              disabled={!editMode}
              onChange={(e) => setUser({ ...user, position: e.target.value })}
              className={`w-full border border-gray-300 rounded p-2 ${
                !editMode ? "bg-gray-100 cursor-not-allowed" : ""
              }`}
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          {editMode ? (
            <>
              <button
                onClick={handleSave}
                className="px-4 py-2 bg-orange-500 text-white rounded hover:bg-orange-600"
              >
                Save
              </button>
              <button
                onClick={() => setEditMode(false)}
                className="px-4 py-2 border border-gray-400 text-gray-600 rounded hover:bg-gray-100"
              >
                Cancel
              </button>
            </>
          ) : (
            <button
              onClick={() => setEditMode(true)}
              className="px-4 py-2 border border-orange-500 text-orange-600 rounded hover:bg-orange-50"
            >
              Edit Profile
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
