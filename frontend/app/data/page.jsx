"use client";

import PlannerNavbar from "@/components/PlannerNavBar";
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
  const [testOTP, setTestOTP] = useState("");

  // Delete Confirmation Modal
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // datasets
  const [datasets, setDatasets] = useState([]);
  const [selectedDatasets, setSelectedDatasets] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [success, setSuccess] = useState(null);
  const [sortBy, setSortBy] = useState("recent"); // 'recent', 'oldest', 'location', 'type'
  const [showSortDropdown, setShowSortDropdown] = useState(false);

  const userId = user?.user_id || user?.id;

  // ============================================================
  // 🔍 DEBUG: Log user info on mount
  // ============================================================
  useEffect(() => {
    console.log("📊 DataPage mounted");
    console.log("👤 Current user:", user);
    console.log("🆔 User ID:", userId);
  }, [user, userId]);

  // ============================================================
  // Fetch simulations on mount
  // ============================================================
  useEffect(() => {
    if (userId) {
      console.log("🔄 useEffect triggered - fetching disruptions");
      fetchDisruptions();
    } else {
      console.warn("⚠️ No userId available, skipping fetch");
      setLoading(false);
    }
  }, [userId]); // ✅ FIXED: Added userId as dependency

  // ============================================================
  // Fetch datasets when switching to datasets tab
  // ============================================================
  useEffect(() => {
    if (activeTab === "datasets") {
      console.log("📂 Switching to datasets tab");
      fetchDatasets();
    }
  }, [activeTab]);

  // ✅ ADD THIS NEW EFFECT - Check for published updates
  useEffect(() => {
    // Listen for publish events from other tabs
    const handleStorageChange = (e) => {
      if (e.key === 'simulationPublished') {
        console.log("🔄 Detected publish event, refreshing...");
        fetchDisruptions();
        localStorage.removeItem('simulationPublished');
      }
    };

    window.addEventListener('storage', handleStorageChange);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [userId]);

  // ============================================================
  // Clean up stale publish payloads
  // ============================================================
  useEffect(() => {
    const storedPayload = sessionStorage.getItem('publishPayload');
    if (storedPayload) {
      try {
        const { originPage } = JSON.parse(storedPayload);
        const currentPage = window.location.pathname.includes('simulation') 
          ? 'simulation' 
          : 'data';
        if (originPage !== currentPage) {
          sessionStorage.removeItem('publishPayload');
        }
      } catch (e) {
        sessionStorage.removeItem('publishPayload');
      }
    }
  }, []);

  // ============================================================
  // FETCH DATASETS
  // ============================================================
  const fetchDatasets = async () => {
    setLoading(true);
    setError(null);

    console.log("📂 Fetching datasets...");

    try {
      const response = await fetch("https://backend.urbanflowph.com/api/files/list");
      const data = await response.json();

      console.log("✅ Datasets API response:", data);

      if (data.success) {
        console.log(`📊 Found ${data.files.length} datasets`);
        setDatasets(data.files);
      } else {
        console.error("❌ Datasets API error:", data.error);
        setError(data.error || "Failed to load datasets");
      }
    } catch (err) {
      console.error("❌ Failed to fetch datasets:", err);
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

    if (!file.name.endsWith(".csv")) {
      setError("Only CSV files are allowed");
      return;
    }

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
      const response = await fetch("https://backend.urbanflowph.com/api/files/upload", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (data.success) {
        setSuccess(`✅ "${data.file.name}" uploaded successfully!`);
        fetchDatasets();
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(data.error || "Upload failed");
      }
    } catch (err) {
      console.error("Upload error:", err);
      setError("Failed to upload file");
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  };

  // ============================================================
  // DOWNLOAD SINGLE FILE
  // ============================================================
  const handleDownloadSingle = async (filename) => {
    try {
      const response = await fetch(
        `https://backend.urbanflowph.com/api/files/download/${filename}`
      );

      if (!response.ok) {
        throw new Error("Download failed");
      }

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
        "https://backend.urbanflowph.com/api/files/download-multiple",
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
      const response = await fetch("https://backend.urbanflowph.com/api/files/delete", {
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
        fetchDatasets();
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

  // ============================================================
  // 🔍 FIXED: Fetch Disruptions with Detailed Logging
  // ============================================================
  const fetchDisruptions = async () => {
    if (!userId) {
      console.log("⚠️ No userId found, skipping fetch");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      console.log("🔄 Fetching simulations for user:", userId);
      console.log("📡 Calling API:", `https://backend.urbanflowph.com/api/my-simulations?user_id=${userId}`);
      
      const response = await api.getMySimulations(userId);
      
      console.log("✅ Raw API Response:", response);
      console.log("📊 Response type:", typeof response);
      console.log("📦 Response keys:", Object.keys(response || {}));

      if (response && response.success) {
        // ✅ FIXED: Backend returns 'simulations', not 'disruptions'
        const simulationsData = response.simulations || [];
        console.log(`✅ Found ${simulationsData.length} simulations`);
        console.log("📋 First simulation:", simulationsData[0]);
        // ✅ ADD THIS DEBUG
        console.log("🔍 Edit data check:");
        simulationsData.forEach(sim => {
          if (sim.is_edited) {
            console.log(`   Simulation ${sim.simulation_id}:`, {
              is_edited: sim.is_edited,
              last_edited_at: sim.last_edited_at
            });
          }
        });


        setDisruptions(simulationsData);

        // ✅ DEBUG - Check if edited data exists
        console.log("🔍 Checking for edited simulations:");
        simulationsData.forEach(sim => {
          console.log(`Sim ${sim.simulation_id}:`, {
            is_edited: sim.is_edited,
            last_edited_at: sim.last_edited_at
          });
        });
        
        if (simulationsData.length === 0) {
          console.log("ℹ️ No simulations found for this user");
        }
      } else {
        console.error("❌ API returned success=false:", response);
        setError(response?.error || "Failed to load simulations");
      }
    } catch (err) {
      console.error("❌ Failed to fetch disruptions:", err);
      console.error("Error details:", {
        message: err.message,
        stack: err.stack
      });
      setError("Failed to load simulations");
    } finally {
      setLoading(false);
      console.log("✅ Fetch completed");
    }
  };

  // ============================================================
  // DISRUPTION SELECTION
  // ============================================================
  const toggleSelect = (id) => {
    setSelectedDisruptions((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const selectAll = () => {
    if (selectedDisruptions.length === sortedDisruptions.length) {
      setSelectedDisruptions([]);
    } else {
      setSelectedDisruptions(sortedDisruptions.map((d) => d.simulation_id));
    }
  };

  // ============================================================
  // 🔍 FIXED: Filter Disruptions with Null Checks
  // ============================================================
  const filteredDisruptions = disruptions.filter((d) => {
    // ✅ FIXED: Add null checks for all fields
    const matchesFilter = 
      filter === "all" ||
      (filter === "published" && d.simulation_status === "published") ||
      (filter === "draft" && d.simulation_status === "completed");
    
    const matchesSearch = 
      (d.simulation_name || "").toLowerCase().includes(search.toLowerCase()) ||
      (d.disruption_location || "").toLowerCase().includes(search.toLowerCase());
    
    return matchesFilter && matchesSearch;
  });

  const sortedDisruptions = [...filteredDisruptions].sort((a, b) => {
  switch (sortBy) {
    case 'recent':
      // Most recent first (by created_at or start_time)
      return new Date(b.created_at || b.start_time) - new Date(a.created_at || a.start_time);
    
    case 'oldest':
      // Oldest first
      return new Date(a.created_at || a.start_time) - new Date(b.created_at || b.start_time);
    
    case 'type':
      // Alphabetical by disruption type
      const typeA = (a.disruption_type || '').toLowerCase();
      const typeB = (b.disruption_type || '').toLowerCase();
      return typeA.localeCompare(typeB);
    
    default:
      return 0;
  }
});

  console.log("🔍 Filter applied:", {
    total: disruptions.length,
    filtered: filteredDisruptions.length,
    filter,
    search
  });

  // ============================================================
  // HANDLE EDIT
  // ============================================================
  const handleEdit = async (simulation) => {
    try {
      console.log(" Editing simulation:", simulation.simulation_id);
      
      const details = await api.getSimulation(simulation.simulation_id);
      console.log(" API Response:", details);
      
      if (details) {
        const simulationData = details.simulation || details;
        console.log("💾 Saving to session:", simulationData);
        
        // Mark as edit mode - Remove the old is_edited fields first
        const { is_edited, last_edited_at, ...cleanData } = simulationData;
        
        const editData = {
          ...cleanData,
          _isEditMode: true,
          _originalId: simulation.simulation_id
        };
        
        console.log("✏️ Edit mode data:", editData);
        sessionStorage.setItem("editSimulation", JSON.stringify(editData));

        // ✅ ADD THIS DEBUG
        console.log("✅ Stored in sessionStorage:", sessionStorage.getItem("editSimulation"));
        console.log("✅ Can read back?", JSON.parse(sessionStorage.getItem("editSimulation"))._isEditMode);


        router.push("/simulation");
      }
    } catch (error) {
      console.error("Error loading simulation for edit:", error);
      alert("Failed to load simulation details");
    }
  };

  // ============================================================
  // HANDLE PUBLISH CLICK
  // ============================================================
  const handlePublishClick = (simulation) => {
    const publishPayload = {
      simulation_id: simulation.simulation_id,
      user_id: userId,
      title: simulation.simulation_name || "Traffic Disruption",
      public_description: simulation.description || "View predicted traffic impact",
    };

    sessionStorage.setItem('publishPayload', JSON.stringify({
      payload: publishPayload,
      originPage: 'data',
      type: 'simulation'
    }));

    setOTPSimulation(simulation);
    setOTPCode("");
    setOTPSent(false);
    setOTPError(null);
    setTestOTP("");
    setShowOTPModal(true);
  };

  // ============================================================
  // SEND OTP
  // ============================================================
  const handleSendOTP = async () => {
    try {
      setOTPLoading(true);
      setOTPError(null);

      const response = await api.sendPublishOTP(otpSimulation.simulation_id, userId);

      if (response.success) {
        setOTPSent(true);
        setTestOTP(response.otp_for_testing);
        alert(`OTP sent to your email!`);
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

  // ============================================================
  // VERIFY OTP AND PUBLISH
  // ============================================================
  const handleVerifyAndPublish = async () => {
    if (!otpCode || otpCode.length !== 6) {
      setOTPError("Please enter a valid 6-digit OTP");
      return;
    }

    try {
      setOTPLoading(true);
      setOTPError(null);

      // Get stored publish payload
      const storedData = sessionStorage.getItem("publishPayload");
      if (!storedData) {
        throw new Error("Publish data not found. Please try again.");
      }

      const { payload } = JSON.parse(storedData);

      console.log("📤 Sending to verify:", {
        simulation_id: payload.simulation_id,
        otp_code: otpCode,
        user_id: payload.user_id,
      });

      // ✅ FIXED: Call the VERIFY endpoint, not send-publish-otp
      const response = await fetch(
        "https://backend.urbanflowph.com/api/verify-publish-otp",  // ← Changed this line
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            simulation_id: payload.simulation_id,
            otp_code: otpCode,
            title: payload.title,
            public_description: payload.public_description,
            user_id: payload.user_id,
          }),
        }
      );

      const data = await response.json();

      if (data.success) {
        // Clear stored payload
        sessionStorage.removeItem("publishPayload");

        // Close modal
        setShowOTPModal(false);
        setOTPCode("");
        setOTPSent(false);

        // Update publish success state
        setSuccess(true);

        // ✅ ADD THIS - Notify other tabs
        localStorage.setItem('simulationPublished', Date.now().toString());

        // ✅ ADD THIS LINE - Refresh the disruptions list
        fetchDisruptions();

        // Show success message
        alert(
          `✅ Simulation published successfully!\n\n` +
            `Public URL: ${
              data.public_url || window.location.origin + "/map"
            }\n` +
            `This simulation is now visible on the public map.`
        );
      } else {
        setOTPError(data.error || "Invalid OTP");
      }
    } catch (error) {
      console.error("Error verifying OTP:", error);
      setOTPError(
        error.message || "Verification failed. Please check your OTP."
      );
    } finally {
      setOTPLoading(false);
    }
  };

  // ============================================================
  // HANDLE UNPUBLISH
  // ============================================================
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

  // ============================================================
  // HANDLE DELETE CLICK
  // ============================================================
  const handleDeleteClick = () => {
    if (selectedDisruptions.length === 0) {
      alert("Please select simulations to delete");
      return;
    }
    setShowDeleteModal(true);
  };

  // ============================================================
  // HANDLE GENERATE REPORT
  // ============================================================
  const handleGenerateReport = async (simulation) => {
    try {
      console.log("📊 Generating report for simulation:", simulation.simulation_id);
      
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'https://backend.urbanflowph.com'}/api/reports/generate`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            simulation_id: simulation.simulation_id,
            user_id: userId,
          }),
        }
      );

      const data = await response.json();

      if (data.success) {
        // Show success message
        alert(
          `✅ Report generated successfully!\n\n` +
          `You will be redirected to the Reports page to view it.`
        );
        
        // Redirect to reports page
        router.push('/reports');
      } else {
        alert(`❌ Failed to generate report: ${data.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error("Error generating report:", error);
      alert("❌ Failed to generate report. Please try again.");
    }
  };


  // ============================================================
  // CONFIRM DELETE
  // ============================================================
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

  // ============================================================
  // UTILITY FUNCTIONS
  // ============================================================
  const getSeverityColor = (severity) => {
    if (!severity) return "bg-gray-100 text-gray-700";

    const level = severity.toLowerCase();
    if (level === "light") return "bg-green-100 text-green-700";
    if (level === "moderate") return "bg-yellow-100 text-yellow-700";
    if (level === "heavy" || level === "severe") return "bg-red-100 text-red-700";
    return "bg-gray-100 text-gray-700";
  };

  const getStatusColor = (status) => {
    if (status === "published") return "bg-green-100 text-green-700";
    if (status === "completed") return "bg-yellow-100 text-yellow-700";
    return "bg-gray-100 text-gray-700";
  };

  // ============================================================
  // RENDER
  // ============================================================
  return (
    <div className="min-h-screen bg-[#F5F6FA] text-gray-800">
      <PlannerNavbar />

      <main className="container mx-auto px-8 py-10">
        <h1 className="text-3xl font-bold text-black-600 mb-8">
          Data Management
        </h1>

        {/* Success/Error Messages */}
        {success && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
            <p className="text-green-700">{success}</p>
          </div>
        )}
        
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
            <p className="text-red-700">{error}</p>
            <button 
              onClick={() => setError(null)} 
              className="text-sm underline mt-2"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-4 mb-6">
          {["disruptions", "datasets"].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-5 py-2 rounded font-semibold transition-all duration-300 ${
                activeTab === tab
                  ? "bg-orange-400 text-white shadow-md scale-105"
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
              <div className="flex gap-2">
                {["all", "published", "draft"].map((f) => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={`px-3 py-1 rounded transition-all duration-300 ${
                      filter === f
                        ? "bg-orange-400 text-white"
                        : "bg-gray-200 text-gray-700 hover:bg-orange-500 hover:text-white"
                    }`}
                  >
                    {f.charAt(0).toUpperCase() + f.slice(1)}
                  </button>
                ))}
              </div>

              <div className="flex gap-2 items-center">
                {/* Sort Dropdown */}
                <div className="relative">
                  <button
                    onClick={() => setShowSortDropdown(!showSortDropdown)}
                    className="flex items-center gap-2 border border-gray-300 rounded px-3 py-1 text-sm bg-white hover:bg-gray-50 transition"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={1.5}
                      stroke="currentColor"
                      className="w-4 h-4"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M3 7.5L7.5 3m0 0L12 7.5M7.5 3v13.5m13.5 0L16.5 21m0 0L12 16.5m4.5 4.5V7.5"
                      />
                    </svg>
                    Sort: {sortBy === "recent" ? "Most Recent" : sortBy === "oldest" ? "Oldest" : "Disruption Type"}
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={1.5}
                      stroke="currentColor"
                      className={`w-4 h-4 transition-transform ${showSortDropdown ? "rotate-180" : ""}`}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                    </svg>
                  </button>

                  {showSortDropdown && (
                    <>
                      {/* Backdrop to close dropdown */}
                      <div
                        className="fixed inset-0 z-10"
                        onClick={() => setShowSortDropdown(false)}
                      />
                      
                      {/* Dropdown Menu */}
                      <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-20">
                          {[
                            { value: "recent", label: "Most Recent"},
                            { value: "oldest", label: "From Oldest"},
                            { value: "type", label: "Disruption Type"},
                          ].map((option) => (
                            <button
                              key={option.value}
                              onClick={() => {
                                setSortBy(option.value);
                                setShowSortDropdown(false);
                              }}
                              className={`w-full text-left px-4 py-2 hover:bg-orange-50 transition flex items-center gap-2 ${
                                sortBy === option.value ? "bg-orange-100 text-orange-700 font-semibold" : ""
                              }`}
                            >
                              {option.label}
                              {sortBy === option.value && (
                                <span className="ml-auto text-orange-600">✓</span>
                              )}
                            </button>
                          ))}
                      </div>
                    </>
                  )}
                </div>

                <input
                  type="text"
                  placeholder="Search..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="border border-gray-300 rounded px-3 py-1 text-sm"
                />
                
                <button
                  onClick={() => router.push("/simulation")}
                  className="bg-orange-400 text-white px-4 py-1 rounded hover:bg-orange-600 transition"
                >
                  + New
                </button>
                
                {selectedDisruptions.length > 0 && (
                  <>
                    <button
                      onClick={selectAll}
                      className="bg-blue-500 text-white px-4 py-1 rounded hover:bg-blue-600 transition"
                    >
                      {selectedDisruptions.length === sortedDisruptions.length
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
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-400 mx-auto mb-4"></div>
                <p className="text-gray-600">Loading simulations...</p>
              </div>
            )}

            {/* Empty State */}
              {!loading && !error && sortedDisruptions.length === 0 && (
                <div className="text-center py-12">
                  <p className="text-gray-500 text-lg mb-4">
                    {search
                      ? "No simulations found matching your search"
                      : "No simulations yet"}
                  </p>
                  <button
                    onClick={() => router.push("/simulation")}
                    className="bg-orange-400 text-white px-6 py-2 rounded-lg hover:bg-orange-600 transition"
                  >
                    Create Your First Simulation
                  </button>
                </div>
              )}

            {/* Disruptions Grid - Grouped by Status */}
{!loading && !error && sortedDisruptions.length > 0 && (
  <div className="space-y-6">
    {/* ACTIVE SCENARIOS */}
    {(() => {
      const now = new Date();
      const active = sortedDisruptions.filter(d => {
        if (!d.start_time || !d.end_time) return false;
        const start = new Date(d.start_time);
        const end = new Date(d.end_time);
        return start <= now && end >= now;
      });
      
      if (active.length === 0) return null;
      
      return (
        <div className="bg-gradient-to-r from-green-50 to-white rounded-lg p-6 border-l-4 border-green-500">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-green-700 flex items-center gap-2">
              <span>Active Scenarios</span>
              <span className="text-lg font-normal text-green-600">({active.length})</span>
            </h2>
            <p className="text-sm text-green-600">Currently ongoing</p>
          </div>
          
          <div className="grid md:grid-cols-2 gap-4">
            {active.map((d) => (
              <div
                key={d.simulation_id}
                className="bg-white border-2 border-green-200 rounded-lg p-4 hover:shadow-xl transition-all transform hover:scale-[1.02]"
              >
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center gap-3 flex-1">
                    <input
                      type="checkbox"
                      checked={selectedDisruptions.includes(d.simulation_id)}
                      onChange={() => toggleSelect(d.simulation_id)}
                      className="w-5 h-5 text-green-600 rounded focus:ring-green-500"
                    />
                    <div className="flex-1">
                      <h3 className="font-bold text-lg text-gray-800">
                        {d.simulation_name || "Untitled Simulation"}
                      </h3>
                      <p className="text-xs text-green-600 font-semibold mt-1">● ACTIVE NOW</p>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    {d.simulation_status === "published" && (
                      <span className="px-2 py-1 text-xs rounded-full font-semibold bg-purple-100 text-purple-700">
                        Published ✓
                      </span>
                    )}
                    <span className={`px-2 py-1 text-xs rounded-full font-semibold ${getSeverityColor(d.severity_level)}`}>
                      {d.severity_level || "N/A"}
                    </span>
                    {d.is_edited && d.last_edited_at && (
                      <span className="px-2 py-1 text-xs rounded-full font-semibold bg-yellow-100 text-yellow-700">
                        Edited {new Date(d.last_edited_at).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
          
                <div className="text-sm text-gray-600 space-y-2 mb-4 bg-gray-50 rounded p-3">
                  <p className="flex items-center gap-2">
                    <span className="font-semibold"> Location:</span> {d.disruption_location || "Unknown"}
                  </p>
                  <p className="flex items-center gap-2">
                    <span className="font-semibold"> Type:</span> {d.disruption_type || "N/A"}
                  </p>
                  {d.start_time && (
                    <p className="flex items-center gap-2">
                      <span className="font-semibold"> Period:</span>
                      {new Date(d.start_time).toLocaleDateString()} - {new Date(d.end_time).toLocaleDateString()}
                    </p>
                  )}
                </div>

                <div className="flex justify-end gap-2">
                  <button onClick={() => handleEdit(d)} className="px-4 py-2 text-sm bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition font-semibold">
                    Edit
                  </button>
                   <button
                    onClick={() => handleGenerateReport(d)}
                    className="px-4 py-2 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition font-semibold"
                    title="Generate Report"
                  >
                    📊 Generate Report
                  </button>
                  {d.simulation_status === "published" ? (
                    <button onClick={() => handleUnpublish(d)} className="px-4 py-2 text-sm bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition font-semibold">
                    Unpublish
                    </button>
                  ) : (
                    <button onClick={() => handlePublishClick(d)} className="px-4 py-2 text-sm bg-green-500 text-white rounded-lg hover:bg-green-600 transition font-semibold">
                    Publish
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    })()}

    {/* UPCOMING SCENARIOS */}
    {(() => {
      const now = new Date();
      const upcoming = sortedDisruptions.filter(d => {
        if (!d.start_time) return false;
        const start = new Date(d.start_time);
        return start > now;
      });
      
      if (upcoming.length === 0) return null;
      
      return (
        <div className="bg-gradient-to-r from-blue-50 to-white rounded-lg p-6 border-l-4 border-blue-500">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-blue-700 flex items-center gap-2">
              <span>Upcoming Scenarios</span>
              <span className="text-lg font-normal text-blue-600">({upcoming.length})</span>
            </h2>
            <p className="text-sm text-blue-600">Scheduled for future</p>
          </div>
          
          <div className="grid md:grid-cols-2 gap-4">
            {upcoming.map((d) => (
              <div key={d.simulation_id} className="bg-white border-2 border-blue-200 rounded-lg p-4 hover:shadow-xl transition-all transform hover:scale-[1.02]">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center gap-3 flex-1">
                    <input type="checkbox" checked={selectedDisruptions.includes(d.simulation_id)} onChange={() => toggleSelect(d.simulation_id)} className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500" />
                    <div className="flex-1">
                      <h3 className="font-bold text-lg text-gray-800">{d.simulation_name || "Untitled Simulation"}</h3>
                      <p className="text-xs text-blue-600 font-semibold mt-1">
                         Starts {new Date(d.start_time).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    {d.simulation_status === "published" && (
                      <span className="px-2 py-1 text-xs rounded-full font-semibold bg-purple-100 text-purple-700">Published ✓</span>
                    )}
                    
                    {d.is_edited && d.last_edited_at && (
                      <span className="px-2 py-1 text-xs rounded-full font-semibold bg-yellow-100 text-yellow-700">
                        Edited {new Date(d.last_edited_at).toLocaleDateString()}
                      </span>
                    )}

                    <span className={`px-2 py-1 text-xs rounded-full font-semibold ${getSeverityColor(d.severity_level)}`}>{d.severity_level || "N/A"}</span>
                  </div>
                </div>

                <div className="text-sm text-gray-600 space-y-2 mb-4 bg-gray-50 rounded p-3">
                  <p className="flex items-center gap-2"><span className="font-semibold"> Location:</span> {d.disruption_location || "Unknown"}</p>
                  <p className="flex items-center gap-2"><span className="font-semibold"> Type:</span> {d.disruption_type || "N/A"}</p>
                  {d.start_time && (
                    <p className="flex items-center gap-2">
                      <span className="font-semibold"> Period:</span>
                      {new Date(d.start_time).toLocaleDateString()} - {new Date(d.end_time).toLocaleDateString()}
                    </p>
                  )}
                </div>

                <div className="flex justify-end gap-2">
                  <button onClick={() => handleEdit(d)} className="px-4 py-2 text-sm bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition font-semibold"> Edit</button>
                    <button
                      onClick={() => handleGenerateReport(d)}
                      className="px-4 py-2 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition font-semibold"
                      title="Generate Report"
                    >
                      📊 Generate Report
                    </button>
                  {d.simulation_status === "published" ? (
                    <button onClick={() => handleUnpublish(d)} className="px-4 py-2 text-sm bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition font-semibold"> Unpublish</button>
                  ) : (
                    <button onClick={() => handlePublishClick(d)} className="px-4 py-2 text-sm bg-green-500 text-white rounded-lg hover:bg-green-600 transition font-semibold"> Publish</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    })()}

    {/* ✅ NEW: FINISHED SCENARIOS */}
    {(() => {
      const now = new Date();
      const finished = sortedDisruptions.filter(d => {
        if (!d.end_time) return false;
        const end = new Date(d.end_time);
        return end < now;
      });
      
      if (finished.length === 0) return null;
      
      return (
        <div className="bg-gradient-to-r from-gray-50 to-white rounded-lg p-6 border-l-4 border-gray-500">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-gray-700 flex items-center gap-2">
              <span>Finished Scenarios</span>
              <span className="text-lg font-normal text-gray-600">({finished.length})</span>
            </h2>
            <p className="text-sm text-gray-600">Completed simulations</p>
          </div>
          
          <div className="grid md:grid-cols-2 gap-4">
            {finished.map((d) => (
              <div key={d.simulation_id} className="bg-white border-2 border-gray-200 rounded-lg p-4 hover:shadow-xl transition-all transform hover:scale-[1.02]">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center gap-3 flex-1">
                    <input type="checkbox" checked={selectedDisruptions.includes(d.simulation_id)} onChange={() => toggleSelect(d.simulation_id)} className="w-5 h-5 text-gray-600 rounded focus:ring-gray-500" />
                    <div className="flex-1">
                      <h3 className="font-bold text-lg text-gray-800">{d.simulation_name || "Untitled Simulation"}</h3>
                      <p className="text-xs text-gray-600 font-semibold mt-1">
                        ✓ Ended {new Date(d.end_time).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    {d.simulation_status === "published" && (
                      <span className="px-2 py-1 text-xs rounded-full font-semibold bg-purple-100 text-purple-700">Published ✓</span>
                    )}
                    {d.is_edited && d.last_edited_at && (
                      <span className="px-2 py-1 text-xs rounded-full font-semibold bg-yellow-100 text-yellow-700">
                        Edited {new Date(d.last_edited_at).toLocaleDateString()}
                      </span>
                    )}
                    <span className={`px-2 py-1 text-xs rounded-full font-semibold ${getSeverityColor(d.severity_level)}`}>{d.severity_level || "N/A"}</span>
                  </div>
                </div>

                <div className="text-sm text-gray-600 space-y-2 mb-4 bg-gray-50 rounded p-3">
                  <p className="flex items-center gap-2"><span className="font-semibold"> Location:</span> {d.disruption_location || "Unknown"}</p>
                  <p className="flex items-center gap-2"><span className="font-semibold"> Type:</span> {d.disruption_type || "N/A"}</p>
                  {d.start_time && (
                    <p className="flex items-center gap-2">
                      <span className="font-semibold"> Period:</span>
                      {new Date(d.start_time).toLocaleDateString()} - {new Date(d.end_time).toLocaleDateString()}
                    </p>
                  )}
                </div>

                <div className="flex justify-end gap-2">
                  <button onClick={() => handleEdit(d)} className="px-4 py-2 text-sm bg-orange-400 text-white rounded-lg hover:bg-orange-600 transition font-semibold"> Edit</button>
                  {d.simulation_status === "published" ? (
                    <button onClick={() => handleUnpublish(d)} className="px-4 py-2 text-sm bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition font-semibold"> Unpublish</button>
                  ) : (
                    <button onClick={() => handlePublishClick(d)} className="px-4 py-2 text-sm bg-green-500 text-white rounded-lg hover:bg-green-600 transition font-semibold"> Publish</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    })()}

    {/* ALL EMPTY STATE */}
    {(() => {
      const now = new Date();
      const active = sortedDisruptions.filter(d => {
        if (!d.start_time || !d.end_time) return false;
        const start = new Date(d.start_time);
        const end = new Date(d.end_time);
        return start <= now && end >= now;
      });
      const upcoming = sortedDisruptions.filter(d => {
        if (!d.start_time) return false;
        return new Date(d.start_time) > now;
      });
      const finished = sortedDisruptions.filter(d => {
        if (!d.end_time) return false;
        return new Date(d.end_time) < now;
      });
      
      if (active.length === 0 && upcoming.length === 0 && finished.length === 0) {
        return (
          <div className="text-center py-12 bg-gray-50 rounded-lg">
            <p className="text-gray-500 text-lg"> No simulations found</p>
            <p className="text-sm text-gray-400 mt-2">Create your first simulation to get started</p>
          </div>
        );
      }
      return null;
    })()}
  </div>
)}
          </div>
        )}
               
        {/* DATASETS TAB */}
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
                <label
                  className={`border border-orange-400 text-orange-400 px-4 py-1 rounded transition-all duration-300 cursor-pointer flex items-center gap-2 ${
                    uploading
                      ? "opacity-50 cursor-not-allowed"
                      : "hover:bg-orange-400 hover:text-white"
                  }`}
                >
                  {uploading ? (
                    <>
                      <div className="animate-spin h-4 w-4 border-2 border-orange-400 border-t-transparent rounded-full"></div>
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

                {selectedDatasets.length > 0 && (
                  <button
                    onClick={() => handleDelete(selectedDatasets)}
                    className="border border-red-500 text-red-600 px-4 py-1 rounded hover:bg-red-500 hover:text-white transition-all duration-300"
                  >
                    🗑️ Delete ({selectedDatasets.length})
                  </button>
                )}

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
                      <input
                        type="checkbox"
                        checked={selectedDatasets.includes(dataset.name)}
                        onChange={() => toggleDatasetSelect(dataset.name)}
                        className="mt-1"
                      />

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
                <strong> Tips:</strong>
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
                    onClick={() => {
                      setShowOTPModal(false);
                      sessionStorage.removeItem('publishPayload');
                    }}
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
                    onClick={() => {
                      setShowOTPModal(false);
                      sessionStorage.removeItem('publishPayload');
                      setOTPCode("");
                      setOTPSent(false);
                      setOTPError(null);
                    }}
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