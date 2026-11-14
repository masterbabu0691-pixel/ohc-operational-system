// src/app/doctor/field/page.tsx
"use client";

import React, { useState, useEffect } from "react";
import { getCampsList } from "@/actions/camp-actions";
import { getCampReceptionList } from "@/actions/reception-actions";
import { markEmployeeArrivedAtStation, submitFieldDoctorExam } from "@/actions/clinical-actions";
import { 
  Stethoscope, 
  Building2, 
  Search, 
  Check, 
  Edit3, 
  Lock 
} from "lucide-react";
import { BackButton } from "@/components/shared/BackButton";

export default function FieldDoctorPage() {
  const [camps, setCamps] = useState<any[]>([]);
  const [selectedCampId, setSelectedCampId] = useState("");
  const [employees, setEmployees] = useState<any[]>([]);
  const [selectedEmp, setSelectedEmp] = useState<any | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Vitals Rewrite Mode (BP, Pulse, SpO2 only)
  const [rewriteMode, setRewriteMode] = useState(false);
  const [doctorBpSystolic, setDoctorBpSystolic] = useState("");
  const [doctorBpDiastolic, setDoctorBpDiastolic] = useState("");
  const [doctorPulseBpm, setDoctorPulseBpm] = useState("");
  const [doctorSpo2, setDoctorSpo2] = useState("");

  // Physical Exam Findings
  const [cvsFinding, setCvsFinding] = useState("S1 S2 Normal, No Murmurs");
  const [rsFinding, setRsFinding] = useState("Bilateral Vesicular Breath Sounds Clear");
  const [abdomenFinding, setAbdomenFinding] = useState("Soft, No Organomegaly, No Tenderness");
  const [cnsFinding, setCnsFinding] = useState("Reflexes Intact, Normal Cognitive Response");
  const [musculoskeletal, setMusculoskeletal] = useState("Spine and joints range of motion normal");
  const [skinInspection, setSkinInspection] = useState("Normal, No occupational dermatosis");
  const [herniaHydrocele, setHerniaHydrocele] = useState("Absent");
  const [clinicalRemarks, setClinicalRemarks] = useState("");
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

  const handleSelectEmp = (emp: any) => {
    setSelectedEmp(emp);
    setRewriteMode(false);
    setDoctorBpSystolic(emp.nurseBpSystolic || "120");
    setDoctorBpDiastolic(emp.nurseBpDiastolic || "80");
    setDoctorPulseBpm(emp.nursePulseBpm || "72");
    setDoctorSpo2(emp.nurseSpo2 || "99");
  };

  const handleMarkArrived = async () => {
    if (!selectedEmp) return;
    await markEmployeeArrivedAtStation({
      employeeId: selectedEmp.id,
      campId: selectedCampId,
      station: "FIELD_DOCTOR_EXAM",
    });
    alert(`${selectedEmp.fullName} marked as Arrived at Doctor Desk.`);
  };

  const handleSubmitPhysicalExam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmp) return;
    setIsSubmitting(true);

    const res = await submitFieldDoctorExam({
      employeeId: selectedEmp.id,
      campId: selectedCampId,
      doctorName: "Dr. Field Medical Officer",
      doctorId: "doc_field_01",
      rewriteVitals: rewriteMode,
      doctorBpSystolic: rewriteMode ? doctorBpSystolic : undefined,
      doctorBpDiastolic: rewriteMode ? doctorBpDiastolic : undefined,
      doctorPulseBpm: rewriteMode ? doctorPulseBpm : undefined,
      doctorSpo2: rewriteMode ? doctorSpo2 : undefined,
      cvsFinding,
      rsFinding,
      abdomenFinding,
      cnsFinding,
      musculoskeletal,
      skinInspection,
      herniaHydrocele,
      clinicalRemarks,
    });

    setIsSubmitting(false);

    if (res.success) {
      alert(`Physical examination submitted for ${selectedEmp.fullName}!`);
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
      <div className="max-w-6xl mx-auto space-y-5">
        <BackButton fallbackHref="/admin" label="Back to Dashboard" />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
          <div>
            <h1 className="text-2xl font-black text-[#002642]">On-Field Doctor Examination</h1>
            <p className="text-xs text-slate-500">Physical systemic examination & clinical re-check (No fitness sign-off here).</p>
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
          {/* Patient Queue */}
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
                  onClick={() => handleSelectEmp(emp)}
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

          {/* Clinical Physical Exam Form */}
          <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
            {selectedEmp ? (
              <form onSubmit={handleSubmitPhysicalExam} className="space-y-6">
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

                {/* Reception & Nurse Baseline Panel */}
                <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs">
                  <div>
                    <span className="font-bold text-slate-500 flex items-center space-x-1">
                      <Lock className="w-3 h-3" />
                      <span>Reception (Locked):</span>
                    </span>
                    <div className="font-mono text-slate-800 font-bold mt-0.5">
                      {selectedEmp.heightCm} cm / {selectedEmp.weightKg} kg (BMI: {selectedEmp.bmi})
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-500">Nurse Recorded Vitals:</span>
                      <button
                        type="button"
                        onClick={() => setRewriteMode(!rewriteMode)}
                        className="text-[10px] font-bold text-teal-700 hover:underline flex items-center space-x-1"
                      >
                        <Edit3 className="w-3 h-3" />
                        <span>{rewriteMode ? "Cancel Override" : "Re-Check / Rewrite"}</span>
                      </button>
                    </div>
                    <div className="font-mono text-slate-800 font-bold mt-0.5">
                      BP: {selectedEmp.nurseBpSystolic || "120"}/{selectedEmp.nurseBpDiastolic || "80"} • Pulse: {selectedEmp.nursePulseBpm || "72"} • SpO2: {selectedEmp.nurseSpo2 || "99"}%
                    </div>
                  </div>
                </div>

                {/* Doctor Re-Check Override Inputs (Only active if rewriteMode is toggled) */}
                {rewriteMode && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-2 text-xs">
                    <span className="font-bold text-amber-900 block">Doctor Vitals Re-Measurement (Pulse, BP, SpO2 Only):</span>
                    <div className="grid grid-cols-4 gap-2">
                      <div>
                        <label className="text-[10px] text-slate-600 block">Systolic</label>
                        <input
                          type="number"
                          value={doctorBpSystolic}
                          onChange={(e) => setDoctorBpSystolic(e.target.value)}
                          className="w-full px-2 py-1 border border-amber-300 rounded font-bold"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-600 block">Diastolic</label>
                        <input
                          type="number"
                          value={doctorBpDiastolic}
                          onChange={(e) => setDoctorBpDiastolic(e.target.value)}
                          className="w-full px-2 py-1 border border-amber-300 rounded font-bold"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-600 block">Pulse</label>
                        <input
                          type="number"
                          value={doctorPulseBpm}
                          onChange={(e) => setDoctorPulseBpm(e.target.value)}
                          className="w-full px-2 py-1 border border-amber-300 rounded font-bold"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-600 block">SpO2</label>
                        <input
                          type="number"
                          value={doctorSpo2}
                          onChange={(e) => setDoctorSpo2(e.target.value)}
                          className="w-full px-2 py-1 border border-amber-300 rounded font-bold"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Systemic Physical Examination */}
                <div className="space-y-3 pt-2 border-t border-slate-100">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Physical Examination Findings
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div>
                      <label className="block font-medium mb-1">CVS (Heart)</label>
                      <input
                        type="text"
                        value={cvsFinding}
                        onChange={(e) => setCvsFinding(e.target.value)}
                        className="w-full px-3 py-1.5 border border-slate-300 rounded-xl"
                      />
                    </div>
                    <div>
                      <label className="block font-medium mb-1">Respiratory (Lungs)</label>
                      <input
                        type="text"
                        value={rsFinding}
                        onChange={(e) => setRsFinding(e.target.value)}
                        className="w-full px-3 py-1.5 border border-slate-300 rounded-xl"
                      />
                    </div>
                    <div>
                      <label className="block font-medium mb-1">Abdomen</label>
                      <input
                        type="text"
                        value={abdomenFinding}
                        onChange={(e) => setAbdomenFinding(e.target.value)}
                        className="w-full px-3 py-1.5 border border-slate-300 rounded-xl"
                      />
                    </div>
                    <div>
                      <label className="block font-medium mb-1">Central Nervous (CNS)</label>
                      <input
                        type="text"
                        value={cnsFinding}
                        onChange={(e) => setCnsFinding(e.target.value)}
                        className="w-full px-3 py-1.5 border border-slate-300 rounded-xl"
                      />
                    </div>
                    <div>
                      <label className="block font-medium mb-1">Musculoskeletal & Spine</label>
                      <input
                        type="text"
                        value={musculoskeletal}
                        onChange={(e) => setMusculoskeletal(e.target.value)}
                        className="w-full px-3 py-1.5 border border-slate-300 rounded-xl"
                      />
                    </div>
                    <div>
                      <label className="block font-medium mb-1">Hernia / Hydrocele</label>
                      <input
                        type="text"
                        value={herniaHydrocele}
                        onChange={(e) => setHerniaHydrocele(e.target.value)}
                        className="w-full px-3 py-1.5 border border-slate-300 rounded-xl"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Doctor Clinical Observations</label>
                    <textarea
                      rows={2}
                      value={clinicalRemarks}
                      onChange={(e) => setClinicalRemarks(e.target.value)}
                      placeholder="Enter clinical observations for office doctor review..."
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-xl text-xs"
                    />
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100 flex justify-end">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-6 py-2.5 bg-[#002642] hover:bg-[#001e38] text-white rounded-xl text-xs font-bold shadow-md transition"
                  >
                    {isSubmitting ? "Submitting Exam..." : "Submit Physical Exam Findings"}
                  </button>
                </div>
              </form>
            ) : (
              <div className="text-center py-20 text-slate-400 text-xs">
                Select a checked-in patient from the left queue to perform physical examination.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}