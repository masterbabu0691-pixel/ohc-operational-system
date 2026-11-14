// src/lib/auth.ts
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "ohc-super-secure-production-jwt-secret-key-32chars"
);

export interface UserSession {
  userId: string;
  name: string;
  email: string;
  role: string;
  assignedClientId?: string | null;
}

// 1. Create secure HTTP-only encrypted session cookie
export async function createSession(user: UserSession) {
  const token = await new SignJWT({ ...user })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("8h") // 8-hour shift duration
    .sign(JWT_SECRET);

  const cookieStore = await cookies();
  cookieStore.set("ohc_session", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 8, // 8 hours
  });

  return token;
}

// 2. Read and verify active session
export async function getSession(): Promise<UserSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("ohc_session")?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as unknown as UserSession;
  } catch (err) {
    return null;
  }
}

// 3. Destroy session cookie on logout
export async function destroySession() {
  const cookieStore = await cookies();
  cookieStore.delete("ohc_session");
}