/*
 * Removes everything `npm run seed` wrote.
 *
 * Only documents carrying `seeded: true` are deleted, so a conversation that
 * arrived from the real agent survives a reset of the demo data. Messages are
 * embedded in the conversation document, so removing the conversation removes
 * its transcript with it — there is nothing to cascade.
 */
import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local", quiet: true });
loadEnv({ path: ".env", quiet: true });

import { COLLECTIONS, getDb, getMongoClientPromise } from "@/lib/mongodb";
import { getServerEnv } from "@/lib/env";

async function main() {
  const { DEFAULT_CLINIC_ID: clinicId } = getServerEnv();
  const db = await getDb();

  console.log(`Clearing seeded conversations for clinic "${clinicId}"…`);

  const result = await db
    .collection(COLLECTIONS.conversations)
    .deleteMany({ clinicId, seeded: true });

  console.log(`Done. Removed ${result.deletedCount} seeded conversations.`);

  await (await getMongoClientPromise()).close();
}

main().catch(async (error) => {
  console.error("\nClearing failed:\n", error);
  process.exit(1);
});
