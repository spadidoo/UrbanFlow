"use client"
import Navbar from '@/components/Navbar'
import 'leaflet/dist/leaflet.css'; // ✅ Add this
import dynamic from 'next/dynamic'

const HomeMapWithSidebar = dynamic(() => import('@/components/HomeMapWithSidebar.jsx'), {
  ssr: false,
  loading: () => <div className="h-screen w-full bg-gray-200 flex items-center justify-center">Loading map...</div>
})

export default function HomePage() {
  return (
    <div className="h-screen w-full relative">
      <div className="absolute top-0 left-0 right-0 z-[1001]">
        <Navbar />
      </div>
      <HomeMapWithSidebar />
    </div>
  )
}