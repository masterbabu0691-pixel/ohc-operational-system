// src/actions/reception-actions.ts
"use server";

import { db } from "@/db";
import {
  employees,
  camps,
  clientPackages,
  agencies,
  services,
  stationChecklist,
  stationTypeEnum,
} from "@/db/schema";
import { eq, inArray, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { nanoid } from "nanoid";

// 1. Get employees strictly for the selected camp WITH Agency Name
export async function getCampReceptionList(campId: string) {
  try {
    return await db
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
        bloodGroup: employees.bloodGroup,
        photoUrl: employees.photoUrl,
        heightCm: employees.heightCm,
        weightKg: employees.weightKg,
        bmi: employees.bmi,
        hazardProfile: employees.hazardProfile,
        assignedServiceIds: employees.assignedServiceIds,
        specialContainerRequired: employees.specialContainerRequired,
        specialContainerName: employees.specialContainerName,
        checkInStatus: employees.checkInStatus,
        checkedInAt: employees.checkedInAt,
        agencyId: employees.agencyId,
        agencyName: agencies.name,
      })
      .from(employees)
      .leftJoin(agencies, eq(employees.agencyId, agencies.id))
      .where(eq(employees.campId, campId))
      .orderBy(employees.fullName);
  } catch (err: any) {
    console.error("Error fetching camp reception list:", err);
    return [];
  }
}

// 2. Fetch camp's contracted package services & client agencies for Special Assign Desk / Walk-In
export async function getCampPackageAndAgencies(campId: string) {
  try {
    const campRows = await db
      .select({
        id: camps.id,
        clientId: camps.clientId,
        packageId: camps.packageId,
      })
      .from(camps)
      .where(eq(camps.id, campId))
      .limit(1);

    if (campRows.length === 0) {
      return { agencies: [], packageServices: [], allServices: [] };
    }

    const { clientId, packageId } = campRows[0];

    const [clientAgencies, pkgRows, allActiveServices] = await Promise.all([
      db.select().from(agencies).where(eq(agencies.clientId, clientId)),
      db.select().from(clientPackages).where(eq(clientPackages.id, packageId)).limit(1),
      db.select().from(services).where(eq(services.isActive, true)),
    ]);

    const packageServiceIds = pkgRows[0]?.activeServiceIds || [];

    return {
      agencies: clientAgencies,
      packageServiceIds,
      allServices: allActiveServices,
    };
  } catch (err: any) {
    console.error("Error fetching camp package & agencies:", err);
    return { agencies: [], packageServiceIds: [], allServices: [] };
  }
}

// 3. On-Site Walk-In Registration + Immediate Check-In & Station Assignment
export async function registerWalkInEmployeeAndCheckIn(input: {
  campId: string;
  fullName: string;
  empCode?: string;
  age: number;
  gender: string;
  department?: string;
  designation?: string;
  phone?: string;
  agencyId?: string;
  heightCm: string;
  weightKg: string;
  assignedServiceIds: string[];
  specialContainerRequired?: boolean;
  specialContainerName?: string;
}) {
  try {
    const campRows = await db
      .select({ clientId: camps.clientId })
      .from(camps)
      .where(eq(camps.id, input.campId))
      .limit(1);

    if (campRows.length === 0) {
      return { success: false, error: "Selected camp not found." };
    }

    const clientId = campRows[0].clientId;

    // 1. Generate atomic sequential UHID
    const seqResult: any = await db.execute(sql`SELECT generate_next_uhid() as uhid;`);
    const nextUhid = seqResult.rows?.[0]?.uhid || seqResult[0]?.uhid;
    if (!nextUhid) {
      throw new Error("Could not generate sequential UHID.");
    }

    // 2. Calculate BMI
    const h = parseFloat(input.heightCm) / 100;
    const w = parseFloat(input.weightKg);
    const bmi = h > 0 && w > 0 ? (w / (h * h)).toFixed(1) : "22.0";

    const empId = `emp_${nanoid(10)}`;
    const finalEmpCode =
      input.empCode?.trim().toUpperCase() || `WALKIN-${nanoid(5).toUpperCase()}`;

    // 3. Insert Walk-In Employee as CHECKED_IN
    await db.insert(employees).values({
      id: empId,
      uhid: nextUhid,
      clientId,
      agencyId: input.agencyId || null,
      campId: input.campId,
      empCode: finalEmpCode,
      fullName: input.fullName.trim(),
      gender: input.gender,
      age: Number(input.age) || 30,
      department: input.department?.trim() || "General",
      designation: input.designation?.trim() || "Worker",
      phone: input.phone?.trim() || null,
      barcode: nextUhid,
      heightCm: input.heightCm,
      weightKg: input.weightKg,
      bmi,
      assignedServiceIds: input.assignedServiceIds,
      specialContainerRequired: Boolean(input.specialContainerRequired),
      specialContainerName: input.specialContainerRequired
        ? input.specialContainerName?.trim() || "Heavy Metal Detection Tube"
        : null,
      checkInStatus: "CHECKED_IN",
      checkedInAt: new Date(),
    });

    // 4. Build Station Checklist strictly from assignedServiceIds
    if (input.assignedServiceIds.length > 0) {
      const selectedServices = await db
        .select({ station: services.station })
        .from(services)
        .where(inArray(services.id, input.assignedServiceIds));

      const uniqueStations = Array.from(new Set(selectedServices.map((s) => s.station)));

      if (uniqueStations.length > 0) {
        await db.insert(stationChecklist).values(
          uniqueStations.map((station) => ({
            id: `chk_${nanoid(10)}`,
            employeeId: empId,
            campId: input.campId,
            station,
            status: "PENDING",
            arrivalStatus: "PENDING" as const,
            isLocked: false,
          }))
        );
      }
    }

    revalidatePath("/reception");
    revalidatePath("/admin");
    return { success: true, employeeId: empId, uhid: nextUhid, bmi, empCode: finalEmpCode };
  } catch (error: any) {
    console.error("Walk-in registration error:", error);
    const msg = error.cause?.message || error.detail || error.message || "Walk-in failed";
    return { success: false, error: msg };
  }
}

// 4. Perform Camp Check-In: Atomic UHID & Strict Contracted-Stations Checklist
export async function checkInEmployee(
  employeeId: string,
  campId: string,
  photoDataUrl?: string
) {
  try {
    const seqResult: any = await db.execute(sql`SELECT generate_next_uhid() as uhid;`);
    const nextUhid = seqResult.rows?.[0]?.uhid || seqResult[0]?.uhid;

    if (!nextUhid) {
      throw new Error("Could not generate sequential UHID.");
    }

    await db
      .update(employees)
      .set({
        uhid: nextUhid,
        checkInStatus: "CHECKED_IN",
        checkedInAt: new Date(),
        barcode: nextUhid,
        photoUrl: photoDataUrl || null,
      })
      .where(eq(employees.id, employeeId));

    const campRecords = await db
      .select({ packageId: camps.packageId })
      .from(camps)
      .where(eq(camps.id, campId))
      .limit(1);

    if (campRecords.length > 0) {
      const pkgRecords = await db
        .select({ activeServiceIds: clientPackages.activeServiceIds })
        .from(clientPackages)
        .where(eq(clientPackages.id, campRecords[0].packageId))
        .limit(1);

      if (pkgRecords.length > 0 && Array.isArray(pkgRecords[0].activeServiceIds)) {
        const serviceToStationMap: Record<string, (typeof stationTypeEnum.enumValues)[number]> = {
          srv_vitals: "VITALS_ANTHROPOMETRY",
          srv_vision: "VISION_SCREENING",
          srv_audiometry: "AUDIOMETRY",
          srv_spirometry: "SPIROMETRY_PFT",
          srv_xray: "CHEST_XRAY",
          srv_ecg: "ECG",
          srv_cbc: "PATHOLOGY_LAB",
          srv_blood_sugar: "PATHOLOGY_LAB",
          srv_doctor_exam: "DOCTOR_EXAMINATION",
        };

        const checklistItems = pkgRecords[0].activeServiceIds
          .map((id) => serviceToStationMap[id])
          .filter(Boolean)
          .map((station) => ({
            id: `chk_${nanoid(10)}`,
            employeeId,
            campId,
            station,
            status: "PENDING" as const,
          }));

        if (checklistItems.length > 0) {
          await db.insert(stationChecklist).values(checklistItems).onConflictDoNothing();
        }
      }
    }

    revalidatePath("/reception");
    revalidatePath("/admin");
    return { success: true, uhid: nextUhid };
  } catch (error: any) {
    console.error("Check-in error:", error);
    const msg = error.cause?.message || error.detail || error.message || "Check-in failed";
    return { success: false, error: msg };
  }
}