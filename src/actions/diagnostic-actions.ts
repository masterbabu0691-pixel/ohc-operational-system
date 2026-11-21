// Last Updated: 20-11-2026 15:53 IST
// src/actions/diagnostic-actions.ts
"use server";

import { db } from "@/db";
import {
  employees,
  agencies,
  camps,
  clientPackages,
  stationChecklist,
  diagnosticRecords,
  fieldDoctorExams,
  doctorReviews,
  services,
  users,
  auditLogs,
  labParameterAliases,
  stationTypeEnum,
} from "@/db/schema";
import { eq, and, desc, inArray, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { nanoid } from "nanoid";
import { getSession } from "@/lib/auth";

const DEFAULT_LAB_ALIASES = [
  { canonicalKey: "hb", displayLabel: "Hemoglobin (Hb)", unit: "g/dL", normalMin: "12", normalMax: "16", normalText: "", aliases: ["HAEMOGLOBIN (HB)", "HEMOGLOBIN", "HAEMOGLOBIN", "HB"] },
  { canonicalKey: "wbc", displayLabel: "WBC / TLC", unit: "10^3/uL", normalMin: "4.0", normalMax: "10.0", normalText: "", aliases: ["TOTAL LEUCOCYTE COUNT (TLC)", "TOTAL LEUCOCYTE COUNT", "WBC", "TLC", "WHITE BLOOD CELL"] },
  { canonicalKey: "platelets", displayLabel: "Platelets", unit: "10^3/µl", normalMin: "150", normalMax: "410", normalText: "", aliases: ["PLATELET COUNT(PLT)", "PLATELET COUNT", "PLATELETS", "PLATELET", "PLT"] },
  { canonicalKey: "esr", displayLabel: "ESR", unit: "mm/hr", normalMin: "0", normalMax: "12", normalText: "", aliases: ["ERYTHROCYTE SEDIMENTATION RATE", "ESR"] },
  { canonicalKey: "sgpt", displayLabel: "SGPT / ALT", unit: "U/L", normalMin: "3", normalMax: "35", normalText: "", aliases: ["ALANINE AMINOTRANSFERASE (ALT/SGPT)", "ALT (SGPT) SERUM", "ALT (SGPT)", "SGPT", "ALT"] },
  { canonicalKey: "creatinine", displayLabel: "S. Creatinine", unit: "mg/dl", normalMin: "0.3", normalMax: "1.2", normalText: "", aliases: ["SERUM CREATININE", "S. CREATININE", "S.CREAT", "CREATININE"] },
  { canonicalKey: "rbs", displayLabel: "RBS / FBS (Blood Sugar)", unit: "mg/dl", normalMin: "70", normalMax: "140", normalText: "", aliases: ["GLUCOSE, FASTING", "FASTING BLOOD SUGAR", "RANDOM BLOOD SUGAR", "BLOOD GLUCOSE RANDOM", "RBS", "FBS"] },
  { canonicalKey: "hba1c", displayLabel: "HbA1c", unit: "%", normalMin: "4.2", normalMax: "5.7", normalText: "", aliases: ["HBA1C (GLYCOSYLATED HEMOGLOBIN)", "GLYCOSYLATED HEMOGLOBIN", "HBA1C"] },
  { canonicalKey: "widal", displayLabel: "Widal Profile", unit: "", normalMin: "", normalMax: "", normalText: "Negative", aliases: ["WIDAL PROFILE", "WIDAL TEST", "WIDAL"] },
  { canonicalKey: "bloodGroup", displayLabel: "Blood Group", unit: "", normalMin: "", normalMax: "", normalText: "", aliases: ["BLOOD GROUP", "ABO GROUP", "BLOOD TYPE"] },
  { canonicalKey: "urineRm", displayLabel: "Urine R/M", unit: "", normalMin: "", normalMax: "", normalText: "Normal", aliases: ["URINE ROUTINE", "URINE R/M", "PUS CELLS"] },
];

export async function getLabParameterAliases() {
  try {
    const rows = await db.select().from(labParameterAliases).orderBy(labParameterAliases.displayLabel);
    if (rows.length === 0) return DEFAULT_LAB_ALIASES;
    return rows;
  } catch {
    return DEFAULT_LAB_ALIASES;
  }
}

export async function saveLabParameterAlias(params: {
  canonicalKey: string;
  displayLabel: string;
  unit?: string;
  normalMin?: string;
  normalMax?: string;
  normalText?: string;
  aliases: string[];
}) {
  try {
    const cleanKey = params.canonicalKey.trim();
    const cleanAliases = Array.from(new Set(params.aliases.map((a) => a.trim().toUpperCase()).filter(Boolean)));
    await db
      .insert(labParameterAliases)
      .values({
        id: `alias_${nanoid(8)}`,
        canonicalKey: cleanKey,
        displayLabel: params.displayLabel.trim(),
        unit: params.unit?.trim() || null,
        normalMin: params.normalMin?.trim() || null,
        normalMax: params.normalMax?.trim() || null,
        normalText: params.normalText?.trim() || null,
        aliases: cleanAliases,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: labParameterAliases.canonicalKey,
        set: {
          displayLabel: params.displayLabel.trim(),
          unit: params.unit?.trim() || null,
          normalMin: params.normalMin?.trim() || null,
          normalMax: params.normalMax?.trim() || null,
          normalText: params.normalText?.trim() || null,
          aliases: cleanAliases,
          updatedAt: new Date(),
        },
      });
    revalidatePath("/admin/services");
    revalidatePath("/lab");
    revalidatePath("/doctor/office");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function getDiagnosticTechnicianScope() {
  try {
    const session = await getSession();
    if (!session) return { role: "GUEST", assignedStation: null };
    const rows = await db
      .select({ role: users.role, assignedStation: users.assignedStation })
      .from(users)
      .where(eq(users.id, session.userId))
      .limit(1);

    return {
      role: rows[0]?.role || session.role,
      assignedStation: rows[0]?.assignedStation || null,
    };
  } catch {
    return { role: "SUPER_ADMIN", assignedStation: null };
  }
}

// Last Updated: 21-11-2026 16:14 IST
export async function getStationQueue(
  campId: string,
  station: (typeof stationTypeEnum.enumValues)[number]
) {
  try {
    const queue = await db
      .select({
        employeeId: employees.id,
        uhid: employees.uhid,
        empCode: employees.empCode,
        fullName: employees.fullName,
        age: employees.age,
        gender: employees.gender,
        department: employees.department,
        heightCm: employees.heightCm,
        weightKg: employees.weightKg,
        bmi: employees.bmi,
        labKitBarcode: employees.labKitBarcode,
        bloodCollected: employees.bloodCollected,
        urineCollected: employees.urineCollected,
        agencyId: employees.agencyId,
        agencyName: agencies.name,
        checklistStatus: stationChecklist.status,
        arrivalStatus: stationChecklist.arrivalStatus,
        isLocked: stationChecklist.isLocked,
      })
      .from(stationChecklist)
      .innerJoin(employees, eq(stationChecklist.employeeId, employees.id))
      .leftJoin(agencies, eq(employees.agencyId, agencies.id))
      .where(and(eq(stationChecklist.campId, campId), eq(stationChecklist.station, station)))
      .orderBy(stationChecklist.arrivalStatus, employees.uhid);

    return queue;
  } catch (err: any) {
    console.error("Error fetching station queue:", err);
    return [];
  }
}

export async function markDiagnosticArrived(
  employeeId: string,
  campId: string,
  station: (typeof stationTypeEnum.enumValues)[number]
) {
  try {
    const existing = await db
      .select({ id: stationChecklist.id, arrivalStatus: stationChecklist.arrivalStatus })
      .from(stationChecklist)
      .where(
        and(
          eq(stationChecklist.employeeId, employeeId),
          eq(stationChecklist.campId, campId),
          eq(stationChecklist.station, station)
        )
      )
      .limit(1);

    if (existing.length === 0) {
      await db.insert(stationChecklist).values({
        id: `chk_${nanoid(10)}`,
        employeeId,
        campId,
        station,
        arrivalStatus: "ARRIVED",
        arrivedAt: new Date(),
        isLocked: false,
      });
      revalidatePath("/diagnostics");
      revalidatePath("/lab");
      return { success: true, arrivalStatus: "ARRIVED" as const };
    }

    const current = existing[0].arrivalStatus;
    const nextStatus = current === "ARRIVED" ? "PENDING" : "ARRIVED";

    await db
      .update(stationChecklist)
      .set({
        arrivalStatus: nextStatus,
        arrivedAt: nextStatus === "ARRIVED" ? new Date() : null,
      })
      .where(eq(stationChecklist.id, existing[0].id));

    revalidatePath("/diagnostics");
    revalidatePath("/lab");
    return { success: true, arrivalStatus: nextStatus };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function lookupEmployeeByBarcode(campId: string, barcodeOrUhid: string) {
  try {
    const cleanQuery = barcodeOrUhid.trim().toUpperCase();
    const emp = await db
      .select({
        id: employees.id,
        uhid: employees.uhid,
        empCode: employees.empCode,
        fullName: employees.fullName,
        age: employees.age,
        gender: employees.gender,
        department: employees.department,
        heightCm: employees.heightCm,
        weightKg: employees.weightKg,
        bmi: employees.bmi,
        photoUrl: employees.photoUrl,
        agencyName: agencies.name,
      })
      .from(employees)
      .leftJoin(agencies, eq(employees.agencyId, agencies.id))
      .where(
        and(
          eq(employees.campId, campId),
          sql`(${employees.uhid} = ${cleanQuery} OR ${employees.barcode} = ${cleanQuery} OR ${employees.empCode} = ${cleanQuery} OR ${employees.labKitBarcode} = ${cleanQuery})`
        )
      )
      .limit(1);

    return emp[0] || null;
  } catch {
    return null;
  }
}

export async function saveDiagnosticResult(params: {
  employeeId: string;
  campId: string;
  station: (typeof stationTypeEnum.enumValues)[number];
  serviceCode: string;
  structuredData?: Record<string, any>;
  findingsSummary: string;
  isAbnormal?: boolean;
  identityMismatch?: boolean;
  identityMismatchNote?: string;
  attachmentUrls?: string[];
  capturedAfterCamp?: boolean;
  extractedViaOcr?: boolean;
  enteredBy?: string;
}) {
  try {
    const lockCheck = await db
      .select({ isLocked: stationChecklist.isLocked, arrivalStatus: stationChecklist.arrivalStatus })
      .from(stationChecklist)
      .where(
        and(
          eq(stationChecklist.employeeId, params.employeeId),
          eq(stationChecklist.campId, params.campId),
          eq(stationChecklist.station, params.station)
        )
      )
      .limit(1);

    if (lockCheck[0]?.isLocked) {
      return { success: false, error: "Entry is LOCKED. Request Camp Coordinator approval to rewrite." };
    }
    if (lockCheck.length === 0 || lockCheck[0].arrivalStatus !== "ARRIVED") {
      return { success: false, error: "Mandatory: Click 'Mark As Arrived' first before saving." };
    }

    const serviceRecord = await db
      .select({ id: services.id })
      .from(services)
      .where(eq(services.code, params.serviceCode))
      .limit(1);

    const serviceId = serviceRecord[0]?.id || `srv_${nanoid(8)}`;

    await db.insert(diagnosticRecords).values({
      id: `diag_${nanoid(10)}`,
      employeeId: params.employeeId,
      campId: params.campId,
      serviceId,
      serviceCode: params.serviceCode,
      station: params.station,
      structuredData: params.structuredData || {},
      findingsSummary: params.findingsSummary.trim(),
      isAbnormal: params.isAbnormal || false,
      identityMismatch: params.identityMismatch || false,
      identityMismatchNote: params.identityMismatchNote || null,
      attachmentUrls: params.attachmentUrls || [],
      capturedAfterCamp: params.capturedAfterCamp || false,
      extractedViaOcr: params.extractedViaOcr || false,
      enteredBy: params.enteredBy || "Diagnostic Technician",
    });

    await db
      .update(stationChecklist)
      .set({
        status: "COMPLETED",
        arrivalStatus: "COMPLETED",
        isLocked: true,
        completedAt: new Date(),
        completedBy: params.enteredBy || "Diagnostic Technician",
      })
      .where(
        and(
          eq(stationChecklist.employeeId, params.employeeId),
          eq(stationChecklist.campId, params.campId),
          eq(stationChecklist.station, params.station)
        )
      );

    revalidatePath("/diagnostics");
    revalidatePath("/lab");
    revalidatePath("/admin");
    return { success: true };
  } catch (error: any) {
    console.error("Save diagnostic error:", error);
    return { success: false, error: error.cause?.message || error.detail || error.message };
  }
}

// Deduplicated Lab Queue with each employee's own saved lab values
// Last Updated: 20-11-2026 15:53 IST
export async function getLabQueue(campId: string) {
  try {
    const [rows, labRecords, campRows, allServices] = await Promise.all([
      db
        .select({
          employeeId: employees.id,
          uhid: employees.uhid,
          empCode: employees.empCode,
          fullName: employees.fullName,
          age: employees.age,
          gender: employees.gender,
          department: employees.department,
          bloodGroup: employees.bloodGroup,
          heightCm: employees.heightCm,
          weightKg: employees.weightKg,
          bmi: employees.bmi,
          assignedServiceIds: employees.assignedServiceIds,
          labKitBarcode: employees.labKitBarcode,
          bloodCollected: employees.bloodCollected,
          urineCollected: employees.urineCollected,
          agencyName: agencies.name,
          checklistStatus: stationChecklist.status,
          arrivalStatus: stationChecklist.arrivalStatus,
          isLocked: stationChecklist.isLocked,
        })
        .from(employees)
        .leftJoin(agencies, eq(employees.agencyId, agencies.id))
        .leftJoin(
          stationChecklist,
          and(
            eq(stationChecklist.employeeId, employees.id),
            eq(stationChecklist.campId, campId),
            eq(stationChecklist.station, "PATHOLOGY_LAB")
          )
        )
        .where(and(eq(employees.campId, campId), eq(employees.checkInStatus, "CHECKED_IN")))
        .orderBy(employees.uhid),
      db
        .select()
        .from(diagnosticRecords)
        .where(and(eq(diagnosticRecords.campId, campId), eq(diagnosticRecords.station, "PATHOLOGY_LAB")))
        .orderBy(desc(diagnosticRecords.createdAt)),
      db.select({ packageId: camps.packageId }).from(camps).where(eq(camps.id, campId)).limit(1),
      db.select().from(services).where(eq(services.isActive, true)),
    ]);

    let campServiceIds: string[] = [];
    if (campRows[0]?.packageId) {
      const pkg = await db
        .select({ activeServiceIds: clientPackages.activeServiceIds })
        .from(clientPackages)
        .where(eq(clientPackages.id, campRows[0].packageId))
        .limit(1);
      campServiceIds = pkg[0]?.activeServiceIds || [];
    }

    const serviceMap = new Map(allServices.map((s) => [s.id, s]));
    const recordMap = new Map<string, any>();
    for (const rec of labRecords) {
      if (!recordMap.has(rec.employeeId)) recordMap.set(rec.employeeId, rec);
    }

    const seen = new Set<string>();
    const uniqueQueue = [];
    for (const r of rows) {
      if (!seen.has(r.employeeId)) {
        seen.add(r.employeeId);
        const savedRec = recordMap.get(r.employeeId);
        const empServiceIds =
          Array.isArray(r.assignedServiceIds) && r.assignedServiceIds.length > 0
            ? r.assignedServiceIds
            : campServiceIds;

        const contractedLabServices = empServiceIds
          .map((id) => serviceMap.get(id))
          .filter((s): s is NonNullable<typeof s> => Boolean(s && s.station === "PATHOLOGY_LAB"));

        uniqueQueue.push({
          ...r,
          agencyName: r.agencyName || "Direct Payroll",
          checklistStatus: r.checklistStatus || "PENDING",
          arrivalStatus: r.arrivalStatus || "PENDING",
          isLocked: Boolean(r.isLocked),
          contractedLabServices,
          savedLabData: savedRec?.structuredData || null,
          savedFindings: savedRec?.findingsSummary || null,
          savedAbnormal: Boolean(savedRec?.isAbnormal),
          identityMismatch: Boolean(savedRec?.identityMismatch),
          identityMismatchNote: savedRec?.identityMismatchNote || null,
        });
      }
    }
    return uniqueQueue;
  } catch (err) {
    console.error("getLabQueue error:", err);
    return [];
  }
}

export async function saveLabPathologyResult(params: {
  employeeId: string;
  campId: string;
  bloodGroup?: string;
  labValues: Record<string, string>;
  findingsSummary: string;
  isAbnormal: boolean;
  identityMismatch?: boolean;
  identityMismatchNote?: string;
  extractedViaOcr: boolean;
  attachmentUrls?: string[];
}) {
  if (params.bloodGroup?.trim()) {
    await db
      .update(employees)
      .set({ bloodGroup: params.bloodGroup.trim() })
      .where(eq(employees.id, params.employeeId));
  }

  return await saveDiagnosticResult({
    employeeId: params.employeeId,
    campId: params.campId,
    station: "PATHOLOGY_LAB",
    serviceCode: "SRV_PATHOLOGY_LAB",
    structuredData: params.labValues,
    findingsSummary: params.findingsSummary,
    isAbnormal: params.isAbnormal,
    identityMismatch: params.identityMismatch,
    identityMismatchNote: params.identityMismatchNote,
    extractedViaOcr: params.extractedViaOcr,
    attachmentUrls: params.attachmentUrls || [],
    enteredBy: "Lab Technician",
  });
}

export async function getLabMismatchAlerts(campId?: string) {
  try {
    const q = db
      .select({
        id: diagnosticRecords.id,
        employeeId: diagnosticRecords.employeeId,
        employeeName: employees.fullName,
        uhid: employees.uhid,
        campId: diagnosticRecords.campId,
        note: diagnosticRecords.identityMismatchNote,
        createdAt: diagnosticRecords.createdAt,
      })
      .from(diagnosticRecords)
      .innerJoin(employees, eq(diagnosticRecords.employeeId, employees.id))
      .where(
        campId && campId !== "all"
          ? and(eq(diagnosticRecords.identityMismatch, true), eq(diagnosticRecords.campId, campId))
          : eq(diagnosticRecords.identityMismatch, true)
      )
      .orderBy(desc(diagnosticRecords.createdAt));

    return await q;
  } catch {
    return [];
  }
}

// Last Updated: 20-11-2026 15:53 IST
export async function getEmployeeFullDossier(employeeId: string, campId: string) {
  try {
    const [empRows, fieldExamRows, diagRows, reviewRows, campRows, allServices] = await Promise.all([
      db
        .select({ employee: employees, agencyName: agencies.name })
        .from(employees)
        .leftJoin(agencies, eq(employees.agencyId, agencies.id))
        .where(eq(employees.id, employeeId))
        .limit(1),
      db.select().from(fieldDoctorExams).where(eq(fieldDoctorExams.employeeId, employeeId)).limit(1),
      db
        .select()
        .from(diagnosticRecords)
        .where(and(eq(diagnosticRecords.employeeId, employeeId), eq(diagnosticRecords.campId, campId))),
      db.select().from(doctorReviews).where(eq(doctorReviews.employeeId, employeeId)).limit(1),
      db.select({ packageId: camps.packageId }).from(camps).where(eq(camps.id, campId)).limit(1),
      db.select().from(services).where(eq(services.isActive, true)),
    ]);

    let campServiceIds: string[] = [];
    if (campRows[0]?.packageId) {
      const pkg = await db
        .select({ activeServiceIds: clientPackages.activeServiceIds })
        .from(clientPackages)
        .where(eq(clientPackages.id, campRows[0].packageId))
        .limit(1);
      campServiceIds = pkg[0]?.activeServiceIds || [];
    }

    const emp = empRows[0]?.employee || null;
    const effectiveIds =
      emp?.assignedServiceIds && emp.assignedServiceIds.length > 0
        ? emp.assignedServiceIds
        : campServiceIds;

    const contractedServices = allServices.filter((s) => effectiveIds.includes(s.id));

    return {
      employee: emp,
      agencyName: empRows[0]?.agencyName || "Direct Payroll",
      fieldExam: fieldExamRows[0] || null,
      diagnostics: diagRows,
      review: reviewRows[0] || null,
      contractedServices,
    };
  } catch {
    return null;
  }
}

export async function officeDoctorUpdateEmployeeData(params: {
  employeeId: string;
  pastHistory?: string;
  coMorbidities?: string;
  bloodGroup?: string;
  bpSystolic?: string;
  bpDiastolic?: string;
  pulseBpm?: string;
  spo2?: string;
}) {
  try {
    const session = await getSession();
    await db
      .update(employees)
      .set({
        pastHistory: params.pastHistory ?? undefined,
        coMorbidities: params.coMorbidities ?? undefined,
        bloodGroup: params.bloodGroup ?? undefined,
        doctorBpSystolic: params.bpSystolic ?? undefined,
        doctorBpDiastolic: params.bpDiastolic ?? undefined,
        doctorPulseBpm: params.pulseBpm ?? undefined,
        doctorSpo2: params.spo2 ?? undefined,
        doctorVitalsRewritten: true,
      })
      .where(eq(employees.id, params.employeeId));

    await db.insert(auditLogs).values({
      userId: session?.userId || "office_doctor",
      userRole: session?.role || "OFFICE_DOCTOR",
      action: "OFFICE_DOCTOR_CLINICAL_EDIT",
      entityType: "EMPLOYEE",
      entityId: params.employeeId,
      newState: params,
    });

    revalidatePath("/doctor/office");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}