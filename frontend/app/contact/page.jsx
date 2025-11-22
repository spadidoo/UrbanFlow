"use client";

import Navbar from "@/components/Navbar";
import { useState } from "react";

export default function ContactPage() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    subject: "",
    message: "",
  });
  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState("idle"); // idle, loading, success, error
  const [statusMessage, setStatusMessage] = useState("");

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: "" }));
    }
    // Clear status message when user starts typing again
    if (status === "error" || status === "success") {
      setStatus("idle");
      setStatusMessage("");
    }
  };

  const validateForm = () => {
    const newErrors = {};
    if (!formData.name.trim()) newErrors.name = "Name is required";
    if (!formData.email.trim()) {
      newErrors.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = "Please enter a valid email address";
    }
    if (!formData.subject.trim()) newErrors.subject = "Subject is required";
    if (!formData.message.trim()) newErrors.message = "Message is required";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setStatus("loading");
    setStatusMessage("");

    try {
      // Changed to use Next.js API route instead of Flask backend
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (data.success) {
        setStatus("success");
        setStatusMessage(
          "Message sent successfully! We'll get back to you soon."
        );
        setFormData({ name: "", email: "", subject: "", message: "" });
      } else {
        setStatus("error");
        if (data.errors) {
          setErrors(data.errors);
          setStatusMessage("Please fix the errors above.");
        } else {
          setStatusMessage(
            data.error || "Something went wrong. Please try again."
          );
        }
      }
    } catch (err) {
      console.error("Contact form error:", err);
      setStatus("error");
      setStatusMessage(
        "Network error. Please check your connection and try again."
      );
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl font-bold text-gray-800 mb-6">Contact Us</h1>

          <div className="grid md:grid-cols-2 gap-8 mb-8">
            {/* Contact Details */}
            <div className="bg-white rounded-lg shadow-md p-8">
              <h2 className="text-2xl font-bold text-gray-800 mb-6">
                Get in Touch
              </h2>
              <div className="space-y-4">
                <div className="flex items-start gap-4">
                  <div className="text-blue-600 text-2xl">📧</div>
                  <div>
                    <h3 className="font-semibold text-gray-800">Email</h3>
                    <p className="text-gray-600">urbanflow.service@gmail.com</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="text-blue-600 text-2xl">📱</div>
                  <div>
                    <h3 className="font-semibold text-gray-800">Phone</h3>
                    <p className="text-gray-600">+63 (049) 123-4567</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="text-blue-600 text-2xl">📍</div>
                  <div>
                    <h3 className="font-semibold text-gray-800">Address</h3>
                    <p className="text-gray-600">
                      Calamba City Hall
                      <br />
                      Calamba, Laguna
                      <br />
                      Philippines 4027
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="text-blue-600 text-2xl">⏰</div>
                  <div>
                    <h3 className="font-semibold text-gray-800">
                      Office Hours
                    </h3>
                    <p className="text-gray-600">
                      Monday - Friday: 8:00 AM - 5:00 PM
                      <br />
                      Saturday - Sunday: Closed
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Contact Form */}
            <div className="bg-white rounded-lg shadow-md p-8">
              <h2 className="text-2xl font-bold text-gray-800 mb-6">
                Send a Message
              </h2>

              {/* Status Messages */}
              {status === "success" && (
                <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                  <p className="text-green-700 flex items-center gap-2">
                    <span>✓</span> {statusMessage}
                  </p>
                </div>
              )}
              {status === "error" && statusMessage && (
                <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-red-700 flex items-center gap-2">
                    <span>✕</span> {statusMessage}
                  </p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-gray-700 font-semibold mb-2">
                    Name
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    placeholder="Your name"
                    className={`w-full px-4 py-2 border rounded-lg text-gray-800 focus:outline-none focus:ring-2 focus:ring-orange-500 ${
                      errors.name ? "border-red-500" : "border-gray-300"
                    }`}
                  />
                  {errors.name && (
                    <p className="text-red-500 text-sm mt-1">{errors.name}</p>
                  )}
                </div>

                <div>
                  <label className="block text-gray-700 font-semibold mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="your.email@example.com"
                    className={`w-full px-4 py-2 border rounded-lg focus:outline-none text-gray-800 focus:ring-2 focus:ring-orange-500 ${
                      errors.email ? "border-red-500" : "border-gray-300"
                    }`}
                  />
                  {errors.email && (
                    <p className="text-red-500 text-sm mt-1">{errors.email}</p>
                  )}
                </div>

                <div>
                  <label className="block text-gray-700 font-semibold mb-2">
                    Subject
                  </label>
                  <input
                    type="text"
                    name="subject"
                    value={formData.subject}
                    onChange={handleChange}
                    placeholder="What is this about?"
                    className={`w-full px-4 py-2 border rounded-lg focus:outline-none text-gray-800 focus:ring-2 focus:ring-orange-500 ${
                      errors.subject ? "border-red-500" : "border-gray-300"
                    }`}
                  />
                  {errors.subject && (
                    <p className="text-red-500 text-sm mt-1">
                      {errors.subject}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-gray-700 font-semibold mb-2">
                    Message
                  </label>
                  <textarea
                    name="message"
                    rows="4"
                    value={formData.message}
                    onChange={handleChange}
                    placeholder="Your message..."
                    className={`w-full px-4 py-2 border rounded-lg focus:outline-none text-gray-800 focus:ring-2 focus:ring-orange-500 ${
                      errors.message ? "border-red-500" : "border-gray-300"
                    }`}
                  ></textarea>
                  {errors.message && (
                    <p className="text-red-500 text-sm mt-1">
                      {errors.message}
                    </p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={status === "loading"}
                  className={`w-full py-3 rounded-lg font-semibold transition-all duration-300 flex items-center justify-center gap-2 border-2 ${
                    status === "loading"
                      ? "bg-orange-400 text-white border-orange-400 cursor-not-allowed"
                      : "border-orange-300 text-orange-500 hover:bg-orange-300 hover:text-white"
                  }`}
                >
                  {status === "loading" ? (
                    <>
                      <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                          fill="none"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        />
                      </svg>
                      Sending...
                    </>
                  ) : (
                    "Send Message"
                  )}
                </button>
              </form>
            </div>
          </div>

          {/* FAQ Section */}
          <div className="bg-white rounded-lg shadow-md p-8">
            <h2 className="text-2xl font-bold text-gray-800 mb-6">
              Frequently Asked Questions
            </h2>
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold text-gray-800 mb-2">
                  How accurate are the traffic predictions?
                </h3>
                <p className="text-gray-600">
                  Our machine learning model is trained on historical data and
                  achieves an accuracy rate of approximately 85-90% for
                  short-term predictions.
                </p>
              </div>
              <div>
                <h3 className="font-semibold text-gray-800 mb-2">
                  How can I report a traffic incident?
                </h3>
                <p className="text-gray-600">
                  Currently, only authorized urban planners can input disruption
                  data. For incident reports, please contact the Calamba City
                  Traffic Management Office.
                </p>
              </div>
              <div>
                <h3 className="font-semibold text-gray-800 mb-2">
                  Is the system available 24/7?
                </h3>
                <p className="text-gray-600">
                  Yes! The UrbanFlow website and traffic map are accessible
                  24/7. However, administrative support is only available during
                  office hours.
                </p>
              </div>
              <div>
                <h3 className="font-semibold text-gray-800 mb-2">
                  Can other cities use UrbanFlow?
                </h3>
                <p className="text-gray-600">
                  UrbanFlow is specifically designed for Calamba City, but the
                  system can be adapted for other cities with proper data
                  integration and training.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>

      <footer className="bg-gray-800 text-white py-8 mt-16">
        <div className="container mx-auto px-4 text-center">
          <p>&copy; 2025 UrbanFlow - Calamba City Traffic Prediction System</p>
          <p className="text-sm text-gray-400 mt-2">Thesis Project</p>
        </div>
      </footer>
    </div>
  );
}
