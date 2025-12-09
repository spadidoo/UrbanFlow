"use client";

import { useEffect, useRef, useState } from "react";

const techItems = [
  { name: "Next.js", icon: "/icons/next-logo.svg" },
  { name: "React", icon: "/icons/react-logo.svg" },
  { name: "Tailwind CSS", icon: "/icons/tailwind-logo.svg" },
  { name: "Leaflet.js", icon: "/icons/leaflet-logo.svg" },
  { name: "OpenStreetMap", icon: "/icons/openstreetmap-logo.svg" },
  { name: "Python", icon: "/icons/python-logo.svg" },
  { name: "Flask", icon: "/icons/flask-logo.svg" },
  { name: "Pandas", icon: "/icons/pandas-logo.svg" },
  { name: "NumPy", icon: "/icons/numpy-logo.svg" },
  { name: "PostgreSQL", icon: "/icons/postgresql-logo.svg" },
];

export default function TechStackRowCarousel() {
  const containerRef = useRef(null);

  const [isInteracting, setIsInteracting] = useState(false);
  const [direction, setDirection] = useState(1); 
  // 1 = scroll right, -1 = scroll left
  // change to "LOOP" mode below if you want

  /** ------------------------
   * AUTO SCROLL (REVERSE MODE)
   * ------------------------ */
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    let frameId;

    const step = () => {
      if (!isInteracting) {
        const maxScroll = el.scrollWidth - el.clientWidth;

        // Auto-scroll speed
        el.scrollLeft += 0.8 * direction;

        // Reverse mode:
        if (el.scrollLeft <= 0) {
          setDirection(1); // go right
        } else if (el.scrollLeft >= maxScroll) {
          setDirection(-1); // go left
        }

        /** ---------------------
         * LOOP MODE (INSTEAD OF REVERSE)
         * Uncomment below & remove the reverse block above
         * ---------------------
         *
         * if (el.scrollLeft >= maxScroll) el.scrollLeft = 0;
         *
         ---------------------- */
      }

      frameId = requestAnimationFrame(step);
    };

    frameId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frameId);
  }, [isInteracting, direction]);

  /** ------------------------
   * CUSTOM WHEEL SCROLL
   * ------------------------ */
  const handleWheel = (e) => {
    const el = containerRef.current;
    if (!el) return;

    setIsInteracting(true);
    e.preventDefault();

    const scrollAmount = 220; // ~2 icons

    el.scrollBy({
      left: e.deltaY > 0 ? scrollAmount : -scrollAmount,
      behavior: "smooth",
    });

    setTimeout(() => setIsInteracting(false), 500);
  };

  /** Interaction handlers */
  const stopAuto = () => setIsInteracting(true);
  const resumeAuto = () => setTimeout(() => setIsInteracting(false), 500);

  return (
    <div className="bg-white rounded-lg shadow-md p-8 mb-8">
      <h2 className="text-2xl font-bold text-gray-800 mb-4">Technology Stack</h2>

      <div className="relative">
        {/* Fade left */}
        <div className="pointer-events-none absolute left-0 top-0 h-full w-16 
             bg-gradient-to-r from-white to-transparent" />

        {/* Fade right */}
        <div className="pointer-events-none absolute right-0 top-0 h-full w-16 
             bg-gradient-to-l from-white to-transparent" />

        {/* Scrollable icons */}
        <div
          ref={containerRef}
          onWheelCapture={handleWheel}
          onMouseEnter={stopAuto}
          onMouseLeave={resumeAuto}
          onTouchStart={stopAuto}
          onTouchEnd={resumeAuto}
          className="overflow-x-auto flex gap-10 py-3 scroll-smooth scrollbar-hide"
          style={{ overscrollBehavior: "contain" }}
        >
          {[...techItems, ...techItems].map((item, index) => (
            <div
              key={index}
              className="flex flex-col items-center min-w-[100px]"
            >
              <img src={item.icon} className="h-12" alt={item.name} />
              <p className="text-gray-600 text-sm mt-2">{item.name}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}