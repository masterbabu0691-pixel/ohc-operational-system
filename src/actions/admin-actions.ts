// src/actions/admin-actions.ts
"use server";

import { db } from "@/db";
import { 
  services, 
  camps, 
  clients, 
  clientPackages, 
  agencies, 
  employees, 
  stationChecklist, 
  diagnosticRecords,
  doctorReviews, 
  users, 
  systemSettings, 
  auditLogs,
  stationTypeEnum,
  roleEnum
} from "@/db/schema";
import { eq, sql, and } from "drizzle-orm";
import { nanoid } from "nanoid";
import { revalidatePath } from "next/cache";

// 1. Live Operations Dashboard Numbers
export async function getAdminDashboardStats() {
  try {
    const allCamps = await db
      .select({
        id: camps.id,
        name: camps.name,
        location: camps.location,
        clientName: clients.name,
      })
      .from(camps)
      .innerJoin(clients, eq(camps.clientId, clients.id));

    const campMetrics = await Promise.all(
      allCamps.map(async (camp) => {
        const empCountResult = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(employees)
          .where(eq(employees.campId, camp.id));

        const totalEmployees = empCountResult[0]?.count || 0;

        const checkedInResult = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(employees)
          .where(and(eq(employees.campId, camp.id), eq(employees.checkInStatus, "CHECKED_IN")));

        const checkedIn = checkedInResult[0]?.count || 0;

        const stationStats = await db
          .select({
            station: stationChecklist.station,
            status: stationChecklist.status,
            count: sql<number>`count(*)::int`,
          })
          .from(stationChecklist)
          .where(eq(stationChecklist.campId, camp.id))
          .groupBy(stationChecklist.station, stationChecklist.status);

        const fitnessStats = await db
          .select({
            status: doctorReviews.fitnessStatus,
            count: sql<number>`count(*)::int`,
          })
          .from(doctorReviews)
          .where(eq(doctorReviews.campId, camp.id))
          .groupBy(doctorReviews.fitnessStatus);

        return {
          ...camp,
          totalEmployees,
          checkedIn,
          pendingCheckIn: totalEmployees - checkedIn,
          stationStats,
          fitnessStats,
        };
      })
    );

    return campMetrics;
  } catch (err: any) {
    console.error("Admin stats error:", err);
    return [];
  }
}

// 2. Services / Tests Catalog Management (CMS)
export async function getAdminServices() {
  try {
    return await db.select().from(services).orderBy(services.name);
  } catch (err) {
    return [];
  }
}

export async function createOrUpdateService(data: {
  id?: string;
  code: string;
  name: string;
  station: typeof stationTypeEnum.enumValues[number];
  fields: string[];
  isActive?: boolean;
}) {
  try {
    const serviceId = data.id || `srv_${nanoid(8)}`;

    await db
      .insert(services)
      .values({
        id: serviceId,
        code: data.code.toUpperCase().trim(),
        name: data.name.trim(),
        station: data.station,
        schemaDefinition: { fields: data.fields },
        isActive: data.isActive ?? true,
      })
      .onConflictDoUpdate({
        target: services.code,
        set: {
          name: data.name.trim(),
          station: data.station,
          schemaDefinition: { fields: data.fields },
          isActive: data.isActive ?? true,
        },
      });

    revalidatePath("/admin/services");
    revalidatePath("/clients");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// 3. User & RBAC Management
export async function getAdminUsers() {
  try {
    return await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        isActive: users.isActive,
        assignedClientId: users.assignedClientId,
        clientName: clients.name,
      })
      .from(users)
      .leftJoin(clients, eq(users.assignedClientId, clients.id))
      .orderBy(users.createdAt);
  } catch (err) {
    return [];
  }
}

export async function createOrUpdateUser(data: {
  name: string;
  email: string;
  role: typeof roleEnum.enumValues[number];
  assignedClientId?: string;
}) {
  try {
    const userId = `usr_${nanoid(8)}`;

    await db
      .insert(users)
      .values({
        id: userId,
        name: data.name.trim(),
        email: data.email.toLowerCase().trim(),
        role: data.role,
        passwordHash: "$2a$10$abcdefghijklmnopqrstuvwxyz01234567890",
        assignedClientId: data.assignedClientId || null,
        isActive: true,
      })
      .onConflictDoUpdate({
        target: users.email,
        set: {
          name: data.name.trim(),
          role: data.role,
          assignedClientId: data.assignedClientId || null,
        },
      });

    revalidatePath("/admin/users");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// 4. System Settings (Branding & Print Layout)
export async function getSystemSetting(key: string) {
  try {
    const res = await db.select().from(systemSettings).where(eq(systemSettings.key, key)).limit(1);
    return res[0]?.value || null;
  } catch (err) {
    return null;
  }
}

export async function saveSystemSetting(key: string, value: Record<string, any>) {
  try {
    await db
      .insert(systemSettings)
      .values({
        key,
        value,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: systemSettings.key,
        set: {
          value,
          updatedAt: new Date(),
        },
      });

    revalidatePath("/admin/settings");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// 5. Vyora Roster Query WITH Agency Name Joined
export async function getAdminCampRoster(campId: string = "all") {
  try {
    const campList = await db
      .select({
        id: camps.id,
        campName: camps.name,
        clientName: clients.name,
        clientCode: clients.code,
      })
      .from(camps)
      .innerJoin(clients, eq(camps.clientId, clients.id));

    // Left join agencies to fetch actual agencyName
    const baseQuery = db
      .select({
        id: employees.id,
        uhid: employees.uhid,
        empCode: employees.empCode,
        name: employees.fullName,
        department: employees.department,
        checkInStatus: employees.checkInStatus,
        campId: employees.campId,
        agencyId: employees.agencyId,
        agencyName: agencies.name,
      })
      .from(employees)
      .leftJoin(agencies, eq(employees.agencyId, agencies.id));

    const empList =
      campId !== "all"
        ? await baseQuery.where(eq(employees.campId, campId)).orderBy(employees.uhid)
        : await baseQuery.orderBy(employees.uhid);

    const allChecklists = await db.select().from(stationChecklist);
    const allReviews = await db.select().from(doctorReviews);

    const checkMap = new Map<string, Record<string, string>>();
    allChecklists.forEach((chk) => {
      const current = checkMap.get(chk.employeeId) || {};
      current[chk.station] = chk.status;
      checkMap.set(chk.employeeId, current);
    });

    const reviewMap = new Map(allReviews.map((r) => [r.employeeId, r.fitnessStatus]));

    const formattedEmployees = empList.map((emp, index) => {
      const empStations = checkMap.get(emp.id) || {};
      const doctorFitness = reviewMap.get(emp.id) || null;

      let pipelineStatus: "REGISTERED" | "PHLEB_DONE" | "DOC_DONE" | "LAB_DONE" | "COMPLETED" = "REGISTERED";
      if (doctorFitness) {
        pipelineStatus = "COMPLETED";
      } else if (empStations["DOCTOR_EXAMINATION"] === "COMPLETED") {
        pipelineStatus = "DOC_DONE";
      } else if (empStations["PATHOLOGY_LAB"] === "COMPLETED") {
        pipelineStatus = "LAB_DONE";
      } else if (empStations["PHLEBOTOMY"] === "COMPLETED") {
        pipelineStatus = "PHLEB_DONE";
      }

      const getDotStatus = (stnKey: string) => {
        const val = empStations[stnKey];
        if (val === "COMPLETED") return "DONE";
        if (val === "PENDING") return "PENDING";
        return "N/A";
      };

      return {
        id: emp.id,
        serialNo: index + 1,
        uhid: emp.uhid,
        name: emp.name,
        department: emp.department || "General",
        agencyName: emp.agencyName || "Direct Payroll",
        status: pipelineStatus,
        bloodCollected: empStations["PHLEBOTOMY"] === "COMPLETED",
        urineCollected: empStations["PHLEBOTOMY"] === "COMPLETED",
        xrayStatus: getDotStatus("CHEST_XRAY"),
        ecgStatus: getDotStatus("ECG"),
        pftStatus: getDotStatus("SPIROMETRY_PFT"),
        audioStatus: getDotStatus("AUDIOMETRY"),
        conclusion: doctorFitness ? { fitness: doctorFitness } : null,
      };
    });

    return {
      camps: campList,
      employees: formattedEmployees,
    };
  } catch (err: any) {
    console.error("Error fetching roster:", err);
    return { camps: [], employees: [] };
  }
}

// 6. Vyora Camp Monitor Metrics (Clean & Scoped)
export async function getCampMonitorMetrics(
  selectedClientId: string = "all",
  selectedCampId: string = "all"
) {
  try {
    const allClients = await db
      .select({
        id: clients.id,
        name: clients.name,
        code: clients.code,
      })
      .from(clients)
      .where(eq(clients.isActive, true));

    const allCamps = await db
      .select({
        id: camps.id,
        name: camps.name,
        clientId: camps.clientId,
        packageId: camps.packageId,
      })
      .from(camps);

    let targetClientId: string | null = selectedClientId !== "all" ? selectedClientId : null;
    let targetCampId: string | null = selectedCampId !== "all" ? selectedCampId : null;

    if (targetCampId) {
      const matchedCamp = allCamps.find((c) => c.id === targetCampId);
      if (matchedCamp) {
        targetClientId = matchedCamp.clientId;
      }
    }

    let activeServiceCodes: string[] = [];
    const isSpecificScope = Boolean(targetCampId || targetClientId);

    if (targetCampId) {
      const campRecord = allCamps.find((c) => c.id === targetCampId);
      if (campRecord) {
        const pkg = await db
          .select({ activeServiceIds: clientPackages.activeServiceIds })
          .from(clientPackages)
          .where(eq(clientPackages.id, campRecord.packageId))
          .limit(1);
        activeServiceCodes = pkg[0]?.activeServiceIds || [];
      }
    } else if (targetClientId) {
      const pkg = await db
        .select({ activeServiceIds: clientPackages.activeServiceIds })
        .from(clientPackages)
        .where(eq(clientPackages.clientId, targetClientId))
        .limit(1);
      activeServiceCodes = pkg[0]?.activeServiceIds || [];
    }

    const isStationContracted = (stationKeyword: string) => {
      if (!isSpecificScope) return true;
      return activeServiceCodes.some((code) =>
        code.toLowerCase().includes(stationKeyword.toLowerCase())
      );
    };

    let allEmps = [];
    if (targetCampId) {
      allEmps = await db
        .select({
          id: employees.id,
          clientId: employees.clientId,
          campId: employees.campId,
          checkInStatus: employees.checkInStatus,
        })
        .from(employees)
        .where(eq(employees.campId, targetCampId));
    } else if (targetClientId) {
      allEmps = await db
        .select({
          id: employees.id,
          clientId: employees.clientId,
          campId: employees.campId,
          checkInStatus: employees.checkInStatus,
        })
        .from(employees)
        .where(eq(employees.clientId, targetClientId));
    } else {
      allEmps = await db
        .select({
          id: employees.id,
          clientId: employees.clientId,
          campId: employees.campId,
          checkInStatus: employees.checkInStatus,
        })
        .from(employees);
    }

    const totalRoster = allEmps.length;
    const preRegistered = allEmps.filter((e) => e.checkInStatus === "PRE_REGISTERED").length;
    const checkedIn = allEmps.filter((e) => e.checkInStatus === "CHECKED_IN").length;
    const employeeIds = allEmps.map((e) => e.id);

    const allDiagnostics = await db.select().from(diagnosticRecords);
    const scopedDiagnostics = allDiagnostics.filter((d) =>
      employeeIds.includes(d.employeeId)
    );

    const allReviews = await db.select().from(doctorReviews);
    const scopedReviews = allReviews.filter((r) =>
      employeeIds.includes(r.employeeId)
    );

    const completed = scopedReviews.filter((r) => r.isSigned).length;
    const finalReview = scopedReviews.filter((r) => !r.isSigned).length;
    const doctorQueue = Math.max(0, checkedIn - completed);

    const phlebDoneEmps = new Set(
      scopedDiagnostics
        .filter((d) => d.station === "PHLEBOTOMY" || d.station === "PATHOLOGY_LAB")
        .map((d) => d.employeeId)
    );
    const phlebotomyQueue = Math.max(0, checkedIn - phlebDoneEmps.size);

    const getStationCounts = (stationName: string, serviceKeyword: string) => {
      const contracted = isStationContracted(serviceKeyword);
      if (!contracted) {
        return { isContracted: false, pending: "N/A", arrived: "N/A", done: "N/A" };
      }

      const completedEmpIds = new Set(
        scopedDiagnostics
          .filter((d) => d.station.toLowerCase().includes(stationName.toLowerCase()))
          .map((d) => d.employeeId)
      );

      const done = completedEmpIds.size;
      const arrived = Math.max(0, checkedIn - done);
      const pending = preRegistered;

      return {
        isContracted: true,
        pending,
        arrived,
        done,
      };
    };

    return {
      clients: allClients,
      camps: allCamps,
      pipeline: {
        totalRoster,
        preRegistered,
        phlebotomyQueue,
        doctorQueue,
        finalReview,
        completed,
      },
      diagnostics: {
        xray: getStationCounts("CHEST_XRAY", "xray"),
        ecg: getStationCounts("ECG", "ecg"),
        pft: getStationCounts("SPIROMETRY_PFT", "spiro"),
        audiometry: getStationCounts("AUDIOMETRY", "audio"),
      },
    };
  } catch (err: any) {
    console.error("Error fetching monitor metrics:", err);
    return null;
  }
}