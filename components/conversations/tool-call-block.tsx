import { ChevronRight, CircleAlert, Wrench } from "lucide-react";

import { cn } from "@/lib/utils";
import { formatInZone } from "@/lib/time";
import { summarizeToolCall } from "@/lib/conversations/tool-summary";
import { toolLabel, type ToolInvocation } from "@/lib/types";

/**
 * A tool call in the transcript: something the agent did, not something it
 * said.
 *
 * Indented under the agent's column and quieter than a message: what was
 * called, what it did in one sentence, and how long it took. The raw payload
 * is one disclosure away for when a reviewer needs to know exactly what the
 * agent sent. A failed call is coloured and always shows its error without
 * being expanded — a silent failure buried behind a toggle is the single
 * most useful thing to surface when a booking did not happen.
 */
export function ToolCallBlock({
  tool,
  timestamp,
  timeZone,
}: {
  tool: ToolInvocation;
  timestamp: string;
  timeZone: string;
}) {
  const failed = tool.status === "error";

  return (
    <div
      className={cn(
        "ml-11 rounded-[10px] border px-3 py-2.5",
        failed ? "border-danger/30 bg-danger-soft" : "border-line bg-sunken/50",
      )}
    >
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span
          aria-hidden="true"
          className={cn(
            "flex size-5 items-center justify-center rounded-md",
            failed ? "bg-danger text-white" : "bg-agent-soft text-agent",
          )}
        >
          {failed ? <CircleAlert className="size-3" /> : <Wrench className="size-3" />}
        </span>
        <span className={cn("text-[13px] font-medium", failed ? "text-danger-text" : "text-ink-2")}>
          {failed ? `${toolLabel(tool.name)} failed` : toolLabel(tool.name)}
        </span>
        <span className="tnum text-ink-4 text-xs">{tool.durationMs.toLocaleString("en-IN")} ms</span>
        <time dateTime={timestamp} className="tnum text-ink-3 ml-auto text-xs">
          {formatInZone(timestamp, timeZone, { hour: "numeric", minute: "2-digit", second: "2-digit" })}
        </time>
      </div>

      <p className={cn("mt-1 text-[13px] leading-[18px]", failed ? "text-danger-text" : "text-ink-2")}>
        {summarizeToolCall(tool)}
      </p>

      {failed && tool.error && (
        <p className="text-danger-text mt-1.5 font-mono text-xs break-words">{tool.error}</p>
      )}

      <details className="group mt-1.5">
        <summary className="text-ink-3 hover:text-ink inline-flex cursor-pointer list-none items-center gap-1 rounded text-xs select-none [&::-webkit-details-marker]:hidden">
          <ChevronRight
            aria-hidden="true"
            className="size-3.5 transition-transform duration-(--dur-quick) group-open:rotate-90"
          />
          <span className="group-open:hidden">Show what the agent sent</span>
          <span className="hidden group-open:inline">Hide details</span>
        </summary>
        <div className="mt-2 flex flex-col gap-2">
          <Payload label="Sent" value={tool.args} />
          <Payload label="Got back" value={tool.result} />
        </div>
      </details>
    </div>
  );
}

function Payload({ label, value }: { label: string; value: unknown }) {
  return (
    <div>
      <p className="text-ink-3 mb-1 text-xs font-medium">{label}</p>
      <pre className="bg-surface border-line text-ink-2 overflow-x-auto rounded-lg border p-2.5 font-mono text-xs">
        {value === null ? "null" : JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
}
