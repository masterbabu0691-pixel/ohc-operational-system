// Last Updated: 20-11-2026 16:32 IST
// src/app/lab/page.tsx
"use client";

import React, { useState, useEffect, useMemo } from "react";
import { getCampsList } from "@/actions/camp-actions";
import {
  getLabQueue,
  getLabParameterAliases,
  markDiagnosticArrived,
  saveLabPathologyResult,
} from "@/actions/diagnostic-actions";
import { requestCorrectionUnlock } from "@/actions/clinical-actions";
import { createWorker } from "tesseract.js";
import {
  Microscope,
  Upload,
  Sparkles,
  CheckCircle2,
  Building2,
  Search,
  Lock,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { BackButton } from "@/components/shared/BackButton";
import { StationAttendanceBar } from "@/components/shared/StationAttendanceBar";

function toCamelKey(label: string) {
  return label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+(.)/g, (_, chr) => chr.toUpperCase())
    .replace(/[^a-zA-Z0-9]/g, "");
}

function parseLabTextWithAliases(
  raw: string,
  aliasList: { canonicalKey: string; aliases: string[] }[]
) {
  const result: Record<string, string> = {};
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  for (const item of aliasList) {
    if (result[item.canonicalKey]) continue;
    const sortedAliases = [...(item.aliases || [])].sort((a, b) => b.length - a.length);

    for (const alias of sortedAliases) {
      const upperAlias = alias.toUpperCase();
      let matched = false;

      for (let i = 0; i < lines.length; i++) {
        const lineUpper = lines[i].toUpperCase();
        const idx = lineUpper.indexOf(upperAlias);
        if (idx === -1) continue;

        const afterAlias = lines[i].slice(idx + alias.length).replace(/^[\s:=-]+/, "").trim();
        const sameLineVal = afterAlias.match(/^(\d+(?:\.\d+)?(?:\s*-\s*\d+(?:\.\d+)?)?|Negative|Positive|Normal|Nil|Absent|[ABO]{1,2}\s*[+-](?:ve)?)/i);
        if (sameLineVal?.[1]) {
          result[item.canonicalKey] = sameLineVal[1].trim();
          matched = true;
          break;
        }

        for (let j = i + 1; j <= Math.min(i + 4, lines.length - 1); j++) {
          const nextLine = lines[j];
          if (/^(Method|Machine|Bio\.|Reference|Note)/i.test(nextLine)) continue;
          const nextVal = nextLine.match(/^(\d+(?:\.\d+)?(?:\s*-\s*\d+(?:\.\d+)?)?|Negative|Positive|Normal|Nil|Absent|[ABO]{1,2}\s*[+-](?:ve)?)\b/i);
          if (nextVal?.[1]) {
            result[item.canonicalKey] = nextVal[1].trim();
            matched = true;
            break;
          }
        }
        if (matched) break;
      }
      if (matched) break;
    }
  }
  return result;
}

function isValueAbnormal(val: string, alias?: any): boolean {
  if (!val?.trim() || !alias) return false;
  const clean = val.trim();
  if (alias.normalText) {
    const allowed = alias.normalText.toLowerCase().split(",").map((s: string) => s.trim());
    return !allowed.includes(clean.toLowerCase());
  }
  const num = parseFloat(clean);
  if (isNaN(num)) return false;
  const min = alias.normalMin ? parseFloat(alias.normalMin) : null;
  const max = alias.normalMax ? parseFloat(alias.normalMax) : null;
  if (min !== null && !isNaN(min) && num < min) return true;
  if (max !== null && !isNaN(max) && num > max) return true;
  return false;
}

function checkPdfIdentityMatch(rawText: string, emp: any) {
  const upper = rawText.toUpperCase();
  const uhidMatch = emp.uhid && upper.includes(emp.uhid.toUpperCase());
  const barcodeMatch = emp.labKitBarcode && upper.includes(emp.labKitBarcode.toUpperCase());
  const nameTokens = (emp.fullName || "")
    .toUpperCase()
    .split(/\s+/)
    .filter((t: string) => t.length >= 3);
  const nameMatch = nameTokens.some((t: string) => upper.includes(t));

  if (uhidMatch || barcodeMatch || nameMatch) {
    return { mismatch: false, note: "" };
  }
  return {
    mismatch: true,
    note: `PDF text did not match Name (${emp.fullName}), UHID (${emp.uhid}), or Kit Barcode (${emp.labKitBarcode || "N/A"}). Verify correct patient report!`,
  };
}

const FALLBACK_FIELDS = [
  { key: "hb", label: "Hb (g/dL)", group: "Blood Test" },
  { key: "wbc", label: "WBC / TLC", group: "Blood Test" },
  { key: "platelets", label: "Platelets", group: "Blood Test" },
  { key: "esr", label: "ESR (mm/hr)", group: "Blood Test" },
  { key: "sgpt", label: "SGPT / ALT (U/L)", group: "Blood Test" },
  { key: "creatinine", label: "S. Creatinine", group: "Blood Test" },
  { key: "rbs", label: "RBS (Blood Sugar)", group: "Blood Test" },
  { key: "widal", label: "Widal Profile", group: "Blood Test" },
  { key: "urineRm", label: "Urine R/M", group: "Urine Test" },
];

export default function LaboratoryQueuePage() {
  const [camps, setCamps] = useState<any[]>([]);
  const [selectedCampId, setSelectedCampId] = useState("");
  const [queue, setQueue] = useState<any[]>([]);
  const [aliases, setAliases] = useState<any[]>([]);
  const [selectedEmp, setSelectedEmp] = useState<any | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const [bloodGroup, setBloodGroup] = useState("");
  const [labValues, setLabValues] = useState<Record<string, string>>({});
  const [findingsSummary, setFindingsSummary] = useState(
    "All pathology parameters within normal reference limits."
  );
  const [isAbnormal, setIsAbnormal] = useState(false);

  const [isOcrRunning, setIsOcrRunning] = useState(false);
  const [ocrProgress, setOcrProgress] = useState("");
  const [ocrRawText, setOcrRawText] = useState("");
  const [usedOcr, setUsedOcr] = useState(false);
  const [identityMismatch, setIdentityMismatch] = useState(false);
  const [identityMismatchNote, setIdentityMismatchNote] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    async function load() {
      const [data, aliasRows] = await Promise.all([
        getCampsList(),
        getLabParameterAliases(),
      ]);
      setCamps(data);
      setAliases(aliasRows);
      if (data.length > 0) setSelectedCampId(data[0].id);
    }
    load();
  }, []);

  const loadQueue = async () => {
    if (!selectedCampId) return;
    const list = await getLabQueue(selectedCampId);
    setQueue(list);
    if (selectedEmp) {
      const updated = list.find((e) => e.employeeId === selectedEmp.employeeId);
      if (updated) setSelectedEmp(updated);
    }
  };

  useEffect(() => {
    loadQueue();
  }, [selectedCampId]);

  const aliasMap = useMemo(() => {
    const m = new Map<string, any>();
    aliases.forEach((a) => m.set(a.canonicalKey, a));
    return m;
  }, [aliases]);

  const dynamicFields = useMemo(() => {
    if (!selectedEmp) return [];
    const contracted: any[] = selectedEmp.contractedLabServices || [];
    if (contracted.length === 0) return FALLBACK_FIELDS;

    const list: { key: string; label: string; group: string; alias?: any }[] = [];
    const seen = new Set<string>();

    contracted.forEach((srv) => {
      const fields: string[] = srv.schemaDefinition?.fields || [];
      fields.forEach((f) => {
        const key = toCamelKey(f);
        if (!key || key === "bloodGroup" || seen.has(key)) return;
        seen.add(key);
        const alias = aliasMap.get(key);
        list.push({
          key,
          label: alias?.displayLabel || f.trim(),
          group: srv.subCategory || "Blood Test",
          alias,
        });
      });
    });

    return list.length > 0 ? list : FALLBACK_FIELDS;
  }, [selectedEmp, aliasMap]);

  const handleSelectEmp = (emp: any) => {
    setSelectedEmp(emp);
    const saved = emp.savedLabData || {};
    setBloodGroup(emp.bloodGroup || "");
    setLabValues({ ...saved });
    setFindingsSummary(emp.savedFindings || "All pathology parameters within normal reference limits.");
    setIsAbnormal(Boolean(emp.savedAbnormal));
    setIdentityMismatch(Boolean(emp.identityMismatch));
    setIdentityMismatchNote(emp.identityMismatchNote || "");
    setOcrRawText("");
    setOcrProgress("");
    setUsedOcr(false);
  };

  const handleValueChange = (key: string, val: string) => {
    const next = { ...labValues, [key]: val };
    setLabValues(next);
    const anyAbn = dynamicFields.some((f) => isValueAbnormal(next[f.key] || "", aliasMap.get(f.key)));
    if (anyAbn) setIsAbnormal(true);
  };

  const handleToggleArrived = async () => {
    if (!selectedEmp) return;
    const res = await markDiagnosticArrived(selectedEmp.employeeId, selectedCampId, "PATHOLOGY_LAB");
    if (res.success) {
      setSelectedEmp({ ...selectedEmp, arrivalStatus: res.arrivalStatus });
      loadQueue();
    }
  };

  const handleOcrUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedEmp) return;

    setIsOcrRunning(true);
    setOcrProgress("Initializing OCR...");
    setIdentityMismatch(false);
    setIdentityMismatchNote("");

    try {
      let fullExtractedText = "";
      const worker = await createWorker("eng");

      if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
        const pdfjsLib = await import("pdfjs-dist");
        pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
          setOcrProgress(`Scanning PDF Page ${pageNum} of ${pdf.numPages}...`);
          const page = await pdf.getPage(pageNum);
          const viewport = page.getViewport({ scale: 2.0 });
          const canvas = document.createElement("canvas");
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          const ctx = canvas.getContext("2d")!;
          await page.render({ canvasContext: ctx, viewport, canvas }).promise;
          const { data: { text } } = await worker.recognize(canvas);
          fullExtractedText += `\n--- Page ${pageNum} ---\n${text}`;
        }
      } else {
        setOcrProgress("Scanning Image...");
        const { data: { text } } = await worker.recognize(file);
        fullExtractedText = text;
      }

      await worker.terminate();
      setOcrRawText(fullExtractedText);
      setUsedOcr(true);

      const idCheck = checkPdfIdentityMatch(fullExtractedText, selectedEmp);
      setIdentityMismatch(idCheck.mismatch);
      setIdentityMismatchNote(idCheck.note);

      const parsed = parseLabTextWithAliases(fullExtractedText, aliases);
      const nextValues = { ...labValues };
      dynamicFields.forEach((f) => {
        if (parsed[f.key]) nextValues[f.key] = parsed[f.key];
      });
      setLabValues(nextValues);
      if (parsed.bloodGroup) setBloodGroup(parsed.bloodGroup);

      const anyAbn = dynamicFields.some((f) => isValueAbnormal(nextValues[f.key] || "", aliasMap.get(f.key)));
      if (anyAbn) setIsAbnormal(true);
    } catch (err: any) {
      alert("OCR failed on this file. Please enter values manually. (" + err?.message + ")");
    } finally {
      setIsOcrRunning(false);
      setOcrProgress("");
      e.target.value = "";
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmp) return;
    if (selectedEmp.arrivalStatus !== "ARRIVED") {
      alert("Mandatory Rule: Please click 'Mark As Arrived' first before saving Lab results.");
      return;
    }

    setIsSaving(true);
    const res = await saveLabPathologyResult({
      employeeId: selectedEmp.employeeId,
      campId: selectedCampId,
      bloodGroup,
      labValues,
      findingsSummary,
      isAbnormal,
      identityMismatch,
      identityMismatchNote,
      extractedViaOcr: usedOcr,
    });
    setIsSaving(false);

    if (res.success) {
      alert(`Lab values saved for ${selectedEmp.fullName}!`);
      setSelectedEmp(null);
      loadQueue();
    } else {
      alert(res.error || "Save failed");
    }
  };

  const handleRequestUnlock = async () => {
    if (!selectedEmp) return;
    const reason = prompt(`Why does ${selectedEmp.fullName}'s Lab Report need correction?`);
    if (!reason?.trim()) return;
    await requestCorrectionUnlock({
      campId: selectedCampId,
      employeeId: selectedEmp.employeeId,
      station: "PATHOLOGY_LAB",
      reason,
    });
    alert("Correction request sent to Camp Coordinator.");
  };

  const filtered = queue.filter(
    (e) =>
      e.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.uhid.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (e.labKitBarcode && e.labKitBarcode.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const mismatchCount = queue.filter((e) => e.identityMismatch).length;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 p-4 sm:p-6 space-y-5">
      <div className="max-w-7xl mx-auto space-y-5">
        <BackButton fallbackHref="/admin" label="Back to Dashboard" />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
          <div>
            <div className="flex items-center space-x-2 text-blue-600 font-bold text-xs uppercase tracking-wider">
              <Microscope className="w-4 h-4" />
              <span>Pathology & Lab Results Entry (Strict Package Mode)</span>
            </div>
            <h1 className="text-2xl font-black text-[#002642]">Laboratory Queue & Multi-Page PDF OCR</h1>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <StationAttendanceBar campId={selectedCampId} stationName="PATHOLOGY_LAB" />
            <select
              value={selectedCampId}
              onChange={(e) => setSelectedCampId(e.target.value)}
              className="px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-bold"
            >
              {camps.map((c) => (
                <option key={c.id} value={c.id}>[{c.clientName}] {c.name}</option>
              ))}
            </select>
          </div>
        </div>

        {mismatchCount > 0 && (
          <div className="p-3 bg-rose-50 border border-rose-300 rounded-xl text-xs font-bold text-rose-800 flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>
              LAB IDENTITY MISMATCH ALERT: {mismatchCount} employee report(s) in this camp had a PDF Name/UHID/Barcode mismatch flag!
            </span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-3">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search name, UHID, or barcode..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 border border-slate-300 rounded-xl text-xs outline-none"
              />
            </div>

            <div className="space-y-2 max-h-[540px] overflow-y-auto">
              {filtered.map((emp) => (
                <div
                  key={emp.employeeId}
                  onClick={() => handleSelectEmp(emp)}
                  className={`p-3 rounded-xl border text-xs cursor-pointer transition space-y-1 ${
                    selectedEmp?.employeeId === emp.employeeId ? "border-blue-600 bg-blue-50/40" : "border-slate-200 bg-white"
                  }`}
                >
                  <div className="flex justify-between items-center gap-1">
                    <span className="font-bold text-[#002642] truncate">{emp.fullName}</span>
                    {emp.identityMismatch && (
                      <span className="px-1.5 py-0.5 bg-rose-600 text-white text-[9px] font-bold rounded">MISMATCH</span>
                    )}
                    {emp.checklistStatus === "COMPLETED" && (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    )}
                  </div>
                  <div className="text-[11px] font-mono text-teal-700">
                    {emp.uhid} {emp.labKitBarcode ? `• Kit: ${emp.labKitBarcode}` : ""}
                  </div>
                  <div className="text-[10px] font-bold text-indigo-700 flex items-center space-x-1">
                    <Building2 className="w-3 h-3" />
                    <span>{emp.agencyName}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
            {selectedEmp ? (
              <form onSubmit={handleSave} className="space-y-5">
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs">
                  <div>
                    <div className="font-black text-[#002642] text-sm">{selectedEmp.fullName}</div>
                    <div className="text-slate-500 font-mono">UHID: {selectedEmp.uhid} | Kit: {selectedEmp.labKitBarcode || "Not Scanned"}</div>
                  </div>
                  {selectedEmp.checklistStatus !== "COMPLETED" && (
                    <button
                      type="button"
                      onClick={handleToggleArrived}
                      className={`px-3.5 py-1.5 text-white rounded-lg font-bold ${
                        selectedEmp.arrivalStatus === "ARRIVED" ? "bg-blue-600" : "bg-[#002642]"
                      }`}
                    >
                      {selectedEmp.arrivalStatus === "ARRIVED" ? "Arrived" : "Mark As Arrived"}
                    </button>
                  )}
                </div>

                {selectedEmp.arrivalStatus !== "ARRIVED" && selectedEmp.checklistStatus !== "COMPLETED" && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs font-bold text-amber-900 flex items-center space-x-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>Mandatory: Click &quot;Mark As Arrived&quot; above before saving Lab results.</span>
                  </div>
                )}

                {identityMismatch && (
                  <div className="p-3.5 bg-rose-50 border-2 border-rose-500 rounded-xl text-xs font-bold text-rose-900 flex items-start space-x-2">
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    <div>
                      <div>PATIENT IDENTITY MISMATCH DETECTED IN PDF/IMAGE</div>
                      <div className="font-normal text-rose-700 mt-0.5">{identityMismatchNote}</div>
                    </div>
                  </div>
                )}

                {selectedEmp.isLocked && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between text-xs">
                    <span className="flex items-center space-x-2 font-bold text-amber-900">
                      <Lock className="w-4 h-4 text-amber-600" />
                      <span>Lab Entry Locked.</span>
                    </span>
                    <button type="button" onClick={handleRequestUnlock} className="px-3 py-1 bg-amber-600 text-white rounded-lg font-bold">
                      Request Coordinator Unlock
                    </button>
                  </div>
                )}

                <div className="p-4 bg-blue-50/60 border border-blue-200 rounded-xl space-y-2">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="text-xs font-bold text-blue-900 flex items-center space-x-1.5">
                      <Sparkles className="w-4 h-4 text-blue-600" />
                      <span>Smart Multi-Page PDF OCR (Extracts Contracted Parameters Only)</span>
                    </div>
                    <label className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold cursor-pointer flex items-center space-x-1.5 w-fit">
                      {isOcrRunning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                      <span>{isOcrRunning ? ocrProgress || "Scanning..." : "Upload Individual PDF / Image"}</span>
                      <input type="file" accept="image/*,application/pdf" onChange={handleOcrUpload} className="hidden" disabled={selectedEmp.isLocked} />
                    </label>
                  </div>
                  {ocrRawText && (
                    <pre className="text-[10px] bg-white p-2 rounded border border-blue-100 max-h-24 overflow-y-auto text-slate-600 whitespace-pre-wrap">
                      {ocrRawText}
                    </pre>
                  )}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                  <div>
                    <label className="block font-semibold text-slate-600 mb-1">Blood Group</label>
                    <input type="text" value={bloodGroup} onChange={(e) => setBloodGroup(e.target.value)} placeholder="e.g. O +ve" disabled={selectedEmp.isLocked} className="w-full px-3 py-1.5 border rounded-xl" />
                  </div>

                  {dynamicFields.map((field) => {
                    const val = labValues[field.key] || "";
                    const alias = aliasMap.get(field.key);
                    const abnormal = isValueAbnormal(val, alias);
                    return (
                      <div key={field.key}>
                        <label className="block font-semibold text-slate-600 mb-1 truncate" title={field.label}>
                          {field.label} {alias?.unit ? `(${alias.unit})` : ""}
                        </label>
                        <input
                          type="text"
                          value={val}
                          onChange={(e) => handleValueChange(field.key, e.target.value)}
                          placeholder={alias?.normalText ? `e.g. ${alias.normalText}` : alias?.normalMin ? `${alias.normalMin}-${alias.normalMax}` : "Enter result"}
                          disabled={selectedEmp.isLocked}
                          className={`w-full px-3 py-1.5 border rounded-xl ${
                            abnormal ? "border-rose-500 bg-rose-50 font-bold text-rose-900" : "border-slate-300"
                          }`}
                        />
                      </div>
                    );
                  })}
                </div>

                <div className="space-y-1 text-xs">
                  <label className="block font-semibold text-slate-600">Pathology Impression *</label>
                  <textarea rows={2} value={findingsSummary} onChange={(e) => setFindingsSummary(e.target.value)} disabled={selectedEmp.isLocked} className="w-full px-3 py-2 border rounded-xl" />
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                  <label className="flex items-center space-x-2 text-xs font-bold text-rose-700 cursor-pointer">
                    <input type="checkbox" checked={isAbnormal} onChange={(e) => setIsAbnormal(e.target.checked)} className="rounded text-rose-600" />
                    <span>Flag Abnormal Lab Result</span>
                  </label>
                  <button
                    type="submit"
                    disabled={isSaving || selectedEmp.isLocked}
                    className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md disabled:opacity-40"
                  >
                    {isSaving ? "Saving..." : "Save & Lock Lab Report"}
                  </button>
                </div>
              </form>
            ) : (
              <div className="text-center py-20 text-slate-400 text-xs">
                Select an employee from the left queue to enter or OCR-scan lab values.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}