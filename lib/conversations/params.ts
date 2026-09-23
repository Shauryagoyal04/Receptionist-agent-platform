import { z } from "zod";

import {
  CHANNELS,
  CONVERSATION_STATUSES,
  INTENT_IDS,
  OUTCOMES,
  type Channel,
  type ConversationStatus,
  type IntentId,
  type Outcome,
} from "@/lib/types";
import {
  addDaysToDateKey,
  isDateOnly,
  zonedEndOfDay,
  zonedStartOfDay,
  zonedToday,
} from "@/lib/time";
import type { ConversationFilters, SortOrder } from "@/lib/data/conversations";

/*
 * The conversations list keeps all of its state in the query string, so a view
 * is shareable, the back button restores the previous filters, and the page
 * stays a Server Component.
 *
 *   ?q=&status=&outcome=&intent=&channel=&from=&to=&cursor=&sort=&unreviewed=
 *
 * Multi-select facets are comma-separated. Dates are plain `YYYY-MM-DD` on the
 * clinic's calendar, converted to UTC instants at the edges of the day here so
 * the rest of the app only ever deals in absolute times.
 */

export type RawSearchParams = Record<string, string | string[] | undefined>;

/** Date-range presets offered next to the custom pickers. */
export const RANGE_PRESETS = [
  { days: 7, label: "7 days" },
  { days: 30, label: "30 days" },
  { days: 90, label: "90 days" },
] as const;

export const DEFAULT_RANGE_DAYS = 30;

function first(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

/**
 * Reads a comma-separated facet, keeping only values in the closed union.
 *
 * An unknown value is dropped rather than rejected: a stale bookmark pointing
 * at a renamed outcome should show a slightly wider list, not an error page.
 */
function facet<T extends string>(
  raw: string | string[] | undefined,
  allowed: readonly T[],
): T[] {
  const value = first(raw);
  if (!value) return [];
  const allowedSet = new Set<string>(allowed);
  const seen = new Set<T>();
  for (const part of value.split(",")) {
    const trimmed = part.trim();
    if (allowedSet.has(trimmed)) seen.add(trimmed as T);
  }
  return [...seen];
}

const dateKeySchema = z.string().refine(isDateOnly);

/** The filter state as it appears in the URL, before timezone resolution. */
export type UrlFilterState = {
  q: string;
  status: ConversationStatus[];
  outcome: Outcome[];
  intent: IntentId[];
  channel: Channel[];
  from: string;
  to: string;
  unreviewedOnly: boolean;
  sort: SortOrder;
};

export function parseUrlFilters(
  raw: RawSearchParams,
  timeZone: string,
  now = new Date(),
): UrlFilterState {
  const today = zonedToday(timeZone, now);

  const parsedFrom = dateKeySchema.safeParse(first(raw.from));
  const parsedTo = dateKeySchema.safeParse(first(raw.to));

  let from = parsedFrom.success ? parsedFrom.data : "";
  let to = parsedTo.success ? parsedTo.data : "";

  // Only one end supplied: treat the other as open, anchored at today.
  if (from && !to) to = today;
  if (!from && to) from = addDaysToDateKey(to, -(DEFAULT_RANGE_DAYS - 1));
  // A reversed range is a typo, not an empty result set.
  if (from && to && from > to) [from, to] = [to, from];

  const sortRaw = first(raw.sort);

  return {
    q: (first(raw.q) ?? "").trim(),
    status: facet(raw.status, CONVERSATION_STATUSES),
    outcome: facet(raw.outcome, OUTCOMES),
    intent: facet(raw.intent, INTENT_IDS),
    channel: facet(raw.channel, CHANNELS),
    from,
    to,
    unreviewedOnly: first(raw.unreviewed) === "1",
    sort: sortRaw === "oldest" ? "oldest" : "newest",
  };
}

/** Turns the URL state into the absolute-time filters the data layer takes. */
export function toDataFilters(
  state: UrlFilterState,
  timeZone: string,
): ConversationFilters {
  return {
    q: state.q.length > 0 ? state.q : null,
    status: state.status,
    outcome: state.outcome,
    intent: state.intent,
    channel: state.channel,
    from: state.from ? zonedStartOfDay(state.from, timeZone) : null,
    to: state.to ? zonedEndOfDay(state.to, timeZone) : null,
    unreviewedOnly: state.unreviewedOnly,
    sort: state.sort,
  };
}

export function hasActiveUrlFilters(state: UrlFilterState): boolean {
  return (
    state.q.length > 0 ||
    state.status.length > 0 ||
    state.outcome.length > 0 ||
    state.intent.length > 0 ||
    state.channel.length > 0 ||
    state.from.length > 0 ||
    state.to.length > 0 ||
    state.unreviewedOnly ||
    state.sort !== "newest"
  );
}

/**
 * Serializes filter state back to a query string.
 *
 * Defaults are omitted so the common case produces a clean `/conversations`
 * URL rather than a wall of empty parameters. `cursor` is never carried over
 * by a filter change — the old cursor points into a differently-filtered
 * result set, and reusing it would silently skip rows.
 */
export function buildQueryString(
  state: UrlFilterState,
  extra: { cursors?: string[] } = {},
): string {
  const params = new URLSearchParams();

  if (state.q) params.set("q", state.q);
  if (state.status.length > 0) params.set("status", state.status.join(","));
  if (state.outcome.length > 0) params.set("outcome", state.outcome.join(","));
  if (state.intent.length > 0) params.set("intent", state.intent.join(","));
  if (state.channel.length > 0) params.set("channel", state.channel.join(","));
  if (state.from) params.set("from", state.from);
  if (state.to) params.set("to", state.to);
  if (state.unreviewedOnly) params.set("unreviewed", "1");
  if (state.sort !== "newest") params.set("sort", state.sort);
  if (extra.cursors && extra.cursors.length > 0) {
    params.set("cursor", extra.cursors.join(","));
  }

  const query = params.toString();
  return query.length > 0 ? `?${query}` : "";
}

/** Which preset, if any, the current range corresponds to. */
export function activePreset(
  state: UrlFilterState,
  timeZone: string,
  now = new Date(),
): number | null {
  if (!state.from || !state.to) return null;
  const today = zonedToday(timeZone, now);
  if (state.to !== today) return null;
  for (const preset of RANGE_PRESETS) {
    if (state.from === addDaysToDateKey(today, -(preset.days - 1))) {
      return preset.days;
    }
  }
  return null;
}

export function presetRange(
  days: number,
  timeZone: string,
  now = new Date(),
): { from: string; to: string } {
  const today = zonedToday(timeZone, now);
  return { from: addDaysToDateKey(today, -(days - 1)), to: today };
}

/**
 * The cursors for every page walked so far, oldest first.
 *
 * Firestore cursors only move forward, so "Previous" is implemented by
 * remembering the path taken rather than by querying backwards. The last
 * entry is the cursor for the page currently shown; dropping it yields the
 * previous page, and it lands on exactly the rows that were shown before
 * rather than re-deriving them from a result set that may have shifted.
 */
export function parseCursorStack(raw: string | string[] | undefined): string[] {
  const value = first(raw);
  if (!value) return [];
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => /^[A-Za-z0-9_-]+$/.test(entry));
}
