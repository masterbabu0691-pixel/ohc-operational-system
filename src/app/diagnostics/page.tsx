// src/app/diagnostics/page.tsx
"use client";

import React, { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { getCampsList } from "@/actions/camp-actions";
import {
  getDiagnosticTechnicianScope,
  getStationQueue,
  lookupEmployeeByBarcode,
  markDiagnosticArrived,
  saveDiagnosticResult,
} from "@/actions/diagnostic-actions";
import { requestCorrectionUnlock } from "@/actions/clinical-actions";
import {
  Stethoscope,
  Barcode,
  Activity,
  FileText,
  Heart,
  Headphones,
  Camera,
  Upload,
  Check,
  X,
  Building2,
  CheckCircle2,
  Clock,
  Lock,
} from "lucide-react";
import { BackButton } from "@/components/shared/BackButton";

type StationKey = "SPIROMETRY_PFT" | "AUDIOMETRY" | "ECG" | "CHEST_XRAY";

const VALID_STATIONS: StationKey[] = ["SPIROMETRY_PFT", "AUDIOMETRY", "ECG", "CHEST_XRAY"];

function DiagnosticsContent() {
  const searchParams = useSearchParams();
  const urlStation = searchParams.get("station") as StationKey | null;

  const [camps, setCamps] = useState<any[]>([]);
  const [selectedCampId, setSelectedCampId] = useState("");
  const [activeStation, setActiveStation] = useState<StationKey>(
    urlStation && VALID_STATIONS.includes(urlStation) ? urlStation : "SPIROMETRY_PFT"
  );
  const [allowedStation, setAllowedStation] = useState<StationKey | null>(null);
  const [queue, setQueue] = useState<any[]>([]);
  const [selectedEmp, setSelectedEmp] = useState<any | null>(null);
  const [barcodeInput, setBarcodeInput] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [successBanner, setSuccessBanner] = useState("");

  // Media Capture / Upload State
  const [attachmentPreview, setAttachmentPreview] = useState<string | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [findingsSummary, setFindingsSummary] = useState("");
  const [isAbnormal, setIsAbnormal] = useState(false);
  const [capturedAfterCamp, setCapturedAfterCamp] = useState(false);
  const [isArrived, setIsArrived] = useState(false);

  const barcodeInputRef = useRef<HTMLInputElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (urlStation && VALID_STATIONS.includes(urlStation) && !allowedStation) {
      setActiveStation(urlStation);
    }
  }, [urlStation, allowedStation]);

  useEffect(() => {
    async function load() {
      const [campData, scope] = await Promise.all([
        getCampsList(),
        getDiagnosticTechnicianScope(),
      ]);
      setCamps(campData);
      if (campData.length > 0 && !selectedCampId) {
        setSelectedCampId(campData[0].id);
      }
      if (
        scope.role === "DIAGNOSTIC_TECHNICIAN" &&
        scope.assignedStation &&
        VALID_STATIONS.includes(scope.assignedStation as StationKey)
      ) {
        const lockedStation = scope.assignedStation as StationKey;
        setAllowedStation(lockedStation);
        setActiveStation(lockedStation);
      }
    }
    load();
  }, []);

  const loadQueue = async () => {
    if (!selectedCampId) return;
    const q = await getStationQueue(selectedCampId, activeStation);
    setQueue(q);
    if (selectedEmp) {
      const updated = q.find(
        (item) => item.employeeId === (selectedEmp.employeeId || selectedEmp.id)
      );
      if (updated) handleSelectEmployee(updated);
    }
  };

  useEffect(() => {
    loadQueue();
    barcodeInputRef.current?.focus();
  }, [selectedCampId, activeStation]);

  useEffect(() => {
    if (activeStation === "SPIROMETRY_PFT") {
      setFindingsSummary("FEV1/FVC Ratio > 75%, Normal Flow-Volume curve, No airway obstruction.");
    } else if (activeStation === "AUDIOMETRY") {
      setFindingsSummary("Bilateral normal hearing thresholds across 500Hz to 8kHz (<25 dB).");
    } else if (activeStation === "ECG") {
      setFindingsSummary("Normal Sinus Rhythm, Heart Rate 72 bpm, No ST-T wave changes.");
    } else if (activeStation === "CHEST_XRAY") {
      setFindingsSummary("Both lung fields clear. Normal bronchovascular markings. Cardiac silhouette normal.");
    }
    setAttachmentPreview(null);
  }, [activeStation]);

  const handleSelectEmployee = (emp: any) => {
    setSelectedEmp(emp);
    const arrived = emp.arrivalStatus === "ARRIVED" || emp.checklistStatus === "COMPLETED";
    setIsArrived(arrived);
    setAttachmentPreview(null);
  };

  const handleToggleArrivedClick = async () => {
    if (!selectedEmp) return;
    const res = await markDiagnosticArrived(
      selectedEmp.id || selectedEmp.employeeId,
      selectedCampId,
      activeStation
    );
    if (res.success) {
      const nowArrived = res.arrivalStatus === "ARRIVED";
      setIsArrived(nowArrived);
      setSuccessBanner(
        nowArrived
          ? `${selectedEmp.fullName} marked as ARRIVED! Uploader unlocked.`
          : `${selectedEmp.fullName} reverted to Pending.`
      );
      loadQueue();
    }
  };

  const handleRequestUnlock = async () => {
    if (!selectedEmp) return;
    const reason = prompt(`Why does ${selectedEmp.fullName}'s ${activeStation} entry need correction?`);
    if (!reason?.trim()) return;
    const res = await requestCorrectionUnlock({
      campId: selectedCampId,
      employeeId: selectedEmp.id || selectedEmp.employeeId,
      station: activeStation,
      reason,
    });
    if (res.success) {
      setSuccessBanner("Unlock request sent to Camp Coordinator Desk.");
    }
  };

  const handleBarcodeScan = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && barcodeInput.trim()) {
      e.preventDefault();
      const emp = await lookupEmployeeByBarcode(selectedCampId, barcodeInput.trim());
      if (emp) {
        handleSelectEmployee(emp);
        setBarcodeInput("");
        setSuccessBanner(`Scanned & Loaded: ${emp.fullName} (${emp.uhid})`);
      } else {
        alert("Employee not found for barcode: " + barcodeInput);
      }
    }
  };

  const startCamera = async () => {
    try {
      setCameraActive(true);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720, facingMode: "environment" },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch {
      alert("Unable to open device camera. You can browse and upload a file directly.");
      setCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  const capturePhoto = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement("canvas");
    canvas.width = 640;
    canvas.height = 480;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.drawImage(videoRef.current, 0, 0, 640, 480);
      setAttachmentPreview(canvas.toDataURL("image/jpeg", 0.85));
      stopCamera();
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => setAttachmentPreview(evt.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleSaveAndNext = async () => {
    if (!selectedEmp) return;
    if (!isArrived) {
      alert("Please click 'Mark As Arrived' before saving test results.");
      return;
    }

    setIsSaving(true);
    setSuccessBanner("");

    const res = await saveDiagnosticResult({
      employeeId: selectedEmp.id || selectedEmp.employeeId,
      campId: selectedCampId,
      station: activeStation,
      serviceCode: `SRV_${activeStation}`,
      findingsSummary,
      isAbnormal,
      attachmentUrls: attachmentPreview ? [attachmentPreview] : [],
      capturedAfterCamp,
      enteredBy: "Diagnostic Specialist",
    });

    setIsSaving(false);

    if (res.success) {
      setSuccessBanner(`Saved for ${selectedEmp.fullName}! Advancing to next patient...`);
      const currentIndex = queue.findIndex(
        (item) => item.employeeId === (selectedEmp.id || selectedEmp.employeeId)
      );
      const nextPending = queue.slice(currentIndex + 1).find((item) => item.checklistStatus === "PENDING");
      if (nextPending) {
        handleSelectEmployee(nextPending);
      } else {
        setSelectedEmp(null);
        setIsArrived(false);
      }
      loadQueue();
      barcodeInputRef.current?.focus();
    } else {
      alert(res.error || "Error saving result");
    }
  };

  const allStations: { key: StationKey; name: string; icon: any }[] = [
    { key: "SPIROMETRY_PFT", name: "Spirometry (PFT)", icon: Activity },
    { key: "AUDIOMETRY", name: "Audiometry (Audio)", icon: Headphones },
    { key: "ECG", name: "12-Lead ECG", icon: Heart },
    { key: "CHEST_XRAY", name: "Chest X-Ray", icon: FileText },
  ];

  const visibleStations = allowedStation
    ? allStations.filter((s) => s.key === allowedStation)
    : allStations;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 p-4 sm:p-6 md:p-8 space-y-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <BackButton fallbackHref="/admin" label="Back to Dashboard" />

        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <div className="flex items-center space-x-2 text-[#008C8C] font-bold text-xs uppercase tracking-wider">
              <Stethoscope className="w-4 h-4" />
              <span>Diagnostic Operations Desk</span>
            </div>
            <h1 className="text-2xl font-black text-[#002642] tracking-tight mt-0.5">
              Diagnostic Stations (PFT, Audio, ECG, X-Ray)
            </h1>
          </div>

          <div className="flex items-center space-x-3">
            <div className="relative">
              <Barcode className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              <input
                ref={barcodeInputRef}
                type="text"
                placeholder="Scan Barcode / UHID (Enter)..."
                value={barcodeInput}
                onChange={(e) => setBarcodeInput(e.target.value)}
                onKeyDown={handleBarcodeScan}
                className="pl-9 pr-3 py-2 bg-white border-2 border-indigo-500 rounded-xl text-xs font-mono font-bold focus:outline-none w-60 shadow-xs"
              />
            </div>

            <select
              value={selectedCampId}
              onChange={(e) => setSelectedCampId(e.target.value)}
              className="px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-[#002642] outline-none"
            >
              {camps.map((camp) => (
                <option key={camp.id} value={camp.id}>
                  [{camp.clientName}] {camp.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Station Navigation Tabs (RBAC Filtered) */}
        <div className="flex space-x-2 border-b border-slate-200 overflow-x-auto pb-1">
          {visibleStations.map((stn) => {
            const Icon = stn.icon;
            const isActive = activeStation === stn.key;
            return (
              <button
                key={stn.key}
                type="button"
                onClick={() => {
                  setActiveStation(stn.key);
                  setSelectedEmp(null);
                  setIsArrived(false);
                }}
                className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                  isActive
                    ? "bg-[#002642] text-white shadow-xs"
                    : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{stn.name}</span>
              </button>
            );
          })}
        </div>

        {successBanner && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-2.5 rounded-xl flex items-center space-x-2 text-xs font-bold">
            <Check className="w-4 h-4 text-emerald-600" />
            <span>{successBanner}</span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Queue */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-3">
            <div className="flex items-center justify-between text-xs font-bold text-slate-600 uppercase tracking-wider pb-2 border-b border-slate-100">
              <span>{activeStation.replace("_", " ")} Queue ({queue.length})</span>
              <span className="text-[#008C8C] font-mono">
                {queue.filter((q) => q.checklistStatus === "COMPLETED").length} Done
              </span>
            </div>

            <div className="space-y-2 max-h-[550px] overflow-y-auto pr-1">
              {queue.map((item) => {
                const isSelected = (selectedEmp?.id || selectedEmp?.employeeId) === item.employeeId;
                const isDone = item.checklistStatus === "COMPLETED";
                const isItemArrived = item.arrivalStatus === "ARRIVED";

                return (
                  <div
                    key={item.employeeId || item.uhid}
                    onClick={() => handleSelectEmployee(item)}
                    className={`p-3 rounded-xl border text-xs cursor-pointer transition flex items-center justify-between ${
                      isSelected ? "border-[#008C8C] bg-teal-50/50" : "border-slate-200 hover:border-slate-300 bg-white"
                    }`}
                  >
                    <div className="space-y-0.5 truncate max-w-[170px]">
                      <div className="font-bold text-[#002642] truncate">{item.fullName}</div>
                      <div className="text-[11px] font-mono text-teal-700">{item.uhid}</div>
                      <div className="text-[10px] font-bold text-indigo-700 flex items-center space-x-1 truncate">
                        <Building2 className="w-3 h-3 shrink-0" />
                        <span className="truncate">{item.agencyName || "Direct Payroll"}</span>
                      </div>
                    </div>

                    <div>
                      {isDone ? (
                        <span className="text-emerald-600 font-bold flex items-center text-[10px]">
                          <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Done
                        </span>
                      ) : isItemArrived ? (
                        <span className="px-2 py-0.5 rounded bg-blue-600 text-white font-bold flex items-center text-[10px]">
                          Arrived
                        </span>
                      ) : (
                        <span className="text-slate-400 flex items-center text-[10px]">
                          <Clock className="w-3 h-3 mr-1" /> Pending
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Workstation */}
          <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col justify-between space-y-6">
            {selectedEmp ? (
              <div className="space-y-5">
                <div className="flex items-center justify-between p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs">
                  <div>
                    <div className="text-sm font-bold text-[#002642]">{selectedEmp.fullName}</div>
                    <div className="text-slate-500 font-mono">
                      UHID: <span className="font-semibold text-teal-700">{selectedEmp.uhid}</span> | Code: {selectedEmp.empCode}
                    </div>
                    <div className="text-indigo-700 font-bold flex items-center space-x-1 mt-0.5">
                      <Building2 className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Agency: {selectedEmp.agencyName || "Direct Payroll"}</span>
                    </div>
                  </div>

                  {selectedEmp.checklistStatus !== "COMPLETED" && (
                    <button
                      type="button"
                      onClick={handleToggleArrivedClick}
                      className={`px-4 py-2 text-white text-xs font-bold rounded-xl shadow-xs transition ${
                        isArrived ? "bg-blue-600 hover:bg-blue-700" : "bg-[#002642] hover:bg-[#001e38]"
                      }`}
                    >
                      {isArrived ? "Arrived" : "Mark As Arrived"}
                    </button>
                  )}
                </div>

                {/* Reception Height, Weight & BMI Banner */}
                <div className="p-3 bg-teal-50 border border-teal-200 rounded-xl text-xs flex items-center justify-between">
                  <span className="font-bold text-teal-900">Reception Height, Weight & BMI:</span>
                  <span className="font-mono font-bold text-teal-800">
                    {selectedEmp.heightCm || "-"} cm / {selectedEmp.weightKg || "-"} kg (BMI: {selectedEmp.bmi || "-"})
                  </span>
                </div>

                {selectedEmp.isLocked && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between text-xs">
                    <span className="flex items-center space-x-2 font-bold text-amber-900">
                      <Lock className="w-4 h-4 text-amber-600" />
                      <span>Entry Locked after save.</span>
                    </span>
                    <button
                      type="button"
                      onClick={handleRequestUnlock}
                      className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold"
                    >
                      Request Coordinator Unlock
                    </button>
                  </div>
                )}

                {!isArrived ? (
                  <div className="p-8 border-2 border-dashed border-slate-200 rounded-xl text-center space-y-3 bg-slate-50/60">
                    <Clock className="w-8 h-8 text-slate-400 mx-auto" />
                    <div className="text-xs font-bold text-slate-700">Waiting for Employee Arrival</div>
                    <button
                      type="button"
                      onClick={handleToggleArrivedClick}
                      className="px-5 py-2 bg-[#008C8C] hover:bg-[#006e6e] text-white text-xs font-bold rounded-xl shadow-xs"
                    >
                      Mark As Arrived
                    </button>
                  </div>
                ) : (
                  <div className="space-y-5">
                    <div className="space-y-1">
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                        {activeStation.replace("_", " ")} Clinical Findings *
                      </label>
                      <textarea
                        rows={3}
                        disabled={selectedEmp.isLocked}
                        value={findingsSummary}
                        onChange={(e) => setFindingsSummary(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs text-slate-900 font-medium outline-none"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                        Attach Film / Waveform / Report Slip
                      </label>
                      {cameraActive ? (
                        <div className="relative aspect-video bg-black rounded-xl overflow-hidden max-w-md mx-auto">
                          <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                          <div className="absolute bottom-3 inset-x-0 flex justify-center space-x-2">
                            <button type="button" onClick={capturePhoto} className="px-4 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-bold">
                              Snap Photo
                            </button>
                            <button type="button" onClick={stopCamera} className="px-3 py-1.5 bg-slate-800 text-white rounded-lg text-xs font-semibold">
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : attachmentPreview ? (
                        <div className="relative border-2 border-teal-500 rounded-xl p-2 bg-slate-50 max-w-sm">
                          <img src={attachmentPreview} alt="Report preview" className="w-full h-40 object-contain rounded-lg" />
                          <button type="button" onClick={() => setAttachmentPreview(null)} className="absolute top-3 right-3 p-1 bg-rose-600 text-white rounded-full">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex flex-col sm:flex-row items-center gap-3">
                          <button
                            type="button"
                            disabled={selectedEmp.isLocked}
                            onClick={startCamera}
                            className="w-full sm:w-auto px-4 py-2.5 bg-teal-50 border border-teal-200 text-teal-800 rounded-xl text-xs font-bold flex items-center justify-center space-x-2"
                          >
                            <Camera className="w-4 h-4 text-teal-600" />
                            <span>Take Photo with Camera</span>
                          </button>
                          <label className="w-full sm:w-auto px-4 py-2.5 bg-slate-100 border border-slate-300 text-slate-700 rounded-xl text-xs font-bold flex items-center justify-center space-x-2 cursor-pointer">
                            <Upload className="w-4 h-4 text-slate-500" />
                            <span>Browse Film / Strip File</span>
                            <input type="file" accept="image/*,application/pdf" onChange={handleFileUpload} className="hidden" />
                          </label>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-100 text-xs">
                      <label className="flex items-center space-x-2 cursor-pointer">
                        <input type="checkbox" checked={isAbnormal} onChange={(e) => setIsAbnormal(e.target.checked)} className="w-4 h-4 rounded text-rose-600" />
                        <span className="font-bold text-rose-700">Flag as Abnormal for Doctor Review</span>
                      </label>
                      <label className="flex items-center space-x-2 cursor-pointer text-slate-500">
                        <input type="checkbox" checked={capturedAfterCamp} onChange={(e) => setCapturedAfterCamp(e.target.checked)} className="w-4 h-4 rounded text-indigo-600" />
                        <span className="text-[11px]">Uploaded Post-Camp (Batch Sync)</span>
                      </label>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-20 text-slate-400 text-xs">
                Select an employee from the queue or scan a barcode to begin.
              </div>
            )}

            <div className="pt-4 border-t border-slate-200 flex items-center justify-end space-x-3">
              <button
                type="button"
                onClick={() => {
                  setSelectedEmp(null);
                  setIsArrived(false);
                }}
                className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-medium text-slate-600"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={handleSaveAndNext}
                disabled={!selectedEmp || !isArrived || isSaving || selectedEmp?.isLocked}
                className="px-6 py-2 bg-[#008C8C] hover:bg-[#006e6e] text-white rounded-xl text-xs font-bold shadow-sm disabled:opacity-50 flex items-center space-x-1.5"
              >
                <Check className="w-4 h-4" />
                <span>{isSaving ? "Saving..." : "Save & Next"}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DiagnosticsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-xs text-slate-500">Loading Diagnostic Desk...</div>}>
      <DiagnosticsContent />
    </Suspense>
  );
}