import { z } from "zod";

/*
 * Single source of truth for the domain vocabulary.
 *
 * Every union below carries a label map and, where the value is shown as a
 * badge / chart segment / filter chip, a color map. The conversations list,
 * the detail page and the analytics page all read from here so the three
 * pages cannot drift apart.
 *
 * Colors are CSS custom property names defined in `app/globals.css`. Charts
 * consume the `*_CHART_COLOR` maps (raw `var(--...)` strings, which SVG
 * `fill`/`stroke` attributes accept); badges consume the Tailwind class maps.
 */

/* ------------------------------------------------------------------ */
/* Unions                                                              */
/* ------------------------------------------------------------------ */

export const INTENT_IDS = [
  "book_appointment",
  "cancel_appointment",
  "reschedule_appointment",
  "doctor_availability",
  "clinic_info",
  "consultation_fees",
  "report_status",
  "other",
] as const;
export const intentIdSchema = z.enum(INTENT_IDS);
export type IntentId = z.infer<typeof intentIdSchema>;

export const CHANNELS = ["web_chat", "voice", "whatsapp"] as const;
export const channelSchema = z.enum(CHANNELS);
export type Channel = z.infer<typeof channelSchema>;

export const CONVERSATION_STATUSES = [
  "active",
  "completed",
  "escalated",
  "abandoned",
] as const;
export const conversationStatusSchema = z.enum(CONVERSATION_STATUSES);
export type ConversationStatus = z.infer<typeof conversationStatusSchema>;

export const OUTCOMES = [
  "appointment_booked",
  "appointment_cancelled",
  "appointment_rescheduled",
  "info_provided",
  "escalated",
  "no_resolution",
] as const;
export const outcomeSchema = z.enum(OUTCOMES);
export type Outcome = z.infer<typeof outcomeSchema>;

export const SENTIMENTS = ["positive", "neutral", "negative"] as const;
export const sentimentSchema = z.enum(SENTIMENTS);
export type Sentiment = z.infer<typeof sentimentSchema>;

export const LANGUAGES = ["en", "hi"] as const;
export const languageSchema = z.enum(LANGUAGES);
export type Language = z.infer<typeof languageSchema>;

export const MESSAGE_ROLES = ["patient", "agent", "system", "staff"] as const;
export const messageRoleSchema = z.enum(MESSAGE_ROLES);
export type MessageRole = z.infer<typeof messageRoleSchema>;

export const MESSAGE_TYPES = [
  "text",
  "tool_call",
  "handoff",
  "system_event",
] as const;
export const messageTypeSchema = z.enum(MESSAGE_TYPES);
export type MessageType = z.infer<typeof messageTypeSchema>;

/**
 * The tools the agent actually exposes, matching
 * `src/clinic_agent/tools/booking_tools.py` exactly.
 *
 * `toolLabel()` falls back to prettifying an unknown name, so a tool added on
 * the agent side still renders sensibly before this list catches up.
 */
export const TOOL_NAMES = [
  "get_clinic_info",
  "list_doctors",
  "check_availability",
  "book_appointment",
  "list_my_appointments",
  "cancel_appointment",
  "escalate_to_human",
] as const;
export const toolNameSchema = z.enum(TOOL_NAMES);
export type ToolName = z.infer<typeof toolNameSchema>;

export const USER_ROLES = ["admin", "staff"] as const;
export const userRoleSchema = z.enum(USER_ROLES);
export type UserRole = z.infer<typeof userRoleSchema>;

/* ------------------------------------------------------------------ */
/* Labels                                                              */
/* ------------------------------------------------------------------ */

export const INTENT_LABELS: Record<IntentId, string> = {
  book_appointment: "Book appointment",
  cancel_appointment: "Cancel appointment",
  reschedule_appointment: "Reschedule",
  doctor_availability: "Doctor availability",
  clinic_info: "Clinic info",
  consultation_fees: "Consultation fees",
  report_status: "Report status",
  other: "Other",
};

export const CHANNEL_LABELS: Record<Channel, string> = {
  web_chat: "Web chat",
  voice: "Voice",
  whatsapp: "WhatsApp",
};

export const STATUS_LABELS: Record<ConversationStatus, string> = {
  active: "Active",
  completed: "Completed",
  escalated: "Escalated",
  abandoned: "Abandoned",
};

export const OUTCOME_LABELS: Record<Outcome, string> = {
  appointment_booked: "Booked",
  appointment_cancelled: "Cancelled",
  appointment_rescheduled: "Rescheduled",
  info_provided: "Info provided",
  escalated: "Escalated",
  no_resolution: "No resolution",
};

export const SENTIMENT_LABELS: Record<Sentiment, string> = {
  positive: "Positive",
  neutral: "Neutral",
  negative: "Negative",
};

export const LANGUAGE_LABELS: Record<Language, string> = {
  en: "English",
  hi: "Hindi",
};

export const TOOL_LABELS: Record<ToolName, string> = {
  get_clinic_info: "Clinic info",
  list_doctors: "List doctors",
  check_availability: "Check availability",
  book_appointment: "Book appointment",
  list_my_appointments: "List appointments",
  cancel_appointment: "Cancel appointment",
  escalate_to_human: "Asked for a human",
};

/* ------------------------------------------------------------------ */
/* Colors                                                              */
/* ------------------------------------------------------------------ */

/**
 * The four semantic states, layered on top of the shadcn/ui theme (the status
 * tokens are defined in `app/globals.css`). Everything that is colored by
 * status resolves through one of these, so the green on a "booked" badge is
 * the same green as the "booked" segment of the outcome bar.
 */
export type SemanticTone = "booked" | "escalated" | "abandoned" | "info";

export const TONE_BADGE_CLASS: Record<SemanticTone, string> = {
  booked: "bg-status-booked-tint text-status-booked",
  escalated: "bg-status-escalated-tint text-status-escalated",
  abandoned: "bg-status-abandoned-tint text-status-abandoned",
  info: "bg-status-info-tint text-status-info",
};

export const TONE_DOT_CLASS: Record<SemanticTone, string> = {
  booked: "bg-status-booked",
  escalated: "bg-status-escalated",
  abandoned: "bg-status-abandoned",
  info: "bg-status-info",
};

export const TONE_RULE_CLASS: Record<SemanticTone, string> = {
  booked: "border-l-status-booked",
  escalated: "border-l-status-escalated",
  abandoned: "border-l-status-abandoned",
  info: "border-l-status-info",
};

/**
 * Raw color strings for Recharts. SVG `fill`/`stroke` accept `var(...)`, so
 * charts stay on the same tokens as the rest of the UI and follow dark mode
 * without a second palette.
 */
export const TONE_CHART_COLOR: Record<SemanticTone, string> = {
  booked: "var(--status-booked)",
  escalated: "var(--status-escalated)",
  abandoned: "var(--status-abandoned)",
  info: "var(--status-info)",
};

export const OUTCOME_TONE: Record<Outcome, SemanticTone> = {
  appointment_booked: "booked",
  appointment_cancelled: "abandoned",
  appointment_rescheduled: "booked",
  info_provided: "info",
  escalated: "escalated",
  no_resolution: "abandoned",
};

export const STATUS_TONE: Record<ConversationStatus, SemanticTone> = {
  active: "booked",
  completed: "booked",
  escalated: "escalated",
  abandoned: "abandoned",
};

export const SENTIMENT_TONE: Record<Sentiment, SemanticTone> = {
  positive: "booked",
  neutral: "info",
  negative: "escalated",
};

/**
 * Distinct segment colors for the outcome bar. Outcomes that share a tone
 * (booked and rescheduled are both "booked") still need to be tellable apart
 * inside a single stacked bar, so each gets its own shade of the tone.
 */
export const OUTCOME_CHART_COLOR: Record<Outcome, string> = {
  appointment_booked: "var(--status-booked)",
  appointment_rescheduled:
    "color-mix(in oklab, var(--status-booked) 55%, var(--background))",
  appointment_cancelled:
    "color-mix(in oklab, var(--status-abandoned) 55%, var(--background))",
  info_provided:
    "color-mix(in oklab, var(--status-info) 60%, var(--background))",
  escalated: "var(--status-escalated)",
  no_resolution: "var(--status-abandoned)",
};

export const CHANNEL_CHART_COLOR: Record<Channel, string> = {
  web_chat: "var(--status-booked)",
  voice: "var(--foreground)",
  whatsapp: "color-mix(in oklab, var(--status-booked) 55%, var(--background))",
};

/* ------------------------------------------------------------------ */
/* Date coercion                                                       */
/* ------------------------------------------------------------------ */

/**
 * A `Date` cannot cross the Server/Client Component boundary intact, so every
 * date is normalized to an ISO 8601 string at the data layer. This accepts
 * whatever MongoDB, the seed script or an ingest payload hands us — a Date, an
 * epoch, an ISO string, or an object with `toDate()` — and produces that
 * string.
 */
export const isoDate = z
  .custom<unknown>()
  .transform((value, ctx): string => {
    if (typeof value === "string") {
      const parsed = new Date(value);
      if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
    } else if (value instanceof Date) {
      if (!Number.isNaN(value.getTime())) return value.toISOString();
    } else if (typeof value === "number") {
      const parsed = new Date(value);
      if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
    } else if (
      typeof value === "object" &&
      value !== null &&
      "toDate" in value &&
      typeof (value as { toDate: unknown }).toDate === "function"
    ) {
      const parsed = (value as { toDate: () => Date }).toDate();
      if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
    }
    ctx.addIssue({
      code: "custom",
      message: "Expected a Date, epoch, ISO string or an object with toDate()",
    });
    return z.NEVER;
  });

/*
 * Fields that may be absent, null, or present — all normalizing to null.
 *
 * `.nullish()` rather than a union including `z.undefined()`: once
 * `.transform()` wraps a union, Zod still treats the key as required, so an
 * omitted field would be rejected rather than defaulted.
 */
export const nullableIsoDate = isoDate
  .nullish()
  .transform((value) => value ?? null);

const nullableString = z
  .string()
  .nullish()
  .transform((value) => value ?? null);

/* ------------------------------------------------------------------ */
/* Document schemas                                                    */
/* ------------------------------------------------------------------ */

export const clinicSchema = z.object({
  id: z.string(),
  name: z.string(),
  timezone: z.string(),
  createdAt: isoDate,
});
export type Clinic = z.infer<typeof clinicSchema>;

export const appUserSchema = z.object({
  uid: z.string(),
  email: nullableString,
  displayName: nullableString,
  photoURL: nullableString,
  role: userRoleSchema,
  clinicId: z.string(),
  createdAt: isoDate,
  lastLoginAt: isoDate,
});
export type AppUser = z.infer<typeof appUserSchema>;

export const patientSchema = z.object({
  name: z.string(),
  phone: z.string(),
  email: nullableString,
  isReturning: z.boolean(),
});
export type Patient = z.infer<typeof patientSchema>;

/**
 * Per-conversation tool tally, denormalized at write time. The analytics page
 * reads tool reliability from this instead of fanning out into every message
 * subcollection (see §9 of the build plan).
 */
export const toolStatSchema = z.object({
  calls: z.number().int().nonnegative(),
  errors: z.number().int().nonnegative(),
  durationMsTotal: z.number().nonnegative(),
  durationsMs: z.array(z.number().nonnegative()),
});
export type ToolStat = z.infer<typeof toolStatSchema>;

export const conversationSchema = z.object({
  id: z.string(),
  clinicId: z.string(),
  externalId: nullableString,
  patient: patientSchema,
  channel: channelSchema,
  status: conversationStatusSchema,
  outcome: outcomeSchema,
  primaryIntent: intentIdSchema,
  intents: z.array(intentIdSchema),
  doctorName: nullableString,
  appointmentAt: nullableIsoDate,
  startedAt: isoDate,
  endedAt: nullableIsoDate,
  durationSec: z.number().nonnegative(),
  messageCount: z.number().int().nonnegative(),
  patientMessageCount: z.number().int().nonnegative(),
  agentMessageCount: z.number().int().nonnegative(),
  avgAgentLatencyMs: z.number().nonnegative(),
  escalated: z.boolean(),
  escalatedAt: nullableIsoDate,
  escalationReason: nullableString,
  sentiment: sentimentSchema,
  language: languageSchema,
  summary: z.string(),
  lastMessagePreview: z.string(),
  tags: z.array(z.string()),
  toolStats: z.record(z.string(), toolStatSchema).default({}),
  reviewedBy: nullableString,
  reviewedAt: nullableIsoDate,
  staffNote: nullableString,
});
export type Conversation = z.infer<typeof conversationSchema>;

export const toolInvocationSchema = z.object({
  name: z.string(),
  args: z.record(z.string(), z.unknown()),
  result: z
    .record(z.string(), z.unknown())
    .nullish()
    .transform((value) => value ?? null),
  status: z.enum(["success", "error"]),
  error: nullableString,
  durationMs: z.number().nonnegative(),
});
export type ToolInvocation = z.infer<typeof toolInvocationSchema>;

export const messageSchema = z.object({
  id: z.string(),
  role: messageRoleSchema,
  type: messageTypeSchema,
  content: z.string(),
  timestamp: isoDate,
  audioUrl: nullableString,
  latencyMs: z.number().nullish().transform((value) => value ?? null),
  confidence: z
    .number()
    .min(0)
    .max(1)
    .nullish()
    .transform((value) => value ?? null),
  tool: toolInvocationSchema.nullish().transform((value) => value ?? null),
});
export type Message = z.infer<typeof messageSchema>;

/** Confidence at or below this reads as "the agent was guessing". */
export const LOW_CONFIDENCE_THRESHOLD = 0.7;

/* ------------------------------------------------------------------ */
/* Helpers over the unions                                             */
/* ------------------------------------------------------------------ */

export function outcomeTone(outcome: Outcome): SemanticTone {
  return OUTCOME_TONE[outcome];
}

export function isIntentId(value: string): value is IntentId {
  return (INTENT_IDS as readonly string[]).includes(value);
}

export function toolLabel(name: string): string {
  return name in TOOL_LABELS
    ? TOOL_LABELS[name as ToolName]
    : name.replace(/_/g, " ");
}

/* ------------------------------------------------------------------ */
/* Handoff vocabulary                                                  */
/* ------------------------------------------------------------------ */

/**
 * What to call an escalation, given whether a human actually picks it up.
 *
 * The data is identical either way — the patient asked to be passed to a
 * person. What differs is whether that request was *fulfilled*. Saying
 * "Escalated" when nobody was notified reads as "handled", which is the
 * opposite of true, so with handoff off the console says "Asked for a human"
 * and treats those conversations as an outstanding queue.
 *
 * Centralised here so the list, the detail page, the KPI and the table cannot
 * drift into describing the same state three different ways.
 */
export type HandoffCopy = {
  /** Outcome and status label for the escalated value. */
  label: string;
  /** KPI card title. */
  kpiLabel: string;
  /** Analytics table heading. */
  tableTitle: string;
  /** Empty state for that table. */
  tableEmpty: string;
  /** Link text through to the filtered list. */
  tableLink: string;
  /** Series name on the volume chart. */
  seriesLabel: string;
};

export function handoffCopy(handoffEnabled: boolean): HandoffCopy {
  if (handoffEnabled) {
    return {
      label: "Escalated",
      kpiLabel: "Escalated to staff",
      tableTitle: "Recent escalations",
      tableEmpty:
        "No escalations in this range — the agent handled everything itself.",
      tableLink: "All escalations",
      seriesLabel: "Escalated",
    };
  }

  return {
    label: "Asked for a human",
    kpiLabel: "Asked for a human",
    tableTitle: "Awaiting follow-up",
    tableEmpty: "Nobody asked for a human in this range.",
    tableLink: "All requests",
    seriesLabel: "Asked for a human",
  };
}

/** Outcome labels with the handoff wording applied. */
export function outcomeLabels(handoffEnabled: boolean): Record<Outcome, string> {
  return {
    ...OUTCOME_LABELS,
    escalated: handoffCopy(handoffEnabled).label,
  };
}

/** Status labels with the handoff wording applied. */
export function statusLabels(
  handoffEnabled: boolean,
): Record<ConversationStatus, string> {
  return {
    ...STATUS_LABELS,
    escalated: handoffCopy(handoffEnabled).label,
  };
}
