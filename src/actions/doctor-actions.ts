// src/actions/doctor-actions.ts
"use server";

import { db } from "@/db";
import { 
  employees, 
  camps, 
  clients, 
  diagnosticRecords, 
  doctorReviews, 
  stationChecklist, 
  fitnessStatusEnum 
} from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { nanoid } from "nanoid";

// 1. Get Doctor Review Queue with diagnostic status
export async function getDoctorQueue(campId: string) {
  try {
    const list = await db
      .select({
        employeeId: employees.id,
        uhid: employees.uhid,
        empCode: employees.empCode,
        fullName: employees.fullName,
        age: employees.age,
        gender: employees.gender,
        department: employees.department,
        designation: employees.designation,
        bloodGroup: employees.bloodGroup,
        photoUrl: employees.photoUrl,
        clientId: employees.clientId,
      })
      .from(employees)
      .where(
        and(
          eq(employees.campId, campId),
          eq(employees.checkInStatus, "CHECKED_IN")
        )
      )
      .orderBy(employees.uhid);

    // Fetch existing doctor reviews for these employees
    const reviews = await db
      .select()
      .from(doctorReviews)
      .where(eq(doctorReviews.campId, campId));

    const reviewMap = new Map(reviews.map((r) => [r.employeeId, r]));

    return list.map((emp) => ({
      ...emp,
      review: reviewMap.get(emp.employeeId) || null,
      isCertified: Boolean(reviewMap.get(emp.employeeId)?.isSigned),
    }));
  } catch (err: any) {
    console.error("Error fetching doctor queue:", err);
    return [];
  }
}

// 2. Fetch all completed diagnostic records for a specific employee
export async function getEmployeeClinicalSummary(employeeId: string, campId: string) {
  try {
    const records = await db
      .select()
      .from(diagnosticRecords)
      .where(
        and(
          eq(diagnosticRecords.employeeId, employeeId),
          eq(diagnosticRecords.campId, campId)
        )
      );

    return records;
  } catch (err) {
    console.error("Error fetching clinical summary:", err);
    return [];
  }
}

// 3. Save Doctor Fitness Review & Sign-Off
export async function saveDoctorReview(formData: {
  employeeId: string;
  campId: string;
  doctorName: string;
  doctorRegNo: string;
  fitnessStatus: "FIT" | "UNFIT" | "TEMPORARILY_UNFIT_FOLLOW_UP";
  followUpDate?: string;
  clinicalNotes?: string;
  systemicExam: Record<string, string>;
  recommendations?: string;
  signatureDataUrl?: string;
}) {
  try {
    const reviewId = `rev_${nanoid(10)}`;

    // 1. Insert or update doctor review
    await db
      .insert(doctorReviews)
      .values({
        id: reviewId,
        employeeId: formData.employeeId,
        campId: formData.campId,
        doctorId: "doc_primary",
        doctorName: formData.doctorName.trim(),
        doctorRegNo: formData.doctorRegNo.trim(),
        fitnessStatus: formData.fitnessStatus,
        followUpDate: formData.followUpDate || null,
        clinicalNotes: formData.clinicalNotes || null,
        systemicExamination: formData.systemicExam,
        recommendations: formData.recommendations || null,
        doctorSignatureUrl: formData.signatureDataUrl || null,
        isSigned: true,
        signedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: doctorReviews.employeeId,
        set: {
          doctorName: formData.doctorName.trim(),
          doctorRegNo: formData.doctorRegNo.trim(),
          fitnessStatus: formData.fitnessStatus,
          followUpDate: formData.followUpDate || null,
          clinicalNotes: formData.clinicalNotes || null,
          systemicExamination: formData.systemicExam,
          recommendations: formData.recommendations || null,
          doctorSignatureUrl: formData.signatureDataUrl || null,
          isSigned: true,
          signedAt: new Date(),
        },
      });

    // 2. Mark Doctor Examination station as COMPLETED in stationChecklist
    await db
      .update(stationChecklist)
      .set({
        status: "COMPLETED",
        completedAt: new Date(),
        completedBy: formData.doctorName,
      })
      .where(
        and(
          eq(stationChecklist.employeeId, formData.employeeId),
          eq(stationChecklist.campId, formData.campId),
          eq(stationChecklist.station, "DOCTOR_EXAMINATION")
        )
      );

    revalidatePath("/doctor");
    return { success: true };
  } catch (error: any) {
    console.error("Save doctor review error:", error);
    const msg = error.cause?.message || error.detail || error.message;
    return { success: false, error: msg };
  }
}