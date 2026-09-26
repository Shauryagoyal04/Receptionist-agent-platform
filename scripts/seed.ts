/*
 * Populates MongoDB with a believable 90 days of clinic traffic.
 *
 *   npm run seed          — write the demo data
 *   npm run seed:clear    — remove it again
 *
 * The data is deliberately not uniform. Volume follows clinic hours, outcomes
 * follow the mix in §13 of the build plan, sentiment follows the outcome, and
 * transcripts are real dialogue of varying length — including a few in
 * Hinglish and some abandoned mid-flow. Uniform random data both looks fake
 * and hides layout bugs, because every row ends up the same size.
 */
import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local", quiet: true });
loadEnv({ path: ".env", quiet: true });

import { ObjectId, type Document } from "mongodb";

import { COLLECTIONS, getDb, getMongoClientPromise } from "@/lib/mongodb";
import { ensureConversationIndexes } from "@/lib/data/conversations";
import { ensureUserIndexes } from "@/lib/data/users";
import { getServerEnv } from "@/lib/env";
import { deriveConversationFields, type DerivableMessage } from "@/lib/data/derive";
import type {
  Channel,
  ConversationStatus,
  IntentId,
  Language,
  Outcome,
  Sentiment,
  ToolName,
} from "@/lib/types";
import {
  CLINIC_INFO_ANSWERS,
  DOCTORS,
  ESCALATION_REASONS,
  FEE_ANSWERS,
  FIRST_NAMES,
  HINGLISH_AGENT_LINES,
  HINGLISH_OPENERS,
  HOUR_WEIGHTS,
  INTENT_BY_OUTCOME,
  LAST_NAMES,
  OUTCOME_WEIGHTS,
  SENTIMENT_BY_OUTCOME,
  TAGS,
  WEEKDAY_WEIGHTS,
} from "./seed-content";

/** Reads `--flag=value` from argv, falling back to a default. */
function numericFlag(name: string, fallback: number): number {
  const match = process.argv.find((arg) => arg.startsWith(`--${name}=`));
  if (!match) return fallback;
  const value = Number.parseInt(match.slice(name.length + 3), 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

/**
 * How many conversations, and how far back they spread.
 *
 *   npm run seed -- --count=10 --days=4 --skip-today
 *
 * `--skip-today` starts the window at yesterday, which is what you want when
 * demonstrating "recent activity" without today's partial, still-open day
 * muddying the daily charts.
 */
const CONVERSATION_COUNT = numericFlag("count", 400);
const DAYS_BACK = numericFlag("days", 90);
const SKIP_TODAY = process.argv.includes("--skip-today");

/** Oldest and newest day offsets, inclusive. 0 is today. */
const OLDEST_DAYS_AGO = SKIP_TODAY ? DAYS_BACK : DAYS_BACK - 1;
const NEWEST_DAYS_AGO = SKIP_TODAY ? 1 : 0;
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

/** Relative weights when every channel is available. */
const CHANNEL_WEIGHTS: Array<{ channel: Channel; weight: number }> = [
  { channel: "web_chat", weight: 46 },
  { channel: "voice", weight: 34 },
  { channel: "whatsapp", weight: 20 },
];

/** Standalone parse so a dry run works without the strict env check. */
function parseChannelList(raw: string): Channel[] {
  const known = new Set<string>(["web_chat", "voice", "whatsapp"]);
  const found = raw
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry): entry is Channel => known.has(entry));
  return found.length > 0 ? found : ["whatsapp"];
}

/**
 * `npm run seed -- --dry-run` generates everything and prints the resulting
 * distributions without touching MongoDB. Useful for checking that the data
 * still looks like a clinic after editing the content tables, and for running
 * the generator where no credentials are configured.
 */
const DRY_RUN = process.argv.includes("--dry-run");

/**
 * `npm run seed -- --all-channels` ignores ENABLED_CHANNELS and generates the
 * full voice / web-chat / WhatsApp mix.
 *
 * By default the seed mirrors what the deployment can actually produce, so a
 * demo is not full of voice calls the product cannot take. This flag exists
 * for building the voice UI before voice ships.
 */
const ALL_CHANNELS = process.argv.includes("--all-channels");

/* ------------------------------------------------------------------ */
/* Deterministic randomness                                            */
/* ------------------------------------------------------------------ */

/**
 * A seeded PRNG so `npm run seed` twice produces the same clinic. That makes
 * the hand-computed analytics check in M6 reproducible, and makes a screenshot
 * in a bug report mean something.
 */
function makeRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const random = makeRandom(20260916);

function pick<T>(items: readonly T[]): T {
  return items[Math.floor(random() * items.length)];
}

function pickWeighted<T>(items: Array<{ weight: number } & T>): T {
  const total = items.reduce((sum, item) => sum + item.weight, 0);
  let roll = random() * total;
  for (const item of items) {
    roll -= item.weight;
    if (roll <= 0) return item;
  }
  return items[items.length - 1];
}

function pickIndexWeighted(weights: readonly number[]): number {
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  let roll = random() * total;
  for (let index = 0; index < weights.length; index += 1) {
    roll -= weights[index];
    if (roll <= 0) return index;
  }
  return weights.length - 1;
}

function intBetween(min: number, max: number): number {
  return Math.floor(random() * (max - min + 1)) + min;
}

function chance(probability: number): boolean {
  return random() < probability;
}

function sample<T>(items: readonly T[], count: number): T[] {
  const pool = [...items];
  const chosen: T[] = [];
  for (let index = 0; index < count && pool.length > 0; index += 1) {
    chosen.push(pool.splice(Math.floor(random() * pool.length), 1)[0]);
  }
  return chosen;
}

/* ------------------------------------------------------------------ */
/* Time                                                                */
/* ------------------------------------------------------------------ */

/**
 * Picks a start time in the last 90 days, weighted so the result looks like a
 * clinic's actual day: busy mid-morning and early evening, dead overnight,
 * quiet on Sunday. Hours are chosen in the clinic's timezone (IST) and then
 * converted to UTC, which is what the busiest-hours chart depends on.
 */
function pickStartedAt(now: Date): Date {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const daysAgo = intBetween(NEWEST_DAYS_AGO, OLDEST_DAYS_AGO);
    const dayUtc = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);

    // Calendar date as it reads in IST.
    const ist = new Date(dayUtc.getTime() + IST_OFFSET_MS);
    const weekday = ist.getUTCDay();

    if (random() > WEEKDAY_WEIGHTS[weekday] / Math.max(...WEEKDAY_WEIGHTS)) {
      continue;
    }

    const hour = pickIndexWeighted(HOUR_WEIGHTS);
    const minute = intBetween(0, 59);
    const second = intBetween(0, 59);

    const startedUtcMs =
      Date.UTC(
        ist.getUTCFullYear(),
        ist.getUTCMonth(),
        ist.getUTCDate(),
        hour,
        minute,
        second,
      ) - IST_OFFSET_MS;

    if (startedUtcMs <= now.getTime()) return new Date(startedUtcMs);
  }

  // Every weighted attempt was rejected. Fall back to a random time inside
  // the requested window rather than "an hour ago", which would land on today
  // and defeat --skip-today.
  const daysAgo = intBetween(NEWEST_DAYS_AGO, OLDEST_DAYS_AGO);
  return new Date(
    now.getTime() -
      daysAgo * 24 * 60 * 60 * 1000 -
      intBetween(0, 12) * 60 * 60 * 1000,
  );
}

/* ------------------------------------------------------------------ */
/* People                                                              */
/* ------------------------------------------------------------------ */

type Patient = {
  name: string;
  phone: string;
  email: string | null;
  isReturning: boolean;
};

function makePatient(): Patient {
  const name = `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`;
  // Indian mobile numbers start 6–9 and are ten digits.
  const phone = `+91${intBetween(6, 9)}${String(intBetween(0, 999999999)).padStart(9, "0")}`;
  const handle = name.toLowerCase().replace(/\s+/g, ".");
  return {
    name,
    phone,
    email: chance(0.6) ? `${handle}@example.com` : null,
    isReturning: chance(0.45),
  };
}

/** A pool of repeat patients, so the same people recur as they really would. */
const RETURNING_POOL: Patient[] = Array.from({ length: 60 }, () => ({
  ...makePatient(),
  isReturning: true,
}));

/* ------------------------------------------------------------------ */
/* Transcript construction                                             */
/* ------------------------------------------------------------------ */

type Draft = {
  messages: DerivableMessage[];
  cursor: Date;
};

function startDraft(startedAt: Date): Draft {
  return { messages: [], cursor: new Date(startedAt) };
}

function advance(draft: Draft, seconds: number): string {
  draft.cursor = new Date(draft.cursor.getTime() + seconds * 1000);
  return draft.cursor.toISOString();
}

function patientSays(draft: Draft, content: string, gap = intBetween(6, 30)) {
  draft.messages.push({
    role: "patient",
    type: "text",
    content,
    timestamp: advance(draft, gap),
    latencyMs: null,
    tool: null,
  });
}

function agentSays(
  draft: Draft,
  content: string,
  options: { lowConfidence?: boolean } = {},
) {
  draft.messages.push({
    role: "agent",
    type: "text",
    content,
    timestamp: advance(draft, intBetween(1, 4)),
    latencyMs: intBetween(320, 2400),
    tool: null,
  });
  // `confidence` is carried on the stored message; the draft only needs the
  // fields `deriveConversationFields` reads, so it is applied at write time.
  if (options.lowConfidence) {
    lowConfidenceIndexes.add(draft.messages.length - 1);
  }
}

/** Indexes within the current draft that should be written as low-confidence. */
let lowConfidenceIndexes = new Set<number>();

function toolCall(
  draft: Draft,
  name: ToolName,
  args: Record<string, unknown>,
  outcome: { ok: true; result: Record<string, unknown> } | { ok: false; error: string },
) {
  const durationMs = outcome.ok ? intBetween(120, 1400) : intBetween(900, 6000);
  draft.messages.push({
    role: "agent",
    type: "tool_call",
    content: `${name}(${Object.keys(args).join(", ")})`,
    timestamp: advance(draft, intBetween(1, 3)),
    latencyMs: null,
    tool: {
      name,
      args,
      result: outcome.ok ? outcome.result : null,
      status: outcome.ok ? "success" : "error",
      error: outcome.ok ? null : outcome.error,
      durationMs,
    },
  });
}

function systemEvent(draft: Draft, content: string) {
  draft.messages.push({
    role: "system",
    type: "system_event",
    content,
    timestamp: advance(draft, intBetween(1, 3)),
    latencyMs: null,
    tool: null,
  });
}


/** "HH:mm" on the clinic's clock — the slot format the agent's tools use. */
function formatSlotTime(date: Date): string {
  const ist = new Date(date.getTime() + IST_OFFSET_MS);
  return `${String(ist.getUTCHours()).padStart(2, "0")}:${String(ist.getUTCMinutes()).padStart(2, "0")}`;
}

function formatSlot(date: Date): string {
  const ist = new Date(date.getTime() + IST_OFFSET_MS);
  const day = ist.getUTCDate();
  const month = ist.toLocaleString("en-GB", { month: "short", timeZone: "UTC" });
  const hour = ist.getUTCHours();
  const minute = String(ist.getUTCMinutes()).padStart(2, "0");
  const suffix = hour < 12 ? "am" : "pm";
  const display = hour % 12 === 0 ? 12 : hour % 12;
  return `${day} ${month}, ${display}:${minute}${suffix}`;
}

type BuildInput = {
  startedAt: Date;
  outcome: Outcome;
  intent: IntentId;
  patient: Patient;
  doctor: (typeof DOCTORS)[number] | null;
  appointmentAt: Date | null;
  escalationReason: string | null;
  language: Language;
  channel: Channel;
};

function buildTranscript(input: BuildInput): {
  messages: DerivableMessage[];
  lowConfidence: Set<number>;
} {
  lowConfidenceIndexes = new Set<number>();
  const draft = startDraft(input.startedAt);
  const hinglish = input.language === "hi";
  const { patient, doctor, appointmentAt } = input;
  const firstName = patient.name.split(" ")[0];

  if (input.channel === "voice") {
    systemEvent(draft, "Call connected");
  }

  // --- Opening -------------------------------------------------------
  if (hinglish) {
    patientSays(draft, pick(HINGLISH_OPENERS[input.intent]), intBetween(2, 8));
    agentSays(draft, pick(HINGLISH_AGENT_LINES));
    patientSays(draft, `${patient.name}, ${patient.phone}.`);
  } else {
    patientSays(
      draft,
      pick([
        "Hi, I'd like to book an appointment.",
        "Hello, is the clinic open today?",
        "Good morning, I need to see a doctor this week.",
        "Hi there, I have a question about my appointment.",
      ]),
      intBetween(2, 8),
    );
    // Greeting follows the clinic's local clock, not UTC.
    const istHour = new Date(
      input.startedAt.getTime() + IST_OFFSET_MS,
    ).getUTCHours();
    const greeting =
      istHour < 12 ? "morning" : istHour < 17 ? "afternoon" : "evening";
    agentSays(
      draft,
      `Good ${greeting}! I can help with that. May I have your name and phone number?`,
    );
    patientSays(draft, `${patient.name}, ${patient.phone}.`);
  }

  if (patient.isReturning) {
    toolCall(
      draft,
      "list_my_appointments",
      { phone: patient.phone },
      {
        ok: true,
        result: {
          appointments: [],
          patient: { name: patient.name },
        },
      },
    );
    agentSays(
      draft,
      `Thanks ${firstName}, I can see you've visited us before. How can I help today?`,
    );
  }

  // --- Intent-specific body ------------------------------------------
  switch (input.intent) {
    case "book_appointment":
    case "doctor_availability": {
      buildBookingBody(draft, input, firstName);
      break;
    }
    case "reschedule_appointment": {
      patientSays(
        draft,
        "I need to move my appointment to a different day, something's come up.",
      );
      if (doctor && appointmentAt) {
        toolCall(
          draft,
          "check_availability",
          { doctor_name: doctor.name, date: appointmentAt.toISOString().slice(0, 10) },
          {
            ok: true,
            result: {
              slots: [formatSlot(appointmentAt), formatSlot(new Date(appointmentAt.getTime() + 86400000))],
            },
          },
        );
        agentSays(
          draft,
          `No problem. ${doctor.name} has ${formatSlot(appointmentAt)} free. Does that work?`,
        );
        patientSays(draft, "Yes, that's better. Thank you.");
        // No reschedule tool exists: the agent cancels, then books, and
        // derive_outcome() reads that pair back as "rescheduled".
        toolCall(
          draft,
          "cancel_appointment",
          { appointment_id: `apt_${intBetween(100000, 999999)}` },
          { ok: true, result: { success: true } },
        );
        toolCall(
          draft,
          "book_appointment",
          {
            doctor_name: doctor.name,
            date: appointmentAt.toISOString().slice(0, 10),
            slot: formatSlotTime(appointmentAt),
            patient_name: patient.name,
            phone: patient.phone,
          },
          { ok: true, result: { success: true, appointmentId: `apt_${intBetween(100000, 999999)}` } },
        );
        agentSays(draft, "Done — I've moved it and sent you a confirmation SMS.");
      }
      break;
    }
    case "cancel_appointment": {
      patientSays(draft, "I'd like to cancel my appointment, please.");
      if (doctor) {
        toolCall(
          draft,
          "cancel_appointment",
          { appointment_id: `apt_${intBetween(100000, 999999)}` },
          { ok: true, result: { success: true } },
        );
        agentSays(
          draft,
          `That's cancelled. There's no charge. Would you like me to book a different day?`,
        );
        patientSays(draft, pick(["Not right now, thanks.", "I'll call back later.", "No, that's all."]));
      }
      break;
    }
    case "clinic_info": {
      patientSays(
        draft,
        pick([
          "What are your timings on Sunday?",
          "Where exactly is the clinic?",
          "Do you have a pharmacy inside?",
          "Which insurance do you accept?",
        ]),
      );
      agentSays(draft, pick(CLINIC_INFO_ANSWERS));
      break;
    }
    case "consultation_fees": {
      patientSays(draft, "How much is a consultation?");
      toolCall(
        draft,
        "get_clinic_info",
        {},
        {
          ok: true,
          result: {
            clinicName: "Sunrise Multi-Speciality Clinic",
            timings: "Mon-Sat, 9:00 AM - 8:00 PM",
          },
        },
      );
      agentSays(draft, pick(FEE_ANSWERS));
      break;
    }
    case "report_status": {
      patientSays(draft, "I gave a blood sample yesterday. Is the report ready?");
      const ready = chance(0.6);
      toolCall(
        draft,
        "list_my_appointments",
        { phone: patient.phone },
        ready
          ? { ok: true, result: { appointments: [{ date: "yesterday", status: "Completed" }] } }
          : { ok: false, error: "Database timed out after 5000ms" },
      );
      agentSays(
        draft,
        ready
          ? "Your report is ready — I've emailed it and you can also collect a printout at the front desk."
          : "I'm having trouble reaching the lab system just now. Let me get someone to check it for you.",
        { lowConfidence: !ready },
      );
      break;
    }
    case "other": {
      patientSays(
        draft,
        pick([
          "Do you do home sample collection?",
          "My father needs a wheelchair at the entrance, is that possible?",
          "Can I get a duplicate receipt for last month's visit?",
        ]),
      );
      agentSays(
        draft,
        "Let me check that for you — I want to make sure I give you the right answer.",
        { lowConfidence: true },
      );
      break;
    }
  }

  // --- Ending --------------------------------------------------------
  if (input.outcome === "escalated" && input.escalationReason) {
    patientSays(
      draft,
      pick([
        "This isn't helping. Can I speak to a person?",
        "I've explained twice already.",
        "Please put me through to the front desk.",
      ]),
    );
    // The agent records this as an escalate_to_human tool call; it has no
    // concept of a "handoff" message, and nobody is actually notified.
    toolCall(
      draft,
      "escalate_to_human",
      { reason: input.escalationReason },
      { ok: true, result: { escalated: true } },
    );
    agentSays(
      draft,
      "I've let our clinic team know — someone will follow up with you here shortly.",
    );
  } else if (input.outcome === "no_resolution") {
    // Abandoned mid-flow: the patient simply stops replying.
    if (chance(0.5)) {
      agentSays(draft, "Are you still there? I can hold for a moment.");
      // Voice calls end with an audible event; on WhatsApp the patient simply
      // stops replying and the idle sweeper closes the conversation later.
      if (input.channel === "voice") systemEvent(draft, "Caller hung up");
    }
  } else if (!hinglish) {
    patientSays(draft, pick(["Thank you!", "Great, thanks.", "Perfect, thanks a lot."]));
    agentSays(draft, "Happy to help. Take care!");
  }

  if (input.channel === "voice" && input.outcome !== "no_resolution") {
    systemEvent(draft, "Call ended");
  }

  return { messages: draft.messages, lowConfidence: lowConfidenceIndexes };
}

/** The booking flow, which is where the real tool sequences live. */
function buildBookingBody(draft: Draft, input: BuildInput, firstName: string) {
  const { doctor, appointmentAt, outcome } = input;
  if (!doctor || !appointmentAt) return;

  draft.messages.push({
    role: "patient",
    type: "text",
    content: `I'd like to see ${doctor.name} for ${pick([
      "a persistent cough",
      "a follow-up on my blood pressure",
      "a skin rash that isn't clearing",
      "knee pain",
      "my child's vaccination",
    ])}.`,
    timestamp: advance(draft, intBetween(5, 25)),
    latencyMs: null,
    tool: null,
  });

  // Some availability checks genuinely fail — the console needs to show them.
  const availabilityFails = chance(0.12);
  if (availabilityFails) {
    toolCall(
      draft,
      "check_availability",
      { doctor_name: doctor.name, date: appointmentAt.toISOString().slice(0, 10) },
      { ok: false, error: "Scheduling service returned 503 (upstream unavailable)" },
    );
    agentSays(draft, "One moment, let me try that again.");
  }

  toolCall(
    draft,
    "check_availability",
    {
      doctor_name: doctor.name,
      date: appointmentAt.toISOString().slice(0, 10),
    },
    {
      ok: true,
      result: {
        slots: [
          formatSlot(appointmentAt),
          formatSlot(new Date(appointmentAt.getTime() + 30 * 60000)),
          formatSlot(new Date(appointmentAt.getTime() + 26 * 3600000)),
        ],
      },
    },
  );

  agentSays(
    draft,
    `${doctor.name} (${doctor.speciality}) has ${formatSlot(appointmentAt)} available. Shall I book it?`,
  );

  if (outcome !== "appointment_booked") {
    // Availability was offered but the conversation did not convert.
    draft.messages.push({
      role: "patient",
      type: "text",
      content: pick([
        "Let me check with my family and call back.",
        "That's too late in the day for me.",
        "Hmm, I'll think about it.",
      ]),
      timestamp: advance(draft, intBetween(8, 40)),
      latencyMs: null,
      tool: null,
    });
    return;
  }

  draft.messages.push({
    role: "patient",
    type: "text",
    content: pick(["Yes please.", "That works, book it.", "Perfect, go ahead."]),
    timestamp: advance(draft, intBetween(4, 20)),
    latencyMs: null,
    tool: null,
  });

  toolCall(
    draft,
    "book_appointment",
    {
      patient_name: input.patient.name,
      doctor_name: doctor.name,
      date: appointmentAt.toISOString().slice(0, 10),
      slot: formatSlotTime(appointmentAt),
      phone: input.patient.phone,
    },
    {
      ok: true,
      result: {
        success: true,
        appointmentId: `apt_${intBetween(100000, 999999)}`,
      },
    },
  );

  agentSays(
    draft,
    `Booked, ${firstName}. ${formatSlot(appointmentAt)} with ${doctor.name}. See you then!`,
  );
}

/* ------------------------------------------------------------------ */
/* Assembly                                                            */
/* ------------------------------------------------------------------ */

function statusFor(outcome: Outcome): ConversationStatus {
  if (outcome === "escalated") return "escalated";
  if (outcome === "no_resolution") return "abandoned";
  return "completed";
}

function summaryFor(
  outcome: Outcome,
  patient: Patient,
  doctor: (typeof DOCTORS)[number] | null,
  appointmentAt: Date | null,
  escalationReason: string | null,
): string {
  const firstName = patient.name.split(" ")[0];
  switch (outcome) {
    case "appointment_booked":
      return `${firstName} booked a slot with ${doctor?.name ?? "a doctor"}${appointmentAt ? ` for ${formatSlot(appointmentAt)}` : ""}. Confirmation sent.`;
    case "appointment_rescheduled":
      return `${firstName} moved an existing appointment with ${doctor?.name ?? "a doctor"} to a later slot.`;
    case "appointment_cancelled":
      return `${firstName} cancelled an appointment with ${doctor?.name ?? "a doctor"} and declined to rebook.`;
    case "info_provided":
      return `${firstName} asked about clinic details and got an answer without needing staff.`;
    case "escalated":
      return `${firstName} was handed to the front desk — ${(escalationReason ?? "reason unrecorded").toLowerCase()}.`;
    case "no_resolution":
      return `${firstName} left mid-conversation before anything was booked or answered.`;
  }
}

/** Tallies kept so a dry run can show that the data still looks like a clinic. */
type Stats = {
  outcomes: Record<string, number>;
  channels: Record<string, number>;
  sentiments: Record<string, number>;
  languages: Record<string, number>;
  hours: number[];
  weekdays: number[];
  messageCounts: number[];
  toolCalls: Record<string, { calls: number; errors: number }>;
  escalated: number;
  reviewed: number;
};

function emptyStats(): Stats {
  return {
    outcomes: {},
    channels: {},
    sentiments: {},
    languages: {},
    hours: Array.from({ length: 24 }, () => 0),
    weekdays: Array.from({ length: 7 }, () => 0),
    messageCounts: [],
    toolCalls: {},
    escalated: 0,
    reviewed: 0,
  };
}

function bump(record: Record<string, number>, key: string) {
  record[key] = (record[key] ?? 0) + 1;
}

let sampleTranscript: {
  messages: DerivableMessage[];
  lowConfidence: Set<number>;
} | null = null;

function printSampleTranscript() {
  if (!sampleTranscript) return;
  console.log("\n  Sample booked transcript");
  sampleTranscript.messages.forEach((message, index) => {
    const time = new Date(message.timestamp)
      .toISOString()
      .slice(11, 19);
    if (message.type === "tool_call" && message.tool) {
      const status = message.tool.status === "error" ? "ERROR" : "ok";
      console.log(
        `    ${time}  [tool] ${message.tool.name} (${status}, ${message.tool.durationMs}ms)`,
      );
      if (message.tool.error) console.log(`             ↳ ${message.tool.error}`);
      return;
    }
    if (message.type !== "text") {
      console.log(`    ${time}  --- ${message.content} ---`);
      return;
    }
    const flag = sampleTranscript?.lowConfidence.has(index) ? " (low confidence)" : "";
    console.log(`    ${time}  ${message.role.padEnd(7)} ${message.content}${flag}`);
  });
}

async function main() {
  // A dry run must work without credentials, so the strict env parse (which
  // requires MONGODB_URI) only runs when actually writing.
  const env = DRY_RUN ? null : getServerEnv();
  const clinicId =
    env?.DEFAULT_CLINIC_ID ?? process.env.DEFAULT_CLINIC_ID ?? "main-clinic";
  const now = new Date();
  const stats = emptyStats();

  console.log(
    DRY_RUN
      ? `Dry run: generating ${CONVERSATION_COUNT} conversations across days ` +
        `${NEWEST_DAYS_AGO}–${OLDEST_DAYS_AGO} ago (nothing will be written)…`
      : `Seeding ${CONVERSATION_COUNT} conversations for clinic "${clinicId}" ` +
        `across days ${NEWEST_DAYS_AGO}–${OLDEST_DAYS_AGO} ago` +
        `${SKIP_TODAY ? " (excluding today)" : ""}…`,
  );

  // Only generate channels this deployment can actually produce.
  const enabledChannels: Channel[] = ALL_CHANNELS
    ? ["web_chat", "voice", "whatsapp"]
    : (env?.capabilities.enabledChannels ??
      parseChannelList(process.env.ENABLED_CHANNELS ?? "whatsapp"));

  const channelWeights = CHANNEL_WEIGHTS.filter((entry) =>
    enabledChannels.includes(entry.channel),
  );
  if (channelWeights.length === 0) channelWeights.push({ channel: "whatsapp", weight: 1 });

  console.log(`  channels: ${enabledChannels.join(", ")}`);

  const db = DRY_RUN ? null : await getDb();

  if (db && env) {
    await Promise.all([ensureConversationIndexes(), ensureUserIndexes()]);
    await db.collection(COLLECTIONS.clinic).updateOne(
      { clinicId },
      {
        $set: {
          clinicId,
          clinicName: "Sunrise Multi-Speciality Clinic",
          timezone: env.DEFAULT_CLINIC_TIMEZONE,
        },
        $setOnInsert: {
          createdAt: new Date(now.getTime() - 400 * 24 * 60 * 60 * 1000),
        },
      },
      { upsert: true },
    );
  }

  // Buffered and flushed in chunks: one insertMany per 100 conversations is
  // far fewer round trips than an insert per document, and keeps the payload
  // well inside MongoDB's 16MB command limit even with long transcripts.
  let buffer: Document[] = [];
  let written = 0;

  const flush = async (force = false) => {
    if (!db || buffer.length === 0) return;
    if (force || buffer.length >= 100) {
      await db.collection(COLLECTIONS.conversations).insertMany(buffer);
      buffer = [];
    }
  };

  for (let index = 0; index < CONVERSATION_COUNT; index += 1) {
    const startedAt = pickStartedAt(now);
    const { outcome } = pickWeighted(OUTCOME_WEIGHTS);
    const intent = pick(INTENT_BY_OUTCOME[outcome]);
    const { sentiment } = pickWeighted(SENTIMENT_BY_OUTCOME[outcome]);

    const patient =
      chance(0.35) && RETURNING_POOL.length > 0
        ? pick(RETURNING_POOL)
        : makePatient();

    const needsDoctor = [
      "book_appointment",
      "doctor_availability",
      "reschedule_appointment",
      "cancel_appointment",
    ].includes(intent);
    const doctor = needsDoctor || chance(0.25) ? pick(DOCTORS) : null;

    // Real clinics book on the quarter hour, within consulting hours — not at
    // 8:22pm, which is what carrying the call's own minutes forward produces.
    const appointmentAt = needsDoctor
      ? (() => {
          const day = new Date(
            startedAt.getTime() + intBetween(1, 21) * 24 * 60 * 60 * 1000,
          );
          const ist = new Date(day.getTime() + IST_OFFSET_MS);
          return new Date(
            Date.UTC(
              ist.getUTCFullYear(),
              ist.getUTCMonth(),
              ist.getUTCDate(),
              intBetween(9, 18),
              pick([0, 15, 30, 45]),
            ) - IST_OFFSET_MS,
          );
        })()
      : null;

    const channel = pickWeighted<{ channel: Channel }>(channelWeights).channel;

    const language: Language = chance(0.18) ? "hi" : "en";
    const escalationReason =
      outcome === "escalated" ? pick(ESCALATION_REASONS) : null;

    const { messages, lowConfidence } = buildTranscript({
      startedAt,
      outcome,
      intent,
      patient,
      doctor,
      appointmentAt,
      escalationReason,
      language,
      channel,
    });

    const derived = deriveConversationFields({
      messages,
      fallbackStartedAt: startedAt.toISOString(),
    });

    const escalated = outcome === "escalated";
    const escalatedAt = escalated ? derived.endedAt : null;

    // A realistic share of older conversations have been triaged already.
    const ageDays = (now.getTime() - startedAt.getTime()) / 86400000;
    const reviewed = chance(Math.min(0.55, ageDays / 90));
    const conversationId = new ObjectId();

    const intents: IntentId[] = [intent];
    if (chance(0.3)) {
      const extra = pick(INTENT_BY_OUTCOME[outcome]);
      if (!intents.includes(extra)) intents.push(extra);
    }

    const conversationDoc = {
      clinicId,
      // A distinct id per conversation, not null: the agent creates a plain
      // unique index on externalId, under which every document missing the
      // field counts as null and only one could ever be inserted.
      externalId: `seed_${conversationId.toHexString()}`,
      patient,
      channel,
      status: statusFor(outcome),
      outcome,
      primaryIntent: intent,
      intents,
      doctorName: doctor?.name ?? null,
      appointmentAt:
        appointmentAt && outcome !== "appointment_cancelled"
          ? appointmentAt
          : null,
      startedAt: new Date(derived.startedAt),
      endedAt: derived.endedAt ? new Date(derived.endedAt) : null,
      durationSec: derived.durationSec,
      messageCount: derived.messageCount,
      patientMessageCount: derived.patientMessageCount,
      agentMessageCount: derived.agentMessageCount,
      avgAgentLatencyMs: derived.avgAgentLatencyMs,
      escalated,
      escalatedAt: escalatedAt ? new Date(escalatedAt) : null,
      escalationReason,
      sentiment: sentiment as Sentiment,
      language,
      summary: summaryFor(outcome, patient, doctor, appointmentAt, escalationReason),
      lastMessagePreview: derived.lastMessagePreview,
      tags: sample(TAGS, intBetween(0, 3)),
      toolStats: derived.toolStats,
      reviewedBy: reviewed ? "seed-reviewer" : null,
      reviewedAt: reviewed
        ? new Date(startedAt.getTime() + intBetween(1, 72) * 3600000)
        : null,
      staffNote: reviewed && chance(0.25)
        ? pick([
            "Called the patient back to confirm — all good.",
            "Agent handled this well, no action needed.",
            "Flagged to Dr. Mehta's assistant.",
            "Patient was upset about the wait. Followed up personally.",
          ])
        : null,
      seeded: true,
    };

    // Messages are embedded rather than a separate collection: a transcript
    // is only ever read with its conversation, is bounded in size, and this
    // way the detail page is one round trip instead of two.
    const messageDocs = messages.map((message, messageIndex) => ({
      role: message.role,
      type: message.type,
      content: message.content,
      timestamp: new Date(message.timestamp),
      // Voice conversations carry a per-message recording. No audio is
      // processed here; the console just renders a player when this is set.
      audioUrl:
        channel === "voice" && message.type === "text"
          ? `https://recordings.example.com/${conversationId.toHexString()}/${messageIndex}.mp3`
          : null,
      latencyMs: message.latencyMs,
      confidence:
        message.role === "agent" && message.type === "text"
          ? lowConfidence.has(messageIndex)
            ? Number((0.35 + random() * 0.3).toFixed(2))
            : Number((0.82 + random() * 0.17).toFixed(2))
          : null,
      tool: message.tool,
    }));

    if (db) {
      buffer.push({
        _id: conversationId,
        ...conversationDoc,
        messages: messageDocs,
      });
    }

    // --- Tallies ------------------------------------------------------
    const istStart = new Date(
      new Date(derived.startedAt).getTime() + IST_OFFSET_MS,
    );
    bump(stats.outcomes, outcome);
    bump(stats.channels, channel);
    bump(stats.sentiments, sentiment);
    bump(stats.languages, language);
    stats.hours[istStart.getUTCHours()] += 1;
    stats.weekdays[istStart.getUTCDay()] += 1;
    stats.messageCounts.push(derived.messageCount);
    if (escalated) stats.escalated += 1;
    if (reviewed) stats.reviewed += 1;
    for (const [name, stat] of Object.entries(derived.toolStats)) {
      const existing = stats.toolCalls[name] ?? { calls: 0, errors: 0 };
      existing.calls += stat.calls;
      existing.errors += stat.errors;
      stats.toolCalls[name] = existing;
    }

    // Keep one booked transcript so a dry run can show what the console will
    // actually render, not just the shape of the distributions.
    if (DRY_RUN && sampleTranscript === null && outcome === "appointment_booked") {
      sampleTranscript = { messages, lowConfidence };
    }

    written += 1;
    await flush();

    const step = CONVERSATION_COUNT >= 100 ? 100 : 5;
    if (!DRY_RUN && written % step === 0) {
      console.log(`  …${written} conversations`);
    }
  }

  await flush(true);

  if (DRY_RUN) {
    reportStats(stats, written);
    return;
  }

  console.log(`Done. Wrote ${written} conversations.`);
  console.log("Run `npm run seed:clear` to remove them.");

  // The driver keeps a pooled connection open, which would hang the process.
  await (await getMongoClientPromise()).close();
}

function reportStats(stats: Stats, total: number) {
  const share = (count: number) => `${((count / total) * 100).toFixed(1)}%`;
  const table = (record: Record<string, number>) =>
    Object.entries(record)
      .sort((a, b) => b[1] - a[1])
      .map(([key, count]) => `    ${key.padEnd(24)} ${String(count).padStart(4)}  ${share(count)}`)
      .join("\n");

  const sorted = [...stats.messageCounts].sort((a, b) => a - b);

  console.log(`\nGenerated ${total} conversations.\n`);
  console.log("  Outcomes\n" + table(stats.outcomes));
  console.log("\n  Channels\n" + table(stats.channels));
  console.log("\n  Sentiment\n" + table(stats.sentiments));
  console.log("\n  Language\n" + table(stats.languages));
  console.log(
    `\n  Messages per conversation: min ${sorted[0]}, median ${sorted[Math.floor(sorted.length / 2)]}, max ${sorted[sorted.length - 1]}`,
  );
  console.log(
    `  Escalated: ${stats.escalated} (${share(stats.escalated)})   Reviewed: ${stats.reviewed} (${share(stats.reviewed)})`,
  );

  console.log("\n  Volume by hour (clinic local time)");
  const peak = Math.max(...stats.hours);
  stats.hours.forEach((count, hour) => {
    const bar = "█".repeat(Math.round((count / peak) * 40));
    console.log(`    ${String(hour).padStart(2, "0")}:00 ${String(count).padStart(3)} ${bar}`);
  });

  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  console.log("\n  Volume by weekday");
  stats.weekdays.forEach((count, day) => {
    console.log(`    ${days[day]} ${String(count).padStart(4)}`);
  });

  console.log("\n  Tool calls");
  for (const [name, stat] of Object.entries(stats.toolCalls).sort(
    (a, b) => b[1].calls - a[1].calls,
  )) {
    const successRate = ((1 - stat.errors / stat.calls) * 100).toFixed(1);
    console.log(
      `    ${name.padEnd(24)} ${String(stat.calls).padStart(4)} calls, ${successRate}% success`,
    );
  }
  printSampleTranscript();

  console.log("\nNothing was written. Drop --dry-run to seed MongoDB.");
}

main().catch((error) => {
  console.error("\nSeeding failed:\n", error);
  process.exit(1);
});
