import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ChevronLeft, ChevronRight, TriangleAlert } from "lucide-react";

import { PageShell } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Transcript } from "@/components/conversations/transcript";
import { MetadataRail } from "@/components/conversations/metadata-rail";
import { ReviewToggle } from "@/components/conversations/review-toggle";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth/session";
import { getServerEnv } from "@/lib/env";
import {
  getAdjacentConversations,
  getConversationById,
  getMessages,
} from "@/lib/data/conversations";
import {
  buildQueryString,
  parsePage,
  parseUrlFilters,
  toDataFilters,
} from "@/lib/conversations/params";
import { CHANNEL_LABELS, OUTCOME_LABELS } from "@/lib/types";
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

  const { DEFAULT_CLINIC_TIMEZONE: timeZone } = getServerEnv();

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

  const [messages, neighbors] = await Promise.all([
    getMessages(user.clinicId, conversation.id),
    getAdjacentConversations(user.clinicId, conversation, filters),
  ]);

  return (
    <PageShell>
      <Button variant="ghost" size="sm" asChild className="-ml-2">
        <Link href={`/conversations${listQuery}`}>
          <ArrowLeft />
          Back to conversations
        </Link>
      </Button>

      <header className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
            {conversation.patient.name}
          </h1>
          <div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            <span className="tabular font-mono">
              {formatPhone(conversation.patient.phone)}
            </span>
            <span>{CHANNEL_LABELS[conversation.channel]}</span>
            <StatusBadge kind="outcome" value={conversation.outcome}>
              {OUTCOME_LABELS[conversation.outcome]}
            </StatusBadge>
          </div>
        </div>

        <ReviewToggle
          conversationId={conversation.id}
          reviewed={conversation.reviewedBy !== null}
        />
      </header>

      {conversation.escalated && (
        <p
          role="status"
          className="text-status-escalated bg-status-escalated-tint mt-4 flex items-start gap-2 rounded-md px-3 py-2 text-sm"
        >
          <TriangleAlert className="mt-0.5 size-4 shrink-0" />
          <span>
            Handed to a human —{" "}
            {conversation.escalationReason ?? "no reason recorded"}.
          </span>
        </p>
      )}

      {/* Transcript and a 320px rail side by side; the rail stacks underneath
          below 1024px rather than squeezing the transcript. */}
      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Card>
          <CardContent className="py-4">
            <h2 className="sr-only">Transcript</h2>
            <Transcript messages={messages} />
          </CardContent>
        </Card>

        <MetadataRail conversation={conversation} timeZone={timeZone} />
      </div>

      {/* Prev/next walk the filtered queue, so a reviewer can work through it
          without returning to the list between every conversation. */}
      <nav
        aria-label="Adjacent conversations"
        className="mt-5 flex items-center justify-between gap-3"
      >
        {neighbors.previous ? (
          <Button variant="outline" size="sm" asChild>
            <Link href={`/conversations/${neighbors.previous.id}${listQuery}`}>
              <ChevronLeft />
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
