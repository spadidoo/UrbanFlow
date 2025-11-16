"use client"  // ✅ Add this at the very top

import { AuthProvider } from '@/contexts/AuthContext'
import 'leaflet/dist/leaflet.css'
import './globals.css'

// Remove or comment out metadata since it's not allowed in client components
// export const metadata = { ... }

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  )
}