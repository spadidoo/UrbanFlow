"use client";

import PlannerNavbar from "@/components/PlannerNavbar";
import api from "@/services/api";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";

export default function DataPage() {
  const router = useRouter();
  const { user } = useAuth(); 

  const [activeTab, setActiveTab] = useState("disruptions");
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [selectedDisruptions, setSelectedDisruptions] = useState([]);
  const [disruptions, setDisruptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // OTP Modal State
  const [showOTPModal, setShowOTPModal] = useState(false);
  const [otpSimulation, setOTPSimulation] = useState(null);
  const [otpCode, setOTPCode] = useState("");
  const [otpSent, setOTPSent] = useState(false);
  const [otpLoading, setOTPLoading] = useState(false);
  const [otpError, setOTPError] = useState(null);
  const [testOTP, setTestOTP] = useState(""); // For testing only

  // Delete Confirmation Modal
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // datasets
  const [datasets, setDatasets] = useState([]);
  const [selectedDatasets, setSelectedDatasets] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [success, setSuccess] = useState(null);

  const userId = user?.user_id || user?.id;

  // Fetch simulations on mount
  useEffect(() => {
    fetchDisruptions();
  }, []);

  useEffect(() => {
    if (activeTab === "datasets") {
      fetchDatasets();
    }
  }, [activeTab]);

  //fetch datasets from backend
  const fetchDatasets = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("http://localhost:5000/api/files/list");
      const data = await response.json();

      if (data.success) {
        setDatasets(data.files);
      } else {
        setError(data.error || "Failed to load datasets");
      }
    } catch (err) {
      console.error("Failed to fetch datasets:", err);
      setError("Failed to connect to server");
    } finally {
      setLoading(false);
    }
  };

  // ============================================================
  // UPLOAD FILE
  // ============================================================
  const handleUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.name.endsWith(".csv")) {
      setError("Only CSV files are allowed");
      return;
    }

    // Validate file size (16MB max)
    if (file.size > 16 * 1024 * 1024) {
      setError("File size must be less than 16MB");
      return;
    }

    setUploading(true);
    setError(null);
    setSuccess(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("http://localhost:5000/api/files/upload", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (data.success) {
        setSuccess(`✅ "${data.file.name}" uploaded successfully!`);
        fetchDatasets(); // Refresh list

        // Clear success message after 3 seconds
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(data.error || "Upload failed");
      }
    } catch (err) {
      console.error("Upload error:", err);
      setError("Failed to upload file");
    } finally {
      setUploading(false);
      // Reset file input
      event.target.value = "";
    }
  };

  // ============================================================
  // DOWNLOAD SINGLE FILE
  // ============================================================
  const handleDownloadSingle = async (filename) => {
    try {
      const response = await fetch(
        `http://localhost:5000/api/files/download/${filename}`
      );

      if (!response.ok) {
        throw new Error("Download failed");
      }

      // Create blob and download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      setSuccess(`✅ Downloaded "${filename}"`);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error("Download error:", err);
      setError("Failed to download file");
    }
  };

  // ============================================================
  // DOWNLOAD MULTIPLE FILES (ZIP)
  // ============================================================
  const handleDownloadMultiple = async () => {
    if (selectedDatasets.length === 0) {
      setError("Please select files to download");
      return;
    }

    try {
      const response = await fetch(
        "http://localhost:5000/api/files/download-multiple",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            filenames: selectedDatasets,
          }),
        }
      );

      if (!response.ok) {
        throw new Error("Download failed");
      }

      // Create blob and download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `urbanflow_datasets_${Date.now()}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      setSuccess(`✅ Downloaded ${selectedDatasets.length} file(s) as ZIP`);
      setSelectedDatasets([]);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error("Download error:", err);
      setError("Failed to download files");
    }
  };

  // ============================================================
  // DELETE FILES
  // ============================================================
  const handleDelete = async (filenames) => {
    if (
      !confirm(
        `Are you sure you want to delete ${filenames.length} file(s)? This action cannot be undone.`
      )
    ) {
      return;
    }

    try {
      const response = await fetch("http://localhost:5000/api/files/delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          filenames: filenames,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setSuccess(`✅ ${data.message}`);
        setSelectedDatasets([]);
        fetchDatasets(); // Refresh list
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(data.error || "Delete failed");
      }
    } catch (err) {
      console.error("Delete error:", err);
      setError("Failed to delete files");
    }
  };

  // ============================================================
  // DATASET SELECTION
  // ============================================================
  const toggleDatasetSelect = (filename) => {
    setSelectedDatasets((prev) =>
      prev.includes(filename)
        ? prev.filter((f) => f !== filename)
        : [...prev, filename]
    );
  };

  const selectAllDatasets = () => {
    if (selectedDatasets.length === datasets.length) {
      setSelectedDatasets([]);
    } else {
      setSelectedDatasets(datasets.map((d) => d.name));
    }
  };

  const fetchDisruptions = async () => {
    try {
      setLoading(true);
      const response = await api.getMySimulations(userId); // user_id = 2

      if (response.success) {
        setDisruptions(response.simulations);
      }
    } catch (err) {
      console.error("Failed to fetch disruptions:", err);
      setError("Failed to load simulations");
    } finally {
      setLoading(false);
    }
  };

  const toggleSelect = (id) => {
    setSelectedDisruptions((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const selectAll = () => {
    if (selectedDisruptions.length === filteredDisruptions.length) {
      setSelectedDisruptions([]);
    } else {
      setSelectedDisruptions(filteredDisruptions.map((d) => d.simulation_id));
    }
  };

  const filteredDisruptions = disruptions.filter(
    (d) =>
      (filter === "all" ||
        (filter === "published" && d.simulation_status === "published") ||
        (filter === "draft" && d.simulation_status === "completed")) &&
      (d.simulation_name?.toLowerCase().includes(search.toLowerCase()) ||
        d.disruption_location?.toLowerCase().includes(search.toLowerCase()))
  );

  // Handle Edit - Navigate to simulation page with pre-filled data
  const handleEdit = async (simulation) => {
  try {
    // Fetch full simulation details
    const details = await api.getSimulation(simulation.simulation_id);

    if (details) {
      console.log("🔍 API Response:", details); // ADD THIS
      
      // ❌ WRONG: If details has { success: true, simulation: {...} }
      // sessionStorage.setItem("editSimulation", JSON.stringify(details));
      
      // ✅ CORRECT: Extract the simulation object
      const simulationData = details.simulation || details; // ADD THIS
      console.log("💾 Saving to session:", simulationData); // ADD THIS
      
      sessionStorage.setItem("editSimulation", JSON.stringify(simulationData));
      router.push("/simulation");
    }
  } catch (error) {
    console.error("Error loading simulation for edit:", error);
    alert("Failed to load simulation details");
  }
};

  // Handle Publish - Show OTP Modal
  const handlePublishClick = (simulation) => {
    setOTPSimulation(simulation);
    setOTPCode("");
    setOTPSent(false);
    setOTPError(null);
    setTestOTP("");
    setShowOTPModal(true);
  };

  // Send OTP
  const handleSendOTP = async () => {
    try {
      setOTPLoading(true);
      setOTPError(null);

      const response = await api.sendPublishOTP(otpSimulation.simulation_id, userId);

      if (response.success) {
        setOTPSent(true);
        setTestOTP(response.otp_for_testing); // For testing only
        alert(
          `OTP sent to your email!)`
        );
      } else {
        setOTPError(response.error || "Failed to send OTP");
      }
    } catch (error) {
      console.error("Error sending OTP:", error);
      setOTPError("Failed to send OTP. Please try again.");
    } finally {
      setOTPLoading(false);
    }
  };

  // Verify OTP and Publish
  const handleVerifyAndPublish = async () => {
    if (!otpCode || otpCode.length !== 6) {
      setOTPError("Please enter a valid 6-digit OTP");
      return;
    }

    try {
      setOTPLoading(true);
      setOTPError(null);

      const response = await api.verifyPublishOTP(
        otpSimulation.simulation_id,
        otpCode,
        otpSimulation.simulation_name || "Traffic Disruption",
        otpSimulation.description || "View predicted traffic impact",
        userId
      );

      if (response.success) {
        alert(
          `✅ Simulation published successfully!`
        );
        setShowOTPModal(false);
        fetchDisruptions(); // Refresh list
      } else {
        setOTPError(response.error || "Invalid OTP");
      }
    } catch (error) {
      console.error("Error verifying OTP:", error);
      setOTPError("Verification failed. Please check your OTP.");
    } finally {
      setOTPLoading(false);
    }
  };

  // Handle Unpublish
  const handleUnpublish = async (simulation) => {
    if (!confirm("Are you sure you want to unpublish this simulation?")) {
      return;
    }

    try {
      const response = await api.unpublishSimulation(
        simulation.simulation_id,
        userId
      );

      if (response.success) {
        alert("✅ Simulation unpublished successfully!");
        fetchDisruptions();
      } else {
        alert("❌ Failed to unpublish simulation");
      }
    } catch (error) {
      console.error("Error unpublishing:", error);
      alert("❌ Failed to unpublish simulation");
    }
  };

  // Handle Delete
  const handleDeleteClick = () => {
    if (selectedDisruptions.length === 0) {
      alert("Please select simulations to delete");
      return;
    }
    setShowDeleteModal(true);
  };

  const handleConfirmDelete = async () => {
    try {
      const response = await api.deleteSimulationsBatch(selectedDisruptions, userId);

      if (response.success) {
        alert(
          `✅ Successfully deleted ${response.deleted_count} simulation(s)`
        );
        setSelectedDisruptions([]);
        setShowDeleteModal(false);
        fetchDisruptions();
      } else {
        alert("❌ Failed to delete some simulations");
      }
    } catch (error) {
      console.error("Error deleting simulations:", error);
      alert("❌ Failed to delete simulations");
    }
  };

  const getSeverityColor = (severity) => {
    if (!severity) return "bg-gray-100 text-gray-700";

    const level = severity.toLowerCase();
    if (level === "light") return "bg-green-100 text-green-700";
    if (level === "moderate") return "bg-yellow-100 text-yellow-700";
    if (level === "heavy" || level === "severe")
      return "bg-red-100 text-red-700";
    return "bg-gray-100 text-gray-700";
  };

  const getStatusColor = (status) => {
    if (status === "published") return "bg-green-100 text-green-700";
    if (status === "completed") return "bg-yellow-100 text-yellow-700";
    return "bg-gray-100 text-gray-700";
  };

  return (
    <div className="min-h-screen bg-[#F5F6FA] text-gray-800">
      <PlannerNavbar />

      <main className="container mx-auto px-8 py-10">
        <h1 className="text-3xl font-bold text-black-600 mb-8">
          Data Management
        </h1>

        {/* Tabs */}
        <div className="flex gap-4 mb-6">
          {["disruptions", "datasets", "completed"].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-5 py-2 rounded font-semibold transition-all duration-300 ${
                activeTab === tab
                  ? "bg-orange-500 text-white shadow-md scale-105"
                  : "bg-gray-200 text-gray-700 hover:bg-orange-500 hover:text-white hover:scale-105"
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {/* DISRUPTIONS TAB */}
        {activeTab === "disruptions" && (
          <div className="bg-white shadow rounded-lg p-6">
            {/* Controls */}
            <div className="flex justify-between items-center mb-4">
              {/* Filters */}
              <div className="flex gap-2">
                {["all", "published", "draft"].map((f) => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={`px-3 py-1 rounded transition-all duration-300 ${
                      filter === f
                        ? "bg-orange-500 text-white"
                        : "bg-gray-200 text-gray-700 hover:bg-orange-500 hover:text-white"
                    }`}
                  >
                    {f.charAt(0).toUpperCase() + f.slice(1)}
                  </button>
                ))}
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Search..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="border border-gray-300 rounded px-3 py-1 text-sm"
                />
                <button
                  onClick={() => router.push("/simulation")}
                  className="bg-orange-500 text-white px-4 py-1 rounded hover:bg-orange-600 transition"
                >
                  + New
                </button>
                {selectedDisruptions.length > 0 && (
                  <>
                    <button
                      onClick={selectAll}
                      className="bg-blue-500 text-white px-4 py-1 rounded hover:bg-blue-600 transition"
                    >
                      {selectedDisruptions.length === filteredDisruptions.length
                        ? "Deselect All"
                        : "Select All"}
                    </button>
                    <button
                      onClick={handleDeleteClick}
                      className="bg-red-500 text-white px-4 py-1 rounded hover:bg-red-600 transition"
                    >
                      Delete ({selectedDisruptions.length})
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Loading State */}
            {loading && (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
                <p className="text-gray-600">Loading simulations...</p>
              </div>
            )}

            {/* Error State */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                <p className="text-red-700">{error}</p>
              </div>
            )}

            {/* Empty State */}
            {!loading && !error && filteredDisruptions.length === 0 && (
              <div className="text-center py-12">
                <p className="text-gray-500 text-lg mb-4">
                  {search
                    ? "No simulations found matching your search"
                    : "No simulations yet"}
                </p>
                <button
                  onClick={() => router.push("/simulation")}
                  className="bg-orange-500 text-white px-6 py-2 rounded-lg hover:bg-orange-600 transition"
                >
                  Create Your First Simulation
                </button>
              </div>
            )}

            {/* Disruptions Grid */}
            {!loading && !error && filteredDisruptions.length > 0 && (
              <div className="grid md:grid-cols-2 gap-4">
                {filteredDisruptions.map((d) => (
                  <div
                    key={d.simulation_id}
                    className="border rounded-lg p-4 hover:shadow-lg transition transform hover:scale-[1.02] bg-gray-50"
                  >
                    {/* Header with Checkbox */}
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-center gap-2 flex-1">
                        <input
                          type="checkbox"
                          checked={selectedDisruptions.includes(
                            d.simulation_id
                          )}
                          onChange={() => toggleSelect(d.simulation_id)}
                          className="w-4 h-4"
                        />
                        <h3 className="font-bold text-lg text-orange-600 flex-1">
                          {d.simulation_name || "Untitled Simulation"}
                        </h3>
                      </div>
                      <div className="flex gap-2">
                        <span
                          className={`px-2 py-1 text-xs rounded font-semibold ${getStatusColor(
                            d.simulation_status
                          )}`}
                        >
                          {d.simulation_status === "published"
                            ? "Published"
                            : "Draft"}
                        </span>
                        <span
                          className={`px-2 py-1 text-xs rounded font-semibold ${getSeverityColor(
                            d.severity_level
                          )}`}
                        >
                          {d.severity_level || "N/A"}
                        </span>
                      </div>
                    </div>

                    {/* Details */}
                    <div className="text-sm text-gray-600 space-y-1 mb-3">
                      <p>
                        <strong>Type:</strong> {d.disruption_type || "N/A"}
                      </p>
                      <p>
                        <strong>Location:</strong>{" "}
                        {d.disruption_location || "Unknown"}
                      </p>
                      <p>
                        <strong>Last Modified:</strong>{" "}
                        {d.updated_at
                          ? new Date(d.updated_at).toLocaleDateString()
                          : "N/A"}
                      </p>
                      {d.start_time && (
                        <p>
                          <strong>Period:</strong>{" "}
                          {new Date(d.start_time).toLocaleDateString()} -{" "}
                          {new Date(d.end_time).toLocaleDateString()}
                        </p>
                      )}
                      {d.average_delay_ratio != null &&
                        !isNaN(d.average_delay_ratio) && (
                          <p>
                            <strong>Avg Severity:</strong>{" "}
                            {d.average_delay_ratio != null &&
                            !isNaN(d.average_delay_ratio)
                              ? Number(d.average_delay_ratio).toFixed(2)
                              : "N/A"}
                          </p>
                        )}
                    </div>

                    {/* Actions */}
                    <div className="flex justify-end gap-2 mt-3">
                      <button
                        onClick={() => handleEdit(d)}
                        className="px-3 py-1 text-sm border border-orange-500 text-orange-600 rounded hover:bg-orange-500 hover:text-white transition-all duration-300"
                      >
                        Edit
                      </button>
                      {d.simulation_status === "published" ? (
                        <button
                          onClick={() => handleUnpublish(d)}
                          className="px-3 py-1 text-sm border border-gray-500 text-gray-600 rounded hover:bg-gray-500 hover:text-white transition-all duration-300"
                        >
                          Unpublish
                        </button>
                      ) : (
                        <button
                          onClick={() => handlePublishClick(d)}
                          className="px-3 py-1 text-sm border border-green-500 text-green-600 rounded hover:bg-green-500 hover:text-white transition-all duration-300"
                        >
                          Publish
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ============================================================ */}
        {/* DATASETS TAB - UPDATED WITH REAL FUNCTIONALITY */}
        {/* ============================================================ */}
        {activeTab === "datasets" && (
          <div className="bg-white shadow rounded-lg p-6">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h2 className="text-xl font-semibold text-orange-600">
                  Uploaded Datasets
                </h2>
                <p className="text-sm text-gray-600 mt-1">
                  {datasets.length} file{datasets.length !== 1 ? "s" : ""} in
                  data/final folder
                </p>
              </div>

              <div className="flex gap-2">
                {/* Upload Button */}
                <label
                  className={`border border-orange-500 text-orange-600 px-4 py-1 rounded transition-all duration-300 cursor-pointer flex items-center gap-2 ${
                    uploading
                      ? "opacity-50 cursor-not-allowed"
                      : "hover:bg-orange-500 hover:text-white"
                  }`}
                >
                  {uploading ? (
                    <>
                      <div className="animate-spin h-4 w-4 border-2 border-orange-600 border-t-transparent rounded-full"></div>
                      Uploading...
                    </>
                  ) : (
                    <>
                      ⬆ Upload
                      <input
                        type="file"
                        accept=".csv"
                        onChange={handleUpload}
                        disabled={uploading}
                        className="hidden"
                      />
                    </>
                  )}
                </label>

                {/* Download Selected Button */}
                <button
                  onClick={handleDownloadMultiple}
                  disabled={selectedDatasets.length === 0}
                  className={`border px-4 py-1 rounded transition-all duration-300 flex items-center gap-2 ${
                    selectedDatasets.length === 0
                      ? "border-gray-300 text-gray-400 cursor-not-allowed"
                      : "border-blue-500 text-blue-600 hover:bg-blue-500 hover:text-white"
                  }`}
                >
                  ⬇ Download{" "}
                  {selectedDatasets.length > 0 &&
                    `(${selectedDatasets.length})`}
                </button>

                {/* Delete Selected Button */}
                {selectedDatasets.length > 0 && (
                  <button
                    onClick={() => handleDelete(selectedDatasets)}
                    className="border border-red-500 text-red-600 px-4 py-1 rounded hover:bg-red-500 hover:text-white transition-all duration-300"
                  >
                    🗑️ Delete ({selectedDatasets.length})
                  </button>
                )}

                {/* Select All Toggle */}
                {datasets.length > 0 && (
                  <button
                    onClick={selectAllDatasets}
                    className="text-sm text-gray-600 hover:text-orange-600 underline"
                  >
                    {selectedDatasets.length === datasets.length
                      ? "Deselect All"
                      : "Select All"}
                  </button>
                )}

                {/* Refresh Button */}
                <button
                  onClick={fetchDatasets}
                  disabled={loading}
                  className="text-gray-600 hover:text-orange-600 transition"
                  title="Refresh list"
                >
                  {loading ? (
                    <div className="animate-spin h-5 w-5 border-2 border-gray-600 border-t-transparent rounded-full"></div>
                  ) : (
                    <span className="text-xl">↻</span>
                  )}
                </button>
              </div>
            </div>

            {/* Loading State */}
            {loading && (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
                <p className="text-gray-600">Loading datasets...</p>
              </div>
            )}

            {/* Empty State */}
            {!loading && datasets.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                <div className="text-6xl mb-4">📂</div>
                <p className="text-lg font-semibold">No datasets found</p>
                <p className="text-sm mt-2">Upload a CSV file to get started</p>
              </div>
            )}

            {/* Datasets List */}
            {!loading && datasets.length > 0 && (
              <div className="space-y-3">
                {datasets.map((dataset) => (
                  <div
                    key={dataset.id}
                    className={`border rounded-lg p-4 flex justify-between items-center transition transform hover:scale-[1.01] ${
                      selectedDatasets.includes(dataset.name)
                        ? "bg-orange-50 border-orange-300"
                        : "hover:shadow-md"
                    }`}
                  >
                    <div className="flex items-start gap-3 flex-1">
                      {/* Checkbox */}
                      <input
                        type="checkbox"
                        checked={selectedDatasets.includes(dataset.name)}
                        onChange={() => toggleDatasetSelect(dataset.name)}
                        className="mt-1"
                      />

                      {/* File Info */}
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                          {dataset.name}
                          {dataset.size_mb > 5 && (
                            <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded">
                              Large file
                            </span>
                          )}
                        </h3>
                        <div className="flex gap-4 text-sm text-gray-600 mt-1">
                          <span>
                            Rows:{" "}
                            <strong>{dataset.rows.toLocaleString()}</strong>
                          </span>
                          <span>
                            Columns: <strong>{dataset.cols}</strong>
                          </span>
                          <span>
                            Size: <strong>{dataset.size_mb} MB</strong>
                          </span>
                          <span>
                            Last Modified: <strong>{dataset.updated}</strong>
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleDownloadSingle(dataset.name)}
                        className="border border-green-500 text-green-600 px-3 py-1 text-sm rounded hover:bg-green-500 hover:text-white transition-all duration-300"
                      >
                        ⬇ Download
                      </button>
                      <button
                        onClick={() => handleDelete([dataset.name])}
                        className="border border-red-500 text-red-600 px-3 py-1 text-sm rounded hover:bg-red-500 hover:text-white transition-all duration-300"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Info Footer */}
            <div className="mt-6 bg-blue-50 border-l-4 border-blue-500 p-4 rounded">
              <p className="text-sm text-blue-800">
                <strong>ℹ️ Tips:</strong>
              </p>
              <ul className="text-sm text-blue-700 mt-2 space-y-1 ml-4">
                <li>• Only CSV files are allowed (max 16MB)</li>
                <li>
                  • Files are stored in{" "}
                  <code className="bg-blue-100 px-1 rounded">data/final</code>{" "}
                  folder
                </li>
                <li>• Select multiple files to download as ZIP</li>
                <li>• Deleted files cannot be recovered</li>
              </ul>
            </div>
          </div>
        )}

        {/* COMPLETED TAB (Keep existing code) */}
        {activeTab === "completed" && (
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-xl font-semibold text-orange-600 mb-4">
              Completed Projects
            </h2>
            {completedProjects.length === 0 ? (
              <p className="text-gray-500">No completed projects yet.</p>
            ) : (
              <div className="grid md:grid-cols-2 gap-4">
                {completedProjects.map((d) => (
                  <div
                    key={d.id}
                    className="border rounded-lg p-4 bg-green-50 hover:shadow-lg transition transform hover:scale-[1.02]"
                  >
                    <h3 className="font-bold text-lg text-green-700">
                      {d.title}
                    </h3>
                    <p className="text-sm text-gray-600 mt-1">
                      Type: {d.type} | Date Completed: {d.date}
                    </p>
                    <p className="text-sm text-gray-600 mt-1">
                      Congestion Level: {d.congestion}
                    </p>
                    <div className="flex justify-end mt-3">
                      <button className="border border-blue-500 text-blue-600 px-3 py-1 text-sm rounded hover:bg-blue-500 hover:text-white transition-all duration-300">
                        View Details
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* OTP MODAL */}
      {showOTPModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-8 max-w-md w-full">
            <h2 className="text-2xl font-bold mb-4">Verify & Publish</h2>

            {!otpSent ? (
              <>
                <p className="text-gray-600 mb-6">
                  To publish "{otpSimulation?.simulation_name}", we'll send a
                  verification code to your email.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowOTPModal(false)}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSendOTP}
                    disabled={otpLoading}
                    className="flex-1 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:bg-gray-300"
                  >
                    {otpLoading ? "Sending..." : "Send OTP"}
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="text-gray-600 mb-4">
                  Enter the 6-digit code sent to your email:
                </p>

                {testOTP && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded p-3 mb-4">
                    <p className="text-xs text-yellow-800">
                    </p>
                  </div>
                )}

                <input
                  type="text"
                  maxLength={6}
                  value={otpCode}
                  onChange={(e) =>
                    setOTPCode(e.target.value.replace(/\D/g, ""))
                  }
                  placeholder="000000"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg text-center text-2xl tracking-widest mb-4"
                />

                {otpError && (
                  <p className="text-red-600 text-sm mb-4">{otpError}</p>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={() => setShowOTPModal(false)}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleVerifyAndPublish}
                    disabled={otpLoading || otpCode.length !== 6}
                    className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300"
                  >
                    {otpLoading ? "Verifying..." : "Verify & Publish"}
                  </button>
                </div>

                <button
                  onClick={handleSendOTP}
                  disabled={otpLoading}
                  className="w-full mt-3 text-sm text-orange-600 hover:underline"
                >
                  Resend OTP
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-8 max-w-md w-full">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg
                  className="w-8 h-8 text-red-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-800 mb-2">
                Delete Simulations?
              </h2>
              <p className="text-gray-600">
                Are you sure you want to delete{" "}
                <strong>{selectedDisruptions.length}</strong> simulation
                {selectedDisruptions.length > 1 ? "s" : ""}?
              </p>
              <p className="text-sm text-red-600 mt-2">
                This action cannot be undone.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Delete {selectedDisruptions.length} File
                {selectedDisruptions.length > 1 ? "s" : ""}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}