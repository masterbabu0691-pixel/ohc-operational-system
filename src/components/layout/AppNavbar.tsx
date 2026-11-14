// src/components/layout/AppNavbar.tsx
import React from "react";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { logoutUser } from "@/actions/auth-actions";
import { 
  Building2, 
  Calendar, 
  UserCheck, 
  Stethoscope, 
  FileSpreadsheet, 
  ShieldAlert, 
  LogOut, 
  User,
  LayoutDashboard
} from "lucide-react";

export async function AppNavbar() {
  const session = await getSession();
  if (!session) return null; // Hide navbar on login page

  const role = session.role;

  // Filter links based on role
  // Inside src/components/layout/AppNavbar.tsx
  const allLinks = [
    { name: "Camp Monitor", href: "/admin", roles: ["SUPER_ADMIN"] },
    { name: "Clients", href: "/clients", roles: ["SUPER_ADMIN"] },
    { name: "Camps", href: "/camps", roles: ["SUPER_ADMIN", "RECEPTIONIST"] },
    { name: "Reception", href: "/reception", roles: ["SUPER_ADMIN", "RECEPTIONIST"] },
    { name: "Nurse Desk", href: "/nurse", roles: ["SUPER_ADMIN", "NURSE"] },
    { name: "Phlebotomy", href: "/phlebotomy", roles: ["SUPER_ADMIN", "PHLEBOTOMIST"] },
    { name: "Diagnostics", href: "/diagnostics", roles: ["SUPER_ADMIN", "DIAGNOSTIC_TECHNICIAN"] },
    { name: "Field Doctor", href: "/doctor/field", roles: ["SUPER_ADMIN", "FIELD_DOCTOR"] },
    { name: "Office Doctor", href: "/doctor/office", roles: ["SUPER_ADMIN", "OFFICE_DOCTOR"] },
    { name: "MRD & Archive", href: "/mrd", roles: ["SUPER_ADMIN", "MRD_OFFICER", "CLIENT_HR"] },
  ];

  const visibleLinks = allLinks.filter((link) => link.roles.includes(role));

  return (
    <header className="bg-slate-900 border-b border-slate-800 text-white px-6 py-3 flex items-center justify-between sticky top-0 z-40 shadow-sm">
      <div className="flex items-center space-x-6">
        <Link href="/" className="flex items-center space-x-2 font-bold text-sm tracking-wide">
          <div className="w-7 h-7 bg-indigo-600 rounded-lg flex items-center justify-center text-white">
            <ShieldAlert className="w-4 h-4" />
          </div>
          <span className="hidden sm:inline">OHC System</span>
        </Link>

        <nav className="flex items-center space-x-1 overflow-x-auto">
          {visibleLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition whitespace-nowrap"
            >
              {link.name}
            </Link>
          ))}
        </nav>
      </div>

      <div className="flex items-center space-x-4">
        {/* User Badge */}
        <div className="hidden md:flex items-center space-x-2 text-xs">
          <div className="w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center text-slate-300">
            <User className="w-3.5 h-3.5" />
          </div>
          <div>
            <span className="font-semibold text-white">{session.name}</span>
            <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] font-mono bg-indigo-950 text-indigo-400 border border-indigo-800">
              {session.role}
            </span>
          </div>
        </div>

        {/* Logout */}
        <form action={logoutUser}>
          <button
            type="submit"
            title="Log out"
            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </form>
      </div>
    </header>
  );
}