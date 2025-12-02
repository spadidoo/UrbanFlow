// frontend/services/api.js
// COMPLETE VERSION - Includes all existing methods + new reports methods

// API Configuration
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "https://backend.urbanflowph.com";

// Helper function for API calls
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
    //silently handle errors when backend is offline -- only log in development mode
    if (process.env.NODE_ENV !== 'development') {
      console.warn(`API call failed for ${endpoint}: ${error.message}`);
  }

    return{
      success: false,
      error: error.message,
      //provide empty data structure based on whats expected
      disruptions: [],
      simulations: [],
      reports: [],
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
  // DATABASE OPERATIONS (Existing)
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
  publishSimulation: (simulationId, title, description, userId) =>
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
  unpublishSimulation: (simulationId, userId) =>
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
  getMySimulations: (userId) =>
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
  deleteSimulation: (simulationId, userId) =>
    apiCall(`/api/delete-simulation/${simulationId}?user_id=${userId}`, {
      method: "DELETE",
      }),

  /**
   * Send OTP for publishing verification
   */
  sendPublishOTP: (simulationId, userId) =>
    apiCall("/api/send-publish-otp", {
      method: "POST",
      body: JSON.stringify({
        simulation_id: simulationId,
        user_id: userId,
      }),
    }),

  /**
   * Verify OTP and publish simulation
   */
  verifyPublishOTP: (simulationId, otpCode, title, description, userId = 2) =>
    apiCall("/api/verify-publish-otp", {
      method: "POST",
      body: JSON.stringify({
        simulation_id: simulationId,
        otp_code: otpCode,
        title: title,
        public_description: description,
        user_id: userId,
      }),
    }),

  /**
   * Delete multiple simulations
   */
  deleteSimulationsBatch: (simulationIds, userId = 2) =>
    apiCall("/api/delete-simulations-batch", {
      method: "POST",
      body: JSON.stringify({
        simulation_ids: simulationIds,
        user_id: userId,
      }),
    }),

    

  // ============================================================
  // NEW METHODS - Reports Operations
  // ============================================================

  /**
   * Get all finished/completed simulations for reports
   * @param {Object} filters - Optional filters
   * @param {string} filters.query - Search query (matches title or location)
   * @param {string} filters.date - Filter by date (YYYY-MM-DD)
   * @param {string} filters.location - Filter by location (partial match)
   * @param {string} filters.type - Filter by disruption type
   * @param {number} filters.userId - User ID (defaults to 2)
   * @returns {Promise<Object>} List of finished reports with metadata
   * 
   * Example:
   * api.getFinishedReports({ query: 'roadwork', type: 'roadwork', userId: 2 })
   */
  getFinishedReports: (filters = {}) => {
    const params = new URLSearchParams();
    
    if (filters.query) params.append('query', filters.query);
    if (filters.date) params.append('date', filters.date);
    if (filters.location) params.append('location', filters.location);
    if (filters.type && filters.type !== 'all') params.append('type', filters.type);
    if (filters.userId) params.append('user_id', filters.userId);
    
    const queryString = params.toString();
    const endpoint = queryString ? `/api/reports?${queryString}` : '/api/reports';
    
    return apiCall(endpoint);
  },

  /**
   * Export a report in the specified format
   * NOTE: This method is different from others - it returns a Response object for file download
   * 
   * @param {number} simulationId - Simulation ID to export
   * @param {string} format - Export format: 'pdf', 'csv', or 'excel'
   * @returns {Promise<Response>} Response object with file blob
   * 
   * Example:
   * const response = await api.exportReport(123, 'pdf');
   * const blob = await response.blob();
   * // Then trigger download in browser
   */
  exportReport: async (simulationId, format) => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/reports/${simulationId}/export?format=${format}`
      );
      
      if (!response.ok) {
        throw new Error(`Export failed: ${response.status}`);
      }
      
      return response;
    } catch (error) {
      console.error(`Error exporting report as ${format}:`, error);
      throw error;
    }
  },
};

export default api;