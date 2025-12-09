"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Navbar() {
  const pathname = usePathname();
  const isActive = (path) => pathname === path;

  return (
    <nav
      style={{ backgroundColor: "rgba(0,0,0,0)" }}
      className="fixed top-0 left-0 w-full text-white shadow-lg backdrop-blur-sm z-[1001]"
    >
      <div className="px-4">
        <div className="flex justify-between items-center h-12 md:h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center space-x-1">
            <img
              src="/DupURBANFLOW.png"
              alt="UrbanFlow"
              className="h-8 w-auto md:h-10 p"
            />
            <span className="text-base md:text-xl font-bold text-[#757575]">UrbanFlow</span>
          </Link>

          {/* Navigation Links */}
          <div className="flex items-center space-x-3 md:space-x-6 text-sm md:text-base">
            <Link
              href="/"
              className={`text-[#474747]  hover:text-[#EC9706] transition ${
                isActive("/") ? "border-b-2 border-white pb-0.8" : ""
              }`}
            >
              Home
            </Link>
            <Link
              href="/about"
              className={`text-[#474747] hover:text-[#EC9706] transition ${
                isActive("/about") ? "border-b-2 border-white pb-0.8" : ""
              }`}
            >
              About
            </Link>
            <Link
              href="/contact"
              className={`text-[#474747] hover:text-[#EC9706] transition ${
                isActive("/contact") ? "border-b-2 border-white pb-0.8" : ""
              }`}
            >
              Contact
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}
