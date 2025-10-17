"use client";
import { useRouter } from "next/navigation";

export default function ModeratePage() {
  const router = useRouter();

  return (
    <div className="p-8 bg-gray-50 min-h-screen">
      <button
        onClick={() => router.push("/planner")}
        className="mb-4 px-4 py-2 bg-orange-500 text-white rounded hover:bg-orange-600"
      >
        ← Back to Dashboard
      </button>

      <h1 className="text-2xl font-bold text-orange-600 mb-3">
        Moderate Simulations
      </h1>
      <p className="text-gray-700 mb-4">
        Here you can review and approve simulation submissions from other planners.
      </p>

      <div className="border rounded p-4 bg-white">
        <p>No pending moderation tasks yet.</p>
      </div>
    </div>
  );
}
