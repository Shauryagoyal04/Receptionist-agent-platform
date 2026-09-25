/*
 * Proves the console reads conversations exactly as the agent writes them.
 *
 *   npm run check:agent
 *
 * Writes documents in the shape produced by reizn7/clinic-ai-agent's
 * runtime/conversations.py — ISO-8601 STRING timestamps, a flat phone /
 * patientName, no derived fields, and (before the sweeper runs) no summary,
 * sentiment or language — alongside console-written documents, then reads
 * everything back through the real data layer.
 *
 * This is the check that catches a drift between the two repos, which a
 * typecheck cannot see.
 */
import { MongoMemoryServer } from "mongodb-memory-server";
import { MongoClient } from "mongodb";

const server = await MongoMemoryServer.create({ binary: { version: "7.0.14" } });
const uri = server.getUri();

process.env.MONGODB_URI = uri;
process.env.MONGODB_DB = "clinic_compat";
process.env.AUTH_SECRET = "compat-secret-value-at-least-32-characters-long";
process.env.DEFAULT_CLINIC_ID = "main-clinic";
process.env.DEFAULT_CLINIC_TIMEZONE = "Asia/Kolkata";
process.env.ENABLED_CHANNELS = "whatsapp";
process.env.HUMAN_HANDOFF_ENABLED = "false";

const {
  EMPTY_FILTERS,
  listConversations,
  getConversationById,
  getMessages,
  getConversationsInRange,
  getAdjacentConversations,
  ensureConversationIndexes,
} = await import("../lib/data/conversations");
const { aggregate } = await import("../lib/analytics/aggregate");
const { getMongoClientPromise } = await import("../lib/mongodb");

let failures = 0;
function check(label: string, ok: boolean, detail = "") {
  console.log(`  ${ok ? "ok  " : "FAIL"} ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures += 1;
}

const iso = (offsetMinutes: number) =>
  // Python's datetime.isoformat() emits +00:00, not Z — match it exactly.
  new Date(Date.now() - offsetMinutes * 60_000)
    .toISOString()
    .replace("Z", "+00:00");

/** Exactly what runtime/conversations.py inserts, field for field. */
function agentDoc(overrides: Record<string, unknown> = {}) {
  return {
    externalId: `conv_${Math.random().toString(16).slice(2)}`,
    clinicId: "main-clinic",
    channel: "whatsapp",
    phone: "+919876543210",
    patientName: "Ananya Rao",
    startedAt: iso(50),
    endedAt: iso(45),
    status: "completed",
    outcome: "appointment_booked",
    primaryIntent: "book_appointment",
    intents: ["doctor_availability", "book_appointment"],
    doctorName: "Dr. Anjali Mehta",
    appointmentAt: "2026-10-14T11:30:00",
    escalated: false,
    escalationReason: null,
    tags: [],
    messages: [
      {
        role: "patient",
        type: "text",
        content: "Hi, I need an appointment with Dr. Mehta",
        timestamp: iso(50),
      },
      {
        role: "agent",
        type: "tool_call",
        content: "check_availability(doctor_name, date)",
        timestamp: iso(49),
        tool: {
          name: "check_availability",
          args: { doctor_name: "Dr. Anjali Mehta", date: "2026-10-14" },
          result: { slots: ["11:30"] },
          status: "success",
          error: null,
          durationMs: 412,
        },
      },
      {
        role: "agent",
        type: "text",
        content: "Dr. Mehta has 11:30 free on 14 Oct. Shall I book it?",
        timestamp: iso(48),
        latencyMs: 880,
      },
      {
        role: "patient",
        type: "text",
        content: "Yes please",
        timestamp: iso(46),
      },
      {
        role: "agent",
        type: "tool_call",
        content: "book_appointment(doctor_name, date, slot)",
        timestamp: iso(45),
        tool: {
          name: "book_appointment",
          args: { doctor_name: "Dr. Anjali Mehta", date: "2026-10-14", slot: "11:30" },
          result: { success: true },
          status: "success",
          error: null,
          durationMs: 233,
        },
      },
      {
        role: "agent",
        type: "text",
        content: "Booked. See you on 14 Oct at 11:30.",
        timestamp: iso(45),
        latencyMs: 640,
      },
    ],
    ...overrides,
  };
}

try {
  const client = await new MongoClient(uri).connect();
  const col = client.db("clinic_compat").collection("conversations");

  // The agent's own index, created exactly as runtime/conversations.py does.
  await col.createIndex("externalId", { unique: true, name: "uniq_externalId" });
  await ensureConversationIndexes();
  check("console index setup survives the agent's index", true);

  await col.insertMany([
    agentDoc(),
    // Before the analytics sweeper runs: no summary / sentiment / language.
    agentDoc({
      patientName: "Vikram Shah",
      phone: "+919812345678",
      outcome: "escalated",
      status: "escalated",
      escalated: true,
      escalationReason: "Patient asked for a human",
      primaryIntent: "other",
    }),
    // After the sweeper: analytics applied.
    agentDoc({
      patientName: "Meera Iyer",
      outcome: "info_provided",
      primaryIntent: "clinic_info",
      summary: "Meera asked about Sunday timings.",
      sentiment: "positive",
      language: "hi",
      analyticsStatus: "complete",
    }),
    // Still open — the sweeper has not closed it yet.
    agentDoc({ patientName: "Rohan Das", status: "active", outcome: "no_resolution" }),
  ]);
  await client.close();

  console.log("\n[compat] reading agent documents through the console data layer");

  const page = await listConversations("main-clinic", EMPTY_FILTERS, 1);
  check("all four agent documents parse", page.total === 4, `${page.total} of 4`);
  check("none were skipped as malformed", page.conversations.length === 4);

  const booked = page.conversations.find((c) => c.patient.name === "Ananya Rao");
  check("flat patientName/phone became patient{}", booked?.patient.phone === "+919876543210");
  check("messageCount derived from messages", booked?.messageCount === 6, `${booked?.messageCount}`);
  check("duration derived from string timestamps", (booked?.durationSec ?? 0) > 0, `${booked?.durationSec}s`);
  check("tool stats derived", Object.keys(booked?.toolStats ?? {}).length === 2);
  check(
    "preview is the last human-readable line",
    booked?.lastMessagePreview.startsWith("Booked.") === true,
    booked?.lastMessagePreview,
  );
  check("missing summary degrades to empty", booked?.summary === "");
  check("missing sentiment degrades to neutral", booked?.sentiment === "neutral");

  const analysed = page.conversations.find((c) => c.patient.name === "Meera Iyer");
  check("sweeper-written summary is kept", analysed?.summary?.startsWith("Meera asked") === true);
  check("sweeper-written sentiment is kept", analysed?.sentiment === "positive");
  check("sweeper-written language is kept", analysed?.language === "hi");

  const escalated = page.conversations.find((c) => c.escalated);
  check("escalation flag read", escalated?.outcome === "escalated");
  check("escalation reason read", escalated?.escalationReason === "Patient asked for a human");
  check("escalatedAt back-filled from endedAt", escalated?.escalatedAt !== null);

  console.log("\n[compat] date handling across mixed types");

  const to = new Date();
  const from = new Date(to.getTime() - 24 * 60 * 60 * 1000);
  const range = await getConversationsInRange(
    "main-clinic",
    from.toISOString(),
    to.toISOString(),
  );
  check(
    "string-dated documents fall inside a Date range",
    range.conversations.length === 4,
    `${range.conversations.length} of 4`,
  );

  const filtered = await listConversations(
    "main-clinic",
    { ...EMPTY_FILTERS, from: from.toISOString(), to: to.toISOString() },
    1,
  );
  check("date filter matches them too", filtered.total === 4, `${filtered.total} of 4`);

  const outcomeFiltered = await listConversations(
    "main-clinic",
    { ...EMPTY_FILTERS, outcome: ["escalated"] },
    1,
  );
  check("outcome filter works on agent documents", outcomeFiltered.total === 1);

  const searched = await listConversations(
    "main-clinic",
    { ...EMPTY_FILTERS, q: "Iyer" },
    1,
  );
  check("substring search works on agent documents", searched.total === 1);

  const sorted = page.conversations.map((c) => Date.parse(c.startedAt));
  check(
    "sort is chronological despite mixed timestamp types",
    sorted.every((value, index) => index === 0 || sorted[index - 1] >= value),
  );

  console.log("\n[compat] detail page and analytics");

  const first = page.conversations[0];
  const detail = await getConversationById("main-clinic", first.id);
  check("detail lookup by id", detail !== null);
  const messages = await getMessages("main-clinic", first.id);
  check("transcript reads back", messages.length === 6, `${messages.length}`);
  check("tool call survives the round trip", messages.some((m) => m.tool?.name === "book_appointment"));
  check(
    "messages ordered oldest first",
    messages.every((m, i) => i === 0 || Date.parse(messages[i - 1].timestamp) <= Date.parse(m.timestamp)),
  );

  const neighbours = await getAdjacentConversations("main-clinic", first, EMPTY_FILTERS);
  check("neighbour lookup works on agent documents", neighbours.next !== null);

  const summary = aggregate(range.conversations, {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
    timeZone: "Asia/Kolkata",
  });
  check("analytics counts agent conversations", summary.total === 4, `${summary.total}`);
  check("booking rate computed", summary.bookingIntentTotal > 0);
  check("escalation surfaces in the follow-up queue", summary.recentEscalations.length === 1);
  check("tool reliability aggregated", summary.toolReliability.length === 2);

  console.log(
    failures === 0
      ? "\nThe console reads the agent's documents correctly.\n"
      : `\n${failures} CHECK(S) FAILED\n`,
  );
} finally {
  await (await getMongoClientPromise()).close().catch(() => {});
  await server.stop();
}

process.exit(failures === 0 ? 0 : 1);
