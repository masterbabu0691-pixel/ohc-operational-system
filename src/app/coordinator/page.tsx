// Last Updated: 21-11-2026 16:52 IST
// src/app/coordinator/page.tsx
"use client";

import React, { useState, useEffect } from "react";
import { getCampsList } from "@/actions/camp-actions";
import {
  getCorrectionRequests,
  resolveCorrectionRequest,
  lookupEmployeeForCoordinator,
  coordinatorDirectTestOverride,
} from "@/actions/clinical-actions";
import { ShieldAlert, CheckCircle2, XCircle, Clock, RefreshCw, Unlock, Search, PlusCircle } from "lucide-react";
import { BackButton } from "@/components/shared/BackButton";

export default function CampCoordinatorPage() {
  const [camps, setCamps] = useState<any[]>([]);
  const [selectedCampId, setSelectedCampId] = useState("");
  const [requests, setRequests] = useState<any[]>([]);
  const [filterTab, setFilterTab] = useState<"PENDING" | "RESOLVED">("PENDING");
  const [noteById, setNoteById] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);

  const [empQuery, setEmpQuery] = useState("");
  const [empResult, setEmpResult] = useState<any | null>(null);
  const [addServiceId, setAddServiceId] = useState("");
  const [overrideMsg, setOverrideMsg] = useState("");

  useEffect(() => {
    async function load() {
      const data = await getCampsList();
      setCamps(data);
      if (data.length > 0) setSelectedCampId(data[0].id);
    }
    load();
  }, []);

  const loadRequests = async () => {
    setIsLoading(true);
    const data = await getCorrectionRequests(selectedCampId || undefined);
    setRequests(data);
    setIsLoading(false);
  };

  useEffect(() => {
    loadRequests();
  }, [selectedCampId]);

  const handleResolve = async (requestId: string, action: "APPROVE" | "REJECT") => {
    const res = await resolveCorrectionRequest({
      requestId,
      action,
      resolutionNote: noteById[requestId] || "",
    });
    if (res.success) {
      alert(action === "APPROVE" ? "Station unlocked for correction!" : "Request rejected.");
      loadRequests();
    } else {
      alert(res.error || "Action failed.");
    }
  };

  const handleLookupEmp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCampId || !empQuery.trim()) return;
    setOverrideMsg("");
    const res = await lookupEmployeeForCoordinator(selectedCampId, empQuery);
    setEmpResult(res);
    if (!res) setOverrideMsg("No employee found in selected camp with that UHID or Emp Code.");
  };

  const handleAddTest = async () => {
    if (!empResult?.employee || !addServiceId) return;
    const res = await coordinatorDirectTestOverride({
      campId: selectedCampId,
      employeeId: empResult.employee.id,
      serviceId: addServiceId,
    });
    if (res.success) {
      setOverrideMsg("Test added & station enabled for this employee!");
      const refreshed = await lookupEmployeeForCoordinator(selectedCampId, empResult.employee.uhid);
      setEmpResult(refreshed);
    } else {
      alert(res.error);
    }
  };

  const handleDirectUnlock = async (station: any) => {
    if (!empResult?.employee) return;
    const res = await coordinatorDirectTestOverride({
      campId: selectedCampId,
      employeeId: empResult.employee.id,
      unlockStation: station,
    });
    if (res.success) {
      setOverrideMsg(`Unlocked ${station} for ${empResult.employee.fullName}!`);
      const refreshed = await lookupEmployeeForCoordinator(selectedCampId, empResult.employee.uhid);
      setEmpResult(refreshed);
    } else {
      alert(res.error);
    }
  };

  const pending = requests.filter((r) => r.status === "PENDING");
  const resolved = requests.filter((r) => r.status !== "PENDING");
  const visible = filterTab === "PENDING" ? pending : resolved;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 p-4 sm:p-6 space-y-5">
      <div className="max-w-6xl mx-auto space-y-5">
        <BackButton fallbackHref="/admin" label="Back to Dashboard" />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
          <div>
            <div className="flex items-center space-x-2 text-amber-600 font-bold text-xs uppercase tracking-wider">
              <ShieldAlert className="w-4 h-4" />
              <span>Ongoing Camp Query & Edit-Lock Control</span>
            </div>
            <h1 className="text-2xl font-black text-[#002642]">Camp Coordinator & High-Mgmt Override</h1>
            <p className="text-xs text-slate-500">
              Directly add omitted tests or unlock locked stations, and review field desk correction requests.
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <select
              value={selectedCampId}
              onChange={(e) => setSelectedCampId(e.target.value)}
              className="px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-bold"
            >
              <option value="">All Active Camps</option>
              {camps.map((c) => (
                <option key={c.id} value={c.id}>
                  [{c.clientName}] {c.name}
                </option>
              ))}
            </select>
            <button
              onClick={loadRequests}
              className="p-2 bg-white border border-slate-300 rounded-xl hover:bg-slate-50"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-black text-[#002642]">High-Management Direct Override (Add Test / Unlock Station)</h2>
              <p className="text-xs text-slate-500">Search an employee by UHID or Emp Code in the selected camp.</p>
            </div>
            <form onSubmit={handleLookupEmp} className="flex gap-2">
              <input
                type="text"
                placeholder="Enter UHID or Emp Code..."
                value={empQuery}
                onChange={(e) => setEmpQuery(e.target.value)}
                className="px-3 py-1.5 border border-slate-300 rounded-xl text-xs w-56"
              />
              <button
                type="submit"
                disabled={!selectedCampId}
                className="px-4 py-1.5 bg-[#002642] text-white rounded-xl text-xs font-bold flex items-center space-x-1 disabled:opacity-40"
              >
                <Search className="w-3.5 h-3.5" />
                <span>Lookup</span>
              </button>
            </form>
          </div>

          {overrideMsg && (
            <div className="p-2.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-semibold">
              {overrideMsg}
            </div>
          )}

          {empResult?.employee && (
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3 text-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <span className="font-black text-sm text-[#002642]">{empResult.employee.fullName}</span>{" "}
                  <span className="font-mono text-teal-700">({empResult.employee.uhid} • {empResult.employee.empCode})</span>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={addServiceId}
                    onChange={(e) => setAddServiceId(e.target.value)}
                    className="px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white text-xs"
                  >
                    <option value="">-- Add Extra Test --</option>
                    {empResult.services?.map((s: any) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.code})
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={handleAddTest}
                    disabled={!addServiceId}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold flex items-center space-x-1 disabled:opacity-40"
                  >
                    <PlusCircle className="w-3.5 h-3.5" />
                    <span>Add Test</span>
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {empResult.checklists?.map((chk: any) => (
                  <div
                    key={chk.station}
                    className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg flex items-center space-x-2"
                  >
                    <span className="font-bold text-slate-700">{chk.station}</span>
                    <span className="text-[10px] font-mono text-slate-500">{chk.arrivalStatus}</span>
                    {chk.isLocked && (
                      <button
                        type="button"
                        onClick={() => handleDirectUnlock(chk.station)}
                        className="px-2 py-0.5 bg-amber-500 hover:bg-amber-600 text-white rounded text-[10px] font-bold flex items-center space-x-1"
                      >
                        <Unlock className="w-3 h-3" />
                        <span>Unlock</span>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex space-x-2 bg-slate-200/70 p-1 rounded-xl w-fit text-xs font-bold">
          <button
            onClick={() => setFilterTab("PENDING")}
            className={`px-4 py-1.5 rounded-lg transition ${
              filterTab === "PENDING" ? "bg-white text-[#002642] shadow-xs" : "text-slate-600"
            }`}
          >
            Pending Queries ({pending.length})
          </button>
          <button
            onClick={() => setFilterTab("RESOLVED")}
            className={`px-4 py-1.5 rounded-lg transition ${
              filterTab === "RESOLVED" ? "bg-white text-emerald-700 shadow-xs" : "text-slate-600"
            }`}
          >
            Resolved ({resolved.length})
          </button>
        </div>

        <div className="space-y-3">
          {visible.map((req) => (
            <div
              key={req.id}
              className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4"
            >
              <div className="space-y-1 text-xs">
                <div className="flex items-center space-x-2">
                  <span className="font-black text-sm text-[#002642]">{req.employeeName}</span>
                  <span className="px-2 py-0.5 rounded bg-slate-100 font-mono text-[10px] font-bold">
                    {req.uhid}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 font-bold text-[10px]">
                    {req.station}
                  </span>
                </div>
                <div className="text-slate-600">
                  <strong>Reason:</strong> {req.reason}
                </div>
                <div className="text-[11px] text-slate-400">
                  Requested by <strong>{req.requestedBy}</strong> ({req.requestedByRole}) •{" "}
                  {new Date(req.createdAt).toLocaleString()}
                </div>
              </div>

              {req.status === "PENDING" ? (
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <input
                    type="text"
                    placeholder="Coordinator note (optional)"
                    value={noteById[req.id] || ""}
                    onChange={(e) =>
                      setNoteById((prev) => ({ ...prev, [req.id]: e.target.value }))
                    }
                    className="px-3 py-1.5 border border-slate-300 rounded-xl text-xs"
                  />
                  <button
                    onClick={() => handleResolve(req.id, "APPROVE")}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center justify-center space-x-1"
                  >
                    <Unlock className="w-3.5 h-3.5" />
                    <span>Approve & Unlock</span>
                  </button>
                  <button
                    onClick={() => handleResolve(req.id, "REJECT")}
                    className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold flex items-center justify-center space-x-1"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    <span>Reject</span>
                  </button>
                </div>
              ) : (
                <div className="text-xs font-bold flex items-center space-x-1.5">
                  {req.status === "APPROVED" ? (
                    <span className="text-emerald-700 flex items-center space-x-1">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Unlocked by {req.resolvedBy}</span>
                    </span>
                  ) : (
                    <span className="text-rose-600 flex items-center space-x-1">
                      <Clock className="w-4 h-4" />
                      <span>Rejected by {req.resolvedBy}</span>
                    </span>
                  )}
                </div>
              )}
            </div>
          ))}

          {visible.length === 0 && (
            <div className="text-center py-16 bg-white rounded-2xl border border-slate-200 text-slate-400 text-xs">
              No {filterTab.toLowerCase()} correction requests found.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}