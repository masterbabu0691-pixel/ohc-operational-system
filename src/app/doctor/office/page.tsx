// src/app/doctor/office/page.tsx
"use client";

import React, { useState, useEffect, useRef } from "react";
import { getCampsList } from "@/actions/camp-actions";
import { getCampReceptionList } from "@/actions/reception-actions";
import { submitOfficeDoctorReview } from "@/actions/clinical-actions";
import { getEmployeeClinicalSummary } from "@/actions/doctor-actions";
import { 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  Building2, 
  Search, 
  RotateCcw, 
  FileCheck, 
  CreditCard, 
  X, 
  Printer 
} from "lucide-react";
import { BackButton } from "@/components/shared/BackButton";

export default function OfficeDoctorPortal() {
  const [camps, setCamps] = useState<any[]>([]);
  const [selectedCampId, setSelectedCampId] = useState("");
  const [employees, setEmployees] = useState<any[]>([]);
  const [selectedEmp, setSelectedEmp] = useState<any | null>(null);
  const [diagnostics, setDiagnostics] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  // Office Doctor Data
  const [officeDoctorName, setOfficeDoctorName] = useState("Dr. S. Mukherjee, MBBS, AFIH");
  const [officeDoctorRegNo, setOfficeDoctorRegNo] = useState("G-44210");
  const [vitalsRemark, setVitalsRemark] = useState("Vitals within acceptable occupational limits.");
  const [labRemark, setLabRemark] = useState("Normal blood count & routine biochemistry.");
  const [xrayRemark, setXrayRemark] = useState("Chest X-Ray Normal PA View.");
  const [pftRemark, setPftRemark] = useState("Spirometry FEV1/FVC ratio > 75%, normal loop.");
  const [audioRemark, setAudioRemark] = useState("Bilateral normal hearing threshold.");
  const [fitnessStatus, setFitnessStatus] = useState<"FIT" | "UNFIT" | "TEMPORARILY_UNFIT_FOLLOW_UP">("FIT");
  const [followUpDate, setFollowUpDate] = useState("");
  const [adviceSummary, setAdviceSummary] = useState("Annual periodic surveillance recommended.");

  // Signature Canvas
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    async function load() {
      const data = await getCampsList();
      setCamps(data);
      if (data.length > 0) setSelectedCampId(data[0].id);
    }
    load();
  }, []);

  const loadList = async () => {
    if (!selectedCampId) return;
    const list = await getCampReceptionList(selectedCampId);
    setEmployees(list.filter((e: any) => e.checkInStatus === "CHECKED_IN"));
  };

  useEffect(() => {
    loadList();
  }, [selectedCampId]);

  useEffect(() => {
    async function loadDiag() {
      if (selectedEmp && selectedCampId) {
        const diagList = await getEmployeeClinicalSummary(selectedEmp.id, selectedCampId);
        setDiagnostics(diagList);
      }
    }
    loadDiag();
  }, [selectedEmp, selectedCampId]);

  // Signature Drawing
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    setIsDrawing(true);
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#002642";
    const rect = canvas.getBoundingClientRect();
    ctx.beginPath();
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (isDrawing && canvasRef.current) {
      setIsDrawing(false);
      setSignatureData(canvasRef.current.toDataURL("image/png"));
    }
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      ctx?.clearRect(0, 0, canvas.width, canvas.height);
      setSignatureData(null);
    }
  };

  const handleSubmitSignOff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmp) return;
    setIsSubmitting(true);

    const res = await submitOfficeDoctorReview({
      employeeId: selectedEmp.id,
      campId: selectedCampId,
      officeDoctorName,
      officeDoctorRegNo,
      officeDoctorId: "doc_office_01",
      vitalsRemark,
      labRemark,
      xrayRemark,
      pftRemark,
      audioRemark,
      fitnessStatus,
      followUpDate: fitnessStatus === "TEMPORARILY_UNFIT_FOLLOW_UP" ? followUpDate : undefined,
      adviceSummary,
      doctorSignatureUrl: signatureData || undefined,
    });

    setIsSubmitting(false);

    if (res.success) {
      alert(`Final Legal Fitness Certified as ${fitnessStatus} for ${selectedEmp.fullName}!`);
      setSelectedEmp(null);
      loadList();
    } else {
      alert("Error: " + res.error);
    }
  };

  const filtered = employees.filter((e) =>
    e.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    e.empCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
    e.uhid.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (e.agencyName && e.agencyName.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 p-4 sm:p-6 space-y-5">
      <div className="max-w-7xl mx-auto space-y-5">
        <BackButton fallbackHref="/admin" label="Back to Dashboard" />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
          <div>
            <h1 className="text-2xl font-black text-[#002642]">Office Doctor Review & Legal Sign-Off</h1>
            <p className="text-xs text-slate-500">Back-office comprehensive dossier review, panel remarks, and Form 32 statutory certification.</p>
          </div>

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

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Dossier Queue */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-3">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search patient or agency..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 border border-slate-300 rounded-xl text-xs outline-none"
              />
            </div>

            <div className="space-y-2 max-h-[550px] overflow-y-auto">
              {filtered.map((emp) => (
                <div
                  key={emp.id}
                  onClick={() => setSelectedEmp(emp)}
                  className={`p-3 rounded-xl border text-xs cursor-pointer transition space-y-1 ${
                    selectedEmp?.id === emp.id
                      ? "border-[#008C8C] bg-teal-50/50"
                      : "border-slate-200 hover:border-slate-300 bg-white"
                  }`}
                >
                  <div className="font-bold text-[#002642] truncate">{emp.fullName}</div>
                  <div className="text-[11px] font-mono text-teal-700">{emp.uhid}</div>
                  <div className="text-[10px] font-bold text-indigo-700 flex items-center space-x-1">
                    <Building2 className="w-3 h-3" />
                    <span>{emp.agencyName || "Direct Payroll"}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Review & Remarks Form */}
          <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
            {selectedEmp ? (
              <form onSubmit={handleSubmitSignOff} className="space-y-6">
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs">
                  <div>
                    <div className="font-black text-[#002642] text-sm">{selectedEmp.fullName}</div>
                    <div className="text-slate-500 font-mono">UHID: {selectedEmp.uhid} • Code: {selectedEmp.empCode}</div>
                    <div className="text-indigo-700 font-bold mt-0.5">Agency: {selectedEmp.agencyName || "Direct Payroll"}</div>
                  </div>
                  <div className="text-right text-slate-500 text-[11px]">
                    <div>{selectedEmp.age} Y / {selectedEmp.gender}</div>
                    <div>{selectedEmp.department || "General"}</div>
                  </div>
                </div>

                {/* Specific Panel Remarks */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Panel-Specific Clinical Remarks (Office Doctor)
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div>
                      <label className="block font-medium mb-1">Vitals / Physical Exam Remark</label>
                      <input
                        type="text"
                        value={vitalsRemark}
                        onChange={(e) => setVitalsRemark(e.target.value)}
                        className="w-full px-3 py-1.5 border border-slate-300 rounded-xl"
                      />
                    </div>
                    <div>
                      <label className="block font-medium mb-1">Pathology Lab / Blood Remark</label>
                      <input
                        type="text"
                        value={labRemark}
                        onChange={(e) => setLabRemark(e.target.value)}
                        className="w-full px-3 py-1.5 border border-slate-300 rounded-xl"
                      />
                    </div>
                    <div>
                      <label className="block font-medium mb-1">Chest X-Ray Remark</label>
                      <input
                        type="text"
                        value={xrayRemark}
                        onChange={(e) => setXrayRemark(e.target.value)}
                        className="w-full px-3 py-1.5 border border-slate-300 rounded-xl"
                      />
                    </div>
                    <div>
                      <label className="block font-medium mb-1">Spirometry (PFT) Remark</label>
                      <input
                        type="text"
                        value={pftRemark}
                        onChange={(e) => setPftRemark(e.target.value)}
                        className="w-full px-3 py-1.5 border border-slate-300 rounded-xl"
                      />
                    </div>
                    <div>
                      <label className="block font-medium mb-1">Audiometry Hearing Remark</label>
                      <input
                        type="text"
                        value={audioRemark}
                        onChange={(e) => setAudioRemark(e.target.value)}
                        className="w-full px-3 py-1.5 border border-slate-300 rounded-xl"
                      />
                    </div>
                    <div>
                      <label className="block font-medium mb-1">General Health Advice</label>
                      <input
                        type="text"
                        value={adviceSummary}
                        onChange={(e) => setAdviceSummary(e.target.value)}
                        className="w-full px-3 py-1.5 border border-slate-300 rounded-xl"
                      />
                    </div>
                  </div>
                </div>

                {/* Legal Fitness Determination */}
                <div className="space-y-3 pt-3 border-t border-slate-100">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Regulatory Fitness Determination (Form 32 / Form 35) *
                  </h4>

                  <div className="grid grid-cols-3 gap-3">
                    <label
                      onClick={() => setFitnessStatus("FIT")}
                      className={`cursor-pointer border-2 rounded-xl p-3 text-center transition ${
                        fitnessStatus === "FIT"
                          ? "border-emerald-600 bg-emerald-50 text-emerald-900"
                          : "border-slate-200"
                      }`}
                    >
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 mx-auto mb-1" />
                      <span className="text-xs font-bold block">FIT FOR DUTY</span>
                    </label>

                    <label
                      onClick={() => setFitnessStatus("TEMPORARILY_UNFIT_FOLLOW_UP")}
                      className={`cursor-pointer border-2 rounded-xl p-3 text-center transition ${
                        fitnessStatus === "TEMPORARILY_UNFIT_FOLLOW_UP"
                          ? "border-amber-600 bg-amber-50 text-amber-900"
                          : "border-slate-200"
                      }`}
                    >
                      <AlertTriangle className="w-5 h-5 text-amber-600 mx-auto mb-1" />
                      <span className="text-xs font-bold block">FOLLOW-UP</span>
                    </label>

                    <label
                      onClick={() => setFitnessStatus("UNFIT")}
                      className={`cursor-pointer border-2 rounded-xl p-3 text-center transition ${
                        fitnessStatus === "UNFIT"
                          ? "border-rose-600 bg-rose-50 text-rose-900"
                          : "border-slate-200"
                      }`}
                    >
                      <XCircle className="w-5 h-5 text-rose-600 mx-auto mb-1" />
                      <span className="text-xs font-bold block">UNFIT FOR DUTY</span>
                    </label>
                  </div>
                </div>

                {/* Digital Signature */}
                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-slate-700">Office Doctor Digital Signature</span>
                    <button
                      type="button"
                      onClick={clearSignature}
                      className="text-slate-400 hover:text-slate-600 flex items-center space-x-1"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Clear</span>
                    </button>
                  </div>

                  <div className="border border-slate-300 rounded-xl overflow-hidden bg-slate-50">
                    <canvas
                      ref={canvasRef}
                      width={500}
                      height={90}
                      onMouseDown={startDrawing}
                      onMouseMove={draw}
                      onMouseUp={stopDrawing}
                      onMouseLeave={stopDrawing}
                      className="w-full h-20 bg-white cursor-crosshair"
                    />
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100 flex justify-end">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md transition"
                  >
                    {isSubmitting ? "Certifying..." : "Sign & Generate Legal Form 32 Certificate"}
                  </button>
                </div>
              </form>
            ) : (
              <div className="text-center py-20 text-slate-400 text-xs">
                Select a completed patient from the left queue to conduct office doctor final review.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}