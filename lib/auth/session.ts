import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";

import { adminAuth } from "@/lib/firebase/admin";
import { getUserById } from "@/lib/data/users";
import type { AppUser } from "@/lib/types";

export const SESSION_COOKIE = "__session";

/** Firebase caps session cookies at 14 days, which is also what we want. */
export const SESSION_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;

export type SessionUser = AppUser;

/**
 * Resolves the signed-in user, or null.
 *
 * This is the real authentication boundary. `proxy.ts` only checks that a
 * cookie is present so it can redirect quickly; it deliberately does not
 * verify anything. Every Server Component, Route Handler and Server Action
 * that reads or writes clinic data must call this and handle null.
 *
 * `checkRevoked: true` costs a round trip to Firebase but means signing out
 * on one device actually ends the session everywhere, which matters on shared
 * front-desk machines.
 *
 * Wrapped in React `cache()` so a request that checks the session in a layout
 * and again in a nested component pays for it once.
 */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE)?.value;
  if (!sessionCookie) return null;

  try {
    const decoded = await adminAuth().verifySessionCookie(sessionCookie, true);
    return await getUserById(decoded.uid);
  } catch (error) {
    if (isRejectedCookie(error)) {
      // Expired, revoked or tampered-with. All of these mean "signed out";
      // the stale cookie is cleared by the sign-out route or overwritten on
      // the next successful sign-in.
      return null;
    }
    // Anything else — missing service account credentials, an unreachable
    // Firebase, a broken private key — is a server fault, not a signed-out
    // user. Swallowing it here would bounce everyone to /login forever with
    // no clue why, so let the error boundary say what actually broke.
    throw error;
  }
});

/** Firebase's codes for "this cookie is no good", as opposed to a server fault. */
const REJECTED_COOKIE_CODES = new Set([
  "auth/session-cookie-expired",
  "auth/session-cookie-revoked",
  "auth/invalid-session-cookie",
  "auth/argument-error",
  "auth/user-disabled",
  "auth/user-not-found",
  "auth/id-token-expired",
  "auth/id-token-revoked",
]);

function isRejectedCookie(error: unknown): boolean {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof (error as { code: unknown }).code === "string"
  ) {
    return REJECTED_COOKIE_CODES.has((error as { code: string }).code);
  }
  return false;
}

/** Cookie options shared by the session and sign-out routes. */
export function sessionCookieOptions(maxAgeSeconds: number) {
  return {
    name: SESSION_COOKIE,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: maxAgeSeconds,
  };
}
