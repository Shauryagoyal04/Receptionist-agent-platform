import Link from "next/link";
import { formatDistanceToNowStrict } from "date-fns";
import { Globe, MessageCircle, Phone } from "lucide-react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/status-badge";
import { cn, formatDuration, formatPhone } from "@/lib/utils";
import {
  CHANNEL_LABELS,
  INTENT_LABELS,
  OUTCOME_LABELS,
  OUTCOME_TONE,
  SENTIMENT_LABELS,
  SENTIMENT_TONE,
  TONE_DOT_CLASS,
  TONE_RULE_CLASS,
  type Channel,
  type Conversation,
} from "@/lib/types";

const CHANNEL_ICONS: Record<Channel, typeof Phone> = {
  voice: Phone,
  web_chat: Globe,
  whatsapp: MessageCircle,
};

/**
 * The conversations table.
 *
 * A real <table>, so screen readers announce row and column relationships and
 * the browser's own column alignment does the work. The whole row is
 * clickable via a single link in the first cell that stretches over the row
 * with `after:absolute after:inset-0` — one focusable element per row, Enter
 * opens it, and no nested-interactive markup.
 */
export function ConversationTable({
  conversations,
  queryString,
}: {
  conversations: Conversation[];
  /** Current filter state, carried into the detail page's back link. */
  queryString: string;
}) {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="min-w-[180px]">Patient</TableHead>
            <TableHead className="min-w-[110px]">Channel</TableHead>
            <TableHead className="min-w-[140px]">Intent</TableHead>
            <TableHead className="min-w-[110px]">Outcome</TableHead>
            <TableHead className="text-right">Messages</TableHead>
            <TableHead className="text-right">Duration</TableHead>
            <TableHead className="min-w-[100px]">Sentiment</TableHead>
            <TableHead className="min-w-[110px] text-right">Started</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {conversations.map((conversation) => {
            const ChannelIcon = CHANNEL_ICONS[conversation.channel];
            const started = new Date(conversation.startedAt);
            const outcomeTone = OUTCOME_TONE[conversation.outcome];
            const sentimentTone = SENTIMENT_TONE[conversation.sentiment];

            return (
              <TableRow
                key={conversation.id}
                className={cn(
                  // A thin rule in the outcome color runs down each row, so
                  // escalations are findable while scanning rather than read.
                  "focus-within:bg-muted/60 relative border-l-2",
                  TONE_RULE_CLASS[outcomeTone],
                )}
              >
                <TableCell className="font-medium">
                  <Link
                    href={`/conversations/${conversation.id}${queryString}`}
                    className="after:absolute after:inset-0 after:content-['']"
                  >
                    {conversation.patient.name}
                  </Link>
                  <span className="text-muted-foreground tabular block font-mono text-xs">
                    {formatPhone(conversation.patient.phone)}
                  </span>
                </TableCell>

                <TableCell>
                  <span className="text-muted-foreground flex items-center gap-1.5">
                    <ChannelIcon className="size-3.5 shrink-0" />
                    {CHANNEL_LABELS[conversation.channel]}
                  </span>
                </TableCell>

                <TableCell className="text-muted-foreground">
                  {INTENT_LABELS[conversation.primaryIntent]}
                </TableCell>

                <TableCell>
                  <StatusBadge kind="outcome" value={conversation.outcome}>
                    {OUTCOME_LABELS[conversation.outcome]}
                  </StatusBadge>
                </TableCell>

                <TableCell className="tabular text-right font-mono">
                  {conversation.messageCount}
                </TableCell>

                <TableCell className="tabular text-right font-mono">
                  {formatDuration(conversation.durationSec)}
                </TableCell>

                <TableCell>
                  <span className="flex items-center gap-1.5">
                    <span
                      className={cn(
                        "size-2 shrink-0 rounded-full",
                        TONE_DOT_CLASS[sentimentTone],
                      )}
                    />
                    <span className="text-muted-foreground">
                      {SENTIMENT_LABELS[conversation.sentiment]}
                    </span>
                  </span>
                </TableCell>

                <TableCell className="text-muted-foreground text-right">
                  <time
                    dateTime={conversation.startedAt}
                    title={started.toLocaleString("en-IN", {
                      dateStyle: "medium",
                      timeStyle: "short",
                      timeZone: "Asia/Kolkata",
                    })}
                    className="tabular whitespace-nowrap"
                  >
                    {formatDistanceToNowStrict(started, { addSuffix: true })}
                  </time>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
