"use client";

import {
  createUserWithEmailAndPassword,
  deleteUser,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  type UserCredential,
} from "firebase/auth";

import { clientAuth, googleProvider } from "@/lib/firebase/client";

/*
 * The browser half of the sign-in flow.
 *
 * Every path ends the same way: get an ID token, POST it to
 * /api/auth/session, and let the server mint the httpOnly session cookie.
 * The client never holds anything the server trusts.
 */

type SessionIntent = "signin" | "signup";

/** Thrown when the server rejects the session exchange, already human-readable. */
export class SessionExchangeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SessionExchangeError";
  }
}

async function exchangeForSessionCookie(
  credential: UserCredential,
  intent: SessionIntent,
): Promise<void> {
  const idToken = await credential.user.getIdToken();

  const response = await fetch("/api/auth/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken, intent }),
  });

  if (!response.ok) {
    let message = "Couldn't start your session. Try again.";
    try {
      const body: unknown = await response.json();
      if (
        typeof body === "object" &&
        body !== null &&
        "error" in body &&
        typeof (body as { error: unknown }).error === "string"
      ) {
        message = (body as { error: string }).error;
      }
    } catch {
      // Keep the default message.
    }

    // The server refused this identity, so the client must not stay signed
    // in to Firebase — otherwise the UI looks authenticated while every
    // server request 401s.
    await signOut(clientAuth()).catch(() => undefined);
    throw new SessionExchangeError(message);
  }
}

export async function signInWithEmail(
  email: string,
  password: string,
): Promise<void> {
  const credential = await signInWithEmailAndPassword(
    clientAuth(),
    email,
    password,
  );
  await exchangeForSessionCookie(credential, "signin");
}

export async function signUpWithEmail(
  name: string,
  email: string,
  password: string,
): Promise<void> {
  const auth = clientAuth();
  const credential = await createUserWithEmailAndPassword(
    auth,
    email,
    password,
  );

  try {
    await updateProfile(credential.user, { displayName: name });
    // Refresh so the ID token carries the name the server will store.
    await credential.user.getIdToken(true);
    await exchangeForSessionCookie(credential, "signup");
  } catch (error) {
    // If the server rejected the domain it already deleted the account. If
    // something else failed, the account would otherwise linger and block a
    // retry with "email already in use", so remove it here.
    if (!(error instanceof SessionExchangeError)) {
      await deleteUser(credential.user).catch(() => undefined);
    }
    throw error;
  }
}

export async function signInWithGoogle(intent: SessionIntent): Promise<void> {
  const credential = await signInWithPopup(clientAuth(), googleProvider());
  await exchangeForSessionCookie(credential, intent);
}

export async function signOutEverywhere(): Promise<void> {
  await signOut(clientAuth()).catch(() => undefined);
  await fetch("/api/auth/signout", { method: "POST" });
}
