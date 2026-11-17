import type { Metadata } from "next";
import Link from "next/link";
import { MessageSquareText, Phone, PhoneCall } from "lucide-react";

import { PageHeader, PageShell } from "@/components/page-header";
import { EscalationActions } from "@/components/escalations/escalation-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth/session";
import { getServerEnv } from "@/lib/env";
import { listEscalations, type EscalationRow } from "@/lib/data/escalations";
import { formatInZone } from "@/lib/time";
import {
  CHANNEL_LABELS,
  ESCALATION_STATUSES,
  ESCALATION_STATUS_LABELS,
  escalationStatusSchema,
  type EscalationStatus,
} from "@/lib/types";
import { cn, formatPhone } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Escalations",
  description: "Patients who asked to talk to a person.",
};

const EMPTY_COPY: Record<EscalationStatus, string> = {
  open: "Nobody is waiting for a person right now.",
  claimed: "No escalations are being worked on.",
  resolved: "No escalations have been resolved yet.",
};

export default async function EscalationsPage({
  searchParams,
}: PageProps<"/escalations">) {
  const user = await getCurrentUser();
  // The layout already redirected, but a Server Component must not assume it.
  if (!user) return null;

  const { DEFAULT_CLINIC_TIMEZONE: timeZone } = getServerEnv();
  const raw = await searchParams;
  const parsedStatus = escalationStatusSchema.safeParse(
    Array.isArray(raw.status) ? raw.status[0] : raw.status,
  );
  const status: EscalationStatus = parsedStatus.success ? parsedStatus.data : "open";

  const rows = await listEscalations(user.clinicId, status);

  return (
    <PageShell>
      <PageHeader
        title="Escalations"
        description="Patients who asked for a person. Call voice callers back; answer WhatsApp chats from the conversation."
      />

      <nav aria-label="Escalation status" className="mt-5 flex gap-1">
        {ESCALATION_STATUSES.map((value) => (
          <Button
            key={value}
            asChild
            size="sm"
            variant={value === status ? "secondary" : "ghost"}
          >
            <Link
              href={value === "open" ? "/escalations" : `/escalations?status=${value}`}
              aria-current={value === status ? "page" : undefined}
            >
              {ESCALATION_STATUS_LABELS[value]}
            </Link>
          </Button>
        ))}
      </nav>

      {rows.length === 0 ? (
        <Card className="mt-4">
          <CardContent className="text-muted-foreground py-12 text-center text-sm">
            {EMPTY_COPY[status]}
          </CardContent>
        </Card>
      ) : (
        <ul className="mt-4 flex flex-col gap-3">
          {rows.map((row) => (
            <li key={row.id}>
              <EscalationCard row={row} timeZone={timeZone} />
            </li>
          ))}
        </ul>
      )}
    </PageShell>
  );
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

function EscalationCard({ row, timeZone }: { row: EscalationRow; timeZone: string }) {
  const isVoice = row.channel === "voice";
  const phone = formatPhone(row.patientPhone);

  return (
    <Card
      className={cn(
        "border-l-2 py-0",
        row.status === "open" ? "border-l-status-escalated" : "border-l-border",
      )}
    >
      <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-semibold">
              {row.patientName || "Unknown patient"}
            </h2>
            <Badge variant="outline">
              {isVoice ? <PhoneCall /> : <MessageSquareText />}
              {CHANNEL_LABELS[row.channel]}
            </Badge>
            <time
              dateTime={row.createdAt}
              className="text-muted-foreground tabular text-xs"
            >
              {when(row.createdAt, timeZone)}
            </time>
          </div>

          {/* A voice caller is waiting for a phone call, so the number is
              the main thing on the card. */}
          <a
            href={`tel:${row.patientPhone}`}
            className={cn(
              "tabular mt-1 inline-flex items-center gap-1.5 font-mono hover:underline",
              isVoice ? "text-base font-semibold" : "text-muted-foreground text-sm",
            )}
          >
            <Phone className={cn(isVoice ? "size-4" : "size-3.5")} />
            {phone}
          </a>
          {isVoice && row.status !== "resolved" && (
            <p className="text-muted-foreground text-xs">
              The caller was told the clinic will call them back on this number.
            </p>
          )}

          <p className="mt-2 text-sm whitespace-pre-wrap">
            {row.reason || "Asked for a person."}
          </p>

          <p className="text-muted-foreground mt-2 text-xs">
            {row.status === "claimed" &&
              `Claimed by ${row.claimedByName ?? "staff"} · ${when(row.claimedAt, timeZone)}`}
            {row.status === "resolved" &&
              `Resolved by ${row.resolvedByName ?? "staff"} · ${when(row.resolvedAt, timeZone)}`}
          </p>
          {row.status === "resolved" && row.resolutionNote && (
            <p className="text-muted-foreground mt-1 text-xs whitespace-pre-wrap">
              Note: {row.resolutionNote}
            </p>
          )}
        </div>

        <div className="flex shrink-0 flex-col items-stretch gap-2 sm:w-56">
          {row.conversationDocId && (
            <Button asChild size="sm" variant={isVoice ? "outline" : "default"}>
              <Link href={`/conversations/${row.conversationDocId}`}>
                {isVoice ? "View call transcript" : "Open chat to reply"}
              </Link>
            </Button>
          )}
          {row.status !== "resolved" && (
            <EscalationActions
              escalationId={row.id}
              status={row.status}
              conversationDocId={row.conversationDocId}
              channel={row.channel}
            />
          )}
        </div>
      </CardContent>
    </Card>
  );
}
