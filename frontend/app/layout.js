import 'leaflet/dist/leaflet.css'
import './globals.css'
import LoadingScreen from '@/components/LoadingScreen'
import { AuthProvider } from '@/context/AuthContext';

export const metadata = {
  title: 'UrbanFlow',
  description: 'Traffic Prediction Dashboard',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
        {/* Show loading screen while loading */}
          <LoadingScreen />
        {/* Main content */}
        {children}
        </AuthProvider>
      </body>
    </html>
  )
}
