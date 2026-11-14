// src/app/reception/page.tsx
"use client";

import React, { useState, useEffect } from "react";
import { getCampsList } from "@/actions/camp-actions";
import { getCampReceptionList } from "@/actions/reception-actions";
import { receptionCheckIn } from "@/actions/clinical-actions";
import { 
  UserCheck, 
  Search, 
  Building2, 
  Scale, 
  Ruler, 
  Activity, 
  CheckCircle2, 
  Clock, 
  User, 
  Printer, 
  RefreshCw,
  QrCode,
  X,
  AlertCircle
} from "lucide-react";
import { BackButton } from "@/components/shared/BackButton";

export default function ReceptionPage() {
  const [camps, setCamps] = useState<any[]>([]);
  const [selectedCampId, setSelectedCampId] = useState("");
  const [employees, setEmployees] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"pending" | "checked_in">("pending");

  // Check-In Form State
  const [selectedEmp, setSelectedEmp] = useState<any | null>(null);
  const [heightCm, setHeightCm] = useState("170");
  const [weightKg, setWeightKg] = useState("68");
  const [isHazardousWorker, setIsHazardousWorker] = useState(false);
  const [hazardTests, setHazardTests] = useState<string[]>(["srv_vitals", "srv_pft", "srv_audiometry", "srv_xray"]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Optional Token Slip
  const [lastSlip, setLastSlip] = useState<any | null>(null);

  useEffect(() => {
    async function loadCamps() {
      const data = await getCampsList();
      setCamps(data);
      if (data.length > 0 && !selectedCampId) {
        setSelectedCampId(data[0].id);
      }
    }
    loadCamps();
  }, []);

  const loadEmployees = async () => {
    if (!selectedCampId) return;
    const list = await getCampReceptionList(selectedCampId);
    setEmployees(list);
  };

  useEffect(() => {
    loadEmployees();
  }, [selectedCampId]);

  const calculatedBmi = () => {
    const h = parseFloat(heightCm) / 100;
    const w = parseFloat(weightKg);
    return h > 0 && w > 0 ? (w / (h * h)).toFixed(1) : "22.0";
  };

  const handleOpenCheckIn = (emp: any) => {
    setSelectedEmp(emp);
    setHeightCm(emp.heightCm || "170");
    setWeightKg(emp.weightKg || "68");
    setIsHazardousWorker(emp.hazardProfile !== "ROUTINE");
  };

  const handleConfirmCheckIn = async () => {
    if (!selectedEmp) return;
    setIsSubmitting(true);

    const res = await receptionCheckIn({
      employeeId: selectedEmp.id,
      campId: selectedCampId,
      heightCm,
      weightKg,
      customServiceIds: isHazardousWorker ? hazardTests : undefined,
    });

    setIsSubmitting(false);

    if (res.success) {
      setLastSlip({
        ...selectedEmp,
        uhid: res.uhid,
        heightCm,
        weightKg,
        bmi: res.bmi,
        agencyName: selectedEmp.agencyName || "Direct Payroll",
        checkedInAt: new Date().toLocaleTimeString(),
      });

      setSelectedEmp(null);
      loadEmployees();
    } else {
      alert("Check-in error: " + res.error);
    }
  };

  const filteredEmployees = employees.filter((emp) => {
    const matchesSearch =
      emp.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emp.empCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emp.uhid.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (emp.agencyName && emp.agencyName.toLowerCase().includes(searchQuery.toLowerCase()));

    const isChecked = emp.checkInStatus === "CHECKED_IN";
    return matchesSearch && (activeTab === "checked_in" ? isChecked : !isChecked);
  });

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 p-4 sm:p-6 md:p-8 space-y-6">
      <div className="max-w-6xl mx-auto space-y-6">
        
        <BackButton fallbackHref="/admin" label="Back to Dashboard" />

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <div className="flex items-center space-x-2 text-[#008C8C] font-bold text-xs uppercase tracking-wider">
              <UserCheck className="w-4 h-4" />
              <span>Camp Gateway Desk</span>
            </div>
            <h1 className="text-2xl font-black text-[#002642] tracking-tight mt-0.5">
              Reception Check-In & Anthropometry
            </h1>
            <p className="text-xs text-slate-500">
              Auto-fetch pre-registration, capture Height & Weight, calculate BMI, and assign station queues.
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <select
              value={selectedCampId}
              onChange={(e) => setSelectedCampId(e.target.value)}
              className="px-3 py-2 bg-white border-2 border-slate-300 rounded-xl text-xs font-bold text-[#002642] outline-none"
            >
              {camps.map((camp) => (
                <option key={camp.id} value={camp.id}>
                  [{camp.clientName}] {camp.name}
                </option>
              ))}
            </select>

            <button
              onClick={loadEmployees}
              className="p-2 border border-slate-300 bg-white rounded-xl hover:bg-slate-50 text-slate-600 shadow-xs"
              title="Refresh Queue"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Search & Tabs */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search Name, Emp Code, Agency..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-[#008C8C] outline-none"
            />
          </div>

          <div className="flex items-center bg-slate-200/70 p-1 rounded-xl text-xs font-bold">
            <button
              onClick={() => setActiveTab("pending")}
              className={`px-4 py-1.5 rounded-lg transition ${
                activeTab === "pending"
                  ? "bg-white text-[#002642] shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Pre-Registered ({employees.filter((e) => e.checkInStatus !== "CHECKED_IN").length})
            </button>
            <button
              onClick={() => setActiveTab("checked_in")}
              className={`px-4 py-1.5 rounded-lg transition ${
                activeTab === "checked_in"
                  ? "bg-white text-emerald-700 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Checked In ({employees.filter((e) => e.checkInStatus === "CHECKED_IN").length})
            </button>
          </div>
        </div>

        {/* Employee Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredEmployees.map((emp) => {
            const isChecked = emp.checkInStatus === "CHECKED_IN";
            return (
              <div
                key={emp.id}
                className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col justify-between hover:border-slate-300 transition space-y-4"
              >
                <div className="flex items-start space-x-3.5">
                  <div className="w-11 h-11 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0">
                    <User className="w-5 h-5 text-slate-400" />
                  </div>
                  <div className="space-y-0.5 overflow-hidden flex-1">
                    <h3 className="font-bold text-[#002642] text-sm truncate">{emp.fullName}</h3>
                    <div className="text-xs text-slate-500 font-mono">
                      Emp ID: <span className="font-semibold text-slate-700">{emp.empCode}</span>
                    </div>
                    {/* Agency Name Displayed Prominently */}
                    <div className="text-xs font-bold text-[#008C8C] flex items-center space-x-1 pt-0.5">
                      <Building2 className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{emp.agencyName || "Direct Payroll"}</span>
                    </div>
                    <div className="text-[11px] text-slate-400">
                      {emp.age} Y / {emp.gender} • {emp.department || "General"}
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                  {isChecked ? (
                    <div className="space-y-0.5">
                      <div className="text-emerald-600 font-bold font-mono flex items-center">
                        <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                        <span>{emp.uhid}</span>
                      </div>
                      <div className="text-[10px] text-slate-400">
                        BMI: {emp.bmi || "22.5"} ({emp.heightCm}cm / {emp.weightKg}kg)
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center space-x-1 text-amber-600 text-[11px]">
                      <Clock className="w-3.5 h-3.5" />
                      <span>Pending Gate Arrival</span>
                    </div>
                  )}

                  {!isChecked ? (
                    <button
                      onClick={() => handleOpenCheckIn(emp)}
                      className="px-4 py-2 bg-[#008C8C] hover:bg-[#006e6e] text-white rounded-xl text-xs font-bold shadow-xs transition"
                    >
                      Check In & Measure
                    </button>
                  ) : (
                    <button
                      onClick={() => setLastSlip(emp)}
                      className="p-1.5 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-lg text-xs transition"
                      title="View Token Slip (Optional)"
                    >
                      <Printer className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {filteredEmployees.length === 0 && (
          <div className="text-center py-12 bg-white rounded-2xl border border-slate-200 text-slate-400 text-xs">
            No employees found matching the search criteria.
          </div>
        )}
      </div>

      {/* Check-In Modal: Height / Weight / BMI & Dynamic Hazard Package */}
      {selectedEmp && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-black text-[#002642]">Reception Check-In</h3>
                <p className="text-xs text-slate-500">{selectedEmp.fullName} ({selectedEmp.empCode})</p>
                <p className="text-xs font-bold text-[#008C8C] mt-0.5">Agency: {selectedEmp.agencyName || "Direct Payroll"}</p>
              </div>
              <button onClick={() => setSelectedEmp(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Anthropometry Inputs */}
            <div className="space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Reception Anthropometry (Height & Weight)
              </h4>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1 flex items-center space-x-1">
                    <Ruler className="w-3.5 h-3.5 text-indigo-500" />
                    <span>Height (cm) *</span>
                  </label>
                  <input
                    type="number"
                    value={heightCm}
                    onChange={(e) => setHeightCm(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-bold text-[#002642]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1 flex items-center space-x-1">
                    <Scale className="w-3.5 h-3.5 text-teal-500" />
                    <span>Weight (kg) *</span>
                  </label>
                  <input
                    type="number"
                    value={weightKg}
                    onChange={(e) => setWeightKg(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-bold text-[#002642]"
                  />
                </div>
              </div>

              {/* BMI Auto-Calculation Card */}
              <div className="p-3 bg-teal-50 border border-teal-200 rounded-xl flex items-center justify-between">
                <div>
                  <div className="text-[10px] font-bold text-teal-800 uppercase tracking-wider">Auto-Calculated BMI</div>
                  <div className="text-lg font-black text-teal-900 font-mono">{calculatedBmi()} kg/m²</div>
                </div>
                <Activity className="w-6 h-6 text-teal-600" />
              </div>

              {/* Dynamic Hazardous Worker Exposure Checklist */}
              <div className="pt-2 border-t border-slate-100 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800">Hazardous / Plant Floor Exposure?</label>
                  <input
                    type="checkbox"
                    checked={isHazardousWorker}
                    onChange={(e) => setIsHazardousWorker(e.target.checked)}
                    className="w-4 h-4 rounded text-[#008C8C] focus:ring-[#008C8C]"
                  />
                </div>

                {isHazardousWorker && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-900 space-y-1">
                    <div className="font-bold flex items-center space-x-1">
                      <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                      <span>Dynamic Hazardous Package Activated:</span>
                    </div>
                    <div>• Spirometry (PFT) & Pure Tone Audiometry added</div>
                    <div>• Chest X-Ray PA View added to station queue</div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex space-x-3 pt-3">
              <button
                type="button"
                onClick={() => setSelectedEmp(null)}
                className="flex-1 py-2.5 border border-slate-300 text-slate-700 rounded-xl text-xs font-semibold hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmCheckIn}
                disabled={isSubmitting}
                className="flex-1 py-2.5 bg-[#008C8C] hover:bg-[#006e6e] text-white rounded-xl text-xs font-bold shadow-md transition disabled:opacity-50"
              >
                {isSubmitting ? "Allocating UHID..." : "Check In & Push to Queues"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Optional Token Slip Modal (Paperless default, printable if needed) */}
      {lastSlip && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <span className="text-[10px] font-bold text-[#008C8C] uppercase tracking-wider">Camp Token (Optional)</span>
              <button onClick={() => setLastSlip(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="border border-slate-200 rounded-xl p-4 bg-slate-50 space-y-2.5 text-xs">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <div>
                  <div className="text-[9px] font-bold text-slate-400 uppercase">UHID</div>
                  <div className="text-lg font-black font-mono text-[#002642]">{lastSlip.uhid}</div>
                </div>
                <QrCode className="w-8 h-8 text-slate-800" />
              </div>

              <div><strong>Name:</strong> {lastSlip.fullName}</div>
              <div><strong>Emp Code:</strong> {lastSlip.empCode}</div>
              <div><strong>Agency:</strong> <span className="font-bold text-[#008C8C]">{lastSlip.agencyName}</span></div>
              <div><strong>Height / Weight:</strong> {lastSlip.heightCm} cm / {lastSlip.weightKg} kg (BMI: {lastSlip.bmi})</div>
            </div>

            <div className="flex space-x-2">
              <button
                onClick={() => setLastSlip(null)}
                className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold"
              >
                Close (Paperless)
              </button>
              <button
                onClick={() => window.print()}
                className="flex-1 py-2 bg-[#002642] hover:bg-[#001e38] text-white rounded-xl text-xs font-semibold flex items-center justify-center space-x-1"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Slip</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}