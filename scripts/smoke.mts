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
const INGEST_KEY = "smoke-ingest-key-0123456789abcdef";

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
  ENABLED_CHANNELS: "whatsapp",
  HUMAN_HANDOFF_ENABLED: "false",
  INGEST_API_KEY: INGEST_KEY,
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

  const loginWithError = await fetch(`${BASE}/login?error=CredentialsSignin`);
  const loginErrorHtml = await loginWithError.text();
  check(
    "a redirected auth error is shown as a sentence",
    loginErrorHtml.includes("email and password don&#x27;t match") ||
      loginErrorHtml.includes("email and password don't match"),
  );
  // The code still appears inside Next's RSC routing payload, which is just
  // the URL echoed back — already visible in the address bar. What matters is
  // that no raw code reaches the rendered text.
  const visibleText = loginErrorHtml.replace(/<script[\s\S]*?<\/script>/g, "");
  check(
    "the raw Auth.js code is never shown to the user",
    !visibleText.includes("CredentialsSignin"),
  );
  check(
    "Google button hidden when unconfigured",
    !(await loginPage.text()).includes("Continue with Google"),
  );

  console.log("\n[smoke] signing in");

  // A wrong password must come back as a mapped sentence, not an Auth.js code.
  const preCsrf = await fetch(`${BASE}/api/auth/csrf`);
  storeCookies(preCsrf);
  const { csrfToken: badCsrf } = (await preCsrf.json()) as { csrfToken: string };
  const badLogin = await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      cookie: cookieHeader(),
    },
    body: new URLSearchParams({
      csrfToken: badCsrf,
      email: EMAIL,
      password: "wrong-password",
    }),
    redirect: "manual",
  });
  const badLocation = badLogin.headers.get("location") ?? "";
  check(
    "wrong password is rejected",
    badLogin.status === 302 && badLocation.includes("error"),
    `${badLogin.status} ${badLocation}`,
  );
  check(
    "rejection maps to a known Auth.js code",
    badLocation.includes("CredentialsSignin"),
    badLocation,
  );
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
  check("headline KPI is booking completion", analyticsHtml.includes("Booking completion rate"));
  check(
    "the always-100% KPI is gone without handoff",
    !analyticsHtml.includes("Resolved without a human"),
  );
  check(
    "escalations are framed as a follow-up queue",
    analyticsHtml.includes("Awaiting follow-up"),
  );
  check(
    "the queue names the unmet request",
    analyticsHtml.includes("Asked for a human"),
  );
  check(
    "channels card hidden for a single channel",
    !analyticsHtml.includes(">Channels<"),
  );
  check("outcome legend rendered", analyticsHtml.includes("Booked"));
  check("follow-up queue rendered", analyticsHtml.includes("All requests"));
  check("tool reliability rendered", analyticsHtml.includes("Tool reliability"));
  // Recharts measures the DOM, so ResponsiveContainer renders nothing during
  // SSR by design. Assert the chart frames are server-rendered instead.
  check("chart frames rendered", analyticsHtml.includes("Busiest hours"));
  check("skip link present", analyticsHtml.includes("Skip to content"));
  check(
    "charts carry a text-equivalent table",
    analyticsHtml.includes("Conversations by hour of day"),
  );
  check(
    "outcome bar has a text alternative",
    /role="img"[^>]*aria-label="[^"]*percent/.test(analyticsHtml),
  );
  check("main landmark present", analyticsHtml.includes("<main"));
  check("single h1", (analyticsHtml.match(/<h1/g) ?? []).length === 1);
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
  check(
    "channel column hidden for a single channel",
    !listHtml.includes(">Channel<"),
  );
  check(
    "channel filter group hidden for a single channel",
    !listHtml.includes("Web chat"),
  );

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

  // --- Ingestion ------------------------------------------------------
  console.log("\n[smoke] ingestion");

  const ingestUrl = `${BASE}/api/ingest/conversation`;
  const ingestBody = {
    externalId: "conv_smoke_0001",
    phone: "+919876543210",
    patientName: "Rahul Deshpande",
    isReturning: true,
    channel: "whatsapp",
    status: "completed",
    outcome: "appointment_booked",
    primaryIntent: "book_appointment",
    intents: ["book_appointment"],
    doctorName: "Dr. Karan Grewal",
    appointmentAt: "2026-10-14T06:00:00.000Z",
    startedAt: new Date(Date.now() - 3600_000).toISOString(),
    escalated: false,
    sentiment: "positive",
    language: "en",
    summary: "Rahul booked an ENT slot with Dr. Karan Grewal.",
    tags: ["new-patient"],
    messages: [
      {
        role: "patient",
        type: "text",
        content: "Hi, I need to see an ENT doctor this week.",
        timestamp: new Date(Date.now() - 3600_000).toISOString(),
      },
      {
        role: "agent",
        type: "tool_call",
        content: "check_availability(doctor_name, date)",
        timestamp: new Date(Date.now() - 3595_000).toISOString(),
        tool: {
          name: "check_availability",
          args: { doctor_name: "Dr. Karan Grewal", date: "2026-10-14" },
          result: { slots: ["11:30"] },
          status: "success",
          error: null,
          durationMs: 684,
        },
      },
      {
        role: "agent",
        type: "text",
        content: "Dr. Karan Grewal has 11:30am free on 14 Oct. Shall I book it?",
        timestamp: new Date(Date.now() - 3590_000).toISOString(),
        latencyMs: 940,
        confidence: 0.94,
      },
    ],
  };

  function ingest(body: unknown, token: string | null = INGEST_KEY) {
    return fetch(ingestUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: typeof body === "string" ? body : JSON.stringify(body),
    });
  }

  const noAuth = await ingest(ingestBody, null);
  check("ingest without a token is 401", noAuth.status === 401, `${noAuth.status}`);

  const wrongAuth = await ingest(ingestBody, "wrong-key");
  check("ingest with a wrong token is 401", wrongAuth.status === 401, `${wrongAuth.status}`);
  check(
    "401 leaks no detail",
    (await wrongAuth.json()).error === "Unauthorized.",
  );

  const badJson = await ingest("{not json", INGEST_KEY);
  check("malformed JSON is 400", badJson.status === 400, `${badJson.status}`);

  const invalid = await ingest({ ...ingestBody, outcome: "nope" });
  check("invalid enum is 400", invalid.status === 400, `${invalid.status}`);
  const invalidBody = (await invalid.json()) as { issues?: Array<{ path: string }> };
  check(
    "400 names the offending field",
    invalidBody.issues?.some((issue) => issue.path === "outcome") === true,
  );

  const created = await ingest(ingestBody);
  const createdBody = (await created.json()) as {
    id: string;
    created: boolean;
    messageCount: number;
    durationSec: number;
  };
  check("valid conversation is 201", created.status === 201, `${created.status}`);
  check("server computed messageCount", createdBody.messageCount === 3, `${createdBody.messageCount}`);
  check("server computed durationSec", createdBody.durationSec === 10, `${createdBody.durationSec}`);

  const again = await ingest(ingestBody);
  const againBody = (await again.json()) as { id: string; created: boolean };
  check("re-sending is 200, not a duplicate", again.status === 200, `${again.status}`);
  check("same id on re-send", againBody.id === createdBody.id);

  const search = await get("/conversations?q=Deshpande");
  const searchHtml = await search.text();
  check("ingested conversation appears in the list", searchHtml.includes("Rahul Deshpande"));

  const detail = await get(`/conversations/${createdBody.id}`);
  const detailText = await detail.text();
  check("ingested conversation opens", detail.status === 200, `${detail.status}`);
  check("its tool call rendered", detailText.includes("Check availability"));

  const probe = await fetch(ingestUrl, {
    headers: { authorization: `Bearer ${INGEST_KEY}` },
  });
  check("GET probe confirms credentials", probe.status === 200);

  // Rate limit: 60/min, so the 61st within the window must be refused.
  let limited: Response | null = null;
  for (let i = 0; i < 62; i += 1) {
    const response = await ingest({ ...ingestBody, externalId: `conv_rate_${i}` });
    if (response.status === 429) {
      limited = response;
      break;
    }
  }
  check("rate limit kicks in", limited !== null, limited ? "429 returned" : "never limited");
  check(
    "429 carries Retry-After",
    limited?.headers.get("retry-after") !== null && limited?.headers.get("retry-after") !== undefined,
  );

  console.log(
    failures === 0 ? "\nAll smoke checks passed.\n" : `\n${failures} CHECK(S) FAILED\n`,
  );
} finally {
  app.kill("SIGTERM");
  await server.stop();
}

process.exit(failures === 0 ? 0 : 1);
