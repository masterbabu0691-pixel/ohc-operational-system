// src/app/admin/users/page.tsx
"use client";

import React, { useState, useEffect } from "react";
import {
  getAdminUsers,
  createOrUpdateUser,
  uploadStaffDocument,
  getStaffDocuments,
  getCampStaffAttendance,
  approveStaffAttendance,
  getFilteredAuditLogs,
} from "@/actions/admin-actions";
import { secureUnlockAccount } from "@/actions/auth-actions";
import { getClientsForCamp, getCampsList } from "@/actions/camp-actions";
import { UserPlus, Check, Unlock, Upload, Clock, FileText, CheckCircle2, XCircle } from "lucide-react";
import { BackButton } from "@/components/shared/BackButton";

type AdminTab = "USERS" | "ATTENDANCE" | "LOGS";

export default function AdminUsersPage() {
  const [activeTab, setActiveTab] = useState<AdminTab>("USERS");
  const [usersList, setUsersList] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [camps, setCamps] = useState<any[]>([]);
  const [staffDocs, setStaffDocs] = useState<any[]>([]);
  const [attendanceList, setAttendanceList] = useState<any[]>([]);
  const [logsList, setLogsList] = useState<any[]>([]);

  // User Form State
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<any>("NURSE");
  const [assignedClientId, setAssignedClientId] = useState("");
  const [assignedStation, setAssignedStation] = useState("SPIROMETRY_PFT");
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");

  // Filters
  const [attCampId, setAttCampId] = useState("");
  const [logFilterType, setLogFilterType] = useState<"ALL" | "STAFF" | "CLIENT" | "EMPLOYEE">("ALL");
  const [logQuery, setLogQuery] = useState("");

  const loadData = async () => {
    const [u, c, cmps, docs] = await Promise.all([
      getAdminUsers(),
      getClientsForCamp(),
      getCampsList(),
      getStaffDocuments(),
    ]);
    setUsersList(u);
    setClients(c);
    setCamps(cmps);
    setStaffDocs(docs);
  };

  const loadAttendance = async () => {
    const rows = await getCampStaffAttendance(attCampId || undefined);
    setAttendanceList(rows);
  };

  const loadLogs = async () => {
    const rows = await getFilteredAuditLogs({ filterType: logFilterType, query: logQuery });
    setLogsList(rows);
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (activeTab === "ATTENDANCE") loadAttendance();
    if (activeTab === "LOGS") loadLogs();
  }, [activeTab, attCampId, logFilterType]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email) {
      alert("Please provide name and email.");
      return;
    }

    setIsSaving(true);
    const res = await createOrUpdateUser({
      name,
      email,
      password: password || undefined,
      role,
      assignedClientId: role === "CLIENT_HR" ? assignedClientId : undefined,
      assignedStation: role === "DIAGNOSTIC_TECHNICIAN" ? (assignedStation as any) : null,
    });
    setIsSaving(false);

    if (res.success) {
      setMessage(`User "${name}" saved with role ${role}!`);
      setName("");
      setEmail("");
      setPassword("");
      loadData();
    } else {
      alert("Error: " + res.error);
    }
  };

  const handleUnlockUser = async (targetEmail: string) => {
    const res = await secureUnlockAccount(targetEmail);
    if (res.success) {
      setMessage(`Account ${targetEmail} unlocked.`);
      loadData();
    } else {
      alert("Unauthorized: " + res.error);
    }
  };

  const handleDocUpload = (userId: string, docType: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const res = await uploadStaffDocument({
        userId,
        docType,
        fileName: file.name,
        fileUrl: reader.result as string,
      });
      if (res.success) {
        setMessage(`Uploaded ${docType} (${file.name})`);
        loadData();
      }
    };
    reader.readAsDataURL(file);
  };

  const handleApproveAttendance = async (attendanceId: string, status: "APPROVED" | "REJECTED") => {
    const res = await approveStaffAttendance({ attendanceId, status });
    if (res.success) loadAttendance();
    else alert(res.error);
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <BackButton fallbackHref="/admin" label="Back to Dashboard" />

      <div className="border-b border-slate-200 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#002642] tracking-tight">
            Staff Onboarding, Attendance & Security (RBAC)
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Manage staff accounts with unique passwords, KYC/registration docs, camp attendance approvals, and audit logs.
          </p>
        </div>

        <div className="flex bg-slate-200/70 p-1 rounded-xl text-xs font-bold">
          <button
            onClick={() => setActiveTab("USERS")}
            className={`px-3.5 py-1.5 rounded-lg ${activeTab === "USERS" ? "bg-white text-[#002642] shadow-xs" : "text-slate-600"}`}
          >
            Staff & Docs
          </button>
          <button
            onClick={() => setActiveTab("ATTENDANCE")}
            className={`px-3.5 py-1.5 rounded-lg ${activeTab === "ATTENDANCE" ? "bg-white text-[#002642] shadow-xs" : "text-slate-600"}`}
          >
            Camp Attendance
          </button>
          <button
            onClick={() => setActiveTab("LOGS")}
            className={`px-3.5 py-1.5 rounded-lg ${activeTab === "LOGS" ? "bg-white text-[#002642] shadow-xs" : "text-slate-600"}`}
          >
            Audit Logs
          </button>
        </div>
      </div>

      {message && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-2.5 rounded-lg text-xs font-semibold flex items-center space-x-2">
          <Check className="w-4 h-4 text-emerald-600" />
          <span>{message}</span>
        </div>
      )}

      {/* TAB 1: USERS & ONBOARDING DOCS */}
      {activeTab === "USERS" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <form onSubmit={handleSave} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
            <h2 className="text-sm font-bold text-[#002642] uppercase tracking-wider flex items-center space-x-2">
              <UserPlus className="w-4 h-4 text-[#008C8C]" />
              <span>Create / Update Staff</span>
            </h2>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Full Name *</label>
              <input type="text" placeholder="Dr. Rajesh Patel" value={name} onChange={(e) => setName(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs" />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Email Address *</label>
              <input type="email" placeholder="rajesh@vyorahealthcare.com" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs" />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Password (min 6 chars; leave blank to keep existing)
              </label>
              <input type="password" placeholder="Unique strong password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs" />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Workstation Role *</label>
              <select value={role} onChange={(e) => setRole(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white">
                <option value="RECEPTIONIST">Receptionist</option>
                <option value="NURSE">Nurse</option>
                <option value="PHLEBOTOMIST">Phlebotomist</option>
                <option value="LAB_TECHNICIAN">Lab Technician</option>
                <option value="DIAGNOSTIC_TECHNICIAN">Diagnostic Technician (X-Ray/ECG/PFT/Audio)</option>
                <option value="FIELD_DOCTOR">Field Doctor</option>
                <option value="OFFICE_DOCTOR">Office Doctor</option>
                <option value="DOCTOR_EXAMINER">Doctor Examiner</option>
                <option value="CAMP_COORDINATOR">Camp Coordinator / Manager</option>
                <option value="MRD_OFFICER">MRD Archival Officer</option>
                <option value="CLIENT_HR">Client HR (Restricted)</option>
                <option value="SUPER_ADMIN">Super Admin</option>
              </select>
            </div>

            {role === "DIAGNOSTIC_TECHNICIAN" && (
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Assigned Diagnostic Station *</label>
                <select value={assignedStation} onChange={(e) => setAssignedStation(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white">
                  <option value="SPIROMETRY_PFT">PFT (Spirometry) Only</option>
                  <option value="AUDIOMETRY">Audiometry Only</option>
                  <option value="ECG">12-Lead ECG Only</option>
                  <option value="CHEST_XRAY">Chest X-Ray Only</option>
                </select>
              </div>
            )}

            {role === "CLIENT_HR" && (
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Restricted To Client</label>
                <select value={assignedClientId} onChange={(e) => setAssignedClientId(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white">
                  <option value="">-- Select Client --</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            )}

            <button type="submit" disabled={isSaving} className="w-full py-2 bg-[#008C8C] hover:bg-[#006e6e] text-white font-semibold text-xs rounded-lg shadow-sm">
              {isSaving ? "Saving..." : "Save Staff Account"}
            </button>
          </form>

          <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 text-xs font-bold text-slate-600 uppercase tracking-wider flex justify-between">
              <span>Staff Accounts & Onboarding Docs ({usersList.length})</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-semibold uppercase text-[10px] border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Staff Member</th>
                    <th className="py-3 px-4">Role / Station</th>
                    <th className="py-3 px-4">Docs</th>
                    <th className="py-3 px-4 text-right">Security</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {usersList.map((u) => {
                    const userDocs = staffDocs.filter((d) => d.userId === u.id);
                    return (
                      <tr key={u.id} className="hover:bg-slate-50/70">
                        <td className="py-3 px-4">
                          <div className="font-bold text-[#002642]">{u.name}</div>
                          <div className="text-[11px] text-slate-500 font-mono">{u.email}</div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-mono text-indigo-700 font-bold">{u.role}</div>
                          {u.assignedStation && (
                            <div className="text-[10px] text-slate-500">{u.assignedStation}</div>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center space-x-2">
                            <span className="text-[11px] font-bold text-slate-600">{userDocs.length} file(s)</span>
                            <label className="px-2 py-1 bg-slate-100 hover:bg-slate-200 rounded text-[10px] font-bold cursor-pointer inline-flex items-center space-x-1">
                              <Upload className="w-3 h-3" />
                              <span>KYC/Cert</span>
                              <input type="file" accept="image/*,application/pdf" onChange={(e) => handleDocUpload(u.id, "KYC_CERT", e)} className="hidden" />
                            </label>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right">
                          {u.role !== "SUPER_ADMIN" ? (
                            <button
                              type="button"
                              onClick={() => handleUnlockUser(u.email)}
                              className="px-2.5 py-1 text-[11px] font-semibold bg-slate-100 hover:bg-emerald-50 rounded-lg border inline-flex items-center space-x-1"
                            >
                              <Unlock className="w-3 h-3 text-emerald-600" />
                              <span>Unlock</span>
                            </button>
                          ) : (
                            <span className="text-[10px] font-bold text-slate-400 uppercase font-mono">Immune</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: CAMP STAFF ATTENDANCE & APPROVAL */}
      {activeTab === "ATTENDANCE" && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <h2 className="text-sm font-bold text-[#002642] flex items-center space-x-2">
              <Clock className="w-4 h-4 text-[#008C8C]" />
              <span>Camp Staff Check-In / Check-Out & Coordinator Approval</span>
            </h2>
            <select value={attCampId} onChange={(e) => setAttCampId(e.target.value)} className="px-3 py-1.5 border rounded-xl text-xs font-bold">
              <option value="">All Camps</option>
              {camps.map((c) => (
                <option key={c.id} value={c.id}>[{c.clientName}] {c.name}</option>
              ))}
            </select>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] border-b">
                <tr>
                  <th className="py-2.5 px-3">Staff</th>
                  <th className="py-2.5 px-3">Camp / Station</th>
                  <th className="py-2.5 px-3">Check-In</th>
                  <th className="py-2.5 px-3">Check-Out</th>
                  <th className="py-2.5 px-3">Approval</th>
                  <th className="py-2.5 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {attendanceList.map((row) => (
                  <tr key={row.id}>
                    <td className="py-2.5 px-3 font-bold text-[#002642]">
                      {row.userName} <span className="text-[10px] font-normal text-slate-500">({row.userRole})</span>
                    </td>
                    <td className="py-2.5 px-3">{row.campName} • {row.station}</td>
                    <td className="py-2.5 px-3 font-mono">{new Date(row.checkInTime).toLocaleString()}</td>
                    <td className="py-2.5 px-3 font-mono">{row.checkOutTime ? new Date(row.checkOutTime).toLocaleString() : "Active"}</td>
                    <td className="py-2.5 px-3 font-bold">
                      <span className={`px-2 py-0.5 rounded text-[10px] ${
                        row.approvalStatus === "APPROVED"
                          ? "bg-emerald-100 text-emerald-800"
                          : row.approvalStatus === "REJECTED"
                          ? "bg-rose-100 text-rose-700"
                          : "bg-amber-100 text-amber-800"
                      }`}>
                        {row.approvalStatus}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right space-x-1">
                      {row.approvalStatus === "PENDING" && (
                        <>
                          <button onClick={() => handleApproveAttendance(row.id, "APPROVED")} className="px-2 py-1 bg-emerald-600 text-white rounded text-[10px] font-bold inline-flex items-center space-x-1">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Approve</span>
                          </button>
                          <button onClick={() => handleApproveAttendance(row.id, "REJECTED")} className="px-2 py-1 bg-rose-100 text-rose-700 rounded text-[10px] font-bold inline-flex items-center space-x-1">
                            <XCircle className="w-3 h-3" />
                            <span>Reject</span>
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: FILTERED AUDIT LOGS */}
      {activeTab === "LOGS" && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-bold text-[#002642] flex items-center space-x-2">
              <FileText className="w-4 h-4 text-indigo-600" />
              <span>Activity & Audit Logs</span>
            </h2>
            <div className="flex items-center gap-2 text-xs">
              <select value={logFilterType} onChange={(e) => setLogFilterType(e.target.value as any)} className="px-2.5 py-1.5 border rounded-lg font-bold">
                <option value="ALL">All Logs</option>
                <option value="STAFF">By Individual Staff</option>
                <option value="CLIENT">By Client / Camp</option>
                <option value="EMPLOYEE">By Employee</option>
              </select>
              <input
                type="text"
                placeholder="Filter ID, role, or action..."
                value={logQuery}
                onChange={(e) => setLogQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && loadLogs()}
                className="px-3 py-1.5 border rounded-lg"
              />
              <button onClick={loadLogs} className="px-3 py-1.5 bg-[#002642] text-white rounded-lg font-bold">
                Search
              </button>
            </div>
          </div>

          <div className="overflow-x-auto max-h-[450px]">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] border-b">
                <tr>
                  <th className="py-2 px-3">Timestamp</th>
                  <th className="py-2 px-3">Staff / Role</th>
                  <th className="py-2 px-3">Action</th>
                  <th className="py-2 px-3">Target</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {logsList.map((log) => (
                  <tr key={log.id}>
                    <td className="py-2 px-3 font-mono text-[11px]">{new Date(log.timestamp).toLocaleString()}</td>
                    <td className="py-2 px-3">{log.userId} ({log.userRole})</td>
                    <td className="py-2 px-3 font-bold text-indigo-700">{log.action}</td>
                    <td className="py-2 px-3 font-mono text-[11px]">{log.entityType}: {log.entityId}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}