import { median } from "@/lib/utils";
import { addDaysToDateKey, zonedDayKey, zonedHour } from "@/lib/time";
import {
  CHANNELS,
  INTENT_IDS,
  OUTCOMES,
  SENTIMENTS,
  type Channel,
  type Conversation,
  type IntentId,
  type Outcome,
  type Sentiment,
} from "@/lib/types";

/*
 * All analytics aggregation, as one pure function over an array of
 * conversations.
 *
 * Fetching and computing are kept apart on purpose: when on-demand
 * aggregation stops being fast enough, pre-aggregated daily rollups become a
 * new fetcher producing this same `AnalyticsSummary`, and neither this module
 * nor any chart has to change.
 *
 * Being pure also means the numbers are testable without a database, which is
 * how the figures here are checked against hand-computed values.
 */

export type DayBucket = {
  day: string;
  total: number;
  escalated: number;
  negative: number;
};

export type CountShare<T> = {
  key: T;
  count: number;
  share: number;
};

export type EscalationRow = {
  id: string;
  patientName: string;
  reason: string;
  startedAt: string;
};

export type ToolReliabilityRow = {
  name: string;
  calls: number;
  errors: number;
  successRate: number;
  medianDurationMs: number;
};

export type AnalyticsSummary = {
  range: { from: string; to: string; days: number };
  total: number;
  escalated: number;
  booked: number;
  /** 1 − escalated/total. The headline number. */
  resolvedWithoutHumanRate: number;
  medianDurationSec: number;
  avgMessagesPerConversation: number;
  byOutcome: CountShare<Outcome>[];
  byIntent: CountShare<IntentId>[];
  byChannel: CountShare<Channel>[];
  bySentiment: CountShare<Sentiment>[];
  /** One entry per day in the range, including days with no conversations. */
  days: DayBucket[];
  /** 24 entries, indexed by hour on the clinic's wall clock. */
  hours: number[];
  recentEscalations: EscalationRow[];
  toolReliability: ToolReliabilityRow[];
};

function tally<T extends string>(
  conversations: Conversation[],
  keys: readonly T[],
  keyOf: (conversation: Conversation) => T,
): CountShare<T>[] {
  const counts = new Map<T, number>(keys.map((key) => [key, 0]));
  for (const conversation of conversations) {
    const key = keyOf(conversation);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const total = conversations.length;
  return keys.map((key) => {
    const count = counts.get(key) ?? 0;
    return { key, count, share: total > 0 ? count / total : 0 };
  });
}

export function aggregate(
  conversations: Conversation[],
  options: { from: string; to: string; timeZone: string },
): AnalyticsSummary {
  const { from, to, timeZone } = options;
  const total = conversations.length;

  const escalated = conversations.filter((c) => c.escalated).length;
  const booked = conversations.filter(
    (c) => c.outcome === "appointment_booked",
  ).length;

  // Every day in the range is seeded at zero first. A chart that silently
  // skips quiet days compresses the x-axis and makes a gap look like a dip.
  const days = new Map<string, DayBucket>();
  for (let day = from; day <= to; day = addDaysToDateKey(day, 1)) {
    days.set(day, { day, total: 0, escalated: 0, negative: 0 });
  }

  const hours = Array.from({ length: 24 }, () => 0);

  for (const conversation of conversations) {
    const day = zonedDayKey(conversation.startedAt, timeZone);
    const bucket = days.get(day);
    if (bucket) {
      bucket.total += 1;
      if (conversation.escalated) bucket.escalated += 1;
      if (conversation.sentiment === "negative") bucket.negative += 1;
    }
    hours[zonedHour(conversation.startedAt, timeZone)] += 1;
  }

  const recentEscalations = conversations
    .filter((c) => c.escalated)
    .sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt))
    .slice(0, 8)
    .map((c) => ({
      id: c.id,
      patientName: c.patient.name,
      reason: c.escalationReason ?? "No reason recorded",
      startedAt: c.startedAt,
    }));

  return {
    range: { from, to, days: days.size },
    total,
    escalated,
    booked,
    resolvedWithoutHumanRate: total > 0 ? 1 - escalated / total : 0,
    medianDurationSec: median(conversations.map((c) => c.durationSec)),
    avgMessagesPerConversation:
      total > 0
        ? conversations.reduce((sum, c) => sum + c.messageCount, 0) / total
        : 0,
    byOutcome: tally(conversations, OUTCOMES, (c) => c.outcome),
    byIntent: tally(conversations, INTENT_IDS, (c) => c.primaryIntent),
    byChannel: tally(conversations, CHANNELS, (c) => c.channel),
    bySentiment: tally(conversations, SENTIMENTS, (c) => c.sentiment),
    days: [...days.values()],
    hours,
    recentEscalations,
    toolReliability: aggregateToolReliability(conversations),
  };
}

/**
 * Tool reliability, read from the `toolStats` denormalized onto each
 * conversation at write time rather than by walking every transcript.
 */
function aggregateToolReliability(
  conversations: Conversation[],
): ToolReliabilityRow[] {
  const merged = new Map<
    string,
    { calls: number; errors: number; durations: number[] }
  >();

  for (const conversation of conversations) {
    for (const [name, stat] of Object.entries(conversation.toolStats)) {
      const existing = merged.get(name) ?? {
        calls: 0,
        errors: 0,
        durations: [],
      };
      existing.calls += stat.calls;
      existing.errors += stat.errors;
      // Individual durations are kept so this is a true median. A running sum
      // could only give a mean, and one 30-second timeout would then swamp
      // the figure for an otherwise healthy tool.
      existing.durations.push(...stat.durationsMs);
      merged.set(name, existing);
    }
  }

  return [...merged.entries()]
    .map(([name, stat]) => ({
      name,
      calls: stat.calls,
      errors: stat.errors,
      successRate: stat.calls > 0 ? 1 - stat.errors / stat.calls : 1,
      medianDurationMs: Math.round(median(stat.durations)),
    }))
    .sort((a, b) => b.calls - a.calls);
}

/* ------------------------------------------------------------------ */
/* Period comparison                                                   */
/* ------------------------------------------------------------------ */

export type KpiId =
  | "resolved"
  | "handled"
  | "booked"
  | "escalated"
  | "medianDuration"
  | "avgMessages";

export type Kpi = {
  id: KpiId;
  label: string;
  /** Preformatted for display. */
  value: string;
  /** Fractional change vs the preceding period, or null when undefined. */
  delta: number | null;
  /**
   * Whether an increase is good for this specific metric. Escalations rising
   * is bad; bookings rising is good; messages per conversation rising is bad,
   * because the agent is taking longer to get to the same place.
   */
  increaseIsGood: boolean;
};

function change(current: number, previous: number): number | null {
  // With no prior activity there is no meaningful percentage change — showing
  // "+100%" against a zero baseline overstates a single conversation.
  if (previous === 0) return null;
  return (current - previous) / previous;
}

export function buildKpis(
  current: AnalyticsSummary,
  previous: AnalyticsSummary,
): Kpi[] {
  return [
    {
      id: "resolved",
      label: "Resolved without a human",
      value: `${(current.resolvedWithoutHumanRate * 100).toFixed(1)}%`,
      delta: change(
        current.resolvedWithoutHumanRate,
        previous.resolvedWithoutHumanRate,
      ),
      increaseIsGood: true,
    },
    {
      id: "handled",
      label: "Conversations handled",
      value: current.total.toLocaleString("en-IN"),
      delta: change(current.total, previous.total),
      increaseIsGood: true,
    },
    {
      id: "booked",
      label: "Appointments booked",
      value: current.booked.toLocaleString("en-IN"),
      delta: change(current.booked, previous.booked),
      increaseIsGood: true,
    },
    {
      id: "escalated",
      label: "Escalated to staff",
      value: current.escalated.toLocaleString("en-IN"),
      delta: change(current.escalated, previous.escalated),
      increaseIsGood: false,
    },
    {
      id: "medianDuration",
      label: "Median handling time",
      value: formatSeconds(current.medianDurationSec),
      delta: change(current.medianDurationSec, previous.medianDurationSec),
      increaseIsGood: false,
    },
    {
      id: "avgMessages",
      label: "Messages per conversation",
      value: current.avgMessagesPerConversation.toFixed(1),
      delta: change(
        current.avgMessagesPerConversation,
        previous.avgMessagesPerConversation,
      ),
      increaseIsGood: false,
    },
  ];
}

function formatSeconds(seconds: number): string {
  const safe = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(safe / 60);
  return `${minutes}:${String(safe % 60).padStart(2, "0")}`;
}

/** The equal-length period immediately before the given range. */
export function precedingRange(
  from: string,
  to: string,
): { from: string; to: string } {
  const days = Math.max(
    1,
    Math.round(
      (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) /
        86400000,
    ) + 1,
  );
  return {
    from: addDaysToDateKey(from, -days),
    to: addDaysToDateKey(from, -1),
  };
}
