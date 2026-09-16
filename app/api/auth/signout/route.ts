import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/firebase/admin";
import {
  SESSION_COOKIE,
  sessionCookieOptions,
} from "@/lib/auth/session";

export async function POST() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE)?.value;

  // Clear the cookie first and unconditionally. Whatever happens with the
  // token revocation below, the browser must end up signed out — a failed
  // sign-out that leaves someone logged in at a shared front desk is the
  // worst outcome here.
  cookieStore.set({ ...sessionCookieOptions(0), value: "" });

  if (sessionCookie) {
    try {
      const decoded = await adminAuth().verifySessionCookie(sessionCookie);
      // Revoking refresh tokens is what makes `checkRevoked: true` in
      // getCurrentUser() end the session on every other device too.
      await adminAuth().revokeRefreshTokens(decoded.sub);
    } catch {
      // Already expired or revoked. The cookie is cleared either way.
    }
  }

  return NextResponse.json({ ok: true });
}
