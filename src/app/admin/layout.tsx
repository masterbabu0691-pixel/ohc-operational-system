// src/app/admin/layout.tsx
"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  LayoutDashboard, 
  Building2, 
  FileEdit, 
  ClipboardList, 
  HeartPulse,
  Droplet, 
  Stethoscope, 
  Microscope, 
  FileText, 
  Heart, 
  Activity, 
  Headphones, 
  CheckSquare, 
  TrendingUp, 
  LogOut 
} from "lucide-react";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const routineItems = [
    { title: "Dashboard Home", href: "/admin", icon: LayoutDashboard },
    { title: "Client Manager", href: "/clients", icon: Building2 },
    { title: "Pre-Registration", href: "/camps", icon: FileEdit },
    { title: "Reception Desk", href: "/reception", icon: ClipboardList },
    { title: "Nurse Station", href: "/nurse", icon: HeartPulse, color: "text-pink-400" }, // Added from upper bar
    { title: "Phlebotomy Queue", href: "/phlebotomy", icon: Droplet, color: "text-red-400" },
    { title: "Doctor Queue", href: "/doctor/field", icon: Stethoscope, color: "text-emerald-400" },
    { title: "Laboratory Queue", href: "/diagnostics?station=PATHOLOGY_LAB", icon: Microscope, color: "text-blue-400" },
    { title: "X-Ray Desk", href: "/diagnostics?station=CHEST_XRAY", icon: FileText, color: "text-cyan-400" },
    { title: "ECG Desk", href: "/diagnostics?station=ECG", icon: Heart, color: "text-rose-400" },
    { title: "PFT Desk", href: "/diagnostics?station=SPIROMETRY_PFT", icon: Activity, color: "text-red-400" },
    { title: "Audiometry Desk", href: "/diagnostics?station=AUDIOMETRY", icon: Headphones, color: "text-indigo-400" },
    { title: "Review & Sign-Off", href: "/doctor/office", icon: CheckSquare, color: "text-slate-300" },
    { title: "Client Reports (MRD)", href: "/mrd", icon: TrendingUp, color: "text-rose-400" },
  ];

  return (
    <div className="h-screen w-screen bg-[#F8FAFC] flex flex-col md:flex-row antialiased font-sans overflow-hidden">
      {/* Dark Navy Routine Sidebar */}
      <aside className="w-full md:w-56 bg-[#001e38] text-white p-3.5 flex flex-col justify-between shrink-0 select-none shadow-xl h-full">
        <div className="space-y-3 flex-1 flex flex-col min-h-0">
          {/* Brand Header */}
          <div className="px-2 pt-1 pb-1 shrink-0">
            <h1 className="text-xl font-black tracking-tight text-white leading-none">Vyora</h1>
            <p className="text-[9px] font-bold text-teal-400 tracking-wider mt-0.5 uppercase">CAMP SYSTEM</p>
            
            <div className="mt-2">
              <span className="inline-block px-2 py-0.5 rounded text-[9px] font-bold bg-[#005f5f] text-teal-200 uppercase tracking-wider">
                ROLE: SUPER_ADMIN
              </span>
            </div>
          </div>

          {/* Routine Workstation Links */}
          <nav className="space-y-0.5 overflow-y-auto flex-1 pr-1">
            {routineItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href || (item.href.includes("?") && pathname === item.href.split("?")[0]);
              return (
                <Link
                  key={item.title}
                  href={item.href}
                  className={`flex items-center space-x-2.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                    isActive
                      ? "bg-[#008C8C] text-white font-bold shadow-xs"
                      : "text-slate-300 hover:text-white hover:bg-[#002f52]"
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 shrink-0 ${item.color || "text-slate-300"}`} />
                  <span className="truncate text-[11px]">{item.title}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* User Info & Logout */}
        <div className="pt-2 border-t border-slate-800/80 px-2 space-y-1 shrink-0">
          <div className="text-[11px] font-bold text-slate-300 truncate">DR Ankit Patel</div>
          <Link
            href="/login"
            className="flex items-center space-x-1.5 text-[11px] font-bold text-rose-400 hover:text-rose-300 transition"
          >
            <LogOut className="w-3 h-3" />
            <span>Log Out</span>
          </Link>
        </div>
      </aside>

      {/* Main Single-Viewport Canvas */}
      <main className="flex-1 p-4 md:p-6 h-full overflow-hidden flex flex-col justify-between bg-white">
        {children}
      </main>
    </div>
  );
}