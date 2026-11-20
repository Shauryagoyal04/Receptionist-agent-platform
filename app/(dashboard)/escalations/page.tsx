import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CircleCheck, Clock, Inbox, Phone, Quote } from "lucide-react";

import { PageHeader, PageShell } from "@/components/page-header";
import { CHANNEL_ICON } from "@/components/analytics/channel-split";
import { RegionEmpty } from "@/components/analytics/panel";
import { EscalationActions } from "@/components/escalations/escalation-actions";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth/session";
import { getServerEnv } from "@/lib/env";
import { countOpenEscalations, listEscalations, type EscalationRow } from "@/lib/data/escalations";
import { formatInZone, msSince } from "@/lib/time";
import {
  CHANNEL_LABELS,
  CHANNEL_MEANING,
  ESCALATION_STATUSES,
  escalationStatusSchema,
  meaningVar,
  type EscalationStatus,
} from "@/lib/types";
import { cn, formatPhone } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Escalations",
  description: "Patients who asked to talk to a person.",
};

/** Named the way the desk thinks about them, not by their stored status. */
const TAB_LABELS: Record<EscalationStatus, string> = {
  open: "Waiting",
  claimed: "In progress",
  resolved: "Resolved",
};

/** `just now`, `12 min`, `2 h 5 min`, `3 days`. */
function waited(ms: number): string {
  const minutes = Math.max(0, Math.floor(ms / 60000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return minutes % 60 === 0 ? `${hours} h` : `${hours} h ${minutes % 60} min`;
  const days = Math.floor(hours / 24);
  return `${days} ${days === 1 ? "day" : "days"}`;
}

function when(iso: string | null, timeZone: string): string {
  if (!iso) return "—";
  return formatInZone(iso, timeZone, {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default async function EscalationsPage({ searchParams }: PageProps<"/escalations">) {
  const user = await getCurrentUser();
  // The layout already redirected, but a Server Component must not assume it.
  if (!user) return null;

  const { DEFAULT_CLINIC_TIMEZONE: timeZone } = getServerEnv();
  const raw = await searchParams;
  const parsedStatus = escalationStatusSchema.safeParse(
    Array.isArray(raw.status) ? raw.status[0] : raw.status,
  );
  const status: EscalationStatus = parsedStatus.success ? parsedStatus.data : "open";

  const [rows, openCount] = await Promise.all([
    listEscalations(user.clinicId, status),
    // The "Waiting" count shows on every tab; it is the number that matters.
    status === "open" ? Promise.resolve(-1) : countOpenEscalations(user.clinicId).catch(() => 0),
  ]);
  const waitingCount = status === "open" ? rows.length : openCount;
  const longestWait =
    status === "open" && rows.length > 0
      ? Math.max(...rows.map((row) => msSince(row.createdAt)))
      : 0;

  return (
    <PageShell>
      <PageHeader
        title="Escalations"
      />

      <nav
        aria-label="Escalation status"
        className="bg-surface border-line mt-6 inline-flex h-10 items-center gap-0.5 rounded-[10px] border p-0.5"
      >
        {ESCALATION_STATUSES.map((value) => {
          const active = value === status;
          return (
            <Link
              key={value}
              href={value === "open" ? "/escalations" : `/escalations?status=${value}`}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex h-full items-center gap-2 rounded-lg px-3.5 text-sm font-medium transition-colors duration-(--dur-quick)",
                active ? "bg-ink text-surface" : "text-ink-3 hover:text-ink hover:bg-sunken",
              )}
            >
              {TAB_LABELS[value]}
              {value === "open" && waitingCount > 0 && (
                <span
                  className={cn(
                    "tnum inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-semibold",
                    active ? "bg-human text-white" : "bg-human-soft text-human-text",
                  )}
                >
                  {waitingCount}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {status === "open" && rows.length > 0 && (
        <p className="bg-human-soft text-human-text mt-5 flex items-center gap-2.5 rounded-xl px-4 py-3 text-sm">
          <Clock className="size-4 shrink-0" aria-hidden="true" />
          <span>
            <strong className="font-semibold">
              {rows.length} {rows.length === 1 ? "patient is" : "patients are"} waiting for a person.
            </strong>{" "}
            {rows.length > 1 ? "The longest has waited " : "They've waited "}
            <span className="tnum font-semibold">{waited(longestWait)}</span>. Oldest is at the top.
          </span>
        </p>
      )}

      {rows.length === 0 ? (
        <EmptyState status={status} />
      ) : (
        <ul className="mt-5 flex flex-col gap-3">
          {/* Waiting patients are served oldest first, like a queue. */}
          {(status === "open" ? [...rows].reverse() : rows).map((row) => (
            <li key={row.id}>
              <EscalationCard row={row} timeZone={timeZone} />
            </li>
          ))}
        </ul>
      )}
    </PageShell>
  );
}

function EmptyState({ status }: { status: EscalationStatus }) {
  return (
    <div className="bg-surface border-line mt-5 rounded-xl border p-6">
      {status === "open" ? (
        <RegionEmpty icon={CircleCheck} tone="booked" title="No one is waiting for you.">
          When a patient asks for a person, they appear here with their number and what they
          asked about.
        </RegionEmpty>
      ) : status === "claimed" ? (
        <RegionEmpty icon={Inbox} tone="none" title="Nothing in progress.">
          Escalations you or a colleague claim show here until they&apos;re resolved.
        </RegionEmpty>
      ) : (
        <RegionEmpty icon={Inbox} tone="none" title="Nothing resolved yet.">
          Resolved escalations and the notes left on them show here.
        </RegionEmpty>
      )}
    </div>
  );
}

function EscalationCard({ row, timeZone }: { row: EscalationRow; timeZone: string }) {
  const isVoice = row.channel === "voice";
  const meaning = CHANNEL_MEANING[row.channel];
  const Icon = CHANNEL_ICON[row.channel];
  const phone = formatPhone(row.patientPhone);
  const open = row.status === "open";
  const resolved = row.status === "resolved";

  return (
    <article
      className={cn(
        "bg-surface border-line relative flex flex-col gap-5 overflow-hidden rounded-xl border p-5 sm:flex-row sm:items-start",
        resolved && "bg-surface/70",
      )}
    >
      {/* Amber rule: a person is needed. Gone once someone has it. */}
      {open && <span aria-hidden="true" className="bg-human absolute inset-y-0 left-0 w-1" />}

      <span
        className="flex size-10 shrink-0 items-center justify-center rounded-[10px]"
        style={{ backgroundColor: meaningVar(meaning, "soft"), color: meaningVar(meaning) }}
      >
        <Icon className="size-5" strokeWidth={1.75} aria-hidden="true" />
        <span className="sr-only">{CHANNEL_LABELS[row.channel]}</span>
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <h2 className={cn("text-[17px] leading-6 font-semibold", resolved ? "text-ink-2" : "text-ink")}>
            {row.patientName || "Unknown patient"}
          </h2>
          {open ? (
            <span className="bg-human-soft text-human-text inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-xs font-semibold">
              <Clock className="size-3.5" aria-hidden="true" />
              <span className="tnum">Waiting {waited(msSince(row.createdAt))}</span>
            </span>
          ) : (
            <time dateTime={row.createdAt} className="tnum text-ink-3 text-[13px]">
              Asked {when(row.createdAt, timeZone)}
            </time>
          )}
        </div>

        {/* A voice caller is waiting for a phone call, so the number is the
            main thing on the card. */}
        <a
          href={`tel:${row.patientPhone}`}
          className={cn(
            "tnum mt-1 inline-flex items-center gap-1.5 rounded-md hover:underline",
            isVoice && !resolved ? "text-ink text-base font-semibold" : "text-ink-2 text-sm",
          )}
        >
          <Phone className="size-3.5 shrink-0" aria-hidden="true" />
          {phone}
        </a>
        {isVoice && !resolved && (
          <p className="text-ink-3 text-[13px]">
            The caller was told the clinic will call them back on this number.
          </p>
        )}

        <blockquote className="bg-sunken text-ink-2 mt-3 flex gap-2 rounded-[10px] px-3.5 py-2.5 text-sm whitespace-pre-wrap">
          <Quote className="text-ink-4 mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          {row.reason || "Asked for a person."}
        </blockquote>

        {row.status === "claimed" && (
          <p className="text-ink-3 mt-3 text-[13px]">
            <span className="text-ink-2 font-medium">{row.claimedByName ?? "Staff"}</span> took this ·{" "}
            <span className="tnum">{when(row.claimedAt, timeZone)}</span>
          </p>
        )}
        {resolved && (
          <p className="text-ink-3 mt-3 text-[13px]">
            Resolved by <span className="text-ink-2 font-medium">{row.resolvedByName ?? "staff"}</span> ·{" "}
            <span className="tnum">{when(row.resolvedAt, timeZone)}</span>
            {row.resolutionNote && (
              <span className="text-ink-2 mt-1 block whitespace-pre-wrap">“{row.resolutionNote}”</span>
            )}
          </p>
        )}
      </div>

      <div className="flex shrink-0 flex-col items-stretch gap-2 sm:w-60">
        {row.conversationDocId && (
          <Button asChild variant={isVoice || resolved ? "outline" : "default"}>
            <Link href={`/conversations/${row.conversationDocId}`}>
              {isVoice ? "View call transcript" : resolved ? "View chat" : "Open chat to reply"}
              <ArrowRight data-icon="inline-end" />
            </Link>
          </Button>
        )}
        {!resolved && (
          <EscalationActions
            escalationId={row.id}
            status={row.status as Exclude<EscalationStatus, "resolved">}
            conversationDocId={row.conversationDocId}
            channel={row.channel}
          />
        )}
      </div>
    </article>
  );
}
