/*
 * Reads seeded data back through the real data layer and prints it.
 *
 *   npm run verify
 *
 * This is the check that the Zod schemas, the Date→ISO coercion and the
 * indexes all agree with what the seed script wrote. It goes through
 * lib/data/conversations.ts rather than querying directly, so a mismatch
 * between the stored shape and the parsed shape fails here rather than as an
 * empty page in the browser.
 */
import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local", quiet: true });
loadEnv({ path: ".env", quiet: true });

import { getServerEnv } from "@/lib/env";
import { getMongoClientPromise } from "@/lib/mongodb";
import {
  EMPTY_FILTERS,
  clinicHasAnyConversations,
  getAdjacentConversations,
  getConversationsInRange,
  getMessages,
  listConversations,
} from "@/lib/data/conversations";
import { formatDuration, formatPhone } from "@/lib/utils";
import { OUTCOME_LABELS, INTENT_LABELS } from "@/lib/types";

let failures = 0;

function expect(label: string, condition: boolean, detail = "") {
  if (condition) {
    console.log(`  ok   ${label}`);
  } else {
    console.log(`  FAIL ${label}${detail ? ` — ${detail}` : ""}`);
    failures += 1;
  }
}

async function main() {
  const { DEFAULT_CLINIC_ID: clinicId } = getServerEnv();

  if (!(await clinicHasAnyConversations(clinicId))) {
    console.log(
      `No conversations for clinic "${clinicId}". Run \`npm run seed\` first.`,
    );
    await (await getMongoClientPromise()).close();
    return;
  }

  // --- Page one of the list --------------------------------------------
  const page = await listConversations(clinicId, EMPTY_FILTERS, 1);
  console.log(
    `\nPage 1 of ${page.pageCount} — ${page.total} conversations total\n`,
  );

  for (const conversation of page.conversations.slice(0, 5)) {
    console.log(
      `  ${conversation.startedAt.slice(0, 16).replace("T", " ")}  ` +
        `${conversation.patient.name.padEnd(26)} ` +
        `${formatPhone(conversation.patient.phone).padEnd(17)} ` +
        `${OUTCOME_LABELS[conversation.outcome].padEnd(12)} ` +
        `${String(conversation.messageCount).padStart(2)} msg  ` +
        `${formatDuration(conversation.durationSec)}`,
    );
  }

  const first = page.conversations[0];
  if (!first) return;

  // --- One conversation in full ----------------------------------------
  const messages = await getMessages(clinicId, first.id);
  console.log(`\nConversation ${first.id}`);
  console.log(`  Patient      ${first.patient.name} (${formatPhone(first.patient.phone)})`);
  console.log(`  Channel      ${first.channel}`);
  console.log(`  Intent       ${INTENT_LABELS[first.primaryIntent]}`);
  console.log(`  Outcome      ${OUTCOME_LABELS[first.outcome]}`);
  console.log(`  Doctor       ${first.doctorName ?? "—"}`);
  console.log(`  Duration     ${formatDuration(first.durationSec)}`);
  console.log(`  Sentiment    ${first.sentiment}`);
  console.log(`  Summary      ${first.summary}`);
  console.log(`  Tool stats   ${JSON.stringify(first.toolStats)}`);

  console.log("\nChecks");
  expect(
    "messageCount matches the embedded transcript",
    messages.length === first.messageCount,
    `${first.messageCount} vs ${messages.length}`,
  );
  expect(
    "messages are ordered oldest first",
    messages.every(
      (message, index) =>
        index === 0 ||
        Date.parse(messages[index - 1].timestamp) <= Date.parse(message.timestamp),
    ),
  );
  expect("page size is respected", page.conversations.length <= 25);
  expect(
    "pageCount agrees with the total",
    page.pageCount === Math.max(1, Math.ceil(page.total / 25)),
  );

  // --- Pagination -------------------------------------------------------
  if (page.pageCount > 1) {
    const second = await listConversations(clinicId, EMPTY_FILTERS, 2);
    const overlap = second.conversations.filter((row) =>
      page.conversations.some((other) => other.id === row.id),
    );
    expect("page 2 does not repeat page 1", overlap.length === 0);

    const past = await listConversations(clinicId, EMPTY_FILTERS, 9999);
    expect("an out-of-range page clamps to the last", past.page === past.pageCount);
  }

  // --- Substring search -------------------------------------------------
  const surname = first.patient.name.split(" ").pop() ?? "";
  const partial = surname.slice(0, Math.max(3, surname.length - 2));
  const found = await listConversations(
    clinicId,
    { ...EMPTY_FILTERS, q: partial },
    1,
  );
  expect(
    `substring search "${partial}" finds "${surname}"`,
    found.conversations.some((row) => row.patient.name.includes(surname)),
    `${found.total} results`,
  );

  const digits = first.patient.phone.slice(-5);
  const byPhone = await listConversations(
    clinicId,
    { ...EMPTY_FILTERS, q: digits },
    1,
  );
  expect(
    `phone search "${digits}" finds the patient`,
    byPhone.conversations.some((row) => row.patient.phone.endsWith(digits)),
  );

  // --- Filters ----------------------------------------------------------
  const escalated = await listConversations(
    clinicId,
    { ...EMPTY_FILTERS, outcome: ["escalated"] },
    1,
  );
  expect(
    "outcome filter returns only that outcome",
    escalated.conversations.every((row) => row.outcome === "escalated"),
    `${escalated.total} escalated`,
  );

  const combined = await listConversations(
    clinicId,
    { ...EMPTY_FILTERS, outcome: ["appointment_booked"], channel: ["voice"] },
    1,
  );
  expect(
    "two facets combine correctly",
    combined.conversations.every(
      (row) => row.outcome === "appointment_booked" && row.channel === "voice",
    ),
    `${combined.total} matched`,
  );

  // --- Neighbours -------------------------------------------------------
  const neighbors = await getAdjacentConversations(clinicId, first, EMPTY_FILTERS);
  expect(
    "newest conversation has no previous",
    neighbors.previous === null,
  );
  expect("newest conversation has a next", neighbors.next !== null);
  if (neighbors.next) {
    expect(
      "next is older than current",
      Date.parse(neighbors.next.startedAt) <= Date.parse(first.startedAt),
    );
  }

  // --- Range query used by the analytics page ---------------------------
  const to = new Date();
  const from = new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);
  const range = await getConversationsInRange(
    clinicId,
    from.toISOString(),
    to.toISOString(),
  );
  expect(
    "30-day range is within the 90-day total",
    range.conversations.length <= page.total,
    `${range.conversations.length} in range`,
  );
  expect(
    "every conversation in range is inside it",
    range.conversations.every(
      (row) =>
        Date.parse(row.startedAt) >= from.getTime() &&
        Date.parse(row.startedAt) <= to.getTime(),
    ),
  );

  console.log(
    failures === 0
      ? "\nAll reads parsed cleanly against the Zod schemas.\n"
      : `\n${failures} CHECK(S) FAILED\n`,
  );

  await (await getMongoClientPromise()).close();
  if (failures > 0) process.exit(1);
}

main().catch((error) => {
  console.error("\nVerification failed:\n", error);
  process.exit(1);
});
