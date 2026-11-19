// src/actions/client-actions.ts
"use server";

import { db } from "@/db";
import { clients, agencies, clientPackages, services } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { nanoid } from "nanoid";
import { revalidatePath } from "next/cache";

export interface AdditionalContact {
  name: string;
  designation?: string;
  department?: string;
  email?: string;
  phone?: string;
}

// 1. Fetch all available clinical services
export async function getMasterServices() {
  return await db.select().from(services).where(eq(services.isActive, true));
}

// 2. Fetch all clients with their agencies, contacts, and active package
export async function getAllClientsWithDetails() {
  try {
    const [clientRows, agencyRows, packageRows] = await Promise.all([
      db.select().from(clients).orderBy(desc(clients.createdAt)),
      db.select().from(agencies),
      db.select().from(clientPackages),
    ]);

    return clientRows.map((c) => {
      const clientAgencies = agencyRows.filter((a) => a.clientId === c.id);
      const pkg = packageRows.find((p) => p.clientId === c.id) || null;
      return {
        ...c,
        additionalContacts: Array.isArray(c.additionalContacts) ? c.additionalContacts : [],
        agencies: clientAgencies,
        packageId: pkg?.id || null,
        packageName: pkg?.name || "Standard Health Checkup Package",
        selectedServiceIds: Array.isArray(pkg?.activeServiceIds) ? pkg.activeServiceIds : [],
      };
    });
  } catch (error) {
    console.error("getAllClientsWithDetails error:", error);
    return [];
  }
}

// 3. Create client, agencies, and dynamic service package
export async function createClientWithPackage(formData: {
  name: string;
  code?: string;
  contactPerson?: string;
  contactDesignation?: string;
  contactDepartment?: string;
  email?: string;
  phone?: string;
  address?: string;
  totalStrength?: string;
  campMonth?: string;
  additionalContacts?: AdditionalContact[];
  agenciesList: string[];
  packageName: string;
  selectedServiceIds: string[];
}) {
  try {
    const clientId = `cli_${nanoid(10)}`;

    const baseCode =
      (
        formData.code?.trim() ||
        formData.name
          .trim()
          .replace(/[^a-zA-Z0-9\s]/g, "")
          .split(/\s+/)
          .slice(0, 2)
          .join("-")
      )
        .toUpperCase()
        .slice(0, 12) || "CLIENT";

    let finalCode = baseCode;
    const existingCode = await db
      .select({ id: clients.id })
      .from(clients)
      .where(eq(clients.code, finalCode))
      .limit(1);

    if (existingCode.length > 0 || !formData.code?.trim()) {
      finalCode = `${baseCode}-${nanoid(4).toUpperCase()}`;
    }

    const cleanContacts = (formData.additionalContacts || [])
      .filter((c) => c.name?.trim())
      .map((c) => ({
        name: c.name.trim(),
        designation: c.designation?.trim() || "",
        department: c.department?.trim() || "",
        email: c.email?.trim() || "",
        phone: c.phone?.trim() || "",
      }));

    await db.insert(clients).values({
      id: clientId,
      name: formData.name.trim(),
      code: finalCode,
      contactPerson: formData.contactPerson?.trim() || null,
      contactDesignation: formData.contactDesignation?.trim() || null,
      contactDepartment: formData.contactDepartment?.trim() || null,
      email: formData.email?.trim() || null,
      phone: formData.phone?.trim() || null,
      address: formData.address?.trim() || null,
      totalStrength: formData.totalStrength?.trim() || null,
      campMonth: formData.campMonth?.trim() || null,
      additionalContacts: cleanContacts,
      isActive: true,
    });

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

    await db.insert(clientPackages).values({
      id: `pkg_${nanoid(10)}`,
      clientId: clientId,
      name: formData.packageName || "Standard Camp Package",
      activeServiceIds: formData.selectedServiceIds,
    });

    revalidatePath("/clients");
    revalidatePath("/camps");
    revalidatePath("/admin");
    return { success: true, clientId, clientCode: finalCode };
  } catch (error: any) {
    console.error("Database error in createClientWithPackage:", error);
    const detailedMessage =
      error.cause?.message || error.detail || error.message || "Unknown database error";
    return { success: false, error: detailedMessage };
  }
}

// 4. Update existing client, contacts, agencies (non-destructive), and package
export async function updateClientWithPackage(formData: {
  id: string;
  name: string;
  code: string;
  contactPerson?: string;
  contactDesignation?: string;
  contactDepartment?: string;
  email?: string;
  phone?: string;
  address?: string;
  totalStrength?: string;
  campMonth?: string;
  additionalContacts?: AdditionalContact[];
  agenciesList: string[];
  packageId?: string | null;
  packageName: string;
  selectedServiceIds: string[];
  isActive?: boolean;
}) {
  try {
    const cleanContacts = (formData.additionalContacts || [])
      .filter((c) => c.name?.trim())
      .map((c) => ({
        name: c.name.trim(),
        designation: c.designation?.trim() || "",
        department: c.department?.trim() || "",
        email: c.email?.trim() || "",
        phone: c.phone?.trim() || "",
      }));

    await db
      .update(clients)
      .set({
        name: formData.name.trim(),
        code: formData.code.trim().toUpperCase(),
        contactPerson: formData.contactPerson?.trim() || null,
        contactDesignation: formData.contactDesignation?.trim() || null,
        contactDepartment: formData.contactDepartment?.trim() || null,
        email: formData.email?.trim() || null,
        phone: formData.phone?.trim() || null,
        address: formData.address?.trim() || null,
        totalStrength: formData.totalStrength?.trim() || null,
        campMonth: formData.campMonth?.trim() || null,
        additionalContacts: cleanContacts,
        ...(formData.isActive !== undefined ? { isActive: formData.isActive } : {}),
      })
      .where(eq(clients.id, formData.id));

    // Add any new agencies without deleting existing ones (preserves employee FK links)
    const existingAgencies = await db
      .select({ name: agencies.name })
      .from(agencies)
      .where(eq(agencies.clientId, formData.id));

    const existingNames = new Set(existingAgencies.map((a) => a.name.trim().toLowerCase()));
    const requestedAgencies =
      formData.agenciesList.length > 0 ? formData.agenciesList : ["Direct Payroll"];

    for (const agencyName of requestedAgencies) {
      const clean = agencyName.trim();
      if (clean && !existingNames.has(clean.toLowerCase())) {
        await db.insert(agencies).values({
          id: `agn_${nanoid(10)}`,
          clientId: formData.id,
          name: clean,
          code: clean.toUpperCase().replace(/[^A-Z0-9]/g, "-"),
        });
        existingNames.add(clean.toLowerCase());
      }
    }

    if (formData.packageId) {
      await db
        .update(clientPackages)
        .set({
          name: formData.packageName.trim() || "Standard Camp Package",
          activeServiceIds: formData.selectedServiceIds,
        })
        .where(eq(clientPackages.id, formData.packageId));
    } else {
      await db.insert(clientPackages).values({
        id: `pkg_${nanoid(10)}`,
        clientId: formData.id,
        name: formData.packageName.trim() || "Standard Camp Package",
        activeServiceIds: formData.selectedServiceIds,
      });
    }

    revalidatePath("/clients");
    revalidatePath("/camps");
    revalidatePath("/reception");
    revalidatePath("/admin");
    return { success: true };
  } catch (error: any) {
    console.error("Database error in updateClientWithPackage:", error);
    const detailedMessage =
      error.cause?.message || error.detail || error.message || "Unknown database error";
    return { success: false, error: detailedMessage };
  }
}