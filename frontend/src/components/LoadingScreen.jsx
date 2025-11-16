"use client"
import { useEffect, useState } from "react"

export default function LoadingScreen({ maxMs = 2000 }) {
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const onLoad = () => setVisible(false)
    if (typeof window !== "undefined") {
      window.addEventListener("load", onLoad)
    }
    const t = setTimeout(() => setVisible(false), maxMs)
    return () => {
      clearTimeout(t)
      if (typeof window !== "undefined") {
        window.removeEventListener("load", onLoad)
      }
    }
  }, [maxMs])

  if (!visible) return null

  return (
    <div className="uf-loading-overlay" role="status" aria-label="Loading UrbanFlow">
      <div className="uf-logo-fill-wrap">
        {/* Greyscale background logo */}
        <img src="/URBANFLOW_logo.png" alt="UrbanFlow Grey" className="logo-grey" width="180" />

        <div className="logo-color-mask">
            {/* Color logo revealed with mask */}
            <img src="/URBANFLOW_logo.png" alt="UrbanFlow Color" className="logo-color" width="180" />
        </div>
      </div>
    </div>
  )
}
