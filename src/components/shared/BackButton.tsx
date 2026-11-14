// src/components/shared/BackButton.tsx
"use client";

import React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Home } from "lucide-react";

interface BackButtonProps {
  fallbackHref?: string;
  label?: string;
}

export function BackButton({ fallbackHref = "/admin", label = "Back" }: BackButtonProps) {
  const router = useRouter();

  const handleBack = () => {
    if (window.history.length > 1) {
      router.back();
    } else {
      router.push(fallbackHref);
    }
  };

  return (
    <div className="flex items-center space-x-2.5 mb-4">
      {/* 1. Go to Previous Screen */}
      <button
        type="button"
        onClick={handleBack}
        className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold shadow-xs transition"
        title="Go to previous page"
      >
        <ArrowLeft className="w-3.5 h-3.5 stroke-[2.5]" />
        <span>{label}</span>
      </button>

      {/* 2. Direct Shortcut to Dashboard Home */}
      <Link
        href="/admin"
        className="inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-xl text-slate-500 hover:text-[#002642] hover:bg-slate-100 text-xs font-semibold transition"
        title="Return to Camp Monitor Dashboard"
      >
        <Home className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Dashboard</span>
      </Link>
    </div>
  );
}