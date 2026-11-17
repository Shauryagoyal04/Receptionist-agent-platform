import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import type { UserRole } from "@/lib/types";

export type SessionUser = {
  id: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  role: UserRole;
  clinicId: string;
};

/**
 * Resolves the signed-in user, or null.
 *
 * This is the real authorization boundary. `proxy.ts` only checks that a
 * session cookie is present so it can redirect quickly; it deliberately does
 * not verify anything. Every Server Component, Route Handler and Server
 * Action that touches clinic data must call this and handle null — Next.js
 * runs Server Functions as POSTs to the page route, outside the layout's
 * render, so a layout check does not cover them.
 *
 * Wrapped in React `cache()` so a request that checks the session in a layout
 * and again in a nested component pays for it once.
 */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const session = await auth();
  const user = session?.user;
  // A token without a clinic is a half-provisioned account; treat it as
  // signed out rather than letting it reach a query with `undefined`.
  if (!user?.id || !user.clinicId) return null;

  return {
    id: user.id,
    email: user.email ?? null,
    displayName: user.name ?? null,
    photoURL: user.image ?? null,
    role: user.role,
    clinicId: user.clinicId,
  };
});

/**
 * For admin-only pages (clinic data, doctors, patients, custom pages, data
 * settings). Staff only get Analytics, Conversations and Escalations
 * (docs/staff-handoff-contract.md), so they are sent to Analytics rather than
 * shown a page they can't use. Server Actions check the role themselves; a
 * redirect is no use to a POST.
 */
export async function requireAdmin(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "admin") redirect("/analytics");
  return user;
}
