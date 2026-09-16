/*
 * Removes everything `npm run seed` wrote.
 *
 * Only documents carrying `seeded: true` are deleted, so a conversation that
 * arrived through the real ingestion endpoint survives a reset of the demo
 * data. Message subcollections are deleted explicitly — Firestore does not
 * cascade, and deleting only the parent would leave orphaned transcripts
 * that still cost storage and can never be reached.
 */
import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local", quiet: true });
loadEnv({ path: ".env", quiet: true });

import { adminDb } from "@/lib/firebase/admin";
import { getServerEnv } from "@/lib/env";

const PAGE = 100;

async function main() {
  const env = getServerEnv();
  const db = adminDb();
  const clinicId = env.DEFAULT_CLINIC_ID;

  console.log(`Clearing seeded conversations for clinic "${clinicId}"…`);

  let removed = 0;

  for (;;) {
    const snapshot = await db
      .collection("conversations")
      .where("clinicId", "==", clinicId)
      .where("seeded", "==", true)
      .limit(PAGE)
      .get();

    if (snapshot.empty) break;

    for (const doc of snapshot.docs) {
      const messages = await doc.ref.collection("messages").get();
      // One batch per conversation keeps each commit well under Firestore's
      // 500-write cap even for the longest transcripts.
      const batch = db.batch();
      messages.docs.forEach((message) => batch.delete(message.ref));
      batch.delete(doc.ref);
      await batch.commit();
      removed += 1;
    }

    console.log(`  …${removed} removed`);
  }

  console.log(`Done. Removed ${removed} seeded conversations.`);
}

main().catch((error) => {
  console.error("\nClearing failed:\n", error);
  process.exit(1);
});
