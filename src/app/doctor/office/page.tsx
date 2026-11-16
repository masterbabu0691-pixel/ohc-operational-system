// src/app/doctor/office/page.tsx
"use client";

import React, { useState, useEffect, useRef } from "react";
import { getCampsList } from "@/actions/camp-actions";
import { getCampReceptionList } from "@/actions/reception-actions";
import { submitOfficeDoctorReview } from "@/actions/clinical-actions";
import {
  getEmployeeFullDossier,
  officeDoctorUpdateEmployeeData,
} from "@/actions/diagnostic-actions";
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Building2,
  Search,
  RotateCcw,
  Printer,
  ShieldCheck,
  Edit3,
  X,
} from "lucide-react";
import { BackButton } from "@/components/shared/BackButton";

type FitnessOption = "FIT" | "FIT_WITH_CONDITION" | "TEMPORARILY_UNFIT_FOLLOW_UP" | "UNFIT";

export default function OfficeDoctorPortal() {
  const [camps, setCamps] = useState<any[]>([]);
  const [selectedCampId, setSelectedCampId] = useState("");
  const [employees, setEmployees] = useState<any[]>([]);
  const [selectedEmp, setSelectedEmp] = useState<any | null>(null);
  const [dossier, setDossier] = useState<any | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Editable Clinical Fields (Office Doctor Override)
  const [pastHistory, setPastHistory] = useState("");
  const [coMorbidities, setCoMorbidities] = useState("");
  const [bloodGroup, setBloodGroup] = useState("");
  const [editBpSys, setEditBpSys] = useState("");
  const [editBpDia, setEditBpDia] = useState("");
  const [editPulse, setEditPulse] = useState("");
  const [editSpo2, setEditSpo2] = useState("");

  // Office Doctor Review State
  const [officeDoctorName] = useState("Dr. S. Mukherjee, MBBS, AFIH");
  const [officeDoctorRegNo] = useState("G-44210");
  const [vitalsRemark, setVitalsRemark] = useState("Vitals within acceptable occupational limits.");
  const [labRemark, setLabRemark] = useState("Normal blood count & routine biochemistry.");
  const [xrayRemark, setXrayRemark] = useState("Chest X-Ray Normal PA View.");
  const [pftRemark, setPftRemark] = useState("Spirometry FEV1/FVC ratio > 75%, normal loop.");
  const [audioRemark, setAudioRemark] = useState("Bilateral normal hearing threshold.");
  const [fitnessStatus, setFitnessStatus] = useState<FitnessOption>("FIT");
  const [followUpDate, setFollowUpDate] = useState("");
  const [adviceSummary, setAdviceSummary] = useState("Annual periodic surveillance recommended.");

  const [showReportModal, setShowReportModal] = useState(false);

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
    async function loadDossier() {
      if (selectedEmp && selectedCampId) {
        const d = await getEmployeeFullDossier(selectedEmp.id, selectedCampId);
        setDossier(d);
        if (d?.employee) {
          setPastHistory(d.employee.pastHistory || "Nil");
          setCoMorbidities(d.employee.coMorbidities || "Nil");
          setBloodGroup(d.employee.bloodGroup || "");
          setEditBpSys(d.employee.doctorBpSystolic || d.employee.nurseBpSystolic || "");
          setEditBpDia(d.employee.doctorBpDiastolic || d.employee.nurseBpDiastolic || "");
          setEditPulse(d.employee.doctorPulseBpm || d.employee.nursePulseBpm || "");
          setEditSpo2(d.employee.doctorSpo2 || d.employee.nurseSpo2 || "");
        }
      }
    }
    loadDossier();
  }, [selectedEmp, selectedCampId]);

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
      canvas.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
      setSignatureData(null);
    }
  };

  const handleSaveDoctorEdits = async () => {
    if (!selectedEmp) return;
    const res = await officeDoctorUpdateEmployeeData({
      employeeId: selectedEmp.id,
      pastHistory,
      coMorbidities,
      bloodGroup,
      bpSystolic: editBpSys,
      bpDiastolic: editBpDia,
      pulseBpm: editPulse,
      spo2: editSpo2,
    });
    if (res.success) {
      alert("Clinical details updated & logged.");
    } else {
      alert(res.error);
    }
  };

  const handleSubmitSignOff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmp) return;

    if (fitnessStatus !== "FIT" && !adviceSummary.trim()) {
      alert("Remark / Reason is mandatory when selecting Fit with Condition, Follow-Up, or Unfit.");
      return;
    }

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
      alert(`Certified as ${fitnessStatus} for ${selectedEmp.fullName}!`);
      setShowReportModal(true);
      loadList();
    } else {
      alert("Error: " + res.error);
    }
  };

  const filtered = employees.filter(
    (e) =>
      e.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.empCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.uhid.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (e.agencyName && e.agencyName.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const labDiag = dossier?.diagnostics?.find((d: any) => d.station === "PATHOLOGY_LAB");
  const labData = labDiag?.structuredData || {};
  const activeCamp = camps.find((c) => c.id === selectedCampId);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 p-4 sm:p-6 space-y-5">
      <div className="max-w-7xl mx-auto space-y-5">
        <BackButton fallbackHref="/admin" label="Back to Dashboard" />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
          <div>
            <h1 className="text-2xl font-black text-[#002642]">Office Doctor Review & Legal Sign-Off</h1>
            <p className="text-xs text-slate-500">
              Review all station reports, attached media, edit clinical details if needed, and issue final fitness.
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

            <div className="space-y-2 max-h-[600px] overflow-y-auto">
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

          {/* Full Review + Edit + Sign-Off */}
          <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-6">
            {selectedEmp ? (
              <>
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs">
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
                    onClick={() => setShowReportModal(true)}
                    className="px-3.5 py-1.5 bg-[#002642] hover:bg-[#001e38] text-white rounded-lg font-bold flex items-center space-x-1.5"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Preview Report</span>
                  </button>
                </div>

                {/* Reception + Nurse + Field Exam + Media Summary */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="p-3 bg-teal-50 border border-teal-200 rounded-xl">
                    <div className="font-bold text-teal-900">Anthropometry & Vision</div>
                    <div className="mt-1 text-teal-800">
                      Ht: {dossier?.employee?.heightCm || "-"} cm • Wt: {dossier?.employee?.weightKg || "-"} kg • BMI: {dossier?.employee?.bmi || "-"}
                    </div>
                    <div className="text-teal-800">
                      Vision: R {dossier?.employee?.nurseVisionDistanceRight || "-"} / L {dossier?.employee?.nurseVisionDistanceLeft || "-"} ({dossier?.employee?.nurseColorVision || "Normal"})
                    </div>
                  </div>
                  <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl">
                    <div className="font-bold text-indigo-900">Field Doctor Exam</div>
                    <div className="mt-1 text-indigo-800">
                      CVS: {dossier?.fieldExam?.cvsFinding || "Pending"} • RS: {dossier?.fieldExam?.rsFinding || "Pending"}
                    </div>
                    <div className="text-indigo-800">
                      Kit Barcode: {dossier?.employee?.labKitBarcode || "Not Scanned"}
                    </div>
                  </div>
                </div>

                {/* Uploaded Diagnostic & Lab Media Viewer */}
                {dossier?.diagnostics?.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      Uploaded Diagnostic Reports & Films ({dossier.diagnostics.length})
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {dossier.diagnostics.map((diag: any) => (
                        <div key={diag.id} className="p-3 border border-slate-200 rounded-xl text-xs space-y-2">
                          <div className="flex justify-between font-bold text-[#002642]">
                            <span>{diag.station.replace("_", " ")}</span>
                            {diag.isAbnormal && <span className="text-rose-600">ABNORMAL</span>}
                          </div>
                          <div className="text-slate-600">{diag.findingsSummary}</div>
                          {Array.isArray(diag.attachmentUrls) &&
                            diag.attachmentUrls.map((url: string, idx: number) => (
                              <img
                                key={idx}
                                src={url}
                                alt={diag.station}
                                className="w-full h-32 object-contain rounded-lg border bg-slate-50"
                              />
                            ))}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Office Doctor Editable Clinical Data */}
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[#002642] flex items-center space-x-1.5">
                      <Edit3 className="w-3.5 h-3.5 text-[#008C8C]" />
                      <span>Office Doctor Clinical Edit (Optional Override)</span>
                    </span>
                    <button
                      type="button"
                      onClick={handleSaveDoctorEdits}
                      className="px-3 py-1 bg-[#008C8C] text-white rounded-lg font-bold"
                    >
                      Save Edits
                    </button>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <input type="text" placeholder="BP Sys" value={editBpSys} onChange={(e) => setEditBpSys(e.target.value)} className="px-2.5 py-1.5 bg-white border rounded-lg" />
                    <input type="text" placeholder="BP Dia" value={editBpDia} onChange={(e) => setEditBpDia(e.target.value)} className="px-2.5 py-1.5 bg-white border rounded-lg" />
                    <input type="text" placeholder="Pulse" value={editPulse} onChange={(e) => setEditPulse(e.target.value)} className="px-2.5 py-1.5 bg-white border rounded-lg" />
                    <input type="text" placeholder="Blood Group" value={bloodGroup} onChange={(e) => setBloodGroup(e.target.value)} className="px-2.5 py-1.5 bg-white border rounded-lg" />
                    <input type="text" placeholder="Past History" value={pastHistory} onChange={(e) => setPastHistory(e.target.value)} className="col-span-2 px-2.5 py-1.5 bg-white border rounded-lg" />
                    <input type="text" placeholder="Co-Morbidities" value={coMorbidities} onChange={(e) => setCoMorbidities(e.target.value)} className="col-span-2 px-2.5 py-1.5 bg-white border rounded-lg" />
                  </div>
                </div>

                {/* Sign-Off Form */}
                <form onSubmit={handleSubmitSignOff} className="space-y-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div>
                      <label className="block font-medium mb-1">Vitals / Physical Exam Remark</label>
                      <input type="text" value={vitalsRemark} onChange={(e) => setVitalsRemark(e.target.value)} className="w-full px-3 py-1.5 border border-slate-300 rounded-xl" />
                    </div>
                    <div>
                      <label className="block font-medium mb-1">Pathology Lab / Blood Remark</label>
                      <input type="text" value={labRemark} onChange={(e) => setLabRemark(e.target.value)} className="w-full px-3 py-1.5 border border-slate-300 rounded-xl" />
                    </div>
                    <div>
                      <label className="block font-medium mb-1">Chest X-Ray Remark</label>
                      <input type="text" value={xrayRemark} onChange={(e) => setXrayRemark(e.target.value)} className="w-full px-3 py-1.5 border border-slate-300 rounded-xl" />
                    </div>
                    <div>
                      <label className="block font-medium mb-1">Spirometry (PFT) Remark</label>
                      <input type="text" value={pftRemark} onChange={(e) => setPftRemark(e.target.value)} className="w-full px-3 py-1.5 border border-slate-300 rounded-xl" />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block font-medium mb-1">Audiometry Hearing Remark</label>
                      <input type="text" value={audioRemark} onChange={(e) => setAudioRemark(e.target.value)} className="w-full px-3 py-1.5 border border-slate-300 rounded-xl" />
                    </div>
                  </div>

                  {/* 4 Conclusion Options */}
                  <div className="space-y-3 pt-3 border-t border-slate-100">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      Final Conclusion (Form 32 / Medical Examination Report) *
                    </h4>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <label
                        onClick={() => setFitnessStatus("FIT")}
                        className={`cursor-pointer border-2 rounded-xl p-3 text-center transition ${
                          fitnessStatus === "FIT" ? "border-emerald-600 bg-emerald-50 text-emerald-900" : "border-slate-200"
                        }`}
                      >
                        <CheckCircle2 className="w-5 h-5 text-emerald-600 mx-auto mb-1" />
                        <span className="text-xs font-bold block">FIT</span>
                      </label>

                      <label
                        onClick={() => setFitnessStatus("FIT_WITH_CONDITION")}
                        className={`cursor-pointer border-2 rounded-xl p-3 text-center transition ${
                          fitnessStatus === "FIT_WITH_CONDITION" ? "border-teal-600 bg-teal-50 text-teal-900" : "border-slate-200"
                        }`}
                      >
                        <ShieldCheck className="w-5 h-5 text-teal-600 mx-auto mb-1" />
                        <span className="text-xs font-bold block">FIT WITH CONDITION</span>
                      </label>

                      <label
                        onClick={() => setFitnessStatus("TEMPORARILY_UNFIT_FOLLOW_UP")}
                        className={`cursor-pointer border-2 rounded-xl p-3 text-center transition ${
                          fitnessStatus === "TEMPORARILY_UNFIT_FOLLOW_UP" ? "border-amber-600 bg-amber-50 text-amber-900" : "border-slate-200"
                        }`}
                      >
                        <AlertTriangle className="w-5 h-5 text-amber-600 mx-auto mb-1" />
                        <span className="text-xs font-bold block">FOLLOW UP</span>
                      </label>

                      <label
                        onClick={() => setFitnessStatus("UNFIT")}
                        className={`cursor-pointer border-2 rounded-xl p-3 text-center transition ${
                          fitnessStatus === "UNFIT" ? "border-rose-600 bg-rose-50 text-rose-900" : "border-slate-200"
                        }`}
                      >
                        <XCircle className="w-5 h-5 text-rose-600 mx-auto mb-1" />
                        <span className="text-xs font-bold block">UNFIT</span>
                      </label>
                    </div>

                    <div className="text-xs">
                      <label className="block font-bold mb-1">
                        Conclusion / Remark {fitnessStatus !== "FIT" && <span className="text-rose-600">* (Mandatory for this selection)</span>}
                      </label>
                      <textarea
                        rows={2}
                        required={fitnessStatus !== "FIT"}
                        value={adviceSummary}
                        onChange={(e) => setAdviceSummary(e.target.value)}
                        placeholder="State reason for Fit with Condition, Follow Up, or Unfit..."
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                      />
                    </div>
                  </div>

                  {/* Signature */}
                  <div className="space-y-2 pt-2 border-t border-slate-100">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-bold text-slate-700">Office Doctor Digital Signature</span>
                      <button type="button" onClick={clearSignature} className="text-slate-400 hover:text-slate-600 flex items-center space-x-1">
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
                      className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md"
                    >
                      {isSubmitting ? "Certifying..." : "Sign & Generate Medical Examination Report"}
                    </button>
                  </div>
                </form>
              </>
            ) : (
              <div className="text-center py-20 text-slate-400 text-xs">
                Select a patient from the left queue to conduct office doctor review.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Printable Dynamic Medical Examination Report Modal */}
      {showReportModal && dossier?.employee && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white max-w-3xl w-full p-8 rounded-xl shadow-2xl space-y-4 text-xs text-slate-900">
            <div className="flex justify-between items-center print:hidden border-b pb-3">
              <span className="font-bold text-sm text-[#002642]">Medical Examination Report (A4 Print Preview)</span>
              <div className="flex space-x-2">
                <button onClick={() => window.print()} className="px-4 py-1.5 bg-[#002642] text-white rounded-lg font-bold flex items-center space-x-1">
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print Report</span>
                </button>
                <button onClick={() => setShowReportModal(false)} className="p-1.5 border rounded-lg">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Letterhead Top Spacer */}
            <div className="pt-8">
              <table className="w-full border-collapse border border-slate-800 text-[11px]">
                <tbody>
                  <tr>
                    <td className="border border-slate-800 p-1.5 font-semibold w-1/4">Exam Date :</td>
                    <td className="border border-slate-800 p-1.5 w-1/4">{new Date().toLocaleDateString()}</td>
                    <td className="border border-slate-800 p-1.5 font-semibold w-1/4">Serial No :</td>
                    <td className="border border-slate-800 p-1.5 w-1/4 font-mono">{dossier.employee.uhid}</td>
                  </tr>
                  <tr>
                    <td className="border border-slate-800 p-1.5 font-semibold">Client Name :</td>
                    <td className="border border-slate-800 p-1.5">{activeCamp?.clientName || "-"}</td>
                    <td className="border border-slate-800 p-1.5 font-semibold">Agency :</td>
                    <td className="border border-slate-800 p-1.5">{dossier.agencyName}</td>
                  </tr>
                </tbody>
              </table>

              <h2 className="text-center font-black text-sm underline my-3">MEDICAL EXAMINATION REPORT</h2>

              <table className="w-full border-collapse border border-slate-800 text-[11px]">
                <tbody>
                  <tr>
                    <td className="border border-slate-800 p-1.5 font-semibold">Name :</td>
                    <td className="border border-slate-800 p-1.5 font-bold" colSpan={2}>{dossier.employee.fullName}</td>
                    <td className="border border-slate-800 p-1.5"><strong>Age:</strong> {dossier.employee.age} Y</td>
                    <td className="border border-slate-800 p-1.5"><strong>Sex:</strong> {dossier.employee.gender}</td>
                  </tr>
                  <tr>
                    <td className="border border-slate-800 p-1.5 font-semibold">Emp Code :</td>
                    <td className="border border-slate-800 p-1.5">{dossier.employee.empCode}</td>
                    <td className="border border-slate-800 p-1.5 font-semibold">Dept / Desig :</td>
                    <td className="border border-slate-800 p-1.5" colSpan={2}>
                      {dossier.employee.department || "-"} / {dossier.employee.designation || "-"}
                    </td>
                  </tr>
                  <tr>
                    <td className="border border-slate-800 p-1.5 font-semibold">Height :</td>
                    <td className="border border-slate-800 p-1.5">{dossier.employee.heightCm || "-"} cm</td>
                    <td className="border border-slate-800 p-1.5"><strong>Weight:</strong> {dossier.employee.weightKg || "-"} kg</td>
                    <td className="border border-slate-800 p-1.5" colSpan={2}><strong>BMI:</strong> {dossier.employee.bmi || "-"} kg/m²</td>
                  </tr>
                  <tr>
                    <td className="border border-slate-800 p-1.5 font-semibold">Past History :</td>
                    <td className="border border-slate-800 p-1.5" colSpan={4}>{pastHistory || "Nil"}</td>
                  </tr>
                  <tr>
                    <td className="border border-slate-800 p-1.5 font-semibold">Co-Morbidities :</td>
                    <td className="border border-slate-800 p-1.5" colSpan={4}>{coMorbidities || "Nil"}</td>
                  </tr>
                  <tr>
                    <td className="border border-slate-800 p-1.5 font-semibold">Eyes (R / L / Color) :</td>
                    <td className="border border-slate-800 p-1.5" colSpan={2}>
                      R: {dossier.employee.nurseVisionDistanceRight || "6/6"} | L: {dossier.employee.nurseVisionDistanceLeft || "6/6"} | {dossier.employee.nurseColorVision || "Normal"}
                    </td>
                    <td className="border border-slate-800 p-1.5 font-semibold">Vitals (HR / SpO2 / BP) :</td>
                    <td className="border border-slate-800 p-1.5">
                      {editPulse || "-"} bpm | {editSpo2 || "-"}% | {editBpSys || "-"}/{editBpDia || "-"}
                    </td>
                  </tr>
                </tbody>
              </table>

              <div className="grid grid-cols-2 border border-t-0 border-slate-800 text-[11px]">
                <div className="border-r border-slate-800">
                  <div className="p-1.5 font-bold text-center border-b border-slate-800 bg-slate-100">Physical Examination</div>
                  <div className="p-1.5 border-b border-slate-300"><strong>ENT:</strong> {dossier.fieldExam?.entFinding || "Normal"}</div>
                  <div className="p-1.5 border-b border-slate-300"><strong>Oral:</strong> {dossier.fieldExam?.oralFinding || "Normal"}</div>
                  <div className="p-1.5 border-b border-slate-300"><strong>Head & Neck:</strong> {dossier.fieldExam?.headNeckFinding || "Normal"}</div>
                  <div className="p-1.5 border-b border-slate-300"><strong>Lungs & Chest:</strong> {dossier.fieldExam?.rsFinding || "Clear"}</div>
                  <div className="p-1.5 border-b border-slate-300"><strong>CardioVascular:</strong> {dossier.fieldExam?.cvsFinding || "Normal"}</div>
                  <div className="p-1.5 border-b border-slate-300"><strong>Skin & Varicose:</strong> {dossier.fieldExam?.skinInspection || "Normal"}</div>
                  <div className="p-2 font-black text-xs">Blood Group : {bloodGroup || "-"}</div>
                </div>

                <div>
                  <div className="p-1.5 font-bold text-center border-b border-slate-800 bg-slate-100">Blood Investigation</div>
                  <div className="p-1.5 border-b border-slate-300"><strong>Hb:</strong> {labData.hb || "-"}</div>
                  <div className="p-1.5 border-b border-slate-300"><strong>WBC:</strong> {labData.wbc || "-"}</div>
                  <div className="p-1.5 border-b border-slate-300"><strong>Platelets:</strong> {labData.platelets || "-"}</div>
                  <div className="p-1.5 border-b border-slate-300"><strong>ESR:</strong> {labData.esr || "-"} | <strong>SGPT:</strong> {labData.sgpt || "-"}</div>
                  <div className="p-1.5 border-b border-slate-300"><strong>S. Creatinine:</strong> {labData.creatinine || "-"}</div>
                  <div className="p-1.5 border-b border-slate-300"><strong>Widal:</strong> {labData.widal || "-"} | <strong>RBS:</strong> {labData.rbs || "-"}</div>
                  <div className="p-1.5"><strong>Urine R/M:</strong> {labData.urineRm || "-"}</div>
                </div>
              </div>

              <div className="border border-t-0 border-slate-800 p-2 flex justify-between items-center text-[11px]">
                <div>
                  <strong>Conclusion / Remark:</strong>{" "}
                  <span className="font-bold uppercase">{fitnessStatus.replace(/_/g, " ")}</span> — {adviceSummary}
                </div>
                {signatureData && <img src={signatureData} alt="Doctor Signature" className="h-10 object-contain" />}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}