// src/actions/clinical-actions.ts
"use server";

import { db } from "@/db";
import {
  employees,
  camps,
  clients,
  agencies,
  clientPackages,
  services,
  stationChecklist,
  diagnosticRecords,
  fieldDoctorExams,
  doctorReviews,
  phlebotomyHandovers,
  correctionRequests,
  auditLogs,
  stationTypeEnum,
} from "@/db/schema";
import { eq, and, desc, inArray, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { nanoid } from "nanoid";
import { getSession } from "@/lib/auth";

function formatDDMMYYYY_HHMMSS(dateInput: Date | string | null | undefined): string {
  if (!dateInput) return "-";
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return "-";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}${pad(d.getMonth() + 1)}${d.getFullYear()}, ${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

// =========================================================================
// 1. RECEPTION: CHECK-IN + EXACT PACKAGE ROUTING
// =========================================================================

export async function receptionCheckIn(params: {
  employeeId: string;
  campId: string;
  heightCm: string;
  weightKg: string;
  customServiceIds?: string[];
  specialContainerRequired?: boolean;
  specialContainerName?: string;
}) {
  try {
    const h = parseFloat(params.heightCm) / 100;
    const w = parseFloat(params.weightKg);
    const calculatedBmi = h > 0 && w > 0 ? (w / (h * h)).toFixed(1) : "22.0";

    const seqResult: any = await db.execute(sql`SELECT generate_next_uhid() as uhid;`);
    const nextUhid = seqResult.rows?.[0]?.uhid || seqResult[0]?.uhid;
    if (!nextUhid) throw new Error("UHID generation failed.");

    await db
      .update(employees)
      .set({
        uhid: nextUhid,
        checkInStatus: "CHECKED_IN",
        checkedInAt: new Date(),
        heightCm: params.heightCm,
        weightKg: params.weightKg,
        bmi: calculatedBmi,
        assignedServiceIds: params.customServiceIds || null,
        ...(params.specialContainerRequired !== undefined
          ? {
              specialContainerRequired: params.specialContainerRequired,
              specialContainerName: params.specialContainerRequired
                ? params.specialContainerName?.trim() || "Heavy Metal Detection Tube"
                : null,
            }
          : {}),
      })
      .where(eq(employees.id, params.employeeId));

    let activeServiceIds: string[] = [];
    if (params.customServiceIds && params.customServiceIds.length > 0) {
      activeServiceIds = params.customServiceIds;
    } else {
      const campRecord = await db.query.camps.findFirst({
        where: eq(camps.id, params.campId),
      });
      if (campRecord) {
        const pkg = await db.query.clientPackages.findFirst({
          where: eq(clientPackages.id, campRecord.packageId),
        });
        activeServiceIds = pkg?.activeServiceIds || [];
      }
    }

    const stationsSet = new Set<(typeof stationTypeEnum.enumValues)[number]>();
    if (activeServiceIds.length > 0) {
      const matchedServices = await db
        .select({ station: services.station })
        .from(services)
        .where(inArray(services.id, activeServiceIds));
      matchedServices.forEach((s) => stationsSet.add(s.station));
    }

    // Fallback keyword mapping only if service IDs didn't match DB rows
    if (stationsSet.size === 0 && activeServiceIds.length > 0) {
      if (activeServiceIds.some((c) => c.includes("vital"))) stationsSet.add("NURSING_STATION");
      if (activeServiceIds.some((c) => c.includes("cbc") || c.includes("sugar") || c.includes("blood") || c.includes("phleb"))) {
        stationsSet.add("PHLEBOTOMY");
      }
      if (activeServiceIds.some((c) => c.includes("pft") || c.includes("spiro"))) stationsSet.add("SPIROMETRY_PFT");
      if (activeServiceIds.some((c) => c.includes("audio"))) stationsSet.add("AUDIOMETRY");
      if (activeServiceIds.some((c) => c.includes("xray"))) stationsSet.add("CHEST_XRAY");
      if (activeServiceIds.some((c) => c.includes("ecg"))) stationsSet.add("ECG");
      if (activeServiceIds.some((c) => c.includes("doc"))) {
        stationsSet.add("FIELD_DOCTOR_EXAM");
        stationsSet.add("OFFICE_DOCTOR_REVIEW");
      }
    }

    const checklistEntries = Array.from(stationsSet).map((station) => ({
      id: `chk_${nanoid(10)}`,
      employeeId: params.employeeId,
      campId: params.campId,
      station,
      arrivalStatus: "PENDING" as const,
      isLocked: false,
    }));

    if (checklistEntries.length > 0) {
      await db.insert(stationChecklist).values(checklistEntries).onConflictDoNothing();
    }

    revalidatePath("/reception");
    revalidatePath("/admin");
    return { success: true, uhid: nextUhid, bmi: calculatedBmi };
  } catch (err: any) {
    console.error("Reception Check-In Error:", err);
    return { success: false, error: err.message || "Check-in failed." };
  }
}

// =========================================================================
// 2. UNIVERSAL STATION QUEUE + ARRIVAL TOGGLE + LOCK STATUS
// =========================================================================

export async function getStationEmployeesWithStatus(
  campId: string,
  station: (typeof stationTypeEnum.enumValues)[number]
) {
  try {
    const rows = await db
      .select({
        id: employees.id,
        uhid: employees.uhid,
        empCode: employees.empCode,
        fullName: employees.fullName,
        age: employees.age,
        gender: employees.gender,
        department: employees.department,
        designation: employees.designation,
        phone: employees.phone,
        agencyName: agencies.name,
        checkInStatus: employees.checkInStatus,
        heightCm: employees.heightCm,
        weightKg: employees.weightKg,
        bmi: employees.bmi,
        labKitBarcode: employees.labKitBarcode,
        barcodeLocked: employees.barcodeLocked,
        bloodCollected: employees.bloodCollected,
        urineCollected: employees.urineCollected,
        specialContainerRequired: employees.specialContainerRequired,
        specialContainerName: employees.specialContainerName,
        specialContainerCollected: employees.specialContainerCollected,
        handoverVerified: employees.handoverVerified,
        handoverBatchNumber: employees.handoverBatchNumber,
        nurseBpSystolic: employees.nurseBpSystolic,
        nurseBpDiastolic: employees.nurseBpDiastolic,
        nursePulseBpm: employees.nursePulseBpm,
        nurseSpo2: employees.nurseSpo2,
        nurseVisionDistanceRight: employees.nurseVisionDistanceRight,
        nurseVisionDistanceLeft: employees.nurseVisionDistanceLeft,
        nurseVisionNearRight: employees.nurseVisionNearRight,
        nurseVisionNearLeft: employees.nurseVisionNearLeft,
        nurseColorVision: employees.nurseColorVision,
        doctorBpSystolic: employees.doctorBpSystolic,
        doctorBpDiastolic: employees.doctorBpDiastolic,
        doctorPulseBpm: employees.doctorPulseBpm,
        doctorSpo2: employees.doctorSpo2,
        doctorVitalsRewritten: employees.doctorVitalsRewritten,
        checklistId: stationChecklist.id,
        arrivalStatus: stationChecklist.arrivalStatus,
        isLocked: stationChecklist.isLocked,
        completedAt: stationChecklist.completedAt,
      })
      .from(employees)
      .leftJoin(agencies, eq(employees.agencyId, agencies.id))
      .leftJoin(
        stationChecklist,
        and(
          eq(stationChecklist.employeeId, employees.id),
          eq(stationChecklist.campId, campId),
          eq(stationChecklist.station, station)
        )
      )
      .where(and(eq(employees.campId, campId), eq(employees.checkInStatus, "CHECKED_IN")))
      .orderBy(employees.fullName);

    // Deduplicate by employee id
    const seen = new Set<string>();
    const uniqueRows = [];
    for (const r of rows) {
      if (!seen.has(r.id)) {
        seen.add(r.id);
        uniqueRows.push({
          ...r,
          agencyName: r.agencyName || "Direct Payroll",
          arrivalStatus: r.arrivalStatus || "PENDING",
          isLocked: Boolean(r.isLocked),
        });
      }
    }
    return uniqueRows;
  } catch (err: any) {
    console.error("getStationEmployeesWithStatus error:", err);
    return [];
  }
}

export async function markEmployeeArrivedAtStation(params: {
  employeeId: string;
  campId: string;
  station: (typeof stationTypeEnum.enumValues)[number];
}) {
  try {
    await db
      .update(stationChecklist)
      .set({ arrivalStatus: "ARRIVED", arrivedAt: new Date() })
      .where(
        and(
          eq(stationChecklist.employeeId, params.employeeId),
          eq(stationChecklist.campId, params.campId),
          eq(stationChecklist.station, params.station)
        )
      );

    revalidatePath("/nurse");
    revalidatePath("/phlebotomy");
    revalidatePath("/doctor/field");
    revalidatePath("/diagnostics");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function toggleEmployeeArrivalAtStation(params: {
  employeeId: string;
  campId: string;
  station: (typeof stationTypeEnum.enumValues)[number];
}) {
  try {
    const existing = await db
      .select({ id: stationChecklist.id, arrivalStatus: stationChecklist.arrivalStatus })
      .from(stationChecklist)
      .where(
        and(
          eq(stationChecklist.employeeId, params.employeeId),
          eq(stationChecklist.campId, params.campId),
          eq(stationChecklist.station, params.station)
        )
      )
      .limit(1);

    if (existing.length === 0) {
      await db.insert(stationChecklist).values({
        id: `chk_${nanoid(10)}`,
        employeeId: params.employeeId,
        campId: params.campId,
        station: params.station,
        arrivalStatus: "ARRIVED",
        arrivedAt: new Date(),
        isLocked: false,
      });
      return { success: true, arrivalStatus: "ARRIVED" as const };
    }

    const current = existing[0].arrivalStatus;
    if (current === "COMPLETED") return { success: true, arrivalStatus: "COMPLETED" as const };

    const nextStatus = current === "ARRIVED" ? "PENDING" : "ARRIVED";
    await db
      .update(stationChecklist)
      .set({
        arrivalStatus: nextStatus,
        arrivedAt: nextStatus === "ARRIVED" ? new Date() : null,
      })
      .where(eq(stationChecklist.id, existing[0].id));

    revalidatePath("/nurse");
    revalidatePath("/phlebotomy");
    revalidatePath("/doctor/field");
    revalidatePath("/diagnostics");
    return { success: true, arrivalStatus: nextStatus };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// =========================================================================
// 3. NURSING STATION (MANDATORY ARRIVED + EDIT LOCK)
// =========================================================================

export async function submitNurseVitals(params: {
  employeeId: string;
  campId: string;
  bpSystolic: string;
  bpDiastolic: string;
  pulseBpm: string;
  spo2: string;
  visionDistRight: string;
  visionDistLeft: string;
  visionNearRight: string;
  visionNearLeft: string;
  colorVision: string;
  nurseName?: string;
}) {
  try {
    const existing = await db
      .select({ isLocked: stationChecklist.isLocked, arrivalStatus: stationChecklist.arrivalStatus })
      .from(stationChecklist)
      .where(
        and(
          eq(stationChecklist.employeeId, params.employeeId),
          eq(stationChecklist.campId, params.campId),
          eq(stationChecklist.station, "NURSING_STATION")
        )
      )
      .limit(1);

    if (existing[0]?.isLocked) {
      return {
        success: false,
        isLocked: true,
        error: "Entry is LOCKED. Request Camp Coordinator permission to rewrite.",
      };
    }

    if (existing[0]?.arrivalStatus !== "ARRIVED") {
      return {
        success: false,
        error: "Please click 'Mark As Arrived' first before saving Nurse vitals.",
      };
    }

    await db
      .update(employees)
      .set({
        nurseBpSystolic: params.bpSystolic.trim(),
        nurseBpDiastolic: params.bpDiastolic.trim(),
        nursePulseBpm: params.pulseBpm.trim(),
        nurseSpo2: params.spo2.trim(),
        nurseVisionDistanceRight: params.visionDistRight,
        nurseVisionDistanceLeft: params.visionDistLeft,
        nurseVisionNearRight: params.visionNearRight,
        nurseVisionNearLeft: params.visionNearLeft,
        nurseColorVision: params.colorVision,
        nurseRecordedAt: new Date(),
      })
      .where(eq(employees.id, params.employeeId));

    await db
      .update(stationChecklist)
      .set({
        arrivalStatus: "COMPLETED",
        isLocked: true,
        completedAt: new Date(),
        completedBy: params.nurseName || "Nurse",
      })
      .where(
        and(
          eq(stationChecklist.employeeId, params.employeeId),
          eq(stationChecklist.campId, params.campId),
          eq(stationChecklist.station, "NURSING_STATION")
        )
      );

    revalidatePath("/nurse");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// =========================================================================
// 4. PHLEBOTOMY: INSTANT DUPLICATE CHECK + MULTI-BATCH HANDOVER
// =========================================================================

export async function checkBarcodeAvailability(params: {
  barcode: string;
  employeeId: string;
}) {
  try {
    const clean = params.barcode.trim().toUpperCase();
    if (!clean) return { available: true };
    const existing = await db
      .select({ id: employees.id, fullName: employees.fullName, uhid: employees.uhid })
      .from(employees)
      .where(eq(employees.labKitBarcode, clean))
      .limit(1);

    if (existing.length > 0 && existing[0].id !== params.employeeId) {
      return {
        available: false,
        error: `DUPLICATE BARCODE: "${clean}" is already assigned to ${existing[0].fullName} (${existing[0].uhid}).`,
      };
    }
    return { available: true };
  } catch {
    return { available: true };
  }
}

export async function submitPhlebotomyCollection(params: {
  employeeId: string;
  campId: string;
  scannedBarcode: string;
  bloodCollected: boolean;
  urineCollected: boolean;
  specialContainerCollected?: boolean;
  phlebotomistName?: string;
}) {
  try {
    const chkRows = await db
      .select({ arrivalStatus: stationChecklist.arrivalStatus })
      .from(stationChecklist)
      .where(
        and(
          eq(stationChecklist.employeeId, params.employeeId),
          eq(stationChecklist.campId, params.campId),
          eq(stationChecklist.station, "PHLEBOTOMY")
        )
      )
      .limit(1);

    if (chkRows.length > 0 && chkRows[0].arrivalStatus === "PENDING") {
      return {
        success: false,
        error: "Please click 'Mark As Arrived' first before saving sample collection.",
      };
    }

    const cleanBarcode = params.scannedBarcode.trim().toUpperCase();

    const empRows = await db
      .select({
        id: employees.id,
        fullName: employees.fullName,
        labKitBarcode: employees.labKitBarcode,
        barcodeLocked: employees.barcodeLocked,
        specialContainerRequired: employees.specialContainerRequired,
      })
      .from(employees)
      .where(eq(employees.id, params.employeeId))
      .limit(1);

    if (empRows.length === 0) return { success: false, error: "Employee not found." };
    const emp = empRows[0];

    if (emp.barcodeLocked && emp.labKitBarcode && emp.labKitBarcode !== cleanBarcode) {
      return {
        success: false,
        error: `BARCODE LOCKED: ${emp.fullName} is locked to "${emp.labKitBarcode}". Request Camp Coordinator unlock to change.`,
      };
    }

    const existing = await db
      .select({ id: employees.id, fullName: employees.fullName, uhid: employees.uhid })
      .from(employees)
      .where(eq(employees.labKitBarcode, cleanBarcode))
      .limit(1);

    if (existing.length > 0 && existing[0].id !== params.employeeId) {
      return {
        success: false,
        isDuplicate: true,
        error: `DUPLICATE BARCODE BLOCKED: "${cleanBarcode}" was already assigned to ${existing[0].fullName} (${existing[0].uhid}).`,
      };
    }

    const specialCollected = Boolean(params.specialContainerCollected);
    if (!params.bloodCollected && !params.urineCollected && !specialCollected) {
      return {
        success: false,
        error: "Mark at least Blood, Urine, or Special Container as collected.",
      };
    }

    await db
      .update(employees)
      .set({
        labKitBarcode: cleanBarcode,
        barcodeLocked: true,
        bloodCollected: params.bloodCollected,
        urineCollected: params.urineCollected,
        specialContainerCollected: specialCollected,
        samplesCollectedAt: new Date(),
      })
      .where(eq(employees.id, params.employeeId));

    const isAllRequiredDone =
      params.bloodCollected &&
      params.urineCollected &&
      (!emp.specialContainerRequired || specialCollected);

    await db
      .update(stationChecklist)
      .set({
        arrivalStatus: isAllRequiredDone ? "COMPLETED" : "ARRIVED",
        completedAt: isAllRequiredDone ? new Date() : null,
        completedBy: params.phlebotomistName || "Phlebotomist",
      })
      .where(
        and(
          eq(stationChecklist.employeeId, params.employeeId),
          eq(stationChecklist.campId, params.campId),
          eq(stationChecklist.station, "PHLEBOTOMY")
        )
      );

    revalidatePath("/phlebotomy");
    return { success: true, fullySecured: isAllRequiredDone };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function lookupAndVerifySampleByBarcode(params: {
  campId: string;
  scannedBarcode: string;
  markUrineCollected?: boolean;
}) {
  try {
    const cleanBarcode = params.scannedBarcode.trim().toUpperCase();
    const rows = await db
      .select({
        id: employees.id,
        fullName: employees.fullName,
        uhid: employees.uhid,
        empCode: employees.empCode,
        agencyName: agencies.name,
        labKitBarcode: employees.labKitBarcode,
        bloodCollected: employees.bloodCollected,
        urineCollected: employees.urineCollected,
        specialContainerRequired: employees.specialContainerRequired,
        specialContainerName: employees.specialContainerName,
        specialContainerCollected: employees.specialContainerCollected,
        handoverVerified: employees.handoverVerified,
        handoverBatchNumber: employees.handoverBatchNumber,
        handoverRiderName: employees.handoverRiderName,
      })
      .from(employees)
      .leftJoin(agencies, eq(employees.agencyId, agencies.id))
      .where(and(eq(employees.campId, params.campId), eq(employees.labKitBarcode, cleanBarcode)))
      .limit(1);

    if (rows.length === 0) {
      return {
        success: false,
        error: `No employee found in this selected camp with barcode "${cleanBarcode}".`,
      };
    }

    const emp = rows[0];

    if (params.markUrineCollected && !emp.urineCollected) {
      await db
        .update(employees)
        .set({ urineCollected: true, samplesCollectedAt: new Date() })
        .where(eq(employees.id, emp.id));

      const isAllDone =
        emp.bloodCollected &&
        (!emp.specialContainerRequired || emp.specialContainerCollected);

      if (isAllDone) {
        await db
          .update(stationChecklist)
          .set({ arrivalStatus: "COMPLETED", completedAt: new Date() })
          .where(
            and(
              eq(stationChecklist.employeeId, emp.id),
              eq(stationChecklist.campId, params.campId),
              eq(stationChecklist.station, "PHLEBOTOMY")
            )
          );
      }

      revalidatePath("/phlebotomy");
      return {
        success: true,
        employee: { ...emp, urineCollected: true, agencyName: emp.agencyName || "Direct Payroll" },
        urineUpdated: true,
      };
    }

    return {
      success: true,
      employee: { ...emp, agencyName: emp.agencyName || "Direct Payroll" },
      urineUpdated: false,
    };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function submitPhlebotomyHandover(params: {
  campId: string;
  phleboName: string;
  riderName: string;
  phleboAcknowledged: boolean;
  riderAcknowledged: boolean;
  handoverType?: "CAMP_TO_RIDER" | "RIDER_TO_LAB";
  verifiedEmployeeIds: string[];
  notes?: string;
}) {
  try {
    if (params.verifiedEmployeeIds.length === 0) {
      return { success: false, error: "Scan at least one sample barcode before confirming handover." };
    }
    if (!params.phleboAcknowledged || !params.riderAcknowledged) {
      return { success: false, error: "Both Phlebotomist and Rider must acknowledge the handover." };
    }

    const prevBatches = await db
      .select({ batchNumber: phlebotomyHandovers.batchNumber })
      .from(phlebotomyHandovers)
      .where(eq(phlebotomyHandovers.campId, params.campId))
      .orderBy(desc(phlebotomyHandovers.batchNumber))
      .limit(1);

    const nextBatchNumber = (prevBatches[0]?.batchNumber || 0) + 1;
    const handoverId = `hnd_${nanoid(10)}`;
    const now = new Date();

    await db.insert(phlebotomyHandovers).values({
      id: handoverId,
      campId: params.campId,
      batchNumber: nextBatchNumber,
      phleboName: params.phleboName.trim(),
      riderName: params.riderName.trim(),
      phleboAcknowledged: params.phleboAcknowledged,
      riderAcknowledged: params.riderAcknowledged,
      handoverType: params.handoverType || "CAMP_TO_RIDER",
      totalVerifiedCount: params.verifiedEmployeeIds.length,
      verifiedEmployeeIds: params.verifiedEmployeeIds,
      notes: params.notes?.trim() || null,
      handedOverAt: now,
    });

    for (const empId of params.verifiedEmployeeIds) {
      await db
        .update(employees)
        .set({
          handoverVerified: true,
          handoverBatchNumber: nextBatchNumber,
          handoverVerifiedAt: now,
          handoverRiderName: params.riderName.trim(),
          handoverPhleboName: params.phleboName.trim(),
        })
        .where(eq(employees.id, empId));
    }

    revalidatePath("/phlebotomy");
    return { success: true, handoverId, batchNumber: nextBatchNumber };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// =========================================================================
// 5. ON-FIELD DOCTOR (MANDATORY ARRIVED + ENT/ORAL/HEAD-NECK + VITALS REWRITE)
// =========================================================================

export async function submitFieldDoctorExam(params: {
  employeeId: string;
  campId: string;
  doctorName: string;
  doctorId: string;
  doctorBpSystolic?: string;
  doctorBpDiastolic?: string;
  doctorPulseBpm?: string;
  doctorSpo2?: string;
  rewriteVitals: boolean;
  entFinding?: string;
  oralFinding?: string;
  headNeckFinding?: string;
  cvsFinding: string;
  rsFinding: string;
  abdomenFinding: string;
  cnsFinding: string;
  musculoskeletal: string;
  skinInspection: string;
  herniaHydrocele: string;
  clinicalRemarks?: string;
}) {
  try {
    const existingLock = await db
      .select({ isLocked: stationChecklist.isLocked, arrivalStatus: stationChecklist.arrivalStatus })
      .from(stationChecklist)
      .where(
        and(
          eq(stationChecklist.employeeId, params.employeeId),
          eq(stationChecklist.campId, params.campId),
          eq(stationChecklist.station, "FIELD_DOCTOR_EXAM")
        )
      )
      .limit(1);

    if (existingLock[0]?.isLocked) {
      return {
        success: false,
        isLocked: true,
        error: "Field Doctor entry is LOCKED. Request Camp Coordinator unlock to edit.",
      };
    }

    if (existingLock[0]?.arrivalStatus !== "ARRIVED") {
      return {
        success: false,
        error: "Please click 'Mark As Arrived' first before saving Field Doctor exam.",
      };
    }

    if (params.rewriteVitals) {
      await db
        .update(employees)
        .set({
          doctorBpSystolic: params.doctorBpSystolic?.trim() || null,
          doctorBpDiastolic: params.doctorBpDiastolic?.trim() || null,
          doctorPulseBpm: params.doctorPulseBpm?.trim() || null,
          doctorSpo2: params.doctorSpo2?.trim() || null,
          doctorVitalsRewritten: true,
        })
        .where(eq(employees.id, params.employeeId));
    }

    await db
      .insert(fieldDoctorExams)
      .values({
        id: `fde_${nanoid(10)}`,
        employeeId: params.employeeId,
        campId: params.campId,
        doctorId: params.doctorId,
        doctorName: params.doctorName.trim(),
        entFinding: params.entFinding || "Normal",
        oralFinding: params.oralFinding || "Normal, Good Oral Hygiene",
        headNeckFinding: params.headNeckFinding || "Normal, No Lymphadenopathy",
        cvsFinding: params.cvsFinding,
        rsFinding: params.rsFinding,
        abdomenFinding: params.abdomenFinding,
        cnsFinding: params.cnsFinding,
        musculoskeletal: params.musculoskeletal,
        skinInspection: params.skinInspection,
        herniaHydrocele: params.herniaHydrocele,
        clinicalRemarks: params.clinicalRemarks || null,
      })
      .onConflictDoUpdate({
        target: fieldDoctorExams.employeeId,
        set: {
          doctorName: params.doctorName.trim(),
          entFinding: params.entFinding || "Normal",
          oralFinding: params.oralFinding || "Normal, Good Oral Hygiene",
          headNeckFinding: params.headNeckFinding || "Normal, No Lymphadenopathy",
          cvsFinding: params.cvsFinding,
          rsFinding: params.rsFinding,
          abdomenFinding: params.abdomenFinding,
          cnsFinding: params.cnsFinding,
          musculoskeletal: params.musculoskeletal,
          skinInspection: params.skinInspection,
          herniaHydrocele: params.herniaHydrocele,
          clinicalRemarks: params.clinicalRemarks || null,
        },
      });

    await db
      .update(stationChecklist)
      .set({
        arrivalStatus: "COMPLETED",
        isLocked: true,
        completedAt: new Date(),
        completedBy: params.doctorName,
      })
      .where(
        and(
          eq(stationChecklist.employeeId, params.employeeId),
          eq(stationChecklist.campId, params.campId),
          eq(stationChecklist.station, "FIELD_DOCTOR_EXAM")
        )
      );

    revalidatePath("/doctor/field");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// =========================================================================
// 6. DIAGNOSTIC STATIONS
// =========================================================================

export async function submitDiagnosticStationMedia(params: {
  employeeId: string;
  campId: string;
  station: (typeof stationTypeEnum.enumValues)[number];
  serviceCode: string;
  findingsSummary: string;
  isAbnormal: boolean;
  attachmentUrls: string[];
  capturedAfterCamp: boolean;
  enteredBy: string;
  structuredData?: Record<string, any>;
}) {
  try {
    await db.insert(diagnosticRecords).values({
      id: `diag_${nanoid(10)}`,
      employeeId: params.employeeId,
      campId: params.campId,
      station: params.station,
      serviceCode: params.serviceCode,
      findingsSummary: params.findingsSummary.trim(),
      isAbnormal: params.isAbnormal,
      attachmentUrls: params.attachmentUrls,
      capturedAfterCamp: params.capturedAfterCamp,
      enteredBy: params.enteredBy,
      structuredData: params.structuredData || {},
    });

    await db
      .update(stationChecklist)
      .set({
        arrivalStatus: "COMPLETED",
        isLocked: true,
        completedAt: new Date(),
        completedBy: params.enteredBy,
      })
      .where(
        and(
          eq(stationChecklist.employeeId, params.employeeId),
          eq(stationChecklist.campId, params.campId),
          eq(stationChecklist.station, params.station)
        )
      );

    revalidatePath("/diagnostics");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// =========================================================================
// 7. OFFICE DOCTOR
// =========================================================================

export async function submitOfficeDoctorReview(params: {
  employeeId: string;
  campId: string;
  officeDoctorName: string;
  officeDoctorRegNo: string;
  officeDoctorId: string;
  vitalsRemark?: string;
  labRemark?: string;
  xrayRemark?: string;
  pftRemark?: string;
  audioRemark?: string;
  fieldDoctorExamRemark?: string;
  fitnessStatus: "FIT" | "FIT_WITH_CONDITION" | "UNFIT" | "TEMPORARILY_UNFIT_FOLLOW_UP";
  followUpDate?: string;
  adviceSummary?: string;
  doctorSignatureUrl?: string;
}) {
  try {
    if (params.fitnessStatus !== "FIT" && !params.adviceSummary?.trim()) {
      return {
        success: false,
        error: "Remark / Reason is mandatory when selecting Fit with Condition, Follow Up, or Unfit.",
      };
    }

    await db
      .insert(doctorReviews)
      .values({
        id: `odr_${nanoid(10)}`,
        employeeId: params.employeeId,
        campId: params.campId,
        doctorId: params.officeDoctorId,
        doctorName: params.officeDoctorName.trim(),
        doctorRegNo: params.officeDoctorRegNo.trim(),
        vitalsRemark: params.vitalsRemark || null,
        labRemark: params.labRemark || null,
        xrayRemark: params.xrayRemark || null,
        pftRemark: params.pftRemark || null,
        audioRemark: params.audioRemark || null,
        fieldDoctorExamRemark: params.fieldDoctorExamRemark || null,
        fitnessStatus: params.fitnessStatus,
        followUpDate: params.followUpDate || null,
        clinicalNotes: params.adviceSummary || null,
        recommendations: params.adviceSummary || null,
        doctorSignatureUrl: params.doctorSignatureUrl || null,
        isSigned: true,
        signedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: doctorReviews.employeeId,
        set: {
          doctorName: params.officeDoctorName.trim(),
          doctorRegNo: params.officeDoctorRegNo.trim(),
          vitalsRemark: params.vitalsRemark || null,
          labRemark: params.labRemark || null,
          xrayRemark: params.xrayRemark || null,
          pftRemark: params.pftRemark || null,
          audioRemark: params.audioRemark || null,
          fieldDoctorExamRemark: params.fieldDoctorExamRemark || null,
          fitnessStatus: params.fitnessStatus,
          followUpDate: params.followUpDate || null,
          clinicalNotes: params.adviceSummary || null,
          recommendations: params.adviceSummary || null,
          doctorSignatureUrl: params.doctorSignatureUrl || null,
          isSigned: true,
          signedAt: new Date(),
        },
      });

    await db
      .update(stationChecklist)
      .set({
        arrivalStatus: "COMPLETED",
        completedAt: new Date(),
        completedBy: params.officeDoctorName,
      })
      .where(
        and(
          eq(stationChecklist.employeeId, params.employeeId),
          eq(stationChecklist.campId, params.campId),
          eq(stationChecklist.station, "OFFICE_DOCTOR_REVIEW")
        )
      );

    revalidatePath("/doctor/office");
    revalidatePath("/mrd");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// =========================================================================
// 8. CAMP COORDINATOR: CORRECTION REQUESTS & EDIT UNLOCK
// =========================================================================

export async function requestCorrectionUnlock(params: {
  campId: string;
  employeeId: string;
  station: (typeof stationTypeEnum.enumValues)[number];
  reason: string;
}) {
  try {
    const session = await getSession();
    await db.insert(correctionRequests).values({
      id: `req_${nanoid(10)}`,
      campId: params.campId,
      employeeId: params.employeeId,
      station: params.station,
      requestedBy: session?.name || "Desk Staff",
      requestedByRole: session?.role || "STAFF",
      reason: params.reason.trim(),
      status: "PENDING",
    });

    revalidatePath("/coordinator");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function getCorrectionRequests(campId?: string) {
  try {
    const query = db
      .select({
        id: correctionRequests.id,
        campId: correctionRequests.campId,
        employeeId: correctionRequests.employeeId,
        employeeName: employees.fullName,
        uhid: employees.uhid,
        empCode: employees.empCode,
        station: correctionRequests.station,
        requestedBy: correctionRequests.requestedBy,
        requestedByRole: correctionRequests.requestedByRole,
        reason: correctionRequests.reason,
        status: correctionRequests.status,
        resolvedBy: correctionRequests.resolvedBy,
        resolutionNote: correctionRequests.resolutionNote,
        createdAt: correctionRequests.createdAt,
        resolvedAt: correctionRequests.resolvedAt,
      })
      .from(correctionRequests)
      .innerJoin(employees, eq(correctionRequests.employeeId, employees.id))
      .orderBy(desc(correctionRequests.createdAt));

    if (campId) return await query.where(eq(correctionRequests.campId, campId));
    return await query;
  } catch (err: any) {
    console.error("getCorrectionRequests error:", err);
    return [];
  }
}

export async function resolveCorrectionRequest(params: {
  requestId: string;
  action: "APPROVE" | "REJECT";
  resolutionNote?: string;
}) {
  try {
    const session = await getSession();
    if (!session || !["SUPER_ADMIN", "CAMP_COORDINATOR"].includes(session.role)) {
      return { success: false, error: "Unauthorized: Only Camp Coordinator or Super Admin can approve unlocks." };
    }

    const reqRows = await db
      .select()
      .from(correctionRequests)
      .where(eq(correctionRequests.id, params.requestId))
      .limit(1);

    if (reqRows.length === 0) return { success: false, error: "Request not found." };
    const req = reqRows[0];

    if (params.action === "APPROVE") {
      await db
        .update(stationChecklist)
        .set({ isLocked: false })
        .where(
          and(
            eq(stationChecklist.employeeId, req.employeeId),
            eq(stationChecklist.campId, req.campId),
            eq(stationChecklist.station, req.station)
          )
        );

      if (req.station === "PHLEBOTOMY") {
        await db.update(employees).set({ barcodeLocked: false }).where(eq(employees.id, req.employeeId));
      }
    }

    await db
      .update(correctionRequests)
      .set({
        status: params.action === "APPROVE" ? "APPROVED" : "REJECTED",
        resolvedBy: session.name,
        resolutionNote: params.resolutionNote?.trim() || null,
        resolvedAt: new Date(),
      })
      .where(eq(correctionRequests.id, params.requestId));

    await db.insert(auditLogs).values({
      userId: session.userId,
      userRole: session.role,
      action: `COORDINATOR_${params.action}_UNLOCK`,
      entityType: "STATION_CHECKLIST",
      entityId: `${req.employeeId}:${req.station}`,
      newState: { reason: req.reason, resolutionNote: params.resolutionNote },
    });

    revalidatePath("/coordinator");
    revalidatePath("/nurse");
    revalidatePath("/phlebotomy");
    revalidatePath("/doctor/field");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// =========================================================================
// 9. PHLEBOTOMY & HANDOVER EXCEL EXPORT (CARRIED SAMPLES ONLY + DDMMYYYY, HHMMSS)
// =========================================================================

export async function getPhlebotomyExportRoster(campId: string, carriedOnly: boolean = false) {
  try {
    const campRecord = await db
      .select({ campName: camps.name, clientName: clients.name })
      .from(camps)
      .innerJoin(clients, eq(camps.clientId, clients.id))
      .where(eq(camps.id, campId))
      .limit(1);

    const clientName = campRecord[0]?.clientName || "Corporate Client";
    const campName = campRecord[0]?.campName || "Camp";

    const rows = await db
      .select({
        id: employees.id,
        uhid: employees.uhid,
        empCode: employees.empCode,
        fullName: employees.fullName,
        age: employees.age,
        gender: employees.gender,
        phone: employees.phone,
        agencyName: agencies.name,
        labKitBarcode: employees.labKitBarcode,
        bloodCollected: employees.bloodCollected,
        urineCollected: employees.urineCollected,
        specialContainerRequired: employees.specialContainerRequired,
        specialContainerName: employees.specialContainerName,
        specialContainerCollected: employees.specialContainerCollected,
        samplesCollectedAt: employees.samplesCollectedAt,
        handoverVerified: employees.handoverVerified,
        handoverBatchNumber: employees.handoverBatchNumber,
        handoverRiderName: employees.handoverRiderName,
        handoverPhleboName: employees.handoverPhleboName,
        handoverVerifiedAt: employees.handoverVerifiedAt,
      })
      .from(employees)
      .leftJoin(agencies, eq(employees.agencyId, agencies.id))
      .where(eq(employees.campId, campId))
      .orderBy(employees.uhid);

    const filteredRows = carriedOnly
      ? rows.filter((r) => r.bloodCollected || r.urineCollected || r.specialContainerCollected || r.handoverVerified)
      : rows;

    return {
      clientName,
      campName,
      employees: filteredRows.map((r, index) => {
        const parts: string[] = [];
        if (r.bloodCollected) parts.push("Blood");
        if (r.urineCollected) parts.push("Urine");
        if (r.specialContainerCollected) parts.push(r.specialContainerName || "Special Tube");
        const sampleType = parts.length > 0 ? parts.join(" + ") : "Pending";

        return {
          srNo: index + 1,
          employeeName: r.fullName,
          age: r.age,
          sex: r.gender,
          contactNo: r.phone || "N/A",
          agencyName: r.agencyName || "Direct Payroll",
          clientName,
          uhid: r.uhid,
          barcodeDetails: r.labKitBarcode || "NOT_SCANNED",
          sampleType,
          bloodStatus: r.bloodCollected ? "Collected" : "Pending",
          urineStatus: r.urineCollected ? "Collected" : "Pending",
          specialTubeStatus: r.specialContainerRequired
            ? r.specialContainerCollected
              ? `Collected (${r.specialContainerName || "Special"})`
              : `Pending (${r.specialContainerName || "Special"})`
            : "N/A",
          collectedTimestamp: formatDDMMYYYY_HHMMSS(r.samplesCollectedAt),
          handoverStatus: r.handoverVerified ? `Batch #${r.handoverBatchNumber} Verified` : "Not Handed Over",
          riderName: r.handoverRiderName || "-",
          phleboName: r.handoverPhleboName || "-",
          handoverTimestamp: formatDDMMYYYY_HHMMSS(r.handoverVerifiedAt),
        };
      }),
    };
  } catch (err: any) {
    console.error("Phlebo export error:", err);
    return null;
  }
}