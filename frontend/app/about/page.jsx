import Navbar from "@/components/NavBar"
import TechStackCarousel from "@/components/TechStackCarousel";


export default function AboutPage() {
  return (
    <div className="min-h-screen bg-gray-50 overflow-y-auto0">
      <Navbar />
      
      <main className="container mx-auto px-4 pt-16 md:pt-25 pb-8">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
         {/* Header */}
          <h1 className="text-2xl md:text-4xl font-bold text-gray-800 mb-4 md:mb-6">
            About UrbanFlow
          </h1>
          
          {/* Introduction */}
          <div className="bg-white rounded-lg shadow-md p-4 md:p-8 mb-4 md:mb-8">
            <h2 className="text-xl md:text-2xl font-bold text-gray-800 mb-3 md:mb-4">
              Traffic Prediction & Simulation System
            </h2>
            <p className="text-sm md:text-base text-gray-600 leading-relaxed mb-3 md:mb-4">

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
          <div className="bg-white rounded-lg shadow-md p-4 md:p-8 mb-4 md:mb-8">
            <h2 className="text-xl md:text-2xl font-bold text-gray-800 mb-3 md:mb-4">
              Key Features
            </h2>
            <ul className="space-y-2 md:space-y-3 text-sm md:text-base text-gray-600">
             <li className="flex items-start gap-2 md:gap-3">
                <span className="text-blue-500 mt-0.5 md:mt-1 text-lg md:text-xl">✓</span>
                <span>Real-time traffic monitoring and visualization</span>
              </li>
              <li className="flex items-start gap-2 md:gap-3">
                <span className="text-blue-500 mt-0.5 md:mt-1 text-lg md:text-xl">✓</span>
                <span>Machine learning-powered congestion predictions</span>
              </li>
              <li className="flex items-start gap-2 md:gap-3">
                <span className="text-blue-500 mt-0.5 md:mt-1 text-lg md:text-xl">✓</span>
                <span>Disruption impact simulation for urban planners</span>
              </li>
              <li className="flex items-start gap-2 md:gap-3">
                <span className="text-blue-500 mt-0.5 md:mt-1 text-lg md:text-xl">✓</span>
                <span>Historical traffic data analysis and reporting</span>
              </li>
              <li className="flex items-start gap-2 md:gap-3">
                <span className="text-blue-500 mt-0.5 md:mt-1 text-lg md:text-xl">✓</span>
                <span>Interactive maps with congestion mapping</span>
              </li>
            </ul>
          </div>

          {/* Technology */}
        <TechStackCarousel />


          {/* Team */}
          <div className="bg-white rounded-lg shadow-md p-8">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">
              Our Mission
            </h2>
            <p className="text-gray-600 leading-relaxed">
              Our mission is to empower cities with data-driven tools delivering  accessible traffic information that
              enables smoother coordination, informed decision-making, and better travels for everyone.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-[#303030] text-white py-8 mt-16 rounded-t-3xl">
        <div className="container mx-auto px-4 text-center">
          <p>&copy; 2025 UrbanFlow - Calamba City Traffic Prediction and Simulation System</p>
          <p className="text-sm text-gray-400 mt-2">CS 1</p>
        </div>
      </footer>
    </div>
  )
}