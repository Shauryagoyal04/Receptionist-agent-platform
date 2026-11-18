import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { msSince } from "@/lib/time";
import { CHANNEL_CHART_COLOR, CHANNEL_LABELS, CHANNELS, type Channel } from "@/lib/types";
import { cn } from "@/lib/utils";

/** A chat within this window counts as that channel being live right now. */
const LIVE_WINDOW_MS = 24 * 60 * 60 * 1000;

type State = "waiting" | "live" | "quiet" | "new";

/** `just now`, `12m ago`, `3h ago`, `4d ago`. */
function shortAgo(ms: number): string {
  const minutes = Math.floor(ms / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

/**
 * The agent's state, above the user menu, so staff can see from any page
 * that it is working, or that someone is waiting for them.
 *
 * Read from real conversations, per channel. The console gets no heartbeat
 * from the WhatsApp or voice agent, so the only honest evidence that one is
 * live is that it handled a conversation recently. Each channel says when it
 * last did, and the headline says "live" only if at least one did within a
 * day. Channels are the ones turned on in ENABLED_CHANNELS plus any that
 * have conversations, so a channel missing from the config still shows up
 * once it is used.
 *
 * The pulse is the only infinite animation in the console; reduced motion
 * turns it into a still dot.
 */
export function AgentStatus({
  openEscalations,
  latestByChannel,
  enabledChannels,
}: {
  openEscalations: number;
  /** Null when the lookup failed; the status then claims nothing. */
  latestByChannel: Record<Channel, string | null> | null;
  enabledChannels: Channel[];
}) {
  const rows = CHANNELS.filter(
    (channel) => enabledChannels.includes(channel) || Boolean(latestByChannel?.[channel]),
  )
    // WhatsApp first, then voice, then web chat.
    .sort((a, b) => order(a) - order(b))
    .map((channel) => {
      const at = latestByChannel?.[channel] ?? null;
      const age = at ? msSince(at) : null;
      return { channel, age, live: age !== null && age <= LIVE_WINDOW_MS };
    });

  const anyLive = rows.some((row) => row.live);
  const anyData = rows.some((row) => row.age !== null);
  const state: State =
    openEscalations > 0 ? "waiting" : anyLive ? "live" : anyData ? "quiet" : "new";

  const title: Record<State, string> = {
    waiting: `${openEscalations} ${openEscalations === 1 ? "chat" : "chats"} waiting for you`,
    live: "Agent is live",
    quiet: "No chats in the last day",
    new: "Waiting for the first chat",
  };

  return (
    <Link
      href={state === "waiting" ? "/escalations" : "/conversations"}
      className={cn(
        "group/status block rounded-[10px] border px-3 py-2.5 transition-colors duration-(--dur-quick)",
        state === "waiting"
          ? "bg-human-soft hover:border-human/40 border-transparent"
          : "bg-surface border-line hover:bg-sunken/60",
      )}
    >
      <span className="flex items-center gap-2.5">
        <span
          aria-hidden="true"
          className={cn(
            "relative size-2.5 shrink-0 rounded-full",
            state === "waiting" && "bg-human text-human md-pulse",
            state === "live" && "bg-agent text-agent md-pulse",
            (state === "quiet" || state === "new") && "bg-none",
          )}
        />
        <span
          className={cn(
            "min-w-0 flex-1 truncate text-[13px] leading-[18px] font-medium",
            state === "waiting" ? "text-human-text" : "text-ink",
          )}
        >
          {title[state]}
        </span>
        <ChevronRight
          aria-hidden="true"
          className={cn(
            "size-4 shrink-0 transition-transform duration-(--dur-quick) group-hover/status:translate-x-0.5",
            state === "waiting" ? "text-human-text" : "text-ink-4",
          )}
        />
      </span>

      {rows.length > 0 && (
        <span className="mt-1.5 flex flex-col gap-0.5 pl-5">
          {rows.map((row) => (
            <span key={row.channel} className="flex items-center gap-2 text-xs leading-4">
              <span
                aria-hidden="true"
                className="size-1.5 shrink-0 rounded-full"
                style={
                  row.live
                    ? { backgroundColor: CHANNEL_CHART_COLOR[row.channel] }
                    : { boxShadow: "inset 0 0 0 1.5px var(--ink-4)" }
                }
              />
              <span className={state === "waiting" ? "text-human-text" : "text-ink-2"}>
                {CHANNEL_LABELS[row.channel]}
              </span>
              <span
                className={cn(
                  "tnum ml-auto",
                  state === "waiting" ? "text-human-text/80" : "text-ink-3",
                )}
              >
                {row.age === null ? "no chats yet" : shortAgo(row.age)}
              </span>
            </span>
          ))}
        </span>
      )}
    </Link>
  );
}

function order(channel: Channel): number {
  return channel === "whatsapp" ? 0 : channel === "voice" ? 1 : 2;
}
