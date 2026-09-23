/*
 * A fixed-window rate limiter held in process memory.
 *
 * Deliberately simple, and worth being honest about its limits: it is per
 * instance, so N serverless instances allow N times the configured rate, and
 * it resets on deploy. That is an acceptable backstop against a runaway agent
 * retry loop, which is the actual risk here — the endpoint is already behind a
 * shared secret, so this is not the thing standing between an attacker and
 * the database. A deployment that needs a real global limit should put one in
 * front of the app (Vercel's, or Redis-backed) rather than grow this.
 */

const WINDOW_MS = 60_000;
const MAX_REQUESTS = 60;

type Window = { count: number; resetAt: number };

const windows = new Map<string, Window>();

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  /** Seconds until the window resets, for the Retry-After header. */
  retryAfterSeconds: number;
};

export function checkRateLimit(
  key: string,
  now = Date.now(),
): RateLimitResult {
  const existing = windows.get(key);

  if (!existing || now >= existing.resetAt) {
    windows.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return {
      allowed: true,
      remaining: MAX_REQUESTS - 1,
      retryAfterSeconds: Math.ceil(WINDOW_MS / 1000),
    };
  }

  existing.count += 1;
  const retryAfterSeconds = Math.max(
    1,
    Math.ceil((existing.resetAt - now) / 1000),
  );

  if (existing.count > MAX_REQUESTS) {
    return { allowed: false, remaining: 0, retryAfterSeconds };
  }

  return {
    allowed: true,
    remaining: MAX_REQUESTS - existing.count,
    retryAfterSeconds,
  };
}

/** Keeps the map from growing without bound on a long-lived instance. */
export function pruneRateLimitWindows(now = Date.now()): void {
  for (const [key, window] of windows) {
    if (now >= window.resetAt) windows.delete(key);
  }
}

export const RATE_LIMIT = { WINDOW_MS, MAX_REQUESTS } as const;
