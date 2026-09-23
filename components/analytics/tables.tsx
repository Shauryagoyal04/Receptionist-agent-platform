import Link from "next/link";
import { formatDistanceToNowStrict } from "date-fns";
import { ArrowRight } from "lucide-react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn, formatLatency } from "@/lib/utils";
import { toolLabel } from "@/lib/types";
import type {
  EscalationRow,
  ToolReliabilityRow,
} from "@/lib/analytics/aggregate";

/**
 * The most actionable thing on the page: conversations where the patient
 * asked for a person, newest first, each one click from the transcript.
 *
 * With no handoff process this is a work queue rather than a log — the agent
 * has told each of these patients that someone would follow up, and nobody
 * has. `actionable` switches the column heading to say so.
 */
export function EscalationTable({
  rows,
  emptyLabel,
  actionable = false,
}: {
  rows: EscalationRow[];
  emptyLabel: string;
  actionable?: boolean;
}) {
  if (rows.length === 0) {
    return (
      <p className="text-muted-foreground px-4 py-10 text-center text-sm">
        {emptyLabel}
      </p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead>{actionable ? "Needs a reply" : "Patient"}</TableHead>
          <TableHead>Reason</TableHead>
          <TableHead className="text-right">Asked</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => {
          const started = new Date(row.startedAt);
          return (
            <TableRow key={row.id} className="focus-within:bg-muted/60 relative">
              <TableCell className="font-medium">
                <Link
                  href={`/conversations/${row.id}`}
                  className="after:absolute after:inset-0 after:content-['']"
                >
                  {row.patientName}
                </Link>
              </TableCell>
              <TableCell className="text-muted-foreground">
                {row.reason}
              </TableCell>
              <TableCell className="text-muted-foreground text-right">
                <time
                  dateTime={row.startedAt}
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
  );
}

/** Success rate below this reads as a tool that needs looking at. */
const UNHEALTHY_RATE = 0.9;

/**
 * Per-tool call volume, success rate and median duration.
 *
 * Computed from the `toolStats` denormalized onto each conversation, so this
 * costs nothing beyond the conversations already fetched for the range.
 */
export function ToolReliabilityTable({ rows }: { rows: ToolReliabilityRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="text-muted-foreground px-4 py-10 text-center text-sm">
        No tool calls recorded in this range.
      </p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead>Tool</TableHead>
          <TableHead className="text-right">Calls</TableHead>
          <TableHead className="text-right">Success</TableHead>
          <TableHead className="text-right">Median</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => {
          const unhealthy = row.successRate < UNHEALTHY_RATE;
          return (
            <TableRow key={row.name}>
              <TableCell className="font-medium">
                {toolLabel(row.name)}
              </TableCell>
              <TableCell className="tabular text-right font-mono">
                {row.calls}
              </TableCell>
              <TableCell
                className={cn(
                  "tabular text-right font-mono",
                  unhealthy && "text-status-escalated font-medium",
                )}
              >
                {(row.successRate * 100).toFixed(1)}%
                {row.errors > 0 && (
                  <span className="text-muted-foreground ml-1 font-sans text-xs">
                    ({row.errors} failed)
                  </span>
                )}
              </TableCell>
              <TableCell className="tabular text-muted-foreground text-right font-mono">
                {formatLatency(row.medianDurationMs)}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

export function ViewAllLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-xs"
    >
      {label}
      <ArrowRight className="size-3" />
    </Link>
  );
}
