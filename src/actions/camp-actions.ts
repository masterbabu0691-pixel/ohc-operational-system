// src/actions/camp-actions.ts
"use server";

import { db } from "@/db";
import { camps, clients, clientPackages, agencies, employees } from "@/db/schema";
import { nanoid } from "nanoid";
import { revalidatePath } from "next/cache";
import { eq, desc } from "drizzle-orm";

// 1. Get all clients with their contracted packages
export async function getClientsForCamp() {
  try {
    const allClients = await db.select().from(clients).where(eq(clients.isActive, true));

    const list = await Promise.all(
      allClients.map(async (client) => {
        const pkgs = await db
          .select()
          .from(clientPackages)
          .where(eq(clientPackages.clientId, client.id));

        const agns = await db
          .select()
          .from(agencies)
          .where(eq(agencies.clientId, client.id));

        return {
          ...client,
          packages: pkgs,
          agencies: agns,
        };
      })
    );

    return list;
  } catch (err: any) {
    console.error("Error fetching clients for camp:", err);
    return [];
  }
}

// 2. Schedule a new medical camp
export async function createCamp(formData: {
  clientId: string;
  packageId: string;
  name: string;
  location: string;
  startDate: string;
  endDate: string;
}) {
  try {
    const campId = `cmp_${nanoid(10)}`;

    await db.insert(camps).values({
      id: campId,
      clientId: formData.clientId,
      packageId: formData.packageId,
      name: formData.name.trim(),
      location: formData.location.trim(),
      startDate: formData.startDate,
      endDate: formData.endDate,
      status: "ACTIVE",
    });

    revalidatePath("/camps");
    revalidatePath("/admin");
    return { success: true, campId };
  } catch (error: any) {
    console.error("Error creating camp:", error);
    const msg = error.cause?.message || error.detail || error.message;
    return { success: false, error: msg };
  }
}

// 3. Get all active camps WITH Client Names
export async function getCampsList() {
  try {
    return await db
      .select({
        id: camps.id,
        name: camps.name,
        location: camps.location,
        startDate: camps.startDate,
        endDate: camps.endDate,
        status: camps.status,
        clientId: camps.clientId,
        clientName: clients.name,
        clientCode: clients.code,
        packageId: camps.packageId,
      })
      .from(camps)
      .innerJoin(clients, eq(camps.clientId, clients.id))
      .orderBy(desc(camps.createdAt));
  } catch (err) {
    return [];
  }
}

// 4. Batch Bulk Upload Employees with Client-Isolated Pre-Reg IDs
export async function bulkUploadEmployees(
  campId: string,
  clientId: string,
  rows: Array<{
    empCode: string;
    fullName: string;
    age: number;
    gender: string;
    department?: string;
    designation?: string;
    agencyName?: string;
    phone?: string;
    bloodGroup?: string;
  }>
) {
  try {
    // 1. Fetch agencies strictly for THIS client
    const clientAgencies = await db
      .select()
      .from(agencies)
      .where(eq(agencies.clientId, clientId));

    const defaultAgency = clientAgencies[0]?.id || null;

    // 2. Prepare batch records with client-scoped unique IDs
    const recordsToInsert = rows
      .filter((r) => r.empCode && r.fullName)
      .map((row) => {
        // Find matching agency or fallback
        const matchedAgency =
          clientAgencies.find(
            (a) => a.name.toLowerCase() === (row.agencyName || "").trim().toLowerCase()
          )?.id || defaultAgency;

        const cleanCode = row.empCode.trim().toUpperCase();
        // Client-scoped pre-reg UHID prevents collisions between Client A and Client B
        const uniquePreUhid = `PRE-${clientId.slice(-4)}-${cleanCode}-${nanoid(4)}`;

        return {
          id: `emp_${nanoid(10)}`,
          uhid: uniquePreUhid,
          clientId: clientId,
          agencyId: matchedAgency,
          campId: campId,
          empCode: cleanCode,
          fullName: row.fullName.trim(),
          age: Number(row.age) || 30,
          gender: (row.gender || "MALE").toUpperCase().trim(),
          department: row.department?.trim() || null,
          designation: row.designation?.trim() || null,
          phone: row.phone?.trim() || null,
          bloodGroup: row.bloodGroup?.trim() || null,
          checkInStatus: "PRE_REGISTERED" as const,
        };
      });

    if (recordsToInsert.length === 0) {
      return { success: false, error: "No valid employee rows to insert" };
    }

    await db.insert(employees).values(recordsToInsert).onConflictDoNothing();

    revalidatePath("/camps");
    revalidatePath("/reception");
    return { success: true, count: recordsToInsert.length };
  } catch (error: any) {
    console.error("Bulk upload error:", error);
    const detailedMessage =
      error.cause?.message || error.detail || error.message || "Database query failed";
    return { success: false, error: detailedMessage };
  }
}