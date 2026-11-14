// src/app/admin/users/page.tsx
"use client";

import React, { useState, useEffect } from "react";
import { getAdminUsers, createOrUpdateUser } from "@/actions/admin-actions";
import { secureUnlockAccount } from "@/actions/auth-actions";
import { getClientsForCamp } from "@/actions/camp-actions";
import { UserPlus, Check, Unlock } from "lucide-react";
import { BackButton } from "@/components/shared/BackButton";

export default function AdminUsersPage() {
  const [usersList, setUsersList] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<any>("DOCTOR_EXAMINER");
  const [assignedClientId, setAssignedClientId] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");

  const loadData = async () => {
    const [u, c] = await Promise.all([getAdminUsers(), getClientsForCamp()]);
    setUsersList(u);
    setClients(c);
  };

  useEffect(() => {
    loadData();
  }, []);

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
      role,
      assignedClientId: role === "CLIENT_HR" ? assignedClientId : undefined,
    });
    setIsSaving(false);

    if (res.success) {
      setMessage(`User "${name}" saved with role ${role}!`);
      setName("");
      setEmail("");
      loadData();
    } else {
      alert("Error: " + res.error);
    }
  };

  const handleUnlockUser = async (targetEmail: string) => {
    // Pass plain string targetEmail to match the function signature
    const res = await secureUnlockAccount(targetEmail);
    if (res.success) {
      setMessage(`Account ${targetEmail} unlocked. Staff member can now log in.`);
      loadData();
    } else {
      alert("Unauthorized: " + res.error);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <BackButton fallbackHref="/admin" label="Back to Dashboard" />

      <div className="border-b border-slate-200 pb-5">
        <h1 className="text-2xl font-bold text-[#002642] tracking-tight">
          User Management & Workstation Security (RBAC)
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Create operational staff accounts, assign workstation permissions, and manage security locks.
        </p>
      </div>

      {message && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-2.5 rounded-lg text-xs font-semibold flex items-center space-x-2">
          <Check className="w-4 h-4 text-emerald-600" />
          <span>{message}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Form: Add User */}
        <form onSubmit={handleSave} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
          <h2 className="text-sm font-bold text-[#002642] uppercase tracking-wider flex items-center space-x-2">
            <UserPlus className="w-4 h-4 text-[#008C8C]" />
            <span>Create / Assign Staff</span>
          </h2>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Full Name *</label>
            <input
              type="text"
              placeholder="Dr. Rajesh Patel"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-[#008C8C]"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Email Address *</label>
            <input
              type="email"
              placeholder="rajesh@ohc.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-[#008C8C]"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Workstation Role *</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-[#008C8C]"
            >
              <option value="DOCTOR_EXAMINER">Doctor Examiner</option>
              <option value="RECEPTIONIST">Receptionist (Check-In Desk)</option>
              <option value="PHLEBOTOMIST">Phlebotomist (Blood Draw)</option>
              <option value="LAB_TECHNICIAN">Lab Technician</option>
              <option value="DIAGNOSTIC_TECHNICIAN">Diagnostic Technician (X-Ray/ECG/PFT)</option>
              <option value="MRD_OFFICER">MRD Archival Officer</option>
              <option value="CLIENT_HR">Client HR (Restricted)</option>
              <option value="SUPER_ADMIN">Super Admin (Full Access)</option>
            </select>
          </div>

          {role === "CLIENT_HR" && (
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Restricted To Client</label>
              <select
                value={assignedClientId}
                onChange={(e) => setAssignedClientId(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-[#008C8C]"
              >
                <option value="">-- Select Client --</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <button
            type="submit"
            disabled={isSaving}
            className="w-full py-2 bg-[#008C8C] hover:bg-[#006e6e] text-white font-semibold text-xs rounded-lg shadow-sm transition"
          >
            {isSaving ? "Saving User..." : "Assign Role & Save Staff"}
          </button>
        </form>

        {/* Users Table */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 text-xs font-bold text-slate-600 uppercase tracking-wider flex justify-between items-center">
            <span>Staff Accounts & Security Status ({usersList.length})</span>
            <span className="text-[10px] text-slate-400 font-normal">Super Admin Unlock Controls</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-semibold uppercase text-[10px] border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Staff Member</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Security Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {usersList.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50/70 transition">
                    <td className="py-3 px-4">
                      <div className="font-bold text-[#002642]">{u.name}</div>
                      <div className="text-[11px] text-slate-500 font-mono">{u.email}</div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-mono text-indigo-700 font-bold">{u.role}</span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                        ACTIVE
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      {u.role !== "SUPER_ADMIN" ? (
                        <button
                          type="button"
                          onClick={() => handleUnlockUser(u.email)}
                          className="px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:text-emerald-700 bg-slate-100 hover:bg-emerald-50 rounded-lg border border-slate-200 transition inline-flex items-center space-x-1"
                          title="Reset failed login attempts to 0"
                        >
                          <Unlock className="w-3 h-3 text-emerald-600" />
                          <span>Reset / Unlock</span>
                        </button>
                      ) : (
                        <span className="text-[10px] font-bold text-slate-400 uppercase font-mono">Immune</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}