"use server";

import { signOut } from "@/lib/auth";

/**
 * Ends the session and returns to the sign-in page.
 *
 * A Server Action rather than a client call so the session cookie is cleared
 * by the server response itself — there is no window in which the browser
 * thinks it is signed out while the cookie is still valid.
 */
export async function signOutAction(): Promise<void> {
  await signOut({ redirectTo: "/login" });
}
