// src/db/index.ts
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL || process.env.DIRECT_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not defined in .env.local");
}

// Clean connection with no expiring static AbortSignal
const sql = neon(connectionString);

export const db = drizzle(sql, { schema });