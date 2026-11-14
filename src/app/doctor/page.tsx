// src/app/doctor/page.tsx
"use client";

import React, { useState, useEffect, useRef } from "react";
import { getCampsList } from "@/actions/camp-actions";
import { getDoctorQueue, getEmployeeClinicalSummary, saveDoctorReview } from "@/actions/doctor-actions";
import { 
  Stethoscope, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  Printer, 
  CreditCard, 
  Check, 
  User, 
  RotateCcw, 
  QrCode, 
  FileCheck,
  ShieldCheck,
  X
} from "lucide-react";
import { BackButton } from "@/components/shared/BackButton";

export default function DoctorPage() {
  const [camps, setCamps] = useState<any[]>([]);
  const [selectedCampId, setSelectedCampId] = useState("");
  const [queue, setQueue] = useState<any[]>([]);
  const [selectedEmp, setSelectedEmp] = useState<any | null>(null);
  const [clinicalRecords, setClinicalRecords] = useState<any[]>([]);

  const [doctorName, setDoctorName] = useState("Dr. S. Mukherjee, MBBS, AFIH");
  const [doctorRegNo, setDoctorRegNo] = useState("G-44210");
  const [fitnessStatus, setFitnessStatus] = useState<"FIT" | "UNFIT" | "TEMPORARILY_UNFIT_FOLLOW_UP">("FIT");
  const [followUpDate, setFollowUpDate] = useState("");
  const [clinicalNotes, setClinicalNotes] = useState("Fit for standard occupational duty in plant environment.");
  const [recommendations, setRecommendations] = useState("Annual periodic medical review recommended.");
  const [cvs, setCvs] = useState("S1 S2 Normal, No murmurs");
  const [rs, setRs] = useState("Bilateral vesicular breath sounds clear");
  const [abdomen, setAbdomen] = useState("Soft, No organomegaly");
  const [cns, setCns] = useState("Reflexes normal, No neurological deficit");
  const [isSaving, setIsSaving] = useState(false);
  const [successBanner, setSuccessBanner] = useState("");

  const [showCertModal, setShowCertModal] = useState(false);
  const [showIdCardModal, setShowIdCardModal] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [signatureData, setSignatureData] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const campData = await getCampsList();
      setCamps(campData);
      if (campData.length > 0) {
        setSelectedCampId(campData[0].id);
      }
    }
    load();
  }, []);

  const loadQueueData = async () => {
    if (!selectedCampId) return;
    const q = await getDoctorQueue(selectedCampId);
    setQueue(q);
    if (q.length > 0 && !selectedEmp) {
      setSelectedEmp(q[0]);
    }
  };

  useEffect(() => {
    loadQueueData();
  }, [selectedCampId]);

  useEffect(() => {
    async function fetchSummary() {
      if (selectedEmp && selectedCampId) {
        const records = await getEmployeeClinicalSummary(selectedEmp.employeeId || selectedEmp.id, selectedCampId);
        setClinicalRecords(records);
      }
    }
    fetchSummary();
  }, [selectedEmp, selectedCampId]);

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    setIsDrawing(true);
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#1e293b";
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

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        handleSaveReview();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  const handleSaveReview = async () => {
    if (!selectedEmp) return;
    setIsSaving(true);
    setSuccessBanner("");

    const res = await saveDoctorReview({
      employeeId: selectedEmp.employeeId || selectedEmp.id,
      campId: selectedCampId,
      doctorName,
      doctorRegNo,
      fitnessStatus,
      followUpDate: fitnessStatus === "TEMPORARILY_UNFIT_FOLLOW_UP" ? followUpDate : undefined,
      clinicalNotes,
      systemicExam: { cvs, rs, abdomen, cns },
      recommendations,
      signatureDataUrl: signatureData || undefined,
    });

    setIsSaving(false);

    if (res.success) {
      setSuccessBanner(`Certified ${selectedEmp.fullName} as ${fitnessStatus}! Advancing queue...`);
      const currentIndex = queue.findIndex((item) => (item.employeeId || item.id) === (selectedEmp.employeeId || selectedEmp.id));
      const nextPending = queue.slice(currentIndex + 1).find((item) => !item.isCertified);
      setSelectedEmp(nextPending || null);
      loadQueueData();
    } else {
      alert("Error saving review: " + res.error);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 p-6 md:p-8 space-y-6">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Back and Home Shortcut */}
        <BackButton fallbackHref="/admin" label="Back to Dashboard" />

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <div className="flex items-center space-x-2 text-indigo-600 font-semibold text-sm">
              <Stethoscope className="w-4 h-4" />
              <span>Medical Examiner Portal</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 mt-0.5">
              Doctor Consultation & Fitness Certification
            </h1>
          </div>

          <div className="flex items-center space-x-3">
            <select
              value={selectedCampId}
              onChange={(e) => setSelectedCampId(e.target.value)}
              className="px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            >
              {camps.map((camp) => (
                <option key={camp.id} value={camp.id}>
                  {camp.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {successBanner && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-2.5 rounded-lg flex items-center space-x-2 text-xs font-medium">
            <Check className="w-4 h-4 text-emerald-600" />
            <span>{successBanner}</span>
          </div>
        )}

        {/* Clinical Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="space-y-4">
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-3">
              <div className="flex items-center justify-between text-xs font-bold text-slate-600 uppercase tracking-wider pb-2 border-b border-slate-100">
                <span>Camp Queue ({queue.length})</span>
                <span className="text-indigo-600 font-mono">
                  {queue.filter((q) => q.isCertified).length} Certified
                </span>
              </div>

              <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                {queue.map((item) => {
                  const isSelected = (selectedEmp?.id || selectedEmp?.employeeId) === (item.employeeId || item.id);
                  return (
                    <div
                      key={item.employeeId}
                      onClick={() => setSelectedEmp(item)}
                      className={`p-2.5 rounded-lg border text-xs cursor-pointer transition flex items-center justify-between ${
                        isSelected
                          ? "border-indigo-600 bg-indigo-50/50"
                          : "border-slate-200 hover:border-slate-300 bg-white"
                      }`}
                    >
                      <div>
                        <div className="font-semibold text-slate-900 truncate max-w-[130px]">{item.fullName}</div>
                        <div className="text-[10px] font-mono text-slate-500">{item.uhid}</div>
                      </div>

                      {item.isCertified ? (
                        <span className="text-emerald-600 font-bold text-[10px] flex items-center">
                          <CheckCircle2 className="w-3.5 h-3.5 mr-0.5" /> Certified
                        </span>
                      ) : (
                        <span className="text-amber-600 text-[10px]">Awaiting Sign</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-3">
              <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wider pb-2 border-b border-slate-100">
                Completed Diagnostic Highlights
              </h3>

              {clinicalRecords.length > 0 ? (
                <div className="space-y-2 text-xs">
                  {clinicalRecords.map((rec) => (
                    <div key={rec.id} className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
                      <div className="font-bold text-indigo-700 uppercase text-[10px] tracking-wide">
                        {rec.station.replace("_", " ")}
                      </div>
                      <div className="text-slate-700 mt-0.5">{rec.findingsSummary || "Normal"}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 text-xs text-slate-400">
                  No diagnostic station records submitted yet.
                </div>
              )}
            </div>
          </div>

          <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-6">
            {selectedEmp ? (
              <div className="space-y-6">
                <div className="flex items-center justify-between p-3.5 bg-slate-50 border border-slate-200 rounded-lg text-xs">
                  <div>
                    <div className="text-sm font-bold text-slate-900">{selectedEmp.fullName}</div>
                    <div className="text-slate-500 font-mono">
                      UHID: <span className="font-semibold text-indigo-600">{selectedEmp.uhid}</span> • Code: {selectedEmp.empCode}
                    </div>
                  </div>
                  <div className="text-right text-slate-500">
                    <div>{selectedEmp.age} Y / {selectedEmp.gender} • Blood: {selectedEmp.bloodGroup || "O +ve"}</div>
                    <div>{selectedEmp.department || "General"}</div>
                  </div>
                </div>

                <div className="space-y-3">
                  <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    1. Systemic Clinical Examination
                  </h3>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <label className="block text-slate-600 font-medium mb-1">Cardiovascular (CVS)</label>
                      <input
                        type="text"
                        value={cvs}
                        onChange={(e) => setCvs(e.target.value)}
                        className="w-full px-3 py-1.5 border border-slate-300 rounded-md"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-600 font-medium mb-1">Respiratory (RS)</label>
                      <input
                        type="text"
                        value={rs}
                        onChange={(e) => setRs(e.target.value)}
                        className="w-full px-3 py-1.5 border border-slate-300 rounded-md"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-600 font-medium mb-1">Abdomen & G.I.</label>
                      <input
                        type="text"
                        value={abdomen}
                        onChange={(e) => setAbdomen(e.target.value)}
                        className="w-full px-3 py-1.5 border border-slate-300 rounded-md"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-600 font-medium mb-1">Central Nervous (CNS)</label>
                      <input
                        type="text"
                        value={cns}
                        onChange={(e) => setCns(e.target.value)}
                        className="w-full px-3 py-1.5 border border-slate-300 rounded-md"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    2. Legal Fitness Determination *
                  </h3>
                  <div className="grid grid-cols-3 gap-3">
                    <label
                      onClick={() => setFitnessStatus("FIT")}
                      className={`cursor-pointer border-2 rounded-xl p-3.5 flex flex-col items-center justify-center text-center transition ${
                        fitnessStatus === "FIT"
                          ? "border-emerald-600 bg-emerald-50 text-emerald-900"
                          : "border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 mb-1" />
                      <span className="text-xs font-bold">FIT FOR DUTY</span>
                    </label>

                    <label
                      onClick={() => setFitnessStatus("TEMPORARILY_UNFIT_FOLLOW_UP")}
                      className={`cursor-pointer border-2 rounded-xl p-3.5 flex flex-col items-center justify-center text-center transition ${
                        fitnessStatus === "TEMPORARILY_UNFIT_FOLLOW_UP"
                          ? "border-amber-600 bg-amber-50 text-amber-900"
                          : "border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      <AlertTriangle className="w-5 h-5 text-amber-600 mb-1" />
                      <span className="text-xs font-bold">FOLLOW-UP REQUIRED</span>
                    </label>

                    <label
                      onClick={() => setFitnessStatus("UNFIT")}
                      className={`cursor-pointer border-2 rounded-xl p-3.5 flex flex-col items-center justify-center text-center transition ${
                        fitnessStatus === "UNFIT"
                          ? "border-rose-600 bg-rose-50 text-rose-900"
                          : "border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      <XCircle className="w-5 h-5 text-rose-600 mb-1" />
                      <span className="text-xs font-bold">UNFIT FOR DUTY</span>
                    </label>
                  </div>
                </div>

                {/* Digital Signature Canvas */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                      3. Doctor Digital Signature Canvas
                    </h3>
                    <button
                      type="button"
                      onClick={clearSignature}
                      className="text-[11px] text-slate-500 hover:text-slate-700 flex items-center space-x-1"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Clear Canvas</span>
                    </button>
                  </div>
                  <div className="border border-slate-300 rounded-lg overflow-hidden bg-slate-50">
                    <canvas
                      ref={canvasRef}
                      width={500}
                      height={100}
                      onMouseDown={startDrawing}
                      onMouseMove={draw}
                      onMouseUp={stopDrawing}
                      onMouseLeave={stopDrawing}
                      className="w-full h-24 cursor-crosshair bg-white"
                    />
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-200 flex items-center justify-between">
                  <div className="flex space-x-2">
                    <button
                      type="button"
                      onClick={() => setShowCertModal(true)}
                      className="px-3.5 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center space-x-1.5"
                    >
                      <FileCheck className="w-4 h-4 text-indigo-600" />
                      <span>Print Fitness Certificate</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setShowIdCardModal(true)}
                      className="px-3.5 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center space-x-1.5"
                    >
                      <CreditCard className="w-4 h-4 text-emerald-600" />
                      <span>View & Print ID Card</span>
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={handleSaveReview}
                    disabled={isSaving}
                    className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-sm transition flex items-center space-x-1.5 disabled:opacity-50"
                  >
                    <Check className="w-4 h-4" />
                    <span>{isSaving ? "Certifying..." : "Save & Certify (Ctrl+Enter)"}</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center py-20 text-slate-400 text-sm">
                Select an employee from the queue to start examination.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}