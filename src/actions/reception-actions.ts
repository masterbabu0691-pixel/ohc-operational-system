// src/actions/reception-actions.ts
"use server";

import { db } from "@/db";
import { 
  employees, 
  camps, 
  clientPackages, 
  agencies, 
  stationChecklist, 
  stationTypeEnum 
} from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
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

// 2. Perform Camp Check-In: Atomic UHID & Strict Contracted-Stations Checklist
export async function checkInEmployee(
  employeeId: string,
  campId: string,
  photoDataUrl?: string
) {
  try {
    // 1. Generate atomic sequential UHID
    const seqResult: any = await db.execute(sql`SELECT generate_next_uhid() as uhid;`);
    const nextUhid = seqResult.rows?.[0]?.uhid || seqResult[0]?.uhid;

    if (!nextUhid) {
      throw new Error("Could not generate sequential UHID.");
    }

    // 2. Update employee with permanent sequential UHID
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

    // 3. Fetch camp package to strictly check contracted stations
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
        const serviceToStationMap: Record<string, typeof stationTypeEnum.enumValues[number]> = {
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

        // ONLY build checklist items for stations explicitly contracted in this package
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