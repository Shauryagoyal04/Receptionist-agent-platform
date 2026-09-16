import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { getServerEnv } from "@/lib/env";
import { adminAuth } from "@/lib/firebase/admin";
import { getUserById, upsertUserOnLogin } from "@/lib/data/users";
import {
  SESSION_MAX_AGE_MS,
  sessionCookieOptions,
} from "@/lib/auth/session";

const bodySchema = z.object({
  idToken: z.string().min(1),
  /**
   * Signup is gated by domain and, on rejection, the just-created Firebase
   * Auth user is deleted. Sign-in is gated too but never deletes, so that
   * removing a domain from the allowlist locks existing staff out rather
   * than destroying their accounts.
   */
  intent: z.enum(["signin", "signup"]).default("signin"),
});

function domainOf(email: string | undefined): string | null {
  if (!email) return null;
  const at = email.lastIndexOf("@");
  if (at === -1 || at === email.length - 1) return null;
  return email.slice(at + 1).toLowerCase();
}

export async function POST(request: NextRequest) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Expected a JSON body." },
      { status: 400 },
    );
  }

  const parsed = bodySchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Missing or malformed sign-in token." },
      { status: 400 },
    );
  }

  const { idToken, intent } = parsed.data;
  const auth = adminAuth();
  const env = getServerEnv();

  let decoded;
  try {
    decoded = await auth.verifyIdToken(idToken, true);
  } catch {
    return NextResponse.json(
      { error: "That sign-in attempt expired. Try again." },
      { status: 401 },
    );
  }

  // --- Domain allowlist -------------------------------------------------
  const allowed = env.signupAllowedDomains;
  if (allowed.length > 0) {
    const domain = domainOf(decoded.email);
    if (domain === null || !allowed.includes(domain)) {
      if (intent === "signup") {
        // Delete the account Firebase just created so the address is not
        // burned and cannot be used to sit in a half-registered state.
        // Only ever delete an account that has no user document yet — an
        // established user must never be destroyed by an allowlist change.
        try {
          const existing = await getUserById(decoded.uid);
          if (existing === null) await auth.deleteUser(decoded.uid);
        } catch (error) {
          console.error(
            `[auth] could not clean up rejected signup ${decoded.uid}`,
            error,
          );
        }
      }

      const list = allowed.map((domain) => `@${domain}`).join(", ");
      return NextResponse.json(
        {
          error: `Accounts are limited to ${list}. Ask an admin if you need access.`,
        },
        { status: 403 },
      );
    }
  }

  // --- Mint the session -------------------------------------------------
  let sessionCookie: string;
  try {
    sessionCookie = await auth.createSessionCookie(idToken, {
      expiresIn: SESSION_MAX_AGE_MS,
    });
  } catch (error) {
    console.error("[auth] createSessionCookie failed", error);
    return NextResponse.json(
      { error: "Couldn't start your session. Try again." },
      { status: 500 },
    );
  }

  try {
    await upsertUserOnLogin({
      uid: decoded.uid,
      email: decoded.email ?? null,
      displayName: decoded.name ?? null,
      photoURL: decoded.picture ?? null,
    });
  } catch (error) {
    console.error("[auth] user upsert failed", error);
    return NextResponse.json(
      { error: "Signed in, but your profile couldn't be saved. Try again." },
      { status: 500 },
    );
  }

  const cookieStore = await cookies();
  cookieStore.set({
    ...sessionCookieOptions(SESSION_MAX_AGE_MS / 1000),
    value: sessionCookie,
  });

  return NextResponse.json({ ok: true });
}
