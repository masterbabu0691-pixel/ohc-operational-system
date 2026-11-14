// src/db/seed.ts
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { db } from "./index";
import { services } from "./schema";

async function seedMasterServices() {
  console.log("Seeding default occupational health services...");

  const defaultServices = [
    {
      id: "srv_vitals",
      code: "SRV_VITALS",
      name: "Vitals & Anthropometry",
      station: "VITALS_ANTHROPOMETRY" as const,
      schemaDefinition: {
        fields: ["height_cm", "weight_kg", "bmi", "pulse_bpm", "bp_systolic", "bp_diastolic", "spo2_percent"]
      },
      isActive: true,
    },
    {
      id: "srv_vision",
      code: "SRV_VISION",
      name: "Vision Screening",
      station: "VISION_SCREENING" as const,
      schemaDefinition: {
        fields: ["distance_right", "distance_left", "near_right", "near_left", "color_blindness"]
      },
      isActive: true,
    },
    {
      id: "srv_audiometry",
      code: "SRV_AUDIO",
      name: "Pure Tone Audiometry",
      station: "AUDIOMETRY" as const,
      schemaDefinition: {
        frequencies_hz: [500, 1000, 2000, 4000, 6000, 8000],
        ears: ["left", "right"]
      },
      isActive: true,
    },
    {
      id: "srv_spirometry",
      code: "SRV_PFT",
      name: "Spirometry / PFT",
      station: "SPIROMETRY_PFT" as const,
      schemaDefinition: {
        fields: ["fvc_predicted", "fvc_measured", "fev1_predicted", "fev1_measured", "ratio_percent", "interpretation"]
      },
      isActive: true,
    },
    {
      id: "srv_xray",
      code: "SRV_XRAY",
      name: "Chest X-Ray (PA View)",
      station: "CHEST_XRAY" as const,
      schemaDefinition: {
        fields: ["film_size", "findings", "impression", "image_url"]
      },
      isActive: true,
    },
    {
      id: "srv_ecg",
      code: "SRV_ECG",
      name: "12-Lead Resting ECG",
      station: "ECG" as const,
      schemaDefinition: {
        fields: ["heart_rate", "rhythm", "st_t_changes", "axis", "impression", "image_url"]
      },
      isActive: true,
    },
    {
      id: "srv_cbc",
      code: "SRV_CBC",
      name: "Complete Blood Count (CBC)",
      station: "PATHOLOGY_LAB" as const,
      schemaDefinition: {
        fields: ["hemoglobin", "rbc_count", "wbc_count", "platelet_count"]
      },
      isActive: true,
    },
    {
      id: "srv_blood_sugar",
      code: "SRV_BS",
      name: "Fasting Blood Sugar",
      station: "PATHOLOGY_LAB" as const,
      schemaDefinition: {
        fields: ["fasting_glucose_mg_dl"]
      },
      isActive: true,
    },
    {
      id: "srv_doctor_exam",
      code: "SRV_DOC_EXAM",
      name: "Doctor Systemic Exam & Fitness",
      station: "DOCTOR_EXAMINATION" as const,
      schemaDefinition: {
        fields: ["systemic_cvs", "systemic_rs", "systemic_abdomen", "systemic_cns", "fitness_status"]
      },
      isActive: true,
    }
  ];

  for (const srv of defaultServices) {
    await db.insert(services).values(srv).onConflictDoNothing();
  }

  console.log("Master services successfully populated in Neon.");
  process.exit(0);
}

seedMasterServices().catch((err) => {
  console.error("Seeding failed:", err);
  process.exit(1);
});