"use client"

import dynamic from 'next/dynamic'
import Navbar from '@/components/Navbar'

const HomeMapWithSidebar = dynamic(() => import('@/components/HomeMapWithSidebar'), { 
  ssr: false,
  loading: () => <div className="h-screen w-full bg-gray-200 flex items-center justify-center">Loading map...</div>
})

export default function HomePage() {
  return (
    <div className="h-screen w-full relative">
      {/* Navbar - Fixed on top, overlapping map */}
      <div className="absolute top-0 left-0 right-0 z-[1001]">
        <Navbar />
      </div>
      
      {/* Map - Full screen behind navbar */}
      <HomeMapWithSidebar />
    </div>
  )
}