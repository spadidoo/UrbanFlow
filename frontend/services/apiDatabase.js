// frontend/services/api.js - UPDATED VERSION
// Add these new functions to your existing api.js

const API_BASE_URL = 'http://localhost:5000/api';

// ============================================================
// EXISTING API FUNCTIONS (keep these)
// ============================================================

// Your existing functions remain here...

// ============================================================
// NEW DATABASE OPERATIONS
// ============================================================

/**
 * Save a simulation to the database as a draft
 */
export const saveSimulation = async (simulationData, resultsData, userId = 1) => {
  try {
    const response = await fetch(`${API_BASE_URL}/save-simulation`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        user_id: userId,
        simulation_data: simulationData,
        results_data: resultsData,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to save simulation');
    }

    return data;
  } catch (error) {
    console.error('Error saving simulation:', error);
    throw error;
  }
};

/**
 * Publish a simulation to the public map
 */
export const publishSimulation = async (runId, userId = 1) => {
  try {
    const response = await fetch(`${API_BASE_URL}/publish-simulation`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        run_id: runId,
        user_id: userId,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to publish simulation');
    }

    return data;
  } catch (error) {
    console.error('Error publishing simulation:', error);
    throw error;
  }
};

/**
 * Unpublish a simulation (remove from public map)
 */
export const unpublishSimulation = async (runId, userId = 1) => {
  try {
    const response = await fetch(`${API_BASE_URL}/unpublish-simulation`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        run_id: runId,
        user_id: userId,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to unpublish simulation');
    }

    return data;
  } catch (error) {
    console.error('Error unpublishing simulation:', error);
    throw error;
  }
};

/**
 * Get all simulations for the current user
 */
export const getMySimulations = async (userId = 1, status = null) => {
  try {
    const params = new URLSearchParams({ user_id: userId });
    if (status) {
      params.append('status', status);
    }

    const response = await fetch(`${API_BASE_URL}/my-simulations?${params}`);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to fetch simulations');
    }

    return data;
  } catch (error) {
    console.error('Error fetching user simulations:', error);
    throw error;
  }
};

/**
 * Get detailed information about a specific simulation
 */
export const getSimulationDetails = async (runId) => {
  try {
    const response = await fetch(`${API_BASE_URL}/simulation/${runId}`);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to fetch simulation details');
    }

    return data;
  } catch (error) {
    console.error('Error fetching simulation details:', error);
    throw error;
  }
};

/**
 * Get all published simulations for public map
 */
export const getPublishedSimulations = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/published-simulations`);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to fetch published simulations');
    }

    return data;
  } catch (error) {
    console.error('Error fetching published simulations:', error);
    throw error;
  }
};

/**
 * Delete a simulation
 */
export const deleteSimulation = async (runId, userId = 1) => {
  try {
    const response = await fetch(`${API_BASE_URL}/delete-simulation/${runId}?user_id=${userId}`, {
      method: 'DELETE',
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to delete simulation');
    }

    return data;
  } catch (error) {
    console.error('Error deleting simulation:', error);
    throw error;
  }
};

/**
 * Run simulation and save in one request
 */
export const simulateAndSave = async (formData, saveToDatabase = false, userId = 1) => {
  try {
    const response = await fetch(`${API_BASE_URL}/simulate-and-save`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...formData,
        save_to_database: saveToDatabase,
        user_id: userId,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to run simulation');
    }

    return data;
  } catch (error) {
    console.error('Error in simulation:', error);
    throw error;
  }
};

// eslint-disable-next-line import/no-anonymous-default-export
export default {
  // ... your existing exports
  saveSimulation,
  publishSimulation,
  unpublishSimulation,
  getMySimulations,
  getSimulationDetails,
  getPublishedSimulations,
  deleteSimulation,
  simulateAndSave,
};
