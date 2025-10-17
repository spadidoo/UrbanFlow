"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function ReviewPage() {
  const router = useRouter();

  const [pendingReviews, setPendingReviews] = useState([
    { id: 1, name: "Flood Simulation - Crossing", status: "pending" },
    { id: 2, name: "Traffic Simulation - Real Road", status: "pending" },
  ]);

  const handleDecision = (id, decision) => {
    const updated = pendingReviews.map((item) =>
      item.id === id
        ? { ...item, status: decision === "approve" ? "approved" : "rejected" }
        : item
    );
    setPendingReviews(updated);
    alert(`Scenario ${decision === "approve" ? "approved" : "rejected"}!`);
  };

  return (
    <div className="p-8 bg-[#F5F6FA] min-h-screen text-gray-800">
      <button
        onClick={() => router.push("/planner")}
        className="mb-6 px-4 py-2 bg-orange-500 text-white rounded hover:bg-orange-600"
      >
        ← Back to Dashboard
      </button>

      <h1 className="text-3xl font-bold text-orange-600 mb-6">
        Review Pending Simulations
      </h1>

      {pendingReviews.map((item) => (
        <div
          key={item.id}
          className="bg-white shadow rounded-lg p-4 mb-3 flex justify-between items-center"
        >
          <div>
            <p className="font-semibold">{item.name}</p>
            <p className="text-sm text-gray-500">Status: {item.status}</p>
          </div>
          {item.status === "pending" ? (
            <div className="flex gap-2">
              <button
                onClick={() => handleDecision(item.id, "approve")}
                className="px-3 py-1 border border-green-500 text-green-600 rounded hover:bg-green-50"
              >
                Approve
              </button>
              <button
                onClick={() => handleDecision(item.id, "reject")}
                className="px-3 py-1 border border-red-500 text-red-600 rounded hover:bg-red-50"
              >
                Reject
              </button>
            </div>
          ) : (
            <span
              className={`font-medium ${
                item.status === "approved" ? "text-green-600" : "text-red-600"
              }`}
            >
              {item.status.toUpperCase()}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
