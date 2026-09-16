/*
 * Firebase error codes are not sentences a receptionist should ever read.
 * Every code we can actually provoke is mapped here; anything unmapped falls
 * back to a neutral message and is logged so it can be added.
 *
 * This module is intentionally free of imports so both Client Components and
 * Route Handlers can use it.
 */

const MESSAGES: Record<string, string> = {
  "auth/invalid-credential": "That email and password don't match.",
  "auth/invalid-email": "That doesn't look like a valid email address.",
  "auth/user-disabled": "This account has been disabled. Ask an admin to re-enable it.",
  "auth/user-not-found": "That email and password don't match.",
  "auth/wrong-password": "That email and password don't match.",
  "auth/email-already-in-use":
    "An account with this email already exists. Sign in instead.",
  "auth/weak-password": "Pick a password of at least 6 characters.",
  "auth/missing-password": "Enter a password.",
  "auth/too-many-requests":
    "Too many attempts. Wait a minute and try again.",
  "auth/network-request-failed":
    "Couldn't reach Firebase. Check your connection and try again.",
  "auth/popup-blocked":
    "Your browser blocked the Google sign-in window. Allow pop-ups for this site and try again.",
  "auth/account-exists-with-different-credential":
    "This email is already registered with a different sign-in method. Use that one instead.",
  "auth/unauthorized-domain":
    "This domain isn't authorized for Google sign-in. Add it in the Firebase console under Authentication → Settings → Authorized domains.",
  "auth/operation-not-allowed":
    "This sign-in method is turned off. Enable it in the Firebase console under Authentication → Sign-in method.",
};

/**
 * Codes that mean "the user changed their mind". These are not failures and
 * must not produce an error message — the form simply returns to rest.
 */
const SILENT_CODES = new Set([
  "auth/popup-closed-by-user",
  "auth/cancelled-popup-request",
  "auth/user-cancelled",
]);

const FALLBACK = "Something went wrong signing you in. Try again.";

function codeOf(error: unknown): string | null {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof (error as { code: unknown }).code === "string"
  ) {
    return (error as { code: string }).code;
  }
  return null;
}

export function isSilentAuthError(error: unknown): boolean {
  const code = codeOf(error);
  return code !== null && SILENT_CODES.has(code);
}

export function authErrorMessage(error: unknown): string {
  const code = codeOf(error);

  if (code !== null) {
    const message = MESSAGES[code];
    if (message) return message;
    console.error(`[auth] unmapped Firebase error code: ${code}`, error);
    return FALLBACK;
  }

  // Our own errors (domain allowlist rejection, session route failures) are
  // already written for a human, so pass them through.
  if (error instanceof Error && error.message) return error.message;

  console.error("[auth] unrecognized error shape", error);
  return FALLBACK;
}
