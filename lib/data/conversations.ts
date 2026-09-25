import "server-only";

import { ObjectId, type Collection, type Document, type Filter } from "mongodb";

import { COLLECTIONS, getDb } from "@/lib/mongodb";
import { deriveConversationFields } from "@/lib/data/derive";
import {
  conversationSchema,
  messageSchema,
  type Channel,
  type Conversation,
  type ConversationStatus,
  type IntentId,
  type Message,
  type Outcome,
} from "@/lib/types";

/*
 * Every read and write of conversation data.
 *
 * Documents are parsed through Zod on the way out and every Date becomes an
 * ISO string, because Server Components cannot hand a Date-bearing object
 * across the boundary to a Client Component without it being serialized
 * anyway — doing it here keeps the shape explicit and validated.
 */

/** Rows shown per page in the conversations table. */
export const PAGE_SIZE = 25;

export type SortOrder = "newest" | "oldest";

export type ConversationFilters = {
  q: string | null;
  status: ConversationStatus[];
  outcome: Outcome[];
  intent: IntentId[];
  channel: Channel[];
  from: string | null;
  to: string | null;
  unreviewedOnly: boolean;
  sort: SortOrder;
};

export const EMPTY_FILTERS: ConversationFilters = {
  q: null,
  status: [],
  outcome: [],
  intent: [],
  channel: [],
  from: null,
  to: null,
  unreviewedOnly: false,
  sort: "newest",
};

async function collection(): Promise<Collection<Document>> {
  return (await getDb()).collection(COLLECTIONS.conversations);
}

/* ------------------------------------------------------------------ */
/* Query construction                                                  */
/* ------------------------------------------------------------------ */

/** Escapes a user-typed string so it cannot inject regex syntax. */
function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Builds the Mongo filter for a set of console filters.
 *
 * Every facet combination is a single indexed query — there is no
 * per-combination index to declare and no in-memory filtering pass, so
 * results and counts are always exact.
 *
 * Search is a case-insensitive substring match across the patient name,
 * doctor name and phone digits: typing "meht" finds "Mehta". At this scale a
 * regex is the right tool; past a few hundred thousand conversations, swap
 * the `$or` below for an Atlas Search index without changing any caller.
 */
function buildFilter(
  clinicId: string,
  filters: ConversationFilters,
): Filter<Document> {
  const query: Filter<Document> = { clinicId };

  if (filters.status.length > 0) query.status = { $in: filters.status };
  if (filters.outcome.length > 0) query.outcome = { $in: filters.outcome };
  if (filters.intent.length > 0) query.primaryIntent = { $in: filters.intent };
  if (filters.channel.length > 0) query.channel = { $in: filters.channel };
  if (filters.unreviewedOnly) query.reviewedBy = null;

  /*
   * Date comparisons go through `$toDate` rather than comparing `startedAt`
   * directly.
   *
   * The agent writes ISO 8601 strings; the seed script and the ingest endpoint
   * write BSON Dates. MongoDB compares across BSON types by type order, not by
   * value, so `{ startedAt: { $gte: new Date(...) } }` silently matches no
   * agent-written conversation at all. Coercing both sides makes the range
   * correct whichever way a document was written.
   */
  const range: Document[] = [];
  if (filters.from) {
    range.push({ $gte: [{ $toDate: "$startedAt" }, new Date(filters.from)] });
  }
  if (filters.to) {
    range.push({ $lte: [{ $toDate: "$startedAt" }, new Date(filters.to)] });
  }
  if (range.length > 0) query.$expr = { $and: range };

  const term = filters.q?.trim();
  if (term) {
    const pattern = new RegExp(escapeRegex(term), "i");
    // Both spellings, because the agent writes the patient flat
    // (`patientName` / `phone`) while the seed and the ingest endpoint nest it
    // under `patient`. Normalization happens when a document is read, which is
    // too late to help a query.
    const conditions: Filter<Document>[] = [
      { "patient.name": pattern },
      { patientName: pattern },
      { doctorName: pattern },
    ];
    // A mostly-numeric query is a phone lookup. Matching the digits alone
    // lets "98765 43210" and "9876543210" find the same person.
    const digits = term.replace(/\D/g, "");
    if (digits.length >= 3) {
      const digitPattern = new RegExp(escapeRegex(digits));
      conditions.push({ "patient.phone": digitPattern }, { phone: digitPattern });
    }
    query.$or = conditions;
  }

  return query;
}

/**
 * Brings an agent-written document up to the shape the console reads.
 *
 * The agent (reizn7/clinic-ai-agent) writes the contract's required fields but
 * not the ones the console derives, and it stores the patient flat rather than
 * nested. Rather than demand it change — and rather than reject its documents
 * outright — the console fills the gaps here, computing counts, duration,
 * preview and tool stats from the embedded messages with the same helper the
 * ingest endpoint uses.
 *
 * A document that already has these fields (seeded, or ingested over HTTP) is
 * passed through untouched.
 */
function normalizeAgentDocument(doc: Document): Document {
  // Already in console shape.
  if (doc.patient && typeof doc.messageCount === "number") return doc;

  const messages = Array.isArray(doc.messages) ? doc.messages : [];

  const derived = deriveConversationFields({
    messages: messages.map((message: Document) => ({
      role: message.role ?? "agent",
      type: message.type ?? "text",
      content: String(message.content ?? ""),
      timestamp: toIso(message.timestamp) ?? new Date(0).toISOString(),
      latencyMs: typeof message.latencyMs === "number" ? message.latencyMs : null,
      tool: message.tool ?? null,
    })),
    fallbackStartedAt: toIso(doc.startedAt) ?? new Date().toISOString(),
  });

  return {
    ...doc,
    patient: doc.patient ?? {
      name: doc.patientName ?? "Unknown",
      phone: doc.phone ?? "",
      email: null,
      isReturning: false,
    },
    // The analytics sweeper fills these in after a conversation closes; until
    // then the console shows a conversation with no summary rather than none
    // at all.
    summary: typeof doc.summary === "string" ? doc.summary : "",
    sentiment: doc.sentiment ?? "neutral",
    language: doc.language ?? "en",
    durationSec: doc.durationSec ?? derived.durationSec,
    messageCount: doc.messageCount ?? derived.messageCount,
    patientMessageCount: doc.patientMessageCount ?? derived.patientMessageCount,
    agentMessageCount: doc.agentMessageCount ?? derived.agentMessageCount,
    avgAgentLatencyMs: doc.avgAgentLatencyMs ?? derived.avgAgentLatencyMs,
    lastMessagePreview: doc.lastMessagePreview ?? derived.lastMessagePreview,
    toolStats: doc.toolStats ?? derived.toolStats,
    escalatedAt: doc.escalatedAt ?? (doc.escalated ? doc.endedAt : null),
    escalated: doc.escalated ?? false,
    outcome: doc.outcome ?? "no_resolution",
    primaryIntent: doc.primaryIntent ?? "other",
    intents: doc.intents ?? [],
    tags: doc.tags ?? [],
    reviewedBy: doc.reviewedBy ?? null,
    reviewedAt: doc.reviewedAt ?? null,
    staffNote: doc.staffNote ?? null,
  };
}

/** Accepts a Date or an ISO string and returns an ISO string. */
function toIso(value: unknown): string | null {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
  }
  return null;
}

function parseConversation(doc: Document): Conversation | null {
  const { _id, ...rest } = normalizeAgentDocument(doc);
  const parsed = conversationSchema.safeParse({ id: String(_id), ...rest });
  if (!parsed.success) {
    // One malformed document must not take down the whole page. Log it with
    // its id so it can be found and fixed, and skip it.
    console.error(
      `[conversations] ${String(_id)} does not match the expected shape:`,
      parsed.error.issues,
    );
    return null;
  }
  return parsed.data;
}

/* ------------------------------------------------------------------ */
/* Reads                                                               */
/* ------------------------------------------------------------------ */

export type ConversationPage = {
  conversations: Conversation[];
  /** Exact total for the current filters. Mongo counts cheaply. */
  total: number;
  page: number;
  pageCount: number;
};

export async function listConversations(
  clinicId: string,
  filters: ConversationFilters,
  page: number,
): Promise<ConversationPage> {
  const conversations = await collection();
  const query = buildFilter(clinicId, filters);
  const direction: 1 | -1 = filters.sort === "oldest" ? 1 : -1;

  const total = await conversations.countDocuments(query);
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  // A page number past the end (a stale bookmark, or rows deleted since)
  // should show the last page rather than an empty table.
  const safePage = Math.min(Math.max(1, page), pageCount);

  // Sorting has the same mixed-type problem as filtering: a plain sort on
  // `startedAt` would group every string-dated document apart from every
  // Date-dated one, because BSON orders by type before value. Projecting a
  // real Date first makes one chronological list out of both.
  const docs = await conversations
    .aggregate([
      { $match: query },
      { $addFields: { _startedAt: { $toDate: "$startedAt" } } },
      // `_id` is the tiebreak so conversations sharing a startedAt cannot be
      // skipped or repeated across page boundaries.
      { $sort: { _startedAt: direction, _id: direction } },
      { $skip: (safePage - 1) * PAGE_SIZE },
      { $limit: PAGE_SIZE },
      { $unset: "_startedAt" },
    ])
    .toArray();

  return {
    conversations: docs
      .map(parseConversation)
      .filter((entry): entry is Conversation => entry !== null),
    total,
    page: safePage,
    pageCount,
  };
}

/**
 * Whether the clinic has any conversations at all.
 *
 * Lets the empty state tell "nothing has been ingested yet — run the seed
 * script" apart from "nothing matches these filters", which need different
 * next steps.
 */
export async function clinicHasAnyConversations(
  clinicId: string,
): Promise<boolean> {
  const count = await (await collection()).countDocuments({ clinicId }, { limit: 1 });
  return count > 0;
}

export async function getConversationById(
  clinicId: string,
  id: string,
): Promise<Conversation | null> {
  if (!ObjectId.isValid(id)) return null;
  // The clinicId is part of the query, so a conversation belonging to another
  // clinic reads as missing rather than forbidden — the caller turns this
  // into notFound() and the page cannot leak that it exists.
  const doc = await (await collection()).findOne({
    _id: new ObjectId(id),
    clinicId,
  });
  return doc ? parseConversation(doc) : null;
}

export async function getMessages(
  clinicId: string,
  conversationId: string,
): Promise<Message[]> {
  if (!ObjectId.isValid(conversationId)) return [];
  const doc = await (await collection()).findOne(
    { _id: new ObjectId(conversationId), clinicId },
    { projection: { messages: 1 } },
  );
  if (!doc || !Array.isArray(doc.messages)) return [];

  const messages: Message[] = [];
  doc.messages.forEach((raw: unknown, index: number) => {
    const parsed = messageSchema.safeParse({
      // Messages are embedded rather than a separate collection: they are
      // only ever read with their conversation, are bounded in size, and this
      // way a transcript is one round trip instead of two.
      id: `${conversationId}-${index}`,
      ...(typeof raw === "object" && raw !== null ? raw : {}),
    });
    if (parsed.success) {
      messages.push(parsed.data);
    } else {
      console.error(
        `[messages] ${conversationId}[${index}] does not match the expected shape:`,
        parsed.error.issues,
      );
    }
  });

  return messages.sort(
    (a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp),
  );
}

/**
 * The conversations immediately before and after this one within the current
 * filter set, so a reviewer can work through a queue without going back to
 * the list.
 */
export async function getAdjacentConversations(
  clinicId: string,
  current: Conversation,
  filters: ConversationFilters,
): Promise<{ previous: Conversation | null; next: Conversation | null }> {
  const conversations = await collection();
  const base = buildFilter(clinicId, filters);
  const descending = filters.sort !== "oldest";
  const startedAt = new Date(current.startedAt);
  const id = new ObjectId(current.id);

  // "Next" means further down the list as displayed, which with the default
  // newest-first sort is an older conversation.
  const after = descending ? "$lt" : "$gt";
  const before = descending ? "$gt" : "$lt";

  // Same mixed-type issue as the list query, so the comparison and the sort
  // both run against a coerced Date.
  const neighbor = async (
    operator: "$lt" | "$gt",
    direction: 1 | -1,
  ): Promise<Conversation | null> => {
    const [doc] = await conversations
      .aggregate([
        { $match: base },
        { $addFields: { _startedAt: { $toDate: "$startedAt" } } },
        {
          $match: {
            $or: [
              { _startedAt: { [operator]: startedAt } },
              { _startedAt: startedAt, _id: { [operator]: id } },
            ],
          },
        },
        { $sort: { _startedAt: direction, _id: direction } },
        { $limit: 1 },
        { $unset: "_startedAt" },
      ])
      .toArray();
    return doc ? parseConversation(doc) : null;
  };

  const [previous, next] = await Promise.all([
    neighbor(before, descending ? 1 : -1),
    neighbor(after, descending ? -1 : 1),
  ]);

  return { previous, next };
}

/**
 * Every conversation in a date range, for the analytics page.
 *
 * Deliberately separate from `listConversations`: §9 keeps fetching and
 * aggregating apart so the source can be swapped for pre-aggregated rollups
 * later without touching the aggregation or the UI. `limit` is a safety
 * valve, not pagination — the caller reports truncation.
 */
export async function getConversationsInRange(
  clinicId: string,
  fromIso: string,
  toIso: string,
  limit = 20000,
): Promise<{ conversations: Conversation[]; truncated: boolean }> {
  const docs = await (await collection())
    .aggregate([
      { $match: { clinicId } },
      { $addFields: { _startedAt: { $toDate: "$startedAt" } } },
      {
        $match: {
          _startedAt: { $gte: new Date(fromIso), $lte: new Date(toIso) },
        },
      },
      { $sort: { _startedAt: -1 } },
      { $limit: limit + 1 },
      { $unset: "_startedAt" },
    ])
    .toArray();

  return {
    conversations: docs
      .slice(0, limit)
      .map(parseConversation)
      .filter((entry): entry is Conversation => entry !== null),
    truncated: docs.length > limit,
  };
}

/* ------------------------------------------------------------------ */
/* Writes                                                              */
/* ------------------------------------------------------------------ */

/**
 * The console is read-only apart from these two staff annotations. Both match
 * on clinicId as well as id, so a guessed document id from another clinic
 * cannot be written to.
 */
export async function setStaffNote(
  clinicId: string,
  id: string,
  note: string,
): Promise<void> {
  const trimmed = note.trim();
  await update(clinicId, id, {
    staffNote: trimmed.length > 0 ? trimmed : null,
  });
}

export async function setReviewed(
  clinicId: string,
  id: string,
  userId: string,
  reviewed: boolean,
): Promise<void> {
  await update(clinicId, id, {
    reviewedBy: reviewed ? userId : null,
    reviewedAt: reviewed ? new Date() : null,
  });
}

async function update(
  clinicId: string,
  id: string,
  patch: Document,
): Promise<void> {
  if (!ObjectId.isValid(id)) throw new Error("Conversation not found.");
  const result = await (await collection()).updateOne(
    { _id: new ObjectId(id), clinicId },
    { $set: patch },
  );
  if (result.matchedCount === 0) throw new Error("Conversation not found.");
}

/**
 * Creates or updates a conversation delivered by the agent.
 *
 * Idempotent on `externalId`: re-delivering the same conversation updates it
 * in place rather than producing a duplicate, which matters because an agent
 * that times out mid-POST will retry.
 */
export async function upsertIngestedConversation(
  clinicId: string,
  externalId: string,
  document: Document,
): Promise<{ id: string; created: boolean }> {
  const result = await (await collection()).findOneAndUpdate(
    { clinicId, externalId },
    {
      $set: { ...document, clinicId, externalId },
      // Preserve staff annotations across a re-delivery — a reviewer's note
      // must not be wiped by the agent resending the transcript.
      $setOnInsert: { reviewedBy: null, reviewedAt: null, staffNote: null },
    },
    { upsert: true, returnDocument: "after", includeResultMetadata: true },
  );

  const id = String(result.value?._id ?? "");
  return { id, created: result.lastErrorObject?.updatedExisting !== true };
}

/** Indexes the list and analytics queries depend on. Run by `npm run db:setup`. */
export async function ensureConversationIndexes(): Promise<void> {
  const conversations = await collection();
  await Promise.all([
    conversations.createIndex({ clinicId: 1, startedAt: -1 }),
    conversations.createIndex({ clinicId: 1, outcome: 1, startedAt: -1 }),
    conversations.createIndex({ clinicId: 1, status: 1, startedAt: -1 }),
    conversations.createIndex({ clinicId: 1, primaryIntent: 1, startedAt: -1 }),
    conversations.createIndex({ clinicId: 1, channel: 1, startedAt: -1 }),
    conversations.createIndex({ clinicId: 1, escalated: 1, startedAt: -1 }),
    conversations.createIndex({ clinicId: 1, reviewedBy: 1, startedAt: -1 }),
    conversations.createIndex({ "patient.phone": 1 }),
    /*
     * Ingestion is idempotent on the agent's own id.
     *
     * A *partial* index, not a sparse one: sparse still indexes a field that
     * is present and null, so two documents written with `externalId: null`
     * would collide.
     *
     * Note the agent creates its own plain unique index on the same field
     * (`uniq_externalId`). Mongo will not build two indexes on one key with
     * different options, so whichever runs first wins. Under the agent's
     * index a *missing* externalId also counts as null, which is why the seed
     * script now writes a distinct id for every conversation instead of null.
     */
    conversations
      .createIndex(
        { externalId: 1 },
        {
          unique: true,
          partialFilterExpression: { externalId: { $type: "string" } },
          name: "externalId_unique",
        },
      )
      .catch((error: unknown) => {
        // The agent already created an equivalent index under its own name.
        console.warn(
          "[db] externalId index already exists with different options; " +
            "keeping the existing one.",
          error,
        );
      }),
  ]);
}
