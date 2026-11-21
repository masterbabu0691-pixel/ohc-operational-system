// Last Updated: 21-11-2026 16:52 IST
// src/app/camps/page.tsx
"use client";

import React, { useState, useEffect } from "react";
import { getClientsForCamp, createCamp, getCampsList, bulkUploadEmployees } from "@/actions/camp-actions";
import * as XLSX from "xlsx";
import { Calendar, Upload, FileSpreadsheet, Plus, Check, Download } from "lucide-react";
import { BackButton } from "@/components/shared/BackButton";

export default function CampsPage() {
  const [clients, setClients] = useState<any[]>([]);
  const [camps, setCamps] = useState<any[]>([]);
  const [selectedClientId, setSelectedClientId] = useState("");
  const [selectedPackageId, setSelectedPackageId] = useState("");
  const [campName, setCampName] = useState("");
  const [location, setLocation] = useState("");
  const [startDate, setStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split("T")[0]);

  const [targetCampId, setTargetCampId] = useState("");
  const [parsedRows, setParsedRows] = useState<any[]>([]);
  const [fileName, setFileName] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [message, setMessage] = useState("");

  const refreshData = async () => {
    const [clientData, campData] = await Promise.all([getClientsForCamp(), getCampsList()]);
    setClients(clientData);
    setCamps(campData);
    if (clientData.length > 0 && !selectedClientId) {
      setSelectedClientId(clientData[0].id);
      if (clientData[0].packages?.length > 0) {
        setSelectedPackageId(clientData[0].packages[0].id);
      }
    }
  };

  useEffect(() => {
    refreshData();
  }, []);

  const handleClientChange = (clientId: string) => {
    setSelectedClientId(clientId);
    const client = clients.find((c) => c.id === clientId);
    if (client && client.packages?.length > 0) {
      setSelectedPackageId(client.packages[0].id);
    } else {
      setSelectedPackageId("");
    }
  };

  const handleCreateCamp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClientId || !selectedPackageId || !campName || !location) {
      alert("Please fill all camp details");
      return;
    }

    const res = await createCamp({
      clientId: selectedClientId,
      packageId: selectedPackageId,
      name: campName,
      location,
      startDate,
      endDate,
    });

    if (res.success) {
      setMessage(`Camp "${campName}" scheduled successfully!`);
      setCampName("");
      setLocation("");
      refreshData();
    } else {
      alert("Error: " + res.error);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();

    reader.onload = (evt) => {
      const bstr = evt.target?.result;
      const wb = XLSX.read(bstr, { type: "binary" });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data: any[] = XLSX.utils.sheet_to_json(ws);

      const formatted = data
        .map((row: any) => ({
          empCode: String(row["Emp Code"] || row["Employee Code"] || row["emp_code"] || "").trim(),
          fullName: String(row["Full Name"] || row["Name"] || row["full_name"] || "").trim(),
          age: Number(row["Age"] || row["age"] || 30),
          gender: String(row["Gender"] || row["gender"] || "MALE").toUpperCase(),
          department: String(row["Department"] || row["dept"] || ""),
          designation: String(row["Designation"] || row["role"] || ""),
          agencyName: String(row["Agency"] || row["Contractor"] || ""),
          phone: String(row["Phone"] || row["Mobile"] || ""),
          bloodGroup: String(row["Blood Group"] || row["blood_group"] || ""),
          tests: String(row["Tests"] || row["Assigned Tests"] || row["Service Codes"] || ""),
        }))
        .filter((r) => r.empCode && r.fullName);

      setParsedRows(formatted);
    };

    reader.readAsBinaryString(file);
  };

  const handleUploadSubmit = async () => {
    if (!targetCampId) {
      alert("Please select the target camp for this bulk upload.");
      return;
    }
    if (parsedRows.length === 0) {
      alert("No valid employee rows found in the spreadsheet.");
      return;
    }

    setIsUploading(true);
    const camp = camps.find((c) => c.id === targetCampId);

    const res = await bulkUploadEmployees(targetCampId, camp.clientId, parsedRows);
    setIsUploading(false);

    if (res.success) {
      setMessage(`Successfully pre-registered ${res.count} employees!`);
      setParsedRows([]);
      setFileName("");
    } else {
      alert("Upload failed: " + res.error);
    }
  };

  const downloadSampleExcel = () => {
    const sampleData = [
      {
        "Emp Code": "TM-1001",
        "Full Name": "Rajesh Kumar",
        "Age": 32,
        "Gender": "MALE",
        "Department": "Assembly Line 1",
        "Designation": "Senior Operator",
        "Agency": "Direct Payroll",
        "Phone": "9876543210",
        "Blood Group": "B+ve",
        "Tests": "SRV_XRAY, SRV_PFT",
      },
      {
        "Emp Code": "TM-1002",
        "Full Name": "Pooja Patel",
        "Age": 28,
        "Gender": "FEMALE",
        "Department": "Quality Control",
        "Designation": "Inspector",
        "Agency": "Apex Labor Services",
        "Phone": "9876543211",
        "Blood Group": "O+ve",
        "Tests": "",
      },
    ];

    const ws = XLSX.utils.json_to_sheet(sampleData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Employees");
    XLSX.writeFile(wb, "OHC_Employee_PreRegistration_Template.xlsx");
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 p-6 md:p-10 space-y-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <BackButton fallbackHref="/admin" label="Back to Dashboard" />

        <div className="border-b border-slate-200 pb-5">
          <div className="flex items-center space-x-2 text-indigo-600 font-semibold text-sm">
            <Calendar className="w-4 h-4" />
            <span>Camp Execution</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 mt-1">
            Schedule Camp & Bulk Pre-Registration
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Create on-field medical camps linked to client service packages and bulk upload employee manifests (with optional Tests column).
          </p>
        </div>

        {message && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-lg flex items-center space-x-3 text-sm">
            <Check className="w-5 h-5 text-emerald-600" />
            <span>{message}</span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <form onSubmit={handleCreateCamp} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-5">
            <h2 className="text-lg font-semibold text-slate-800 flex items-center space-x-2">
              <Plus className="w-5 h-5 text-indigo-500" />
              <span>1. Schedule New Camp</span>
            </h2>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Select Client *</label>
              <select
                value={selectedClientId}
                onChange={(e) => handleClientChange(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.code})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Contracted Package *</label>
              <select
                value={selectedPackageId}
                onChange={(e) => setSelectedPackageId(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {clients
                  .find((c) => c.id === selectedClientId)
                  ?.packages?.map((p: any) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.activeServiceIds?.length || 0} stations)
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Camp Name *</label>
              <input
                type="text"
                placeholder="e.g. Sanand Plant Annual OHC Camp 2026"
                value={campName}
                onChange={(e) => setCampName(e.target.value)}
                required
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Camp Location / Plant Address *</label>
              <input
                type="text"
                placeholder="e.g. OHC Center, Gate No 3, Sanand GIDC"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                required
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Start Date</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">End Date</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm rounded-lg shadow-sm transition"
            >
              Schedule Camp
            </button>
          </form>

          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-5 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-800 flex items-center space-x-2">
                  <Upload className="w-5 h-5 text-indigo-500" />
                  <span>2. Bulk Pre-Registration (Excel)</span>
                </h2>
                <button
                  onClick={downloadSampleExcel}
                  className="text-xs text-indigo-600 hover:text-indigo-700 flex items-center space-x-1 font-medium"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Sample Excel</span>
                </button>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Assign to Active Camp *</label>
                <select
                  value={targetCampId}
                  onChange={(e) => setTargetCampId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">-- Choose Camp --</option>
                  {camps.map((camp) => (
                    <option key={camp.id} value={camp.id}>
                      {camp.name} ({camp.location})
                    </option>
                  ))}
                </select>
              </div>

              <div className="border-2 border-dashed border-slate-300 hover:border-indigo-500 rounded-lg p-6 text-center transition cursor-pointer bg-slate-50">
                <input
                  type="file"
                  id="excelUpload"
                  accept=".xlsx, .xls, .csv"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <label htmlFor="excelUpload" className="cursor-pointer block">
                  <FileSpreadsheet className="w-10 h-10 text-slate-400 mx-auto mb-2" />
                  <span className="text-sm font-semibold text-slate-700 block">
                    {fileName ? fileName : "Click to browse or drop Excel spreadsheet"}
                  </span>
                  <span className="text-xs text-slate-400 mt-1 block">
                    Supports .xlsx, .xls with Emp Code, Full Name, Age, Gender, Department, and optional Tests
                  </span>
                </label>
              </div>

              {parsedRows.length > 0 && (
                <div className="bg-indigo-50/50 border border-indigo-100 rounded-lg p-3 text-xs space-y-1">
                  <div className="font-semibold text-indigo-900 flex items-center justify-between">
                    <span>{parsedRows.length} employees parsed ready to upload</span>
                  </div>
                  <div className="text-slate-500 truncate">
                    Sample: {parsedRows[0].fullName} ({parsedRows[0].empCode}) {parsedRows[0].tests ? `• Tests: ${parsedRows[0].tests}` : ""}
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={handleUploadSubmit}
              disabled={isUploading || parsedRows.length === 0 || !targetCampId}
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-sm rounded-lg shadow-sm transition disabled:opacity-50"
            >
              {isUploading ? "Uploading Employees..." : `Upload ${parsedRows.length} Employees to Camp`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}