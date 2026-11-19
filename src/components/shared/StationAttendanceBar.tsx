// src/components/shared/StationAttendanceBar.tsx
"use client";

import React, { useState } from "react";
import { staffClockIn, staffClockOut } from "@/actions/admin-actions";
import { LogIn, LogOut, CheckCircle2 } from "lucide-react";

export function StationAttendanceBar({
  campId,
  stationName,
}: {
  campId: string;
  stationName: string;
}) {
  const [clockedIn, setClockedIn] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");

  if (!campId) return null;

  const handleClockIn = async () => {
    const res = await staffClockIn({ campId, station: stationName });
    if (res.success) {
      setClockedIn(true);
      setStatusMsg(res.alreadyClockedIn ? "Shift Active" : "Logged In to Station");
    }
  };

  const handleClockOut = async () => {
    const res = await staffClockOut({ campId });
    if (res.success) {
      setClockedIn(false);
      setStatusMsg("Logged Out (Sent for Coordinator Approval)");
    }
  };

  return (
    <div className="flex items-center space-x-2 text-[11px]">
      {statusMsg && (
        <span className="text-emerald-700 font-bold flex items-center space-x-1">
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>{statusMsg}</span>
        </span>
      )}
      {!clockedIn ? (
        <button
          type="button"
          onClick={handleClockIn}
          className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold flex items-center space-x-1"
        >
          <LogIn className="w-3 h-3" />
          <span>Station Login</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={handleClockOut}
          className="px-2.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold flex items-center space-x-1"
        >
          <LogOut className="w-3 h-3" />
          <span>Station Logout</span>
        </button>
      )}
    </div>
  );
}