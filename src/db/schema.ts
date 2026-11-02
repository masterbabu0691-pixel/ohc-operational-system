// src/db/schema.ts
import { pgTable, text, timestamp, boolean, integer, jsonb, pgEnum, serial, date, uniqueIndex, index } from "drizzle-orm/pg-core";

// 1. Roles & Status Enums
export const roleEnum = pgEnum("role", [
  "SUPER_ADMIN",
  "CLIENT_HR",
  "CAMP_COORDINATOR",
  "RECEPTIONIST",
  "PHLEBOTOMIST",
  "LAB_TECHNICIAN",
  "DIAGNOSTIC_TECHNICIAN",
  "DOCTOR_EXAMINER",
  "MRD_OFFICER"
]);

export const fitnessStatusEnum = pgEnum("fitness_status", [
  "PENDING",
  "FIT",
  "UNFIT",
  "TEMPORARILY_UNFIT_FOLLOW_UP"
]);

export const stationTypeEnum = pgEnum("station_type", [
  "REGISTRATION",
  "VITALS_ANTHROPOMETRY",
  "PHLEBOTOMY",
  "PATHOLOGY_LAB",
  "CHEST_XRAY",
  "ECG",
  "SPIROMETRY_PFT",
  "AUDIOMETRY",
  "VISION_SCREENING",
  "DOCTOR_EXAMINATION"
]);

// 2. Clients & Agencies
export const clients = pgTable("clients", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  code: text("code").notNull().unique(),
  contactPerson: text("contact_person"),
  email: text("email"),
  phone: text("phone"),
  address: text("address"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull()
});

export const agencies = pgTable("agencies", {
  id: text("id").primaryKey(),
  clientId: text("client_id").references(() => clients.id).notNull(),
  name: text("name").notNull(),
  code: text("code").notNull(),
  contactPhone: text("contact_phone"),
  createdAt: timestamp("created_at").defaultNow().notNull()
});

// 3. Dynamic Services & Client Packages
export const services = pgTable("services", {
  id: text("id").primaryKey(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  station: stationTypeEnum("station").notNull(),
  schemaDefinition: jsonb("schema_definition").notNull(),
  isActive: boolean("is_active").default(true).notNull()
});

export const clientPackages = pgTable("client_packages", {
  id: text("id").primaryKey(),
  clientId: text("client_id").references(() => clients.id).notNull(),
  name: text("name").notNull(),
  activeServiceIds: jsonb("active_service_ids").$type<string[]>().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull()
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
  status: text("status").default("SCHEDULED").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull()
});

// 5. Sequential UHID Sequence Tracker
export const uhidSequence = pgTable("uhid_sequence", {
  year: integer("year").primaryKey(),
  currentVal: integer("current_val").default(0).notNull()
});

// 6. Employees (Patients)
export const employees = pgTable("employees", {
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
  phone: text("phone"),
  email: text("email"),
  bloodGroup: text("blood_group"),
  photoUrl: text("photo_url"),
  barcode: text("barcode").unique(),
  checkInStatus: text("check_in_status").default("PRE_REGISTERED").notNull(),
  checkedInAt: timestamp("checked_in_at"),
  createdAt: timestamp("created_at").defaultNow().notNull()
}, (table) => ({
  clientEmpIdx: uniqueIndex("client_emp_idx").on(table.clientId, table.empCode),
  uhidIdx: index("uhid_idx").on(table.uhid)
}));

// 7. Station Checklist & Diagnostic Records
export const stationChecklist = pgTable("station_checklist", {
  id: text("id").primaryKey(),
  employeeId: text("employee_id").references(() => employees.id).notNull(),
  campId: text("camp_id").references(() => camps.id).notNull(),
  station: stationTypeEnum("station").notNull(),
  status: text("status").default("PENDING").notNull(),
  completedAt: timestamp("completed_at"),
  completedBy: text("completed_by")
});

export const diagnosticRecords = pgTable("diagnostic_records", {
  id: text("id").primaryKey(),
  employeeId: text("employee_id").references(() => employees.id).notNull(),
  campId: text("camp_id").references(() => camps.id).notNull(),
  serviceId: text("service_id").references(() => services.id).notNull(),
  station: stationTypeEnum("station").notNull(),
  structuredData: jsonb("structured_data").notNull(),
  findingsSummary: text("findings_summary"),
  isAbnormal: boolean("is_abnormal").default(false).notNull(),
  attachmentUrls: jsonb("attachment_urls").$type<string[]>().default([]).notNull(),
  extractedViaOcr: boolean("extracted_via_ocr").default(false).notNull(),
  enteredBy: text("entered_by").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

// 8. Doctor Fitness Reviews & Sign-Off
export const doctorReviews = pgTable("doctor_reviews", {
  id: text("id").primaryKey(),
  employeeId: text("employee_id").references(() => employees.id).notNull().unique(),
  campId: text("camp_id").references(() => camps.id).notNull(),
  doctorId: text("doctor_id").notNull(),
  doctorName: text("doctor_name").notNull(),
  doctorRegNo: text("doctor_reg_no").notNull(),
  fitnessStatus: fitnessStatusEnum("fitness_status").notNull(),
  followUpDate: date("follow_up_date"),
  clinicalNotes: text("clinical_notes"),
  systemicExamination: jsonb("systemic_examination"),
  recommendations: text("recommendations"),
  doctorSignatureUrl: text("doctor_signature_url"),
  isSigned: boolean("is_signed").default(false).notNull(),
  signedAt: timestamp("signed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull()
});

// 9. MRD Dossiers & Archival
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
  createdAt: timestamp("created_at").defaultNow().notNull()
});

// 10. System Audit Logs
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
  timestamp: timestamp("timestamp").defaultNow().notNull()
});