// src/app/mrd/page.tsx
"use client";

import React, { useState, useEffect } from "react";
import { getCampsList } from "@/actions/camp-actions";
import { getCampMrdRecords, updateMrdPhysicalLocation } from "@/actions/mrd-actions";
import * as XLSX from "xlsx";
import JSZip from "jszip";
import { 
  FolderArchive, 
  FileSpreadsheet, 
  CheckCircle2, 
  Box, 
  Search 
} from "lucide-react";
import { BackButton } from "@/components/shared/BackButton";

export default function MrdPage() {
  const [camps, setCamps] = useState<any[]>([]);
  const [selectedCampId, setSelectedCampId] = useState("");
  const [mrdData, setMrdData] = useState<any | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isExportingZip, setIsExportingZip] = useState(false);
  const [editingLocEmpId, setEditingLocEmpId] = useState<string | null>(null);
  const [locInput, setLocInput] = useState("");

  useEffect(() => {
    async function load() {
      const campList = await getCampsList();
      setCamps(campList);
      if (campList.length > 0) {
        setSelectedCampId(campList[0].id);
      }
    }
    load();
  }, []);

  const loadCampData = async () => {
    if (!selectedCampId) return;
    const data = await getCampMrdRecords(selectedCampId);
    setMrdData(data);
  };

  useEffect(() => {
    loadCampData();
  }, [selectedCampId]);

  const handleExportExcel = () => {
    if (!mrdData) return;

    const exportRows = mrdData.employees.map((emp: any) => {
      const vitals = emp.diagnostics.find((d: any) => d.station === "VITALS_ANTHROPOMETRY")?.structuredData || {};
      const vision = emp.diagnostics.find((d: any) => d.station === "VISION_SCREENING")?.structuredData || {};
      const ecg = emp.diagnostics.find((d: any) => d.station === "ECG")?.findingsSummary || "Normal";
      const xray = emp.diagnostics.find((d: any) => d.station === "CHEST_XRAY")?.findingsSummary || "Normal";

      return {
        "UHID": emp.uhid,
        "Employee Code": emp.empCode,
        "Full Name": emp.fullName,
        "Age": emp.age,
        "Gender": emp.gender,
        "Company": mrdData.camp.clientName,
        "Agency / Contractor": emp.agencyName,
        "Department": emp.department || "General",
        "Designation": emp.designation || "Staff",
        "Blood Group": emp.bloodGroup || "N/A",
        "Height (cm)": vitals.height_cm || "",
        "Weight (kg)": vitals.weight_kg || "",
        "BMI": vitals.bmi || "",
        "BP (Systolic/Diastolic)": vitals.bp_systolic ? `${vitals.bp_systolic}/${vitals.bp_diastolic}` : "",
        "Pulse (bpm)": vitals.pulse_bpm || "",
        "Vision Right": vision.distance_right || "6/6",
        "Vision Left": vision.distance_left || "6/6",
        "Color Vision": vision.color_vision || "Normal",
        "ECG Rhythm": ecg,
        "Chest X-Ray": xray,
        "Fitness Status": emp.doctorReview?.fitnessStatus || "PENDING",
        "Examining Doctor": emp.doctorReview?.doctorName || "Pending Review",
        "Physical File Location": emp.mrdRecord?.physicalFileLocation || "Not Archived",
      };
    });

    const ws = XLSX.utils.json_to_sheet(exportRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Master Camp Roster");

    const fileName = `${mrdData.camp.clientCode}_${mrdData.camp.campName.replace(/[^a-zA-Z0-9_-]/g, "_")}_Master_Summary.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  const handleExportHierarchicalZip = async () => {
    if (!mrdData) return;
    setIsExportingZip(true);

    try {
      const zip = new JSZip();
      const clientFolder = zip.folder(mrdData.camp.clientName.replace(/[^a-zA-Z0-9_-]/g, "_"))!;

      const excelRows = mrdData.employees.map((emp: any) => ({
        "UHID": emp.uhid,
        "Emp Code": emp.empCode,
        "Name": emp.fullName,
        "Agency": emp.agencyName,
        "Fitness": emp.doctorReview?.fitnessStatus || "PENDING",
      }));
      const ws = XLSX.utils.json_to_sheet(excelRows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Roster");
      const excelBuffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
      clientFolder.file("_Master_Camp_Summary.xlsx", excelBuffer);

      for (const emp of mrdData.employees) {
        const agencyName = (emp.agencyName || "Direct_Payroll").replace(/[^a-zA-Z0-9_-]/g, "_");
        const agencyFolder = clientFolder.folder(agencyName)!;

        const dossierHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>${emp.uhid} - Medical Dossier</title>
  <style>
    body { font-family: sans-serif; padding: 30px; font-size: 13px; color: #1e293b; }
    h1 { font-size: 18px; margin-bottom: 2px; }
    .header { border-bottom: 2px solid #0f172a; padding-bottom: 10px; margin-bottom: 20px; }
    .meta { display: flex; justify-content: space-between; margin-bottom: 20px; }
    .table { width: 100%; border-collapse: collapse; margin-top: 15px; }
    .table th, .table td { border: 1px solid #cbd5e1; padding: 8px; text-align: left; }
    .table th { background: #f8fafc; font-size: 11px; text-transform: uppercase; }
  </style>
</head>
<body>
  <div class="header">
    <h1>${mrdData.camp.clientName} - OCCUPATIONAL HEALTH MEDICAL DOSSIER</h1>
    <div>Camp: ${mrdData.camp.campName} (${mrdData.camp.location})</div>
  </div>
  <div class="meta">
    <div>
      <div><strong>Full Name:</strong> ${emp.fullName}</div>
      <div><strong>UHID:</strong> ${emp.uhid}</div>
      <div><strong>Emp Code:</strong> ${emp.empCode}</div>
    </div>
    <div>
      <div><strong>Agency / Contractor:</strong> ${emp.agencyName}</div>
      <div><strong>Age / Gender:</strong> ${emp.age} Y / ${emp.gender}</div>
      <div><strong>Department:</strong> ${emp.department || "General"}</div>
    </div>
  </div>
  <h3>Doctor Fitness Determination:</h3>
  <p><strong>Status:</strong> ${emp.doctorReview?.fitnessStatus || "PENDING EVALUATION"}</p>
  <p><strong>Clinical Notes:</strong> ${emp.doctorReview?.clinicalNotes || "Standard occupational fitness approved."}</p>
  <p><strong>Examining Doctor:</strong> ${emp.doctorReview?.doctorName || "Medical Officer"}</p>
</body>
</html>`;

        const sanitizedEmpName = emp.fullName.replace(/[^a-zA-Z0-9_-]/g, "_");
        agencyFolder.file(`${emp.uhid}_${sanitizedEmpName}_Dossier.html`, dossierHtml);
      }

      const zipContent = await zip.generateAsync({ type: "blob" });
      const downloadUrl = URL.createObjectURL(zipContent);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = `${mrdData.camp.clientCode}_Hierarchical_Medical_Archive.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err: any) {
      alert("ZIP packaging failed: " + err.message);
    } finally {
      setIsExportingZip(false);
    }
  };

  const handleSaveLocation = async (empId: string) => {
    if (!locInput.trim() || !mrdData) return;
    await updateMrdPhysicalLocation({
      employeeId: empId,
      campId: selectedCampId,
      clientId: mrdData.camp.clientId,
      location: locInput,
    });
    setEditingLocEmpId(null);
    setLocInput("");
    loadCampData();
  };

  const filteredEmployees = mrdData?.employees.filter((e: any) =>
    e.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    e.uhid.toLowerCase().includes(searchQuery.toLowerCase()) ||
    e.empCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
    e.agencyName.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 p-6 md:p-8 space-y-6">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Back and Home Shortcut */}
        <BackButton fallbackHref="/admin" label="Back to Dashboard" />

        {/* Header Bar */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <div className="flex items-center space-x-2 text-indigo-600 font-semibold text-sm">
              <FolderArchive className="w-4 h-4" />
              <span>Medical Records Department (MRD)</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 mt-0.5">
              Camp Archival, Master Excel & Hierarchical Dossiers
            </h1>
          </div>

          <div className="flex items-center space-x-3">
            <select
              value={selectedCampId}
              onChange={(e) => setSelectedCampId(e.target.value)}
              className="px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            >
              {camps.map((camp) => (
                <option key={camp.id} value={camp.id}>
                  {camp.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Camp KPI Summary Cards */}
        {mrdData && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
              <div className="text-xs text-slate-500 font-medium">Total Registered</div>
              <div className="text-2xl font-bold text-slate-900 mt-1">{mrdData.employees.length}</div>
              <div className="text-[10px] text-slate-400 mt-0.5">{mrdData.camp.clientName}</div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
              <div className="text-xs text-slate-500 font-medium">Certified Fit</div>
              <div className="text-2xl font-bold text-emerald-600 mt-1">
                {mrdData.employees.filter((e: any) => e.doctorReview?.fitnessStatus === "FIT").length}
              </div>
              <div className="text-[10px] text-emerald-600 font-medium mt-0.5">Approved for duty</div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
              <div className="text-xs text-slate-500 font-medium">Follow-Up Required</div>
              <div className="text-2xl font-bold text-amber-600 mt-1">
                {mrdData.employees.filter((e: any) => e.doctorReview?.fitnessStatus === "TEMPORARILY_UNFIT_FOLLOW_UP").length}
              </div>
              <div className="text-[10px] text-amber-600 font-medium mt-0.5">Temporary review</div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
              <div className="text-xs text-slate-500 font-medium">Unfit / Disqualified</div>
              <div className="text-2xl font-bold text-rose-600 mt-1">
                {mrdData.employees.filter((e: any) => e.doctorReview?.fitnessStatus === "UNFIT").length}
              </div>
              <div className="text-[10px] text-rose-600 font-medium mt-0.5">Disqualified</div>
            </div>
          </div>
        )}

        {/* Action Toolbar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <input
              type="text"
              placeholder="Search UHID, Emp Code, Name, Agency..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>

          <div className="flex items-center space-x-3 w-full sm:w-auto">
            <button
              onClick={handleExportExcel}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-sm transition flex items-center space-x-1.5"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Download Client Master Excel</span>
            </button>

            <button
              onClick={handleExportHierarchicalZip}
              disabled={isExportingZip}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-sm transition flex items-center space-x-1.5 disabled:opacity-50"
            >
              <FolderArchive className="w-4 h-4" />
              <span>{isExportingZip ? "Packaging ZIP..." : "Download [Client]/[Agency] ZIP"}</span>
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase text-[10px]">
                <tr>
                  <th className="py-3 px-4">UHID</th>
                  <th className="py-3 px-4">Employee</th>
                  <th className="py-3 px-4">Agency</th>
                  <th className="py-3 px-4">Fitness Status</th>
                  <th className="py-3 px-4">Physical Shelf Location</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredEmployees.map((emp: any) => (
                  <tr key={emp.id} className="hover:bg-slate-50/70 transition">
                    <td className="py-3 px-4 font-mono font-bold text-indigo-600">{emp.uhid}</td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-900">{emp.fullName}</div>
                      <div className="text-[10px] text-slate-400 font-mono">Code: {emp.empCode}</div>
                    </td>
                    <td className="py-3 px-4">{emp.agencyName}</td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        emp.doctorReview?.fitnessStatus === "FIT"
                          ? "bg-emerald-100 text-emerald-800"
                          : emp.doctorReview?.fitnessStatus === "UNFIT"
                          ? "bg-rose-100 text-rose-800"
                          : "bg-amber-100 text-amber-800"
                      }`}>
                        {emp.doctorReview?.fitnessStatus || "PENDING"}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      {editingLocEmpId === emp.id ? (
                        <div className="flex items-center space-x-1">
                          <input
                            type="text"
                            placeholder="e.g. Rack-4/Shelf-B"
                            value={locInput}
                            onChange={(e) => setLocInput(e.target.value)}
                            className="px-2 py-1 border border-indigo-400 rounded text-xs w-32 focus:outline-none"
                          />
                          <button
                            onClick={() => handleSaveLocation(emp.id)}
                            className="p-1 bg-indigo-600 text-white rounded hover:bg-indigo-700"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div
                          onClick={() => {
                            setEditingLocEmpId(emp.id);
                            setLocInput(emp.mrdRecord?.physicalFileLocation || "");
                          }}
                          className="cursor-pointer text-slate-600 hover:text-indigo-600 font-mono text-[11px] flex items-center space-x-1"
                        >
                          <Box className="w-3.5 h-3.5 text-slate-400" />
                          <span>{emp.mrdRecord?.physicalFileLocation || "Click to assign shelf"}</span>
                        </div>
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