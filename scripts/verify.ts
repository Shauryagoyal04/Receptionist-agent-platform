/*
 * Reads seeded data back through the real data layer and prints it.
 *
 *   npm run verify
 *
 * This is the check that the Zod schemas, the Timestamp→ISO coercion and the
 * Firestore indexes all agree with what the seed script wrote. It goes
 * through lib/data/conversations.ts rather than querying directly, so a
 * mismatch between the stored shape and the parsed shape fails here rather
 * than as an empty page in the browser.
 */
import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local", quiet: true });
loadEnv({ path: ".env", quiet: true });

import { getServerEnv } from "@/lib/env";
import {
  EMPTY_FILTERS,
  clinicHasAnyConversations,
  getConversationsInRange,
  getMessages,
  listConversations,
} from "@/lib/data/conversations";
import { formatDuration, formatPhone } from "@/lib/utils";
import { OUTCOME_LABELS, INTENT_LABELS } from "@/lib/types";

async function main() {
  const { DEFAULT_CLINIC_ID: clinicId } = getServerEnv();

  const any = await clinicHasAnyConversations(clinicId);
  if (!any) {
    console.log(
      `No conversations for clinic "${clinicId}". Run \`npm run seed\` first.`,
    );
    return;
  }

  // --- Page one of the list --------------------------------------------
  const page = await listConversations(clinicId, EMPTY_FILTERS, null);
  console.log(
    `Newest ${page.conversations.length} conversations (next cursor: ${page.nextCursor ? "yes" : "none"})\n`,
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

  // --- One conversation in full ----------------------------------------
  const first = page.conversations[0];
  if (!first) return;

  const messages = await getMessages(first.id);
  console.log(`\nConversation ${first.id}`);
  console.log(`  Patient      ${first.patient.name} (${formatPhone(first.patient.phone)})`);
  console.log(`  Channel      ${first.channel}`);
  console.log(`  Intent       ${INTENT_LABELS[first.primaryIntent]}`);
  console.log(`  Outcome      ${OUTCOME_LABELS[first.outcome]}`);
  console.log(`  Doctor       ${first.doctorName ?? "—"}`);
  console.log(`  Duration     ${formatDuration(first.durationSec)}`);
  console.log(`  Sentiment    ${first.sentiment}`);
  console.log(`  Summary      ${first.summary}`);
  console.log(`  Tokens       ${first.searchTokens.slice(0, 8).join(", ")}`);
  console.log(`  Tool stats   ${JSON.stringify(first.toolStats)}`);
  console.log(`  Messages     ${messages.length} parsed from the subcollection`);

  if (messages.length !== first.messageCount) {
    console.error(
      `\n  MISMATCH: messageCount says ${first.messageCount} but ${messages.length} messages parsed.`,
    );
    process.exitCode = 1;
  }

  // --- Range query used by the analytics page ---------------------------
  const to = new Date();
  const from = new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);
  const range = await getConversationsInRange(
    clinicId,
    from.toISOString(),
    to.toISOString(),
  );
  console.log(
    `\nLast 30 days: ${range.conversations.length} conversations${range.truncated ? " (truncated)" : ""}`,
  );

  // --- Search -----------------------------------------------------------
  const lastFour = first.patient.phone.slice(-4);
  const found = await listConversations(
    clinicId,
    { ...EMPTY_FILTERS, q: lastFour },
    null,
  );
  console.log(
    `Searching the last four digits "${lastFour}" returns ${found.conversations.length} conversation(s).`,
  );
  if (found.conversations.length === 0) {
    console.error("  MISMATCH: search tokens are not being written or indexed.");
    process.exitCode = 1;
  }

  console.log("\nAll reads parsed cleanly against the Zod schemas.");
}

main().catch((error) => {
  console.error("\nVerification failed:\n", error);
  process.exit(1);
});
