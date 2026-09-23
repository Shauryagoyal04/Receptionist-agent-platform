import { z } from "zod";

import {
  channelSchema,
  conversationStatusSchema,
  intentIdSchema,
  isoDate,
  languageSchema,
  messageRoleSchema,
  messageTypeSchema,
  outcomeSchema,
  sentimentSchema,
  toolInvocationSchema,
} from "@/lib/types";

/*
 * The shape the agent posts to /api/ingest/conversation.
 *
 * This mirrors docs/agent-data-contract.md exactly — that document is written
 * for the agent's engineer, this is the machine-checked version of it. Keep
 * them in step.
 *
 * Fields the console derives from the messages (messageCount, durationSec,
 * lastMessagePreview, toolStats, the per-role counts, average latency) are
 * deliberately NOT accepted here. They drive the analytics page, and a buggy
 * or hostile caller could otherwise skew every number on it while looking
 * perfectly well-formed.
 */

/**
 * A field that may be omitted, sent as null, or sent with a value — all of
 * which normalize to null.
 *
 * `.nullish()` is load-bearing: a union that merely includes `z.undefined()`
 * still produces a *required* key once `.transform()` wraps it, so omitting
 * the field would be rejected.
 */
function nullableOptional<T extends z.ZodType>(schema: T) {
  return schema
    .nullish()
    .transform((value): z.infer<T> | null => value ?? null);
}

export const ingestMessageSchema = z.object({
  role: messageRoleSchema,
  type: messageTypeSchema.default("text"),
  content: z.string().max(10_000),
  timestamp: isoDate,
  audioUrl: nullableOptional(z.string().url()),
  latencyMs: nullableOptional(z.number().nonnegative()),
  confidence: nullableOptional(z.number().min(0).max(1)),
  tool: nullableOptional(toolInvocationSchema),
});

export const ingestConversationSchema = z.object({
  /** The caller's own id. Ingestion is idempotent on this. */
  externalId: z.string().min(1).max(200),
  phone: z.string().min(3).max(32),
  patientName: z.string().min(1).max(200).default("Unknown"),
  patientEmail: nullableOptional(z.string().email()),
  isReturning: z.boolean().default(false),

  channel: channelSchema.default("whatsapp"),
  status: conversationStatusSchema.default("completed"),
  outcome: outcomeSchema,
  primaryIntent: intentIdSchema,
  intents: z.array(intentIdSchema).default([]),

  doctorName: nullableOptional(z.string().max(200)),
  appointmentAt: nullableOptional(isoDate),

  startedAt: isoDate,
  endedAt: nullableOptional(isoDate),

  escalated: z.boolean().default(false),
  escalationReason: nullableOptional(z.string().max(500)),

  sentiment: sentimentSchema.default("neutral"),
  language: languageSchema.default("en"),
  summary: z.string().max(2000).default(""),
  tags: z.array(z.string().max(60)).max(20).default([]),

  // Capped so one payload cannot be used to store an unbounded document;
  // MongoDB's own limit is 16MB and a real conversation is nowhere near this.
  messages: z.array(ingestMessageSchema).max(500),
});

export type IngestConversation = z.infer<typeof ingestConversationSchema>;
