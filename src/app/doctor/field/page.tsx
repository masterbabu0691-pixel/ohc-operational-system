// src/app/doctor/field/page.tsx
"use client";

import React, { useState, useEffect } from "react";
import { getCampsList } from "@/actions/camp-actions";
import {
  getStationEmployeesWithStatus,
  toggleEmployeeArrivalAtStation,
  submitFieldDoctorExam,
  requestCorrectionUnlock,
} from "@/actions/clinical-actions";
import { Search, Building2, Edit3, CheckCircle2, Clock, Lock, AlertTriangle } from "lucide-react";
import { BackButton } from "@/components/shared/BackButton";
import { StationAttendanceBar } from "@/components/shared/StationAttendanceBar";

export default function FieldDoctorPortal() {
  const [camps, setCamps] = useState<any[]>([]);
  const [selectedCampId, setSelectedCampId] = useState("");
  const [employees, setEmployees] = useState<any[]>([]);
  const [selectedEmp, setSelectedEmp] = useState<any | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [queueTab, setQueueTab] = useState<"pending" | "completed">("pending");

  // Optional Vitals Re-write (BP, Pulse, SpO2 ONLY)
  const [rewriteVitals, setRewriteVitals] = useState(false);
  const [docBpSys, setDocBpSys] = useState("");
  const [docBpDia, setDocBpDia] = useState("");
  const [docPulse, setDocPulse] = useState("");
  const [docSpo2, setDocSpo2] = useState("");

  // Physical Examination Only
  const [doctorName] = useState("Dr. S. Mukherjee, MBBS, AFIH");
  const [entFinding, setEntFinding] = useState("Normal");
  const [oralFinding, setOralFinding] = useState("Normal, Good Oral Hygiene");
  const [headNeckFinding, setHeadNeckFinding] = useState("Normal, No Lymphadenopathy");
  const [cvsFinding, setCvsFinding] = useState("S1 S2 Normal, No Murmurs");
  const [rsFinding, setRsFinding] = useState("Bilateral Vesicular Breath Sounds Clear");
  const [abdomenFinding, setAbdomenFinding] = useState("Soft, No Organomegaly");
  const [cnsFinding, setCnsFinding] = useState("Reflexes Intact, Normal");
  const [musculoskeletal, setMusculoskeletal] = useState("Spine and joints range of motion normal");
  const [skinInspection] = useState("Normal, No occupational dermatosis");
  const [herniaHydrocele, setHerniaHydrocele] = useState("Absent");
  const [clinicalRemarks, setClinicalRemarks] = useState("");
  const [isSaving, setIsSaving] = useState(false);

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
    const list = await getStationEmployeesWithStatus(selectedCampId, "FIELD_DOCTOR_EXAM");
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
    setRewriteVitals(false);
    setDocBpSys(emp.doctorBpSystolic || emp.nurseBpSystolic || "");
    setDocBpDia(emp.doctorBpDiastolic || emp.nurseBpDiastolic || "");
    setDocPulse(emp.doctorPulseBpm || emp.nursePulseBpm || "");
    setDocSpo2(emp.doctorSpo2 || emp.nurseSpo2 || "");
  };

  const handleToggleArrived = async () => {
    if (!selectedEmp) return;
    const res = await toggleEmployeeArrivalAtStation({
      employeeId: selectedEmp.id,
      campId: selectedCampId,
      station: "FIELD_DOCTOR_EXAM",
    });
    if (res.success) {
      setSelectedEmp({ ...selectedEmp, arrivalStatus: res.arrivalStatus });
      loadList();
    }
  };

  const handleRequestUnlock = async () => {
    if (!selectedEmp) return;
    const reason = prompt(`Why does ${selectedEmp.fullName}'s Field Doctor exam need correction?`);
    if (!reason?.trim()) return;
    const res = await requestCorrectionUnlock({
      campId: selectedCampId,
      employeeId: selectedEmp.id,
      station: "FIELD_DOCTOR_EXAM",
      reason,
    });
    if (res.success) alert("Correction request sent to Camp Coordinator.");
  };

  const handleSubmitExam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmp) return;

    if (selectedEmp.arrivalStatus !== "ARRIVED") {
      alert("Mandatory Rule: Please click 'Mark As Arrived' first before saving Physical Exam.");
      return;
    }

    setIsSaving(true);
    const res = await submitFieldDoctorExam({
      employeeId: selectedEmp.id,
      campId: selectedCampId,
      doctorName,
      doctorId: "doc_field_01",
      rewriteVitals,
      doctorBpSystolic: docBpSys,
      doctorBpDiastolic: docBpDia,
      doctorPulseBpm: docPulse,
      doctorSpo2: docSpo2,
      entFinding,
      oralFinding,
      headNeckFinding,
      cvsFinding,
      rsFinding,
      abdomenFinding,
      cnsFinding,
      musculoskeletal,
      skinInspection,
      herniaHydrocele,
      clinicalRemarks,
    });
    setIsSaving(false);

    if (res.success) {
      alert(`Physical exam completed for ${selectedEmp.fullName}!`);
      setSelectedEmp(null);
      loadList();
    } else {
      alert("Error: " + res.error);
    }
  };

  const pendingList = employees.filter((e) => e.arrivalStatus !== "COMPLETED");
  const completedList = employees.filter((e) => e.arrivalStatus === "COMPLETED");
  const activeList = queueTab === "pending" ? pendingList : completedList;

  const filtered = activeList.filter(
    (e) =>
      e.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.empCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.uhid.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (e.agencyName && e.agencyName.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const isArrived = selectedEmp?.arrivalStatus === "ARRIVED";
  const activeBpSys = selectedEmp?.doctorBpSystolic || selectedEmp?.nurseBpSystolic || "-";
  const activeBpDia = selectedEmp?.doctorBpDiastolic || selectedEmp?.nurseBpDiastolic || "-";
  const activePulse = selectedEmp?.doctorPulseBpm || selectedEmp?.nursePulseBpm || "-";
  const activeSpo2 = selectedEmp?.doctorSpo2 || selectedEmp?.nurseSpo2 || "-";

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 p-4 sm:p-6 space-y-5">
      <div className="max-w-7xl mx-auto space-y-5">
        <BackButton fallbackHref="/admin" label="Back to Dashboard" />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
          <div>
            <h1 className="text-2xl font-black text-[#002642]">On-Field Doctor Physical Examination</h1>
            <p className="text-xs text-slate-500">Systemic physical checkup ONLY. No fitness certification on camp floor.</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <StationAttendanceBar campId={selectedCampId} stationName="FIELD_DOCTOR" />
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

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Waiting / Completed Queue */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-3">
            <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-bold">
              <button
                onClick={() => setQueueTab("pending")}
                className={`flex-1 py-1.5 rounded-lg transition ${queueTab === "pending" ? "bg-white text-[#002642] shadow-xs" : "text-slate-500"}`}
              >
                Waiting ({pendingList.length})
              </button>
              <button
                onClick={() => setQueueTab("completed")}
                className={`flex-1 py-1.5 rounded-lg transition ${queueTab === "completed" ? "bg-white text-emerald-700 shadow-xs" : "text-slate-500"}`}
              >
                Completed ({completedList.length})
              </button>
            </div>

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
                  onClick={() => handleSelectEmp(emp)}
                  className={`p-3 rounded-xl border text-xs cursor-pointer transition space-y-1 ${
                    selectedEmp?.id === emp.id ? "border-[#008C8C] bg-teal-50/50" : "border-slate-200 hover:border-slate-300 bg-white"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-bold text-[#002642] truncate">{emp.fullName}</div>
                    {emp.arrivalStatus === "ARRIVED" && (
                      <span className="px-1.5 py-0.5 rounded bg-blue-600 text-white text-[9px] font-bold">Arrived</span>
                    )}
                    {emp.arrivalStatus === "COMPLETED" && (
                      <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[9px] font-bold flex items-center space-x-0.5">
                        <CheckCircle2 className="w-2.5 h-2.5" />
                        <span>Done</span>
                      </span>
                    )}
                    {emp.arrivalStatus === "PENDING" && (
                      <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 text-[9px] font-bold flex items-center space-x-0.5">
                        <Clock className="w-2.5 h-2.5" />
                        <span>Pending</span>
                      </span>
                    )}
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

          {/* Exam Form */}
          <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
            {selectedEmp ? (
              <form onSubmit={handleSubmitExam} className="space-y-6">
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs">
                  <div>
                    <div className="font-black text-[#002642] text-sm">{selectedEmp.fullName}</div>
                    <div className="text-slate-500 font-mono">UHID: {selectedEmp.uhid} | Code: {selectedEmp.empCode}</div>
                    <div className="text-indigo-700 font-bold mt-0.5">Agency: {selectedEmp.agencyName || "Direct Payroll"}</div>
                  </div>
                  {selectedEmp.arrivalStatus !== "COMPLETED" && (
                    <button
                      type="button"
                      onClick={handleToggleArrived}
                      className={`px-3.5 py-1.5 text-white text-xs font-bold rounded-lg shadow-xs transition ${
                        isArrived ? "bg-blue-600 hover:bg-blue-700" : "bg-[#002642] hover:bg-[#001e38]"
                      }`}
                    >
                      {isArrived ? "Arrived" : "Mark As Arrived"}
                    </button>
                  )}
                </div>

                {!isArrived && selectedEmp.arrivalStatus !== "COMPLETED" && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs font-bold text-amber-900 flex items-center space-x-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>Mandatory: Click &quot;Mark As Arrived&quot; above before saving Physical Exam.</span>
                  </div>
                )}

                {selectedEmp.isLocked && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between text-xs">
                    <span className="flex items-center space-x-2 font-bold text-amber-900">
                      <Lock className="w-4 h-4 text-amber-600" />
                      <span>Entry Locked after save.</span>
                    </span>
                    <button type="button" onClick={handleRequestUnlock} className="px-3 py-1 bg-amber-600 text-white rounded-lg font-bold">
                      Request Coordinator Unlock
                    </button>
                  </div>
                )}

                {/* Active Vitals + Past Nurse Reference */}
                <div className="p-4 bg-teal-50 border border-teal-200 rounded-xl space-y-2.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-teal-900">
                      Active Vitals {selectedEmp.doctorVitalsRewritten ? "(Doctor Corrected)" : "(From Nurse)"}
                    </span>
                    <button
                      type="button"
                      disabled={selectedEmp.isLocked}
                      onClick={() => setRewriteVitals(!rewriteVitals)}
                      className="text-indigo-700 hover:underline font-bold flex items-center space-x-1 disabled:opacity-40"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>{rewriteVitals ? "Cancel Re-Write" : "Re-Check / Re-Write BP, Pulse & SpO2"}</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 font-mono text-teal-900 font-bold">
                    <div>Ht/Wt (Locked): {selectedEmp.heightCm || "-"}cm / {selectedEmp.weightKg || "-"}kg</div>
                    <div>BMI (Locked): {selectedEmp.bmi || "-"}</div>
                    <div>Active BP: {activeBpSys}/{activeBpDia} mmHg</div>
                    <div>Active Pulse: {activePulse} bpm</div>
                    <div>Active SpO2: {activeSpo2}%</div>
                  </div>

                  {selectedEmp.doctorVitalsRewritten && (
                    <div className="text-[11px] text-slate-500 font-mono pt-1 border-t border-teal-200/70">
                      Nurse Past Reference: BP {selectedEmp.nurseBpSystolic || "-"}/{selectedEmp.nurseBpDiastolic || "-"} • Pulse {selectedEmp.nursePulseBpm || "-"} • SpO2 {selectedEmp.nurseSpo2 || "-"}%
                    </div>
                  )}

                  {rewriteVitals && (
                    <div className="grid grid-cols-4 gap-2 pt-2 border-t border-teal-200">
                      <div>
                        <label className="block text-[10px] font-bold">Doctor BP Sys</label>
                        <input type="number" value={docBpSys} onChange={(e) => setDocBpSys(e.target.value)} className="w-full p-1.5 border rounded bg-white font-bold" />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold">Doctor BP Dia</label>
                        <input type="number" value={docBpDia} onChange={(e) => setDocBpDia(e.target.value)} className="w-full p-1.5 border rounded bg-white font-bold" />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold">Doctor Pulse</label>
                        <input type="number" value={docPulse} onChange={(e) => setDocPulse(e.target.value)} className="w-full p-1.5 border rounded bg-white font-bold" />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold">Doctor SpO2</label>
                        <input type="number" value={docSpo2} onChange={(e) => setDocSpo2(e.target.value)} className="w-full p-1.5 border rounded bg-white font-bold" />
                      </div>
                    </div>
                  )}
                </div>

                {/* Physical Examination Fields (Matching Medical Examination Report) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="block font-medium mb-1">ENT</label>
                    <input type="text" disabled={selectedEmp.isLocked} value={entFinding} onChange={(e) => setEntFinding(e.target.value)} className="w-full px-3 py-1.5 border border-slate-300 rounded-xl" />
                  </div>
                  <div>
                    <label className="block font-medium mb-1">Oral</label>
                    <input type="text" disabled={selectedEmp.isLocked} value={oralFinding} onChange={(e) => setOralFinding(e.target.value)} className="w-full px-3 py-1.5 border border-slate-300 rounded-xl" />
                  </div>
                  <div>
                    <label className="block font-medium mb-1">Head & Neck</label>
                    <input type="text" disabled={selectedEmp.isLocked} value={headNeckFinding} onChange={(e) => setHeadNeckFinding(e.target.value)} className="w-full px-3 py-1.5 border border-slate-300 rounded-xl" />
                  </div>
                  <div>
                    <label className="block font-medium mb-1">Cardiovascular (CVS)</label>
                    <input type="text" disabled={selectedEmp.isLocked} value={cvsFinding} onChange={(e) => setCvsFinding(e.target.value)} className="w-full px-3 py-1.5 border border-slate-300 rounded-xl" />
                  </div>
                  <div>
                    <label className="block font-medium mb-1">Respiratory (RS / Lungs & Chest)</label>
                    <input type="text" disabled={selectedEmp.isLocked} value={rsFinding} onChange={(e) => setRsFinding(e.target.value)} className="w-full px-3 py-1.5 border border-slate-300 rounded-xl" />
                  </div>
                  <div>
                    <label className="block font-medium mb-1">Abdomen</label>
                    <input type="text" disabled={selectedEmp.isLocked} value={abdomenFinding} onChange={(e) => setAbdomenFinding(e.target.value)} className="w-full px-3 py-1.5 border border-slate-300 rounded-xl" />
                  </div>
                  <div>
                    <label className="block font-medium mb-1">CNS / Reflexes</label>
                    <input type="text" disabled={selectedEmp.isLocked} value={cnsFinding} onChange={(e) => setCnsFinding(e.target.value)} className="w-full px-3 py-1.5 border border-slate-300 rounded-xl" />
                  </div>
                  <div>
                    <label className="block font-medium mb-1">Spine & Musculoskeletal</label>
                    <input type="text" disabled={selectedEmp.isLocked} value={musculoskeletal} onChange={(e) => setMusculoskeletal(e.target.value)} className="w-full px-3 py-1.5 border border-slate-300 rounded-xl" />
                  </div>
                  <div>
                    <label className="block font-medium mb-1">Hernia / Hydrocele</label>
                    <input type="text" disabled={selectedEmp.isLocked} value={herniaHydrocele} onChange={(e) => setHerniaHydrocele(e.target.value)} className="w-full px-3 py-1.5 border border-slate-300 rounded-xl" />
                  </div>
                </div>

                <div className="text-xs">
                  <label className="block font-medium mb-1">Clinical Observations (Sent to Office Doctor)</label>
                  <textarea
                    rows={2}
                    disabled={selectedEmp.isLocked}
                    value={clinicalRemarks}
                    onChange={(e) => setClinicalRemarks(e.target.value)}
                    placeholder="Optional physical findings..."
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                  />
                </div>

                <div className="pt-4 border-t border-slate-100 flex justify-end">
                  <button
                    type="submit"
                    disabled={isSaving || selectedEmp.isLocked}
                    className="px-6 py-2.5 bg-[#008C8C] hover:bg-[#006e6e] text-white rounded-xl text-xs font-bold shadow-md transition disabled:opacity-40"
                  >
                    {selectedEmp.isLocked ? "Locked" : isSaving ? "Saving Exam..." : "Save Physical Exam & Complete"}
                  </button>
                </div>
              </form>
            ) : (
              <div className="text-center py-20 text-slate-400 text-xs">
                Select a patient from the left queue to begin physical examination.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}