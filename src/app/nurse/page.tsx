// src/app/nurse/page.tsx
"use client";

import React, { useState, useEffect } from "react";
import { getCampsList } from "@/actions/camp-actions";
import {
  getStationEmployeesWithStatus,
  toggleEmployeeArrivalAtStation,
  submitNurseVitals,
  requestCorrectionUnlock,
} from "@/actions/clinical-actions";
import {
  Search,
  Building2,
  Lock,
  CheckCircle2,
  Clock,
  AlertTriangle,
} from "lucide-react";
import { BackButton } from "@/components/shared/BackButton";

const DEFAULTS = {
  bpSystolic: "120",
  bpDiastolic: "80",
  pulseBpm: "72",
  spo2: "99",
  visionDistRight: "6/6",
  visionDistLeft: "6/6",
  colorVision: "Normal",
};

export default function NurseStationPage() {
  const [camps, setCamps] = useState<any[]>([]);
  const [selectedCampId, setSelectedCampId] = useState("");
  const [employees, setEmployees] = useState<any[]>([]);
  const [selectedEmp, setSelectedEmp] = useState<any | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [queueTab, setQueueTab] = useState<"pending" | "completed">("pending");

  // Nurse Measurements & Dirty Tracking (grey default until modified)
  const [bpSystolic, setBpSystolic] = useState(DEFAULTS.bpSystolic);
  const [bpDiastolic, setBpDiastolic] = useState(DEFAULTS.bpDiastolic);
  const [pulseBpm, setPulseBpm] = useState(DEFAULTS.pulseBpm);
  const [spo2, setSpo2] = useState(DEFAULTS.spo2);
  const [visionDistRight, setVisionDistRight] = useState(DEFAULTS.visionDistRight);
  const [visionDistLeft, setVisionDistLeft] = useState(DEFAULTS.visionDistLeft);
  const [visionNearRight, setVisionNearRight] = useState("N6");
  const [visionNearLeft, setVisionNearLeft] = useState("N6");
  const [colorVision, setColorVision] = useState(DEFAULTS.colorVision);
  const [dirtyFields, setDirtyFields] = useState<Record<string, boolean>>({});
  const [isSaving, setIsSaving] = useState(false);

  // Coordinator Unlock Request State
  const [showUnlockModal, setShowUnlockModal] = useState(false);
  const [unlockReason, setUnlockReason] = useState("");

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
    const list = await getStationEmployeesWithStatus(selectedCampId, "NURSING_STATION");
    setEmployees(list);
    if (selectedEmp) {
      const updated = list.find((e) => e.id === selectedEmp.id);
      if (updated) setSelectedEmp(updated);
    }
  };

  useEffect(() => {
    loadList();
  }, [selectedCampId]);

  const handleSelectEmployee = (emp: any) => {
    setSelectedEmp(emp);
    setBpSystolic(emp.nurseBpSystolic || DEFAULTS.bpSystolic);
    setBpDiastolic(emp.nurseBpDiastolic || DEFAULTS.bpDiastolic);
    setPulseBpm(emp.nursePulseBpm || DEFAULTS.pulseBpm);
    setSpo2(emp.nurseSpo2 || DEFAULTS.spo2);
    setVisionDistRight(emp.nurseVisionDistanceRight || DEFAULTS.visionDistRight);
    setVisionDistLeft(emp.nurseVisionDistanceLeft || DEFAULTS.visionDistLeft);
    setVisionNearRight(emp.nurseVisionNearRight || "N6");
    setVisionNearLeft(emp.nurseVisionNearLeft || "N6");
    setColorVision(emp.nurseColorVision || DEFAULTS.colorVision);
    setDirtyFields({});
  };

  const handleToggleArrived = async () => {
    if (!selectedEmp) return;
    const res = await toggleEmployeeArrivalAtStation({
      employeeId: selectedEmp.id,
      campId: selectedCampId,
      station: "NURSING_STATION",
    });
    if (res.success) {
      setSelectedEmp({ ...selectedEmp, arrivalStatus: res.arrivalStatus });
      loadList();
    }
  };

  const handleSubmitVitals = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmp) return;
    setIsSaving(true);

    const res = await submitNurseVitals({
      employeeId: selectedEmp.id,
      campId: selectedCampId,
      bpSystolic,
      bpDiastolic,
      pulseBpm,
      spo2,
      visionDistRight,
      visionDistLeft,
      visionNearRight,
      visionNearLeft,
      colorVision,
    });

    setIsSaving(false);

    if (res.success) {
      alert(`Vitals recorded for ${selectedEmp.fullName}! Moving to next desk...`);
      setSelectedEmp(null);
      loadList();
    } else {
      alert(res.error);
    }
  };

  const handleRequestUnlock = async () => {
    if (!selectedEmp || !unlockReason.trim()) return;
    const res = await requestCorrectionUnlock({
      campId: selectedCampId,
      employeeId: selectedEmp.id,
      station: "NURSING_STATION",
      reason: unlockReason,
    });
    if (res.success) {
      alert("Correction request sent to Camp Coordinator Desk.");
      setShowUnlockModal(false);
      setUnlockReason("");
    } else {
      alert("Failed to send request: " + res.error);
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

  const fieldTone = (key: string, currentVal: string, defaultVal: string) =>
    dirtyFields[key] || currentVal !== defaultVal
      ? "text-[#002642] font-bold"
      : "text-slate-400 font-medium";

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 p-4 sm:p-6 space-y-5">
      <div className="max-w-6xl mx-auto space-y-5">
        <BackButton fallbackHref="/admin" label="Back to Dashboard" />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
          <div>
            <h1 className="text-2xl font-black text-[#002642]">Nurse Workstation</h1>
            <p className="text-xs text-slate-500">
              Measure Blood Pressure, Pulse, SpO2, and Vision screening.
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
          {/* Auto-Settled Waiting & Completed Queue */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-3">
            <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-bold">
              <button
                onClick={() => setQueueTab("pending")}
                className={`flex-1 py-1.5 rounded-lg transition ${
                  queueTab === "pending" ? "bg-white text-[#002642] shadow-xs" : "text-slate-500"
                }`}
              >
                Waiting ({pendingList.length})
              </button>
              <button
                onClick={() => setQueueTab("completed")}
                className={`flex-1 py-1.5 rounded-lg transition ${
                  queueTab === "completed" ? "bg-white text-emerald-700 shadow-xs" : "text-slate-500"
                }`}
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

            <div className="space-y-2 max-h-[500px] overflow-y-auto">
              {filtered.map((emp) => (
                <div
                  key={emp.id}
                  onClick={() => handleSelectEmployee(emp)}
                  className={`p-3 rounded-xl border text-xs cursor-pointer transition space-y-1 ${
                    selectedEmp?.id === emp.id
                      ? "border-[#008C8C] bg-teal-50/50"
                      : "border-slate-200 hover:border-slate-300 bg-white"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-bold text-[#002642] truncate">{emp.fullName}</div>
                    {emp.arrivalStatus === "ARRIVED" && (
                      <span className="px-1.5 py-0.5 rounded bg-blue-600 text-white text-[9px] font-bold">
                        Arrived
                      </span>
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
                        <span>Waiting</span>
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] font-mono text-teal-700">{emp.uhid}</div>
                  <div className="text-[10px] font-semibold text-indigo-700 flex items-center space-x-1">
                    <Building2 className="w-3 h-3" />
                    <span>{emp.agencyName || "Direct Payroll"}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Measurement Form */}
          <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
            {selectedEmp ? (
              <form onSubmit={handleSubmitVitals} className="space-y-6">
                {/* Banner with 1-Tap Arrival Toggle */}
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

                  {selectedEmp.arrivalStatus !== "COMPLETED" && (
                    <button
                      type="button"
                      onClick={handleToggleArrived}
                      className={`px-3.5 py-1.5 text-white text-xs font-bold rounded-lg shadow-xs transition ${
                        isArrived
                          ? "bg-blue-600 hover:bg-blue-700"
                          : "bg-[#002642] hover:bg-[#001e38]"
                      }`}
                    >
                      {isArrived ? "Arrived" : "Mark As Arrived"}
                    </button>
                  )}
                </div>

                {/* Locked Banner */}
                {selectedEmp.isLocked && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between text-xs">
                    <div className="flex items-center space-x-2 text-amber-900 font-bold">
                      <Lock className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>Entry Locked: Cannot rewrite without Camp Coordinator approval.</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowUnlockModal(true)}
                      className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold"
                    >
                      Request Correction
                    </button>
                  </div>
                )}

                {/* Read-Only Reception Anthropometry */}
                <div className="p-3 bg-teal-50 border border-teal-200 rounded-xl text-xs flex items-center justify-between">
                  <span className="font-bold text-teal-900">Reception Height, Weight & BMI:</span>
                  <span className="font-mono font-bold text-teal-800">
                    {selectedEmp.heightCm || "-"} cm / {selectedEmp.weightKg || "-"} kg (BMI: {selectedEmp.bmi || "-"})
                  </span>
                </div>

                {/* Nurse Inputs (Grey default until edited) */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">BP Systolic</label>
                    <input
                      type="number"
                      disabled={selectedEmp.isLocked}
                      value={bpSystolic}
                      onChange={(e) => {
                        setBpSystolic(e.target.value);
                        setDirtyFields((d) => ({ ...d, bpSystolic: true }));
                      }}
                      className={`w-full px-3 py-2 border border-slate-300 rounded-xl text-sm disabled:bg-slate-100 ${fieldTone(
                        "bpSystolic",
                        bpSystolic,
                        DEFAULTS.bpSystolic
                      )}`}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">BP Diastolic</label>
                    <input
                      type="number"
                      disabled={selectedEmp.isLocked}
                      value={bpDiastolic}
                      onChange={(e) => {
                        setBpDiastolic(e.target.value);
                        setDirtyFields((d) => ({ ...d, bpDiastolic: true }));
                      }}
                      className={`w-full px-3 py-2 border border-slate-300 rounded-xl text-sm disabled:bg-slate-100 ${fieldTone(
                        "bpDiastolic",
                        bpDiastolic,
                        DEFAULTS.bpDiastolic
                      )}`}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Pulse (bpm)</label>
                    <input
                      type="number"
                      disabled={selectedEmp.isLocked}
                      value={pulseBpm}
                      onChange={(e) => {
                        setPulseBpm(e.target.value);
                        setDirtyFields((d) => ({ ...d, pulseBpm: true }));
                      }}
                      className={`w-full px-3 py-2 border border-slate-300 rounded-xl text-sm disabled:bg-slate-100 ${fieldTone(
                        "pulseBpm",
                        pulseBpm,
                        DEFAULTS.pulseBpm
                      )}`}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">SpO2 (%)</label>
                    <input
                      type="number"
                      disabled={selectedEmp.isLocked}
                      value={spo2}
                      onChange={(e) => {
                        setSpo2(e.target.value);
                        setDirtyFields((d) => ({ ...d, spo2: true }));
                      }}
                      className={`w-full px-3 py-2 border border-slate-300 rounded-xl text-sm disabled:bg-slate-100 ${fieldTone(
                        "spo2",
                        spo2,
                        DEFAULTS.spo2
                      )}`}
                    />
                  </div>
                </div>

                {/* Vision Screening */}
                <div className="pt-3 border-t border-slate-100 space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Vision Screening
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    <div>
                      <label className="block font-medium mb-1">Dist. Right</label>
                      <select
                        disabled={selectedEmp.isLocked}
                        value={visionDistRight}
                        onChange={(e) => {
                          setVisionDistRight(e.target.value);
                          setDirtyFields((d) => ({ ...d, visionDistRight: true }));
                        }}
                        className={`w-full px-3 py-1.5 border border-slate-300 rounded-xl ${fieldTone(
                          "visionDistRight",
                          visionDistRight,
                          DEFAULTS.visionDistRight
                        )}`}
                      >
                        <option value="6/6">6/6</option>
                        <option value="6/9">6/9</option>
                        <option value="6/12">6/12</option>
                        <option value="6/18">6/18</option>
                      </select>
                    </div>
                    <div>
                      <label className="block font-medium mb-1">Dist. Left</label>
                      <select
                        disabled={selectedEmp.isLocked}
                        value={visionDistLeft}
                        onChange={(e) => {
                          setVisionDistLeft(e.target.value);
                          setDirtyFields((d) => ({ ...d, visionDistLeft: true }));
                        }}
                        className={`w-full px-3 py-1.5 border border-slate-300 rounded-xl ${fieldTone(
                          "visionDistLeft",
                          visionDistLeft,
                          DEFAULTS.visionDistLeft
                        )}`}
                      >
                        <option value="6/6">6/6</option>
                        <option value="6/9">6/9</option>
                        <option value="6/12">6/12</option>
                        <option value="6/18">6/18</option>
                      </select>
                    </div>
                    <div>
                      <label className="block font-medium mb-1">Color Vision</label>
                      <select
                        disabled={selectedEmp.isLocked}
                        value={colorVision}
                        onChange={(e) => {
                          setColorVision(e.target.value);
                          setDirtyFields((d) => ({ ...d, colorVision: true }));
                        }}
                        className={`w-full px-3 py-1.5 border border-slate-300 rounded-xl ${fieldTone(
                          "colorVision",
                          colorVision,
                          DEFAULTS.colorVision
                        )}`}
                      >
                        <option value="Normal">Normal</option>
                        <option value="Red green deficiency">Red green deficiency</option>
                        <option value="Blue-yellow deficiency">Blue-yellow deficiency</option>
                        <option value="Complete color vision">Complete color vision</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100 flex justify-end">
                  <button
                    type="submit"
                    disabled={isSaving || selectedEmp.isLocked}
                    className="px-6 py-2.5 bg-[#008C8C] hover:bg-[#006e6e] text-white rounded-xl text-xs font-bold shadow-md transition disabled:opacity-40"
                  >
                    {selectedEmp.isLocked
                      ? "Locked (Coordinator Approval Required)"
                      : isSaving
                      ? "Saving Vitals..."
                      : "Save Vitals & Send to Next"}
                  </button>
                </div>
              </form>
            ) : (
              <div className="text-center py-20 text-slate-400 text-xs">
                Select a checked-in patient from the left queue to record vitals.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Coordinator Unlock Request Modal */}
      {showUnlockModal && (
        <div className="fixed inset-0 bg-slate-950/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center space-x-2 text-amber-700 font-bold text-sm">
              <AlertTriangle className="w-4 h-4" />
              <span>Request Camp Coordinator Unlock</span>
            </div>
            <p className="text-xs text-slate-500">
              Explain why {selectedEmp?.fullName}'s Nurse vitals need to be corrected:
            </p>
            <textarea
              rows={3}
              value={unlockReason}
              onChange={(e) => setUnlockReason(e.target.value)}
              placeholder="e.g., Typo in systolic BP (entered 220 instead of 120)"
              className="w-full p-2.5 border border-slate-300 rounded-xl text-xs"
            />
            <div className="flex justify-end space-x-2">
              <button
                type="button"
                onClick={() => setShowUnlockModal(false)}
                className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRequestUnlock}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold"
              >
                Send Request
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}