"use client"
import { useEffect, useState } from "react"

export default function LoadingScreen({ maxMs = 3000, minMs = 2000 }) {
  const [visible, setVisible] = useState(true)
  const [startTime] = useState(Date.now())

  useEffect(() => {
    const onLoad = () => {
      // Calculate how long the loading screen has been visible
      const elapsed = Date.now() - startTime
      const remaining = Math.max(0, minMs - elapsed)
      
      // Wait at least minMs before hiding, even if page loads faster
      setTimeout(() => setVisible(false), remaining)
    }
    
    if (typeof window !== "undefined") {
      if (document.readyState === 'complete') {
        onLoad()
      } else {
        window.addEventListener("load", onLoad)
      }
    }
    
    // Maximum timeout as fallback
    const maxTimeout = setTimeout(() => setVisible(false), maxMs)
    
    return () => {
      clearTimeout(maxTimeout)
      if (typeof window !== "undefined") {
        window.removeEventListener("load", onLoad)
      }
    }
  }, [maxMs, minMs, startTime])

  if (!visible) return null

  return (
    <div className="uf-loading-overlay" role="status" aria-label="Loading UrbanFlow">
      <div className="uf-logo-fill-wrap">
        {/* Greyscale background logo */}
        <img src="/URBANFLOW_logo.PNG" alt="UrbanFlow Grey" className="logo-grey" width="180" />

        <div className="logo-color-mask">
            {/* Color logo revealed with mask */}
            <img src="/URBANFLOW_logo.PNG" alt="UrbanFlow Color" className="logo-color" width="180" />
        </div>
      </div>
    </div>
  )
}
