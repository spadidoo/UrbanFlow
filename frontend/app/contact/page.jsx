import Navbar from '@/components/Navbar'

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      
      <main className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <h1 className="text-4xl font-bold text-gray-800 mb-6">
            Contact Us
          </h1>
          
          {/* Contact Info */}
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
                    <p className="text-gray-600">urbanflow@calamba.gov.ph</p>
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
                      Calamba City Hall<br />
                      Calamba, Laguna<br />
                      Philippines 4027
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="text-blue-600 text-2xl">⏰</div>
                  <div>
                    <h3 className="font-semibold text-gray-800">Office Hours</h3>
                    <p className="text-gray-600">
                      Monday - Friday: 8:00 AM - 5:00 PM<br />
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
              
              <form className="space-y-4">
                <div>
                  <label className="block text-gray-700 font-semibold mb-2">
                    Name
                  </label>
                  <input
                    type="text"
                    placeholder="Your name"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-gray-700 font-semibold mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    placeholder="your.email@example.com"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-gray-700 font-semibold mb-2">
                    Subject
                  </label>
                  <input
                    type="text"
                    placeholder="What is this about?"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-gray-700 font-semibold mb-2">
                    Message
                  </label>
                  <textarea
                    rows="4"
                    placeholder="Your message..."
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  ></textarea>
                </div>

                <button
                  type="submit"
                  className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition"
                >
                  Send Message
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
                  Our machine learning model is trained on historical data and achieves 
                  an accuracy rate of approximately 85-90% for short-term predictions.
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-gray-800 mb-2">
                  How can I report a traffic incident?
                </h3>
                <p className="text-gray-600">
                  Currently, only authorized urban planners can input disruption data. 
                  For incident reports, please contact the Calamba City Traffic Management Office.
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-gray-800 mb-2">
                  Is the system available 24/7?
                </h3>
                <p className="text-gray-600">
                  Yes! The UrbanFlow website and traffic map are accessible 24/7. 
                  However, administrative support is only available during office hours.
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-gray-800 mb-2">
                  Can other cities use UrbanFlow?
                </h3>
                <p className="text-gray-600">
                  UrbanFlow is specifically designed for Calamba City, but the system 
                  can be adapted for other cities with proper data integration and training.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-gray-800 text-white py-8 mt-16">
        <div className="container mx-auto px-4 text-center">
          <p>&copy; 2025 UrbanFlow - Calamba City Traffic Prediction System</p>
          <p className="text-sm text-gray-400 mt-2">Thesis Project</p>
        </div>
      </footer>
    </div>
  )
}