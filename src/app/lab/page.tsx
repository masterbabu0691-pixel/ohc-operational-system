// src/app/lab/page.tsx
"use client";

import React, { useState, useEffect } from "react";
import { getCampsList } from "@/actions/camp-actions";
import {
  getLabQueue,
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
} from "lucide-react";
import { BackButton } from "@/components/shared/BackButton";

function parseLabText(raw: string) {
  const findVal = (regex: RegExp) => {
    const m = raw.match(regex);
    return m ? m[1].trim() : "";
  };
  return {
    hb: findVal(/(?:Hb|Hemoglobin|Haemoglobin)[\s:=-]*([0-9]+(?:\.[0-9]+)?)/i),
    wbc: findVal(/(?:WBC|Total\s*Leukocyte|TLC)[\s:=-]*([0-9,]+(?:\.[0-9]+)?)/i),
    platelets: findVal(/(?:Platelet|PLT)[\s:=-]*([0-9,]+(?:\.[0-9]+)?)/i),
    esr: findVal(/(?:ESR)[\s:=-]*([0-9]+)/i),
    sgpt: findVal(/(?:SGPT|ALT)[\s:=-]*([0-9]+(?:\.[0-9]+)?)/i),
    creatinine: findVal(/(?:Creatinine|S\.?\s*Creat)[\s:=-]*([0-9]+(?:\.[0-9]+)?)/i),
    rbs: findVal(/(?:RBS|Random\s*Blood\s*Sugar|Glucose)[\s:=-]*([0-9]+(?:\.[0-9]+)?)/i),
    widal: findVal(/(?:Widal)[\s:=-]*(Positive|Negative|Reactive|Non-Reactive)/i),
    bloodGroup: findVal(/(?:Blood\s*Group)[\s:=-]*([ABO]{1,2}\s*[+-](?:ve)?)/i),
  };
}

export default function LaboratoryQueuePage() {
  const [camps, setCamps] = useState<any[]>([]);
  const [selectedCampId, setSelectedCampId] = useState("");
  const [queue, setQueue] = useState<any[]>([]);
  const [selectedEmp, setSelectedEmp] = useState<any | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Lab Fields matching Medical Examination Report
  const [bloodGroup, setBloodGroup] = useState("");
  const [hb, setHb] = useState("");
  const [wbc, setWbc] = useState("");
  const [platelets, setPlatelets] = useState("");
  const [esr, setEsr] = useState("");
  const [sgpt, setSgpt] = useState("");
  const [creatinine, setCreatinine] = useState("");
  const [widal, setWidal] = useState("Negative");
  const [rbs, setRbs] = useState("");
  const [urineRm, setUrineRm] = useState("Normal");
  const [heavyMetal, setHeavyMetal] = useState("");
  const [findingsSummary, setFindingsSummary] = useState("All pathology parameters within normal reference limits.");
  const [isAbnormal, setIsAbnormal] = useState(false);

  // Free In-Browser OCR State
  const [isOcrRunning, setIsOcrRunning] = useState(false);
  const [ocrRawText, setOcrRawText] = useState("");
  const [usedOcr, setUsedOcr] = useState(false);
  const [attachmentPreview, setAttachmentPreview] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    async function load() {
      const data = await getCampsList();
      setCamps(data);
      if (data.length > 0) setSelectedCampId(data[0].id);
    }
    load();
  }, []);

  const loadQueue = async () => {
    if (!selectedCampId) return;
    const list = await getLabQueue(selectedCampId);
    setQueue(list);
  };

  useEffect(() => {
    loadQueue();
  }, [selectedCampId]);

  const handleSelectEmp = (emp: any) => {
    setSelectedEmp(emp);
    setBloodGroup(emp.bloodGroup || "");
    setOcrRawText("");
    setUsedOcr(false);
    setAttachmentPreview(null);
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
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => setAttachmentPreview(reader.result as string);
    reader.readAsDataURL(file);

    setIsOcrRunning(true);
    try {
      const worker = await createWorker("eng");
      const {
        data: { text },
      } = await worker.recognize(file);
      await worker.terminate();

      setOcrRawText(text);
      setUsedOcr(true);

      const parsed = parseLabText(text);
      if (parsed.hb) setHb(parsed.hb);
      if (parsed.wbc) setWbc(parsed.wbc);
      if (parsed.platelets) setPlatelets(parsed.platelets);
      if (parsed.esr) setEsr(parsed.esr);
      if (parsed.sgpt) setSgpt(parsed.sgpt);
      if (parsed.creatinine) setCreatinine(parsed.creatinine);
      if (parsed.rbs) setRbs(parsed.rbs);
      if (parsed.widal) setWidal(parsed.widal);
      if (parsed.bloodGroup) setBloodGroup(parsed.bloodGroup);
    } catch (err: any) {
      alert("OCR failed on this file. Please enter values manually. (" + err?.message + ")");
    } finally {
      setIsOcrRunning(false);
      e.target.value = "";
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmp) return;
    setIsSaving(true);

    const res = await saveLabPathologyResult({
      employeeId: selectedEmp.employeeId,
      campId: selectedCampId,
      bloodGroup,
      labValues: { hb, wbc, platelets, esr, sgpt, creatinine, widal, rbs, urineRm, heavyMetal },
      findingsSummary,
      isAbnormal,
      extractedViaOcr: usedOcr,
      attachmentUrls: attachmentPreview ? [attachmentPreview] : [],
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

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 p-4 sm:p-6 space-y-5">
      <div className="max-w-7xl mx-auto space-y-5">
        <BackButton fallbackHref="/admin" label="Back to Dashboard" />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
          <div>
            <div className="flex items-center space-x-2 text-blue-600 font-bold text-xs uppercase tracking-wider">
              <Microscope className="w-4 h-4" />
              <span>Pathology & Lab Results Entry</span>
            </div>
            <h1 className="text-2xl font-black text-[#002642]">Laboratory Queue & Free In-Browser OCR</h1>
            <p className="text-xs text-slate-500">
              Upload a lab slip for automatic free OCR extraction, verify values, or enter results manually.
            </p>
          </div>

          <select
            value={selectedCampId}
            onChange={(e) => setSelectedCampId(e.target.value)}
            className="px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-bold"
          >
            {camps.map((c) => (
              <option key={c.id} value={c.id}>
                [{c.clientName}] {c.name}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Queue */}
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
                    selectedEmp?.employeeId === emp.employeeId
                      ? "border-blue-600 bg-blue-50/40"
                      : "border-slate-200 hover:border-slate-300 bg-white"
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-[#002642] truncate">{emp.fullName}</span>
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

          {/* Entry + OCR Panel */}
          <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
            {selectedEmp ? (
              <form onSubmit={handleSave} className="space-y-5">
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs">
                  <div>
                    <div className="font-black text-[#002642] text-sm">{selectedEmp.fullName}</div>
                    <div className="text-slate-500 font-mono">
                      UHID: {selectedEmp.uhid} | Barcode: {selectedEmp.labKitBarcode || "Not Scanned"}
                    </div>
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

                {/* Free Browser OCR Box */}
                <div className="p-4 bg-blue-50/60 border border-blue-200 rounded-xl space-y-2">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="text-xs font-bold text-blue-900 flex items-center space-x-1.5">
                      <Sparkles className="w-4 h-4 text-blue-600" />
                      <span>Free In-Browser OCR Auto-Fetch (Verify Below Before Saving)</span>
                    </div>
                    <label className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold cursor-pointer flex items-center space-x-1.5 w-fit">
                      {isOcrRunning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                      <span>{isOcrRunning ? "Scanning Report..." : "Upload Lab Report Image"}</span>
                      <input type="file" accept="image/*" onChange={handleOcrUpload} className="hidden" disabled={selectedEmp.isLocked} />
                    </label>
                  </div>
                  {ocrRawText && (
                    <pre className="text-[10px] bg-white p-2 rounded border border-blue-100 max-h-24 overflow-y-auto text-slate-600 whitespace-pre-wrap">
                      {ocrRawText}
                    </pre>
                  )}
                </div>

                {/* Blood Investigation Inputs */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                  <div>
                    <label className="block font-semibold text-slate-600 mb-1">Blood Group</label>
                    <input type="text" value={bloodGroup} onChange={(e) => setBloodGroup(e.target.value)} placeholder="e.g. O +ve" disabled={selectedEmp.isLocked} className="w-full px-3 py-1.5 border border-slate-300 rounded-xl" />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-600 mb-1">Hb (g/dL)</label>
                    <input type="text" value={hb} onChange={(e) => setHb(e.target.value)} placeholder="e.g. 14.2" disabled={selectedEmp.isLocked} className="w-full px-3 py-1.5 border border-slate-300 rounded-xl" />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-600 mb-1">WBC (/cumm)</label>
                    <input type="text" value={wbc} onChange={(e) => setWbc(e.target.value)} placeholder="e.g. 7200" disabled={selectedEmp.isLocked} className="w-full px-3 py-1.5 border border-slate-300 rounded-xl" />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-600 mb-1">Platelets</label>
                    <input type="text" value={platelets} onChange={(e) => setPlatelets(e.target.value)} placeholder="e.g. 2.5 Lakhs" disabled={selectedEmp.isLocked} className="w-full px-3 py-1.5 border border-slate-300 rounded-xl" />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-600 mb-1">ESR (mm/hr)</label>
                    <input type="text" value={esr} onChange={(e) => setEsr(e.target.value)} placeholder="e.g. 10" disabled={selectedEmp.isLocked} className="w-full px-3 py-1.5 border border-slate-300 rounded-xl" />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-600 mb-1">SGPT (U/L)</label>
                    <input type="text" value={sgpt} onChange={(e) => setSgpt(e.target.value)} placeholder="e.g. 28" disabled={selectedEmp.isLocked} className="w-full px-3 py-1.5 border border-slate-300 rounded-xl" />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-600 mb-1">S. Creatinine</label>
                    <input type="text" value={creatinine} onChange={(e) => setCreatinine(e.target.value)} placeholder="e.g. 0.9" disabled={selectedEmp.isLocked} className="w-full px-3 py-1.5 border border-slate-300 rounded-xl" />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-600 mb-1">Widal Profile</label>
                    <input type="text" value={widal} onChange={(e) => setWidal(e.target.value)} disabled={selectedEmp.isLocked} className="w-full px-3 py-1.5 border border-slate-300 rounded-xl" />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-600 mb-1">RBS (mg/dL)</label>
                    <input type="text" value={rbs} onChange={(e) => setRbs(e.target.value)} placeholder="e.g. 102" disabled={selectedEmp.isLocked} className="w-full px-3 py-1.5 border border-slate-300 rounded-xl" />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-600 mb-1">Urine R/M</label>
                    <input type="text" value={urineRm} onChange={(e) => setUrineRm(e.target.value)} disabled={selectedEmp.isLocked} className="w-full px-3 py-1.5 border border-slate-300 rounded-xl" />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block font-semibold text-slate-600 mb-1">Heavy Metal / Special Test (If Applicable)</label>
                    <input type="text" value={heavyMetal} onChange={(e) => setHeavyMetal(e.target.value)} placeholder="Optional" disabled={selectedEmp.isLocked} className="w-full px-3 py-1.5 border border-slate-300 rounded-xl" />
                  </div>
                </div>

                <div className="space-y-1 text-xs">
                  <label className="block font-semibold text-slate-600">Pathology Impression *</label>
                  <textarea rows={2} value={findingsSummary} onChange={(e) => setFindingsSummary(e.target.value)} disabled={selectedEmp.isLocked} className="w-full px-3 py-2 border border-slate-300 rounded-xl" />
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