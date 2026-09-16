"use client";

import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import {
  GoogleAuthProvider,
  getAuth,
  type Auth,
} from "firebase/auth";

/*
 * Browser-side Firebase. This is used for one thing only: proving who the
 * user is and handing the resulting ID token to `/api/auth/session`, which
 * exchanges it for an httpOnly session cookie.
 *
 * It is deliberately NOT used to read data. Firestore is server-only in this
 * app — see lib/firebase/admin.ts and firestore.rules.
 *
 * Each `process.env.NEXT_PUBLIC_*` reference must be a literal for Next.js to
 * inline it at build time, so these cannot be read from a loop or a map.
 */
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

function getClientApp(): FirebaseApp {
  if (getApps().length > 0) return getApp();

  const missing = Object.entries(firebaseConfig)
    .filter(([, value]) => !value)
    .map(([key]) => key);

  if (missing.length > 0) {
    throw new Error(
      `Firebase client config is incomplete (missing: ${missing.join(", ")}). ` +
        "Copy .env.example to .env.local and fill in the NEXT_PUBLIC_FIREBASE_* values.",
    );
  }

  return initializeApp(firebaseConfig);
}

export function clientAuth(): Auth {
  return getAuth(getClientApp());
}

export function googleProvider(): GoogleAuthProvider {
  const provider = new GoogleAuthProvider();
  // Always show the chooser: clinic machines are shared, and silently
  // reusing the last Google account is a real way to file notes under the
  // wrong person.
  provider.setCustomParameters({ prompt: "select_account" });
  return provider;
}
