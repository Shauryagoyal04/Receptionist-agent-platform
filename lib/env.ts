import "server-only";

import { z } from "zod";

/*
 * Server-side environment, parsed once and loudly.
 *
 * A missing connection string should fail at the first request with a
 * sentence naming the variable, not as an opaque driver timeout. Client-side
 * variables are not parsed here: `NEXT_PUBLIC_*` values must be referenced as
 * literal `process.env.X` expressions for Next.js to inline them at build
 * time.
 */
const serverEnvSchema = z.object({
  MONGODB_URI: z
    .string()
    .min(1, "MONGODB_URI is required")
    .refine(
      (value) => value.startsWith("mongodb://") || value.startsWith("mongodb+srv://"),
      "MONGODB_URI must start with mongodb:// or mongodb+srv://",
    ),
  // The same database the agent writes to, so the console can read
  // appointments, doctors and the clinic record live.
  MONGODB_DB: z.string().min(1).default("clinic"),

  AUTH_SECRET: z
    .string()
    .min(32, "AUTH_SECRET must be at least 32 characters — generate one with `openssl rand -base64 32`"),

  AUTH_GOOGLE_ID: z.string().default(""),
  AUTH_GOOGLE_SECRET: z.string().default(""),

  DEFAULT_CLINIC_ID: z.string().min(1).default("main-clinic"),
  DEFAULT_CLINIC_TIMEZONE: z.string().min(1).default("Asia/Kolkata"),
  SIGNUP_ALLOWED_DOMAINS: z.string().default(""),
  INGEST_API_KEY: z.string().default(""),
});

export type ServerEnv = z.infer<typeof serverEnvSchema> & {
  /** Parsed form of SIGNUP_ALLOWED_DOMAINS. Empty means "allow any domain". */
  signupAllowedDomains: string[];
  /** Whether Google sign-in is configured; the button is hidden when not. */
  googleEnabled: boolean;
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

  cached = {
    ...parsed.data,
    signupAllowedDomains,
    googleEnabled:
      parsed.data.AUTH_GOOGLE_ID.length > 0 &&
      parsed.data.AUTH_GOOGLE_SECRET.length > 0,
  };
  return cached;
}
