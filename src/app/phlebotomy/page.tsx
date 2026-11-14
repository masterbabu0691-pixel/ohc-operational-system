// src/app/phlebotomy/page.tsx
"use client";

import React, { useState, useEffect, useRef } from "react";
import { getCampsList } from "@/actions/camp-actions";
import { getCampReceptionList } from "@/actions/reception-actions";
import { 
  markEmployeeArrivedAtStation, 
  submitPhlebotomyCollection, 
  getPhlebotomyExportRoster 
} from "@/actions/clinical-actions";
import * as XLSX from "xlsx";
import { BrowserMultiFormatReader, IScannerControls } from "@zxing/browser";
import { 
  Barcode, 
  Camera, 
  FileSpreadsheet, 
  AlertTriangle, 
  Building2, 
  Search, 
  CheckCircle2, 
  Smartphone,
  Zap,
  Info,
  X
} from "lucide-react";
import { BackButton } from "@/components/shared/BackButton";

export default function PhlebotomyStationPage() {
  const [camps, setCamps] = useState<any[]>([]);
  const [selectedCampId, setSelectedCampId] = useState("");
  const [employees, setEmployees] = useState<any[]>([]);
  const [selectedEmp, setSelectedEmp] = useState<any | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Barcode & Dual Collection State
  const [barcodeInput, setBarcodeInput] = useState("");
  const [bloodCollected, setBloodCollected] = useState(false);
  const [urineCollected, setUrineCollected] = useState(false);
  const [errorBanner, setErrorBanner] = useState("");
  const [successBanner, setSuccessBanner] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Live Camera Scanner State
  const [isLiveScanning, setIsLiveScanning] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);
  const [cameraLoading, setCameraLoading] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const scannerControlsRef = useRef<IScannerControls | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const barcodeRef = useRef<HTMLInputElement | null>(null);
  const photoInputRef = useRef<HTMLInputElement | null>(null);

  // Authentic Scanner Beep Synthesizer
  const playScannerBeep = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(2000, ctx.currentTime);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.12);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.12);
    } catch {
      // Audio fallback
    }
  };

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
    barcodeRef.current?.focus();
  }, [selectedCampId]);

  const handleSelectEmp = (emp: any) => {
    setSelectedEmp(emp);
    setBarcodeInput(emp.labKitBarcode || "");
    setBloodCollected(emp.bloodCollected || false);
    setUrineCollected(emp.urineCollected || false);
    setErrorBanner("");
    setSuccessBanner("");
    setTimeout(() => barcodeRef.current?.focus(), 150);
  };

  const handleMarkArrived = async () => {
    if (!selectedEmp) return;
    await markEmployeeArrivedAtStation({
      employeeId: selectedEmp.id,
      campId: selectedCampId,
      station: "PHLEBOTOMY",
    });
    setSuccessBanner(`${selectedEmp.fullName} marked as ARRIVED at Phlebotomy Desk.`);
    loadList();
  };

  // Barcode Detected Callback
  const handleBarcodeDetected = (rawText: string) => {
    const cleanCode = rawText.trim().toUpperCase();
    setBarcodeInput(cleanCode);
    playScannerBeep();
    if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
    setSuccessBanner(`✓ Scanned & Auto-Filled Barcode: ${cleanCode}`);
    setIsLiveScanning(false);
  };

  // =========================================================================
  // ROBUST LIVE CAMERA LIFECYCLE (Fixed Blackout Issue)
  // =========================================================================
  useEffect(() => {
    if (!isLiveScanning) {
      // Cleanup camera when scanner is closed
      if (scannerControlsRef.current) {
        scannerControlsRef.current.stop();
        scannerControlsRef.current = null;
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
      setTorchOn(false);
      setHasTorch(false);
      setCameraLoading(false);
      return;
    }

    let isSubscribed = true;
    setCameraLoading(true);

    async function initLiveCamera() {
      try {
        const isSecure = typeof window !== "undefined" && (
          window.isSecureContext ||
          window.location.hostname === "localhost" ||
          window.location.hostname === "127.0.0.1"
        );

        if (!isSecure && window.location.protocol === "http:" && window.location.hostname !== "localhost") {
          throw new Error("Camera stream requires HTTPS. Run with: npx next dev --experimental-https -H 0.0.0.0");
        }

        // 1. Request rear camera with video constraints
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });

        if (!isSubscribed) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;

        // 2. Attach stream directly to the visible video element in the DOM
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setCameraLoading(false);

          // Check torch capability
          const track = stream.getVideoTracks()[0];
          const caps = (track as any)?.getCapabilities?.();
          if (caps?.torch) {
            setHasTorch(true);
          }
        }

        // 3. Start ZXing frame decoder on the playing video element
        const codeReader = new BrowserMultiFormatReader();
        const controls = await codeReader.decodeFromVideoElement(
          videoRef.current!,
          (result) => {
            if (result && isSubscribed) {
              handleBarcodeDetected(result.getText());
            }
          }
        );

        scannerControlsRef.current = controls;
      } catch (err: any) {
        if (isSubscribed) {
          setErrorBanner("Camera error: " + (err?.message || "Please check camera permissions in browser."));
          setIsLiveScanning(false);
          setCameraLoading(false);
        }
      }
    }

    // Small delay ensures the modal and video element are fully rendered in DOM
    const timer = setTimeout(initLiveCamera, 100);

    return () => {
      isSubscribed = false;
      clearTimeout(timer);
      if (scannerControlsRef.current) {
        scannerControlsRef.current.stop();
        scannerControlsRef.current = null;
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, [isLiveScanning]);

  const toggleTorch = async () => {
    if (streamRef.current) {
      const track = streamRef.current.getVideoTracks()[0];
      const nextTorch = !torchOn;
      try {
        await (track as any).applyConstraints({
          advanced: [{ torch: nextTorch }],
        });
        setTorchOn(nextTorch);
      } catch (e) {
        console.warn("Torch toggle error:", e);
      }
    }
  };

  // Fallback Photo Capture
  const triggerPhotoSnapshot = () => {
    setErrorBanner("");
    photoInputRef.current?.click();
  };

  const handlePhotoCaptured = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      if (typeof window !== "undefined" && "BarcodeDetector" in window) {
        try {
          const detector = new (window as any).BarcodeDetector({
            formats: ["code_128", "code_39", "ean_13", "ean_8", "qr_code", "upc_a", "itf", "codabar"]
          });
          const bitmap = await createImageBitmap(file);
          const detected = await detector.detect(bitmap);
          if (detected && detected.length > 0) {
            handleBarcodeDetected(detected[0].rawValue);
            e.target.value = "";
            return;
          }
        } catch {}
      }

      const reader = new FileReader();
      reader.onload = async () => {
        const dataUrl = reader.result as string;
        try {
          const codeReader = new BrowserMultiFormatReader();
          const result = await codeReader.decodeFromImageUrl(dataUrl);
          if (result) {
            handleBarcodeDetected(result.getText());
          } else {
            setErrorBanner("Could not detect barcode from photo. Hold closer or type manually.");
          }
        } catch {
          setErrorBanner("Could not read barcode. Ensure good lighting or type manually.");
        } finally {
          e.target.value = "";
        }
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      setErrorBanner("Photo process error: " + err.message);
      e.target.value = "";
    }
  };

  const handleManualBarcodeChange = (val: string) => {
    setBarcodeInput(val.toUpperCase());
    setErrorBanner("");
  };

  const handleSubmitCollection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmp) return;
    if (!barcodeInput.trim()) {
      setErrorBanner("Please scan or manually enter the pre-applied lab kit barcode.");
      return;
    }

    setIsSubmitting(true);
    setErrorBanner("");

    const res = await submitPhlebotomyCollection({
      employeeId: selectedEmp.id,
      campId: selectedCampId,
      scannedBarcode: barcodeInput,
      bloodCollected,
      urineCollected,
    });

    setIsSubmitting(false);

    if (res.success) {
      alert(`Barcode ${barcodeInput} attached to ${selectedEmp.fullName}. Samples secured!`);
      setSelectedEmp(null);
      setBarcodeInput("");
      loadList();
    } else {
      setErrorBanner(res.error || "Collection failed.");
    }
  };

  const handleExportPhlebotomyExcel = async () => {
    if (!selectedCampId) return;
    setIsExporting(true);

    try {
      const data = await getPhlebotomyExportRoster(selectedCampId);
      if (!data || data.employees.length === 0) {
        alert("No employee records found to export for this camp.");
        setIsExporting(false);
        return;
      }

      const exportRows = data.employees.map((row) => ({
        "Sr. No": row.srNo,
        "Employee Name": row.employeeName,
        "Age": row.age,
        "Sex": row.sex,
        "Contact No": row.contactNo,
        "Agency Name": row.agencyName,
        "Client Name": row.clientName,
        "UHID": row.uhid,
        "Barcode Details": row.barcodeDetails,
        "Sample Type Collected": row.sampleType,
        "Collection Timestamp": row.collectedTimestamp,
      }));

      const ws = XLSX.utils.json_to_sheet(exportRows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Phlebo Sample Manifest");

      const cleanCampName = data.campName.replace(/[^a-zA-Z0-9_-]/g, "_");
      XLSX.writeFile(wb, `Phlebotomy_Collection_${cleanCampName}_Samples.xlsx`);
    } catch (err: any) {
      alert("Export failed: " + err.message);
    } finally {
      setIsExporting(false);
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
      {/* Hidden File Input for Native Photo Snapshot */}
      <input
        ref={photoInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handlePhotoCaptured}
      />

      {/* FULLSCREEN REAL-TIME SCANNER MODAL */}
      {isLiveScanning && (
        <div className="fixed inset-0 z-50 bg-black flex flex-col justify-between p-4 sm:p-6">
          {/* Top Bar */}
          <div className="flex items-center justify-between text-white z-20">
            <div className="flex items-center space-x-2">
              <span className="w-2.5 h-2.5 bg-red-500 rounded-full animate-ping" />
              <span className="font-bold text-sm uppercase tracking-wider text-emerald-400">
                Live Barcode Scanner
              </span>
            </div>

            <div className="flex items-center space-x-2">
              {hasTorch && (
                <button
                  type="button"
                  onClick={toggleTorch}
                  className={`p-2.5 rounded-full border transition ${
                    torchOn ? "bg-amber-400 text-amber-950 border-amber-300" : "bg-white/10 text-white border-white/20"
                  }`}
                  title="Flashlight"
                >
                  <Zap className="w-5 h-5" />
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsLiveScanning(false)}
                className="p-2.5 rounded-full bg-white/10 text-white border border-white/20 hover:bg-white/20 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Center Viewfinder with Real Video Feed */}
          <div className="relative w-full max-w-sm mx-auto aspect-[4/3] rounded-3xl overflow-hidden border-2 border-emerald-500 shadow-2xl bg-slate-950 flex items-center justify-center">
            {/* The Live Video Element */}
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />

            {/* Loading Indicator while camera spins up */}
            {cameraLoading && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 text-white space-y-2 z-10">
                <div className="w-8 h-8 border-4 border-emerald-400 border-t-transparent rounded-full animate-spin" />
                <span className="text-xs font-bold">Connecting Camera...</span>
              </div>
            )}

            {/* Target Reticle with Laser Beam */}
            <div className="absolute inset-0 pointer-events-none p-6 flex flex-col justify-between z-10">
              <div className="flex justify-between">
                <div className="w-8 h-8 border-t-4 border-l-4 border-emerald-400 rounded-tl-lg" />
                <div className="w-8 h-8 border-t-4 border-r-4 border-emerald-400 rounded-tr-lg" />
              </div>

              {/* Animated Laser Scanning Line */}
              <div className="w-full h-0.5 bg-red-500 shadow-[0_0_12px_#ef4444] animate-pulse" />

              <div className="flex justify-between">
                <div className="w-8 h-8 border-b-4 border-l-4 border-emerald-400 rounded-bl-lg" />
                <div className="w-8 h-8 border-b-4 border-r-4 border-emerald-400 rounded-br-lg" />
              </div>
            </div>
          </div>

          {/* Bottom Instructions */}
          <div className="text-center text-white/80 text-xs space-y-1 pb-2 z-20">
            <p className="font-bold text-sm text-white">
              Point camera at vial or sample tube barcode
            </p>
            <p className="text-[11px] text-emerald-300">
              Auto-detects instantly & fills the patient record
            </p>
          </div>
        </div>
      )}

      <div className="max-w-6xl mx-auto space-y-5">
        <BackButton fallbackHref="/admin" label="Back to Dashboard" />

        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
          <div>
            <div className="flex items-center space-x-2 text-rose-600 font-bold text-xs uppercase tracking-wider">
              <Barcode className="w-4 h-4" />
              <span>Phlebotomy & Lab Sample Processing</span>
            </div>
            <h1 className="text-2xl font-black text-[#002642] tracking-tight mt-0.5">
              Barcode Scanner & Dual-Sample Verification
            </h1>
            <p className="text-xs text-slate-500">
              Live rear camera feed, photo capture, and hardware scanner gun. All barcodes auto-sync with patient dossiers.
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <select
              value={selectedCampId}
              onChange={(e) => setSelectedCampId(e.target.value)}
              className="px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-[#002642]"
            >
              {camps.map((c) => (
                <option key={c.id} value={c.id}>[{c.clientName}] {c.name}</option>
              ))}
            </select>

            <button
              onClick={handleExportPhlebotomyExcel}
              disabled={isExporting}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition flex items-center space-x-1.5 disabled:opacity-50"
              title="Download Phlebotomy Manifest Excel"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>{isExporting ? "Exporting..." : "Download Phlebo Excel"}</span>
            </button>
          </div>
        </div>

        {successBanner && (
          <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center space-x-2 font-bold shadow-xs">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successBanner}</span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Patient Queue */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-3">
            <div className="flex items-center justify-between text-xs font-bold text-slate-600 uppercase tracking-wider pb-2 border-b border-slate-100">
              <span>Waiting Patients ({employees.length})</span>
              <span className="text-rose-600 font-mono">
                {employees.filter((e) => e.bloodCollected && e.urineCollected).length} Collected
              </span>
            </div>

            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search patient, code, or agency..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 border border-slate-300 rounded-xl text-xs outline-none"
              />
            </div>

            <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
              {filtered.map((emp) => (
                <div
                  key={emp.id}
                  onClick={() => handleSelectEmp(emp)}
                  className={`p-3 rounded-xl border text-xs cursor-pointer transition space-y-1 ${
                    selectedEmp?.id === emp.id
                      ? "border-rose-500 bg-rose-50/50"
                      : "border-slate-200 hover:border-slate-300 bg-white"
                  }`}
                >
                  <div className="font-bold text-[#002642] truncate">{emp.fullName}</div>
                  <div className="text-[11px] font-mono text-teal-700">{emp.uhid}</div>
                  
                  <div className="text-[10px] font-bold text-indigo-700 flex items-center space-x-1">
                    <Building2 className="w-3 h-3" />
                    <span>{emp.agencyName || "Direct Payroll"}</span>
                  </div>

                  <div className="flex gap-1.5 pt-1">
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold ${emp.bloodCollected ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-400"}`}>
                      Blood: {emp.bloodCollected ? "DONE" : "PENDING"}
                    </span>
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold ${emp.urineCollected ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-400"}`}>
                      Urine: {emp.urineCollected ? "DONE" : "PENDING"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Barcode Scanner & Dual Collection Panel */}
          <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
            {selectedEmp ? (
              <form onSubmit={handleSubmitCollection} className="space-y-6">
                {/* Employee Card */}
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs">
                  <div>
                    <div className="font-black text-[#002642] text-sm">{selectedEmp.fullName}</div>
                    <div className="text-slate-500 font-mono">
                      UHID: {selectedEmp.uhid} | Code: {selectedEmp.empCode}
                    </div>
                    <div className="text-indigo-700 font-bold mt-0.5">
                      Agency: {selectedEmp.agencyName || "Direct Payroll"}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleMarkArrived}
                    className="px-3.5 py-1.5 bg-[#002642] hover:bg-[#001e38] text-white text-xs font-bold rounded-lg shadow-xs"
                  >
                    Mark as Arrived
                  </button>
                </div>

                {errorBanner && (
                  <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-center space-x-2 font-bold">
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>{errorBanner}</span>
                  </div>
                )}

                {/* Scanner Launch Buttons */}
                <div className="space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center space-x-1.5">
                      <Barcode className="w-4 h-4 text-rose-600" />
                      <span>Pre-Applied Kit Barcode (Vial / Zip Bag) *</span>
                    </label>

                    <div className="flex items-center space-x-2">
                      <button
                        type="button"
                        onClick={() => setIsLiveScanning(true)}
                        className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 transition shadow-sm"
                        title="Opens full live camera viewfinder with visible feed"
                      >
                        <Smartphone className="w-3.5 h-3.5" />
                        <span>Open Live Scanner</span>
                      </button>

                      <button
                        type="button"
                        onClick={triggerPhotoSnapshot}
                        className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition border border-slate-300"
                        title="Snap a photo of the barcode"
                      >
                        <Camera className="w-3.5 h-3.5" />
                        <span>Snap Photo</span>
                      </button>
                    </div>
                  </div>

                  {/* Auto-Filled Input Field */}
                  <div className="relative">
                    <Barcode className="w-5 h-5 absolute left-3 top-3 text-slate-400" />
                    <input
                      ref={barcodeRef}
                      type="text"
                      required
                      placeholder="Point camera at barcode to auto-fill, or type manually..."
                      value={barcodeInput}
                      onChange={(e) => handleManualBarcodeChange(e.target.value)}
                      className="w-full pl-10 pr-3 py-2.5 border-2 border-rose-500 focus:ring-2 focus:ring-rose-500/20 rounded-xl text-sm font-mono font-black text-[#002642] uppercase tracking-wider"
                    />
                  </div>

                  <div className="flex items-start space-x-1.5 text-[11px] text-slate-500">
                    <Info className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                    <span>
                      <strong>Live Feed Ready:</strong> Once you tap <strong>Open Live Scanner</strong>, your phone's camera feed will appear on screen. Point at the barcode to auto-fill.
                    </span>
                  </div>
                </div>

                {/* Dual Collection Checklist: Blood & Urine */}
                <div className="pt-3 border-t border-slate-100 space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Dual Sample Verification Checklist (Required for Completion)
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Blood Toggle */}
                    <label
                      onClick={() => setBloodCollected(!bloodCollected)}
                      className={`cursor-pointer border-2 rounded-xl p-4 flex items-center space-x-3 transition select-none ${
                        bloodCollected
                          ? "border-rose-600 bg-rose-50/70 text-rose-950 shadow-xs"
                          : "border-slate-200 bg-white hover:border-slate-300"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={bloodCollected}
                        onChange={() => {}}
                        className="w-5 h-5 rounded text-rose-600 focus:ring-rose-500"
                      />
                      <div>
                        <div className="font-black text-sm">Blood Sample Collected</div>
                        <div className="text-[10px] text-slate-500">EDTA / Plain / Fluoride tubes secured</div>
                      </div>
                    </label>

                    {/* Urine Toggle */}
                    <label
                      onClick={() => setUrineCollected(!urineCollected)}
                      className={`cursor-pointer border-2 rounded-xl p-4 flex items-center space-x-3 transition select-none ${
                        urineCollected
                          ? "border-amber-600 bg-amber-50/70 text-amber-950 shadow-xs"
                          : "border-slate-200 bg-white hover:border-slate-300"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={urineCollected}
                        onChange={() => {}}
                        className="w-5 h-5 rounded text-amber-600 focus:ring-amber-500"
                      />
                      <div>
                        <div className="font-black text-sm">Urine Sample Collected</div>
                        <div className="text-[10px] text-slate-500">Sterile container sealed in zip bag</div>
                      </div>
                    </label>
                  </div>
                  <span className="text-[10px] text-slate-400 block">
                    * Both samples must be verified before the employee is marked complete.
                  </span>
                </div>

                <div className="pt-4 border-t border-slate-100 flex justify-end">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-6 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-md transition disabled:opacity-50"
                  >
                    {isSubmitting ? "Securing Samples..." : "Confirm Collection & Link Barcode"}
                  </button>
                </div>
              </form>
            ) : (
              <div className="text-center py-20 text-slate-400 text-xs">
                Select a checked-in patient from the left queue to open barcode scanner.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}