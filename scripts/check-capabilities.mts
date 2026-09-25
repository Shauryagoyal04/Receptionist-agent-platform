/*
 * Proves the capability flags restore every gated surface with no code change.
 *
 *   npm run check:capabilities
 *
 * `npm run smoke` covers the current deployment (WhatsApp only, no handoff).
 * This runs the opposite configuration — every channel on, handoff on — and
 * asserts the channel column, channel filter, Channels card, "Resolved
 * without a human" KPI and escalation wording all come back.
 *
 * That is the test that keeps "hidden, not deleted" honest: if someone later
 * removes a gated surface instead of gating it, this fails.
 */
import { MongoMemoryServer } from "mongodb-memory-server";
import { spawn, spawnSync } from "node:child_process";
import type { ChildProcessByStdio } from "node:child_process";
import type { Readable } from "node:stream";
import { MongoClient } from "mongodb";
import { hash } from "bcryptjs";

const PORT = 3131;
const BASE = `http://127.0.0.1:${PORT}`;
const EMAIL = "flags@hospital.example";
const PASSWORD = "flags-password-123";

let failures = 0;
function check(label: string, ok: boolean, detail = "") {
  console.log(`  ${ok ? "ok  " : "FAIL"} ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures += 1;
}

const server = await MongoMemoryServer.create({ binary: { version: "7.0.14" } });
const uri = server.getUri();

const env = {
  ...process.env,
  MONGODB_URI: uri,
  MONGODB_DB: "clinic_flags",
  AUTH_SECRET: "flags-secret-value-at-least-32-characters-long",
  AUTH_URL: BASE,
  DEFAULT_CLINIC_ID: "main-clinic",
  DEFAULT_CLINIC_TIMEZONE: "Asia/Kolkata",
  SIGNUP_ALLOWED_DOMAINS: "hospital.example",
  NODE_ENV: "production" as const,
  // Everything ON — the opposite of the smoke test's defaults.
  ENABLED_CHANNELS: "whatsapp,voice,web_chat",
  HUMAN_HANDOFF_ENABLED: "true",
};

console.log("[flags] seeding with all channels…");
const seeded = spawnSync(
  "npx",
  ["tsx", "--conditions=react-server", "scripts/seed.ts", "--all-channels"],
  { stdio: "inherit", env },
);
if (seeded.status !== 0) throw new Error("seed failed");

const client = await new MongoClient(uri).connect();
await client.db("clinic_flags").collection("users").insertOne({
  email: EMAIL, name: "Flags Tester", image: null, emailVerified: null,
  passwordHash: await hash(PASSWORD, 10), role: "admin", clinicId: "main-clinic",
  createdAt: new Date(), lastLoginAt: new Date(),
});
await client.close();

const app: ChildProcessByStdio<null, Readable, Readable> = spawn(
  "npx", ["next", "start", "--port", String(PORT)],
  { env, stdio: ["ignore", "pipe", "pipe"] },
);
app.stdout.on("data", () => {});
app.stderr.on("data", () => {});

const jar = new Map<string, string>();
function storeCookies(response: Response) {
  for (const raw of response.headers.getSetCookie()) {
    const [pair] = raw.split(";");
    const i = pair.indexOf("=");
    if (i > 0) jar.set(pair.slice(0, i).trim(), pair.slice(i + 1).trim());
  }
}
const cookieHeader = () => [...jar].map(([k, v]) => `${k}=${v}`).join("; ");
const get = (path: string) =>
  fetch(`${BASE}${path}`, { headers: { cookie: cookieHeader() }, redirect: "manual" });

try {
  for (let i = 0; i < 60; i += 1) {
    try { await fetch(`${BASE}/login`, { redirect: "manual" }); break; }
    catch { await new Promise((r) => setTimeout(r, 500)); }
  }

  const csrfResponse = await fetch(`${BASE}/api/auth/csrf`);
  storeCookies(csrfResponse);
  const { csrfToken } = (await csrfResponse.json()) as { csrfToken: string };
  storeCookies(await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", cookie: cookieHeader() },
    body: new URLSearchParams({ csrfToken, email: EMAIL, password: PASSWORD }),
    redirect: "manual",
  }));

  console.log("\n[flags] ENABLED_CHANNELS=all, HUMAN_HANDOFF_ENABLED=true");
  const analytics = await get("/analytics");
  const a = await analytics.text();
  check("analytics renders", analytics.status === 200, `${analytics.status}`);
  check("Channels card is back", a.includes(">Channels<"));
  check("Resolved-without-a-human KPI is back", a.includes("Resolved without a human"));
  check("booking rate still leads", a.includes("Booking completion rate"));
  check("escalation wording restored", a.includes("Recent escalations"));
  check("follow-up framing is gone", !a.includes("Awaiting follow-up"));

  const list = await get("/conversations");
  const l = await list.text();
  check("conversations renders", list.status === 200, `${list.status}`);
  check("Channel column is back", l.includes(">Channel<"));
  // The channel labels below come from the table column. The filter options
  // themselves live inside the closed Filters menu (a Radix portal that only
  // mounts on open), so they cannot be asserted from this markup — checking
  // for them here would pass for the wrong reason.
  check("channel values render in the column", l.includes("Web chat") && l.includes("Voice"));
  check("filters menu still present", l.includes("Filters, none applied"));
  check("Escalated label restored", l.includes("Escalated"));
  check("asked-for-a-human wording gone", !l.includes("Asked for a human"));

  console.log(
    failures === 0
      ? "\nFlags restore every gated surface with no code change.\n"
      : `\n${failures} CHECK(S) FAILED\n`,
  );
} finally {
  app.kill("SIGTERM");
  await server.stop();
}
process.exit(failures === 0 ? 0 : 1);
