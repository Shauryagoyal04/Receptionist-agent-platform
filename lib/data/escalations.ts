import "server-only";

import { randomUUID } from "node:crypto";

import { ObjectId, type Collection, type Document } from "mongodb";

import { COLLECTIONS, getDb } from "@/lib/mongodb";
import {
  escalationSchema,
  type Escalation,
  type EscalationStatus,
} from "@/lib/types";

/*
 * Staff handoff (docs/staff-handoff-contract.md).
 *
 * The agent inserts `escalations` and sends `outbox` jobs; the console claims
 * and resolves escalations, appends staff replies to a conversation and queues
 * a `staff.reply` job for the agent to send. Every date written here is an ISO
 * 8601 string, as the contract requires: the agent compares `nextAttemptAt`
 * as a string, and mixed Date/string fields sort apart in MongoDB.
 *
 * Every query is scoped by clinicId, so an id from another clinic reads as
 * missing.
 */

/** WhatsApp only delivers free-text messages this long after the patient's last one. */
export const REPLY_WINDOW_MS = 24 * 60 * 60 * 1000;

/** WhatsApp's limit on a text message body. */
export const MAX_REPLY_LENGTH = 4096;

export type StaffActor = { id: string; name: string };

async function escalations(): Promise<Collection<Document>> {
  return (await getDb()).collection(COLLECTIONS.escalations);
}

async function conversations(): Promise<Collection<Document>> {
  return (await getDb()).collection(COLLECTIONS.conversations);
}

function nowIso(): string {
  return new Date().toISOString();
}

function parseEscalation(doc: Document): Escalation | null {
  const { _id, ...rest } = doc;
  const parsed = escalationSchema.safeParse({ id: String(_id), ...rest });
  if (!parsed.success) {
    console.error(
      `[escalations] ${String(_id)} does not match the expected shape:`,
      parsed.error.issues,
    );
    return null;
  }
  return parsed.data;
}

/* ------------------------------------------------------------------ */
/* Reads                                                               */
/* ------------------------------------------------------------------ */

/** An escalation plus the console id of its conversation, for linking. */
export type EscalationRow = Escalation & { conversationDocId: string | null };

export async function listEscalations(
  clinicId: string,
  status: EscalationStatus,
  limit = 200,
): Promise<EscalationRow[]> {
  const docs = await (await escalations())
    .find({ clinicId, status })
    .sort({ createdAt: -1, _id: -1 })
    .limit(limit)
    .toArray();
  const rows = docs
    .map(parseEscalation)
    .filter((entry): entry is Escalation => entry !== null);

  // One query maps the agent's conversation ids to the console's ids.
  const externalIds = [
    ...new Set(rows.map((row) => row.conversationId).filter((id): id is string => !!id)),
  ];
  const linked =
    externalIds.length === 0
      ? []
      : await (await conversations())
          .find(
            { clinicId, externalId: { $in: externalIds } },
            { projection: { _id: 1, externalId: 1 } },
          )
          .toArray();
  const byExternal = new Map(linked.map((doc) => [String(doc.externalId), String(doc._id)]));

  return rows.map((row) => ({
    ...row,
    conversationDocId: row.conversationId ? (byExternal.get(row.conversationId) ?? null) : null,
  }));
}

export async function countOpenEscalations(clinicId: string): Promise<number> {
  return (await escalations()).countDocuments({ clinicId, status: "open" });
}

export async function getEscalation(
  clinicId: string,
  id: string,
): Promise<Escalation | null> {
  if (!ObjectId.isValid(id)) return null;
  const doc = await (await escalations()).findOne({ _id: new ObjectId(id), clinicId });
  return doc ? parseEscalation(doc) : null;
}

/** The unresolved escalation for a conversation (by the agent's externalId), if any. */
export async function getActiveEscalationForConversation(
  clinicId: string,
  externalId: string,
): Promise<Escalation | null> {
  const doc = await (await escalations()).findOne(
    { clinicId, conversationId: externalId, status: { $in: ["open", "claimed"] } },
    { sort: { createdAt: -1 } },
  );
  return doc ? parseEscalation(doc) : null;
}

/* ------------------------------------------------------------------ */
/* Writes                                                              */
/* ------------------------------------------------------------------ */

/**
 * Claims an open escalation. Returns false when it is no longer open (someone
 * else claimed or resolved it first): the status is part of the filter, so two
 * staff clicking at once cannot both win.
 */
export async function claimEscalation(
  clinicId: string,
  id: string,
  actor: StaffActor,
): Promise<boolean> {
  if (!ObjectId.isValid(id)) return false;
  const now = nowIso();
  const result = await (await escalations()).updateOne(
    { _id: new ObjectId(id), clinicId, status: "open" },
    {
      $set: {
        status: "claimed",
        claimedBy: actor.id,
        claimedByName: actor.name,
        claimedAt: now,
        updatedAt: now,
      },
    },
  );
  return result.modifiedCount === 1;
}

/**
 * Resolves an escalation and, for WhatsApp, hands the chat back to the AI.
 * Returns false when the escalation is missing or already resolved.
 */
export async function resolveEscalation(
  clinicId: string,
  id: string,
  actor: StaffActor,
  note: string | null,
): Promise<boolean> {
  if (!ObjectId.isValid(id)) return false;
  const now = nowIso();
  const escalation = await (await escalations()).findOneAndUpdate(
    { _id: new ObjectId(id), clinicId, status: { $in: ["open", "claimed"] } },
    {
      $set: {
        status: "resolved",
        resolvedBy: actor.id,
        resolvedByName: actor.name,
        resolvedAt: now,
        resolutionNote: note,
        updatedAt: now,
      },
    },
    { returnDocument: "after" },
  );
  if (!escalation) return false;

  if (escalation.channel === "whatsapp" && typeof escalation.conversationId === "string") {
    await handBackToAgent(clinicId, escalation.conversationId, actor);
  }
  return true;
}

/**
 * Sets a staff-handled conversation back to the AI, with a transcript marker.
 * A conversation already handled by the agent is left alone.
 */
async function handBackToAgent(
  clinicId: string,
  externalId: string,
  actor: StaffActor,
): Promise<void> {
  // Another unresolved escalation on the same chat keeps it with staff.
  const stillOpen = await (await escalations()).countDocuments(
    { clinicId, conversationId: externalId, status: { $in: ["open", "claimed"] } },
    { limit: 1 },
  );
  if (stillOpen > 0) return;

  await (await conversations()).updateOne(
    { clinicId, externalId, handledBy: "staff" },
    {
      $set: { handledBy: "agent" },
      $push: {
        messages: {
          role: "system",
          type: "system_event",
          content: `${actor.name} handed the chat back to the AI`,
          timestamp: nowIso(),
        },
      } as Document,
    },
  );
}

/**
 * "Hand back to AI" from a conversation page: resolves the conversation's
 * unresolved escalations and returns the chat to the agent. Works even if the
 * escalation record is missing, so a chat can never get stuck with staff.
 * Returns false when the conversation is not found.
 */
export async function handBackConversation(
  clinicId: string,
  conversationDocId: string,
  actor: StaffActor,
  note: string | null,
): Promise<boolean> {
  if (!ObjectId.isValid(conversationDocId)) return false;
  const conversation = await (await conversations()).findOne(
    { _id: new ObjectId(conversationDocId), clinicId },
    { projection: { externalId: 1 } },
  );
  if (!conversation || typeof conversation.externalId !== "string") return false;

  const now = nowIso();
  await (await escalations()).updateMany(
    {
      clinicId,
      conversationId: conversation.externalId,
      status: { $in: ["open", "claimed"] },
    },
    {
      $set: {
        status: "resolved",
        resolvedBy: actor.id,
        resolvedByName: actor.name,
        resolvedAt: now,
        resolutionNote: note,
        updatedAt: now,
      },
    },
  );
  await handBackToAgent(clinicId, conversation.externalId, actor);
  return true;
}

export type SendReplyResult =
  | { ok: true }
  | { ok: false; reason: "not_found" | "not_whatsapp" | "not_staff" | "window_closed" };

/**
 * Appends a staff reply to a WhatsApp conversation and queues it for the agent
 * to send. Also claims the conversation's open escalation, so replying counts
 * as picking it up.
 *
 * The checks here repeat what the page shows, because a Server Action can be
 * called with any input: the chat must be WhatsApp, with staff, and inside the
 * 24-hour window.
 */
export async function sendStaffReply(
  clinicId: string,
  conversationDocId: string,
  text: string,
  actor: StaffActor,
): Promise<SendReplyResult> {
  if (!ObjectId.isValid(conversationDocId)) return { ok: false, reason: "not_found" };
  const conversationsCol = await conversations();
  const conversation = await conversationsCol.findOne(
    { _id: new ObjectId(conversationDocId), clinicId },
    {
      projection: {
        externalId: 1,
        channel: 1,
        handledBy: 1,
        lastPatientMessageAt: 1,
        messages: 1,
      },
    },
  );
  if (!conversation || typeof conversation.externalId !== "string") {
    return { ok: false, reason: "not_found" };
  }
  if (conversation.channel !== "whatsapp") return { ok: false, reason: "not_whatsapp" };
  if (conversation.handledBy !== "staff") return { ok: false, reason: "not_staff" };

  const lastPatientAt = lastPatientMessageAt(conversation);
  if (!isWithinReplyWindow(lastPatientAt)) return { ok: false, reason: "window_closed" };

  const now = nowIso();
  const clientId = randomUUID();
  const externalId = conversation.externalId;

  const pushed = await conversationsCol.updateOne(
    { _id: conversation._id, clinicId, handledBy: "staff" },
    {
      $push: {
        messages: {
          role: "staff",
          type: "text",
          content: text,
          timestamp: now,
          clientId,
          staff: { userId: actor.id, name: actor.name },
          delivery: { status: "pending" },
        },
      } as Document,
      $set: { endedAt: now },
    },
  );
  // Handed back to the AI between the read and the write.
  if (pushed.matchedCount === 0) return { ok: false, reason: "not_staff" };

  await (await getDb()).collection(COLLECTIONS.outbox).insertOne({
    clinicId,
    kind: "staff.reply",
    appointmentId: null,
    status: "pending",
    attempts: 0,
    nextAttemptAt: now,
    createdAt: now,
    updatedAt: now,
    conversationId: externalId,
    messageClientId: clientId,
    text,
    staffUserId: actor.id,
    staffName: actor.name,
  });

  const open = await (await escalations()).findOne(
    { clinicId, conversationId: externalId, status: "open" },
    { projection: { _id: 1 } },
  );
  if (open) await claimEscalation(clinicId, String(open._id), actor);

  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* 24-hour window                                                      */
/* ------------------------------------------------------------------ */

/**
 * When the patient last wrote: the agent's `lastPatientMessageAt`, falling
 * back to the newest patient message for conversations written before the
 * field existed.
 */
export function lastPatientMessageAt(doc: Document): string | null {
  const stored = toIso(doc.lastPatientMessageAt);
  if (stored) return stored;
  const messages: Document[] = Array.isArray(doc.messages) ? doc.messages : [];
  let latest: string | null = null;
  for (const message of messages) {
    if (message?.role !== "patient") continue;
    const at = toIso(message.timestamp);
    if (at && (latest === null || at > latest)) latest = at;
  }
  return latest;
}

export function isWithinReplyWindow(lastPatientAt: string | null, now = Date.now()): boolean {
  if (!lastPatientAt) return false;
  return now - Date.parse(lastPatientAt) < REPLY_WINDOW_MS;
}

function toIso(value: unknown): string | null {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
  }
  return null;
}

/** Indexes the escalations page relies on. Same names and keys as the agent's. */
export async function ensureEscalationIndexes(): Promise<void> {
  const collection = await escalations();
  const warn = (name: string) => (error: unknown) => {
    console.warn(
      `[db] could not create the ${name} index on escalations; an equivalent ` +
        "one probably already exists (the agent creates it too).",
      error,
    );
  };
  await Promise.all([
    collection
      .createIndex(
        { clinicId: 1, status: 1, createdAt: -1 },
        { name: "clinic_status_created" },
      )
      .catch(warn("clinic_status_created")),
    collection
      .createIndex(
        { clinicId: 1, conversationId: 1, status: 1 },
        { name: "clinic_conversation_status" },
      )
      .catch(warn("clinic_conversation_status")),
  ]);
}
