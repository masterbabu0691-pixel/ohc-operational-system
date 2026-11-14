// src/middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "ohc-super-secure-production-jwt-secret-key-32chars"
);

// Inside src/middleware.ts

const ROLE_PERMISSIONS: Record<string, string[]> = {
  SUPER_ADMIN: [
    "/", 
    "/clients", 
    "/camps", 
    "/reception", 
    "/nurse", 
    "/phlebotomy", 
    "/diagnostics", 
    "/doctor", 
    "/mrd", 
    "/admin"
  ],
  FIELD_DOCTOR: ["/", "/doctor/field", "/diagnostics"],
  OFFICE_DOCTOR: ["/", "/doctor/office", "/diagnostics", "/mrd"],
  DOCTOR_EXAMINER: ["/", "/doctor", "/diagnostics"],
  NURSE: ["/", "/nurse"],
  RECEPTIONIST: ["/", "/reception", "/camps"],
  PHLEBOTOMIST: ["/", "/phlebotomy"],
  LAB_TECHNICIAN: ["/", "/phlebotomy", "/diagnostics"],
  DIAGNOSTIC_TECHNICIAN: ["/", "/diagnostics"],
  MRD_OFFICER: ["/", "/mrd"],
  CLIENT_HR: ["/", "/mrd"],
};
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith("/login") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon.ico") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  const token = request.cookies.get("ohc_session")?.value;

  if (!token) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    const userRole = (payload.role as string) || "RECEPTIONIST";

    const allowedPrefixes = ROLE_PERMISSIONS[userRole] || ["/"];
    const isAllowed = allowedPrefixes.some((prefix) =>
      prefix === "/" ? pathname === "/" : pathname.startsWith(prefix)
    );

    if (!isAllowed) {
      const defaultLanding = allowedPrefixes[1] || "/";
      return NextResponse.redirect(new URL(defaultLanding, request.url));
    }

    return NextResponse.next();
  } catch (err) {
    const response = NextResponse.redirect(new URL("/login", request.url));
    response.cookies.delete("ohc_session");
    return response;
  }
}

export const config = {
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico).*)"],
};