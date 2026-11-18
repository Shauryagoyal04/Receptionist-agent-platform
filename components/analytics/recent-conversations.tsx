import Link from "next/link";
import { formatDistanceToNowStrict } from "date-fns";
import { ChevronRight, Inbox } from "lucide-react";

import { CHANNEL_ICON } from "@/components/analytics/channel-split";
import { RegionEmpty } from "@/components/analytics/panel";
import { maskPhone } from "@/components/analytics/format";
import { formatInZone } from "@/lib/time";
import {
  CHANNEL_LABELS,
  CHANNEL_MEANING,
  OUTCOME_MEANING,
  meaningVar,
} from "@/lib/types";
import type { RecentConversationRow } from "@/lib/analytics/aggregate";
import type { Outcome } from "@/lib/types";

/**
 * The five newest conversations, each one click from its transcript. Useful
 * on day one, when there is not enough data for any chart to say much.
 */
export function RecentConversations({
  rows,
  labels,
  timeZone,
}: {
  rows: RecentConversationRow[];
  labels: Record<Outcome, string>;
  timeZone: string;
}) {
  if (rows.length === 0) {
    return (
      <RegionEmpty icon={Inbox} title="No conversations in this range yet.">
        Each WhatsApp chat or call the agent handles will appear here as it ends.
      </RegionEmpty>
    );
  }

  return (
    <ul className="-mx-5 -mb-5">
      {rows.map((row) => {
        const Icon = CHANNEL_ICON[row.channel];
        const channel = CHANNEL_MEANING[row.channel];
        const outcome = OUTCOME_MEANING[row.outcome];
        const started = new Date(row.startedAt);
        return (
          <li key={row.id} className="border-line border-t">
            <Link
              href={`/conversations/${row.id}`}
              className="group/row hover:bg-sunken/60 flex h-14 items-center gap-3 px-5 transition-colors duration-(--dur-quick)"
            >
              <span
                className="flex size-8 shrink-0 items-center justify-center rounded-lg"
                style={{ backgroundColor: meaningVar(channel, "soft"), color: meaningVar(channel) }}
              >
                <Icon className="size-4" strokeWidth={1.75} />
                <span className="sr-only">{CHANNEL_LABELS[row.channel]}</span>
              </span>
              <span className="w-36 shrink-0 truncate text-sm">
                <span className="text-ink font-medium">
                  {row.patientName.trim() || maskPhone(row.patientPhone)}
                </span>
              </span>
              <span className="text-ink-3 hidden min-w-0 flex-1 truncate text-[13px] md:block">
                {row.preview}
              </span>
              <span
                className="ml-auto inline-flex h-6 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium md:ml-0"
                style={{ backgroundColor: meaningVar(outcome, "soft"), color: meaningVar(outcome, "text") }}
              >
                <span className="size-1.5 rounded-full" style={{ backgroundColor: meaningVar(outcome) }} />
                {labels[row.outcome]}
              </span>
              <time
                dateTime={row.startedAt}
                title={formatInZone(row.startedAt, timeZone, {
                  day: "numeric",
                  month: "short",
                  hour: "numeric",
                  minute: "2-digit",
                })}
                className="tnum text-ink-3 w-20 shrink-0 text-right text-[13px]"
              >
                {formatDistanceToNowStrict(started, { addSuffix: true })}
              </time>
              <ChevronRight className="text-ink-4 group-hover/row:text-ink-2 size-4 shrink-0 transition-colors duration-(--dur-quick)" />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
