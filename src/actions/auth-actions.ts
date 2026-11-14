// src/actions/auth-actions.ts
"use server";

import { db } from "@/db";
import { users, auditLogs } from "@/db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { createSession, destroySession, getSession } from "@/lib/auth";
import { redirect } from "next/navigation";

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MINUTES = 30;

// 1. Strict Authenticated Login with 5-Attempt & 30-Min Lockout
export async function loginUser(email: string, passwordPlain: string) {
  try {
    const cleanEmail = email.toLowerCase().trim();

    // Fetch user record
    const userRecords = await db
      .select()
      .from(users)
      .where(eq(users.email, cleanEmail))
      .limit(1);

    if (userRecords.length === 0) {
      return { success: false, error: "Invalid email or password." };
    }

    const user = userRecords[0];

    if (!user.isActive) {
      return { success: false, error: "This staff account has been deactivated. Contact Super Admin." };
    }

    const isSuperAdmin = user.role === "SUPER_ADMIN";

    // Enforce 30-minute lock on non-admin staff
    if (!isSuperAdmin && user.lockedUntil) {
      const now = new Date();
      if (user.lockedUntil > now) {
        const remainingMinutes = Math.ceil(
          (user.lockedUntil.getTime() - now.getTime()) / (1000 * 60)
        );
        return {
          success: false,
          error: `Account ${user.email} is locked due to 5 consecutive failed attempts. Try again in ${remainingMinutes} minute(s).`,
          isLocked: true,
          lockedEmail: user.email,
          remainingMinutes,
        };
      } else {
        // Lockout expired: auto-heal and reset
        await db
          .update(users)
          .set({ failedAttempts: 0, lockedUntil: null })
          .where(eq(users.id, user.id));
      }
    }

    // Verify Password Hash
    const isPasswordValid = await bcrypt.compare(passwordPlain, user.passwordHash);

    if (!isPasswordValid) {
      if (isSuperAdmin) {
        return { success: false, error: "Invalid credentials." };
      }

      const currentAttempts = user.failedAttempts + 1;

      // Lock on 5th failure
      if (currentAttempts >= MAX_FAILED_ATTEMPTS) {
        const lockUntilDate = new Date(Date.now() + LOCKOUT_DURATION_MINUTES * 60 * 1000);

        await db
          .update(users)
          .set({
            failedAttempts: currentAttempts,
            lockedUntil: lockUntilDate,
          })
          .where(eq(users.id, user.id));

        // Audit log security lockout event
        await db.insert(auditLogs).values({
          userId: user.id,
          userRole: user.role,
          action: "SECURITY_LOCKOUT_TRIGGERED",
          entityType: "USER",
          entityId: user.email,
        });

        return {
          success: false,
          error: `Security Lockout: 5 failed attempts reached. Account ${user.email} is locked for 30 minutes.`,
          isLocked: true,
          lockedEmail: user.email,
          remainingMinutes: LOCKOUT_DURATION_MINUTES,
        };
      } else {
        await db
          .update(users)
          .set({ failedAttempts: currentAttempts })
          .where(eq(users.id, user.id));

        const attemptsLeft = MAX_FAILED_ATTEMPTS - currentAttempts;
        return {
          success: false,
          error: `Invalid credentials. ${attemptsLeft} attempt(s) remaining before 30-minute security lockout.`,
        };
      }
    }

    // Login Succeeded: Reset attempts & initialize secure session
    await db
      .update(users)
      .set({ failedAttempts: 0, lockedUntil: null })
      .where(eq(users.id, user.id));

    await createSession({
      userId: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      assignedClientId: user.assignedClientId,
    });

    await db.insert(auditLogs).values({
      userId: user.id,
      userRole: user.role,
      action: "LOGIN_SUCCESS",
      entityType: "AUTH",
      entityId: user.id,
    });

    return { success: true, role: user.role };
  } catch (err: any) {
    console.error("Login action error:", err);
    return { success: false, error: "Authentication system error." };
  }
}

// 2. Strict In-App Unlock (Only callable by active Super Admin session)
export async function secureUnlockAccount(targetEmail: string) {
  try {
    const session = await getSession();

    // Boundary check: strictly verify caller is Super Admin
    if (!session || session.role !== "SUPER_ADMIN") {
      return {
        success: false,
        error: "Unauthorized: Only an authenticated Super Administrator can reset account locks.",
      };
    }

    const cleanEmail = targetEmail.toLowerCase().trim();

    await db
      .update(users)
      .set({
        failedAttempts: 0,
        lockedUntil: null,
      })
      .where(eq(users.email, cleanEmail));

    await db.insert(auditLogs).values({
      userId: session.userId,
      userRole: session.role,
      action: "ADMIN_MANUAL_ACCOUNT_UNLOCK",
      entityType: "USER",
      entityId: cleanEmail,
    });

    return { success: true };
  } catch (err: any) {
    console.error("Secure unlock error:", err);
    return { success: false, error: "Failed to unlock account." };
  }
}

// 3. Secure Logout
export async function logoutUser() {
  await destroySession();
  redirect("/login");
}

// 4. Default Accounts Initializer
export async function seedInitialAdmin() {
  try {
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash("Admin@123", salt);

    // Super Admin
    await db
      .insert(users)
      .values({
        id: "usr_superadmin",
        name: "Super Administrator",
        email: "admin@ohc.com",
        passwordHash: hash,
        role: "SUPER_ADMIN",
        isActive: true,
      })
      .onConflictDoUpdate({
        target: users.email,
        set: { passwordHash: hash, failedAttempts: 0, lockedUntil: null },
      });

    // Doctor
    await db
      .insert(users)
      .values({
        id: "usr_doctor",
        name: "Dr. S. Mukherjee, MBBS, AFIH",
        email: "doctor@ohc.com",
        passwordHash: hash,
        role: "DOCTOR_EXAMINER",
        isActive: true,
      })
      .onConflictDoUpdate({
        target: users.email,
        set: { passwordHash: hash, failedAttempts: 0, lockedUntil: null },
      });

    // Receptionist
    await db
      .insert(users)
      .values({
        id: "usr_reception",
        name: "Camp Receptionist",
        email: "reception@ohc.com",
        passwordHash: hash,
        role: "RECEPTIONIST",
        isActive: true,
      })
      .onConflictDoUpdate({
        target: users.email,
        set: { passwordHash: hash, failedAttempts: 0, lockedUntil: null },
      });

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}