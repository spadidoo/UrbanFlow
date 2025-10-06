import Navbar from '@/components/Navbar'

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      
      <main className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <h1 className="text-4xl font-bold text-gray-800 mb-6">
            About UrbanFlow
          </h1>
          
          {/* Introduction */}
          <div className="bg-white rounded-lg shadow-md p-8 mb-8">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">
              Traffic Prediction & Simulation System
            </h2>
            <p className="text-gray-600 leading-relaxed mb-4">
              UrbanFlow is a comprehensive traffic management system designed specifically 
              for Calamba City. Using advanced machine learning algorithms and real-time 
              data integration, we help citizens and urban planners make informed decisions 
              about traffic flow and congestion management.
            </p>
            <p className="text-gray-600 leading-relaxed">
              Our system combines historical traffic data, event-based disruptions, and 
              predictive modeling to forecast congestion hotspots before they occur, enabling 
              proactive traffic management strategies.
            </p>
          </div>

          {/* Features */}
          <div className="bg-white rounded-lg shadow-md p-8 mb-8">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">
              Key Features
            </h2>
            <ul className="space-y-3 text-gray-600">
              <li className="flex items-start gap-3">
                <span className="text-green-500 mt-1 text-xl">✓</span>
                <span>Real-time traffic monitoring and visualization</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-green-500 mt-1 text-xl">✓</span>
                <span>Machine learning-powered congestion predictions</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-green-500 mt-1 text-xl">✓</span>
                <span>Disruption impact simulation for urban planners</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-green-500 mt-1 text-xl">✓</span>
                <span>Historical traffic data analysis and reporting</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-green-500 mt-1 text-xl">✓</span>
                <span>Interactive maps with congestion heatmaps</span>
              </li>
            </ul>
          </div>

          {/* Technology */}
          <div className="bg-white rounded-lg shadow-md p-8 mb-8">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">
              Technology Stack
            </h2>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h3 className="font-semibold text-gray-800 mb-2">Frontend</h3>
                <ul className="text-gray-600 space-y-1">
                  <li>• Next.js & React</li>
                  <li>• Tailwind CSS</li>
                  <li>• Leaflet.js for maps</li>
                  <li>• OpenStreetMap</li>
                </ul>
              </div>
              <div>
                <h3 className="font-semibold text-gray-800 mb-2">Backend</h3>
                <ul className="text-gray-600 space-y-1">
                  <li>• Python & Flask</li>
                  <li>• Random Forest ML Model</li>
                  <li>• Pandas & NumPy</li>
                  <li>• SQLite Database</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Team */}
          <div className="bg-white rounded-lg shadow-md p-8">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">
              Our Mission
            </h2>
            <p className="text-gray-600 leading-relaxed">
              To provide Calamba City residents and urban planners with accurate, 
              data-driven insights that improve traffic flow, reduce congestion, 
              and enhance the overall quality of urban transportation.
            </p>
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