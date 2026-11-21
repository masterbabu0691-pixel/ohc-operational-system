// Last Updated: 20-11-2026 16:30 IST
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
  staffAttendance,
  staffDocuments,
  labParameterAliases,
  systemSettings,
  auditLogs,
  stationTypeEnum,
  roleEnum,
} from "@/db/schema";
// Last Updated: 21-11-2026 16:14 IST
import { eq, sql, and, desc, isNull, inArray } from "drizzle-orm";
import { nanoid } from "nanoid";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { getSession } from "@/lib/auth";

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
  } catch {
    return [];
  }
}

// Last Updated: 20-11-2026 15:53 IST
export async function createOrUpdateService(data: {
  id?: string;
  code: string;
  name: string;
  mainCategory?: string;
  subCategory?: string;
  station: (typeof stationTypeEnum.enumValues)[number];
  fields: string[];
  isActive?: boolean;
}) {
  try {
    const serviceId = data.id || `srv_${nanoid(8)}`;
    const defaultMain =
      data.mainCategory ||
      (data.station === "PATHOLOGY_LAB" || data.station === "PHLEBOTOMY"
        ? "PATHOLOGY"
        : data.station === "VITALS_ANTHROPOMETRY" ||
          data.station === "NURSING_STATION" ||
          data.station === "VISION_SCREENING"
        ? "VITALS_ANTHROPOMETRY"
        : data.station === "DOCTOR_EXAMINATION" ||
          data.station === "FIELD_DOCTOR_EXAM" ||
          data.station === "OFFICE_DOCTOR_REVIEW"
        ? "DOCTOR_FITNESS"
        : "DIAGNOSTICS");

    const defaultSub =
      data.subCategory ||
      (data.station === "PATHOLOGY_LAB"
        ? "Blood Test"
        : data.station === "CHEST_XRAY"
        ? "X-Ray"
        : data.station === "ECG"
        ? "ECG"
        : data.station === "SPIROMETRY_PFT"
        ? "Spirometry / PFT"
        : data.station === "AUDIOMETRY"
        ? "Audiometry"
        : "General");

    await db
      .insert(services)
      .values({
        id: serviceId,
        code: data.code.toUpperCase().trim(),
        name: data.name.trim(),
        mainCategory: defaultMain,
        subCategory: defaultSub,
        station: data.station,
        schemaDefinition: { fields: data.fields },
        isActive: data.isActive ?? true,
      })
      .onConflictDoUpdate({
        target: services.code,
        set: {
          name: data.name.trim(),
          mainCategory: defaultMain,
          subCategory: defaultSub,
          station: data.station,
          schemaDefinition: { fields: data.fields },
          isActive: data.isActive ?? true,
        },
      });

    // Auto-create default OCR alias entries for every parameter in a PATHOLOGY_LAB test
    if (data.station === "PATHOLOGY_LAB" && data.fields.length > 0) {
      for (const rawField of data.fields) {
        const cleanLabel = rawField.trim();
        if (!cleanLabel) continue;
        const canonicalKey = cleanLabel
          .toLowerCase()
          .replace(/[^a-z0-9]+(.)/g, (_, chr) => chr.toUpperCase())
          .replace(/[^a-zA-Z0-9]/g, "");
        if (!canonicalKey) continue;

        await db
          .insert(labParameterAliases)
          .values({
            id: `alias_${nanoid(8)}`,
            canonicalKey,
            displayLabel: cleanLabel,
            aliases: [cleanLabel.toUpperCase()],
            updatedAt: new Date(),
          })
          .onConflictDoNothing();
      }
    }

    revalidatePath("/admin/services");
    revalidatePath("/clients");
    revalidatePath("/lab");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// 3. User & RBAC Management (With Unique Password & Station Scoping)
export async function getAdminUsers() {
  try {
    return await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        assignedStation: users.assignedStation,
        isActive: users.isActive,
        assignedClientId: users.assignedClientId,
        clientName: clients.name,
      })
      .from(users)
      .leftJoin(clients, eq(users.assignedClientId, clients.id))
      .orderBy(users.createdAt);
  } catch {
    return [];
  }
}

export async function createOrUpdateUser(data: {
  name: string;
  email: string;
  password?: string;
  role: (typeof roleEnum.enumValues)[number];
  assignedClientId?: string;
  assignedStation?: (typeof stationTypeEnum.enumValues)[number] | null;
}) {
  try {
    const cleanEmail = data.email.toLowerCase().trim();
    const existing = await db
      .select({ id: users.id, passwordHash: users.passwordHash })
      .from(users)
      .where(eq(users.email, cleanEmail))
      .limit(1);

    let passwordHash = existing[0]?.passwordHash;
    if (data.password && data.password.trim().length >= 6) {
      const salt = await bcrypt.genSalt(10);
      passwordHash = await bcrypt.hash(data.password.trim(), salt);
    } else if (!passwordHash) {
      return { success: false, error: "Password (min 6 characters) is required for new staff accounts." };
    }

    const userId = existing[0]?.id || `usr_${nanoid(8)}`;

    await db
      .insert(users)
      .values({
        id: userId,
        name: data.name.trim(),
        email: cleanEmail,
        role: data.role,
        passwordHash,
        assignedClientId: data.assignedClientId || null,
        assignedStation: data.role === "DIAGNOSTIC_TECHNICIAN" ? data.assignedStation || null : null,
        isActive: true,
      })
      .onConflictDoUpdate({
        target: users.email,
        set: {
          name: data.name.trim(),
          role: data.role,
          passwordHash,
          assignedClientId: data.assignedClientId || null,
          assignedStation: data.role === "DIAGNOSTIC_TECHNICIAN" ? data.assignedStation || null : null,
        },
      });

    revalidatePath("/admin/users");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// 3B. Staff Onboarding Documentation
export async function uploadStaffDocument(params: {
  userId: string;
  docType: string;
  fileName: string;
  fileUrl: string;
}) {
  try {
    await db.insert(staffDocuments).values({
      id: `sdoc_${nanoid(10)}`,
      userId: params.userId,
      docType: params.docType,
      fileName: params.fileName,
      fileUrl: params.fileUrl,
    });
    revalidatePath("/admin/users");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function getStaffDocuments(userId?: string) {
  try {
    const q = db
      .select({
        id: staffDocuments.id,
        userId: staffDocuments.userId,
        userName: users.name,
        docType: staffDocuments.docType,
        fileName: staffDocuments.fileName,
        fileUrl: staffDocuments.fileUrl,
        uploadedAt: staffDocuments.uploadedAt,
      })
      .from(staffDocuments)
      .innerJoin(users, eq(staffDocuments.userId, users.id))
      .orderBy(desc(staffDocuments.uploadedAt));

    if (userId) return await q.where(eq(staffDocuments.userId, userId));
    return await q;
  } catch {
    return [];
  }
}

// 3C. Camp Staff Attendance & Station Login/Logout
export async function staffClockIn(params: { campId: string; station?: string }) {
  try {
    const session = await getSession();
    if (!session) return { success: false, error: "Not authenticated." };

    const openShift = await db
      .select({ id: staffAttendance.id })
      .from(staffAttendance)
      .where(
        and(
          eq(staffAttendance.campId, params.campId),
          eq(staffAttendance.userId, session.userId),
          isNull(staffAttendance.checkOutTime)
        )
      )
      .limit(1);

    if (openShift.length > 0) {
      return { success: true, alreadyClockedIn: true };
    }

    await db.insert(staffAttendance).values({
      id: `att_${nanoid(10)}`,
      campId: params.campId,
      userId: session.userId,
      userName: session.name,
      userRole: session.role,
      station: params.station || session.role,
      checkInTime: new Date(),
      approvalStatus: "PENDING",
    });

    await db.insert(auditLogs).values({
      userId: session.userId,
      userRole: session.role,
      action: "STATION_STAFF_LOGIN",
      entityType: "CAMP",
      entityId: params.campId,
      newState: { station: params.station },
    });

    revalidatePath("/admin/users");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function staffClockOut(params: { campId: string }) {
  try {
    const session = await getSession();
    if (!session) return { success: false, error: "Not authenticated." };

    await db
      .update(staffAttendance)
      .set({ checkOutTime: new Date() })
      .where(
        and(
          eq(staffAttendance.campId, params.campId),
          eq(staffAttendance.userId, session.userId),
          isNull(staffAttendance.checkOutTime)
        )
      );

    await db.insert(auditLogs).values({
      userId: session.userId,
      userRole: session.role,
      action: "STATION_STAFF_LOGOUT",
      entityType: "CAMP",
      entityId: params.campId,
    });

    revalidatePath("/admin/users");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function getCampStaffAttendance(campId?: string) {
  try {
    const q = db
      .select({
        id: staffAttendance.id,
        campId: staffAttendance.campId,
        campName: camps.name,
        userId: staffAttendance.userId,
        userName: staffAttendance.userName,
        userRole: staffAttendance.userRole,
        station: staffAttendance.station,
        checkInTime: staffAttendance.checkInTime,
        checkOutTime: staffAttendance.checkOutTime,
        approvalStatus: staffAttendance.approvalStatus,
        approvedBy: staffAttendance.approvedBy,
        notes: staffAttendance.notes,
      })
      .from(staffAttendance)
      .innerJoin(camps, eq(staffAttendance.campId, camps.id))
      .orderBy(desc(staffAttendance.checkInTime));

    if (campId) return await q.where(eq(staffAttendance.campId, campId));
    return await q;
  } catch {
    return [];
  }
}

export async function approveStaffAttendance(params: {
  attendanceId: string;
  status: "APPROVED" | "REJECTED";
  notes?: string;
}) {
  try {
    const session = await getSession();
    if (!session || !["SUPER_ADMIN", "CAMP_COORDINATOR"].includes(session.role)) {
      return { success: false, error: "Only Camp Coordinator or Super Admin can approve attendance." };
    }

    await db
      .update(staffAttendance)
      .set({
        approvalStatus: params.status,
        approvedBy: session.name,
        approvedAt: new Date(),
        notes: params.notes?.trim() || null,
      })
      .where(eq(staffAttendance.id, params.attendanceId));

    revalidatePath("/admin/users");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// 3D. Comprehensive Filtered Audit Logs (Individual Staff / Client / Employee)
export async function getFilteredAuditLogs(params: {
  filterType: "ALL" | "STAFF" | "CLIENT" | "EMPLOYEE";
  query?: string;
}) {
  try {
    const rows = await db
      .select()
      .from(auditLogs)
      .orderBy(desc(auditLogs.timestamp))
      .limit(150);

    const q = (params.query || "").trim().toLowerCase();
    return rows.filter((r) => {
      if (params.filterType === "STAFF" && q) {
        return r.userId.toLowerCase().includes(q) || r.userRole.toLowerCase().includes(q);
      }
      if (params.filterType === "CLIENT" && q) {
        return r.entityType === "CAMP" || r.entityId.toLowerCase().includes(q);
      }
      if (params.filterType === "EMPLOYEE" && q) {
        return r.entityId.toLowerCase().includes(q);
      }
      if (q) {
        return (
          r.action.toLowerCase().includes(q) ||
          r.entityId.toLowerCase().includes(q) ||
          r.userId.toLowerCase().includes(q)
        );
      }
      return true;
    });
  } catch {
    return [];
  }
}

// 4. System Settings
export async function getSystemSetting(key: string) {
  try {
    const res = await db.select().from(systemSettings).where(eq(systemSettings.key, key)).limit(1);
    return res[0]?.value || null;
  } catch {
    return null;
  }
}

export async function saveSystemSetting(key: string, value: Record<string, any>) {
  try {
    await db
      .insert(systemSettings)
      .values({ key, value, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: systemSettings.key,
        set: { value, updatedAt: new Date() },
      });

    revalidatePath("/admin/settings");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// 5. Vyora Roster Query
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
      if (doctorFitness) pipelineStatus = "COMPLETED";
      else if (empStations["DOCTOR_EXAMINATION"] === "COMPLETED") pipelineStatus = "DOC_DONE";
      else if (empStations["PATHOLOGY_LAB"] === "COMPLETED") pipelineStatus = "LAB_DONE";
      else if (empStations["PHLEBOTOMY"] === "COMPLETED") pipelineStatus = "PHLEB_DONE";

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

    return { camps: campList, employees: formattedEmployees };
  } catch (err: any) {
    console.error("Error fetching roster:", err);
    return { camps: [], employees: [] };
  }
}

// 6. Vyora Camp Monitor Metrics
// Last Updated: 21-11-2026 16:14 IST
export async function getCampMonitorMetrics(
  selectedClientId: string = "all",
  selectedCampId: string = "all"
) {
  try {
    const [allClients, allCamps] = await Promise.all([
      db
        .select({ id: clients.id, name: clients.name, code: clients.code })
        .from(clients)
        .where(eq(clients.isActive, true)),
      db
        .select({ id: camps.id, name: camps.name, clientId: camps.clientId, packageId: camps.packageId })
        .from(camps),
    ]);

    let targetClientId: string | null = selectedClientId !== "all" ? selectedClientId : null;
    const targetCampId: string | null = selectedCampId !== "all" ? selectedCampId : null;

    if (targetCampId) {
      const matchedCamp = allCamps.find((c) => c.id === targetCampId);
      if (matchedCamp) targetClientId = matchedCamp.clientId;
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

    const empSelect = {
      id: employees.id,
      clientId: employees.clientId,
      campId: employees.campId,
      checkInStatus: employees.checkInStatus,
      nurseRecordedAt: employees.nurseRecordedAt,
    };

    const allEmps = targetCampId
      ? await db.select(empSelect).from(employees).where(eq(employees.campId, targetCampId))
      : targetClientId
      ? await db.select(empSelect).from(employees).where(eq(employees.clientId, targetClientId))
      : await db.select(empSelect).from(employees);

    const totalRoster = allEmps.length;
    const preRegistered = allEmps.filter((e) => e.checkInStatus === "PRE_REGISTERED").length;
    const checkedIn = allEmps.filter((e) => e.checkInStatus === "CHECKED_IN").length;
    const nurseDone = allEmps.filter((e) => Boolean(e.nurseRecordedAt)).length;
    const employeeIds = allEmps.map((e) => e.id);

    const scopedDiagnostics =
      employeeIds.length === 0
        ? []
        : targetCampId
        ? await db
            .select({ employeeId: diagnosticRecords.employeeId, station: diagnosticRecords.station })
            .from(diagnosticRecords)
            .where(eq(diagnosticRecords.campId, targetCampId))
        : await db
            .select({ employeeId: diagnosticRecords.employeeId, station: diagnosticRecords.station })
            .from(diagnosticRecords)
            .where(inArray(diagnosticRecords.employeeId, employeeIds));

    const scopedChecklists =
      employeeIds.length === 0
        ? []
        : targetCampId
        ? await db
            .select({
              employeeId: stationChecklist.employeeId,
              station: stationChecklist.station,
              arrivalStatus: stationChecklist.arrivalStatus,
            })
            .from(stationChecklist)
            .where(eq(stationChecklist.campId, targetCampId))
        : await db
            .select({
              employeeId: stationChecklist.employeeId,
              station: stationChecklist.station,
              arrivalStatus: stationChecklist.arrivalStatus,
            })
            .from(stationChecklist)
            .where(inArray(stationChecklist.employeeId, employeeIds));

    const scopedReviews =
      employeeIds.length === 0
        ? []
        : targetCampId
        ? await db
            .select({ employeeId: doctorReviews.employeeId, isSigned: doctorReviews.isSigned })
            .from(doctorReviews)
            .where(eq(doctorReviews.campId, targetCampId))
        : await db
            .select({ employeeId: doctorReviews.employeeId, isSigned: doctorReviews.isSigned })
            .from(doctorReviews)
            .where(inArray(doctorReviews.employeeId, employeeIds));

    const completed = scopedReviews.filter((r) => r.isSigned).length;
    const finalReview = scopedReviews.filter((r) => !r.isSigned).length;

    const phlebDoneSet = new Set(
      scopedChecklists
        .filter((c) => c.station === "PHLEBOTOMY" && c.arrivalStatus === "COMPLETED")
        .map((c) => c.employeeId)
    );
    const labDoneSet = new Set(
      scopedDiagnostics.filter((d) => d.station === "PATHOLOGY_LAB").map((d) => d.employeeId)
    );
    const fieldDocDoneSet = new Set(
      scopedChecklists
        .filter((c) => c.station === "FIELD_DOCTOR_EXAM" && c.arrivalStatus === "COMPLETED")
        .map((c) => c.employeeId)
    );

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

      return { isContracted: true, pending, arrived, done };
    };

    return {
      clients: allClients,
      camps: allCamps,
      pipeline: {
        totalClients: targetClientId ? 1 : allClients.length,
        totalRoster,
        preRegistered,
        receptionDone: checkedIn,
        nurseDone,
        phleboDone: phlebDoneSet.size,
        doctorDone: fieldDocDoneSet.size,
        labDone: labDoneSet.size,
        phlebotomyQueue: Math.max(0, checkedIn - phlebDoneSet.size),
        doctorQueue: Math.max(0, checkedIn - completed),
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