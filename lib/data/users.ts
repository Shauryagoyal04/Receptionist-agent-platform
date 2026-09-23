import "server-only";

import { ObjectId, type Collection, type Document } from "mongodb";

import { COLLECTIONS, getDb } from "@/lib/mongodb";
import { getServerEnv } from "@/lib/env";
import { userRoleSchema, type UserRole } from "@/lib/types";

/*
 * The console's own user records, stored in the `users` collection that the
 * Auth.js MongoDB adapter also writes to. The adapter owns `name`, `email`,
 * `emailVerified` and `image`; the extra fields below are ours.
 */

export type AppUserRecord = {
  id: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  role: UserRole;
  clinicId: string;
  passwordHash: string | null;
};

async function users(): Promise<Collection<Document>> {
  return (await getDb()).collection(COLLECTIONS.users);
}

/** Emails are matched case-insensitively, so Priya@ and priya@ are one account. */
function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function toRecord(doc: Document): AppUserRecord {
  const role = userRoleSchema.safeParse(doc.role);
  return {
    id: String(doc._id),
    email: typeof doc.email === "string" ? doc.email : null,
    displayName: typeof doc.name === "string" ? doc.name : null,
    photoURL: typeof doc.image === "string" ? doc.image : null,
    // An unrecognized role must never widen access, so fall back to staff.
    role: role.success ? role.data : "staff",
    clinicId:
      typeof doc.clinicId === "string"
        ? doc.clinicId
        : getServerEnv().DEFAULT_CLINIC_ID,
    passwordHash: typeof doc.passwordHash === "string" ? doc.passwordHash : null,
  };
}

export async function findUserByEmail(
  email: string,
): Promise<AppUserRecord | null> {
  const doc = await (await users()).findOne({ email: normalizeEmail(email) });
  return doc ? toRecord(doc) : null;
}

export async function findUserById(id: string): Promise<AppUserRecord | null> {
  if (!ObjectId.isValid(id)) return null;
  const doc = await (await users()).findOne({ _id: new ObjectId(id) });
  return doc ? toRecord(doc) : null;
}

export async function markSignedIn(id: string): Promise<void> {
  if (!ObjectId.isValid(id)) return;
  await (await users()).updateOne(
    { _id: new ObjectId(id) },
    { $set: { lastLoginAt: new Date() } },
  );
}

/**
 * The first account created in the database becomes `admin`; everyone after is
 * `staff`.
 *
 * `countDocuments` with a limit of 1 is cheap, but two simultaneous first
 * sign-ups could still both read zero. The unique index on `email` means only
 * one insert wins, and the loser retries as a normal user, so the worst case
 * is a duplicate-key error rather than two admins.
 */
async function nextRole(collection: Collection<Document>): Promise<UserRole> {
  const existing = await collection.countDocuments({}, { limit: 1 });
  return existing === 0 ? "admin" : "staff";
}

export async function createPasswordUser(input: {
  email: string;
  displayName: string;
  passwordHash: string;
}): Promise<AppUserRecord> {
  const collection = await users();
  const email = normalizeEmail(input.email);
  const now = new Date();

  const role = await nextRole(collection);

  const result = await collection.insertOne({
    email,
    name: input.displayName,
    image: null,
    emailVerified: null,
    passwordHash: input.passwordHash,
    role,
    clinicId: getServerEnv().DEFAULT_CLINIC_ID,
    createdAt: now,
    lastLoginAt: now,
  });

  return {
    id: String(result.insertedId),
    email,
    displayName: input.displayName,
    photoURL: null,
    role,
    clinicId: getServerEnv().DEFAULT_CLINIC_ID,
    passwordHash: input.passwordHash,
  };
}

/**
 * Fills in the fields the Auth.js adapter does not know about after a Google
 * sign-in. Runs on every Google sign-in, but only sets `role` and `clinicId`
 * when they are missing, so an admin is never demoted by signing in again.
 */
export async function provisionOAuthUser(input: {
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}): Promise<void> {
  if (!input.email) return;
  const collection = await users();
  const email = normalizeEmail(input.email);
  const now = new Date();

  const existing = await collection.findOne({ email });

  if (!existing) {
    // The adapter inserts the user immediately after this callback, so write
    // a record it will merge with rather than racing it.
    const role = await nextRole(collection);
    await collection.updateOne(
      { email },
      {
        $set: {
          name: input.displayName,
          image: input.photoURL,
          lastLoginAt: now,
        },
        $setOnInsert: {
          email,
          emailVerified: null,
          passwordHash: null,
          role,
          clinicId: getServerEnv().DEFAULT_CLINIC_ID,
          createdAt: now,
        },
      },
      { upsert: true },
    );
    return;
  }

  const patch: Document = { lastLoginAt: now };
  if (input.displayName) patch.name = input.displayName;
  if (input.photoURL) patch.image = input.photoURL;
  if (typeof existing.role !== "string") patch.role = await nextRole(collection);
  if (typeof existing.clinicId !== "string") {
    patch.clinicId = getServerEnv().DEFAULT_CLINIC_ID;
  }

  await collection.updateOne({ email }, { $set: patch });
}

/** Indexes the console relies on. Created by `npm run db:setup`. */
export async function ensureUserIndexes(): Promise<void> {
  const collection = await users();
  await collection.createIndex(
    { email: 1 },
    { unique: true, sparse: true, name: "email_unique" },
  );
}
