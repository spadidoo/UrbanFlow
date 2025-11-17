"use client"

import { useState } from "react"
import dynamic from "next/dynamic"
import Navbar from "@/components/NavBar"

const RawMap = dynamic(() => import("@/components/RawMap"), { 
    ssr: false,
    loading: () => <div className="h-screen w-full bg-gray-200 flex items-center justify-center">Loading map...</div>
})

export default function MapPage() {
    return (
        <div className="h-screen w-full">
            {/* Navbar at the top */}
            <div className="fixed top-0 left-0 right-0 z-[1001]">
                <Navbar />
            </div>
            <div className="h-full w-full">
                <RawMap />
            </div>
        </div>
    )
}
