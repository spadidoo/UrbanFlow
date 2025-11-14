"use client";

import PlannerNavbar from "@/components/PlannerNavbar";
import { useState, useEffect } from "react";

export default function DataPage() {
  const [activeTab, setActiveTab] = useState("disruptions");
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [selectedDisruptions, setSelectedDisruptions] = useState([]);
  
  // Dataset states
  const [datasets, setDatasets] = useState([]);
  const [selectedDatasets, setSelectedDatasets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Fetch datasets on component mount and when switching to datasets tab
  useEffect(() => {
    if (activeTab === "datasets") {
      fetchDatasets();
    }
  }, [activeTab]);

  // ============================================================
  // FETCH DATASETS FROM BACKEND
  // ============================================================
  const fetchDatasets = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('http://localhost:5000/api/files/list');
      const data = await response.json();
      
      if (data.success) {
        setDatasets(data.files);
      } else {
        setError(data.error || 'Failed to load datasets');
      }
    } catch (err) {
      console.error('Error fetching datasets:', err);
      setError('Failed to connect to server');
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
    if (!file.name.endsWith('.csv')) {
      setError('Only CSV files are allowed');
      return;
    }

    // Validate file size (16MB max)
    if (file.size > 16 * 1024 * 1024) {
      setError('File size must be less than 16MB');
      return;
    }

    setUploading(true);
    setError(null);
    setSuccess(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('http://localhost:5000/api/files/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (data.success) {
        setSuccess(`✅ "${data.file.name}" uploaded successfully!`);
        fetchDatasets(); // Refresh list
        
        // Clear success message after 3 seconds
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(data.error || 'Upload failed');
      }
    } catch (err) {
      console.error('Upload error:', err);
      setError('Failed to upload file');
    } finally {
      setUploading(false);
      // Reset file input
      event.target.value = '';
    }
  };

  // ============================================================
  // DOWNLOAD SINGLE FILE
  // ============================================================
  const handleDownloadSingle = async (filename) => {
    try {
      const response = await fetch(`http://localhost:5000/api/files/download/${filename}`);
      
      if (!response.ok) {
        throw new Error('Download failed');
      }

      // Create blob and download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      setSuccess(`✅ Downloaded "${filename}"`);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error('Download error:', err);
      setError('Failed to download file');
    }
  };

  // ============================================================
  // DOWNLOAD MULTIPLE FILES (ZIP)
  // ============================================================
  const handleDownloadMultiple = async () => {
    if (selectedDatasets.length === 0) {
      setError('Please select files to download');
      return;
    }

    try {
      const response = await fetch('http://localhost:5000/api/files/download-multiple', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          filenames: selectedDatasets,
        }),
      });

      if (!response.ok) {
        throw new Error('Download failed');
      }

      // Create blob and download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
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
      console.error('Download error:', err);
      setError('Failed to download files');
    }
  };

  // ============================================================
  // DELETE FILES
  // ============================================================
  const handleDelete = async (filenames) => {
    if (!confirm(`Are you sure you want to delete ${filenames.length} file(s)? This action cannot be undone.`)) {
      return;
    }

    try {
      const response = await fetch('http://localhost:5000/api/files/delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
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
        setError(data.error || 'Delete failed');
      }
    } catch (err) {
      console.error('Delete error:', err);
      setError('Failed to delete files');
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
      setSelectedDatasets(datasets.map(d => d.name));
    }
  };

  // ============================================================
  // MOCK DISRUPTIONS DATA (Keep as is)
  // ============================================================
  const disruptions = [
    {
      id: 1,
      title: "Flood near Barangay Real",
      type: "Flood",
      status: "Published",
      date: "2025-10-10",
      congestion: "Severe",
    },
    {
      id: 2,
      title: "Road Repair at Crossing",
      type: "Infrastructure",
      status: "Draft",
      date: "2025-10-15",
      congestion: "Moderate",
    },
  ];

  const toggleSelect = (id) => {
    setSelectedDisruptions((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const filteredDisruptions = disruptions.filter(
    (d) =>
      (filter === "all" || d.status.toLowerCase() === filter.toLowerCase()) &&
      d.title.toLowerCase().includes(search.toLowerCase())
  );

  const completedProjects = disruptions.filter(
    (d) => d.status.toLowerCase() === "published"
  );

  return (
    <div className="min-h-screen bg-[#F5F6FA] text-gray-800">
      <PlannerNavbar />

      <main className="container mx-auto px-8 py-10">
        <h1 className="text-3xl font-bold text-black-600 mb-8">
          Data Management
        </h1>

        {/* Notification Messages */}
        {error && (
          <div className="mb-4 bg-red-50 border-l-4 border-red-500 p-4 rounded">
            <p className="text-red-700">{error}</p>
            <button
              onClick={() => setError(null)}
              className="text-red-500 text-sm hover:underline mt-2"
            >
              Dismiss
            </button>
          </div>
        )}

        {success && (
          <div className="mb-4 bg-green-50 border-l-4 border-green-500 p-4 rounded">
            <p className="text-green-700">{success}</p>
          </div>
        )}

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

        {/* DISRUPTIONS TAB (Keep existing code) */}
        {activeTab === "disruptions" && (
          <div className="bg-white shadow rounded-lg p-6">
            <div className="flex justify-between items-center mb-4">
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

              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Search disruption..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="border border-gray-300 rounded px-3 py-1 text-sm"
                />
                <button className="bg-orange-500 text-white px-4 py-1 rounded hover:bg-orange-600 transition">
                  + New
                </button>
                {selectedDisruptions.length > 0 && (
                  <button className="bg-red-500 text-white px-4 py-1 rounded hover:bg-red-600 transition">
                    Delete ({selectedDisruptions.length})
                  </button>
                )}
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              {filteredDisruptions.length === 0 ? (
                <p className="text-gray-500">No disruptions found.</p>
              ) : (
                filteredDisruptions.map((d) => (
                  <div
                    key={d.id}
                    className="border rounded-lg p-4 hover:shadow-lg transition transform hover:scale-[1.02] bg-gray-50"
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={selectedDisruptions.includes(d.id)}
                          onChange={() => toggleSelect(d.id)}
                        />
                        <h3 className="font-bold text-lg text-orange-600">
                          {d.title}
                        </h3>
                      </div>
                      <span
                        className={`px-2 py-1 text-xs rounded ${
                          d.status === "Published"
                            ? "bg-green-100 text-green-700"
                            : "bg-yellow-100 text-yellow-700"
                        }`}
                      >
                        {d.status}
                      </span>
                    </div>

                    <p className="text-sm text-gray-600 mt-2">
                      Type: {d.type} | Date: {d.date}
                    </p>
                    <p className="text-sm mt-1">Congestion: {d.congestion}</p>

                    <div className="flex justify-end gap-2 mt-3">
                      <button className="px-3 py-1 text-sm border border-orange-500 text-orange-600 rounded hover:bg-orange-500 hover:text-white transition-all duration-300">
                        Edit
                      </button>
                      <button className="px-3 py-1 text-sm border border-red-500 text-red-600 rounded hover:bg-red-500 hover:text-white transition-all duration-300">
                        Delete
                      </button>
                      <button
                        className={`px-3 py-1 text-sm rounded border transition-all duration-300 ${
                          d.status === "Published"
                            ? "border-gray-500 text-gray-600 hover:bg-gray-500 hover:text-white"
                            : "border-green-500 text-green-600 hover:bg-green-500 hover:text-white"
                        }`}
                      >
                        {d.status === "Published" ? "Unpublish" : "Publish"}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
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
                  {datasets.length} file{datasets.length !== 1 ? 's' : ''} in data/final folder
                </p>
              </div>
              
              <div className="flex gap-2">
                {/* Upload Button */}
                <label className={`border border-orange-500 text-orange-600 px-4 py-1 rounded transition-all duration-300 cursor-pointer flex items-center gap-2 ${
                  uploading ? 'opacity-50 cursor-not-allowed' : 'hover:bg-orange-500 hover:text-white'
                }`}>
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
                      ? 'border-gray-300 text-gray-400 cursor-not-allowed'
                      : 'border-blue-500 text-blue-600 hover:bg-blue-500 hover:text-white'
                  }`}
                >
                  ⬇ Download {selectedDatasets.length > 0 && `(${selectedDatasets.length})`}
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
                    {selectedDatasets.length === datasets.length ? 'Deselect All' : 'Select All'}
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
                        ? 'bg-orange-50 border-orange-300'
                        : 'hover:shadow-md'
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
                          <span>Rows: <strong>{dataset.rows.toLocaleString()}</strong></span>
                          <span>Columns: <strong>{dataset.cols}</strong></span>
                          <span>Size: <strong>{dataset.size_mb} MB</strong></span>
                          <span>Last Modified: <strong>{dataset.updated}</strong></span>
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
                <li>• Files are stored in <code className="bg-blue-100 px-1 rounded">data/final</code> folder</li>
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
    </div>
  );
}