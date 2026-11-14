// src/actions/client-actions.ts
"use server";

import { db } from "@/db";
import { clients, agencies, clientPackages, services } from "@/db/schema";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { revalidatePath } from "next/cache";

// 1. Fetch all available clinical services
export async function getMasterServices() {
  return await db.select().from(services).where(eq(services.isActive, true));
}

// 2. Create client, agencies, and dynamic service package
export async function createClientWithPackage(formData: {
  name: string;
  code: string;
  contactPerson?: string;
  email?: string;
  phone?: string;
  address?: string;
  agenciesList: string[];
  packageName: string;
  selectedServiceIds: string[];
}) {
  try {
    const clientId = `cli_${nanoid(10)}`;

    // 1. Insert Client with explicit nulls for optional fields
    await db.insert(clients).values({
      id: clientId,
      name: formData.name.trim(),
      code: formData.code.toUpperCase().trim(),
      contactPerson: formData.contactPerson?.trim() || null,
      email: formData.email?.trim() || null,
      phone: formData.phone?.trim() || null,
      address: formData.address?.trim() || null,
      isActive: true,
    });

    // 2. Insert Agencies / Contractors
    const agenciesToInsert =
      formData.agenciesList.length > 0 ? formData.agenciesList : ["Direct Payroll"];

    for (const agencyName of agenciesToInsert) {
      if (agencyName.trim()) {
        await db.insert(agencies).values({
          id: `agn_${nanoid(10)}`,
          clientId: clientId,
          name: agencyName.trim(),
          code: agencyName.trim().toUpperCase().replace(/[^A-Z0-9]/g, "-"),
        });
      }
    }

    // 3. Insert Dynamic Service Package
    await db.insert(clientPackages).values({
      id: `pkg_${nanoid(10)}`,
      clientId: clientId,
      name: formData.packageName || "Standard Camp Package",
      activeServiceIds: formData.selectedServiceIds,
    });

    revalidatePath("/clients");
    return { success: true, clientId };
  } catch (error: any) {
    console.error("Database error in createClientWithPackage:", error);
    const detailedMessage =
      error.cause?.message || error.detail || error.message || "Unknown database error";
    return { success: false, error: detailedMessage };
  }
}