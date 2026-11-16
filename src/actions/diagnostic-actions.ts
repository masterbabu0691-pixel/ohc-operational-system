// src/actions/diagnostic-actions.ts
"use server";

import { db } from "@/db";
import {
  employees,
  agencies,
  stationChecklist,
  diagnosticRecords,
  fieldDoctorExams,
  doctorReviews,
  services,
  users,
  auditLogs,
  stationTypeEnum,
} from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { nanoid } from "nanoid";
import { getSession } from "@/lib/auth";

// 0. Get Diagnostic Technician RBAC Scope
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

// 1. Get queue for a specific station with arrival status, BMI, lock & agency name
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
        photoUrl: employees.photoUrl,
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
      .where(
        and(eq(stationChecklist.campId, campId), eq(stationChecklist.station, station))
      )
      .orderBy(stationChecklist.arrivalStatus, employees.uhid);

    return queue;
  } catch (err: any) {
    console.error("Error fetching station queue:", err);
    return [];
  }
}

// 2. Toggle Employee Arrived at Diagnostic Desk (Mark As Arrived <-> Arrived)
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

    const current = existing[0]?.arrivalStatus || "PENDING";
    const nextStatus = current === "ARRIVED" ? "PENDING" : "ARRIVED";

    await db
      .update(stationChecklist)
      .set({
        arrivalStatus: nextStatus,
        arrivedAt: nextStatus === "ARRIVED" ? new Date() : null,
      })
      .where(
        and(
          eq(stationChecklist.employeeId, employeeId),
          eq(stationChecklist.campId, campId),
          eq(stationChecklist.station, station)
        )
      );

    revalidatePath("/diagnostics");
    revalidatePath("/lab");
    return { success: true, arrivalStatus: nextStatus };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// 3. Instant Barcode / UHID Lookup
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
  } catch (err) {
    console.error("Barcode lookup error:", err);
    return null;
  }
}

// 4. Save Diagnostic Results & Media (With Post-Save Lock)
export async function saveDiagnosticResult(params: {
  employeeId: string;
  campId: string;
  station: (typeof stationTypeEnum.enumValues)[number];
  serviceCode: string;
  structuredData?: Record<string, any>;
  findingsSummary: string;
  isAbnormal?: boolean;
  attachmentUrls?: string[];
  capturedAfterCamp?: boolean;
  extractedViaOcr?: boolean;
  enteredBy?: string;
}) {
  try {
    const lockCheck = await db
      .select({ isLocked: stationChecklist.isLocked })
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
      return {
        success: false,
        error: "Entry is LOCKED. Request Camp Coordinator approval to rewrite.",
      };
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
    const msg = error.cause?.message || error.detail || error.message;
    return { success: false, error: msg };
  }
}

// 5. Dedicated Lab Queue & Pathology Result Saver
export async function getLabQueue(campId: string) {
  try {
    const rows = await db
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
      .orderBy(employees.uhid);

    return rows.map((r) => ({
      ...r,
      agencyName: r.agencyName || "Direct Payroll",
      checklistStatus: r.checklistStatus || "PENDING",
      arrivalStatus: r.arrivalStatus || "PENDING",
      isLocked: Boolean(r.isLocked),
    }));
  } catch (err) {
    console.error("getLabQueue error:", err);
    return [];
  }
}

export async function saveLabPathologyResult(params: {
  employeeId: string;
  campId: string;
  bloodGroup?: string;
  labValues: {
    hb?: string;
    wbc?: string;
    platelets?: string;
    esr?: string;
    sgpt?: string;
    creatinine?: string;
    widal?: string;
    rbs?: string;
    urineRm?: string;
    heavyMetal?: string;
  };
  findingsSummary: string;
  isAbnormal: boolean;
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
    extractedViaOcr: params.extractedViaOcr,
    attachmentUrls: params.attachmentUrls || [],
    enteredBy: "Lab Technician",
  });
}

// 6. Office Doctor Full Dossier Fetch + Direct Clinical Edit
export async function getEmployeeFullDossier(employeeId: string, campId: string) {
  try {
    const [empRows, fieldExamRows, diagRows, reviewRows] = await Promise.all([
      db
        .select({
          employee: employees,
          agencyName: agencies.name,
        })
        .from(employees)
        .leftJoin(agencies, eq(employees.agencyId, agencies.id))
        .where(eq(employees.id, employeeId))
        .limit(1),
      db
        .select()
        .from(fieldDoctorExams)
        .where(eq(fieldDoctorExams.employeeId, employeeId))
        .limit(1),
      db
        .select()
        .from(diagnosticRecords)
        .where(and(eq(diagnosticRecords.employeeId, employeeId), eq(diagnosticRecords.campId, campId))),
      db
        .select()
        .from(doctorReviews)
        .where(eq(doctorReviews.employeeId, employeeId))
        .limit(1),
    ]);

    return {
      employee: empRows[0]?.employee || null,
      agencyName: empRows[0]?.agencyName || "Direct Payroll",
      fieldExam: fieldExamRows[0] || null,
      diagnostics: diagRows,
      review: reviewRows[0] || null,
    };
  } catch (err) {
    console.error("getEmployeeFullDossier error:", err);
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