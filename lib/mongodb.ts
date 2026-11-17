import "server-only";

import { MongoClient, type Db, type MongoClientOptions } from "mongodb";

import { getServerEnv } from "@/lib/env";

/*
 * One MongoClient for the whole process.
 *
 * The driver maintains its own connection pool, so creating a second client
 * per request would exhaust Atlas connection limits fast. In development
 * Next.js reloads modules on every edit, which would leak a client per reload
 * — hence the global cache, which is the pattern the driver's own Next.js
 * guidance recommends.
 *
 * This is the same database the agent writes to. The console owns the
 * `conversations` and Auth.js collections; `appointments`, `doctors`,
 * `patients`, `clinic` and `transcripts` belong to the agent and are only
 * ever read from here.
 */

/**
 * How long to wait for a usable server before giving up.
 *
 * The default of 30s hangs a page render; 8s turned out to be too tight on a
 * weak link (a phone hotspot regularly stalls past it), and the failure then
 * looks like an application bug rather than a network one. 20s is long enough
 * to ride out a stall and short enough that a genuinely unreachable database
 * still fails visibly. Override with MONGODB_TIMEOUT_MS if needed.
 */
const SERVER_SELECTION_TIMEOUT_MS = Number.parseInt(
  process.env.MONGODB_TIMEOUT_MS ?? "20000",
  10,
);

const options: MongoClientOptions = {
  serverSelectionTimeoutMS: Number.isFinite(SERVER_SELECTION_TIMEOUT_MS)
    ? SERVER_SELECTION_TIMEOUT_MS
    : 20000,
  retryWrites: true,
  retryReads: true,
};

declare global {
  var __mongoClientPromise: Promise<MongoClient> | undefined;
}

/**
 * Connects, and forgets the attempt if it fails.
 *
 * Caching the promise is what keeps one connection pool per process, but a
 * *rejected* promise must not stay cached: every later request would await the
 * same rejection and the app would never recover from a transient blip, even
 * once the network came back. Clearing the slot on failure means the next
 * request tries again.
 */
function createClientPromise(): Promise<MongoClient> {
  const { MONGODB_URI } = getServerEnv();
  const promise = new MongoClient(MONGODB_URI, options).connect();

  promise.catch(() => {
    if (globalThis.__mongoClientPromise === promise) {
      globalThis.__mongoClientPromise = undefined;
    }
  });

  return promise;
}

export function getMongoClientPromise(): Promise<MongoClient> {
  globalThis.__mongoClientPromise ??= createClientPromise();
  return globalThis.__mongoClientPromise;
}

export async function getDb(): Promise<Db> {
  const client = await getMongoClientPromise();
  return client.db(getServerEnv().MONGODB_DB);
}

/** Collection names, in one place so a rename cannot drift across modules. */
export const COLLECTIONS = {
  /** Owned by the console. */
  conversations: "conversations",
  users: "users",
  /** Written by Auth.js for OAuth account linking. */
  accounts: "accounts",
  sessions: "sessions",
  verificationTokens: "verification_tokens",
  /** Owned by the agent — read only. */
  appointments: "appointments",
  doctors: "doctors",
  patients: "patients",
  clinic: "clinic",
  transcripts: "transcripts",
  /**
   * Shared with the agent (docs/staff-handoff-contract.md): the agent inserts
   * escalations and sends outbox jobs; the console claims/resolves escalations
   * and inserts `staff.reply` outbox jobs.
   */
  escalations: "escalations",
  outbox: "outbox",
} as const;
