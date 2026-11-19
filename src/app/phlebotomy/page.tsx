// src/app/phlebotomy/page.tsx
"use client";

import React, { useState, useEffect, useRef } from "react";
import { getCampsList } from "@/actions/camp-actions";
import {
  getStationEmployeesWithStatus,
  toggleEmployeeArrivalAtStation,
  checkBarcodeAvailability,
  submitPhlebotomyCollection,
  lookupAndVerifySampleByBarcode,
  submitPhlebotomyHandover,
  getPhlebotomyExportRoster,
  requestCorrectionUnlock,
} from "@/actions/clinical-actions";
import * as XLSX from "xlsx";
import { BrowserMultiFormatReader, IScannerControls } from "@zxing/browser";
import { BarcodeFormat, DecodeHintType } from "@zxing/library";
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
  X,
  Lock,
  Truck,
  FlaskConical,
} from "lucide-react";
import { BackButton } from "@/components/shared/BackButton";
import { StationAttendanceBar } from "@/components/shared/StationAttendanceBar";

type PhleboMode = "COLLECTION" | "VERIFY_URINE" | "HANDOVER";

export default function PhlebotomyStationPage() {
  const [camps, setCamps] = useState<any[]>([]);
  const [selectedCampId, setSelectedCampId] = useState("");
  const [employees, setEmployees] = useState<any[]>([]);
  const [selectedEmp, setSelectedEmp] = useState<any | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [mode, setMode] = useState<PhleboMode>("COLLECTION");
  const [queueTab, setQueueTab] = useState<"pending" | "completed">("pending");

  const [barcodeInput, setBarcodeInput] = useState("");
  const [bloodCollected, setBloodCollected] = useState(false);
  const [urineCollected, setUrineCollected] = useState(false);
  const [specialCollected, setSpecialCollected] = useState(false);
  const [errorBanner, setErrorBanner] = useState("");
  const [successBanner, setSuccessBanner] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const [quickScanInput, setQuickScanInput] = useState("");
  const [verifiedUrineEmp, setVerifiedUrineEmp] = useState<any | null>(null);
  const [phleboName, setPhleboName] = useState("");
  const [riderName, setRiderName] = useState("");
  const [phleboAck, setPhleboAck] = useState(false);
  const [riderAck, setRiderAck] = useState(false);
  const [handoverScannedEmps, setHandoverScannedEmps] = useState<any[]>([]);

  const [isLiveScanning, setIsLiveScanning] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);
  const [cameraLoading, setCameraLoading] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const scannerControlsRef = useRef<IScannerControls | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const barcodeRef = useRef<HTMLInputElement | null>(null);
  const photoInputRef = useRef<HTMLInputElement | null>(null);

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
    } catch {}
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
    const list = await getStationEmployeesWithStatus(selectedCampId, "PHLEBOTOMY");
    setEmployees(list);
    if (selectedEmp) {
      const updated = list.find((e) => e.id === selectedEmp.id);
      if (updated) setSelectedEmp(updated);
    }
  };

  useEffect(() => {
    loadList();
  }, [selectedCampId]);

  const handleSelectEmp = (emp: any) => {
    setSelectedEmp(emp);
    setBarcodeInput(emp.labKitBarcode || "");
    setBloodCollected(emp.bloodCollected || false);
    setUrineCollected(emp.urineCollected || false);
    setSpecialCollected(emp.specialContainerCollected || false);
    setErrorBanner("");
    setSuccessBanner("");
    setTimeout(() => barcodeRef.current?.focus(), 150);
  };

  const handleToggleArrived = async () => {
    if (!selectedEmp) return;
    const res = await toggleEmployeeArrivalAtStation({
      employeeId: selectedEmp.id,
      campId: selectedCampId,
      station: "PHLEBOTOMY",
    });
    if (res.success) {
      setSelectedEmp({ ...selectedEmp, arrivalStatus: res.arrivalStatus });
      loadList();
    }
  };

  // Instant Duplicate Barcode Check (runs immediately on scan or change)
  const validateBarcodeInstant = async (code: string) => {
    if (!selectedEmp || !code.trim()) return;
    const check = await checkBarcodeAvailability({ barcode: code, employeeId: selectedEmp.id });
    if (!check.available) {
      setErrorBanner(check.error || "Duplicate barcode!");
    } else {
      setErrorBanner("");
    }
  };

  const handleBarcodeDetected = async (rawText: string) => {
    const cleanCode = rawText.trim().toUpperCase();
    playScannerBeep();
    if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
    setIsLiveScanning(false);

    if (mode === "COLLECTION") {
      setBarcodeInput(cleanCode);
      setSuccessBanner(`✓ Scanned & Auto-Filled Barcode: ${cleanCode}`);
      await validateBarcodeInstant(cleanCode);
    } else if (mode === "VERIFY_URINE") {
      setQuickScanInput(cleanCode);
      await handleVerifyUrineLookup(cleanCode, true);
    } else if (mode === "HANDOVER") {
      setQuickScanInput(cleanCode);
      await handleHandoverScanLookup(cleanCode);
    }
  };

  // Ultra-Fast Camera Loop: Native Hardware BarcodeDetector first (~20ms), ZXing targeted fallback
  useEffect(() => {
    if (!isLiveScanning) {
      if (scannerControlsRef.current) {
        scannerControlsRef.current.stop();
        scannerControlsRef.current = null;
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      if (videoRef.current) videoRef.current.srcObject = null;
      setTorchOn(false);
      setHasTorch(false);
      setCameraLoading(false);
      return;
    }

    let isSubscribed = true;
    let rafId: number | null = null;
    setCameraLoading(true);

    async function initFastCamera() {
      try {
        const isSecure =
          typeof window !== "undefined" &&
          (window.isSecureContext ||
            window.location.hostname === "localhost" ||
            window.location.hostname === "127.0.0.1");

        if (!isSecure && window.location.protocol === "http:" && window.location.hostname !== "localhost") {
          throw new Error("Camera stream requires HTTPS.");
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1280 },
            height: { ideal: 720 },
            // @ts-expect-error continuous autofocus hint for mobile rear cameras
            focusMode: "continuous",
          },
          audio: false,
        });

        if (!isSubscribed) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setCameraLoading(false);

          const track = stream.getVideoTracks()[0];
          const caps = (track as any)?.getCapabilities?.();
          if (caps?.torch) setHasTorch(true);
        }

        // Fast Path: Native Hardware BarcodeDetector
        if (typeof window !== "undefined" && "BarcodeDetector" in window) {
          const detector = new (window as any).BarcodeDetector({
            formats: ["code_128", "code_39", "ean_13", "ean_8", "qr_code", "codabar"],
          });
          const scanLoop = async () => {
            if (!isSubscribed || !videoRef.current) return;
            try {
              if (videoRef.current.readyState >= 2) {
                const results = await detector.detect(videoRef.current);
                if (results && results.length > 0 && isSubscribed) {
                  await handleBarcodeDetected(results[0].rawValue);
                  return;
                }
              }
            } catch {}
            rafId = requestAnimationFrame(scanLoop);
          };
          rafId = requestAnimationFrame(scanLoop);
          return;
        }

        // Fallback: Targeted ZXing (only common lab formats)
        const hints = new Map();
        hints.set(DecodeHintType.POSSIBLE_FORMATS, [
          BarcodeFormat.CODE_128,
          BarcodeFormat.CODE_39,
          BarcodeFormat.EAN_13,
          BarcodeFormat.QR_CODE,
        ]);
        const codeReader = new BrowserMultiFormatReader(hints, { delayBetweenScanAttempts: 100 });
        const controls = await codeReader.decodeFromVideoElement(videoRef.current!, (result) => {
          if (result && isSubscribed) {
            handleBarcodeDetected(result.getText());
          }
        });
        scannerControlsRef.current = controls;
      } catch (err: any) {
        if (isSubscribed) {
          setErrorBanner("Camera error: " + (err?.message || "Check camera permissions."));
          setIsLiveScanning(false);
          setCameraLoading(false);
        }
      }
    }

    const timer = setTimeout(initFastCamera, 80);
    return () => {
      isSubscribed = false;
      clearTimeout(timer);
      if (rafId !== null) cancelAnimationFrame(rafId);
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
        await (track as any).applyConstraints({ advanced: [{ torch: nextTorch }] });
        setTorchOn(nextTorch);
      } catch {}
    }
  };

  const handlePhotoCaptured = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      if (typeof window !== "undefined" && "BarcodeDetector" in window) {
        const detector = new (window as any).BarcodeDetector({
          formats: ["code_128", "code_39", "ean_13", "ean_8", "qr_code", "codabar"],
        });
        const bitmap = await createImageBitmap(file);
        const detected = await detector.detect(bitmap);
        if (detected?.length > 0) {
          await handleBarcodeDetected(detected[0].rawValue);
          e.target.value = "";
          return;
        }
      }
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const codeReader = new BrowserMultiFormatReader();
          const result = await codeReader.decodeFromImageUrl(reader.result as string);
          if (result) await handleBarcodeDetected(result.getText());
          else setErrorBanner("Could not detect barcode from photo.");
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

  const handleSubmitCollection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmp) return;
    if (selectedEmp.arrivalStatus === "PENDING") {
      setErrorBanner("Mandatory Rule: Please click 'Mark As Arrived' first before saving sample collection.");
      return;
    }
    if (!barcodeInput.trim()) {
      setErrorBanner("Please scan or enter the pre-applied lab kit barcode.");
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
      specialContainerCollected: specialCollected,
    });
    setIsSubmitting(false);

    if (res.success) {
      setSuccessBanner(`Barcode ${barcodeInput} locked to ${selectedEmp.fullName}.`);
      setSelectedEmp(null);
      setBarcodeInput("");
      loadList();
    } else {
      setErrorBanner(res.error || "Collection failed.");
    }
  };

  const handleRequestBarcodeUnlock = async () => {
    if (!selectedEmp) return;
    const reason = prompt(`Why does ${selectedEmp.fullName}'s locked barcode (${selectedEmp.labKitBarcode}) need change?`);
    if (!reason?.trim()) return;
    const res = await requestCorrectionUnlock({
      campId: selectedCampId,
      employeeId: selectedEmp.id,
      station: "PHLEBOTOMY",
      reason,
    });
    if (res.success) setSuccessBanner("Barcode unlock request sent to Camp Coordinator Desk.");
  };

  const handleVerifyUrineLookup = async (code: string, markUrine: boolean) => {
    if (!code.trim() || !selectedCampId) return;
    setErrorBanner("");
    const res = await lookupAndVerifySampleByBarcode({
      campId: selectedCampId,
      scannedBarcode: code,
      markUrineCollected: markUrine,
    });
    if (res.success && res.employee) {
      setVerifiedUrineEmp(res.employee);
      setSuccessBanner(
        res.urineUpdated
          ? `✓ Urine marked COLLECTED for ${res.employee.fullName} (${res.employee.uhid})!`
          : `Matched: ${res.employee.fullName} (${res.employee.uhid})`
      );
      loadList();
    } else {
      setErrorBanner(res.error || "Barcode not found in this camp.");
    }
  };

  const handleHandoverScanLookup = async (code: string) => {
    if (!code.trim() || !selectedCampId) return;
    setErrorBanner("");
    const res = await lookupAndVerifySampleByBarcode({
      campId: selectedCampId,
      scannedBarcode: code,
      markUrineCollected: false,
    });
    if (res.success && res.employee) {
      setHandoverScannedEmps((prev) => {
        if (prev.some((e) => e.id === res.employee.id)) return prev;
        return [res.employee, ...prev];
      });
      setQuickScanInput("");
      if (res.employee.handoverVerified) {
        setErrorBanner(
          `⚠️ BATCH DUPLICATION FLAG: ${res.employee.fullName} (${code}) was already handed over in Batch #${res.employee.handoverBatchNumber} (Rider: ${res.employee.handoverRiderName}).`
        );
      } else {
        setSuccessBanner(`✓ Added ${res.employee.fullName} (${code}) to Handover Batch.`);
      }
    } else {
      setErrorBanner(res.error || "Barcode not found in this camp.");
    }
  };

  const handleConfirmHandover = async () => {
    if (!phleboName.trim() || !riderName.trim()) {
      setErrorBanner("Enter both Phlebotomist Name and Rider Name.");
      return;
    }
    if (!phleboAck || !riderAck) {
      setErrorBanner("Both Phlebotomist and Rider acknowledgment checkboxes are required.");
      return;
    }
    const res = await submitPhlebotomyHandover({
      campId: selectedCampId,
      phleboName,
      riderName,
      phleboAcknowledged: phleboAck,
      riderAcknowledged: riderAck,
      handoverType: "CAMP_TO_RIDER",
      verifiedEmployeeIds: handoverScannedEmps.map((e) => e.id),
    });
    if (res.success) {
      setSuccessBanner(`Handover Batch #${res.batchNumber} confirmed for ${handoverScannedEmps.length} sample(s) with Rider ${riderName}!`);
      setHandoverScannedEmps([]);
      setPhleboAck(false);
      setRiderAck(false);
      loadList();
    } else {
      setErrorBanner(res.error || "Handover failed.");
    }
  };

  const handleExportExcel = async (carriedOnly: boolean) => {
    if (!selectedCampId) return;
    setIsExporting(true);
    try {
      const data = await getPhlebotomyExportRoster(selectedCampId, carriedOnly);
      if (!data || data.employees.length === 0) {
        alert(carriedOnly ? "No carried/collected samples found to export yet." : "No employee records found.");
        setIsExporting(false);
        return;
      }

      const exportRows = data.employees.map((row) => ({
        "Sr. No": row.srNo,
        "Employee Name": row.employeeName,
        Age: row.age,
        Sex: row.sex,
        "Contact No": row.contactNo,
        "Agency Name": row.agencyName,
        "Client Name": row.clientName,
        UHID: row.uhid,
        "Barcode Details": row.barcodeDetails,
        "Sample Type Collected": row.sampleType,
        Blood: row.bloodStatus,
        Urine: row.urineStatus,
        "Special Tube": row.specialTubeStatus,
        "Collection Timestamp (DDMMYYYY, HHMMSS)": row.collectedTimestamp,
        "Handover Status": row.handoverStatus,
        "Phlebo Name": row.phleboName,
        "Rider Name": row.riderName,
        "Handover Timestamp (DDMMYYYY, HHMMSS)": row.handoverTimestamp,
      }));

      const ws = XLSX.utils.json_to_sheet(exportRows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, carriedOnly ? "Handover Carried Samples" : "Phlebo All Roster");
      const cleanCampName = data.campName.replace(/[^a-zA-Z0-9_-]/g, "_");
      XLSX.writeFile(
        wb,
        carriedOnly
          ? `Lab_Handover_Carried_Samples_${cleanCampName}.xlsx`
          : `Phlebotomy_Full_Roster_${cleanCampName}.xlsx`
      );
    } catch (err: any) {
      alert("Export failed: " + err.message);
    } finally {
      setIsExporting(false);
    }
  };

  const isEmpComplete = (emp: any) =>
    emp.bloodCollected && emp.urineCollected && (!emp.specialContainerRequired || emp.specialContainerCollected);

  const pendingList = employees.filter((e) => !isEmpComplete(e));
  const completedList = employees.filter((e) => isEmpComplete(e));
  const activeQueue = queueTab === "pending" ? pendingList : completedList;

  const filtered = activeQueue.filter(
    (e) =>
      e.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.empCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.uhid.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (e.agencyName && e.agencyName.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const isArrived = selectedEmp?.arrivalStatus === "ARRIVED";

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 p-4 sm:p-6 space-y-5">
      <input ref={photoInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhotoCaptured} />

      {isLiveScanning && (
        <div className="fixed inset-0 z-50 bg-black flex flex-col justify-between p-4 sm:p-6">
          <div className="flex items-center justify-between text-white z-20">
            <div className="flex items-center space-x-2">
              <span className="w-2.5 h-2.5 bg-red-500 rounded-full animate-ping" />
              <span className="font-bold text-sm uppercase tracking-wider text-emerald-400">Ultra-Fast Barcode Scanner</span>
            </div>
            <div className="flex items-center space-x-2">
              {hasTorch && (
                <button type="button" onClick={toggleTorch} className={`p-2.5 rounded-full border ${torchOn ? "bg-amber-400 text-amber-950" : "bg-white/10 text-white"}`}>
                  <Zap className="w-5 h-5" />
                </button>
              )}
              <button type="button" onClick={() => setIsLiveScanning(false)} className="p-2.5 rounded-full bg-white/10 text-white border border-white/20">
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="relative w-full max-w-sm mx-auto aspect-[4/3] rounded-3xl overflow-hidden border-2 border-emerald-500 shadow-2xl bg-slate-950 flex items-center justify-center">
            <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
            {cameraLoading && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 text-white space-y-2 z-10">
                <div className="w-8 h-8 border-4 border-emerald-400 border-t-transparent rounded-full animate-spin" />
                <span className="text-xs font-bold">Connecting Camera...</span>
              </div>
            )}
            <div className="absolute inset-0 pointer-events-none p-6 flex flex-col justify-between z-10">
              <div className="flex justify-between">
                <div className="w-8 h-8 border-t-4 border-l-4 border-emerald-400 rounded-tl-lg" />
                <div className="w-8 h-8 border-t-4 border-r-4 border-emerald-400 rounded-tr-lg" />
              </div>
              <div className="w-full h-0.5 bg-red-500 shadow-[0_0_12px_#ef4444] animate-pulse" />
              <div className="flex justify-between">
                <div className="w-8 h-8 border-b-4 border-l-4 border-emerald-400 rounded-bl-lg" />
                <div className="w-8 h-8 border-b-4 border-r-4 border-emerald-400 rounded-br-lg" />
              </div>
            </div>
          </div>

          <div className="text-center text-white/80 text-xs pb-2">Point camera at vial or zip-bag barcode</div>
        </div>
      )}

      <div className="max-w-6xl mx-auto space-y-5">
        <BackButton fallbackHref="/admin" label="Back to Dashboard" />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
          <div>
            <div className="flex items-center space-x-2 text-rose-600 font-bold text-xs uppercase tracking-wider">
              <Barcode className="w-4 h-4" />
              <span>Phlebotomy & Lab Handover Station</span>
            </div>
            <h1 className="text-2xl font-black text-[#002642] tracking-tight mt-0.5">
              Barcode Scanner, Sample Lock & Rider Handover
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <StationAttendanceBar campId={selectedCampId} stationName="PHLEBOTOMY" />
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
              onClick={() => handleExportExcel(false)}
              disabled={isExporting}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center space-x-1.5"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>All Roster Excel</span>
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 bg-slate-200/70 p-1 rounded-xl w-fit text-xs font-bold">
          <button onClick={() => { setMode("COLLECTION"); setErrorBanner(""); setSuccessBanner(""); }} className={`px-4 py-1.5 rounded-lg ${mode === "COLLECTION" ? "bg-white text-[#002642] shadow-xs" : "text-slate-600"}`}>
            1. Sample Collection
          </button>
          <button onClick={() => { setMode("VERIFY_URINE"); setErrorBanner(""); setSuccessBanner(""); }} className={`px-4 py-1.5 rounded-lg flex items-center space-x-1 ${mode === "VERIFY_URINE" ? "bg-white text-amber-700 shadow-xs" : "text-slate-600"}`}>
            <FlaskConical className="w-3.5 h-3.5" />
            <span>2. Scan-to-Verify Urine</span>
          </button>
          <button onClick={() => { setMode("HANDOVER"); setErrorBanner(""); setSuccessBanner(""); }} className={`px-4 py-1.5 rounded-lg flex items-center space-x-1 ${mode === "HANDOVER" ? "bg-white text-indigo-700 shadow-xs" : "text-slate-600"}`}>
            <Truck className="w-3.5 h-3.5" />
            <span>3. Lab Handover (Rider)</span>
          </button>
        </div>

        {successBanner && (
          <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center space-x-2 font-bold">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successBanner}</span>
          </div>
        )}

        {errorBanner && (
          <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-center space-x-2 font-bold">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorBanner}</span>
          </div>
        )}

        {/* MODE 1: COLLECTION */}
        {mode === "COLLECTION" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-3">
              <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-bold">
                <button onClick={() => setQueueTab("pending")} className={`flex-1 py-1.5 rounded-lg ${queueTab === "pending" ? "bg-white text-[#002642] shadow-xs" : "text-slate-500"}`}>
                  Waiting ({pendingList.length})
                </button>
                <button onClick={() => setQueueTab("completed")} className={`flex-1 py-1.5 rounded-lg ${queueTab === "completed" ? "bg-white text-emerald-700 shadow-xs" : "text-slate-500"}`}>
                  Secured ({completedList.length})
                </button>
              </div>

              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                <input type="text" placeholder="Search patient, code, or agency..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-8 pr-3 py-1.5 border border-slate-300 rounded-xl text-xs outline-none" />
              </div>

              <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
                {filtered.map((emp) => (
                  <div key={emp.id} onClick={() => handleSelectEmp(emp)} className={`p-3 rounded-xl border text-xs cursor-pointer transition space-y-1 ${selectedEmp?.id === emp.id ? "border-rose-500 bg-rose-50/50" : "border-slate-200 bg-white"}`}>
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-bold text-[#002642] truncate">{emp.fullName}</div>
                      {emp.arrivalStatus === "ARRIVED" && <span className="px-1.5 py-0.5 rounded bg-blue-600 text-white text-[9px] font-bold">Arrived</span>}
                    </div>
                    <div className="text-[11px] font-mono text-teal-700">{emp.uhid}</div>
                    <div className="text-[10px] font-bold text-indigo-700 flex items-center space-x-1">
                      <Building2 className="w-3 h-3" />
                      <span>{emp.agencyName || "Direct Payroll"}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
              {selectedEmp ? (
                <form onSubmit={handleSubmitCollection} className="space-y-5">
                  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs">
                    <div>
                      <div className="font-black text-[#002642] text-sm">{selectedEmp.fullName}</div>
                      <div className="text-slate-500 font-mono">UHID: {selectedEmp.uhid} | Code: {selectedEmp.empCode}</div>
                      <div className="text-indigo-700 font-bold mt-0.5">Agency: {selectedEmp.agencyName || "Direct Payroll"}</div>
                    </div>
                    <button type="button" onClick={handleToggleArrived} className={`px-3.5 py-1.5 text-white text-xs font-bold rounded-lg shadow-xs ${isArrived ? "bg-blue-600" : "bg-[#002642]"}`}>
                      {isArrived ? "Arrived" : "Mark As Arrived"}
                    </button>
                  </div>

                  {!isArrived && selectedEmp.arrivalStatus === "PENDING" && (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs font-bold text-amber-900 flex items-center space-x-2">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>Mandatory: Click &quot;Mark As Arrived&quot; above before saving samples.</span>
                    </div>
                  )}

                  <div className="space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center space-x-1.5">
                        <Barcode className="w-4 h-4 text-rose-600" />
                        <span>Pre-Applied Kit Barcode *</span>
                      </label>
                      {!selectedEmp.barcodeLocked && (
                        <div className="flex items-center space-x-2">
                          <button type="button" onClick={() => setIsLiveScanning(true)} className="px-3.5 py-1.5 bg-rose-600 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5">
                            <Smartphone className="w-3.5 h-3.5" />
                            <span>Open Live Scanner</span>
                          </button>
                          <button type="button" onClick={() => photoInputRef.current?.click()} className="px-3 py-1.5 bg-slate-100 border border-slate-300 text-slate-700 rounded-xl text-xs font-bold flex items-center space-x-1.5">
                            <Camera className="w-3.5 h-3.5" />
                            <span>Snap Photo</span>
                          </button>
                        </div>
                      )}
                    </div>

                    {selectedEmp.barcodeLocked && (
                      <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between text-xs">
                        <span className="flex items-center space-x-1.5 font-bold text-amber-900">
                          <Lock className="w-3.5 h-3.5 text-amber-600" />
                          <span>Barcode Locked to {selectedEmp.labKitBarcode}</span>
                        </span>
                        <button type="button" onClick={handleRequestBarcodeUnlock} className="px-2.5 py-1 bg-amber-600 text-white rounded-lg font-bold text-[11px]">
                          Request Coordinator Unlock
                        </button>
                      </div>
                    )}

                    <input
                      ref={barcodeRef}
                      type="text"
                      required
                      readOnly={selectedEmp.barcodeLocked}
                      placeholder="Scan or type barcode..."
                      value={barcodeInput}
                      onChange={(e) => {
                        const val = e.target.value.toUpperCase();
                        setBarcodeInput(val);
                        if (val.length >= 4) validateBarcodeInstant(val);
                      }}
                      className="w-full px-4 py-2.5 border-2 border-rose-500 rounded-xl text-sm font-mono font-black text-[#002642] uppercase read-only:bg-slate-100 read-only:border-slate-300"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <label onClick={() => setBloodCollected(!bloodCollected)} className={`cursor-pointer border-2 rounded-xl p-4 flex items-center space-x-3 ${bloodCollected ? "border-rose-600 bg-rose-50/70" : "border-slate-200"}`}>
                      <input type="checkbox" checked={bloodCollected} onChange={() => {}} className="w-5 h-5" />
                      <div>
                        <div className="font-black text-sm">Blood Sample Collected</div>
                        <div className="text-[10px] text-slate-500">EDTA / Plain / Fluoride tubes</div>
                      </div>
                    </label>
                    <label onClick={() => setUrineCollected(!urineCollected)} className={`cursor-pointer border-2 rounded-xl p-4 flex items-center space-x-3 ${urineCollected ? "border-amber-600 bg-amber-50/70" : "border-slate-200"}`}>
                      <input type="checkbox" checked={urineCollected} onChange={() => {}} className="w-5 h-5" />
                      <div>
                        <div className="font-black text-sm">Urine Sample Collected</div>
                        <div className="text-[10px] text-slate-500">Leave unchecked if pending</div>
                      </div>
                    </label>
                    {selectedEmp.specialContainerRequired && (
                      <label onClick={() => setSpecialCollected(!specialCollected)} className={`sm:col-span-2 cursor-pointer border-2 rounded-xl p-4 flex items-center space-x-3 ${specialCollected ? "border-purple-600 bg-purple-50/70" : "border-slate-200"}`}>
                        <input type="checkbox" checked={specialCollected} onChange={() => {}} className="w-5 h-5" />
                        <div>
                          <div className="font-black text-sm">Special Container: {selectedEmp.specialContainerName || "Heavy Metal Tube"}</div>
                        </div>
                      </label>
                    )}
                  </div>

                  <div className="flex justify-end">
                    <button type="submit" disabled={isSubmitting} className="px-6 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-md">
                      {isSubmitting ? "Securing..." : "Confirm Collection & Lock Barcode"}
                    </button>
                  </div>
                </form>
              ) : (
                <div className="text-center py-20 text-slate-400 text-xs">Select a patient from the queue.</div>
              )}
            </div>
          </div>
        )}

        {/* MODE 2: SCAN-TO-VERIFY URINE */}
        {mode === "VERIFY_URINE" && (
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4 max-w-2xl">
            <h2 className="text-lg font-black text-[#002642]">Scan-to-Verify Dropped Urine (Selected Camp Only)</h2>
            <div className="flex flex-wrap gap-2">
              <input
                type="text"
                placeholder="Scan or type barcode..."
                value={quickScanInput}
                onChange={(e) => setQuickScanInput(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === "Enter" && handleVerifyUrineLookup(quickScanInput, true)}
                className="flex-1 min-w-[200px] px-3 py-2 border-2 border-amber-500 rounded-xl text-sm font-mono font-bold uppercase"
              />
              <button type="button" onClick={() => setIsLiveScanning(true)} className="px-4 py-2 bg-rose-600 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5">
                <Smartphone className="w-4 h-4" />
                <span>Live Scanner</span>
              </button>
              <button type="button" onClick={() => handleVerifyUrineLookup(quickScanInput, true)} className="px-4 py-2 bg-amber-600 text-white rounded-xl text-xs font-bold">
                Verify & Mark Urine
              </button>
            </div>
            {verifiedUrineEmp && (
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-xs">
                <div className="font-black text-sm">{verifiedUrineEmp.fullName} ({verifiedUrineEmp.uhid})</div>
                <div>Agency: {verifiedUrineEmp.agencyName} • Blood: {verifiedUrineEmp.bloodCollected ? "DONE" : "PENDING"} • Urine: {verifiedUrineEmp.urineCollected ? "DONE" : "PENDING"}</div>
              </div>
            )}
          </div>
        )}

        {/* MODE 3: LAB HANDOVER (MULTI-BATCH + CARRIED SAMPLES EXCEL) */}
        {mode === "HANDOVER" && (
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h2 className="text-lg font-black text-[#002642]">Bulk Lab Handover (Multi-Batch + Dual Ack)</h2>
                <p className="text-xs text-slate-500">Exports ONLY carried/collected samples in DDMMYYYY, HHMMSS format.</p>
              </div>
              <button
                type="button"
                onClick={() => handleExportExcel(true)}
                disabled={isExporting}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>Download Handover Excel (Carried Samples Only)</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block font-bold text-slate-600 mb-1">Phlebotomist Name *</label>
                <input type="text" value={phleboName} onChange={(e) => setPhleboName(e.target.value)} placeholder="e.g. Rahul Parmar" className="w-full px-3 py-2 border rounded-xl" />
                <label className="flex items-center space-x-2 mt-2 font-bold text-slate-700 cursor-pointer">
                  <input type="checkbox" checked={phleboAck} onChange={(e) => setPhleboAck(e.target.checked)} />
                  <span>Phlebotomist Acknowledges Samples Handed Over</span>
                </label>
              </div>
              <div>
                <label className="block font-bold text-slate-600 mb-1">Lab Rider Name *</label>
                <input type="text" value={riderName} onChange={(e) => setRiderName(e.target.value)} placeholder="e.g. Mahesh Solanki" className="w-full px-3 py-2 border rounded-xl" />
                <label className="flex items-center space-x-2 mt-2 font-bold text-slate-700 cursor-pointer">
                  <input type="checkbox" checked={riderAck} onChange={(e) => setRiderAck(e.target.checked)} />
                  <span>Rider Acknowledges Physical Receipt</span>
                </label>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <input
                type="text"
                placeholder="Scan sample barcode into handover box..."
                value={quickScanInput}
                onChange={(e) => setQuickScanInput(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === "Enter" && handleHandoverScanLookup(quickScanInput)}
                className="flex-1 min-w-[200px] px-3 py-2 border-2 border-indigo-500 rounded-xl text-sm font-mono font-bold uppercase"
              />
              <button type="button" onClick={() => setIsLiveScanning(true)} className="px-4 py-2 bg-rose-600 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5">
                <Smartphone className="w-4 h-4" />
                <span>Scan via Camera</span>
              </button>
              <button type="button" onClick={() => handleHandoverScanLookup(quickScanInput)} className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold">
                Add to Handover
              </button>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100 max-h-64 overflow-y-auto">
              {handoverScannedEmps.map((emp) => (
                <div key={emp.id} className="px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div>
                    <span className="font-bold text-[#002642]">{emp.fullName}</span>{" "}
                    <span className="font-mono text-slate-500">({emp.labKitBarcode})</span>
                    {emp.handoverVerified && (
                      <span className="ml-2 px-2 py-0.5 bg-amber-100 text-amber-800 rounded text-[10px] font-bold">
                        FLAG: Prev Batch #{emp.handoverBatchNumber}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-1.5 font-mono text-[10px] font-bold">
                    <span className={`px-2 py-0.5 rounded ${emp.bloodCollected ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-700"}`}>
                      Blood: {emp.bloodCollected ? "OK" : "MISSING"}
                    </span>
                    <span className={`px-2 py-0.5 rounded ${emp.urineCollected ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>
                      Urine: {emp.urineCollected ? "OK" : "MISSING"}
                    </span>
                    {emp.specialContainerRequired && (
                      <span className={`px-2 py-0.5 rounded ${emp.specialContainerCollected ? "bg-purple-100 text-purple-800" : "bg-rose-100 text-rose-700"}`}>
                        {emp.specialContainerName || "Special"}: {emp.specialContainerCollected ? "OK" : "MISSING"}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleConfirmHandover}
                disabled={handoverScannedEmps.length === 0}
                className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md disabled:opacity-40"
              >
                Confirm Handover Batch ({handoverScannedEmps.length} Samples)
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}