// src/actions/mrd-actions.ts
"use server";

import { db } from "@/db";
import { 
  employees, 
  camps, 
  clients, 
  agencies, 
  diagnosticRecords, 
  doctorReviews,
  mrdDossiers 
} from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { nanoid } from "nanoid";
import { revalidatePath } from "next/cache";

// 1. Fetch Complete Camp Dossier Records for MRD Archival
export async function getCampMrdRecords(campId: string) {
  try {
    // 1. Fetch Camp & Client info
    const campInfo = await db
      .select({
        campId: camps.id,
        campName: camps.name,
        location: camps.location,
        clientId: clients.id,
        clientName: clients.name,
        clientCode: clients.code,
      })
      .from(camps)
      .innerJoin(clients, eq(camps.clientId, clients.id))
      .where(eq(camps.id, campId))
      .limit(1);

    if (campInfo.length === 0) return null;

    // 2. Fetch all employees in this camp with agencies
    const empList = await db
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
        agencyId: employees.agencyId,
        agencyName: agencies.name,
        checkInStatus: employees.checkInStatus,
      })
      .from(employees)
      .leftJoin(agencies, eq(employees.agencyId, agencies.id))
      .where(eq(employees.campId, campId));

    // 3. Fetch all diagnostic records for this camp
    const diagnostics = await db
      .select()
      .from(diagnosticRecords)
      .where(eq(diagnosticRecords.campId, campId));

    // 4. Fetch doctor reviews for this camp
    const reviews = await db
      .select()
      .from(doctorReviews)
      .where(eq(doctorReviews.campId, campId));

    // 5. Fetch MRD storage location
    const dossiers = await db
      .select()
      .from(mrdDossiers)
      .where(eq(mrdDossiers.campId, campId));

    const dossierMap = new Map(dossiers.map((d) => [d.employeeId, d]));
    const reviewMap = new Map(reviews.map((r) => [r.employeeId, r]));

    // Group diagnostics by employeeId
    const diagMap = new Map<string, any[]>();
    diagnostics.forEach((d) => {
      const arr = diagMap.get(d.employeeId) || [];
      arr.push(d);
      diagMap.set(d.employeeId, arr);
    });

    const enrichedEmployees = empList.map((emp) => ({
      ...emp,
      agencyName: emp.agencyName || "Direct Payroll",
      diagnostics: diagMap.get(emp.id) || [],
      doctorReview: reviewMap.get(emp.id) || null,
      mrdRecord: dossierMap.get(emp.id) || null,
    }));

    return {
      camp: campInfo[0],
      employees: enrichedEmployees,
    };
  } catch (err: any) {
    console.error("MRD records error:", err);
    return null;
  }
}

// 2. Update Physical MRD Box/Shelf Indexing
export async function updateMrdPhysicalLocation(params: {
  employeeId: string;
  campId: string;
  clientId: string;
  location: string;
}) {
  try {
    await db
      .insert(mrdDossiers)
      .values({
        id: `mrd_${nanoid(10)}`,
        employeeId: params.employeeId,
        campId: params.campId,
        clientId: params.clientId,
        physicalFileLocation: params.location.trim(),
        archivedStatus: "ARCHIVED",
        lastAuditedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: mrdDossiers.employeeId,
        set: {
          physicalFileLocation: params.location.trim(),
          lastAuditedAt: new Date(),
        },
      });

    revalidatePath("/mrd");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}