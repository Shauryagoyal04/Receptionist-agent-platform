import Link from "next/link";
import { formatDistanceToNowStrict } from "date-fns";
import { ChevronRight } from "lucide-react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/status-badge";
import { CHANNEL_ICON } from "@/components/analytics/channel-split";
import { formatHandlingTime } from "@/components/analytics/format";
import { formatInZone } from "@/lib/time";
import { formatPhone } from "@/lib/utils";
import {
  CHANNEL_LABELS,
  CHANNEL_MEANING,
  SENTIMENT_MEANING,
  INTENT_LABELS,
  SENTIMENT_LABELS,
  meaningVar,
  outcomeLabels,
  type Conversation,
} from "@/lib/types";

/**
 * The conversations table.
 *
 * A real <table>, so screen readers announce row and column relationships and
 * the browser's own column alignment does the work. The whole row is
 * clickable via a single link in the first cell that stretches over the row
 * with `after:absolute after:inset-0` — one focusable element per row, Enter
 * opens it, and no nested-interactive markup. A chevron at the end of the row
 * darkens on hover to hint that the row opens the transcript.
 */
export function ConversationTable({
  conversations,
  queryString,
  showChannel,
  handoffEnabled,
  timeZone,
}: {
  conversations: Conversation[];
  /** Current filter state, carried into the detail page's back link. */
  queryString: string;
  /**
   * When only one channel can occur, the channel well is still shown (it
   * carries the colour) but the separate column is dropped.
   */
  showChannel: boolean;
  handoffEnabled: boolean;
  timeZone: string;
}) {
  const outcomeLabel = outcomeLabels(handoffEnabled);

  return (
    <Table>
      <TableHeader className="sticky top-0 z-10">
        <TableRow>
          <TableHead className="min-w-[220px]">Patient</TableHead>
          {showChannel && <TableHead className="min-w-[110px]">Channel</TableHead>}
          <TableHead className="min-w-[150px]">Asked about</TableHead>
          <TableHead className="min-w-[130px]">How it ended</TableHead>
          <TableHead className="text-right">Messages</TableHead>
          <TableHead className="text-right">Duration</TableHead>
          <TableHead className="min-w-[100px]">Mood</TableHead>
          <TableHead className="min-w-[110px] text-right">Started</TableHead>
          <TableHead className="w-10" aria-hidden="true" />
        </TableRow>
      </TableHeader>

      <TableBody>
        {conversations.map((conversation) => {
          const ChannelIcon = CHANNEL_ICON[conversation.channel];
          const channel = CHANNEL_MEANING[conversation.channel];
          const sentiment = SENTIMENT_MEANING[conversation.sentiment];
          const started = new Date(conversation.startedAt);

          return (
            <TableRow
              key={conversation.id}
              className="group/row focus-within:bg-sunken/60 relative cursor-pointer"
            >
              <TableCell>
                <span className="flex items-center gap-3">
                  <span
                    className="flex size-8 shrink-0 items-center justify-center rounded-lg"
                    style={{
                      backgroundColor: meaningVar(channel, "soft"),
                      color: meaningVar(channel),
                    }}
                    aria-hidden="true"
                  >
                    <ChannelIcon className="size-4" strokeWidth={1.75} />
                  </span>
                  <span className="min-w-0">
                    <Link
                      href={`/conversations/${conversation.id}${queryString}`}
                      className="text-ink block truncate font-medium outline-none after:absolute after:inset-0 after:content-[''] focus-visible:after:rounded-sm focus-visible:after:outline-2 focus-visible:after:-outline-offset-2 focus-visible:after:outline-(--focus)"
                    >
                      {conversation.patient.name}
                      {!showChannel && (
                        <span className="sr-only">, {CHANNEL_LABELS[conversation.channel]}</span>
                      )}
                    </Link>
                    <span className="tnum text-ink-3 block text-[13px]">
                      {formatPhone(conversation.patient.phone)}
                    </span>
                  </span>
                </span>
              </TableCell>

              {showChannel && (
                <TableCell className="text-ink-2">{CHANNEL_LABELS[conversation.channel]}</TableCell>
              )}

              <TableCell className="text-ink-2">
                {INTENT_LABELS[conversation.primaryIntent]}
              </TableCell>

              <TableCell>
                <StatusBadge kind="outcome" value={conversation.outcome}>
                  {outcomeLabel[conversation.outcome]}
                </StatusBadge>
              </TableCell>

              <TableCell className="text-ink text-right">{conversation.messageCount}</TableCell>

              <TableCell className="text-ink text-right">
                {formatHandlingTime(conversation.durationSec)}
              </TableCell>

              <TableCell>
                <span className="text-ink-2 flex items-center gap-2">
                  <span
                    aria-hidden="true"
                    className="size-2 shrink-0 rounded-full"
                    style={{ backgroundColor: meaningVar(sentiment) }}
                  />
                  {SENTIMENT_LABELS[conversation.sentiment]}
                </span>
              </TableCell>

              <TableCell className="text-ink-3 text-right">
                <time
                  dateTime={conversation.startedAt}
                  title={formatInZone(conversation.startedAt, timeZone, {
                    day: "numeric",
                    month: "short",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                  className="whitespace-nowrap"
                >
                  {formatDistanceToNowStrict(started, { addSuffix: true })}
                </time>
              </TableCell>

              <TableCell className="pr-3 pl-0">
                <ChevronRight
                  aria-hidden="true"
                  className="text-ink-4 group-hover/row:text-ink-2 size-4 transition-[color,transform] duration-(--dur-quick) group-hover/row:translate-x-0.5"
                />
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
