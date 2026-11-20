"use server";

import { z } from "zod";

import { getCurrentUser } from "@/lib/auth/session";
import { getServerEnv } from "@/lib/env";
import {
  MAX_LATEST_FAILURES,
  getFailureReport,
  requestFailureReport,
  type FailureReportJob,
  type FailureReportRequest,
} from "@/lib/data/failure-reports";
import { addDaysToDateKey, isDateOnly, zonedStartOfDay } from "@/lib/time";

/*
 * "Send failures report" on the Analytics page (docs/failure-report-contract.md).
 *
 * Admins only: the report goes to the team's inbox and spends model quota.
 * Same rules as the other actions: re-check the session here, take clinicId
 * only from it, validate with zod, return expected failures instead of throwing.
 */

export type FailureReportResult =
  | { ok: true; job: FailureReportJob; alreadyRunning: boolean }
  | { ok: false; error: string };

const SESSION_EXPIRED = { ok: false, error: "Your session expired. Sign in again." } as const;
const ADMINS_ONLY = { ok: false, error: "Only admins can send the failures report." } as const;

const dateKey = z.string().refine(isDateOnly, "Pick a valid date.");

const requestSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("range"), from: dateKey, to: dateKey }),
  z.object({
    mode: z.literal("latest"),
    limit: z
      .number()
      .int("Enter a whole number.")
      .min(1, "Enter at least 1.")
      .max(MAX_LATEST_FAILURES, `At most ${MAX_LATEST_FAILURES} at a time.`),
  }),
]);

export type FailureReportInput = z.input<typeof requestSchema>;

export async function sendFailureReportAction(
  input: FailureReportInput,
): Promise<FailureReportResult> {
  const user = await getCurrentUser();
  if (!user) return SESSION_EXPIRED;
  if (user.role !== "admin") return ADMINS_ONLY;

  const parsed = requestSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "That report couldn't be sent." };
  }

  let request: FailureReportRequest;
  if (parsed.data.mode === "latest") {
    request = { mode: "latest", limit: parsed.data.limit };
  } else {
    // The page's dates are whole days in the clinic's timezone; the agent
    // wants an end-exclusive UTC range, so the end is the next day's midnight.
    const { DEFAULT_CLINIC_TIMEZONE: timeZone } = getServerEnv();
    const [a, b] =
      parsed.data.from <= parsed.data.to
        ? [parsed.data.from, parsed.data.to]
        : [parsed.data.to, parsed.data.from];
    const rangeStart = zonedStartOfDay(a, timeZone);
    const rangeEnd = zonedStartOfDay(addDaysToDateKey(b, 1), timeZone);
    if (!rangeStart || !rangeEnd) return { ok: false, error: "Pick a valid date range." };
    request = { mode: "range", rangeStart, rangeEnd };
  }

  try {
    const { queued, job } = await requestFailureReport(user.clinicId, request, user.id);
    return { ok: true, job, alreadyRunning: !queued };
  } catch (error) {
    console.error("[failure-report] request failed", error);
    return { ok: false, error: "Couldn't start the report. Try again." };
  }
}

export async function getFailureReportAction(jobId: string): Promise<FailureReportResult> {
  const user = await getCurrentUser();
  if (!user) return SESSION_EXPIRED;
  if (user.role !== "admin") return ADMINS_ONLY;
  if (!z.string().min(1).max(64).safeParse(jobId).success) {
    return { ok: false, error: "That report couldn't be found." };
  }
  try {
    const job = await getFailureReport(user.clinicId, jobId);
    return job
      ? { ok: true, job, alreadyRunning: false }
      : { ok: false, error: "That report couldn't be found." };
  } catch (error) {
    console.error("[failure-report] status read failed", error);
    return { ok: false, error: "Couldn't check on the report." };
  }
}
