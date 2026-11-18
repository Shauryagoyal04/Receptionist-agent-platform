import { ArrowRightLeft, Bot, Check, Clock, Headset, Info, TriangleAlert, UserRound } from "lucide-react";

import { ToolCallBlock } from "@/components/conversations/tool-call-block";
import { cn, formatLatency } from "@/lib/utils";
import { formatInZone } from "@/lib/time";
import {
  LOW_CONFIDENCE_THRESHOLD,
  type Message,
  type MessageRole,
} from "@/lib/types";

const ROLE_LABELS: Record<MessageRole, string> = {
  patient: "Patient",
  agent: "Agent",
  system: "System",
  staff: "Staff",
};

/** `9:30:12 am` on the clinic's clock. */
export function messageTime(iso: string, timeZone: string): string {
  return formatInZone(iso, timeZone, { hour: "numeric", minute: "2-digit", second: "2-digit" });
}

/**
 * The transcript.
 *
 * Deliberately NOT an SMS-style left/right chat: staff read these as a log of
 * what happened, not as a conversation they are part of. Everything sits on
 * one axis so the eye scans a single column. Who spoke is carried by colour,
 * the same everywhere in the console: petrol is the agent, amber is clinic
 * staff, and the patient is neutral. Tool calls and events are quieter still.
 */
export function Transcript({ messages, timeZone }: { messages: Message[]; timeZone: string }) {
  if (messages.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
        <span className="bg-sunken text-ink-3 flex size-11 items-center justify-center rounded-xl">
          <Info className="size-5" aria-hidden="true" />
        </span>
        <div>
          <p className="text-ink text-[15px] font-semibold">No messages recorded</p>
          <p className="text-ink-3 mx-auto mt-1 max-w-sm text-[13px]">
            The agent logged this conversation but sent no transcript with it. The summary and
            details beside this still apply.
          </p>
        </div>
      </div>
    );
  }

  return (
    <ol className="flex flex-col gap-4">
      {messages.map((message) => (
        <li key={message.id}>
          <MessageBlock message={message} timeZone={timeZone} />
        </li>
      ))}
    </ol>
  );
}

const ROLE_STYLE: Record<
  "patient" | "agent" | "staff",
  { avatar: string; bubble: string; name: string; icon: typeof Bot }
> = {
  patient: {
    avatar: "bg-sunken text-ink-2",
    bubble: "bg-surface border border-line",
    name: "text-ink",
    icon: UserRound,
  },
  agent: {
    avatar: "bg-agent text-white",
    bubble: "bg-agent-soft",
    name: "text-agent-text",
    icon: Bot,
  },
  staff: {
    avatar: "bg-human text-white",
    bubble: "bg-human-soft",
    name: "text-human-text",
    icon: Headset,
  },
};

function MessageBlock({ message, timeZone }: { message: Message; timeZone: string }) {
  if (message.type === "tool_call" && message.tool) {
    return <ToolCallBlock tool={message.tool} timestamp={message.timestamp} timeZone={timeZone} />;
  }

  // Handoffs and system events are events, not utterances, so they render as
  // centered dividers rather than as something someone said.
  if (message.type === "handoff" || message.type === "system_event" || message.role === "system") {
    const isHandoff = message.type === "handoff";
    const Icon = isHandoff ? ArrowRightLeft : Info;
    return (
      <div className="flex items-center gap-3 py-1">
        <span className="bg-line h-px flex-1" />
        <span
          className={cn(
            "flex max-w-[80%] items-center gap-1.5 rounded-full px-3 py-1 text-center text-xs",
            isHandoff ? "bg-human-soft text-human-text font-medium" : "bg-sunken text-ink-3",
          )}
        >
          <Icon className="size-3.5 shrink-0" aria-hidden="true" />
          {message.content}
          <time dateTime={message.timestamp} className="tnum opacity-70">
            · {messageTime(message.timestamp, timeZone)}
          </time>
        </span>
        <span className="bg-line h-px flex-1" />
      </div>
    );
  }

  const role = message.role === "agent" ? "agent" : message.role === "staff" ? "staff" : "patient";
  const style = ROLE_STYLE[role];
  const Icon = style.icon;
  const isAgent = role === "agent";
  const lowConfidence =
    isAgent && message.confidence !== null && message.confidence < LOW_CONFIDENCE_THRESHOLD;

  return (
    <div className="flex gap-3">
      <span
        aria-hidden="true"
        className={cn("mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full", style.avatar)}
      >
        <Icon className="size-4" strokeWidth={1.75} />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className={cn("text-[13px] font-semibold", style.name)}>
            {role === "staff" && message.staff
              ? `${message.staff.name} · clinic staff`
              : ROLE_LABELS[message.role]}
          </span>
          <time dateTime={message.timestamp} className="tnum text-ink-3 text-xs">
            {messageTime(message.timestamp, timeZone)}
          </time>
          {isAgent && message.latencyMs !== null && (
            <span className="tnum text-ink-4 text-xs" title="How long the agent took to reply">
              replied in {formatLatency(message.latencyMs)}
            </span>
          )}
        </div>

        <div className={cn("mt-1 w-fit max-w-full rounded-xl rounded-tl-sm px-3.5 py-2.5", style.bubble)}>
          {/* Voice turns carry a recording. The player sits above the text so
              a reviewer can listen and read the transcription together. */}
          {message.audioUrl && (
            <audio controls preload="none" src={message.audioUrl} className="mb-2 h-8 w-full max-w-sm">
              Your browser cannot play this recording.
            </audio>
          )}
          <p className="text-ink text-[15px] leading-[22px] whitespace-pre-wrap">{message.content}</p>
        </div>

        {role === "staff" && message.delivery && <DeliveryStatus delivery={message.delivery} />}

        {lowConfidence && message.confidence !== null && (
          <p className="text-human-text mt-1.5 flex items-center gap-1.5 text-xs">
            <TriangleAlert className="size-3.5 shrink-0" aria-hidden="true" />
            The agent was unsure here (confidence{" "}
            <span className="tnum">{message.confidence.toFixed(2)}</span>). Worth a check.
          </p>
        )}
      </div>
    </div>
  );
}

/** Where a staff reply is: queued for the agent to send, sent, or failed. */
function DeliveryStatus({ delivery }: { delivery: NonNullable<Message["delivery"]> }) {
  if (delivery.status === "sent") {
    return (
      <p className="text-ink-3 mt-1.5 flex items-center gap-1 text-xs">
        <Check className="text-booked size-3.5 shrink-0" aria-hidden="true" />
        Sent on WhatsApp
      </p>
    );
  }
  if (delivery.status === "failed") {
    return (
      <p role="alert" className="text-danger-text mt-1.5 flex items-start gap-1.5 text-xs">
        <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
        Not delivered{delivery.error ? `: ${delivery.error}` : ""}. Call the patient instead.
      </p>
    );
  }
  return (
    <p className="text-ink-3 mt-1.5 flex items-center gap-1 text-xs">
      <Clock className="size-3.5 shrink-0" aria-hidden="true" />
      Sending…
    </p>
  );
}
