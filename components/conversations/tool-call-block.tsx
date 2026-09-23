import { CircleAlert, Wrench } from "lucide-react";

import { cn } from "@/lib/utils";
import { summarizeToolCall } from "@/lib/conversations/tool-summary";
import { toolLabel, type ToolInvocation } from "@/lib/types";

/**
 * A tool call in the transcript.
 *
 * Reads as a compact record of an action, not a chat bubble: what was called,
 * what it did in one sentence, and how long it took. The raw payload is one
 * disclosure away for when a reviewer needs to know exactly what the agent
 * sent. A failed call is colored and always shows its error without being
 * expanded — a silent failure buried behind a toggle is the single most
 * useful thing to surface when a booking did not happen.
 */
export function ToolCallBlock({
  tool,
  timestamp,
}: {
  tool: ToolInvocation;
  timestamp: string;
}) {
  const failed = tool.status === "error";

  return (
    <div
      className={cn(
        "rounded-md border px-3 py-2.5",
        failed ? "border-status-escalated/40 bg-status-escalated-tint" : "bg-muted/40",
      )}
    >
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        {failed ? (
          <CircleAlert className="text-status-escalated size-3.5 shrink-0" />
        ) : (
          <Wrench className="text-muted-foreground size-3.5 shrink-0" />
        )}
        <span
          className={cn(
            "font-mono text-xs font-medium",
            failed && "text-status-escalated",
          )}
        >
          {toolLabel(tool.name)}
        </span>
        <span className="text-muted-foreground tabular font-mono text-xs">
          {tool.durationMs}ms
        </span>
        <time
          dateTime={timestamp}
          className="text-muted-foreground tabular ml-auto font-mono text-xs"
        >
          {timestamp.slice(11, 19)}
        </time>
      </div>

      <p className={cn("mt-1 text-sm", failed && "text-status-escalated")}>
        {summarizeToolCall(tool)}
      </p>

      {failed && tool.error && (
        <p className="text-status-escalated mt-1.5 font-mono text-xs break-words">
          {tool.error}
        </p>
      )}

      <details className="group mt-2">
        <summary className="text-muted-foreground hover:text-foreground cursor-pointer text-xs select-none">
          <span className="group-open:hidden">Show payload</span>
          <span className="hidden group-open:inline">Hide payload</span>
        </summary>
        <div className="mt-2 flex flex-col gap-2">
          <Payload label="Arguments" value={tool.args} />
          <Payload label="Result" value={tool.result} />
        </div>
      </details>
    </div>
  );
}

function Payload({ label, value }: { label: string; value: unknown }) {
  return (
    <div>
      <p className="text-muted-foreground mb-1 text-xs font-medium">{label}</p>
      <pre className="bg-background overflow-x-auto rounded-md border p-2 font-mono text-xs">
        {value === null ? "null" : JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
}
