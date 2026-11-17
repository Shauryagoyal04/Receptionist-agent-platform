"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth/session";
import { setUserRole } from "@/lib/data/users";
import { userRoleSchema } from "@/lib/types";

/*
 * Team management: an admin sets another account's role.
 *
 * Same rules as the other actions: the session is re-checked here, the
 * clinicId comes only from it, and expected failures are returned, not thrown.
 * The role change takes effect on that person's next request, because
 * `getAccount()` reads the role from the database rather than the token.
 */

export type ActionResult = { ok: true } | { ok: false; error: string };

const roleSchema = z.object({
  userId: z.string().min(1),
  role: userRoleSchema,
});

export async function setRoleAction(
  userId: string,
  role: string,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Your session expired. Sign in again." };
  if (user.role !== "admin") {
    return { ok: false, error: "Only an admin can change roles." };
  }

  const parsed = roleSchema.safeParse({ userId, role });
  if (!parsed.success) return { ok: false, error: "That isn't a valid role." };

  // Changing your own role is how a clinic ends up with no admin at all.
  // Another admin can change yours.
  if (parsed.data.userId === user.id) {
    return { ok: false, error: "You can't change your own role. Ask another admin." };
  }

  try {
    const found = await setUserRole(user.clinicId, parsed.data.userId, parsed.data.role);
    if (!found) return { ok: false, error: "That account no longer exists." };
  } catch (error) {
    console.error("[team] setRoleAction failed", error);
    return { ok: false, error: "Couldn't change that role. Try again." };
  }

  revalidatePath("/team");
  // The nav shows how many accounts are waiting.
  revalidatePath("/", "layout");
  return { ok: true };
}
