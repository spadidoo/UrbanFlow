// frontend/services/api.js
// FIXED VERSION - Corrected API base URL

// API Configuration - FIXED: Removed /api from base URL since endpoints include it
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

// Helper function for API calls with improved error handling
async function apiCall(endpoint, options = {}) {
  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
      ...options,
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    // Silently handle errors when backend is offline
    // Only log in development mode
    if (process.env.NODE_ENV === 'development') {
      console.warn(`API call failed for ${endpoint}: ${error.message}`);
    }
    
    // Return safe fallback data instead of throwing
    // This prevents the entire app from crashing
    return {
      success: false,
      error: error.message,
      // Provide empty data structures based on what's expected
      disruptions: [],
      simulations: [],
      data: null,
    };
  }
}

// API Methods
export const api = {
  // ============================================================
  // EXISTING METHODS (Your original code)
  // ============================================================

  // Health check
  healthCheck: () => apiCall("/api/health"),

  // Get road info from coordinates
  getRoadInfo: (lat, lon) =>
    apiCall("/api/get-road-info", {
      method: "POST",
      body: JSON.stringify({ lat, lon }),
    }),

  // Single prediction
  predict: (data) =>
    apiCall("/api/predict", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // Simulate disruption
  simulateDisruption: (data) =>
    apiCall("/api/simulate-disruption", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // Get recommendations
  getRecommendations: (data) =>
    apiCall("/api/get-recommendations", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // Get all published disruptions
  getPublishedDisruptions: () => apiCall("/api/published-disruptions"),

  // ============================================================
  // NEW METHODS - Database Operations
  // ============================================================

  /**
   * Save simulation to database
   * @param {Object} simulationData - Simulation metadata (name, type, dates, etc.)
   * @param {Object} resultsData - Complete simulation results (hourly predictions, summary, etc.)
   * @returns {Promise<Object>} Response with simulation_id
   */
  saveSimulation: (simulationData, resultsData) =>
    apiCall("/api/save-simulation", {
      method: "POST",
      body: JSON.stringify({
        user_id: 2, // TODO: Replace with actual auth user_id
        simulation_data: simulationData,
        results_data: resultsData,
      }),
    }),

  /**
   * Publish simulation to public map
   * @param {number} simulationId - ID of the simulation to publish
   * @param {string} title - Public title for the disruption
   * @param {string} description - Public description
   * @param {number} userId - User ID (default: 2)
   * @returns {Promise<Object>} Response with slug (public URL)
   */
  publishSimulation: (simulationId, title, description, userId = 2) =>
    apiCall("/api/publish-simulation", {
      method: "POST",
      body: JSON.stringify({
        simulation_id: simulationId,
        user_id: userId,
        title: title,
        public_description: description,
      }),
    }),

  /**
   * Unpublish simulation from public map
   * @param {number} simulationId - ID of the simulation to unpublish
   * @param {number} userId - User ID (default: 2)
   * @returns {Promise<Object>} Success response
   */
  unpublishSimulation: (simulationId, userId = 2) =>
    apiCall("/api/unpublish-simulation", {
      method: "POST",
      body: JSON.stringify({
        simulation_id: simulationId,
        user_id: userId,
      }),
    }),

  /**
   * Get all simulations for the current user
   * @param {number} userId - User ID (default: 2)
   * @returns {Promise<Object>} List of user's simulations
   */
  getMySimulations: (userId = 2) =>
    apiCall(`/api/my-simulations?user_id=${userId}`),

  /**
   * Get detailed information about a specific simulation
   * @param {number} simulationId - Simulation ID
   * @returns {Promise<Object>} Complete simulation data with all details
   */
  getSimulation: (simulationId) => apiCall(`/api/simulation/${simulationId}`),

  /**
   * Delete (soft delete) a simulation
   * @param {number} simulationId - Simulation ID to delete
   * @param {number} userId - User ID (default: 2)
   * @returns {Promise<Object>} Success response
   */
  deleteSimulation: (simulationId, userId = 2) =>
    apiCall(`/api/delete-simulation/${simulationId}?user_id=${userId}`, {
      method: "DELETE",
    }),
};

export default api;