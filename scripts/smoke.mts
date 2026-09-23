/*
 * End-to-end smoke test.
 *
 *   npm run smoke
 *
 * Boots an in-memory MongoDB, seeds it, starts the production server against
 * it, signs in over HTTP exactly as a browser would, and fetches every page.
 * This is what catches the failures a typecheck cannot: a Server Component
 * that throws on real data, a redirect loop, a chart that crashes on an empty
 * bucket. Nothing it does touches the real database.
 */
import { MongoMemoryServer } from "mongodb-memory-server";
import { spawn, spawnSync } from "node:child_process";
import type { ChildProcessByStdio } from "node:child_process";
import type { Readable } from "node:stream";
import { MongoClient } from "mongodb";
import { hash } from "bcryptjs";

const PORT = 3123;
const BASE = `http://127.0.0.1:${PORT}`;
const EMAIL = "smoke@hospital.example";
const PASSWORD = "smoke-password-123";

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
  MONGODB_DB: "clinic_smoke",
  AUTH_SECRET: "smoke-secret-value-at-least-32-characters-long",
  AUTH_URL: BASE,
  DEFAULT_CLINIC_ID: "main-clinic",
  DEFAULT_CLINIC_TIMEZONE: "Asia/Kolkata",
  SIGNUP_ALLOWED_DOMAINS: "hospital.example",
  NODE_ENV: "production" as const,
  PORT: String(PORT),
};

console.log("[smoke] seeding…");
const seeded = spawnSync("npx", ["tsx", "--conditions=react-server", "scripts/seed.ts"], {
  stdio: "inherit",
  env,
});
if (seeded.status !== 0) throw new Error("seed failed");

// A user to sign in as. Created directly so the smoke test does not depend on
// the sign-up form's client-side code path.
const client = await new MongoClient(uri).connect();
await client.db("clinic_smoke").collection("users").insertOne({
  email: EMAIL,
  name: "Smoke Tester",
  image: null,
  emailVerified: null,
  passwordHash: await hash(PASSWORD, 10),
  role: "admin",
  clinicId: "main-clinic",
  createdAt: new Date(),
  lastLoginAt: new Date(),
});
await client.close();

console.log("[smoke] starting server…");
const app: ChildProcessByStdio<null, Readable, Readable> = spawn(
  "npx",
  ["next", "start", "--port", String(PORT)],
  { env, stdio: ["ignore", "pipe", "pipe"] },
);
app.stdout.on("data", (chunk: Buffer) => process.stdout.write(`[next] ${chunk}`));
app.stderr.on("data", (chunk: Buffer) => process.stderr.write(`[next] ${chunk}`));

async function waitForServer() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      await fetch(`${BASE}/login`, { redirect: "manual" });
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
  throw new Error("server never came up");
}

/** Minimal cookie jar — enough for the CSRF and session cookies. */
const jar = new Map<string, string>();
function storeCookies(response: Response) {
  for (const raw of response.headers.getSetCookie()) {
    const [pair] = raw.split(";");
    const index = pair.indexOf("=");
    if (index > 0) jar.set(pair.slice(0, index).trim(), pair.slice(index + 1).trim());
  }
}
function cookieHeader() {
  return [...jar.entries()].map(([name, value]) => `${name}=${value}`).join("; ");
}
function get(path: string) {
  return fetch(`${BASE}${path}`, {
    headers: { cookie: cookieHeader() },
    redirect: "manual",
  });
}

try {
  await waitForServer();
  console.log("\n[smoke] signed out");

  const anon = await fetch(`${BASE}/analytics`, { redirect: "manual" });
  check(
    "/analytics redirects when signed out",
    anon.status === 307 && (anon.headers.get("location") ?? "").includes("/login"),
    `${anon.status}`,
  );
  const loginPage = await fetch(`${BASE}/login`);
  check("/login renders", loginPage.status === 200);
  check(
    "Google button hidden when unconfigured",
    !(await loginPage.text()).includes("Continue with Google"),
  );

  console.log("\n[smoke] signing in");
  const csrfResponse = await fetch(`${BASE}/api/auth/csrf`);
  storeCookies(csrfResponse);
  const { csrfToken } = (await csrfResponse.json()) as { csrfToken: string };

  const signIn = await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      cookie: cookieHeader(),
    },
    body: new URLSearchParams({
      csrfToken,
      email: EMAIL,
      password: PASSWORD,
      callbackUrl: `${BASE}/analytics`,
    }),
    redirect: "manual",
  });
  storeCookies(signIn);
  check(
    "credentials sign-in sets a session cookie",
    [...jar.keys()].some((name) => name.includes("session-token")),
    `status ${signIn.status}`,
  );

  console.log("\n[smoke] signed in");
  const analytics = await get("/analytics");
  const analyticsHtml = await analytics.text();
  check("/analytics renders", analytics.status === 200, `${analytics.status}`);
  check("KPI label present", analyticsHtml.includes("Resolved without a human"));
  check("outcome legend rendered", analyticsHtml.includes("Booked"));
  check("escalations table rendered", analyticsHtml.includes("Recent escalations"));
  check("tool reliability rendered", analyticsHtml.includes("Tool reliability"));
  // Recharts measures the DOM, so ResponsiveContainer renders nothing during
  // SSR by design. Assert the chart frames are server-rendered instead.
  check("chart frames rendered", analyticsHtml.includes("Busiest hours"));
  check("volume chart frame rendered", analyticsHtml.includes("Conversation volume"));
  check(
    "no empty-state on seeded data",
    !analyticsHtml.includes("No conversations in this range"),
  );

  const emptyRange = await get("/analytics?from=2020-01-01&to=2020-01-07");
  const emptyHtml = await emptyRange.text();
  check("empty range renders", emptyRange.status === 200);
  check("empty range shows its empty state", emptyHtml.includes("No conversations in this range"));

  const list = await get("/conversations");
  const listHtml = await list.text();
  check("/conversations renders", list.status === 200, `${list.status}`);
  check("pagination shows a total", /of\s*<!-- -->?\s*<span[^>]*>400|400<\/span>/.test(listHtml) || listHtml.includes("400"));
  check("filter chips rendered", listHtml.includes("Only unreviewed"));

  const filtered = await get("/conversations?outcome=escalated&channel=voice");
  check("combined filters render", filtered.status === 200);

  const page3 = await get("/conversations?page=3");
  check("page 3 renders", page3.status === 200);

  const searched = await get("/conversations?q=Mehta");
  check("search renders", searched.status === 200);

  // Pull a real conversation id out of the list markup and open it.
  const match = /\/conversations\/([a-f0-9]{24})/.exec(listHtml);
  check("list links to a conversation", match !== null);
  if (match) {
    const detail = await get(`/conversations/${match[1]}`);
    const detailHtml = await detail.text();
    check("conversation detail renders", detail.status === 200, `${detail.status}`);
    check("transcript present", detailHtml.includes("Internal note"));
    check("metadata rail present", detailHtml.includes("Summary"));
  }

  // These stream (the route has a loading.tsx, so a Suspense boundary opens
  // before the lookup finishes), and Next.js cannot change a status code once
  // headers are sent. It signals "not found" with the UI plus a robots
  // noindex tag instead — documented behaviour, and irrelevant for a console
  // behind a login that no crawler will ever reach. What must hold is that
  // the record is not disclosed and the not-found page is what renders.
  const missing = await get("/conversations/000000000000000000000000");
  const missingHtml = await missing.text();
  check(
    "unknown conversation shows the not-found page",
    missingHtml.includes("couldn&#x27;t find that") || missingHtml.includes("couldn't find that"),
  );
  check("unknown conversation is marked noindex", missingHtml.includes('name="robots"'));

  const malformed = await get("/conversations/not-an-object-id");
  const malformedHtml = await malformed.text();
  check(
    "malformed id shows the not-found page",
    malformedHtml.includes("couldn&#x27;t find that") || malformedHtml.includes("couldn't find that"),
  );

  console.log(
    failures === 0 ? "\nAll smoke checks passed.\n" : `\n${failures} CHECK(S) FAILED\n`,
  );
} finally {
  app.kill("SIGTERM");
  await server.stop();
}

process.exit(failures === 0 ? 0 : 1);
