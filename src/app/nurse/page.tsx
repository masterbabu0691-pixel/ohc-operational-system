// src/app/nurse/page.tsx
"use client";

import React, { useState, useEffect } from "react";
import { getCampsList } from "@/actions/camp-actions";
import { getCampReceptionList } from "@/actions/reception-actions";
import { markEmployeeArrivedAtStation, submitNurseVitals } from "@/actions/clinical-actions";
import { 
  Heart, 
  Activity, 
  Eye, 
  Search, 
  Check, 
  Building2, 
  UserCheck, 
  Clock, 
  Ruler, 
  Scale 
} from "lucide-react";
import { BackButton } from "@/components/shared/BackButton";

export default function NurseStationPage() {
  const [camps, setCamps] = useState<any[]>([]);
  const [selectedCampId, setSelectedCampId] = useState("");
  const [employees, setEmployees] = useState<any[]>([]);
  const [selectedEmp, setSelectedEmp] = useState<any | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Nurse Measurements
  const [bpSystolic, setBpSystolic] = useState("120");
  const [bpDiastolic, setBpDiastolic] = useState("80");
  const [pulseBpm, setPulseBpm] = useState("72");
  const [spo2, setSpo2] = useState("99");
  const [visionDistRight, setVisionDistRight] = useState("6/6");
  const [visionDistLeft, setVisionDistLeft] = useState("6/6");
  const [visionNearRight, setVisionNearRight] = useState("N6");
  const [visionNearLeft, setVisionNearLeft] = useState("N6");
  const [colorVision, setColorVision] = useState("Normal");
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
    const list = await getCampReceptionList(selectedCampId);
    // Only employees who have checked in at reception are visible to nurse
    setEmployees(list.filter((e: any) => e.checkInStatus === "CHECKED_IN"));
  };

  useEffect(() => {
    loadList();
  }, [selectedCampId]);

  const handleSelectEmployee = (emp: any) => {
    setSelectedEmp(emp);
    setBpSystolic(emp.nurseBpSystolic || "120");
    setBpDiastolic(emp.nurseBpDiastolic || "80");
    setPulseBpm(emp.nursePulseBpm || "72");
    setSpo2(emp.nurseSpo2 || "99");
  };

  const handleMarkArrived = async () => {
    if (!selectedEmp) return;
    await markEmployeeArrivedAtStation({
      employeeId: selectedEmp.id,
      campId: selectedCampId,
      station: "NURSING_STATION",
    });
    alert(`${selectedEmp.fullName} marked as Arrived at Nursing Desk.`);
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
      alert(`Vitals recorded for ${selectedEmp.fullName}! Advancing...`);
      setSelectedEmp(null);
      loadList();
    } else {
      alert("Error saving vitals: " + res.error);
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
      <div className="max-w-6xl mx-auto space-y-5">
        <BackButton fallbackHref="/admin" label="Back to Dashboard" />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
          <div>
            <h1 className="text-2xl font-black text-[#002642]">Nurse Workstation</h1>
            <p className="text-xs text-slate-500">Measure Blood Pressure, Pulse, SpO2, and Vision screening.</p>
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
          {/* Checked-in Queue */}
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
                  <div className="font-bold text-[#002642] truncate">{emp.fullName}</div>
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
                {/* Banner with Agency Name */}
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs">
                  <div>
                    <div className="font-black text-[#002642] text-sm">{selectedEmp.fullName}</div>
                    <div className="text-slate-500 font-mono">UHID: {selectedEmp.uhid} • Code: {selectedEmp.empCode}</div>
                    <div className="text-indigo-700 font-bold mt-0.5">Agency: {selectedEmp.agencyName || "Direct Payroll"}</div>
                  </div>
                  <button
                    type="button"
                    onClick={handleMarkArrived}
                    className="px-3 py-1.5 bg-[#002642] hover:bg-[#001e38] text-white text-xs font-bold rounded-lg shadow-xs"
                  >
                    Mark as Arrived
                  </button>
                </div>

                {/* Read-Only Reception Vitals */}
                <div className="p-3 bg-teal-50 border border-teal-200 rounded-xl text-xs flex items-center justify-between">
                  <span className="font-bold text-teal-900">Reception Height & Weight:</span>
                  <span className="font-mono font-bold text-teal-800">
                    {selectedEmp.heightCm} cm / {selectedEmp.weightKg} kg (BMI: {selectedEmp.bmi})
                  </span>
                </div>

                {/* Nurse Inputs */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">BP Systolic</label>
                    <input
                      type="number"
                      value={bpSystolic}
                      onChange={(e) => setBpSystolic(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-bold text-[#002642]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">BP Diastolic</label>
                    <input
                      type="number"
                      value={bpDiastolic}
                      onChange={(e) => setBpDiastolic(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-bold text-[#002642]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Pulse (bpm)</label>
                    <input
                      type="number"
                      value={pulseBpm}
                      onChange={(e) => setPulseBpm(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-bold text-[#002642]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">SpO2 (%)</label>
                    <input
                      type="number"
                      value={spo2}
                      onChange={(e) => setSpo2(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-bold text-[#002642]"
                    />
                  </div>
                </div>

                {/* Vision Screening */}
                <div className="pt-3 border-t border-slate-100 space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Vision Screening</h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                    <div>
                      <label className="block font-medium mb-1">Dist. Right</label>
                      <select
                        value={visionDistRight}
                        onChange={(e) => setVisionDistRight(e.target.value)}
                        className="w-full px-3 py-1.5 border border-slate-300 rounded-xl font-bold"
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
                        value={visionDistLeft}
                        onChange={(e) => setVisionDistLeft(e.target.value)}
                        className="w-full px-3 py-1.5 border border-slate-300 rounded-xl font-bold"
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
                        value={colorVision}
                        onChange={(e) => setColorVision(e.target.value)}
                        className="w-full px-3 py-1.5 border border-slate-300 rounded-xl font-bold"
                      >
                        <option value="Normal">Normal</option>
                        <option value="Defective">Defective</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100 flex justify-end">
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="px-6 py-2.5 bg-[#008C8C] hover:bg-[#006e6e] text-white rounded-xl text-xs font-bold shadow-md transition"
                  >
                    {isSaving ? "Saving Vitals..." : "Save Vitals & Send to Next"}
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
    </div>
  );
}