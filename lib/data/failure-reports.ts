import "server-only";

import { ObjectId, type Collection, type Document } from "mongodb";

import { COLLECTIONS, getDb } from "@/lib/mongodb";

/*
 * Failures report (docs/failure-report-contract.md).
 *
 * The console queues one `failures.report` job in the agent's outbox; the
 * agent finds the conversations it failed, works out why from their Langfuse
 * traces and emails the report. The console only inserts the job and reads
 * its status back. Dates are ISO 8601 strings, as the outbox requires.
 */

export const FAILURE_REPORT_KIND = "failures.report";

/** Matches the agent's FAILURE_REPORT_MAX_CASES default. */
export const MAX_LATEST_FAILURES = 50;

export type FailureReportRequest =
  | { mode: "range"; rangeStart: string; rangeEnd: string }
  | { mode: "latest"; limit: number };

export type FailureReportStatus = "pending" | "processing" | "done" | "failed";

export type FailureReportJob = {
  id: string;
  status: FailureReportStatus;
  createdAt: string;
  /** Set when status is "done". */
  report: {
    scope: string;
    failed: number;
    analysed: number;
    notAnalysed: number;
    emailedTo: string;
  } | null;
  /** Set when status is "failed". */
  lastError: string | null;
};

async function outbox(): Promise<Collection<Document>> {
  return (await getDb()).collection(COLLECTIONS.outbox);
}

function toJob(doc: Document): FailureReportJob {
  const status = (["pending", "processing", "done", "failed"] as const).includes(doc.status)
    ? (doc.status as FailureReportStatus)
    : "pending";
  const r = doc.report;
  return {
    id: String(doc._id),
    status,
    createdAt: String(doc.createdAt ?? ""),
    report:
      r && typeof r === "object"
        ? {
            scope: String(r.scope ?? ""),
            failed: Number(r.failed ?? 0),
            analysed: Number(r.analysed ?? 0),
            notAnalysed: Number(r.notAnalysed ?? 0),
            emailedTo: String(r.emailedTo ?? ""),
          }
        : null,
    lastError: typeof doc.lastError === "string" ? doc.lastError : null,
  };
}

/** The clinic's report that is queued or being prepared, if any. */
export async function getActiveFailureReport(clinicId: string): Promise<FailureReportJob | null> {
  const doc = await (await outbox()).findOne(
    { clinicId, kind: FAILURE_REPORT_KIND, status: { $in: ["pending", "processing"] } },
    { sort: { createdAt: -1 } },
  );
  return doc ? toJob(doc) : null;
}

export async function getFailureReport(
  clinicId: string,
  id: string,
): Promise<FailureReportJob | null> {
  if (!ObjectId.isValid(id)) return null;
  const doc = await (await outbox()).findOne({
    _id: new ObjectId(id),
    clinicId,
    kind: FAILURE_REPORT_KIND,
  });
  return doc ? toJob(doc) : null;
}

/**
 * Queue a report, unless one is already on its way (then that one is returned,
 * so a double click or a second admin doesn't send two emails).
 */
export async function requestFailureReport(
  clinicId: string,
  request: FailureReportRequest,
  requestedBy: string,
): Promise<{ queued: boolean; job: FailureReportJob }> {
  const active = await getActiveFailureReport(clinicId);
  if (active) return { queued: false, job: active };

  const now = new Date().toISOString();
  const doc = {
    clinicId,
    kind: FAILURE_REPORT_KIND,
    appointmentId: null,
    status: "pending",
    attempts: 0,
    nextAttemptAt: now,
    createdAt: now,
    updatedAt: now,
    requestedBy,
    ...request,
  };
  const { insertedId } = await (await outbox()).insertOne(doc);
  return { queued: true, job: toJob({ ...doc, _id: insertedId }) };
}
