"use client"

import dynamic from "next/dynamic"
import PlannerNavbar from "@/components/PlannerNavBar"

const RawMap = dynamic(() => import("@/components/RawMap"), { 
    ssr: false,
    loading: () => <div className="h-screen w-full bg-gray-200 flex items-center justify-center">Loading map...</div>
})

export default function MapPage() {
    return (
        <div className="h-screen w-full">
            {/* Navbar at the top */}
            <div className="fixed top-0 left-0 right-0 z-[1001]">
                <PlannerNavbar />
            </div>
            <div className="h-full w-full">
                <RawMap />
            </div>
        </div>
    )
}
