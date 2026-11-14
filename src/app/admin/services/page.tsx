// src/app/admin/services/page.tsx
"use client";

import React, { useState, useEffect } from "react";
import { getAdminServices, createOrUpdateService } from "@/actions/admin-actions";
import { Sliders, Plus, Check, ShieldCheck, Tag } from "lucide-react";

export default function AdminServicesPage() {
  const [services, setServices] = useState<any[]>([]);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [station, setStation] = useState<any>("PATHOLOGY_LAB");
  const [fieldsInput, setFieldsInput] = useState("parameter_1, parameter_2, normal_range");
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");

  const load = async () => {
    const list = await getAdminServices();
    setServices(list);
  };

  useEffect(() => {
    load();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code || !name) {
      alert("Please provide test code and name.");
      return;
    }

    setIsSaving(true);
    const fieldsArray = fieldsInput.split(",").map((f) => f.trim()).filter(Boolean);

    const res = await createOrUpdateService({
      code,
      name,
      station,
      fields: fieldsArray,
      isActive: true,
    });

    setIsSaving(false);

    if (res.success) {
      setMessage(`Service "${name}" saved! It will now appear dynamically in Client Onboarding.`);
      setCode("");
      setName("");
      load();
    } else {
      alert("Error: " + res.error);
    }
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      <div className="border-b border-slate-800 pb-5">
        <h1 className="text-2xl font-bold text-white tracking-tight">Diagnostic & Lab Tests Catalog (CMS)</h1>
        <p className="text-xs text-slate-400 mt-1">
          Add or edit any test dynamically. Newly added tests automatically appear in the Client Onboarding packages without code updates.
        </p>
      </div>

      {message && (
        <div className="bg-emerald-950/60 border border-emerald-800 text-emerald-300 px-4 py-2.5 rounded-lg text-xs font-semibold flex items-center space-x-2">
          <Check className="w-4 h-4 text-emerald-400" />
          <span>{message}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Form: Add or Edit Test */}
        <form onSubmit={handleSave} className="bg-slate-950 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center space-x-2">
            <Plus className="w-4 h-4 text-indigo-400" />
            <span>Add / Modify Test</span>
          </h2>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Unique Test Code *</label>
            <input
              type="text"
              placeholder="e.g. SRV_LIPID, SRV_DRUG_SCREEN"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs font-mono uppercase text-white focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Test Display Name *</label>
            <input
              type="text"
              placeholder="e.g. Lipid Profile / Heavy Metals"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Associated Station *</label>
            <select
              value={station}
              onChange={(e) => setStation(e.target.value)}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-indigo-500"
            >
              <option value="PATHOLOGY_LAB">Pathology Laboratory</option>
              <option value="CHEST_XRAY">Radiology (X-Ray)</option>
              <option value="ECG">Cardiology (ECG)</option>
              <option value="SPIROMETRY_PFT">Pulmonology (Spirometry / PFT)</option>
              <option value="AUDIOMETRY">Audiology (Pure Tone Audiometry)</option>
              <option value="VISION_SCREENING">Ophthalmology (Vision)</option>
              <option value="VITALS_ANTHROPOMETRY">General Vitals</option>
              <option value="DOCTOR_EXAMINATION">Doctor Consultation</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">
              Test Fields / Parameters (comma-separated)
            </label>
            <input
              type="text"
              value={fieldsInput}
              onChange={(e) => setFieldsInput(e.target.value)}
              placeholder="cholesterol, triglycerides, hdl, ldl"
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-indigo-500"
            />
          </div>

          <button
            type="submit"
            disabled={isSaving}
            className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-lg shadow-sm transition"
          >
            {isSaving ? "Saving to Catalog..." : "Save Test to Master Catalog"}
          </button>
        </form>

        {/* Catalog Table */}
        <div className="lg:col-span-2 bg-slate-950 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-800 text-xs font-bold text-slate-400 uppercase tracking-wider">
            Active Tests Master Catalog ({services.length})
          </div>

          <div className="overflow-x-auto max-h-[500px]">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900 text-slate-400 font-semibold uppercase text-[10px] border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Code</th>
                  <th className="py-3 px-4">Test Name</th>
                  <th className="py-3 px-4">Station</th>
                  <th className="py-3 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {services.map((srv) => (
                  <tr key={srv.id} className="hover:bg-slate-900/50 transition">
                    <td className="py-3 px-4 font-mono font-bold text-indigo-400">{srv.code}</td>
                    <td className="py-3 px-4 font-semibold text-white">{srv.name}</td>
                    <td className="py-3 px-4 text-slate-400">{srv.station}</td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950 text-emerald-400 border border-emerald-900">
                        ACTIVE
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}