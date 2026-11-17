"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getCurrentUser, type SessionUser } from "@/lib/auth/session";
import {
  MAX_REPLY_LENGTH,
  claimEscalation,
  handBackConversation,
  resolveEscalation,
  sendStaffReply,
  type StaffActor,
} from "@/lib/data/escalations";

/*
 * Staff handoff actions (docs/staff-handoff-contract.md). Admin and staff may
 * both use them.
 *
 * Same rules as lib/conversations/actions.ts: each action re-checks the
 * session itself, takes the clinicId only from it, validates input with zod
 * and returns expected failures instead of throwing.
 */

export type ActionResult = { ok: true } | { ok: false; error: string };

const SESSION_EXPIRED = { ok: false, error: "Your session expired. Sign in again." } as const;

function actorOf(user: SessionUser): StaffActor {
  return { id: user.id, name: user.displayName ?? user.email ?? "Staff" };
}

function revalidateHandoffPaths(conversationDocId?: string) {
  revalidatePath("/escalations");
  revalidatePath("/conversations");
  if (conversationDocId) revalidatePath(`/conversations/${conversationDocId}`);
  // The nav shows the open count.
  revalidatePath("/", "layout");
}

const idSchema = z.string().min(1).max(64);

export async function claimEscalationAction(escalationId: string): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return SESSION_EXPIRED;
  const parsed = idSchema.safeParse(escalationId);
  if (!parsed.success) return { ok: false, error: "That escalation couldn't be found." };

  try {
    const claimed = await claimEscalation(user.clinicId, parsed.data, actorOf(user));
    if (!claimed) {
      return { ok: false, error: "Someone else already picked this up." };
    }
  } catch (error) {
    console.error("[escalations] claim failed", error);
    return { ok: false, error: "Couldn't claim that. Try again." };
  }
  revalidateHandoffPaths();
  return { ok: true };
}

const resolveSchema = z.object({
  escalationId: idSchema,
  note: z.string().max(2000, "Notes are limited to 2000 characters."),
  conversationDocId: z.string().max(64).optional(),
});

export async function resolveEscalationAction(
  escalationId: string,
  note: string,
  conversationDocId?: string,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return SESSION_EXPIRED;
  const parsed = resolveSchema.safeParse({ escalationId, note, conversationDocId });
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "That escalation couldn't be found.",
    };
  }

  const trimmed = parsed.data.note.trim();
  try {
    const resolved = await resolveEscalation(
      user.clinicId,
      parsed.data.escalationId,
      actorOf(user),
      trimmed.length > 0 ? trimmed : null,
    );
    if (!resolved) return { ok: false, error: "This escalation is already resolved." };
  } catch (error) {
    console.error("[escalations] resolve failed", error);
    return { ok: false, error: "Couldn't resolve that. Try again." };
  }
  revalidateHandoffPaths(parsed.data.conversationDocId);
  return { ok: true };
}

const replySchema = z.object({
  conversationDocId: idSchema,
  text: z
    .string()
    .trim()
    .min(1, "Write a message first.")
    .max(MAX_REPLY_LENGTH, `WhatsApp messages are limited to ${MAX_REPLY_LENGTH} characters.`),
});

const REPLY_ERRORS = {
  not_found: "That conversation couldn't be found.",
  not_whatsapp: "Only WhatsApp chats can be answered from here.",
  not_staff: "The AI is handling this chat now, so it can't be answered from here.",
  window_closed:
    "WhatsApp only allows replies within 24 hours of the patient's last message. Call them instead.",
} as const;

export async function sendStaffReplyAction(
  conversationDocId: string,
  text: string,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return SESSION_EXPIRED;
  const parsed = replySchema.safeParse({ conversationDocId, text });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "That message couldn't be sent." };
  }

  try {
    const result = await sendStaffReply(
      user.clinicId,
      parsed.data.conversationDocId,
      parsed.data.text,
      actorOf(user),
    );
    if (!result.ok) return { ok: false, error: REPLY_ERRORS[result.reason] };
  } catch (error) {
    console.error("[escalations] sendStaffReply failed", error);
    return { ok: false, error: "Couldn't send that. Try again." };
  }
  revalidateHandoffPaths(parsed.data.conversationDocId);
  return { ok: true };
}

const handBackSchema = z.object({
  conversationDocId: idSchema,
  note: z.string().max(2000, "Notes are limited to 2000 characters."),
});

export async function handBackToAiAction(
  conversationDocId: string,
  note: string,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return SESSION_EXPIRED;
  const parsed = handBackSchema.safeParse({ conversationDocId, note });
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "That conversation couldn't be found.",
    };
  }

  const trimmed = parsed.data.note.trim();
  try {
    const found = await handBackConversation(
      user.clinicId,
      parsed.data.conversationDocId,
      actorOf(user),
      trimmed.length > 0 ? trimmed : null,
    );
    if (!found) return { ok: false, error: "That conversation couldn't be found." };
  } catch (error) {
    console.error("[escalations] hand back failed", error);
    return { ok: false, error: "Couldn't hand this back. Try again." };
  }
  revalidateHandoffPaths(parsed.data.conversationDocId);
  return { ok: true };
}
