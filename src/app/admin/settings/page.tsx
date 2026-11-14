// src/app/admin/settings/page.tsx
"use client";

import React, { useState, useEffect } from "react";
import { getSystemSetting, saveSystemSetting } from "@/actions/admin-actions";
import { Printer, Check } from "lucide-react";

interface PrintBrandingData {
  centerName?: string;
  registrationNo?: string;
  form32Title?: string;
  cardHeader?: string;
}

export default function AdminSettingsPage() {
  const [centerName, setCenterName] = useState("Aarogya Occupational Health Center");
  const [registrationNo, setRegistrationNo] = useState("OHC-GJ-2026-9941");
  const [form32Title, setForm32Title] = useState("CERTIFICATE OF MEDICAL FITNESS (FORM 32 / 35)");
  const [cardHeader, setCardHeader] = useState("OCCUPATIONAL HEALTH MEDICAL PASS");
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function load() {
      // Type cast the JSON setting to resolve the TypeScript error
      const data = (await getSystemSetting("print_branding")) as PrintBrandingData | null;
      if (data) {
        setCenterName(data.centerName || "");
        setRegistrationNo(data.registrationNo || "");
        setForm32Title(data.form32Title || "");
        setCardHeader(data.cardHeader || "");
      }
    }
    load();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    const res = await saveSystemSetting("print_branding", {
      centerName,
      registrationNo,
      form32Title,
      cardHeader,
    });
    setIsSaving(false);
    if (res.success) {
      setMessage("Branding & Print settings saved successfully!");
    }
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <div className="border-b border-slate-800 pb-5">
        <h1 className="text-2xl font-bold text-white tracking-tight">Print Layout & Center Branding</h1>
        <p className="text-xs text-slate-400 mt-1">
          Configure statutory certificate headers, medical council registration, and ID card headers.
        </p>
      </div>

      {message && (
        <div className="bg-emerald-950/60 border border-emerald-800 text-emerald-300 px-4 py-2.5 rounded-lg text-xs font-semibold flex items-center space-x-2">
          <Check className="w-4 h-4 text-emerald-400" />
          <span>{message}</span>
        </div>
      )}

      <form onSubmit={handleSave} className="bg-slate-950 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
        <div className="space-y-4">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider">1. Medical Center Information</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Center / Hospital Name</label>
              <input
                type="text"
                value={centerName}
                onChange={(e) => setCenterName(e.target.value)}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Center License / Registration No</label>
              <input
                type="text"
                value={registrationNo}
                onChange={(e) => setRegistrationNo(e.target.value)}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white font-mono"
              />
            </div>
          </div>
        </div>

        <div className="space-y-4 pt-4 border-t border-slate-800/80">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider">2. Document & Card Headers</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Statutory Certificate Title</label>
              <input
                type="text"
                value={form32Title}
                onChange={(e) => setForm32Title(e.target.value)}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">CR80 ID Card Header</label>
              <input
                type="text"
                value={cardHeader}
                onChange={(e) => setCardHeader(e.target.value)}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white"
              />
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={isSaving}
          className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-lg shadow-sm transition"
        >
          {isSaving ? "Saving Settings..." : "Save Branding & Print Settings"}
        </button>
      </form>
    </div>
  );
}