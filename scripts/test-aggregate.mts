/*
 * Checks the analytics aggregation against hand-computed values.
 *
 *   npm run test:aggregate
 *
 * `aggregate()` is pure, so every figure on the analytics page can be
 * verified here without a database — including the timezone bucketing, which
 * is the easiest thing to get subtly wrong and the hardest to spot by eye.
 */
import { aggregate, buildKpis, precedingRange } from "@/lib/analytics/aggregate";
import type { Conversation } from "@/lib/types";

const TZ = "Asia/Kolkata";
let failures = 0;

function check(name: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) {
    console.log(`  FAIL ${name}\n    expected ${e}\n    actual   ${a}`);
    failures += 1;
  } else {
    console.log(`  ok   ${name}`);
  }
}

/** A minimal conversation; only the fields the aggregator reads matter. */
function conv(over: Partial<Conversation> & { startedAt: string }): Conversation {
  return {
    id: over.id ?? Math.random().toString(36).slice(2),
    clinicId: "main-clinic",
    externalId: null,
    patient: { name: "Test Patient", phone: "+919000000000", email: null, isReturning: false },
    channel: "web_chat",
    status: "completed",
    outcome: "info_provided",
    primaryIntent: "clinic_info",
    intents: [],
    doctorName: null,
    appointmentAt: null,
    endedAt: null,
    durationSec: 0,
    messageCount: 0,
    patientMessageCount: 0,
    agentMessageCount: 0,
    avgAgentLatencyMs: 0,
    escalated: false,
    escalatedAt: null,
    escalationReason: null,
    sentiment: "neutral",
    language: "en",
    summary: "",
    lastMessagePreview: "",
    tags: [],
    toolStats: {},
    reviewedBy: null,
    reviewedAt: null,
    staffNote: null,
    ...over,
  } as Conversation;
}

console.log("\nhand-computed fixture: 10 conversations, 2 escalated, 4 booked");
// durations 10,20,30,40,50,60,70,80,90,100 -> median (50+60)/2 = 55
// messages  1..10 -> mean 5.5
const fixture: Conversation[] = Array.from({ length: 10 }, (_, i) =>
  conv({
    startedAt: "2026-09-10T06:00:00.000Z", // 11:30 IST on 2026-09-10
    durationSec: (i + 1) * 10,
    messageCount: i + 1,
    escalated: i < 2,
    outcome: i < 2 ? "escalated" : i < 6 ? "appointment_booked" : "info_provided",
    escalationReason: i < 2 ? "Patient asked for a human" : null,
    sentiment: i < 2 ? "negative" : "positive",
  }),
);

const s = aggregate(fixture, { from: "2026-09-01", to: "2026-09-30", timeZone: TZ });

check("total", s.total, 10);
check("escalated", s.escalated, 2);
check("booked", s.booked, 4);
check("resolved without human = 1 - 2/10", s.resolvedWithoutHumanRate, 0.8);
check("median duration = (50+60)/2", s.medianDurationSec, 55);
check("avg messages = 55/10", s.avgMessagesPerConversation, 5.5);
check("outcome tally sums to total", s.byOutcome.reduce((n, o) => n + o.count, 0), 10);
check("booked share = 0.4", s.byOutcome.find((o) => o.key === "appointment_booked")?.share, 0.4);
check("every outcome key present", s.byOutcome.length, 6);
check("recent escalations listed", s.recentEscalations.length, 2);
check("escalation reason carried", s.recentEscalations[0].reason, "Patient asked for a human");

console.log("\ntimezone bucketing");
check("30 day buckets for a 30-day range", s.days.length, 30);
check("all 10 land on the IST day", s.days.find((d) => d.day === "2026-09-10")?.total, 10);
check("06:00Z is hour 11 IST", s.hours[11], 10);
check("hours array is 24 long", s.hours.length, 24);
check("other hours are zero", s.hours.filter((h) => h > 0).length, 1);

// 19:00Z on the 10th is 00:30 IST on the 11th — must roll to the next day.
const rollover = aggregate(
  [conv({ startedAt: "2026-09-10T19:00:00.000Z" })],
  { from: "2026-09-01", to: "2026-09-30", timeZone: TZ },
);
check("late-evening UTC rolls to next IST day", rollover.days.find((d) => d.day === "2026-09-11")?.total, 1);
check("and not the previous one", rollover.days.find((d) => d.day === "2026-09-10")?.total, 0);

console.log("\nempty range");
const empty = aggregate([], { from: "2026-09-01", to: "2026-09-07", timeZone: TZ });
check("no divide-by-zero on rate", empty.resolvedWithoutHumanRate, 0);
check("median of nothing", empty.medianDurationSec, 0);
check("avg of nothing", empty.avgMessagesPerConversation, 0);
check("days still filled", empty.days.length, 7);
check("shares are zero not NaN", empty.byOutcome.every((o) => o.share === 0), true);

console.log("\ntool reliability");
const withTools = aggregate(
  [
    conv({ startedAt: "2026-09-10T06:00:00.000Z", toolStats: {
      check_availability: { calls: 2, errors: 1, durationMsTotal: 300, durationsMs: [100, 200] },
    } }),
    conv({ startedAt: "2026-09-10T06:00:00.000Z", toolStats: {
      check_availability: { calls: 2, errors: 0, durationMsTotal: 1000, durationsMs: [400, 600] },
      book_appointment: { calls: 1, errors: 0, durationMsTotal: 50, durationsMs: [50] },
    } }),
  ],
  { from: "2026-09-01", to: "2026-09-30", timeZone: TZ },
);
const ca = withTools.toolReliability.find((t) => t.name === "check_availability");
check("calls merged across conversations", ca?.calls, 4);
check("errors merged", ca?.errors, 1);
check("success rate = 1 - 1/4", ca?.successRate, 0.75);
check("median of [100,200,400,600] = 300", ca?.medianDurationMs, 300);
check("sorted by call volume", withTools.toolReliability[0].name, "check_availability");

console.log("\nperiod comparison");
check("preceding 30d range", precedingRange("2026-09-01", "2026-09-30"), { from: "2026-08-02", to: "2026-08-31" });
check("preceding 7d range", precedingRange("2026-09-24", "2026-09-30"), { from: "2026-09-17", to: "2026-09-23" });
check("single day", precedingRange("2026-09-30", "2026-09-30"), { from: "2026-09-29", to: "2026-09-29" });

const half = aggregate(fixture.slice(0, 5), { from: "2026-09-01", to: "2026-09-30", timeZone: TZ });
const kpis = buildKpis(s, half, { handoffEnabled: false });
const byId = Object.fromEntries(kpis.map((k) => [k.id, k]));
check("handled 5 -> 10 is +100%", byId.handled.delta, 1);
check("escalated increase is bad", byId.escalated.increaseIsGood, false);
check("booked increase is good", byId.booked.increaseIsGood, true);
check("messages-per-conversation increase is bad", byId.avgMessages.increaseIsGood, false);
check("six KPIs without handoff", kpis.length, 6);
check("booking rate leads", kpis[0].id, "bookingRate");
check(
  "resolved-without-a-human is omitted without handoff",
  kpis.some((k) => k.id === "resolved"),
  false,
);
const withHandoff = buildKpis(s, half, { handoffEnabled: true });
check("seven KPIs with handoff", withHandoff.length, 7);
check(
  "resolved-without-a-human returns with handoff",
  withHandoff.some((k) => k.id === "resolved"),
  true,
);
check("booking rate still leads", withHandoff[0].id, "bookingRate");
check(
  "escalation KPI is relabelled without handoff",
  byId.escalated.label,
  "Asked for a human",
);
check(
  "escalation KPI keeps its name with handoff",
  withHandoff.find((k) => k.id === "escalated")?.label,
  "Escalated to staff",
);

const zeroBase = buildKpis(s, aggregate([], { from: "2026-09-01", to: "2026-09-30", timeZone: TZ }), { handoffEnabled: false });
check("no delta against a zero baseline", zeroBase.find((k) => k.id === "handled")?.delta, null);

console.log("\nbooking completion rate");
// 4 booking-intent conversations, 3 of which booked -> 0.75
const bookingFixture: Conversation[] = [
  conv({ startedAt: "2026-09-10T06:00:00.000Z", primaryIntent: "book_appointment", outcome: "appointment_booked" }),
  conv({ startedAt: "2026-09-10T06:00:00.000Z", primaryIntent: "book_appointment", outcome: "appointment_booked" }),
  conv({ startedAt: "2026-09-10T06:00:00.000Z", primaryIntent: "doctor_availability", outcome: "appointment_booked" }),
  conv({ startedAt: "2026-09-10T06:00:00.000Z", primaryIntent: "book_appointment", outcome: "no_resolution" }),
  // Not a booking attempt — must not enter the denominator.
  conv({ startedAt: "2026-09-10T06:00:00.000Z", primaryIntent: "clinic_info", outcome: "info_provided" }),
  conv({ startedAt: "2026-09-10T06:00:00.000Z", primaryIntent: "report_status", outcome: "info_provided" }),
];
const booking = aggregate(bookingFixture, { from: "2026-09-01", to: "2026-09-30", timeZone: TZ });
check("denominator counts only booking attempts", booking.bookingIntentTotal, 4);
check("availability questions count as attempts", booking.bookingCompletionRate, 0.75);
check("total is unaffected", booking.total, 6);

const noAttempts = aggregate(
  [conv({ startedAt: "2026-09-10T06:00:00.000Z", primaryIntent: "clinic_info", outcome: "info_provided" })],
  { from: "2026-09-01", to: "2026-09-30", timeZone: TZ },
);
check("no booking attempts -> zero, not NaN", noAttempts.bookingCompletionRate, 0);
check("no booking attempts -> zero denominator", noAttempts.bookingIntentTotal, 0);
const dashKpi = buildKpis(noAttempts, noAttempts, { handoffEnabled: false })[0];
check("zero denominator renders an em dash, not 0.0%", dashKpi.value, "\u2014");

console.log(failures === 0 ? "\nAll aggregation checks passed.\n" : `\n${failures} FAILURE(S)\n`);
process.exit(failures === 0 ? 0 : 1);
