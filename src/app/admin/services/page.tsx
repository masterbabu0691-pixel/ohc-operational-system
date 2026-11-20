// Last Updated: 20-11-2026 15:53 IST
// src/app/admin/services/page.tsx
"use client";

import React, { useState, useEffect, useMemo } from "react";
import { getAdminServices, createOrUpdateService } from "@/actions/admin-actions";
import { getLabParameterAliases, saveLabParameterAlias } from "@/actions/diagnostic-actions";
import { Plus, Check, Sparkles, Pencil } from "lucide-react";

const MAIN_CATEGORIES = [
  { value: "VITALS_ANTHROPOMETRY", label: "Vitals & Anthropometry" },
  { value: "DIAGNOSTICS", label: "Diagnostics (X-Ray / ECG / PFT / Audio)" },
  { value: "PATHOLOGY", label: "Pathology (Blood / Urine / Stool / Special)" },
  { value: "DOCTOR_FITNESS", label: "Doctor Systemic Exam & Fitness" },
];

const SUB_CATEGORY_OPTIONS: Record<string, string[]> = {
  VITALS_ANTHROPOMETRY: ["Anthropometry & Vitals", "Vision Screening"],
  DIAGNOSTICS: ["X-Ray", "ECG", "Spirometry / PFT", "Audiometry", "Other Diagnostic"],
  PATHOLOGY: ["Blood Test", "Urine Test", "Stool Test", "Special Test"],
  DOCTOR_FITNESS: ["Field Doctor Physical Exam", "Office Doctor Fitness Review"],
};

function toCamelKey(label: string) {
  return label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+(.)/g, (_, chr) => chr.toUpperCase())
    .replace(/[^a-zA-Z0-9]/g, "");
}

export default function AdminServicesPage() {
  const [services, setServices] = useState<any[]>([]);
  const [aliases, setAliases] = useState<any[]>([]);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [mainCategory, setMainCategory] = useState("PATHOLOGY");
  const [subCategory, setSubCategory] = useState("Blood Test");
  const [station, setStation] = useState<any>("PATHOLOGY_LAB");
  const [fieldsInput, setFieldsInput] = useState("Hb, WBC, Platelets");
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");

  const [aliasKey, setAliasKey] = useState("sgpt");
  const [customAliasKey, setCustomAliasKey] = useState("");
  const [aliasLabel, setAliasLabel] = useState("SGPT / ALT");
  const [aliasUnit, setAliasUnit] = useState("U/L");
  const [aliasMin, setAliasMin] = useState("3");
  const [aliasMax, setAliasMax] = useState("35");
  const [aliasNormalText, setAliasNormalText] = useState("");
  const [aliasValues, setAliasValues] = useState("ALANINE AMINOTRANSFERASE (ALT/SGPT), ALT (SGPT) SERUM, SGPT, ALT");

  const load = async () => {
    const [list, aliasList] = await Promise.all([getAdminServices(), getLabParameterAliases()]);
    setServices(list);
    setAliases(aliasList);
  };

  useEffect(() => {
    load();
  }, []);

  const availableParamKeys = useMemo(() => {
    const map = new Map<string, string>();
    aliases.forEach((a) => map.set(a.canonicalKey, a.displayLabel || a.canonicalKey));
    services
      .filter((s) => s.station === "PATHOLOGY_LAB")
      .forEach((s) => {
        const fields: string[] = s.schemaDefinition?.fields || [];
        fields.forEach((f) => {
          const k = toCamelKey(f);
          if (k && !map.has(k)) map.set(k, f.trim());
        });
      });
    return Array.from(map.entries()).map(([key, label]) => ({ key, label }));
  }, [services, aliases]);

  const handleStationChange = (nextStation: string) => {
    setStation(nextStation);
    if (nextStation === "PATHOLOGY_LAB" || nextStation === "PHLEBOTOMY") {
      setMainCategory("PATHOLOGY");
      setSubCategory("Blood Test");
    } else if (nextStation === "CHEST_XRAY") {
      setMainCategory("DIAGNOSTICS");
      setSubCategory("X-Ray");
    } else if (nextStation === "ECG") {
      setMainCategory("DIAGNOSTICS");
      setSubCategory("ECG");
    } else if (nextStation === "SPIROMETRY_PFT") {
      setMainCategory("DIAGNOSTICS");
      setSubCategory("Spirometry / PFT");
    } else if (nextStation === "AUDIOMETRY") {
      setMainCategory("DIAGNOSTICS");
      setSubCategory("Audiometry");
    } else if (nextStation === "VITALS_ANTHROPOMETRY" || nextStation === "VISION_SCREENING") {
      setMainCategory("VITALS_ANTHROPOMETRY");
      setSubCategory(nextStation === "VISION_SCREENING" ? "Vision Screening" : "Anthropometry & Vitals");
    } else {
      setMainCategory("DOCTOR_FITNESS");
      setSubCategory("Field Doctor Physical Exam");
    }
  };

  const handleEditService = (srv: any) => {
    setCode(srv.code);
    setName(srv.name);
    setStation(srv.station);
    setMainCategory(srv.mainCategory || "PATHOLOGY");
    setSubCategory(srv.subCategory || "Blood Test");
    const fields = Array.isArray(srv.schemaDefinition?.fields) ? srv.schemaDefinition.fields : [];
    setFieldsInput(fields.join(", "));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSelectAliasDropdown = (selectedKey: string) => {
    setAliasKey(selectedKey);
    if (selectedKey === "__CUSTOM__") {
      setCustomAliasKey("");
      setAliasLabel("");
      setAliasUnit("");
      setAliasMin("");
      setAliasMax("");
      setAliasNormalText("");
      setAliasValues("");
      return;
    }
    const found = aliases.find((a) => a.canonicalKey === selectedKey);
    if (found) {
      setAliasLabel(found.displayLabel || selectedKey);
      setAliasUnit(found.unit || "");
      setAliasMin(found.normalMin || "");
      setAliasMax(found.normalMax || "");
      setAliasNormalText(found.normalText || "");
      setAliasValues((found.aliases || []).join(", "));
    } else {
      const fromSvc = availableParamKeys.find((p) => p.key === selectedKey);
      setAliasLabel(fromSvc?.label || selectedKey);
      setAliasUnit("");
      setAliasMin("");
      setAliasMax("");
      setAliasNormalText("");
      setAliasValues((fromSvc?.label || selectedKey).toUpperCase());
    }
  };

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
      mainCategory,
      subCategory,
      station,
      fields: fieldsArray,
      isActive: true,
    });
    setIsSaving(false);

    if (res.success) {
      setMessage(`Service "${name}" saved! Any new lab parameters were also added to the OCR Alias Dictionary.`);
      setCode("");
      setName("");
      load();
    } else {
      alert("Error: " + res.error);
    }
  };

  const handleSaveAlias = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetKey = aliasKey === "__CUSTOM__" ? toCamelKey(customAliasKey) : aliasKey;
    if (!targetKey || !aliasLabel.trim()) {
      alert("Please provide a valid parameter key and display label.");
      return;
    }

    const res = await saveLabParameterAlias({
      canonicalKey: targetKey,
      displayLabel: aliasLabel,
      unit: aliasUnit,
      normalMin: aliasMin,
      normalMax: aliasMax,
      normalText: aliasNormalText,
      aliases: aliasValues.split(",").map((a) => a.trim()).filter(Boolean),
    });
    if (res.success) {
      setMessage(`OCR Alias & Normal Range updated for "${aliasLabel}"!`);
      setAliasKey(targetKey);
      load();
    } else {
      alert("Error: " + res.error);
    }
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-12">
      <div className="border-b border-slate-800 pb-5">
        <h1 className="text-2xl font-bold text-white tracking-tight">Diagnostic & Lab Tests Catalog (CMS)</h1>
        <p className="text-xs text-slate-400 mt-1">
          Organize tests by Main Category & Sub-Station, and configure dynamic Lab OCR Aliases & Normal Reference Ranges.
        </p>
      </div>

      {message && (
        <div className="bg-emerald-950/60 border border-emerald-800 text-emerald-300 px-4 py-2.5 rounded-lg text-xs font-semibold flex items-center space-x-2">
          <Check className="w-4 h-4 text-emerald-400" />
          <span>{message}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        <form onSubmit={handleSave} className="bg-slate-950 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center space-x-2">
            <Plus className="w-4 h-4 text-indigo-400" />
            <span>Add / Modify Test</span>
          </h2>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Unique Test Code *</label>
            <input type="text" placeholder="e.g. SRV_LIPID" value={code} onChange={(e) => setCode(e.target.value)} className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs font-mono uppercase text-white" />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Test Display Name *</label>
            <input type="text" placeholder="e.g. Lipid Profile" value={name} onChange={(e) => setName(e.target.value)} className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white" />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Associated Station *</label>
            <select value={station} onChange={(e) => handleStationChange(e.target.value)} className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white">
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

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Main Category</label>
              <select
                value={mainCategory}
                onChange={(e) => {
                  const mc = e.target.value;
                  setMainCategory(mc);
                  setSubCategory(SUB_CATEGORY_OPTIONS[mc]?.[0] || "General");
                }}
                className="w-full px-2.5 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white"
              >
                {MAIN_CATEGORIES.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Sub-Station / Group</label>
              <select
                value={subCategory}
                onChange={(e) => setSubCategory(e.target.value)}
                className="w-full px-2.5 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white"
              >
                {(SUB_CATEGORY_OPTIONS[mainCategory] || ["General"]).map((sub) => (
                  <option key={sub} value={sub}>{sub}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Test Fields / Parameters (comma-separated)</label>
            <textarea rows={2} value={fieldsInput} onChange={(e) => setFieldsInput(e.target.value)} className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white" />
          </div>

          <button type="submit" disabled={isSaving} className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-lg">
            {isSaving ? "Saving..." : "Save Test to Master Catalog"}
          </button>
        </form>

        <div className="lg:col-span-2 bg-slate-950 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-800 text-xs font-bold text-slate-400 uppercase tracking-wider">
            Active Tests Master Catalog ({services.length})
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900 text-slate-400 font-semibold uppercase text-[10px] border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Code</th>
                  <th className="py-3 px-4">Test & Parameters</th>
                  <th className="py-3 px-4">Category / Sub-Station</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {services.map((srv) => (
                  <tr key={srv.id} className="hover:bg-slate-900/50">
                    <td className="py-3 px-4 font-mono font-bold text-indigo-400 align-top">{srv.code}</td>
                    <td className="py-3 px-4 align-top">
                      <div className="font-semibold text-white">{srv.name}</div>
                      <div className="text-[11px] text-slate-400 mt-0.5 break-words">
                        {(srv.schemaDefinition?.fields || []).join(", ")}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-slate-300 align-top">
                      <div className="font-semibold text-[11px]">{srv.mainCategory || "PATHOLOGY"}</div>
                      <div className="text-[10px] text-teal-400">{srv.subCategory || srv.station}</div>
                    </td>
                    <td className="py-3 px-4 text-right align-top">
                      <button
                        type="button"
                        onClick={() => handleEditService(srv)}
                        className="px-2.5 py-1 bg-slate-800 hover:bg-indigo-600 text-slate-200 rounded text-[11px] font-semibold inline-flex items-center space-x-1"
                      >
                        <Pencil className="w-3 h-3" />
                        <span>Edit</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        <form onSubmit={handleSaveAlias} className="bg-slate-950 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-3">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center space-x-2">
            <Sparkles className="w-4 h-4 text-teal-400" />
            <span>Lab OCR Parameter Aliases</span>
          </h2>
          <div>
            <label className="block text-xs text-slate-400 mb-1">System Parameter Key (Dynamic)</label>
            <select value={aliasKey} onChange={(e) => handleSelectAliasDropdown(e.target.value)} className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white">
              {availableParamKeys.map((p) => (
                <option key={p.key} value={p.key}>{p.key} ({p.label})</option>
              ))}
              <option value="__CUSTOM__">+ Add Custom Parameter Key</option>
            </select>
          </div>
          {aliasKey === "__CUSTOM__" && (
            <div>
              <label className="block text-xs text-slate-400 mb-1">Custom Parameter Key *</label>
              <input type="text" placeholder="e.g. totalCholesterol" value={customAliasKey} onChange={(e) => setCustomAliasKey(e.target.value)} className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs font-mono text-white" />
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Display Label *</label>
              <input type="text" value={aliasLabel} onChange={(e) => setAliasLabel(e.target.value)} className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Unit</label>
              <input type="text" placeholder="e.g. U/L, mg/dl" value={aliasUnit} onChange={(e) => setAliasUnit(e.target.value)} className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">Normal Min</label>
              <input type="text" placeholder="e.g. 3" value={aliasMin} onChange={(e) => setAliasMin(e.target.value)} className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white" />
            </div>
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">Normal Max</label>
              <input type="text" placeholder="e.g. 35" value={aliasMax} onChange={(e) => setAliasMax(e.target.value)} className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white" />
            </div>
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">Normal Text</label>
              <input type="text" placeholder="e.g. Negative" value={aliasNormalText} onChange={(e) => setAliasNormalText(e.target.value)} className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white" />
            </div>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Lab Report Name Variants (comma-separated)</label>
            <textarea rows={3} value={aliasValues} onChange={(e) => setAliasValues(e.target.value)} className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white" />
          </div>
          <button type="submit" className="w-full py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs rounded-lg">
            Save OCR Alias & Normal Range
          </button>
        </form>

        <div className="lg:col-span-2 bg-slate-950 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-3">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Active Lab OCR Aliases ({aliases.length})</div>
          <div className="divide-y divide-slate-800 text-xs">
            {aliases.map((a) => (
              <div key={a.canonicalKey} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1 flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono font-bold text-teal-400">{a.canonicalKey}</span>
                    <span className="text-white font-semibold">({a.displayLabel})</span>
                    {(a.normalMin || a.normalMax || a.normalText) && (
                      <span className="px-2 py-0.5 bg-slate-900 border border-slate-700 rounded text-[10px] text-emerald-300 font-mono">
                        Ref: {a.normalText ? a.normalText : `${a.normalMin || "?"} - ${a.normalMax || "?"}`} {a.unit || ""}
                      </span>
                    )}
                  </div>
                  <div className="text-slate-400 font-mono text-[11px] break-words">
                    {(a.aliases || []).join(", ")}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    handleSelectAliasDropdown(a.canonicalKey);
                    window.scrollTo({ top: document.body.scrollHeight / 2, behavior: "smooth" });
                  }}
                  className="px-2.5 py-1 bg-slate-800 hover:bg-teal-600 text-slate-200 rounded text-[11px] font-semibold inline-flex items-center space-x-1 self-start shrink-0"
                >
                  <Pencil className="w-3 h-3" />
                  <span>Edit</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}