"use client";

import * as React from "react";
import Link from "next/link";

import { formatMetric, formatShare } from "@/components/analytics/format";
import { OUTCOME_CHART_COLOR, type Outcome } from "@/lib/types";
import type { CountShare } from "@/lib/analytics/aggregate";
import { cn } from "@/lib/utils";

/**
 * How conversations ended: one segmented bar in the fixed outcome colours,
 * with a legend that carries the numbers. Hovering a segment or a legend row
 * dims the rest; each legend row opens Conversations filtered to it.
 *
 * A bar rather than a donut: small slices are what someone needs to read
 * accurately, and the eye compares lengths far better than angles.
 */
export function OutcomeBar({
  data,
  labels,
  hrefFor,
}: {
  data: CountShare<Outcome>[];
  labels: Record<Outcome, string>;
  /** Conversations list URL filtered to an outcome, keyed by outcome. */
  hrefFor: Record<Outcome, string>;
}) {
  const [hovered, setHovered] = React.useState<Outcome | null>(null);
  const rows = data.filter((entry) => entry.count > 0);
  const dim = (key: Outcome) => hovered !== null && hovered !== key;

  return (
    <div className="flex flex-col gap-4">
      <div
        className="flex h-3 w-full gap-0.5 overflow-hidden rounded-full"
        role="img"
        aria-label={rows.map((r) => `${labels[r.key]}: ${r.count}`).join("; ")}
      >
        {rows.map((entry, index) => (
          <div
            key={entry.key}
            aria-hidden="true"
            onMouseEnter={() => setHovered(entry.key)}
            onMouseLeave={() => setHovered(null)}
            title={`${labels[entry.key]}: ${entry.count} (${formatShare(entry.share)})`}
            className="md-grow-x h-full first:rounded-l-full last:rounded-r-full"
            style={{
              flexGrow: entry.count,
              flexBasis: 0,
              backgroundColor: OUTCOME_CHART_COLOR[entry.key],
              opacity: dim(entry.key) ? 0.35 : 1,
              transition: "opacity var(--dur-quick) var(--ease-out)",
              animationDelay: `${index * 40}ms`,
            }}
          />
        ))}
      </div>

      <ul className="grid grid-cols-1 gap-x-6 sm:grid-cols-2">
        {rows.map((entry) => (
          <li key={entry.key}>
            <Link
              href={hrefFor[entry.key]}
              onMouseEnter={() => setHovered(entry.key)}
              onMouseLeave={() => setHovered(null)}
              onFocus={() => setHovered(entry.key)}
              onBlur={() => setHovered(null)}
              className={cn(
                "hover:bg-sunken/60 -mx-2 flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm transition-[background-color,opacity] duration-(--dur-quick)",
                dim(entry.key) && "opacity-35",
              )}
            >
              <span
                className="size-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: OUTCOME_CHART_COLOR[entry.key] }}
              />
              <span className="text-ink-2 truncate">{labels[entry.key]}</span>
              <span className="tnum text-ink ml-auto font-medium">{formatMetric("count", entry.count)}</span>
              <span className="tnum text-ink-3 w-11 text-right text-[13px]">{formatShare(entry.share)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
