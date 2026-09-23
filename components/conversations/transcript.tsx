import { ArrowRightLeft, Info, TriangleAlert } from "lucide-react";

import { ToolCallBlock } from "@/components/conversations/tool-call-block";
import { cn, formatLatency } from "@/lib/utils";
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

/**
 * The transcript.
 *
 * Deliberately NOT an SMS-style left/right chat: staff read these as a log of
 * what happened, not as a conversation they are part of. Everything is
 * left-aligned on one axis so the eye scans a single column; the agent's
 * turns are distinguished by a colored left rule and a faint tint rather than
 * by being pushed to the other side of the screen.
 */
export function Transcript({ messages }: { messages: Message[] }) {
  if (messages.length === 0) {
    return (
      <p className="text-muted-foreground px-4 py-12 text-center text-sm">
        This conversation has no messages recorded.
      </p>
    );
  }

  return (
    <ol className="flex flex-col gap-3">
      {messages.map((message) => (
        <li key={message.id}>
          <MessageBlock message={message} />
        </li>
      ))}
    </ol>
  );
}

function MessageBlock({ message }: { message: Message }) {
  if (message.type === "tool_call" && message.tool) {
    return <ToolCallBlock tool={message.tool} timestamp={message.timestamp} />;
  }

  // Handoffs and system events are events, not utterances, so they render as
  // centered dividers rather than as something someone said.
  if (message.type === "handoff" || message.type === "system_event") {
    const isHandoff = message.type === "handoff";
    const Icon = isHandoff ? ArrowRightLeft : Info;
    return (
      <div className="flex items-center gap-3 py-1">
        <span className="bg-border h-px flex-1" />
        <span
          className={cn(
            "flex items-center gap-1.5 text-xs",
            isHandoff ? "text-status-escalated font-medium" : "text-muted-foreground",
          )}
        >
          <Icon className="size-3.5 shrink-0" />
          {message.content}
        </span>
        <span className="bg-border h-px flex-1" />
      </div>
    );
  }

  const isAgent = message.role === "agent";
  const lowConfidence =
    isAgent &&
    message.confidence !== null &&
    message.confidence < LOW_CONFIDENCE_THRESHOLD;

  return (
    <div
      className={cn(
        "rounded-md px-3 py-2.5",
        isAgent ? "bg-muted/40 border-l-2 border-l-primary" : "border bg-card",
      )}
    >
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="text-xs font-medium">{ROLE_LABELS[message.role]}</span>
        <time
          dateTime={message.timestamp}
          className="text-muted-foreground tabular font-mono text-xs"
        >
          {message.timestamp.slice(11, 19)}
        </time>
        {isAgent && message.latencyMs !== null && (
          <span className="text-muted-foreground tabular font-mono text-xs">
            {formatLatency(message.latencyMs)}
          </span>
        )}
      </div>

      {/* Voice turns carry a recording. The player sits above the text so a
          reviewer can listen and read the transcription together. */}
      {message.audioUrl && (
        <audio
          controls
          preload="none"
          src={message.audioUrl}
          className="mt-2 h-8 w-full max-w-sm"
        >
          Your browser cannot play this recording.
        </audio>
      )}

      <p className="mt-1 text-sm whitespace-pre-wrap">{message.content}</p>

      {lowConfidence && message.confidence !== null && (
        <p className="text-status-abandoned mt-1.5 flex items-center gap-1.5 text-xs">
          <TriangleAlert className="size-3.5 shrink-0" />
          The agent was unsure here — confidence{" "}
          <span className="tabular font-mono">
            {message.confidence.toFixed(2)}
          </span>
        </p>
      )}
    </div>
  );
}
