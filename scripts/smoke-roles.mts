/*
 * Role smoke test: sign-up approval and staff/admin page access.
 *
 *   npm run build && npm run smoke:roles
 *
 * In-memory MongoDB + the production server, signing in over HTTP like a
 * browser. Checks that a new account waits for approval and sees no data, that
 * approving it (a role change in the database) applies to its existing session,
 * and that staff can't reach admin pages. Nothing touches the real database.
 */
import { MongoMemoryServer } from "mongodb-memory-server";
import { spawn } from "node:child_process";
import { MongoClient } from "mongodb";

const PORT = 3124;
const BASE = `http://127.0.0.1:${PORT}`;
const DB = "clinic_roles_smoke";
const PASSWORD = "roles-password-123";

let failures = 0;
function check(label: string, ok: boolean, detail = "") {
  console.log(`  ${ok ? "ok  " : "FAIL"} ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures += 1;
}

const mongo = await MongoMemoryServer.create({ binary: { version: "7.0.14" } });
const uri = mongo.getUri();
const env = {
  ...process.env,
  MONGODB_URI: uri,
  MONGODB_DB: DB,
  AUTH_SECRET: "roles-smoke-secret-value-at-least-32-characters",
  AUTH_URL: BASE,
  DEFAULT_CLINIC_ID: "main-clinic",
  SIGNUP_ALLOWED_DOMAINS: "",
  NODE_ENV: "production" as const,
  PORT: String(PORT),
};
Object.assign(process.env, env);

// Accounts are created through the same code the sign-up action uses.
const { createPasswordUser } = await import("@/lib/data/users");
const { hash } = await import("bcryptjs");
const admin = await createPasswordUser({
  email: "admin@example.com",
  displayName: "Ada Admin",
  passwordHash: await hash(PASSWORD, 10),
});
const newcomer = await createPasswordUser({
  email: "new@example.com",
  displayName: "Nina New",
  passwordHash: await hash(PASSWORD, 10),
});
console.log("[roles] accounts");
check("first account is admin", admin.role === "admin", admin.role);
check("later sign-ups wait for approval", newcomer.role === "pending", newcomer.role);

const app = spawn("npx", ["next", "start", "--port", String(PORT)], {
  env,
  stdio: ["ignore", "pipe", "pipe"],
});
app.stdout.on("data", () => {});
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

/** Signs in and returns a fetcher carrying that session's cookies. */
async function signIn(email: string) {
  const jar = new Map<string, string>();
  const store = (response: Response) => {
    for (const raw of response.headers.getSetCookie()) {
      const [pair] = raw.split(";");
      const index = pair.indexOf("=");
      if (index > 0) jar.set(pair.slice(0, index).trim(), pair.slice(index + 1).trim());
    }
  };
  const cookie = () => [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
  const csrf = await fetch(`${BASE}/api/auth/csrf`);
  store(csrf);
  const { csrfToken } = (await csrf.json()) as { csrfToken: string };
  store(
    await fetch(`${BASE}/api/auth/callback/credentials`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded", cookie: cookie() },
      body: new URLSearchParams({ csrfToken, email, password: PASSWORD }),
      redirect: "manual",
    }),
  );
  return async (path: string) => {
    const response = await fetch(`${BASE}${path}`, {
      headers: { cookie: cookie() },
      redirect: "manual",
    });
    return { status: response.status, location: response.headers.get("location") ?? "", html: await response.text() };
  };
}

const client = await new MongoClient(uri).connect();
const users = client.db(DB).collection("users");

try {
  await waitForServer();

  console.log("\n[roles] pending account");
  const asNew = await signIn("new@example.com");
  for (const path of ["/analytics", "/conversations", "/escalations", "/team"]) {
    const page = await asNew(path);
    check(
      `${path} shows "waiting for approval", no nav`,
      page.html.includes("Waiting for approval") && !page.html.includes('aria-label="Main"'),
      `${page.status} ${page.location}`,
    );
  }

  console.log("\n[roles] admin");
  const asAdmin = await signIn("admin@example.com");
  const team = await asAdmin("/team");
  check("/team renders for admin", team.status === 200, `${team.status}`);
  check("/team lists the pending account", team.html.includes("Nina New") && team.html.includes("Needs approval"));
  check("admin can't change their own role", team.html.includes("Another admin can change your role"));
  check("nav has Team", team.html.includes('href="/team"'));

  console.log("\n[roles] approved as staff (same session, no re-login)");
  await users.updateOne({ email: "new@example.com" }, { $set: { role: "staff" } });
  const conversations = await asNew("/conversations");
  check("/conversations now renders", conversations.status === 200 && !conversations.html.includes("Waiting for approval"));
  check("staff nav has no Team or Doctors", !conversations.html.includes('href="/team"') && !conversations.html.includes('href="/doctors"'));
  for (const path of ["/team", "/doctors", "/clinic", "/patients", "/settings/data"]) {
    const page = await asNew(path);
    // Routes with a loading.tsx stream, so the redirect arrives in the body
    // (NEXT_REDIRECT + meta refresh) with a 200: the status can't change once
    // streaming starts. Either form must point at /analytics.
    const redirected =
      (page.status === 307 && page.location.includes("/analytics")) ||
      page.html.includes("NEXT_REDIRECT;replace;/analytics;");
    check(`${path} is refused for staff`, redirected, `${page.status} ${page.location}`);
  }

  console.log("\n[roles] demoted back to pending");
  await users.updateOne({ email: "new@example.com" }, { $set: { role: "pending" } });
  const again = await asNew("/conversations");
  check("access is gone on the next request", again.html.includes("Waiting for approval"));
} finally {
  app.kill("SIGTERM");
  await client.close();
  await mongo.stop();
}

console.log(failures === 0 ? "\nAll role checks passed." : `\n${failures} role check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
