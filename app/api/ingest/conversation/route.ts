import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";

import { getServerEnv } from "@/lib/env";
import { ingestConversationSchema } from "@/lib/ingest/schema";
import {
  RATE_LIMIT,
  checkRateLimit,
  pruneRateLimitWindows,
} from "@/lib/ingest/rate-limit";
import { deriveConversationFields } from "@/lib/data/derive";
import { upsertIngestedConversation } from "@/lib/data/conversations";

/*
 * How the separately-built AI agent delivers finished conversations.
 *
 * The request shape is documented in docs/ingest.md, and what the agent needs
 * to record in the first place is specified in docs/agent-data-contract.md.
 */

/** Constant-time compare that also tolerates differing lengths. */
function secretMatches(provided: string, expected: string): boolean {
  const a = Buffer.from(provided, "utf8");
  const b = Buffer.from(expected, "utf8");
  // timingSafeEqual throws on a length mismatch, and returning early on that
  // would leak the secret's length. Hash-free fix: compare against a padded
  // copy and fold the length check into the result.
  if (a.length !== b.length) {
    // Still do a comparison of equal length so the work is constant.
    timingSafeEqual(a, a);
    return false;
  }
  return timingSafeEqual(a, b);
}

function bearerToken(request: NextRequest): string | null {
  const header = request.headers.get("authorization");
  if (!header) return null;
  const [scheme, ...rest] = header.split(" ");
  if (scheme.toLowerCase() !== "bearer") return null;
  const token = rest.join(" ").trim();
  return token.length > 0 ? token : null;
}

export async function POST(request: NextRequest) {
  const env = getServerEnv();

  // An unset key means the endpoint is not configured. Refuse rather than
  // accepting everything, which is what comparing against "" would do.
  if (env.INGEST_API_KEY.length === 0) {
    console.error(
      "[ingest] INGEST_API_KEY is not set — rejecting. Generate one with `openssl rand -hex 32`.",
    );
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const token = bearerToken(request);
  if (token === null || !secretMatches(token, env.INGEST_API_KEY)) {
    // No detail: a caller with the wrong key learns nothing about why.
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  pruneRateLimitWindows();
  const limit = checkRateLimit(token);
  if (!limit.allowed) {
    return NextResponse.json(
      {
        error: `Rate limit exceeded. Maximum ${RATE_LIMIT.MAX_REQUESTS} requests per minute.`,
      },
      {
        status: 429,
        headers: { "retry-after": String(limit.retryAfterSeconds) },
      },
    );
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Expected a JSON body." },
      { status: 400 },
    );
  }

  const parsed = ingestConversationSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "The conversation did not match the expected shape.",
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      },
      { status: 400 },
    );
  }

  const body = parsed.data;

  // Everything below is computed here, never taken from the caller.
  const derived = deriveConversationFields({
    messages: body.messages,
    fallbackStartedAt: body.startedAt,
  });

  const document = {
    patient: {
      name: body.patientName,
      phone: body.phone,
      email: body.patientEmail,
      isReturning: body.isReturning,
    },
    channel: body.channel,
    status: body.status,
    outcome: body.outcome,
    primaryIntent: body.primaryIntent,
    // The primary intent is always part of the set, even if the caller
    // forgot to include it, so the intent filter cannot miss a conversation.
    intents: [...new Set([body.primaryIntent, ...body.intents])],
    doctorName: body.doctorName,
    appointmentAt: body.appointmentAt ? new Date(body.appointmentAt) : null,

    // The caller's startedAt is respected; the rest follow from the messages.
    startedAt: new Date(body.startedAt),
    endedAt: body.endedAt
      ? new Date(body.endedAt)
      : derived.endedAt
        ? new Date(derived.endedAt)
        : null,
    durationSec: derived.durationSec,
    messageCount: derived.messageCount,
    patientMessageCount: derived.patientMessageCount,
    agentMessageCount: derived.agentMessageCount,
    avgAgentLatencyMs: derived.avgAgentLatencyMs,
    lastMessagePreview: derived.lastMessagePreview,
    toolStats: derived.toolStats,

    escalated: body.escalated,
    escalatedAt: body.escalated
      ? derived.endedAt
        ? new Date(derived.endedAt)
        : new Date(body.startedAt)
      : null,
    escalationReason: body.escalationReason,

    sentiment: body.sentiment,
    language: body.language,
    summary: body.summary,
    tags: body.tags,

    messages: body.messages.map((message) => ({
      ...message,
      timestamp: new Date(message.timestamp),
    })),
  };

  try {
    const { id, created } = await upsertIngestedConversation(
      env.DEFAULT_CLINIC_ID,
      body.externalId,
      document,
    );

    return NextResponse.json(
      {
        id,
        externalId: body.externalId,
        created,
        messageCount: derived.messageCount,
        durationSec: derived.durationSec,
      },
      { status: created ? 201 : 200 },
    );
  } catch (error) {
    console.error("[ingest] write failed", error);
    return NextResponse.json(
      { error: "Could not store that conversation." },
      { status: 500 },
    );
  }
}

/** A cheap liveness probe for the agent to check its credentials against. */
export async function GET(request: NextRequest) {
  const env = getServerEnv();
  const token = bearerToken(request);
  if (
    env.INGEST_API_KEY.length === 0 ||
    token === null ||
    !secretMatches(token, env.INGEST_API_KEY)
  ) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  return NextResponse.json({ ok: true, clinicId: env.DEFAULT_CLINIC_ID });
}
