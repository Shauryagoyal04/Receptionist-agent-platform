/*
 * Runs scripts against a throwaway in-memory MongoDB.
 *
 *   npm run verify:local     — seed a fresh database and check every read
 *
 * Lets the data layer be exercised end to end without an Atlas cluster or a
 * local mongod, which is how the seed script and every query in
 * lib/data/conversations.ts are verified in CI and on a clean checkout.
 * Nothing it writes touches the real database.
 */
import { MongoMemoryServer } from "mongodb-memory-server";
import { spawnSync } from "node:child_process";

const server = await MongoMemoryServer.create({ binary: { version: "7.0.14" } });
const uri = server.getUri();
console.log(`[harness] ephemeral mongo at ${uri}`);

const env = {
  ...process.env,
  MONGODB_URI: uri,
  MONGODB_DB: "clinic_test",
  AUTH_SECRET: "test-secret-value-at-least-32-characters-long",
  DEFAULT_CLINIC_ID: "main-clinic",
  DEFAULT_CLINIC_TIMEZONE: "Asia/Kolkata",
  SIGNUP_ALLOWED_DOMAINS: "",
};

let status = 0;
for (const script of process.argv.slice(2)) {
  console.log(`\n[harness] ── ${script} ──`);
  const result = spawnSync("npx", ["tsx", "--conditions=react-server", script], {
    stdio: "inherit",
    env,
  });
  if (result.status !== 0) {
    status = result.status ?? 1;
    break;
  }
}

await server.stop();
process.exit(status);
