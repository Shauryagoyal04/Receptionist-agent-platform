import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ChevronLeft, ChevronRight, Headset } from "lucide-react";

import { PageShell } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Transcript } from "@/components/conversations/transcript";
import { MetadataRail } from "@/components/conversations/metadata-rail";
import { ReviewToggle } from "@/components/conversations/review-toggle";
import { EscalationActions } from "@/components/escalations/escalation-actions";
import {
  HandBackButton,
  LiveRefresh,
  StaffReply,
} from "@/components/escalations/staff-reply";
import { Button } from "@/components/ui/button";
import { CHANNEL_ICON } from "@/components/analytics/channel-split";
import { getCurrentUser } from "@/lib/auth/session";
import { getServerEnv } from "@/lib/env";
import {
  getAdjacentConversations,
  getConversationById,
  getMessages,
} from "@/lib/data/conversations";
import {
  REPLY_WINDOW_MS,
  getActiveEscalationForConversation,
  isWithinReplyWindow,
} from "@/lib/data/escalations";
import { formatInZone } from "@/lib/time";
import {
  buildQueryString,
  parsePage,
  parseUrlFilters,
  toDataFilters,
} from "@/lib/conversations/params";
import { CHANNEL_LABELS, CHANNEL_MEANING, meaningVar, outcomeLabels } from "@/lib/types";
import { formatPhone } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Conversation",
  description: "Full transcript, tool calls and metadata for one conversation.",
};

export default async function ConversationDetailPage({
  params,
  searchParams,
}: PageProps<"/conversations/[id]">) {
  const user = await getCurrentUser();
  if (!user) return null;

  const { DEFAULT_CLINIC_TIMEZONE: timeZone, capabilities } = getServerEnv();

  // Both are Promises in Next.js 16.
  const [{ id }, raw] = await Promise.all([params, searchParams]);

  const conversation = await getConversationById(user.clinicId, id);
  // A conversation belonging to another clinic reads as missing, not
  // forbidden — the data layer already collapsed that distinction so this
  // page cannot leak the existence of another clinic's records.
  if (!conversation) notFound();

  // The filter state the reviewer arrived with, so the back link and the
  // prev/next links walk the same queue they were looking at.
  const state = parseUrlFilters(raw, timeZone);
  const filters = toDataFilters(state, timeZone);
  const listQuery = buildQueryString(state, { page: parsePage(raw.page) });

  const [messages, neighbors, escalation] = await Promise.all([
    getMessages(user.clinicId, conversation.id),
    getAdjacentConversations(user.clinicId, conversation, filters),
    conversation.externalId
      ? getActiveEscalationForConversation(user.clinicId, conversation.externalId)
      : Promise.resolve(null),
  ]);

  // A WhatsApp chat handed to staff: the AI is silent and staff reply here.
  const staffHandled =
    conversation.channel === "whatsapp" && conversation.handledBy === "staff";
  // The 24-hour window runs from the patient's last message. Older documents
  // lack `lastPatientMessageAt`, so fall back to the transcript.
  const lastPatientAt =
    conversation.lastPatientMessageAt ??
    messages.filter((message) => message.role === "patient").at(-1)?.timestamp ??
    null;
  const windowOpen = isWithinReplyWindow(lastPatientAt);
  const windowClosesAt =
    windowOpen && lastPatientAt
      ? formatInZone(
          new Date(Date.parse(lastPatientAt) + REPLY_WINDOW_MS).toISOString(),
          timeZone,
          { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" },
        )
      : null;

  const ChannelIcon = CHANNEL_ICON[conversation.channel];
  const channelMeaning = CHANNEL_MEANING[conversation.channel];
  const startedLabel = formatInZone(conversation.startedAt, timeZone, {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <PageShell>
      <Button variant="ghost" size="sm" asChild className="-ml-2.5">
        <Link href={`/conversations${listQuery}`}>
          <ArrowLeft />
          Conversations
        </Link>
      </Button>

      <header className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          <span
            className="flex size-12 shrink-0 items-center justify-center rounded-xl"
            style={{
              backgroundColor: meaningVar(channelMeaning, "soft"),
              color: meaningVar(channelMeaning),
            }}
          >
            <ChannelIcon className="size-6" strokeWidth={1.75} aria-hidden="true" />
            <span className="sr-only">{CHANNEL_LABELS[conversation.channel]}</span>
          </span>
          <div className="min-w-0">
            <h1 className="text-ink truncate text-2xl leading-8 font-semibold sm:text-[28px] sm:leading-[34px]">
              {conversation.patient.name}
            </h1>
            <div className="text-ink-3 mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm">
              <StatusBadge kind="outcome" value={conversation.outcome}>
                {outcomeLabels(capabilities.handoffEnabled)[conversation.outcome]}
              </StatusBadge>
              <span className="tnum">{formatPhone(conversation.patient.phone)}</span>
              <span aria-hidden="true">·</span>
              <span>
                {CHANNEL_LABELS[conversation.channel]}, <time dateTime={conversation.startedAt}>{startedLabel}</time>
              </span>
            </div>
          </div>
        </div>

        <ReviewToggle
          conversationId={conversation.id}
          reviewed={conversation.reviewedBy !== null}
        />
      </header>

      {staffHandled && (
        <section
          aria-labelledby="staff-handled-title"
          className="bg-surface border-human/40 mt-5 overflow-hidden rounded-xl border"
        >
          <div className="bg-human-soft flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
            <LiveRefresh />
            <div className="flex min-w-0 items-start gap-3">
              <span className="bg-human relative flex size-9 shrink-0 items-center justify-center rounded-[10px] text-white">
                <Headset className="size-5" strokeWidth={1.75} aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <h2 id="staff-handled-title" className="text-human-text text-[15px] font-semibold">
                  You&apos;re talking to this patient. The agent has stopped replying.
                </h2>
                <p className="text-human-text/85 mt-0.5 text-[13px] leading-[18px]">
                  {conversation.escalationReason
                    ? `They asked for a person: ${conversation.escalationReason}.`
                    : "They asked for a person."}{" "}
                  {escalation?.status === "claimed"
                    ? `${escalation.claimedByName ?? "A colleague"} is handling it.`
                    : "Nobody has claimed it yet. Replying claims it."}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 flex-col gap-2 sm:w-56">
              {escalation?.status === "open" && (
                <EscalationActions
                  escalationId={escalation.id}
                  status="open"
                  conversationDocId={conversation.id}
                  channel="whatsapp"
                  claimOnly
                />
              )}
              <HandBackButton conversationId={conversation.id} />
            </div>
          </div>
          <div className="px-5 py-4">
            <StaffReply
              conversationId={conversation.id}
              windowOpen={windowOpen}
              windowClosesAt={windowClosesAt}
            />
          </div>
        </section>
      )}

      {conversation.escalated && !staffHandled && (
        <p
          role="status"
          className="bg-human-soft text-human-text mt-5 flex items-start gap-3 rounded-xl px-4 py-3 text-sm"
        >
          <Headset className="text-human mt-0.5 size-[18px] shrink-0" strokeWidth={1.75} aria-hidden="true" />
          {capabilities.handoffEnabled ? (
            <span>
              <strong className="font-semibold">Handed to clinic staff.</strong>{" "}
              {conversation.escalationReason
                ? `Reason: ${conversation.escalationReason}.`
                : "No reason was recorded."}
            </span>
          ) : (
            // Without a handoff process the agent still tells the patient
            // someone will follow up. Saying "handed to a human" here would
            // repeat that back to staff as though it were done — the opposite
            // of what they need to know.
            <span>
              <strong className="font-semibold">This patient asked for a person</strong>
              {conversation.escalationReason ? ` (${conversation.escalationReason})` : ""}. The
              agent said someone would follow up, but nobody is notified automatically. Call or
              message them back.
            </span>
          )}
        </p>
      )}

      {/* Transcript and a 320px rail side by side; the rail stacks underneath
          below 1024px rather than squeezing the transcript. */}
      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section
          aria-labelledby="transcript-title"
          className="bg-surface border-line min-w-0 rounded-xl border"
        >
          <header className="border-line flex items-baseline justify-between gap-3 border-b px-5 py-3.5">
            <h2 id="transcript-title" className="text-ink text-[17px] leading-6 font-semibold">
              Transcript
            </h2>
            <span className="text-ink-3 text-[13px]">Times in clinic local time</span>
          </header>
          <div className="px-5 py-5">
            <Transcript messages={messages} timeZone={timeZone} />
          </div>
        </section>

        <MetadataRail
          conversation={conversation}
          timeZone={timeZone}
          handoffEnabled={capabilities.handoffEnabled}
        />
      </div>

      {/* Prev/next walk the filtered queue, so a reviewer can work through it
          without returning to the list between every conversation. */}
      <nav
        aria-label="Adjacent conversations"
        className="border-line mt-6 flex items-center justify-between gap-3 border-t pt-5"
      >
        {neighbors.previous ? (
          <Button variant="outline" size="sm" asChild>
            <Link href={`/conversations/${neighbors.previous.id}${listQuery}`}>
              <ChevronLeft />
              <span className="text-ink-3 hidden sm:inline">Previous:</span>
              <span className="max-w-[12rem] truncate">
                {neighbors.previous.patient.name}
              </span>
            </Link>
          </Button>
        ) : (
          <span />
        )}

        {neighbors.next ? (
          <Button variant="outline" size="sm" asChild>
            <Link href={`/conversations/${neighbors.next.id}${listQuery}`}>
              <span className="text-ink-3 hidden sm:inline">Next:</span>
              <span className="max-w-[12rem] truncate">
                {neighbors.next.patient.name}
              </span>
              <ChevronRight />
            </Link>
          </Button>
        ) : (
          <span />
        )}
      </nav>
    </PageShell>
  );
}
