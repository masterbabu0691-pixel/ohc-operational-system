// src/actions/diagnostic-actions.ts
"use server";

import { db } from "@/db";
import { 
  employees, 
  camps, 
  agencies,
  stationChecklist, 
  diagnosticRecords, 
  services,
  stationTypeEnum 
} from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { nanoid } from "nanoid";

// 1. Get queue for a specific station with arrival status & agency name
export async function getStationQueue(campId: string, station: typeof stationTypeEnum.enumValues[number]) {
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
        agencyId: employees.agencyId,
        agencyName: agencies.name,
        checklistStatus: stationChecklist.status,
        arrivalStatus: stationChecklist.arrivalStatus,
      })
      .from(stationChecklist)
      .innerJoin(employees, eq(stationChecklist.employeeId, employees.id))
      .leftJoin(agencies, eq(employees.agencyId, agencies.id))
      .where(
        and(
          eq(stationChecklist.campId, campId),
          eq(stationChecklist.station, station)
        )
      )
      .orderBy(stationChecklist.arrivalStatus, employees.uhid);

    return queue;
  } catch (err: any) {
    console.error("Error fetching station queue:", err);
    return [];
  }
}

// 2. Mark Employee Arrived at Diagnostic Desk
export async function markDiagnosticArrived(employeeId: string, campId: string, station: typeof stationTypeEnum.enumValues[number]) {
  try {
    await db
      .update(stationChecklist)
      .set({
        arrivalStatus: "ARRIVED",
        arrivedAt: new Date(),
      })
      .where(
        and(
          eq(stationChecklist.employeeId, employeeId),
          eq(stationChecklist.campId, campId),
          eq(stationChecklist.station, station)
        )
      );

    revalidatePath("/diagnostics");
    return { success: true };
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

// 4. Save Diagnostic Results & Media (Supports live or post-camp)
export async function saveDiagnosticResult(params: {
  employeeId: string;
  campId: string;
  station: typeof stationTypeEnum.enumValues[number];
  serviceCode: string;
  structuredData?: Record<string, any>;
  findingsSummary: string;
  isAbnormal?: boolean;
  attachmentUrls?: string[];
  capturedAfterCamp?: boolean;
  enteredBy?: string;
}) {
  try {
    const serviceRecord = await db
      .select({ id: services.id })
      .from(services)
      .where(eq(services.code, params.serviceCode))
      .limit(1);

    const serviceId = serviceRecord[0]?.id || `srv_${nanoid(8)}`;

    // 1. Insert Diagnostic Record
    await db.insert(diagnosticRecords).values({
      id: `diag_${nanoid(10)}`,
      employeeId: params.employeeId,
      campId: params.campId,
      serviceId: serviceId,
      serviceCode: params.serviceCode,
      station: params.station,
      structuredData: params.structuredData || {},
      findingsSummary: params.findingsSummary.trim(),
      isAbnormal: params.isAbnormal || false,
      attachmentUrls: params.attachmentUrls || [],
      capturedAfterCamp: params.capturedAfterCamp || false,
      enteredBy: params.enteredBy || "Diagnostic Technician",
    });

    // 2. Mark Station Checklist as COMPLETED
    await db
      .update(stationChecklist)
      .set({
        status: "COMPLETED",
        arrivalStatus: "COMPLETED",
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
    revalidatePath("/admin");
    return { success: true };
  } catch (error: any) {
    console.error("Save diagnostic error:", error);
    const msg = error.cause?.message || error.detail || error.message;
    return { success: false, error: msg };
  }
}