/*
 * Creates the indexes the console depends on.
 *
 *   npm run db:setup
 *
 * Safe to run repeatedly — createIndex is idempotent. `npm run seed` calls the
 * same functions, so a fresh demo database needs nothing extra; this exists
 * for deploying against a database that already holds real agent data.
 */
import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local", quiet: true });
loadEnv({ path: ".env", quiet: true });

import { getMongoClientPromise } from "@/lib/mongodb";
import { getServerEnv } from "@/lib/env";
import { ensureConversationIndexes } from "@/lib/data/conversations";
import { ensureUserIndexes } from "@/lib/data/users";

async function main() {
  const env = getServerEnv();
  console.log(`Creating indexes in "${env.MONGODB_DB}"…`);

  await ensureConversationIndexes();
  await ensureUserIndexes();

  console.log("Done. Conversation and user indexes are in place.");
  await (await getMongoClientPromise()).close();
}

main().catch((error) => {
  console.error("\nIndex setup failed:\n", error);
  process.exit(1);
});
