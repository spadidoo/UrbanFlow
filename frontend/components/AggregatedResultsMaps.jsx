"use client";

import { useState } from "react";
import dynamic from "next/dynamic";

const SmartResultsMap = dynamic(() => import("@/components/SmartResultsMap"), {
  ssr: false,
  loading: () => <div className="h-[500px] bg-gray-200 flex items-center justify-center">Loading...</div>,
});

export default function AggregatedResultsMaps({ aggregatedView, selectedLocation, roadInfo, simulationResults }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const mapData = aggregatedView.map_data;

  if (!mapData || mapData.length === 0) {
    return null;
  }

  const currentData = mapData[currentIndex];

  // Create synthetic results object for the current time period
  const periodResults = {
    ...simulationResults,
    summary: {
      ...simulationResults.summary,
      avg_severity: currentData.avg_severity || currentData.severity,
      avg_severity_label: currentData.avg_severity_label || currentData.severity_label,
      avg_delay_minutes: currentData.avg_delay_min || currentData.delay_info?.additional_delay_min || 0,
    }
  };

  return (
    <div className="space-y-4">
      {/* Header with Navigation */}
      <div className="bg-white rounded-lg shadow-md p-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold text-gray-800">
              {aggregatedView.display_label}
            </h3>
            <p className="text-sm text-gray-600">
              {aggregatedView.granularity === 'hourly' && `Hour ${currentIndex + 1} of ${mapData.length}`}
              {aggregatedView.granularity === 'daily' && `Day ${currentIndex + 1} of ${mapData.length}`}
              {aggregatedView.granularity === 'weekly' && `Week ${currentIndex + 1} of ${mapData.length}`}
            </p>
          </div>

          {/* Navigation Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))}
              disabled={currentIndex === 0}
              className={`px-4 py-2 rounded-lg font-semibold transition ${
                currentIndex === 0
                  ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  : 'bg-orange-500 text-white hover:bg-orange-600'
              }`}
            >
              ← Previous
            </button>
            
            <span className="text-sm font-semibold text-gray-700 px-4">
              {currentIndex + 1} / {mapData.length}
            </span>

            <button
              onClick={() => setCurrentIndex(Math.min(mapData.length - 1, currentIndex + 1))}
              disabled={currentIndex === mapData.length - 1}
              className={`px-4 py-2 rounded-lg font-semibold transition ${
                currentIndex === mapData.length - 1
                  ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  : 'bg-orange-500 text-white hover:bg-orange-600'
              }`}
            >
              Next →
            </button>
          </div>
        </div>

        {/* Current Period Info */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-gray-50 rounded-lg">
          {aggregatedView.granularity === 'hourly' && (
            <>
              <div>
                <p className="text-xs text-gray-600">Time</p>
                <p className="font-bold text-gray-800">{currentData.datetime}</p>
              </div>
              <div>
                <p className="text-xs text-gray-600">Day</p>
                <p className="font-bold text-gray-800">{currentData.day_of_week}</p>
              </div>
            </>
          )}
          
          {aggregatedView.granularity === 'daily' && (
            <>
              <div>
                <p className="text-xs text-gray-600">Date</p>
                <p className="font-bold text-gray-800">{currentData.date}</p>
              </div>
              <div>
                <p className="text-xs text-gray-600">Day</p>
                <p className="font-bold text-gray-800">{currentData.day_name}</p>
              </div>
              <div>
                <p className="text-xs text-gray-600">Peak Hour</p>
                <p className="font-bold text-gray-800">{currentData.peak_hour}:00</p>
              </div>
            </>
          )}

          {aggregatedView.granularity === 'weekly' && (
            <>
              <div>
                <p className="text-xs text-gray-600">Week {currentData.week_number}</p>
                <p className="font-bold text-gray-800">{currentData.date_range}</p>
              </div>
            </>
          )}

          <div>
            <p className="text-xs text-gray-600">Avg Congestion</p>
            <p className={`font-bold ${
              currentData.avg_severity_label === 'Heavy' ? 'text-red-600' :
              currentData.avg_severity_label === 'Moderate' ? 'text-yellow-600' :
              'text-green-600'
            }`}>
              {currentData.avg_severity_label}
            </p>
          </div>

          <div>
            <p className="text-xs text-gray-600">Avg Delay</p>
            <p className="font-bold text-gray-800">+{currentData.avg_delay_min} min</p>
          </div>
        </div>

        {/* Timeline Dots */}
        <div className="flex justify-center gap-1 mt-4 overflow-x-auto py-2">
          {mapData.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentIndex(idx)}
              className={`w-3 h-3 rounded-full transition ${
                idx === currentIndex
                  ? 'bg-orange-500 scale-125'
                  : idx < currentIndex
                  ? 'bg-gray-400'
                  : 'bg-gray-300'
              }`}
              title={
                aggregatedView.granularity === 'hourly' ? `Hour ${idx + 1}` :
                aggregatedView.granularity === 'daily' ? `Day ${idx + 1}` :
                `Week ${idx + 1}`
              }
            />
          ))}
        </div>
      </div>

      {/* Map */}
      <SmartResultsMap
        simulationResults={periodResults}
        selectedLocation={selectedLocation}
        roadInfo={roadInfo}
      />

      {/* Severity Breakdown */}
      {currentData.severity_breakdown && (
        <div className="bg-white rounded-lg shadow-md p-4">
          <h4 className="font-bold text-gray-800 mb-3">
            {aggregatedView.granularity === 'hourly' ? 'This Hour' :
             aggregatedView.granularity === 'daily' ? 'This Day' : 'This Week'} - Congestion Breakdown
          </h4>
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-green-50 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-green-600">
                {currentData.severity_breakdown.Light || 0}
              </p>
              <p className="text-xs text-gray-600">Light Hours</p>
            </div>
            <div className="bg-yellow-50 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-yellow-600">
                {currentData.severity_breakdown.Moderate || 0}
              </p>
              <p className="text-xs text-gray-600">Moderate Hours</p>
            </div>
            <div className="bg-red-50 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-red-600">
                {currentData.severity_breakdown.Heavy || 0}
              </p>
              <p className="text-xs text-gray-600">Heavy Hours</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}