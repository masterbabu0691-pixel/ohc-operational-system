// Last Updated: 21-11-2026 16:52 IST
// src/app/admin/page.tsx
"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { getCampMonitorMetrics } from "@/actions/admin-actions";
import { getLabMismatchAlerts } from "@/actions/diagnostic-actions";
import {
  Settings,
  Sliders,
  Users,
  Printer,
  X,
  ArrowRight,
  AlertTriangle,
} from "lucide-react";

export default function CampMonitorDashboardPage() {
  const [selectedClientId, setSelectedClientId] = useState<string>("all");
  const [selectedCampId, setSelectedCampId] = useState<string>("all");
  const [data, setData] = useState<any | null>(null);
  const [mismatchAlerts, setMismatchAlerts] = useState<any[]>([]);
  const [showCmsModal, setShowCmsModal] = useState<boolean>(false);

  const loadMetrics = async () => {
    const [res, alerts] = await Promise.all([
      getCampMonitorMetrics(selectedClientId, selectedCampId),
      getLabMismatchAlerts(selectedCampId),
    ]);
    setData(res);
    setMismatchAlerts(alerts || []);
  };

  useEffect(() => {
    loadMetrics();
  }, [selectedClientId, selectedCampId]);

  const handleClientChange = (newClientId: string) => {
    setSelectedClientId(newClientId);
    setSelectedCampId("all");
  };

  const pipeline = data?.pipeline || {
    totalClients: 0,
    totalRoster: 0,
    preRegistered: 0,
    receptionDone: 0,
    nurseDone: 0,
    phleboDone: 0,
    doctorDone: 0,
    labDone: 0,
  };

  const diagnostics = data?.diagnostics || {
    xray: { isContracted: true, pending: 0, arrived: 0, done: 0 },
    ecg: { isContracted: true, pending: 0, arrived: 0, done: 0 },
    pft: { isContracted: true, pending: 0, arrived: 0, done: 0 },
    audiometry: { isContracted: true, pending: 0, arrived: 0, done: 0 },
  };

  const availableCamps =
    data?.camps?.filter((c: any) =>
      selectedClientId === "all" ? true : c.clientId === selectedClientId
    ) || [];

  const activeClientName = data?.clients?.find((c: any) => c.id === selectedClientId)?.name;

  return (
    <div className="h-full flex flex-col justify-between space-y-4 select-none max-w-7xl mx-auto w-full overflow-hidden">
      {/* 1. TOP HEADER & CLIENT-WISE TRACKING SELECTOR */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
        <div>
          <h1 className="text-xl md:text-2xl font-black text-[#002642] tracking-tight">
            Camp Monitor Dashboard
          </h1>
          <p className="text-[11px] text-slate-500 font-medium">
            Scope:{" "}
            <strong className="text-teal-700">
              {selectedClientId === "all" ? "All Corporate Clients" : activeClientName}
            </strong>
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={() => setShowCmsModal(true)}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-[#001e38] hover:bg-[#002d54] text-white rounded-lg text-xs font-bold shadow-xs transition shrink-0"
          >
            <Settings className="w-3.5 h-3.5 text-teal-300" />
            <span>Settings & CMS</span>
          </button>

          <div className="bg-white border-2 border-slate-300 rounded-lg px-2.5 py-1 shadow-xs">
            <label className="block text-[8px] font-bold text-slate-400 uppercase tracking-wider">CLIENT</label>
            <select
              value={selectedClientId}
              onChange={(e) => handleClientChange(e.target.value)}
              className="bg-transparent font-bold text-[11px] text-[#002642] outline-none cursor-pointer max-w-[130px] truncate"
            >
              <option value="all">All Clients (Mixed)</option>
              {data?.clients?.map((cl: any) => (
                <option key={cl.id} value={cl.id}>
                  {cl.name} ({cl.code})
                </option>
              ))}
            </select>
          </div>

          <div className="bg-white border-2 border-teal-600 rounded-lg px-2.5 py-1 shadow-xs">
            <label className="block text-[8px] font-bold text-teal-700 uppercase tracking-wider">CAMP</label>
            <select
              value={selectedCampId}
              onChange={(e) => setSelectedCampId(e.target.value)}
              className="bg-transparent font-bold text-[11px] text-[#002642] outline-none cursor-pointer max-w-[160px] truncate"
            >
              <option value="all">All Camps for Client</option>
              {availableCamps.map((c: any) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Lab PDF Identity Mismatch Alert Strip */}
      {mismatchAlerts.length > 0 && (
        <Link
          href="/lab"
          className="px-3 py-2 bg-rose-50 border border-rose-300 rounded-xl text-xs font-bold text-rose-800 flex items-center justify-between shrink-0 hover:bg-rose-100 transition"
        >
          <span className="flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>
              LAB OCR IDENTITY MISMATCH: {mismatchAlerts.length} employee report(s) flagged ({mismatchAlerts[0].employeeName} — {mismatchAlerts[0].uhid})
            </span>
          </span>
          <span className="underline text-[11px]">Review in Lab Queue →</span>
        </Link>
      )}

      {/* 2. CORE CLINICAL PIPELINE (7 Cards) */}
      <div className="space-y-2 shrink-0">
        <h2 className="text-xs font-black text-[#002642] tracking-wider uppercase border-b border-slate-100 pb-1">
          CORE CLINICAL PIPELINE {selectedClientId !== "all" && `• ${activeClientName}`} (Roster: {pipeline.totalRoster})
        </h2>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
          <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-xs">
            <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider">TOTAL CLIENT</span>
            <span className="block text-xl font-black text-[#002642] font-mono mt-0.5">{pipeline.totalClients}</span>
          </div>
          <div className="bg-white border border-slate-200 border-l-4 border-l-cyan-500 rounded-xl p-3 shadow-xs">
            <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider">PRE-REGISTERED</span>
            <span className="block text-xl font-black text-cyan-600 font-mono mt-0.5">{pipeline.preRegistered}</span>
          </div>
          <div className="bg-white border border-slate-200 border-l-4 border-l-teal-500 rounded-xl p-3 shadow-xs">
            <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider">RECEPTION</span>
            <span className="block text-xl font-black text-teal-600 font-mono mt-0.5">{pipeline.receptionDone}</span>
          </div>
          <div className="bg-white border border-slate-200 border-l-4 border-l-indigo-500 rounded-xl p-3 shadow-xs">
            <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider">NURSE</span>
            <span className="block text-xl font-black text-indigo-600 font-mono mt-0.5">{pipeline.nurseDone}</span>
          </div>
          <div className="bg-white border border-slate-200 border-l-4 border-l-rose-500 rounded-xl p-3 shadow-xs">
            <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider">PHLEBO</span>
            <span className="block text-xl font-black text-rose-600 font-mono mt-0.5">{pipeline.phleboDone}</span>
          </div>
          <div className="bg-white border border-slate-200 border-l-4 border-l-amber-500 rounded-xl p-3 shadow-xs">
            <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider">DOCTOR</span>
            <span className="block text-xl font-black text-amber-600 font-mono mt-0.5">{pipeline.doctorDone}</span>
          </div>
          <div className="bg-white border border-slate-200 border-l-4 border-l-emerald-500 rounded-xl p-3 shadow-xs">
            <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider">LABORATORY</span>
            <span className="block text-xl font-black text-emerald-600 font-mono mt-0.5">{pipeline.labDone}</span>
          </div>
        </div>
      </div>

      {/* 3. DIAGNOSTIC STATIONS REAL-TIME MONITOR */}
      <div className="space-y-2 shrink-0">
        <h2 className="text-xs font-black text-[#002642] tracking-wider uppercase border-b border-slate-100 pb-1">
          DIAGNOSTIC STATIONS REAL-TIME MONITOR
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { key: "xray", label: "X-RAY STATION", icon: "🩻", d: diagnostics.xray },
            { key: "ecg", label: "ECG STATION", icon: "❤️", d: diagnostics.ecg },
            { key: "pft", label: "PFT STATION", icon: "🫁", d: diagnostics.pft },
            { key: "audiometry", label: "AUDIOMETRY", icon: "🎧", d: diagnostics.audiometry },
          ].map((item) => (
            <div
              key={item.key}
              className={`border rounded-xl shadow-xs overflow-hidden ${
                item.d.isContracted ? "bg-white border-slate-200" : "bg-slate-50 border-dashed border-rose-300 opacity-75"
              }`}
            >
              <div className="p-2 border-b border-slate-100 flex items-center justify-center space-x-1.5 text-xs font-bold text-slate-800">
                <span>{item.icon}</span>
                <span>{item.label}</span>
                {!item.d.isContracted && <span className="text-[9px] font-black text-rose-600 ml-1">(N/A)</span>}
              </div>
              {item.d.isContracted ? (
                <div className="grid grid-cols-3 divide-x divide-slate-100 p-2 text-center">
                  <div>
                    <span className="block text-[8px] font-bold text-slate-400 uppercase">PENDING</span>
                    <span className="block text-sm font-bold text-amber-500">{item.d.pending}</span>
                  </div>
                  <div>
                    <span className="block text-[8px] font-bold text-slate-400 uppercase">ARRIVED</span>
                    <span className="block text-sm font-bold text-blue-500">{item.d.arrived}</span>
                  </div>
                  <div>
                    <span className="block text-[8px] font-bold text-slate-400 uppercase">DONE</span>
                    <span className="block text-sm font-bold text-emerald-500">{item.d.done}</span>
                  </div>
                </div>
              ) : (
                <div className="p-3 text-center text-[11px] font-bold text-rose-600">Not in Client Package (N/A)</div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 4. QUICK ACCESS BUTTONS */}
      <div className="space-y-2 shrink-0">
        <h2 className="text-xs font-black text-[#002642] tracking-wider uppercase border-b border-slate-100 pb-1">
          QUICK ACCESS
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <Link href="/reception" className="w-full py-2.5 bg-[#001e38] hover:bg-[#002d54] text-white rounded-xl text-xs font-bold text-center shadow-xs transition">
            Reception Desk
          </Link>
          <Link href="/phlebotomy" className="w-full py-2.5 bg-[#ffebee] hover:bg-[#ffd6dc] text-[#d32f2f] rounded-xl text-xs font-bold text-center shadow-xs transition">
            Phlebotomy Lab
          </Link>
          <Link href="/doctor/field" className="w-full py-2.5 bg-[#fff8e1] hover:bg-[#ffecb3] text-[#f57f17] rounded-xl text-xs font-bold text-center shadow-xs transition">
            Doctor Desk
          </Link>
          <Link href="/doctor/office" className="w-full py-2.5 bg-[#f3e5f5] hover:bg-[#e1bee7] text-[#7b1fa2] rounded-xl text-xs font-bold text-center shadow-xs transition">
            Final Sign-Off
          </Link>
        </div>
      </div>

      {/* 5. CMS MODAL */}
      {showCmsModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-lg bg-teal-50 flex items-center justify-center text-teal-700 font-bold">
                  <Settings className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-[#002642]">Admin CMS & Controls</h3>
                  <p className="text-[11px] text-slate-400">Configure tests, OCR aliases, staff roles, and print settings.</p>
                </div>
              </div>
              <button type="button" onClick={() => setShowCmsModal(false)} className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Link href="/admin/services" className="group border border-slate-200 hover:border-teal-500 rounded-xl p-3 bg-slate-50 hover:bg-white transition block space-y-1">
                <Sliders className="w-4 h-4 text-teal-600" />
                <div className="font-bold text-xs text-[#002642] group-hover:text-teal-600 flex items-center justify-between">
                  <span>Tests & OCR CMS</span>
                  <ArrowRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition" />
                </div>
                <p className="text-[10px] text-slate-500 leading-tight">Add tests and lab OCR aliases.</p>
              </Link>

              <Link href="/admin/users" className="group border border-slate-200 hover:border-indigo-500 rounded-xl p-3 bg-slate-50 hover:bg-white transition block space-y-1">
                <Users className="w-4 h-4 text-indigo-600" />
                <div className="font-bold text-xs text-[#002642] group-hover:text-indigo-600 flex items-center justify-between">
                  <span>Staff & Attendance</span>
                  <ArrowRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition" />
                </div>
                <p className="text-[10px] text-slate-500 leading-tight">Staff docs, attendance & logs.</p>
              </Link>

              <Link href="/admin/settings" className="group border border-slate-200 hover:border-amber-500 rounded-xl p-3 bg-slate-50 hover:bg-white transition block space-y-1">
                <Printer className="w-4 h-4 text-amber-600" />
                <div className="font-bold text-xs text-[#002642] group-hover:text-amber-600 flex items-center justify-between">
                  <span>Print Layout</span>
                  <ArrowRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition" />
                </div>
                <p className="text-[10px] text-slate-500 leading-tight">Form 32 headers and branding.</p>
              </Link>
            </div>

            <div className="flex justify-end pt-1">
              <button type="button" onClick={() => setShowCmsModal(false)} className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition">
                Close Settings
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}