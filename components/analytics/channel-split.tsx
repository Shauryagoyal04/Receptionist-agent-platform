import Link from "next/link";
import { MessageCircle, MessagesSquare, Phone, type LucideIcon } from "lucide-react";

import { formatMetric, formatShare } from "@/components/analytics/format";
import { CHANNEL_LABELS, CHANNEL_MEANING, meaningVar, type Channel } from "@/lib/types";
import type { CountShare } from "@/lib/analytics/aggregate";

export const CHANNEL_ICON: Record<Channel, LucideIcon> = {
  whatsapp: MessageCircle,
  voice: Phone,
  web_chat: MessagesSquare,
};

/** Conversations by channel, in the channel colours. */
export function ChannelSplit({
  data,
  channels,
  hrefFor,
}: {
  data: CountShare<Channel>[];
  /** The channels this clinic has turned on, in display order. */
  channels: Channel[];
  hrefFor: (channel: Channel) => string;
}) {
  const byKey = new Map(data.map((entry) => [entry.key, entry]));
  return (
    <ul className="flex flex-col gap-1">
      {channels.map((channel, index) => {
        const entry = byKey.get(channel) ?? { key: channel, count: 0, share: 0 };
        const Icon = CHANNEL_ICON[channel];
        const meaning = CHANNEL_MEANING[channel];
        return (
          <li key={channel}>
            <Link
              href={hrefFor(channel)}
              className="hover:bg-sunken/60 -mx-2 block rounded-lg px-2 py-2 transition-colors duration-(--dur-quick)"
            >
              <span className="flex items-center gap-2.5">
                <span
                  className="flex size-7 items-center justify-center rounded-lg"
                  style={{ backgroundColor: meaningVar(meaning, "soft"), color: meaningVar(meaning) }}
                >
                  <Icon className="size-4" strokeWidth={1.75} aria-hidden="true" />
                </span>
                <span className="text-ink-2 text-sm">{CHANNEL_LABELS[channel]}</span>
                <span className="tnum text-ink ml-auto text-sm font-semibold">{formatMetric("count", entry.count)}</span>
                <span className="tnum text-ink-3 w-10 text-right text-[13px]">{formatShare(entry.share)}</span>
              </span>
              <span className="bg-sunken mt-2 block h-1.5 overflow-hidden rounded-full">
                {entry.count > 0 && (
                  <span
                    className="md-grow-x block h-full rounded-full"
                    style={{
                      width: `${entry.share * 100}%`,
                      backgroundColor: meaningVar(meaning),
                      animationDelay: `${index * 40}ms`,
                    }}
                  />
                )}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
