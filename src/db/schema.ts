// src/db/schema.ts
import {
  pgTable,
  text,
  timestamp,
  boolean,
  integer,
  jsonb,
  pgEnum,
  serial,
  date,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

// 1. Roles & Status Enums
export const roleEnum = pgEnum("role", [
  "SUPER_ADMIN",
  "CLIENT_HR",
  "CAMP_COORDINATOR",
  "RECEPTIONIST",
  "NURSE",
  "FIELD_DOCTOR",
  "OFFICE_DOCTOR",
  "DOCTOR_EXAMINER",
  "PHLEBOTOMIST",
  "LAB_TECHNICIAN",
  "DIAGNOSTIC_TECHNICIAN",
  "MRD_OFFICER",
]);

export const fitnessStatusEnum = pgEnum("fitness_status", [
  "PENDING",
  "FIT",
  "FIT_WITH_CONDITION",
  "UNFIT",
  "TEMPORARILY_UNFIT_FOLLOW_UP",
]);

export const stationTypeEnum = pgEnum("station_type", [
  "REGISTRATION",
  "NURSING_STATION",
  "VITALS_ANTHROPOMETRY",
  "PHLEBOTOMY",
  "PATHOLOGY_LAB",
  "CHEST_XRAY",
  "ECG",
  "SPIROMETRY_PFT",
  "AUDIOMETRY",
  "VISION_SCREENING",
  "DOCTOR_EXAMINATION",
  "FIELD_DOCTOR_EXAM",
  "OFFICE_DOCTOR_REVIEW",
]);

export const stationArrivalStatusEnum = pgEnum("station_arrival_status", [
  "PENDING",   // Checked in at reception, not yet at this desk
  "ARRIVED",   // Standing in queue at this desk
  "COMPLETED", // Test finished
  "SKIPPED",   // Intentionally bypassed
  "NA",        // Not contracted for this employee
]);

// 2. Clients & Agencies
export const clients = pgTable("clients", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  code: text("code").notNull().unique(),
  contactPerson: text("contact_person"),
  contactDesignation: text("contact_designation"),
  contactDepartment: text("contact_department"),
  email: text("email"),
  phone: text("phone"),
  address: text("address"),
  totalStrength: text("total_strength"),
  campMonth: text("camp_month"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const agencies = pgTable("agencies", {
  id: text("id").primaryKey(),
  clientId: text("client_id").references(() => clients.id).notNull(),
  name: text("name").notNull(),
  code: text("code").notNull(),
  contactPhone: text("contact_phone"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// 3. Dynamic Services & Packages
export const services = pgTable("services", {
  id: text("id").primaryKey(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  station: stationTypeEnum("station").notNull(),
  schemaDefinition: jsonb("schema_definition").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
});

export const clientPackages = pgTable("client_packages", {
  id: text("id").primaryKey(),
  clientId: text("client_id").references(() => clients.id).notNull(),
  name: text("name").notNull(),
  activeServiceIds: jsonb("active_service_ids").$type<string[]>().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// 4. Camps
export const camps = pgTable("camps", {
  id: text("id").primaryKey(),
  clientId: text("client_id").references(() => clients.id).notNull(),
  packageId: text("package_id").references(() => clientPackages.id).notNull(),
  name: text("name").notNull(),
  location: text("location").notNull(),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  status: text("status").default("ACTIVE").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const uhidSequence = pgTable("uhid_sequence", {
  year: integer("year").primaryKey(),
  currentVal: integer("current_val").default(0).notNull(),
});

// 5. Employees: Multi-Hazard Profiling, Pre-Reg & Vitals Division
export const employees = pgTable(
  "employees",
  {
    id: text("id").primaryKey(),
    uhid: text("uhid").notNull().unique(),
    clientId: text("client_id").references(() => clients.id).notNull(),
    agencyId: text("agency_id").references(() => agencies.id),
    campId: text("camp_id").references(() => camps.id),
    empCode: text("emp_code").notNull(),
    fullName: text("full_name").notNull(),
    gender: text("gender").notNull(),
    dob: date("dob"),
    age: integer("age").notNull(),
    department: text("department"),
    designation: text("designation"),
    hazardProfile: text("hazard_profile").default("ROUTINE"),
    assignedServiceIds: jsonb("assigned_service_ids").$type<string[]>(),
    phone: text("phone"),
    email: text("email"),
    bloodGroup: text("blood_group"),
    photoUrl: text("photo_url"),
    barcode: text("barcode"),
    pastHistory: text("past_history"),
    coMorbidities: text("co_morbidities"),

    // Phlebotomy Barcode & Container Tracking (1-Barcode-to-1-Employee Lock)
    labKitBarcode: text("lab_kit_barcode"),
    barcodeLocked: boolean("barcode_locked").default(false).notNull(),
    bloodCollected: boolean("blood_collected").default(false).notNull(),
    urineCollected: boolean("urine_collected").default(false).notNull(),
    specialContainerRequired: boolean("special_container_required").default(false).notNull(),
    specialContainerName: text("special_container_name"),
    specialContainerCollected: boolean("special_container_collected").default(false).notNull(),
    samplesCollectedAt: timestamp("samples_collected_at"),

    // Lab Handover Verification (Camp -> Rider -> Lab)
    handoverVerified: boolean("handover_verified").default(false).notNull(),
    handoverVerifiedAt: timestamp("handover_verified_at"),
    handoverRiderName: text("handover_rider_name"),
    handoverPhleboName: text("handover_phlebo_name"),

    // Reception Vitals (Locked to Reception)
    heightCm: text("height_cm"),
    weightKg: text("weight_kg"),
    bmi: text("bmi"),

    // Nurse Vitals
    nurseBpSystolic: text("nurse_bp_systolic"),
    nurseBpDiastolic: text("nurse_bp_diastolic"),
    nursePulseBpm: text("nurse_pulse_bpm"),
    nurseSpo2: text("nurse_spo2"),
    nurseVisionDistanceRight: text("nurse_vision_dist_right"),
    nurseVisionDistanceLeft: text("nurse_vision_dist_left"),
    nurseVisionNearRight: text("nurse_vision_near_right"),
    nurseVisionNearLeft: text("nurse_vision_near_left"),
    nurseColorVision: text("nurse_color_vision"),
    nurseRecordedAt: timestamp("nurse_recorded_at"),

    // Field Doctor Re-write Overrides (BP, Pulse, SpO2 only)
    doctorBpSystolic: text("doctor_bp_systolic"),
    doctorBpDiastolic: text("doctor_bp_diastolic"),
    doctorPulseBpm: text("doctor_pulse_bpm"),
    doctorSpo2: text("doctor_spo2"),
    doctorVitalsRewritten: boolean("doctor_vitals_rewritten").default(false).notNull(),

    // Camp Gate Check-In Status
    checkInStatus: text("check_in_status").default("PRE_REGISTERED").notNull(),
    checkedInAt: timestamp("checked_in_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    clientEmpIdx: uniqueIndex("client_emp_idx").on(table.clientId, table.empCode),
    uhidIdx: index("uhid_idx").on(table.uhid),
  })
);

// 6. Station Checklist: With "Mark as Arrived" State & Post-Save Edit Lock
export const stationChecklist = pgTable("station_checklist", {
  id: text("id").primaryKey(),
  employeeId: text("employee_id").references(() => employees.id).notNull(),
  campId: text("camp_id").references(() => camps.id).notNull(),
  station: stationTypeEnum("station").notNull(),
  status: text("status").default("PENDING").notNull(),
  arrivalStatus: stationArrivalStatusEnum("arrival_status").default("PENDING").notNull(),
  isLocked: boolean("is_locked").default(false).notNull(),
  arrivedAt: timestamp("arrived_at"),
  completedAt: timestamp("completed_at"),
  completedBy: text("completed_by"),
});

// 7. Diagnostic Records (Media captures, file uploads, reports)
export const diagnosticRecords = pgTable("diagnostic_records", {
  id: text("id").primaryKey(),
  employeeId: text("employee_id").references(() => employees.id).notNull(),
  campId: text("camp_id").references(() => camps.id).notNull(),
  serviceId: text("service_id"),
  serviceCode: text("service_code").default("SRV_GENERAL").notNull(),
  station: stationTypeEnum("station").notNull(),
  structuredData: jsonb("structured_data").notNull(),
  findingsSummary: text("findings_summary"),
  isAbnormal: boolean("is_abnormal").default(false).notNull(),
  attachmentUrls: jsonb("attachment_urls").$type<string[]>().default([]).notNull(),
  capturedAfterCamp: boolean("captured_after_camp").default(false).notNull(),
  extractedViaOcr: boolean("extracted_via_ocr").default(false).notNull(),
  enteredBy: text("entered_by").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// 8. On-Field Doctor Physical Examination ONLY
export const fieldDoctorExams = pgTable("field_doctor_exams", {
  id: text("id").primaryKey(),
  employeeId: text("employee_id").references(() => employees.id).notNull().unique(),
  campId: text("camp_id").references(() => camps.id).notNull(),
  doctorId: text("doctor_id").notNull(),
  doctorName: text("doctor_name").notNull(),
  entFinding: text("ent_finding").default("Normal").notNull(),
  oralFinding: text("oral_finding").default("Normal, Good Oral Hygiene").notNull(),
  headNeckFinding: text("head_neck_finding").default("Normal, No Lymphadenopathy").notNull(),
  cvsFinding: text("cvs_finding").default("S1 S2 Normal, No Murmurs").notNull(),
  rsFinding: text("rs_finding").default("Bilateral Vesicular Breath Sounds Clear").notNull(),
  abdomenFinding: text("abdomen_finding").default("Soft, No Organomegaly").notNull(),
  cnsFinding: text("cns_finding").default("Reflexes Intact, Normal").notNull(),
  musculoskeletal: text("musculoskeletal").default("Spine and joints range of motion normal").notNull(),
  skinInspection: text("skin_inspection").default("Normal, No occupational dermatosis").notNull(),
  herniaHydrocele: text("hernia_hydrocele").default("Absent").notNull(),
  clinicalRemarks: text("clinical_remarks"),
  examinedAt: timestamp("examined_at").defaultNow().notNull(),
});

// 9. Doctor Reviews (Office Doctor & Final Legal Fitness Sign-Off)
export const doctorReviews = pgTable("doctor_reviews", {
  id: text("id").primaryKey(),
  employeeId: text("employee_id").references(() => employees.id).notNull().unique(),
  campId: text("camp_id").references(() => camps.id).notNull(),
  doctorId: text("doctor_id").notNull(),
  doctorName: text("doctor_name").notNull(),
  doctorRegNo: text("doctor_reg_no").notNull(),

  // Panel-Specific Clinical Remarks (Office Doctor)
  vitalsRemark: text("vitals_remark"),
  labRemark: text("lab_remark"),
  xrayRemark: text("xray_remark"),
  pftRemark: text("pft_remark"),
  audioRemark: text("audio_remark"),
  fieldDoctorExamRemark: text("field_doctor_exam_remark"),

  // Final Regulatory Determination
  fitnessStatus: fitnessStatusEnum("fitness_status").notNull(),
  followUpDate: date("follow_up_date"),
  clinicalNotes: text("clinical_notes"),
  systemicExamination: jsonb("systemic_examination"),
  recommendations: text("recommendations"),
  doctorSignatureUrl: text("doctor_signature_url"),
  isSigned: boolean("is_signed").default(false).notNull(),
  signedAt: timestamp("signed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// 10. MRD Dossiers & Archival
export const mrdDossiers = pgTable("mrd_dossiers", {
  id: text("id").primaryKey(),
  employeeId: text("employee_id").references(() => employees.id).notNull().unique(),
  campId: text("camp_id").references(() => camps.id).notNull(),
  clientId: text("client_id").references(() => clients.id).notNull(),
  agencyId: text("agency_id").references(() => agencies.id),
  consolidatedPdfUrl: text("consolidated_pdf_url"),
  idCardPdfUrl: text("id_card_pdf_url"),
  physicalFileLocation: text("physical_file_location"),
  archivedStatus: text("archived_status").default("DIGITAL_READY").notNull(),
  lastAuditedAt: timestamp("last_audited_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// 11. Phlebotomy Bulk Handovers (Camp -> Rider -> Lab)
export const phlebotomyHandovers = pgTable("phlebotomy_handovers", {
  id: text("id").primaryKey(),
  campId: text("camp_id").references(() => camps.id).notNull(),
  phleboName: text("phlebo_name").notNull(),
  riderName: text("rider_name").notNull(),
  handoverType: text("handover_type").default("CAMP_TO_RIDER").notNull(),
  totalVerifiedCount: integer("total_verified_count").default(0).notNull(),
  verifiedEmployeeIds: jsonb("verified_employee_ids").$type<string[]>().default([]).notNull(),
  notes: text("notes"),
  handedOverAt: timestamp("handed_over_at").defaultNow().notNull(),
});

// 12. Camp Coordinator Correction & Unlock Requests
export const correctionRequests = pgTable("correction_requests", {
  id: text("id").primaryKey(),
  campId: text("camp_id").references(() => camps.id).notNull(),
  employeeId: text("employee_id").references(() => employees.id).notNull(),
  station: stationTypeEnum("station").notNull(),
  requestedBy: text("requested_by").notNull(),
  requestedByRole: text("requested_by_role").notNull(),
  reason: text("reason").notNull(),
  status: text("status").default("PENDING").notNull(),
  resolvedBy: text("resolved_by"),
  resolutionNote: text("resolution_note"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  resolvedAt: timestamp("resolved_at"),
});

// 13. System Users (RBAC + Per-Station Diagnostic Technician Scoping)
export const users = pgTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: roleEnum("role").default("RECEPTIONIST").notNull(),
  assignedClientId: text("assigned_client_id").references(() => clients.id),
  assignedStation: stationTypeEnum("assigned_station"),
  failedAttempts: integer("failed_attempts").default(0).notNull(),
  lockedUntil: timestamp("locked_until"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// 14. System Settings & Audit Logs
export const systemSettings = pgTable("system_settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const auditLogs = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  userRole: text("user_role").notNull(),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id").notNull(),
  previousState: jsonb("previous_state"),
  newState: jsonb("new_state"),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});