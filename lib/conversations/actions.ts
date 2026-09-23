"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth/session";
import { setReviewed, setStaffNote } from "@/lib/data/conversations";

/*
 * Staff annotations — the only writes the console makes.
 *
 * Each one re-verifies the session itself. Next.js runs Server Functions as
 * POSTs to the page route, outside the dashboard layout's render, so the
 * layout's check does not cover them and `proxy.ts` matcher changes can
 * silently drop coverage. Authorization belongs with the code that writes.
 *
 * Errors are returned rather than thrown: these are expected failures a form
 * should display inline, not crashes that should blow away the transcript the
 * user is reading.
 */

export type ActionResult =
  | { ok: true }
  | { ok: false; error: string };

const noteSchema = z.object({
  conversationId: z.string().min(1),
  // Long enough for a real handover note, short enough that the document
  // cannot be used as arbitrary storage.
  note: z.string().max(2000, "Notes are limited to 2000 characters."),
});

export async function saveStaffNote(
  conversationId: string,
  note: string,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Your session expired. Sign in again." };

  const parsed = noteSchema.safeParse({ conversationId, note });
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "That note couldn't be saved.",
    };
  }

  try {
    await setStaffNote(user.clinicId, parsed.data.conversationId, parsed.data.note);
  } catch (error) {
    console.error("[actions] saveStaffNote failed", error);
    return { ok: false, error: "Couldn't save that note. Try again." };
  }

  revalidatePath(`/conversations/${parsed.data.conversationId}`);
  revalidatePath("/conversations");
  return { ok: true };
}

const reviewSchema = z.object({
  conversationId: z.string().min(1),
  reviewed: z.boolean(),
});

export async function setReviewedFlag(
  conversationId: string,
  reviewed: boolean,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Your session expired. Sign in again." };

  const parsed = reviewSchema.safeParse({ conversationId, reviewed });
  if (!parsed.success) {
    return { ok: false, error: "That conversation couldn't be updated." };
  }

  try {
    await setReviewed(
      user.clinicId,
      parsed.data.conversationId,
      user.uid,
      parsed.data.reviewed,
    );
  } catch (error) {
    console.error("[actions] setReviewedFlag failed", error);
    return { ok: false, error: "Couldn't update that. Try again." };
  }

  revalidatePath(`/conversations/${parsed.data.conversationId}`);
  revalidatePath("/conversations");
  return { ok: true };
}
