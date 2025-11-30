"use client";

import Navbar from "@/components/NavBar"
import { useState } from "react";

// Small reusable component for LinkedIn person with robust image fallback
function LinkedInPerson({ name, href, imgSrc, initials }) {
  const [imgError, setImgError] = useState(false);
  const displayInitials = initials || name.split(' ').map(n => n[0]).slice(0,2).join('');
  return (
    <div className="flex items-center gap-3">
      {!imgError ? (
        <img
          src={imgSrc}
          alt={name}
          className="w-10 h-10 rounded-full object-cover border border-gray-200"
          onError={(e) => {
            setImgError(true);
            e.currentTarget.style.display = 'none';
          }}
        />
      ) : (
        <div className="w-10 h-10 rounded-full bg-gray-100 text-gray-700 flex items-center justify-center font-semibold text-sm">
          {displayInitials}
        </div>
      )}
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 text-gray-800 hover:text-blue-600 flex-1 min-w-0"
      >
        <span className="font-semibold truncate">{name}</span>
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="text-blue-600">
          <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11.75 20h-3v-10h3v10zm-1.5-11.3c-.966 0-1.75-.786-1.75-1.75s.784-1.75 1.75-1.75c.965 0 1.75.786 1.75 1.75s-.785 1.75-1.75 1.75zm13.25 11.3h-3v-5.5c0-1.314-.025-3-1.825-3-1.824 0-2.103 1.423-2.103 2.899v5.601h-3v-10h2.881v1.362h.041c.401-.763 1.381-1.562 2.845-1.562 3.042 0 3.603 2.001 3.603 4.601v5.599z"/>
        </svg>
      </a>
    </div>
  );
}

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

  function LinkedInPerson({ name, href, imgSrc, initials }) {
  const [imgError, setImgError] = useState(false);
  const displayInitials = initials || name.split(' ').map(n => n[0]).slice(0,2).join('');
  return (
    <div className="flex items-center gap-3">
      {!imgError ? (
        <img
          src={imgSrc}
          alt={name}
          className="w-10 h-10 rounded-full object-cover border border-gray-200"
          onError={(e) => {
            setImgError(true);
            e.currentTarget.style.display = 'none';
          }}
        />
      ) : (
        <div className="w-10 h-10 rounded-full bg-gray-100 text-gray-700 flex items-center justify-center font-semibold text-sm">
          {displayInitials}
        </div>
      )}
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 text-gray-800 hover:text-blue-600 flex-1 min-w-0"
      >
        <span className="font-semibold truncate">{name}</span>
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="text-blue-600">
          <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11.75 20h-3v-10h3v10zm-1.5-11.3c-.966 0-1.75-.786-1.75-1.75s.784-1.75 1.75-1.75c.965 0 1.75.786 1.75 1.75s-.785 1.75-1.75 1.75zm13.25 11.3h-3v-5.5c0-1.314-.025-3-1.825-3-1.824 0-2.103 1.423-2.103 2.899v5.601h-3v-10h2.881v1.362h.041c.401-.763 1.381-1.562 2.845-1.562 3.042 0 3.603 2.001 3.603 4.601v5.599z"/>
        </svg>
      </a>
    </div>
  );
}

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

      <main className="container mx-auto px-4 py-25">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl font-bold text-gray-800 mb-6">Contact Us</h1>

          <div className="grid md:grid-cols-2 gap-8 mb-8">
            {/* Contact Details */}
            <div className="bg-white rounded-lg shadow-md px-6 py-3">
              <h2 className="text-2xl font-bold text-gray-800 mb-3">
                Get in Touch
              </h2>
              <div className="space-y-3">
                <div className="flex items-start gap-4">
                  <div className="text-blue-600 text-2xl"></div>
                  <div>
                    <h3 className="font-semibold text-gray-800">Email</h3>
                    <p className="text-gray-600">urbanflow.service@gmail.com</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="text-blue-600 text-2xl"></div>
                  <div>
                    <h3 className="font-semibold text-gray-800">Address</h3>
                    <p className="text-gray-600">
                      Ipil-ipil Street
                      <br />
                      Bucal, Calamba Laguna
                      <br />
                      Philippines 4027
                    </p>
                  </div>
                </div>
              </div>
              {/* LinkedIn Section */}
                <div className="pt-3 border-t border-gray-100">
                  <h3 className="text-lg font-semibold text-gray-800 mb-3">LinkedIn</h3>
                  <div className="space-y-3">
                    <LinkedInPerson
                      name="Edzon Deveras"
                      href="https://www.linkedin.com/in/edzon-deveras-6b8a7b392"
                      imgSrc="/Edzon2.png"
                      initials="ED"
                    />

                    <LinkedInPerson
                      name="Fate Almario"
                      href="https://www.linkedin.com/in/fate-almario-239a23350"
                      imgSrc="/fate.jpg"
                      initials="FA"
                    />

                    <LinkedInPerson
                      name="Nazreen Villanueva"
                      href="https://www.linkedin.com/in/nzrnvllnv/"
                      imgSrc="/naz.jpg"
                      initials="NV"
                    />
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