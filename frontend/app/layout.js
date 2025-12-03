import 'leaflet/dist/leaflet.css'
import './globals.css'
import LoadingScreen from '@/components/LoadingScreen'
import { AuthProvider } from '@/context/AuthContext';

export const metadata = {
  title: "UrbanFlow",
  description: "Traffic disruption simulation and prediction",
  icons: {
    icon: '/URBANFLOW_logo.png', // or '/urbanflow-icon.png' depending on your file
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        {/* ✅ Add Leaflet CSS */}
        <link
          rel="stylesheet"
          href="https://unpkg.com/leaflet@1.7.1/dist/leaflet.css"
          integrity="sha512-xodZBNTC5n17Xt2atTPuE1HxjVMSvLVW9ocqUKLsCC5CXdbqCmblAshOMAS6/keqq/sMZMZ19scR4PsZChSR7A=="
          crossOrigin=""
        />
      </head>
      <body>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
