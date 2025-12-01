// frontend/components/LogoHeader.jsx
"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export default function LogoHeader({ className = "" }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);

  // Close when clicking outside
  useEffect(() => {
    const onDoc = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target))
        setOpen(false);
    };
    document.addEventListener("pointerdown", onDoc);
    return () => document.removeEventListener("pointerdown", onDoc);
  }, []);

  // Keyboard: close on Escape
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const handleNavigate = (href) => {
    setOpen(false);
    // small delay to allow animation if desired
    router.push(href);
  };

  return (
    <header className={`relative z-[1200] ${className}`}>
      <div className="container mx-auto px-4 h-20 flex items-center">
        {/* Logo only — clickable; container keeps alignment with page content */}
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            aria-expanded={open}
            aria-label="Open menu"
            onClick={() => setOpen((v) => !v)}
            className="group flex items-center gap-2 p-1 rounded-lg hover:outline-none hover:ring-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400"
            title="Menu"
          >
            <img
              src="/URBANFLOW_logo.png"
              alt="UrbanFlow"
              className="w-28 h-auto transform -translate-x-10 translate-y-3 transition-transform duration-200 group-hover:-translate-x-6"
            />
          </button>

          {/* Floating tabs (staggered animated pills) */}
          <div className="absolute left-0 top-full mt-0 w-50 pointer-events-none">
            <div className="relative h-0">
              {/* Each tab is positioned absolutely and animated with scale/translate/opacity */}
              {[
                { key: "home", label: "Home Map", href: "/" },
                { key: "support", label: "Support", href: "/support" },
                { key: "about", label: "About", href: "/about" },
              ].map((item, idx) => {
                const delay = `${idx * 80}ms`;
                // keep the first tab close to the logo, but space subsequent tabs more
                const base = 18; // distance for the first tab
                const step = 50; // increased gap between tabs
                const topPos = open ? `${base + idx * step}px` : `0px`;
                return (
                  <button
                    key={item.key}
                    onClick={() => handleNavigate(item.href)}
                    aria-hidden={!open}
                    style={{
                      transitionDelay: open ? delay : "0ms",
                      transitionProperty: "top, opacity, box-shadow, transform",
                      top: topPos,
                    }}
                    className={`absolute left-0 top-0 w-44 text-left px-4 py-2 rounded-2xl bg-white/30 backdrop-blur-md border border-white/10 shadow-md transform transition duration-300 ease-out ${
                      open
                        ? "opacity-100 pointer-events-auto hover:scale-105 hover:bg-white/80 hover:shadow-xl hover:-translate-x-2"
                        : "opacity-0 pointer-events-none"
                    }`}
                  >
                    <span className="text-sm font-semibold text-black">
                      {item.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
