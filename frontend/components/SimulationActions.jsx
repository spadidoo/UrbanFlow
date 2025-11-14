// frontend/components/SimulationActions.jsx
// Example component showing how to use database features

"use client";

import { useState } from 'react';
import api from '@/services/api';

export default function SimulationActions({ simulationResults, simulationData }) {
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [simulationId, setSimulationId] = useState(null);
  const [publishSlug, setPublishSlug] = useState(null);
  const [message, setMessage] = useState('');

  /**
   * Save simulation to database
   */
  const handleSave = async () => {
    try {
      setSaving(true);
      setMessage('');

      // Prepare simulation data for database
      const dataToSave = {
        scenario_name: simulationData.scenarioName || 'Untitled Simulation',
        description: simulationData.description || '',
        disruption_type: simulationData.disruptionType,
        area: simulationData.area,
        road_corridor: simulationData.road_corridor,
        start_datetime: `${simulationData.startDate}T${simulationData.startTime}:00`,
        end_datetime: `${simulationData.endDate}T${simulationData.endTime}:00`,
        coordinates: simulationData.coordinates || {},
        severity_level: simulationResults.summary?.avg_severity_label?.toLowerCase() || 'moderate'
      };

      // Save to database
      const response = await api.saveSimulation(dataToSave, simulationResults);

      if (response.success) {
        setSimulationId(response.simulation_id);
        setMessage(`✓ Simulation saved successfully! ID: ${response.simulation_id}`);
      } else {
        setMessage(`✗ Failed to save: ${response.error}`);
      }
    } catch (error) {
      setMessage(`✗ Error: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  /**
   * Publish simulation to public map
   */
  const handlePublish = async () => {
    if (!simulationId) {
      setMessage('⚠️ Please save the simulation first!');
      return;
    }

    try {
      setPublishing(true);
      setMessage('');

      // Publish simulation
      const response = await api.publishSimulation(
        simulationId,
        simulationData.scenarioName || 'Traffic Disruption',
        simulationData.description || 'View traffic impact predictions',
        2 // user_id (will be replaced with actual auth)
      );

      if (response.success) {
        setPublishSlug(response.slug);
        setMessage(`✓ Published! Public URL: /disruptions/${response.slug}`);
      } else {
        setMessage(`✗ Failed to publish: ${response.error}`);
      }
    } catch (error) {
      setMessage(`✗ Error: ${error.message}`);
    } finally {
      setPublishing(false);
    }
  };

  /**
   * Unpublish simulation
   */
  const handleUnpublish = async () => {
    if (!simulationId) return;

    try {
      setMessage('');
      const response = await api.unpublishSimulation(simulationId);

      if (response.success) {
        setPublishSlug(null);
        setMessage('✓ Simulation unpublished');
      }
    } catch (error) {
      setMessage(`✗ Error: ${error.message}`);
    }
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-md mt-4">
      <h3 className="text-xl font-bold mb-4">Save & Publish</h3>

      {/* Status Message */}
      {message && (
        <div className={`p-3 mb-4 rounded ${
          message.startsWith('✓') ? 'bg-green-50 text-green-800' :
          message.startsWith('⚠️') ? 'bg-yellow-50 text-yellow-800' :
          'bg-red-50 text-red-800'
        }`}>
          {message}
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-3">
        {/* Save Button */}
        <button
          onClick={handleSave}
          disabled={saving || simulationId !== null}
          className={`px-6 py-2 rounded-lg font-semibold transition ${
            simulationId
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : 'bg-blue-600 text-white hover:bg-blue-700'
          }`}
        >
          {saving ? 'Saving...' : simulationId ? '✓ Saved' : 'Save Simulation'}
        </button>

        {/* Publish Button */}
        {simulationId && !publishSlug && (
          <button
            onClick={handlePublish}
            disabled={publishing}
            className="px-6 py-2 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition"
          >
            {publishing ? 'Publishing...' : 'Publish to Public Map'}
          </button>
        )}

        {/* Unpublish Button */}
        {publishSlug && (
          <button
            onClick={handleUnpublish}
            className="px-6 py-2 bg-orange-600 text-white rounded-lg font-semibold hover:bg-orange-700 transition"
          >
            Unpublish
          </button>
        )}
      </div>

      {/* Simulation Info */}
      {simulationId && (
        <div className="mt-4 p-4 bg-gray-50 rounded-lg">
          <p className="text-sm text-gray-600">
            <strong>Simulation ID:</strong> {simulationId}
          </p>
          {publishSlug && (
            <p className="text-sm text-gray-600 mt-1">
              <strong>Public URL:</strong>{' '}
              <a
                href={`/disruptions/${publishSlug}`}
                className="text-blue-600 hover:underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                /disruptions/{publishSlug}
              </a>
            </p>
          )}
        </div>
      )}
    </div>
  );
}


// ============================================================
// Example: How to integrate into simulation page
// ============================================================

/*
// In your simulation page (e.g., app/simulation/page.jsx):

import SimulationActions from '@/components/SimulationActions';

export default function SimulationPage() {
  const [results, setResults] = useState(null);
  const [formData, setFormData] = useState({...});

  // ... your existing simulation code ...

  return (
    <div>
      // ... your existing simulation form and results ...

      {results && (
        <SimulationActions
          simulationResults={results}
          simulationData={formData}
        />
      )}
    </div>
  );
}
*/
