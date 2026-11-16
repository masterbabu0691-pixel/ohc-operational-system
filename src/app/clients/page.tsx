// src/app/clients/page.tsx
"use client";

import React, { useState, useEffect } from "react";
import { getMasterServices, createClientWithPackage } from "@/actions/client-actions";
import { Building2, Plus, Check, ShieldCheck, Stethoscope, RefreshCw } from "lucide-react";
import { BackButton } from "@/components/shared/BackButton";

interface ServiceItem {
  id: string;
  code: string;
  name: string;
  station: string;
}

const STRENGTH_OPTIONS = [
  "1-100",
  "101-250",
  "251-500",
  "501-1000",
  "1001-1500",
  "1501-2000",
  "2001-3000",
  "3000-5000",
  "5000+",
];

const CAMP_MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function generateUniquePrefix(name: string) {
  const clean = name
    .trim()
    .replace(/[^a-zA-Z0-9\s]/g, "")
    .split(/\s+/)
    .filter(Boolean);
  const prefix =
    clean.length >= 2
      ? `${clean[0].slice(0, 4)}-${clean[1].slice(0, 3)}`
      : (clean[0] || "CLI").slice(0, 6);
  const rand = Math.floor(100 + Math.random() * 900);
  return `${prefix.toUpperCase()}-${rand}`;
}

export default function ClientsPage() {
  const [servicesList, setServicesList] = useState<ServiceItem[]>([]);
  const [selectedServices, setSelectedServices] = useState<string[]>(["srv_vitals", "srv_doc_exam"]);
  const [clientName, setClientName] = useState("");
  const [clientCode, setClientCode] = useState("");
  const [codeManuallyEdited, setCodeManuallyEdited] = useState(false);
  const [contactPerson, setContactPerson] = useState("");
  const [contactDesignation, setContactDesignation] = useState("");
  const [contactDepartment, setContactDepartment] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [totalStrength, setTotalStrength] = useState("101-250");
  const [campMonth, setCampMonth] = useState(CAMP_MONTHS[new Date().getMonth()]);
  const [agenciesInput, setAgenciesInput] = useState("Direct Payroll, Apex Labor Services");
  const [packageName, setPackageName] = useState("Standard Health Checkup Package");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    async function load() {
      const data = await getMasterServices();
      setServicesList(data);
    }
    load();
  }, []);

  const handleClientNameChange = (val: string) => {
    setClientName(val);
    if (!codeManuallyEdited && val.trim().length >= 2) {
      setClientCode(generateUniquePrefix(val));
    }
  };

  const toggleService = (id: string) => {
    setSelectedServices((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientName) {
      alert("Please provide client name");
      return;
    }

    setIsSubmitting(true);
    setSuccessMessage("");

    try {
      const agencyArray = agenciesInput
        .split(",")
        .map((a) => a.trim())
        .filter(Boolean);

      const res = await createClientWithPackage({
        name: clientName,
        code: clientCode,
        contactPerson,
        contactDesignation,
        contactDepartment,
        email,
        phone,
        totalStrength,
        campMonth,
        agenciesList: agencyArray,
        packageName,
        selectedServiceIds: selectedServices,
      });

      if (!res.success) {
        alert("Failed to create client: " + res.error);
        setIsSubmitting(false);
        return;
      }

      setSuccessMessage(
        `Client "${clientName}" (${res.clientCode}) onboarded with ${selectedServices.length} active services!`
      );
      setClientName("");
      setClientCode("");
      setCodeManuallyEdited(false);
      setContactPerson("");
      setContactDesignation("");
      setContactDepartment("");
      setEmail("");
      setPhone("");
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 p-6 md:p-10">
      <div className="max-w-5xl mx-auto space-y-6">
        <BackButton fallbackHref="/admin" label="Back to Dashboard" />

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-200 pb-6">
          <div>
            <div className="flex items-center space-x-2 text-indigo-600 font-semibold text-sm">
              <Building2 className="w-4 h-4" />
              <span>Client Management</span>
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900 mt-1">
              Onboard Client & Dynamic Package
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Configure contracted diagnostic stations per client. Only selected stations will appear during camps.
            </p>
          </div>
        </div>

        {successMessage && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-lg flex items-center space-x-3 text-sm">
            <Check className="w-5 h-5 text-emerald-600" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 md:p-8 space-y-8">
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-slate-800 flex items-center space-x-2">
              <ShieldCheck className="w-5 h-5 text-indigo-500" />
              <span>1. Client Information</span>
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Client / Company Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Tata Motors Plant"
                  value={clientName}
                  onChange={(e) => handleClientNameChange(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Client Code * (Auto-Generated Unique)
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Auto-generated unique code"
                    value={clientCode}
                    onChange={(e) => {
                      setClientCode(e.target.value);
                      setCodeManuallyEdited(true);
                    }}
                    required
                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500 uppercase"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setCodeManuallyEdited(false);
                      setClientCode(generateUniquePrefix(clientName || "CLIENT"));
                    }}
                    title="Regenerate unique code"
                    className="px-2.5 py-2 border border-slate-300 rounded-md hover:bg-slate-50 text-slate-600"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Contact Person</label>
                <input
                  type="text"
                  placeholder="e.g. Amit Shah"
                  value={contactPerson}
                  onChange={(e) => setContactPerson(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Designation</label>
                  <input
                    type="text"
                    placeholder="e.g. HR Head"
                    value={contactDesignation}
                    onChange={(e) => setContactDesignation(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Department</label>
                  <input
                    type="text"
                    placeholder="e.g. EHS / HR"
                    value={contactDepartment}
                    onChange={(e) => setContactDepartment(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Email / Phone</label>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="email"
                    placeholder="hr@client.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <input
                    type="tel"
                    placeholder="+91 98765-43210"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Total Employee Strength</label>
                  <select
                    value={totalStrength}
                    onChange={(e) => setTotalStrength(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {STRENGTH_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Month of Camp</label>
                  <select
                    value={campMonth}
                    onChange={(e) => setCampMonth(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {CAMP_MONTHS.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Agencies / Contractors / Departments (comma-separated)
              </label>
              <input
                type="text"
                value={agenciesInput}
                onChange={(e) => setAgenciesInput(e.target.value)}
                placeholder="Direct Payroll, Apex Staffing, TeamLease"
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <hr className="border-slate-100" />

          {/* Service Checkboxes */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-800 flex items-center space-x-2">
                <Stethoscope className="w-5 h-5 text-indigo-500" />
                <span>2. Dynamic Service Package Setup</span>
              </h2>
              <span className="text-xs bg-indigo-50 text-indigo-700 font-semibold px-2.5 py-1 rounded-full">
                {selectedServices.length} Stations Selected
              </span>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Package Name</label>
              <input
                type="text"
                value={packageName}
                onChange={(e) => setPackageName(e.target.value)}
                className="w-full max-w-md px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pt-2">
              {servicesList.map((srv) => {
                const isChecked = selectedServices.includes(srv.id);
                return (
                  <div
                    key={srv.id}
                    onClick={() => toggleService(srv.id)}
                    className={`cursor-pointer border rounded-lg p-3 transition flex items-start space-x-3 select-none ${
                      isChecked
                        ? "border-indigo-600 bg-indigo-50/40 text-slate-900"
                        : "border-slate-200 bg-white hover:border-slate-300 text-slate-600"
                    }`}
                  >
                    <div
                      className={`w-5 h-5 mt-0.5 rounded flex items-center justify-center border transition ${
                        isChecked
                          ? "bg-indigo-600 border-indigo-600 text-white"
                          : "border-slate-300 bg-white"
                      }`}
                    >
                      {isChecked && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                    </div>
                    <div>
                      <div className="text-sm font-semibold">{srv.name}</div>
                      <div className="text-xs text-slate-400 font-mono mt-0.5">{srv.code}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t border-slate-100">
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm rounded-lg shadow-sm transition flex items-center space-x-2 disabled:opacity-50"
            >
              <Plus className="w-4 h-4" />
              <span>{isSubmitting ? "Onboarding..." : "Save & Onboard Client"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}