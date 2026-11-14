// src/actions/clinical-actions.ts
"use server";

import { db } from "@/db";
import { 
  employees, 
  camps, 
  clients, 
  agencies, 
  clientPackages, 
  stationChecklist, 
  diagnosticRecords, 
  fieldDoctorExams, 
  doctorReviews, // Matches your schema.ts export exactly
  stationTypeEnum,
  fitnessStatusEnum 
} from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { nanoid } from "nanoid";

// =========================================================================
// 1. RECEPTION: CHECK-IN + HEIGHT/WEIGHT/BMI + DYNAMIC STATION ROUTING
// =========================================================================

export async function receptionCheckIn(params: {
  employeeId: string;
  campId: string;
  heightCm: string;
  weightKg: string;
  customServiceIds?: string[];
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
      })
      .where(eq(employees.id, params.employeeId));

    let stationsToAssign: (typeof stationTypeEnum.enumValues[number])[] = [
      "NURSING_STATION",
      "FIELD_DOCTOR_EXAM",
      "OFFICE_DOCTOR_REVIEW"
    ];

    const campRecord = await db.query.camps.findFirst({
      where: eq(camps.id, params.campId),
    });

    let activeCodes: string[] = [];
    if (params.customServiceIds && params.customServiceIds.length > 0) {
      activeCodes = params.customServiceIds;
    } else if (campRecord) {
      const pkg = await db.query.clientPackages.findFirst({
        where: eq(clientPackages.id, campRecord.packageId),
      });
      activeCodes = pkg?.activeServiceIds || [];
    }

    if (activeCodes.some(c => c.includes("cbc") || c.includes("sugar") || c.includes("blood") || c.includes("phleb"))) {
      stationsToAssign.push("PHLEBOTOMY");
    }
    if (activeCodes.some(c => c.includes("pft") || c.includes("spiro"))) {
      stationsToAssign.push("SPIROMETRY_PFT");
    }
    if (activeCodes.some(c => c.includes("audio"))) {
      stationsToAssign.push("AUDIOMETRY");
    }
    if (activeCodes.some(c => c.includes("xray"))) {
      stationsToAssign.push("CHEST_XRAY");
    }
    if (activeCodes.some(c => c.includes("ecg"))) {
      stationsToAssign.push("ECG");
    }

    const checklistEntries = stationsToAssign.map((station) => ({
      id: `chk_${nanoid(10)}`,
      employeeId: params.employeeId,
      campId: params.campId,
      station: station,
      arrivalStatus: "PENDING" as const,
    }));

    await db.insert(stationChecklist).values(checklistEntries).onConflictDoNothing();

    revalidatePath("/reception");
    revalidatePath("/admin");
    return { success: true, uhid: nextUhid, bmi: calculatedBmi };
  } catch (err: any) {
    console.error("Reception Check-In Error:", err);
    return { success: false, error: err.message || "Check-in failed." };
  }
}

// =========================================================================
// 2. UNIVERSAL STATION WORKFLOW: "MARK AS ARRIVED"
// =========================================================================

export async function markEmployeeArrivedAtStation(params: {
  employeeId: string;
  campId: string;
  station: typeof stationTypeEnum.enumValues[number];
}) {
  try {
    await db
      .update(stationChecklist)
      .set({
        arrivalStatus: "ARRIVED",
        arrivedAt: new Date(),
      })
      .where(
        and(
          eq(stationChecklist.employeeId, params.employeeId),
          eq(stationChecklist.campId, params.campId),
          eq(stationChecklist.station, params.station)
        )
      );

    revalidatePath("/nurse");
    revalidatePath("/doctor/field");
    revalidatePath("/diagnostics");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// =========================================================================
// 3. NURSING STATION: BP, PULSE, SPO2, AND VISION SCREENING
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
// 4. PHLEBOTOMY: ANTI-DUPLICATE PRE-APPLIED BARCODE & DUAL SAMPLE TOGGLES
// =========================================================================

export async function submitPhlebotomyCollection(params: {
  employeeId: string;
  campId: string;
  scannedBarcode: string;
  bloodCollected: boolean;
  urineCollected: boolean;
  phlebotomistName?: string;
}) {
  try {
    const cleanBarcode = params.scannedBarcode.trim().toUpperCase();

    const existing = await db
      .select({ id: employees.id, fullName: employees.fullName, uhid: employees.uhid })
      .from(employees)
      .where(eq(employees.labKitBarcode, cleanBarcode))
      .limit(1);

    if (existing.length > 0 && existing[0].id !== params.employeeId) {
      return {
        success: false,
        isDuplicate: true,
        error: `DUPLICATE BARCODE BLOCKED: Barcode "${cleanBarcode}" was already assigned to ${existing[0].fullName} (${existing[0].uhid}). Use a new lab kit!`,
      };
    }

    if (!params.bloodCollected && !params.urineCollected) {
      return {
        success: false,
        error: "Sample not collected: At least Blood or Urine must be marked collected.",
      };
    }

    await db
      .update(employees)
      .set({
        labKitBarcode: cleanBarcode,
        bloodCollected: params.bloodCollected,
        urineCollected: params.urineCollected,
        samplesCollectedAt: new Date(),
      })
      .where(eq(employees.id, params.employeeId));

    const isBothDone = params.bloodCollected && params.urineCollected;

    await db
      .update(stationChecklist)
      .set({
        arrivalStatus: isBothDone ? "COMPLETED" : "ARRIVED",
        completedAt: isBothDone ? new Date() : null,
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
    return { success: true, fullySecured: isBothDone };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// =========================================================================
// 5. ON-FIELD DOCTOR: PHYSICAL EXAM & RESTRICTED VITALS REWRITE (BP/Pulse/SpO2)
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
// 6. DIAGNOSTIC STATIONS: MEDIA CAPTURE / FILE UPLOAD
// =========================================================================

export async function submitDiagnosticStationMedia(params: {
  employeeId: string;
  campId: string;
  station: typeof stationTypeEnum.enumValues[number];
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
// 7. OFFICE DOCTOR: FINAL REVIEW & LEGAL SIGN-OFF (Matches doctorReviews table)
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
  fitnessStatus: "FIT" | "UNFIT" | "TEMPORARILY_UNFIT_FOLLOW_UP";
  followUpDate?: string;
  adviceSummary?: string;
  doctorSignatureUrl?: string;
}) {
  try {
    // Inserts directly into doctorReviews table matching your schema.ts
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
// Add to bottom of src/actions/clinical-actions.ts

export async function getPhlebotomyExportRoster(campId: string) {
  try {
    const campRecord = await db
      .select({
        campName: camps.name,
        clientName: clients.name,
        clientCode: clients.code,
      })
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
        samplesCollectedAt: employees.samplesCollectedAt,
        checkInStatus: employees.checkInStatus,
      })
      .from(employees)
      .leftJoin(agencies, eq(employees.agencyId, agencies.id))
      .where(eq(employees.campId, campId))
      .orderBy(employees.uhid);

    return {
      clientName,
      campName,
      employees: rows.map((r, index) => {
        let sampleType = "None";
        if (r.bloodCollected && r.urineCollected) sampleType = "Blood & Urine";
        else if (r.bloodCollected) sampleType = "Blood Only";
        else if (r.urineCollected) sampleType = "Urine Only";

        return {
          srNo: index + 1,
          employeeName: r.fullName,
          age: r.age,
          sex: r.gender,
          contactNo: r.phone || "N/A",
          agencyName: r.agencyName || "Direct Payroll",
          clientName: clientName,
          uhid: r.uhid,
          barcodeDetails: r.labKitBarcode || "NOT_SCANNED",
          sampleType: sampleType,
          collectedTimestamp: r.samplesCollectedAt ? new Date(r.samplesCollectedAt).toLocaleString() : "Pending",
        };
      }),
    };
  } catch (err: any) {
    console.error("Phlebo export error:", err);
    return null;
  }
}