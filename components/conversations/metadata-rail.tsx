import * as React from "react";

import { StatusBadge } from "@/components/status-badge";
import { StaffNotes } from "@/components/conversations/staff-notes";
import { formatHandlingTime } from "@/components/analytics/format";
import { cn, formatLatency, formatPhone } from "@/lib/utils";
import { formatInZone } from "@/lib/time";
import {
  CHANNEL_LABELS,
  INTENT_CHART_COLOR,
  INTENT_LABELS,
  LANGUAGE_LABELS,
  SENTIMENT_LABELS,
  statusLabels,
  type Conversation,
} from "@/lib/types";

/**
 * Everything about the conversation that is not the transcript.
 *
 * Grouped the way staff ask about a chat: what happened (summary, status,
 * mood), the appointment, who the patient is, and how the agent performed.
 * Definition lists, so a screen reader pairs each label with its value.
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
          day: "numeric",
          month: "short",
          hour: "numeric",
          minute: "2-digit",
        })
      : null;

  return (
    <div className="flex flex-col gap-4">
      <RailCard title="Summary">
        <p className="text-ink-2 text-sm leading-[21px]">
          {conversation.summary || "The agent didn't write a summary for this one."}
        </p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          <StatusBadge kind="status" value={conversation.status}>
            {statusLabels(handoffEnabled)[conversation.status]}
          </StatusBadge>
          <StatusBadge kind="sentiment" value={conversation.sentiment}>
            {SENTIMENT_LABELS[conversation.sentiment]} mood
          </StatusBadge>
        </div>

        {conversation.intents.length > 0 && (
          <div className="mt-4">
            <h3 className="text-ink-3 text-xs font-medium">Asked about</h3>
            <ul className="mt-1.5 flex flex-wrap gap-1.5">
              {conversation.intents.map((intent) => (
                <li
                  key={intent}
                  className="border-line text-ink-2 inline-flex h-6 items-center gap-1.5 rounded-full border px-2.5 text-xs"
                >
                  <span
                    aria-hidden="true"
                    className="size-1.5 rounded-full"
                    style={{ backgroundColor: INTENT_CHART_COLOR[intent] }}
                  />
                  {INTENT_LABELS[intent]}
                </li>
              ))}
            </ul>
          </div>
        )}

        {conversation.tags.length > 0 && (
          <div className="mt-3">
            <h3 className="text-ink-3 text-xs font-medium">Tags</h3>
            <ul className="mt-1.5 flex flex-wrap gap-1.5">
              {conversation.tags.map((tag) => (
                <li
                  key={tag}
                  className="bg-sunken text-ink-2 inline-flex h-6 items-center rounded-full px-2.5 text-xs"
                >
                  {tag}
                </li>
              ))}
            </ul>
          </div>
        )}
      </RailCard>

      {(conversation.doctorName || conversation.appointmentAt) && (
        <RailCard title="Appointment" tone="booked">
          <dl>
            <Row label="Doctor">{conversation.doctorName ?? "Not chosen"}</Row>
            <Row label="When" numeric>
              {when(conversation.appointmentAt) ?? "No time set"}
            </Row>
          </dl>
        </RailCard>
      )}

      <RailCard title="Patient">
        <p className="text-ink text-sm font-medium">{conversation.patient.name}</p>
        <p className="tnum text-ink-2 mt-0.5 text-[13px]">{formatPhone(conversation.patient.phone)}</p>
        {conversation.patient.email && (
          <p className="text-ink-3 mt-0.5 truncate text-[13px]">{conversation.patient.email}</p>
        )}
        <span
          className={cn(
            "mt-2 inline-flex h-6 items-center rounded-full px-2.5 text-xs font-medium",
            conversation.patient.isReturning ? "bg-agent-soft text-agent-text" : "bg-sunken text-ink-2",
          )}
        >
          {conversation.patient.isReturning ? "Returning patient" : "New patient"}
        </span>
      </RailCard>

      <RailCard title="Details">
        <dl>
          <Row label="Started" numeric>
            {when(conversation.startedAt) ?? "Not recorded"}
          </Row>
          <Row label="Ended" numeric>
            {when(conversation.endedAt) ?? "Still open"}
          </Row>
          <Row label="Took" numeric>
            {formatHandlingTime(conversation.durationSec)}
          </Row>
          <Row label="Channel">{CHANNEL_LABELS[conversation.channel]}</Row>
          <Row label="Language">{LANGUAGE_LABELS[conversation.language]}</Row>
          <Row label="Messages" numeric>
            {conversation.messageCount}{" "}
            <span className="text-ink-3">
              ({conversation.patientMessageCount} patient · {conversation.agentMessageCount} agent)
            </span>
          </Row>
          <Row label="Agent reply time" numeric>
            {conversation.avgAgentLatencyMs > 0 ? formatLatency(conversation.avgAgentLatencyMs) : "Not recorded"}
          </Row>
        </dl>
      </RailCard>

      <RailCard title="Notes for the desk">
        <StaffNotes conversationId={conversation.id} initialNote={conversation.staffNote} />
        {conversation.reviewedAt && (
          <p className="border-line text-ink-3 mt-3 border-t pt-3 text-xs">
            Marked reviewed {when(conversation.reviewedAt)}
          </p>
        )}
      </RailCard>
    </div>
  );
}

function RailCard({
  title,
  tone,
  children,
}: {
  title: string;
  tone?: "booked";
  children: React.ReactNode;
}) {
  return (
    <section
      className={cn(
        "bg-surface rounded-xl border p-4",
        tone === "booked" ? "border-booked/30" : "border-line",
      )}
    >
      <h2
        className={cn(
          "mb-2 text-[13px] font-semibold",
          tone === "booked" ? "text-booked-text" : "text-ink",
        )}
      >
        {title}
      </h2>
      {children}
    </section>
  );
}

function Row({
  label,
  children,
  numeric = false,
}: {
  label: string;
  children: React.ReactNode;
  numeric?: boolean;
}) {
  return (
    <div className="border-line flex items-start justify-between gap-3 border-b py-2 text-[13px] last:border-b-0 last:pb-0 first:pt-0">
      <dt className="text-ink-3 shrink-0">{label}</dt>
      <dd className={cn("text-ink text-right", numeric && "tnum")}>{children}</dd>
    </div>
  );
}
