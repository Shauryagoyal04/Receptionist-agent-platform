import "server-only";

import { z } from "zod";

/*
 * Server-side environment, parsed once and loudly.
 *
 * A missing Firebase credential should fail at the first request with a
 * sentence naming the variable, not as an opaque error from deep inside the
 * Admin SDK. Client-side variables are not parsed here: `NEXT_PUBLIC_*` values
 * must be referenced as literal `process.env.X` expressions for Next.js to
 * inline them at build time, so they live in `lib/firebase/client.ts`.
 */
const serverEnvSchema = z.object({
  FIREBASE_PROJECT_ID: z.string().min(1, "FIREBASE_PROJECT_ID is required"),
  FIREBASE_CLIENT_EMAIL: z.string().min(1, "FIREBASE_CLIENT_EMAIL is required"),
  FIREBASE_PRIVATE_KEY: z.string().min(1, "FIREBASE_PRIVATE_KEY is required"),
  DEFAULT_CLINIC_ID: z.string().min(1).default("main-clinic"),
  DEFAULT_CLINIC_TIMEZONE: z.string().min(1).default("Asia/Kolkata"),
  SIGNUP_ALLOWED_DOMAINS: z.string().default(""),
  INGEST_API_KEY: z.string().default(""),
});

export type ServerEnv = z.infer<typeof serverEnvSchema> & {
  /** Parsed form of SIGNUP_ALLOWED_DOMAINS. Empty means "allow any domain". */
  signupAllowedDomains: string[];
};

let cached: ServerEnv | null = null;

export function getServerEnv(): ServerEnv {
  if (cached) return cached;

  const parsed = serverEnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(
      `Invalid server environment. Copy .env.example to .env.local and fill in:\n${details}`,
    );
  }

  const signupAllowedDomains = parsed.data.SIGNUP_ALLOWED_DOMAINS.split(",")
    .map((domain) => domain.trim().toLowerCase())
    .filter((domain) => domain.length > 0);

  if (signupAllowedDomains.length === 0) {
    console.warn(
      "[auth] SIGNUP_ALLOWED_DOMAINS is empty — anyone with any email address " +
        "can create an account. Set it to your clinic's domain before deploying.",
    );
  }

  cached = { ...parsed.data, signupAllowedDomains };
  return cached;
}

/**
 * Vercel and most hosts store multi-line secrets with escaped newlines. The
 * Admin SDK needs the real thing, and surrounding quotes must go too.
 */
export function getFirebasePrivateKey(): string {
  const raw = getServerEnv().FIREBASE_PRIVATE_KEY;
  return raw.replace(/^["']|["']$/g, "").replace(/\\n/g, "\n");
}
