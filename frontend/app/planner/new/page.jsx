"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function NewSimulationPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    title: "",
    type: "",
    location: "",
    description: "",
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    console.log("Simulation Submitted:", formData);
    alert("Simulation created successfully (mock mode)");
    router.push("/planner");
  };

  return (
    <div className="p-8 bg-[#F5F6FA] white:bg-[#000000] min-h-screen text-gray-800 dark:text-gray-100 transition-colors duration-300">
      <button
        onClick={() => router.push("/planner")}
        className="mb-6 px-4 py-2 bg-orange-500 text-white rounded hover:bg-orange-600"
      >
        ← Back to Dashboard
      </button>

      <h1 className="text-3xl font-bold text-orange-600 dark:text-orange-400 mb-6">
        Create New Simulation Scenario
      </h1>

      <form
        onSubmit={handleSubmit}
        className="bg-white dark:bg-gray-800 shadow-lg rounded-lg p-8 max-w-2xl space-y-6 transition-colors duration-300"
      >
        {/* Title */}
        <div>
          <label className="block text-sm font-semibold mb-1">
            Scenario Title
          </label>
          <input
            type="text"
            name="title"
            value={formData.title}
            onChange={handleChange}
            placeholder="Ex: Flood Simulation - Crossing Area"
            className="w-full border border-gray-300 dark:border-gray-600 rounded p-2 focus:outline-none focus:ring-2 focus:ring-orange-500 dark:bg-gray-700"
            required
          />
        </div>

        {/* Type */}
        <div>
          <label className="block text-sm font-semibold mb-1">
            Type of Simulation
          </label>
          <select
            name="type"
            value={formData.type}
            onChange={handleChange}
            className="w-full border border-gray-300 dark:border-gray-600 rounded p-2 focus:outline-none focus:ring-2 focus:ring-orange-500 dark:bg-gray-700"
            required
          >
            <option value="">Select type</option>
            <option value="flood">Flood</option>
            <option value="traffic">Traffic</option>
            <option value="infrastructure">Infrastructure</option>
          </select>
        </div>

        {/* Location */}
        <div>
          <label className="block text-sm font-semibold mb-1">
            Location
          </label>
          <input
            type="text"
            name="location"
            value={formData.location}
            onChange={handleChange}
            placeholder="Ex: Barangay Real, Calamba City"
            className="w-full border border-gray-300 dark:border-gray-600 rounded p-2 focus:outline-none focus:ring-2 focus:ring-orange-500 dark:bg-gray-700"
            required
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-semibold mb-1">
            Description
          </label>
          <textarea
            name="description"
            value={formData.description}
            onChange={handleChange}
            rows="4"
            placeholder="Brief description of the simulation..."
            className="w-full border border-gray-300 dark:border-gray-600 rounded p-2 focus:outline-none focus:ring-2 focus:ring-orange-500 dark:bg-gray-700"
          ></textarea>
        </div>

        {/* Submit */}
        <div className="flex justify-end">
          <button
            type="submit"
            className="px-6 py-2 bg-orange-500 text-white font-semibold rounded hover:bg-orange-600"
          >
            Save Simulation
          </button>
        </div>
      </form>
    </div>
  );
}
