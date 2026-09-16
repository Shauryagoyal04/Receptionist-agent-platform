import "server-only";

import {
  cert,
  getApps,
  initializeApp,
  type App,
} from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

import { getFirebasePrivateKey, getServerEnv } from "@/lib/env";

/*
 * The Admin SDK is the only thing in this app that touches Firestore. It
 * bypasses security rules by design, which is why the rules deny the browser
 * outright (see firestore.rules) and why every entry point that reaches this
 * module must check the session first.
 *
 * Next.js reuses module state across requests and reloads the module on hot
 * reload in development, so initialization is guarded on `getApps()`.
 */
const APP_NAME = "reception-console";

let appInstance: App | null = null;

function getAdminApp(): App {
  if (appInstance) return appInstance;

  const existing = getApps().find((app) => app.name === APP_NAME);
  if (existing) {
    appInstance = existing;
    return existing;
  }

  const env = getServerEnv();
  appInstance = initializeApp(
    {
      credential: cert({
        projectId: env.FIREBASE_PROJECT_ID,
        clientEmail: env.FIREBASE_CLIENT_EMAIL,
        privateKey: getFirebasePrivateKey(),
      }),
      projectId: env.FIREBASE_PROJECT_ID,
    },
    APP_NAME,
  );

  return appInstance;
}

let firestoreInstance: Firestore | null = null;

export function adminDb(): Firestore {
  if (firestoreInstance) return firestoreInstance;
  firestoreInstance = getFirestore(getAdminApp());
  // Writing `undefined` throws by default; treating it as "leave the field
  // alone" keeps partial updates (a staff note, a review flag) simple.
  firestoreInstance.settings({ ignoreUndefinedProperties: true });
  return firestoreInstance;
}

export function adminAuth(): Auth {
  return getAuth(getAdminApp());
}
