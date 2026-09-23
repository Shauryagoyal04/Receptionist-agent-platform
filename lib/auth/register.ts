"use server";

import { hash } from "bcryptjs";
import { z } from "zod";

import { isAllowedDomain } from "@/lib/auth/config";
import { getServerEnv } from "@/lib/env";
import { createPasswordUser, findUserByEmail } from "@/lib/data/users";

/*
 * Sign-up.
 *
 * Auth.js has no notion of registration — the Credentials provider only
 * verifies an existing account — so account creation is this Server Action.
 * It is a public endpoint by definition, which is why the domain allowlist is
 * enforced here as well as in the Google sign-in callback.
 */

const BCRYPT_ROUNDS = 12;

const registerSchema = z.object({
  name: z.string().trim().min(1, "Enter your name.").max(120),
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
  password: z
    .string()
    .min(8, "Use at least 8 characters.")
    .max(200, "That password is too long."),
});

export type RegisterResult = { ok: true } | { ok: false; error: string };

export async function registerUser(input: {
  name: string;
  email: string;
  password: string;
}): Promise<RegisterResult> {
  const parsed = registerSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Check the form and try again.",
    };
  }

  const { name, email, password } = parsed.data;

  if (!isAllowedDomain(email)) {
    const list = getServerEnv()
      .signupAllowedDomains.map((domain) => `@${domain}`)
      .join(", ");
    return {
      ok: false,
      error: `Accounts are limited to ${list}. Ask an admin if you need access.`,
    };
  }

  const existing = await findUserByEmail(email);
  if (existing) {
    return {
      ok: false,
      error: "An account with this email already exists. Sign in instead.",
    };
  }

  try {
    await createPasswordUser({
      email,
      displayName: name,
      passwordHash: await hash(password, BCRYPT_ROUNDS),
    });
  } catch (error) {
    // The unique index on email is the real guard against two simultaneous
    // sign-ups; the check above is only there to give a nicer message first.
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code: unknown }).code === 11000
    ) {
      return {
        ok: false,
        error: "An account with this email already exists. Sign in instead.",
      };
    }
    console.error("[auth] registerUser failed", error);
    return { ok: false, error: "Couldn't create that account. Try again." };
  }

  return { ok: true };
}
