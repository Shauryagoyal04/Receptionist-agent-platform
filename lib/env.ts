import "server-only";

import { z } from "zod";

import { CHANNELS, type Channel } from "@/lib/types";

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

  /*
   * Capability flags.
   *
   * Voice and human handoff are fully modelled in the schema and the data
   * layer so that enabling them later is configuration rather than a
   * migration. These decide only what the UI surfaces today — a console that
   * shows a channel filter no conversation can match, or a "resolved without
   * a human" figure pinned at 100%, is worse than one that shows neither.
   */
  ENABLED_CHANNELS: z.string().default("whatsapp"),
  HUMAN_HANDOFF_ENABLED: z
    .string()
    .default("false")
    .transform((value) => value.trim().toLowerCase() === "true"),
});

/**
 * What this deployment actually supports today.
 *
 * Passed down from Server Components as props — there is no client-side env
 * access and no React context for it.
 */
export type Capabilities = {
  /** Channels that can currently occur. Defaults to WhatsApp alone. */
  enabledChannels: Channel[];
  /**
   * Whether the channel column, filter and analytics card are worth showing.
   * With one channel they are the same value repeated on every row.
   */
  showChannelUi: boolean;
  /**
   * Whether a human actually picks up a handoff.
   *
   * False does NOT mean patients stop asking — the agent still offers to pass
   * them to a person. It means nobody is notified, so the console frames
   * those conversations as an outstanding follow-up queue rather than as
   * something already handled.
   */
  handoffEnabled: boolean;
};

export type ServerEnv = z.infer<typeof serverEnvSchema> & {
  /** Parsed form of SIGNUP_ALLOWED_DOMAINS. Empty means "allow any domain". */
  signupAllowedDomains: string[];
  /** Whether Google sign-in is configured; the button is hidden when not. */
  googleEnabled: boolean;
  capabilities: Capabilities;
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

  const enabledChannels = parseEnabledChannels(parsed.data.ENABLED_CHANNELS);

  cached = {
    ...parsed.data,
    signupAllowedDomains,
    capabilities: {
      enabledChannels,
      showChannelUi: enabledChannels.length > 1,
      handoffEnabled: parsed.data.HUMAN_HANDOFF_ENABLED,
    },
    googleEnabled:
      parsed.data.AUTH_GOOGLE_ID.length > 0 &&
      parsed.data.AUTH_GOOGLE_SECRET.length > 0,
  };
  return cached;
}

/**
 * Reads ENABLED_CHANNELS, keeping only known channels.
 *
 * An unrecognised entry is dropped with a warning rather than throwing: a
 * typo in one deployment variable should not take the whole console down, and
 * falling back to WhatsApp is always safe because it is the only channel that
 * exists today.
 */
function parseEnabledChannels(raw: string): Channel[] {
  const known = new Set<string>(CHANNELS);
  const seen = new Set<Channel>();

  for (const entry of raw.split(",")) {
    const trimmed = entry.trim().toLowerCase();
    if (trimmed.length === 0) continue;
    if (known.has(trimmed)) {
      seen.add(trimmed as Channel);
    } else {
      console.warn(
        `[config] ENABLED_CHANNELS lists an unknown channel "${trimmed}". ` +
          `Known channels: ${CHANNELS.join(", ")}.`,
      );
    }
  }

  if (seen.size === 0) {
    console.warn(
      '[config] ENABLED_CHANNELS matched no known channel — falling back to "whatsapp".',
    );
    return ["whatsapp"];
  }

  return [...seen];
}
