// src/app/clients/page.tsx
"use client";

import React, { useState, useEffect } from "react";
import {
  getMasterServices,
  getAllClientsWithDetails,
  createClientWithPackage,
  updateClientWithPackage,
  type AdditionalContact,
} from "@/actions/client-actions";
import {
  Building2,
  Plus,
  Check,
  ShieldCheck,
  Stethoscope,
  RefreshCw,
  Pencil,
  Trash2,
  Users,
  Search,
  X,
} from "lucide-react";
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
  const [clientsList, setClientsList] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  // Edit mode state
  const [editingClientId, setEditingClientId] = useState<string | null>(null);
  const [editingPackageId, setEditingPackageId] = useState<string | null>(null);

  // Form fields
  const [selectedServices, setSelectedServices] = useState<string[]>(["srv_vitals", "srv_doc_exam"]);
  const [clientName, setClientName] = useState("");
  const [clientCode, setClientCode] = useState("");
  const [codeManuallyEdited, setCodeManuallyEdited] = useState(false);
  const [contactPerson, setContactPerson] = useState("");
  const [contactDesignation, setContactDesignation] = useState("");
  const [contactDepartment, setContactDepartment] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [totalStrength, setTotalStrength] = useState("101-250");
  const [campMonth, setCampMonth] = useState(CAMP_MONTHS[new Date().getMonth()]);
  const [additionalContacts, setAdditionalContacts] = useState<AdditionalContact[]>([]);
  const [agenciesInput, setAgenciesInput] = useState("Direct Payroll, Apex Labor Services");
  const [packageName, setPackageName] = useState("Standard Health Checkup Package");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  const loadData = async () => {
    const [srvData, cliData] = await Promise.all([
      getMasterServices(),
      getAllClientsWithDetails(),
    ]);
    setServicesList(srvData);
    setClientsList(cliData);
  };

  useEffect(() => {
    loadData();
  }, []);

  const resetForm = () => {
    setEditingClientId(null);
    setEditingPackageId(null);
    setClientName("");
    setClientCode("");
    setCodeManuallyEdited(false);
    setContactPerson("");
    setContactDesignation("");
    setContactDepartment("");
    setEmail("");
    setPhone("");
    setAddress("");
    setTotalStrength("101-250");
    setCampMonth(CAMP_MONTHS[new Date().getMonth()]);
    setAdditionalContacts([]);
    setAgenciesInput("Direct Payroll, Apex Labor Services");
    setPackageName("Standard Health Checkup Package");
    setSelectedServices(["srv_vitals", "srv_doc_exam"]);
  };

  const handleEditClient = (c: any) => {
    setEditingClientId(c.id);
    setEditingPackageId(c.packageId || null);
    setClientName(c.name || "");
    setClientCode(c.code || "");
    setCodeManuallyEdited(true);
    setContactPerson(c.contactPerson || "");
    setContactDesignation(c.contactDesignation || "");
    setContactDepartment(c.contactDepartment || "");
    setEmail(c.email || "");
    setPhone(c.phone || "");
    setAddress(c.address || "");
    setTotalStrength(c.totalStrength || "101-250");
    setCampMonth(c.campMonth || CAMP_MONTHS[new Date().getMonth()]);
    setAdditionalContacts(Array.isArray(c.additionalContacts) ? c.additionalContacts : []);
    setAgenciesInput(
      c.agencies?.length > 0
        ? c.agencies.map((a: any) => a.name).join(", ")
        : "Direct Payroll"
    );
    setPackageName(c.packageName || "Standard Health Checkup Package");
    setSelectedServices(Array.isArray(c.selectedServiceIds) ? c.selectedServiceIds : []);
    setSuccessMessage("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleClientNameChange = (val: string) => {
    setClientName(val);
    if (!editingClientId && !codeManuallyEdited && val.trim().length >= 2) {
      setClientCode(generateUniquePrefix(val));
    }
  };

  const toggleService = (id: string) => {
    setSelectedServices((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  };

  const addContactRow = () => {
    setAdditionalContacts((prev) => [
      ...prev,
      { name: "", designation: "", department: "", email: "", phone: "" },
    ]);
  };

  const updateContactRow = (idx: number, field: keyof AdditionalContact, value: string) => {
    setAdditionalContacts((prev) =>
      prev.map((row, i) => (i === idx ? { ...row, [field]: value } : row))
    );
  };

  const removeContactRow = (idx: number) => {
    setAdditionalContacts((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientName.trim()) {
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

      if (editingClientId) {
        const res = await updateClientWithPackage({
          id: editingClientId,
          name: clientName,
          code: clientCode,
          contactPerson,
          contactDesignation,
          contactDepartment,
          email,
          phone,
          address,
          totalStrength,
          campMonth,
          additionalContacts,
          agenciesList: agencyArray,
          packageId: editingPackageId,
          packageName,
          selectedServiceIds: selectedServices,
        });

        if (!res.success) {
          alert("Failed to update client: " + res.error);
          setIsSubmitting(false);
          return;
        }

        setSuccessMessage(
          `Client "${clientName}" updated with ${selectedServices.length} active services!`
        );
        resetForm();
        await loadData();
      } else {
        const res = await createClientWithPackage({
          name: clientName,
          code: clientCode,
          contactPerson,
          contactDesignation,
          contactDepartment,
          email,
          phone,
          address,
          totalStrength,
          campMonth,
          additionalContacts,
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
        resetForm();
        await loadData();
      }
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredClients = clientsList.filter((c) => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      c.name?.toLowerCase().includes(q) ||
      c.code?.toLowerCase().includes(q) ||
      c.contactPerson?.toLowerCase().includes(q) ||
      c.campMonth?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 p-6 md:p-10">
      <div className="max-w-5xl mx-auto space-y-8">
        <BackButton fallbackHref="/admin" label="Back to Dashboard" />

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-200 pb-6">
          <div>
            <div className="flex items-center space-x-2 text-indigo-600 font-semibold text-sm">
              <Building2 className="w-4 h-4" />
              <span>Client Management</span>
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900 mt-1">
              {editingClientId ? `Edit Client: ${clientName}` : "Onboard Client & Dynamic Package"}
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Configure contracted diagnostic stations per client. Only selected stations will appear during camps.
            </p>
          </div>
          {editingClientId && (
            <button
              type="button"
              onClick={resetForm}
              className="px-4 py-2 border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-sm font-medium rounded-lg flex items-center space-x-1.5 self-start"
            >
              <X className="w-4 h-4" />
              <span>Cancel Edit</span>
            </button>
          )}
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
                <label className="block text-xs font-medium text-slate-600 mb-1">Primary Contact Person</label>
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
              <label className="block text-xs font-medium text-slate-600 mb-1">Plant / Office Address</label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="GIDC / Industrial Estate address"
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
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

            {/* Multiple Contact Persons */}
            <div className="pt-2 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-700 flex items-center space-x-1.5">
                  <Users className="w-4 h-4 text-indigo-500" />
                  <span>Additional Contact Persons (EHS, Plant Head, Accounts)</span>
                </label>
                <button
                  type="button"
                  onClick={addContactRow}
                  className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 flex items-center space-x-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Contact</span>
                </button>
              </div>

              {additionalContacts.map((contact, idx) => (
                <div key={idx} className="grid grid-cols-1 md:grid-cols-6 gap-2 p-3 bg-slate-50 border border-slate-200 rounded-lg items-center">
                  <input
                    type="text"
                    placeholder="Name *"
                    value={contact.name}
                    onChange={(e) => updateContactRow(idx, "name", e.target.value)}
                    className="px-2.5 py-1.5 border border-slate-300 rounded text-xs bg-white"
                  />
                  <input
                    type="text"
                    placeholder="Designation"
                    value={contact.designation || ""}
                    onChange={(e) => updateContactRow(idx, "designation", e.target.value)}
                    className="px-2.5 py-1.5 border border-slate-300 rounded text-xs bg-white"
                  />
                  <input
                    type="text"
                    placeholder="Department"
                    value={contact.department || ""}
                    onChange={(e) => updateContactRow(idx, "department", e.target.value)}
                    className="px-2.5 py-1.5 border border-slate-300 rounded text-xs bg-white"
                  />
                  <input
                    type="email"
                    placeholder="Email"
                    value={contact.email || ""}
                    onChange={(e) => updateContactRow(idx, "email", e.target.value)}
                    className="px-2.5 py-1.5 border border-slate-300 rounded text-xs bg-white"
                  />
                  <input
                    type="tel"
                    placeholder="Phone"
                    value={contact.phone || ""}
                    onChange={(e) => updateContactRow(idx, "phone", e.target.value)}
                    className="px-2.5 py-1.5 border border-slate-300 rounded text-xs bg-white"
                  />
                  <button
                    type="button"
                    onClick={() => removeContactRow(idx)}
                    className="p-1.5 text-rose-600 hover:bg-rose-50 rounded justify-self-end"
                    title="Remove contact"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
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

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            {editingClientId && (
              <button
                type="button"
                onClick={resetForm}
                className="px-5 py-2.5 border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-medium text-sm rounded-lg"
              >
                Cancel
              </button>
            )}
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm rounded-lg shadow-sm transition flex items-center space-x-2 disabled:opacity-50"
            >
              {editingClientId ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              <span>
                {isSubmitting
                  ? "Saving..."
                  : editingClientId
                  ? "Update Client & Package"
                  : "Save & Onboard Client"}
              </span>
            </button>
          </div>
        </form>

        {/* Existing Clients Directory */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 md:p-8 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-800">
                Onboarded Clients ({clientsList.length})
              </h2>
              <p className="text-xs text-slate-500">
                Click Edit on any client to update contacts, strength, camp month, or contracted stations.
              </p>
            </div>
            <div className="relative w-full md:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search client name, code, month..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          {filteredClients.length === 0 ? (
            <div className="text-center py-8 text-sm text-slate-400 border border-dashed border-slate-200 rounded-lg">
              No clients found.
            </div>
          ) : (
            <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg overflow-hidden">
              {filteredClients.map((c) => (
                <div
                  key={c.id}
                  className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-50 transition"
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-slate-900">{c.name}</span>
                      <span className="text-xs font-mono bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
                        {c.code}
                      </span>
                      {c.campMonth && (
                        <span className="text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded font-medium">
                          {c.campMonth}
                        </span>
                      )}
                      {c.totalStrength && (
                        <span className="text-xs bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded font-medium">
                          Strength: {c.totalStrength}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-500 flex flex-wrap gap-x-4 gap-y-1">
                      <span>
                        Primary: {c.contactPerson || "N/A"}
                        {c.contactDesignation ? ` (${c.contactDesignation})` : ""}
                        {c.phone ? ` • ${c.phone}` : ""}
                      </span>
                      {c.additionalContacts?.length > 0 && (
                        <span className="text-indigo-600 font-medium">
                          +{c.additionalContacts.length} extra contact(s)
                        </span>
                      )}
                      <span>
                        Package: {c.packageName} ({c.selectedServiceIds?.length || 0} stations)
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleEditClient(c)}
                    className="px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold rounded-lg flex items-center space-x-1.5 self-start md:self-center shrink-0"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    <span>Edit Client</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}