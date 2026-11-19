// src/app/login/page.tsx
"use client";

import React, { useState } from "react";
import { loginUser } from "@/actions/auth-actions";
import { ShieldCheck, Lock, Mail, AlertTriangle, ArrowRight } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [lockedEmail, setLockedEmail] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setIsLoading(true);

    const res = await loginUser(email, password);
    setIsLoading(false);

    if (res.success) {
      if (res.role === "SUPER_ADMIN") window.location.href = "/admin";
      else if (res.role === "CAMP_COORDINATOR") window.location.href = "/coordinator";
      else if (res.role === "RECEPTIONIST") window.location.href = "/reception";
      else if (res.role === "NURSE") window.location.href = "/nurse";
      else if (res.role === "PHLEBOTOMIST") window.location.href = "/phlebotomy";
      else if (res.role === "LAB_TECHNICIAN") window.location.href = "/lab";
      else if (res.role === "FIELD_DOCTOR") window.location.href = "/doctor/field";
      else if (res.role === "OFFICE_DOCTOR") window.location.href = "/doctor/office";
      else if (res.role === "DOCTOR_EXAMINER") window.location.href = "/doctor";
      else if (res.role === "MRD_OFFICER" || res.role === "CLIENT_HR") window.location.href = "/mrd";
      else window.location.href = "/diagnostics";
    } else {
      setErrorMsg(res.error || "Login failed");
      if (res.isLocked && res.lockedEmail) {
        setLockedEmail(res.lockedEmail);
      }
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl space-y-6">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center mx-auto text-white shadow-lg shadow-indigo-500/30">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight">OHC Secure Workstation Login</h1>
          <p className="text-xs text-slate-400">Vyora Occupational Health Camp Operations System</p>
        </div>

        {errorMsg && (
          <div
            className={`p-3.5 rounded-xl border text-xs flex items-start space-x-2.5 ${
              lockedEmail
                ? "bg-rose-950/80 border-rose-800 text-rose-200"
                : "bg-amber-950/80 border-amber-800 text-amber-200"
            }`}
          >
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="leading-relaxed flex-1">{errorMsg}</div>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Workstation Email Address</label>
            <div className="relative">
              <Mail className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
              <input
                type="email"
                required
                placeholder="staff@vyorahealthcare.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setErrorMsg("");
                }}
                className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Password</label>
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
              <input
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setErrorMsg("");
                }}
                className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-xl shadow-lg shadow-indigo-600/30 transition flex items-center justify-center space-x-2 disabled:opacity-50"
          >
            <span>{isLoading ? "Authenticating..." : "Sign In to Workstation"}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <div className="pt-3 border-t border-slate-800/80 text-center text-[11px] text-slate-500">
          Authorized staff only. Contact Super Admin for account access or password resets.
        </div>
      </div>
    </div>
  );
}