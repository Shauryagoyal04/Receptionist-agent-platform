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
import { spawn } from "node:child_process";

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

/*
 * Async spawn, not spawnSync: mongod runs as a child of THIS process and logs
 * through a pipe it drains on the event loop. Blocking the loop for a whole
 * script lets that pipe fill, mongod stalls writing its log, and the next
 * script times out connecting to it.
 */
function run(script: string): Promise<number> {
  return new Promise((resolve) => {
    const child = spawn("npx", ["tsx", "--conditions=react-server", script], {
      stdio: "inherit",
      env,
    });
    child.on("exit", (code) => resolve(code ?? 1));
    child.on("error", () => resolve(1));
  });
}

let status = 0;
for (const script of process.argv.slice(2)) {
  console.log(`\n[harness] ── ${script} ──`);
  const code = await run(script);
  if (code !== 0) {
    status = code;
    break;
  }
}

await server.stop();
process.exit(status);
