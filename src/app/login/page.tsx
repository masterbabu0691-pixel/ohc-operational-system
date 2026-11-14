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
      else if (res.role === "DOCTOR_EXAMINER") window.location.href = "/doctor";
      else if (res.role === "RECEPTIONIST") window.location.href = "/reception";
      else if (res.role === "MRD_OFFICER") window.location.href = "/mrd";
      else window.location.href = "/diagnostics";
    } else {
      setErrorMsg(res.error || "Login failed");
      if (res.isLocked && res.lockedEmail) {
        setLockedEmail(res.lockedEmail);
      }
    }
  };

  const selectAccount = (fillEmail: string) => {
    setEmail(fillEmail);
    setPassword("Admin@123");
    setErrorMsg("");
    if (fillEmail !== lockedEmail) {
      setLockedEmail(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center mx-auto text-white shadow-lg shadow-indigo-500/30">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight">OHC Secure Workstation Login</h1>
          <p className="text-xs text-slate-400">Occupational Health Checkup Operations System</p>
        </div>

        {/* Lockout or Error Banner */}
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

        {/* Form */}
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Workstation Email Address</label>
            <div className="relative">
              <Mail className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
              <input
                type="email"
                required
                placeholder="doctor@ohc.com"
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

        {/* Quick Credentials (Public unlock button removed) */}
        <div className="pt-4 border-t border-slate-800/80 space-y-3">
          <div className="text-[11px] text-slate-400 font-medium">
            Demo Accounts (Default Password: <code className="text-indigo-400 font-mono">Admin@123</code>):
          </div>

          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => selectAccount("admin@ohc.com")}
              className="py-1.5 px-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-[10px] font-mono text-center border border-slate-700 hover:border-indigo-500 transition"
            >
              Super Admin
            </button>
            <button
              type="button"
              onClick={() => selectAccount("doctor@ohc.com")}
              className="py-1.5 px-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-[10px] font-mono text-center border border-slate-700 hover:border-indigo-500 transition"
            >
              Doctor
            </button>
            <button
              type="button"
              onClick={() => selectAccount("reception@ohc.com")}
              className="py-1.5 px-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-[10px] font-mono text-center border border-slate-700 hover:border-indigo-500 transition"
            >
              Receptionist
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}