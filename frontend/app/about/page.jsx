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
                <span className="text-green-500 mt-1">✓</span>
                <span>Real-time traffic monitoring and visualization</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-green-500 mt-1">✓</span>
                <span>Machine learning-powered congestion predictions</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-green-500 mt-1">✓</span>
                <span>Disruption impact simulation for urban planners</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-green-500 mt-1">✓</span>
                <span>Historical traffic data analysis and reporting</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-green-500 mt-1">✓</span>
                <span>User-friendly interface for both citizens and officials</span>
              </li>
            </ul>
          </div>
        </div>
      </main>
    </div>
  )
}