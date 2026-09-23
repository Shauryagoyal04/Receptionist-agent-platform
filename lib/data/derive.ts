import type { Message, ToolStat } from "@/lib/types";

/*
 * Fields computed from a conversation's messages rather than stored by the
 * caller.
 *
 * Both the seed script and the ingestion endpoint run everything through
 * here. The endpoint in particular must never trust a client-supplied
 * `messageCount` or `durationSec` — they drive the analytics page, so a buggy
 * or hostile agent could otherwise quietly skew every number on it.
 *
 * Search needs no precomputation on MongoDB: the conversations query matches
 * patient and doctor names with a case-insensitive regex directly.
 */

export type DerivableMessage = Pick<
  Message,
  "role" | "type" | "content" | "timestamp" | "latencyMs" | "tool"
>;

export type DerivedFields = {
  startedAt: string;
  endedAt: string | null;
  durationSec: number;
  messageCount: number;
  patientMessageCount: number;
  agentMessageCount: number;
  avgAgentLatencyMs: number;
  lastMessagePreview: string;
  toolStats: Record<string, ToolStat>;
};

const PREVIEW_MAX = 140;

export function deriveConversationFields(input: {
  messages: DerivableMessage[];
  /** Used when the conversation has no messages at all. */
  fallbackStartedAt: string;
}): DerivedFields {
  const ordered = [...input.messages].sort(
    (a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp),
  );

  const first = ordered[0];
  const last = ordered[ordered.length - 1];

  const startedAt = first ? first.timestamp : input.fallbackStartedAt;
  const endedAt = last ? last.timestamp : null;

  const durationSec =
    first && last
      ? Math.max(
          0,
          Math.round((Date.parse(last.timestamp) - Date.parse(startedAt)) / 1000),
        )
      : 0;

  const patientMessageCount = ordered.filter(
    (message) => message.role === "patient",
  ).length;
  const agentMessageCount = ordered.filter(
    (message) => message.role === "agent",
  ).length;

  const latencies = ordered
    .filter((message) => message.role === "agent" && message.latencyMs !== null)
    .map((message) => message.latencyMs as number);
  const avgAgentLatencyMs =
    latencies.length > 0
      ? Math.round(
          latencies.reduce((total, value) => total + value, 0) /
            latencies.length,
        )
      : 0;

  return {
    startedAt,
    endedAt,
    durationSec,
    messageCount: ordered.length,
    patientMessageCount,
    agentMessageCount,
    avgAgentLatencyMs,
    lastMessagePreview: buildPreview(ordered),
    toolStats: buildToolStats(ordered),
  };
}

/**
 * The last thing a human actually said or heard. Tool calls and system events
 * are skipped: "check_availability" is useless as a row preview.
 */
function buildPreview(messages: DerivableMessage[]): string {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message.type !== "text") continue;
    if (message.role !== "patient" && message.role !== "agent") continue;

    const text = message.content.trim().replace(/\s+/g, " ");
    if (text.length === 0) continue;
    return text.length > PREVIEW_MAX
      ? `${text.slice(0, PREVIEW_MAX - 1).trimEnd()}…`
      : text;
  }
  return "";
}

/**
 * Per-tool tallies denormalized onto the conversation.
 *
 * The analytics page reports tool reliability from these instead of reading
 * every message subcollection in the range, which would be thousands of
 * subcollection reads for one table. `durationsMs` is kept so a median can be
 * computed across conversations; a running sum alone could only give a mean,
 * and one 30-second timeout would then swamp the figure.
 */
function buildToolStats(
  messages: DerivableMessage[],
): Record<string, ToolStat> {
  const stats: Record<string, ToolStat> = {};

  for (const message of messages) {
    if (message.type !== "tool_call" || message.tool === null) continue;

    const name = message.tool.name;
    const existing = stats[name] ?? {
      calls: 0,
      errors: 0,
      durationMsTotal: 0,
      durationsMs: [],
    };

    existing.calls += 1;
    if (message.tool.status === "error") existing.errors += 1;
    existing.durationMsTotal += message.tool.durationMs;
    existing.durationsMs.push(message.tool.durationMs);

    stats[name] = existing;
  }

  return stats;
}
