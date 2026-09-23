import * as React from "react";

import { StatusBadge } from "@/components/status-badge";
import { StaffNotes } from "@/components/conversations/staff-notes";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn, formatDurationLong, formatLatency, formatPhone } from "@/lib/utils";
import { formatInZone } from "@/lib/time";
import {
  CHANNEL_LABELS,
  INTENT_LABELS,
  LANGUAGE_LABELS,
  SENTIMENT_LABELS,
  statusLabels,
  type Conversation,
} from "@/lib/types";

/**
 * Everything about the conversation that is not the transcript.
 *
 * A definition list rather than a table: these are attribute/value pairs, and
 * `<dl>` is what lets a screen reader pair them correctly.
 */
export function MetadataRail({
  conversation,
  timeZone,
  handoffEnabled,
}: {
  conversation: Conversation;
  timeZone: string;
  handoffEnabled: boolean;
}) {
  const when = (iso: string | null) =>
    iso
      ? formatInZone(iso, timeZone, {
          dateStyle: "medium",
          timeStyle: "short",
        })
      : "—";

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardContent className="flex flex-col gap-4 py-4">
          <div>
            <h2 className="text-sm font-medium">Summary</h2>
            <p className="text-muted-foreground mt-1 text-sm">
              {conversation.summary || "No summary was recorded."}
            </p>
          </div>

          <dl className="flex flex-col gap-0 text-sm">
            <Row label="Status">
              <StatusBadge kind="status" value={conversation.status}>
                {statusLabels(handoffEnabled)[conversation.status]}
              </StatusBadge>
            </Row>
            <Row label="Sentiment">
              <StatusBadge kind="sentiment" value={conversation.sentiment}>
                {SENTIMENT_LABELS[conversation.sentiment]}
              </StatusBadge>
            </Row>
            <Row label="Started" mono>
              {when(conversation.startedAt)}
            </Row>
            <Row label="Ended" mono>
              {when(conversation.endedAt)}
            </Row>
            <Row label="Duration" mono>
              {formatDurationLong(conversation.durationSec)}
            </Row>
            <Row label="Channel">{CHANNEL_LABELS[conversation.channel]}</Row>
            <Row label="Language">{LANGUAGE_LABELS[conversation.language]}</Row>
            <Row label="Messages" mono>
              {conversation.messageCount} ({conversation.patientMessageCount}{" "}
              patient / {conversation.agentMessageCount} agent)
            </Row>
            <Row label="Avg latency" mono>
              {formatLatency(conversation.avgAgentLatencyMs)}
            </Row>
            <Row label="Doctor">{conversation.doctorName ?? "—"}</Row>
            <Row label="Appointment" mono>
              {when(conversation.appointmentAt)}
            </Row>
            <Row label="Patient">
              <span className="flex flex-col items-end">
                <span>{conversation.patient.name}</span>
                <span className="text-muted-foreground tabular font-mono text-xs">
                  {formatPhone(conversation.patient.phone)}
                </span>
                {conversation.patient.email && (
                  <span className="text-muted-foreground text-xs">
                    {conversation.patient.email}
                  </span>
                )}
                <span className="text-muted-foreground text-xs">
                  {conversation.patient.isReturning ? "Returning" : "New patient"}
                </span>
              </span>
            </Row>
          </dl>

          {conversation.intents.length > 0 && (
            <div>
              <h3 className="text-sm font-medium">Intents</h3>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {conversation.intents.map((intent) => (
                  <Badge key={intent} variant="outline">
                    {INTENT_LABELS[intent]}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {conversation.tags.length > 0 && (
            <div>
              <h3 className="text-sm font-medium">Tags</h3>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {conversation.tags.map((tag) => (
                  <Badge key={tag} variant="secondary">
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="py-4">
          <StaffNotes
            conversationId={conversation.id}
            initialNote={conversation.staffNote}
          />
          {conversation.reviewedAt && (
            <p className="text-muted-foreground mt-3 border-t pt-3 text-xs">
              Marked reviewed {when(conversation.reviewedAt)}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Row({
  label,
  children,
  mono = false,
}: {
  label: string;
  children: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-3 border-b py-1.5 last:border-b-0">
      <dt className="text-muted-foreground shrink-0">{label}</dt>
      <dd className={cn("text-right", mono && "tabular font-mono text-xs")}>
        {children}
      </dd>
    </div>
  );
}
