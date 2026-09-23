/*
 * Auth.js error codes are not sentences a receptionist should ever read.
 *
 * Auth.js deliberately collapses most credential failures into
 * `CredentialsSignin` so that a wrong password and an unknown email are
 * indistinguishable — that is a feature, not something to unpick here, and
 * the message below stays vague on purpose.
 *
 * This module has no imports so both Client Components and Route Handlers can
 * use it.
 */

const MESSAGES: Record<string, string> = {
  // Credentials
  CredentialsSignin: "That email and password don't match.",
  CallbackRouteError: "That email and password don't match.",
  MissingCSRF: "Your sign-in form expired. Refresh the page and try again.",

  // OAuth
  OAuthAccountNotLinked:
    "This email is already registered with a different sign-in method. Use that one instead.",
  OAuthSignInError:
    "Google sign-in couldn't start. Try again, or use your email and password.",
  OAuthCallbackError:
    "Google sign-in didn't complete. Try again, or use your email and password.",
  AccessDenied:
    "That account isn't allowed to sign in here. Ask an admin if you need access.",
  Verification: "That sign-in link has expired. Request a new one.",

  // Configuration — these mean the deployment is wrong, not the user.
  Configuration:
    "Sign-in is misconfigured on the server. Check AUTH_SECRET and the Google credentials.",
  AdapterError: "The database couldn't be reached. Try again in a moment.",
};

const FALLBACK = "Something went wrong signing you in. Try again.";

function codeOf(error: unknown): string | null {
  if (typeof error === "string") return error;
  if (typeof error === "object" && error !== null) {
    for (const key of ["type", "code", "name"] as const) {
      if (key in error) {
        const value = (error as Record<string, unknown>)[key];
        if (typeof value === "string") return value;
      }
    }
  }
  return null;
}

export function authErrorMessage(error: unknown): string {
  const code = codeOf(error);

  if (code !== null) {
    const message = MESSAGES[code];
    if (message) return message;
    console.error(`[auth] unmapped Auth.js error: ${code}`, error);
    return FALLBACK;
  }

  // Our own errors (the domain allowlist rejection, for instance) are already
  // written for a human, so pass them through.
  if (error instanceof Error && error.message) return error.message;

  console.error("[auth] unrecognized error shape", error);
  return FALLBACK;
}
