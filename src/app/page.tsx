// src/app/page.tsx
import Link from "next/link";
import { Building2, Calendar, UserCheck, Stethoscope, FileSpreadsheet, ShieldAlert, ChevronRight } from "lucide-react";

export default function HomePage() {
  const modules = [
    {
      title: "Client Onboarding & Packages",
      description: "Onboard corporate clients, agencies, and configure dynamic diagnostic service packages.",
      href: "/clients",
      icon: Building2,
      badge: "Day 2 Active",
      badgeColor: "bg-emerald-100 text-emerald-800",
    },
    {
      title: "Camp Check-In & Reception",
      description: "Sequential UHID allocation, WebRTC photo capture, and fast-track camp registration.",
      href: "/camps",
      icon: UserCheck,
      badge: "Upcoming",
      badgeColor: "bg-slate-100 text-slate-600",
    },
    {
      title: "Phlebotomy & Diagnostics",
      description: "Barcode tube linking, Lab results OCR, ECG, Chest X-Ray, Spirometry & Audiometry.",
      href: "/diagnostics",
      icon: Stethoscope,
      badge: "Upcoming",
      badgeColor: "bg-slate-100 text-slate-600",
    },
    {
      title: "MRD & Dossier Exports",
      description: "Client-wise Excel downloads and automated hierarchical [Client]/[Agency] ZIP packaging.",
      href: "/mrd",
      icon: FileSpreadsheet,
      badge: "Upcoming",
      badgeColor: "bg-slate-100 text-slate-600",
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 p-8 md:p-12">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Header */}
        <div className="border-b border-slate-200 pb-6">
          <div className="inline-flex items-center space-x-2 bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider mb-2">
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Occupational Health Checkup OS</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">
            Medical Camp Operations Management
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Enterprise system for corporate medical screening camps, sequential UHID generation, and multi-tier client archival.
          </p>
        </div>

        {/* Modules Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {modules.map((m) => {
            const Icon = m.icon;
            return (
              <Link
                key={m.title}
                href={m.href}
                className="group bg-white p-6 rounded-xl border border-slate-200 hover:border-indigo-500 hover:shadow-md transition block"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition">
                    <Icon className="w-5 h-5" />
                  </div>
                  <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${m.badgeColor}`}>
                    {m.badge}
                  </span>
                </div>
                <h3 className="text-lg font-semibold text-slate-800 group-hover:text-indigo-600 transition flex items-center">
                  <span>{m.title}</span>
                  <ChevronRight className="w-4 h-4 ml-1 opacity-0 group-hover:opacity-100 transition-transform group-hover:translate-x-1" />
                </h3>
                <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                  {m.description}
                </p>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}