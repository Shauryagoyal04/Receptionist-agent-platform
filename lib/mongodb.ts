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

const options: MongoClientOptions = {
  // Fail fast with a clear error instead of hanging a page render.
  serverSelectionTimeoutMS: 8000,
  retryWrites: true,
};

declare global {
  var __mongoClientPromise: Promise<MongoClient> | undefined;
}

function createClientPromise(): Promise<MongoClient> {
  const { MONGODB_URI } = getServerEnv();
  return new MongoClient(MONGODB_URI, options).connect();
}

export function getMongoClientPromise(): Promise<MongoClient> {
  if (process.env.NODE_ENV === "production") {
    // No global in production: the module is evaluated once per instance.
    globalThis.__mongoClientPromise ??= createClientPromise();
    return globalThis.__mongoClientPromise;
  }
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
} as const;
