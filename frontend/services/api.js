// API Configuration
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

// Helper function for API calls
async function apiCall(endpoint, options = {}) {
  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('API call failed:', error);
    throw error;
  }
}

// API Methods
export const api = {
  // Health check
  healthCheck: () => apiCall('/api/health'),

  // Get road info from coordinates
  getRoadInfo: (lat, lon) => 
    apiCall('/api/get-road-info', {
      method: 'POST',
      body: JSON.stringify({ lat, lon }),
    }),

  // Single prediction
  predict: (data) => 
    apiCall('/api/predict', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Simulate disruption
  simulateDisruption: (data) => 
    apiCall('/api/simulate-disruption', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Get recommendations
  getRecommendations: (data) => 
    apiCall('/api/get-recommendations', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Get all published disruptions (you'll need to add this endpoint later)
  getPublishedDisruptions: () => apiCall('/api/published-disruptions'),
};

export default api;