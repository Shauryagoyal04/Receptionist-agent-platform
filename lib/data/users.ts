import "server-only";

import { FieldValue, Timestamp } from "firebase-admin/firestore";

import { adminDb } from "@/lib/firebase/admin";
import { getServerEnv } from "@/lib/env";
import { appUserSchema, type AppUser } from "@/lib/types";

const USERS = "users";
const CLINICS = "clinics";

export async function getUserById(uid: string): Promise<AppUser | null> {
  const snapshot = await adminDb().collection(USERS).doc(uid).get();
  if (!snapshot.exists) return null;

  const parsed = appUserSchema.safeParse({ uid: snapshot.id, ...snapshot.data() });
  if (!parsed.success) {
    // A malformed user document is a bug, not a signed-out user. Say so
    // rather than silently bouncing the person to /login forever.
    console.error(
      `[users] users/${uid} does not match the expected shape:`,
      parsed.error.issues,
    );
    return null;
  }
  return parsed.data;
}

type UpsertInput = {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
};

/**
 * Creates the user document on first sign-in and refreshes `lastLoginAt`
 * afterwards.
 *
 * The first account ever created in the project becomes `admin`; everyone
 * else is `staff`. That check and the write happen inside one transaction,
 * because two people signing up at the same moment would otherwise both read
 * an empty collection and both become admin.
 */
export async function upsertUserOnLogin(input: UpsertInput): Promise<AppUser> {
  const db = adminDb();
  const env = getServerEnv();
  const userRef = db.collection(USERS).doc(input.uid);

  const result = await db.runTransaction(async (tx) => {
    const existing = await tx.get(userRef);
    const now = Timestamp.now();

    if (existing.exists) {
      tx.update(userRef, {
        email: input.email,
        displayName: input.displayName,
        photoURL: input.photoURL,
        lastLoginAt: now,
      });
      return {
        ...existing.data(),
        uid: input.uid,
        email: input.email,
        displayName: input.displayName,
        photoURL: input.photoURL,
        lastLoginAt: now,
      };
    }

    const anyUser = await tx.get(db.collection(USERS).limit(1));
    const role = anyUser.empty ? "admin" : "staff";

    const created = {
      email: input.email,
      displayName: input.displayName,
      photoURL: input.photoURL,
      role,
      clinicId: env.DEFAULT_CLINIC_ID,
      createdAt: now,
      lastLoginAt: now,
    };

    tx.set(userRef, created);
    return { uid: input.uid, ...created };
  });

  await ensureClinicExists();

  return appUserSchema.parse(result);
}

/**
 * The console assumes a single clinic. The document still exists so that
 * `clinicId` on every conversation points at something real, and so adding a
 * second clinic later is a new row rather than a migration.
 */
async function ensureClinicExists(): Promise<void> {
  const env = getServerEnv();
  const clinicRef = adminDb().collection(CLINICS).doc(env.DEFAULT_CLINIC_ID);
  const snapshot = await clinicRef.get();
  if (snapshot.exists) return;

  await clinicRef.set(
    {
      name: "Main Clinic",
      timezone: env.DEFAULT_CLINIC_TIMEZONE,
      createdAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
}
