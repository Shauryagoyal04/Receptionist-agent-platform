import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { findUserById } from "@/lib/data/users";
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
 * The signed-in account, whatever its role — including `pending` accounts
 * that have not been approved yet. Only the dashboard layout should use this
 * (to show the "waiting for approval" screen); everything that reads or writes
 * clinic data uses `getCurrentUser()`.
 *
 * The role is read from the database on every request rather than trusted
 * from the token: a token lives for 14 days, and an admin approving, demoting
 * or locking out an account must take effect on that person's next click.
 * Wrapped in React `cache()` so one request pays for it once.
 */
export const getAccount = cache(async (): Promise<SessionUser | null> => {
  const session = await auth();
  const user = session?.user;
  // A token without a clinic is a half-provisioned account; treat it as
  // signed out rather than letting it reach a query with `undefined`.
  if (!user?.id || !user.clinicId) return null;

  const record = await findUserById(user.id);
  if (!record) return null; // deleted since signing in

  return {
    id: record.id,
    email: record.email ?? user.email ?? null,
    displayName: record.displayName ?? user.name ?? null,
    photoURL: record.photoURL ?? user.image ?? null,
    role: record.role,
    clinicId: record.clinicId,
  };
});

/**
 * Resolves the signed-in user who may see clinic data, or null.
 *
 * This is the real authorization boundary. `proxy.ts` only checks that a
 * session cookie is present so it can redirect quickly; it deliberately does
 * not verify anything. Every Server Component, Route Handler and Server
 * Action that touches clinic data must call this and handle null — Next.js
 * runs Server Functions as POSTs to the page route, outside the layout's
 * render, so a layout check does not cover them.
 *
 * Accounts still waiting for approval (`pending`) get null here, so no data
 * path can reach them.
 */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const account = await getAccount();
  if (!account || account.role === "pending") return null;
  return account;
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
