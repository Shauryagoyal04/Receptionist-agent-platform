import "server-only";

import {
  FieldPath,
  Timestamp,
  type CollectionReference,
  type Query,
} from "firebase-admin/firestore";

import { adminDb } from "@/lib/firebase/admin";
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
import { normalizeSearchQuery } from "@/lib/utils";

const CONVERSATIONS = "conversations";
const MESSAGES = "messages";

/** Rows shown per page in the conversations table. */
export const PAGE_SIZE = 25;

/**
 * How many documents a single page request may read before giving up.
 *
 * Firestore can only serve one facet server-side per query (see
 * `applyServerFilters`), so the rest are applied while walking cursor pages.
 * This caps that walk: a pathological filter combination costs a bounded
 * number of reads and reports itself as truncated rather than degrading into
 * a full-collection scan.
 */
const SCAN_CAP = 600;

/** Documents fetched per underlying Firestore round trip during that walk. */
const SCAN_BATCH = 100;

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

export function hasActiveFilters(filters: ConversationFilters): boolean {
  return (
    filters.q !== null ||
    filters.status.length > 0 ||
    filters.outcome.length > 0 ||
    filters.intent.length > 0 ||
    filters.channel.length > 0 ||
    filters.from !== null ||
    filters.to !== null ||
    filters.unreviewedOnly
  );
}

/* ------------------------------------------------------------------ */
/* Cursors                                                             */
/* ------------------------------------------------------------------ */

export type Cursor = { startedAt: string; id: string };

export function encodeCursor(cursor: Cursor): string {
  return Buffer.from(`${cursor.startedAt}|${cursor.id}`, "utf8").toString(
    "base64url",
  );
}

export function decodeCursor(raw: string | null): Cursor | null {
  if (!raw) return null;
  try {
    const decoded = Buffer.from(raw, "base64url").toString("utf8");
    const separator = decoded.indexOf("|");
    if (separator === -1) return null;
    const startedAt = decoded.slice(0, separator);
    const id = decoded.slice(separator + 1);
    if (!id || Number.isNaN(new Date(startedAt).getTime())) return null;
    return { startedAt, id };
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* Query construction                                                  */
/* ------------------------------------------------------------------ */

function collection(): CollectionReference {
  return adminDb().collection(CONVERSATIONS);
}

/**
 * Builds the server-side portion of the query.
 *
 * Firestore allows one `array-contains` and one `in` per query, and a
 * composite index must exist for every (equality fields…, range field)
 * combination. Rather than enumerate 2^n indexes, exactly one facet is pushed
 * to the server and the caller applies the rest in memory:
 *
 *   - when a search term is present it wins, because it is by far the most
 *     selective thing a receptionist can type;
 *   - otherwise the first active facet in a fixed priority order is used.
 *
 * Every combination this produces is covered by firestore.indexes.json.
 */
function applyServerFilters(
  filters: ConversationFilters,
  clinicId: string,
): { query: Query; serverSide: Set<keyof ConversationFilters> } {
  let query: Query = collection().where("clinicId", "==", clinicId);
  const serverSide = new Set<keyof ConversationFilters>();

  const searchToken = filters.q ? normalizeSearchQuery(filters.q) : null;

  if (searchToken) {
    query = query.where("searchTokens", "array-contains", searchToken);
    serverSide.add("q");
  } else if (filters.unreviewedOnly) {
    query = query.where("reviewedBy", "==", null);
    serverSide.add("unreviewedOnly");
  } else if (filters.status.length > 0) {
    query = query.where("status", "in", filters.status.slice(0, 30));
    serverSide.add("status");
  } else if (filters.outcome.length > 0) {
    query = query.where("outcome", "in", filters.outcome.slice(0, 30));
    serverSide.add("outcome");
  } else if (filters.intent.length > 0) {
    query = query.where("primaryIntent", "in", filters.intent.slice(0, 30));
    serverSide.add("intent");
  } else if (filters.channel.length > 0) {
    query = query.where("channel", "in", filters.channel.slice(0, 30));
    serverSide.add("channel");
  }

  if (filters.from) {
    query = query.where(
      "startedAt",
      ">=",
      Timestamp.fromDate(new Date(filters.from)),
    );
  }
  if (filters.to) {
    query = query.where(
      "startedAt",
      "<=",
      Timestamp.fromDate(new Date(filters.to)),
    );
  }

  const direction = filters.sort === "oldest" ? "asc" : "desc";
  query = query
    .orderBy("startedAt", direction)
    // Ties on startedAt would make the cursor ambiguous and could skip or
    // repeat a row across pages, so the document id is an explicit tiebreak.
    .orderBy(FieldPath.documentId(), direction);

  return { query, serverSide };
}

/** Applies the facets that could not be pushed to Firestore. */
function matchesInMemory(
  conversation: Conversation,
  filters: ConversationFilters,
  serverSide: Set<keyof ConversationFilters>,
): boolean {
  if (
    !serverSide.has("unreviewedOnly") &&
    filters.unreviewedOnly &&
    conversation.reviewedBy !== null
  ) {
    return false;
  }
  if (
    !serverSide.has("status") &&
    filters.status.length > 0 &&
    !filters.status.includes(conversation.status)
  ) {
    return false;
  }
  if (
    !serverSide.has("outcome") &&
    filters.outcome.length > 0 &&
    !filters.outcome.includes(conversation.outcome)
  ) {
    return false;
  }
  if (
    !serverSide.has("intent") &&
    filters.intent.length > 0 &&
    !filters.intent.includes(conversation.primaryIntent)
  ) {
    return false;
  }
  if (
    !serverSide.has("channel") &&
    filters.channel.length > 0 &&
    !filters.channel.includes(conversation.channel)
  ) {
    return false;
  }
  return true;
}

function parseConversation(
  id: string,
  data: FirebaseFirestore.DocumentData,
): Conversation | null {
  const parsed = conversationSchema.safeParse({ id, ...data });
  if (!parsed.success) {
    // One malformed document must not take down the whole page. Log it with
    // its id so it can be found and fixed, and skip it.
    console.error(
      `[conversations] ${id} does not match the expected shape:`,
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
  nextCursor: string | null;
  /** True when the scan cap stopped the walk before the range was exhausted. */
  truncated: boolean;
};

export async function listConversations(
  clinicId: string,
  filters: ConversationFilters,
  cursor: Cursor | null,
): Promise<ConversationPage> {
  const { query, serverSide } = applyServerFilters(filters, clinicId);

  const matched: Conversation[] = [];
  let scanned = 0;
  let truncated = false;
  let after: [Timestamp, string] | null = cursor
    ? [Timestamp.fromDate(new Date(cursor.startedAt)), cursor.id]
    : null;

  // One extra row tells us whether a next page exists without counting.
  while (matched.length <= PAGE_SIZE) {
    if (scanned >= SCAN_CAP) {
      truncated = true;
      break;
    }

    let batchQuery = query.limit(SCAN_BATCH);
    if (after) batchQuery = batchQuery.startAfter(...after);

    const snapshot = await batchQuery.get();
    if (snapshot.empty) break;

    for (const doc of snapshot.docs) {
      scanned += 1;
      const conversation = parseConversation(doc.id, doc.data());
      if (conversation && matchesInMemory(conversation, filters, serverSide)) {
        matched.push(conversation);
      }
    }

    const last = snapshot.docs[snapshot.docs.length - 1];
    after = [last.get("startedAt") as Timestamp, last.id];

    if (snapshot.docs.length < SCAN_BATCH) break;
  }

  const hasMore = matched.length > PAGE_SIZE;
  const conversations = matched.slice(0, PAGE_SIZE);
  const lastRow = conversations[conversations.length - 1];

  return {
    conversations,
    nextCursor:
      hasMore && lastRow
        ? encodeCursor({ startedAt: lastRow.startedAt, id: lastRow.id })
        : null,
    truncated,
  };
}

/**
 * Whether the clinic has any conversations at all.
 *
 * Lets the empty state tell "nothing has been ingested yet — run the seed
 * script" apart from "nothing matches these filters", which need different
 * next steps. Uses an aggregation so it does not read the documents.
 */
export async function clinicHasAnyConversations(
  clinicId: string,
): Promise<boolean> {
  const snapshot = await collection()
    .where("clinicId", "==", clinicId)
    .count()
    .get();
  return snapshot.data().count > 0;
}

export async function getConversationById(
  clinicId: string,
  id: string,
): Promise<Conversation | null> {
  const snapshot = await collection().doc(id).get();
  if (!snapshot.exists) return null;

  const conversation = parseConversation(snapshot.id, snapshot.data() ?? {});
  // A conversation belonging to a different clinic must read as "not found",
  // never as "forbidden" — the caller turns this into notFound().
  if (!conversation || conversation.clinicId !== clinicId) return null;
  return conversation;
}

export async function getMessages(conversationId: string): Promise<Message[]> {
  const snapshot = await collection()
    .doc(conversationId)
    .collection(MESSAGES)
    .orderBy("timestamp", "asc")
    .get();

  const messages: Message[] = [];
  for (const doc of snapshot.docs) {
    const parsed = messageSchema.safeParse({ id: doc.id, ...doc.data() });
    if (parsed.success) {
      messages.push(parsed.data);
    } else {
      console.error(
        `[messages] ${conversationId}/${doc.id} does not match the expected shape:`,
        parsed.error.issues,
      );
    }
  }
  return messages;
}

/**
 * The conversations immediately before and after this one within the current
 * filter set, so a reviewer can work through a queue without going back to
 * the list. Returns null on either side when there is nothing there.
 */
export async function getAdjacentConversations(
  clinicId: string,
  current: Conversation,
  filters: ConversationFilters,
): Promise<{ previous: Conversation | null; next: Conversation | null }> {
  const [previous, next] = await Promise.all([
    findNeighbor(clinicId, current, filters, "previous"),
    findNeighbor(clinicId, current, filters, "next"),
  ]);
  return { previous, next };
}

async function findNeighbor(
  clinicId: string,
  current: Conversation,
  filters: ConversationFilters,
  direction: "previous" | "next",
): Promise<Conversation | null> {
  // "Next" means further down the list as displayed. With the default newest
  // -first sort that is an older conversation, so the traversal direction
  // depends on the active sort.
  const descending = filters.sort !== "oldest";
  const forward = direction === "next" ? descending : !descending;

  const probeFilters: ConversationFilters = {
    ...filters,
    sort: forward ? "newest" : "oldest",
  };

  const { query, serverSide } = applyServerFilters(probeFilters, clinicId);
  const cursorValues: [Timestamp, string] = [
    Timestamp.fromDate(new Date(current.startedAt)),
    current.id,
  ];

  let after: [Timestamp, string] = cursorValues;
  let scanned = 0;

  while (scanned < SCAN_CAP) {
    const snapshot = await query
      .startAfter(...after)
      .limit(SCAN_BATCH)
      .get();
    if (snapshot.empty) return null;

    for (const doc of snapshot.docs) {
      scanned += 1;
      const conversation = parseConversation(doc.id, doc.data());
      if (conversation && matchesInMemory(conversation, filters, serverSide)) {
        return conversation;
      }
    }

    const last = snapshot.docs[snapshot.docs.length - 1];
    after = [last.get("startedAt") as Timestamp, last.id];
    if (snapshot.docs.length < SCAN_BATCH) return null;
  }

  return null;
}

/**
 * Every conversation in a date range, for the analytics page.
 *
 * Deliberately separate from `listConversations`: §9 keeps fetching and
 * aggregating apart so the source can be swapped for daily rollups later
 * without touching the aggregation or the UI. `limit` is a safety valve, not
 * a pagination mechanism — the caller reports truncation.
 */
export async function getConversationsInRange(
  clinicId: string,
  fromIso: string,
  toIso: string,
  limit = 5000,
): Promise<{ conversations: Conversation[]; truncated: boolean }> {
  const snapshot = await collection()
    .where("clinicId", "==", clinicId)
    .where("startedAt", ">=", Timestamp.fromDate(new Date(fromIso)))
    .where("startedAt", "<=", Timestamp.fromDate(new Date(toIso)))
    .orderBy("startedAt", "desc")
    .limit(limit + 1)
    .get();

  const conversations: Conversation[] = [];
  for (const doc of snapshot.docs.slice(0, limit)) {
    const conversation = parseConversation(doc.id, doc.data());
    if (conversation) conversations.push(conversation);
  }

  return { conversations, truncated: snapshot.docs.length > limit };
}

/* ------------------------------------------------------------------ */
/* Writes                                                              */
/* ------------------------------------------------------------------ */

/**
 * The console is read-only apart from these two staff annotations. Both take
 * a clinicId and verify it, so a guessed document id from another clinic
 * cannot be written to.
 */
export async function setStaffNote(
  clinicId: string,
  id: string,
  note: string,
): Promise<void> {
  const trimmed = note.trim();
  await updateOwnedConversation(clinicId, id, {
    staffNote: trimmed.length > 0 ? trimmed : null,
  });
}

export async function setReviewed(
  clinicId: string,
  id: string,
  uid: string,
  reviewed: boolean,
): Promise<void> {
  await updateOwnedConversation(clinicId, id, {
    reviewedBy: reviewed ? uid : null,
    reviewedAt: reviewed ? Timestamp.now() : null,
  });
}

async function updateOwnedConversation(
  clinicId: string,
  id: string,
  data: FirebaseFirestore.UpdateData<FirebaseFirestore.DocumentData>,
): Promise<void> {
  const ref = collection().doc(id);
  await adminDb().runTransaction(async (tx) => {
    const snapshot = await tx.get(ref);
    if (!snapshot.exists || snapshot.get("clinicId") !== clinicId) {
      throw new Error("Conversation not found.");
    }
    tx.update(ref, data);
  });
}
